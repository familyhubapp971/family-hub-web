import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion';
import { ChevronLeft } from 'lucide-react';
import { AvatarGrid, PinInput, type AvatarTile } from '@familyhub/ui';
import { API_BASE } from '../../app/lib/api';

// FHS-360: the kid sign-in flow (avatar tiles → PIN → kid token), shared by
// the per-family KidLoginPage and the unified LoginPage "I'm a Kid" view so the
// Magic Patterns login card and the /t/:slug/kid-login route stay identical.
//
// Loads GET /api/public/kid-members/:slug, renders the "Who are you?" tiles,
// and on a tapped face shows the 4-digit PIN. Submitting POSTs to
// /api/auth/kid-pin; on 200 it stashes the kid JWT under fh.kid.token and
// forwards to the dashboard. 401 → "wrong PIN"; 429 → cooldown.

const TILE_COLOURS = [
  'bg-pink-200',
  'bg-cyan-300',
  'bg-yellow-300',
  'bg-emerald-300',
  'bg-purple-300',
  'bg-orange-300',
] as const;

interface KidMember {
  id: string;
  displayName: string;
  avatarEmoji: string | null;
}
interface KidListResponse {
  family: { slug: string; name: string };
  kids: KidMember[];
}

type LoadState =
  | { kind: 'loading' }
  | { kind: 'loaded'; family: { name: string }; kids: KidMember[] }
  | { kind: 'family-not-found' }
  | { kind: 'load-failed'; message: string };

type SubmitState =
  | { kind: 'idle' }
  | { kind: 'submitting' }
  | { kind: 'wrong-pin' }
  | { kind: 'locked'; retryAfterSec: number }
  | { kind: 'error'; message: string };

export function KidSignIn({
  slug,
  onFamilyLoaded,
  notFoundFooter,
  onFamilyNotFound,
}: {
  slug: string | undefined;
  /** Called once the family name resolves, so the page can show it. */
  onFamilyLoaded?: (familyName: string) => void;
  /** Rendered under the not-found / load-failed message (e.g. "try another code"). */
  notFoundFooter?: React.ReactNode;
  /**
   * FHS-437: called once when the slug 404s (no such family). Lets the
   * caller react instead of stranding the kid on the "couldn't find a
   * family" message, e.g. the unified /login kid view uses this to forget
   * a stale remembered family and drop back to the code-entry prompt.
   * Leave unset to keep the built-in not-found message + notFoundFooter
   * (used by the /t/:slug/kid-login deep-link route).
   */
  onFamilyNotFound?: () => void;
}) {
  const navigate = useNavigate();
  const reduceMotion = useReducedMotion();
  const [load, setLoad] = useState<LoadState>({ kind: 'loading' });
  const [selectedId, setSelectedId] = useState<string | undefined>();
  const [submit, setSubmit] = useState<SubmitState>({ kind: 'idle' });
  const [pinNonce, setPinNonce] = useState(0);
  const selectedIdRef = useRef<string | undefined>(undefined);
  useEffect(() => {
    selectedIdRef.current = selectedId;
  }, [selectedId]);

  useEffect(() => {
    if (!slug) {
      setLoad({ kind: 'load-failed', message: 'missing family slug' });
      return;
    }
    let cancelled = false;
    setLoad({ kind: 'loading' });
    setSelectedId(undefined);
    setSubmit({ kind: 'idle' }); // don't carry a wrong-PIN error across families
    (async () => {
      try {
        const res = await fetch(`${API_BASE}/api/public/kid-members/${encodeURIComponent(slug)}`);
        if (cancelled) return;
        if (res.status === 404) {
          setLoad({ kind: 'family-not-found' });
          return;
        }
        if (!res.ok) {
          setLoad({ kind: 'load-failed', message: `server returned ${res.status}` });
          return;
        }
        const body = (await res.json()) as KidListResponse;
        try {
          localStorage.setItem(
            'fh.kid.lastFamily',
            JSON.stringify({ slug: body.family.slug, name: body.family.name }),
          );
        } catch {
          /* private mode / storage full: non-fatal */
        }
        setLoad({ kind: 'loaded', family: body.family, kids: body.kids });
        onFamilyLoaded?.(body.family.name);
      } catch (e) {
        if (cancelled) return;
        setLoad({ kind: 'load-failed', message: e instanceof Error ? e.message : 'network error' });
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [slug, onFamilyLoaded]);

  useEffect(() => {
    if (load.kind === 'family-not-found') {
      onFamilyNotFound?.();
    }
  }, [load.kind, onFamilyNotFound]);

  const tiles: AvatarTile[] = useMemo(() => {
    if (load.kind !== 'loaded') return [];
    return load.kids.map((k, i) => ({
      id: k.id,
      name: k.displayName,
      color: TILE_COLOURS[i % TILE_COLOURS.length]!,
      avatar: k.avatarEmoji ?? undefined,
    }));
  }, [load]);

  const onSelectKid = useCallback((id: string) => {
    setSelectedId(id);
    setSubmit({ kind: 'idle' });
    setPinNonce((n) => n + 1);
  }, []);

  const onPinComplete = useCallback(
    async (pin: string) => {
      if (!slug || !selectedId) return;
      const submittingFor = selectedId;
      const isStale = () => selectedIdRef.current !== submittingFor;
      setSubmit({ kind: 'submitting' });
      try {
        const res = await fetch(`${API_BASE}/api/auth/kid-pin`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ tenantSlug: slug, memberId: submittingFor, pin }),
        });
        if (isStale()) return;
        if (res.status === 200) {
          const body = (await res.json()) as { token: string };
          if (isStale()) return;
          localStorage.setItem('fh.kid.token', body.token);
          navigate(`/t/${slug}/dashboard`);
          return;
        }
        if (res.status === 429) {
          const retryHeader = res.headers.get('Retry-After');
          const retryAfterSec = retryHeader ? Math.max(parseInt(retryHeader, 10) || 0, 1) : 60;
          setSubmit({ kind: 'locked', retryAfterSec });
          setPinNonce((n) => n + 1);
          return;
        }
        if (res.status === 401) {
          setSubmit({ kind: 'wrong-pin' });
          setPinNonce((n) => n + 1);
          return;
        }
        setSubmit({
          kind: 'error',
          message: `Something went wrong (${res.status}). Please ask a grown-up.`,
        });
        setPinNonce((n) => n + 1);
      } catch (e) {
        if (isStale()) return;
        setSubmit({ kind: 'error', message: e instanceof Error ? e.message : 'network error' });
        setPinNonce((n) => n + 1);
      }
    },
    [slug, selectedId, navigate],
  );

  if (load.kind === 'loading') {
    return (
      <p className="font-body text-sm text-gray-600" data-testid="kid-login-loading">
        Loading the family&hellip;
      </p>
    );
  }
  if (load.kind === 'family-not-found') {
    return (
      <div>
        <p className="font-body text-sm text-gray-700" data-testid="kid-login-not-found">
          We couldn&rsquo;t find a family at this link. Ask a grown-up to check the address.
        </p>
        {notFoundFooter}
      </div>
    );
  }
  if (load.kind === 'load-failed') {
    return (
      <div>
        <p className="font-body text-sm text-gray-700" data-testid="kid-login-load-error">
          We couldn&rsquo;t load the family right now ({load.message}). Try again in a moment.
        </p>
        {notFoundFooter}
      </div>
    );
  }
  if (load.kids.length === 0) {
    return (
      <p className="font-body text-sm text-gray-700" data-testid="kid-login-empty">
        No kid logins are set up yet. Ask a grown-up to add one in Members.
      </p>
    );
  }

  const selectedKid = load.kids.find((k) => k.id === selectedId);
  const selectedTile = tiles.find((t) => t.id === selectedId);

  // FHS-573: the Magic Patterns design is two steps: pick a face, then a
  // focused view of that child with their PIN and a way back. We used to show
  // the grid and the PIN together, which is why the kid screen never looked
  // like the design.
  // FHS-577: matches the design's transition. popLayout takes the outgoing
  // step out of flow immediately, so a kid tapping their face is never held
  // waiting for a cross-fade before the PIN appears, while the step that is
  // leaving still fades out properly.
  const step = () => ({
    ...(reduceMotion
      ? {}
      : {
          initial: { opacity: 0, y: 8 },
          animate: { opacity: 1, y: 0 },
          exit: { opacity: 0, y: -8 },
          transition: { duration: 0.22, ease: 'easeOut' as const },
        }),
  });

  return (
    <div className="space-y-4">
      <AnimatePresence mode="popLayout" initial={false}>
        {!selectedKid ? (
          <motion.div key="kid-pick" {...step()} className="space-y-4">
            <p className="text-center font-bold text-gray-500" data-testid="kid-signin-who">
              Who are you?
            </p>
            {/* FHS-577: the faces fill the width of the card, as the design
              shows. Two sit side by side; three squeeze into one row at a
              smaller size rather than leaving one stranded on its own line;
              four or more wrap two-up. */}
            <AvatarGrid
              avatars={tiles}
              onSelect={onSelectKid}
              {...(selectedId ? { selectedId } : {})}
              gridClassName={
                tiles.length === 1
                  ? 'grid grid-cols-1'
                  : tiles.length === 3
                    ? 'grid grid-cols-3 gap-2 sm:gap-3'
                    : 'grid grid-cols-2 gap-4'
              }
              density={tiles.length >= 3 ? 'tight' : 'roomy'}
              testId="kid-login-avatars"
            />
          </motion.div>
        ) : (
          <motion.section
            key="kid-pin"
            {...step()}
            className="space-y-5"
            data-testid="kid-login-pin-section"
          >
            <button
              type="button"
              onClick={() => {
                setSelectedId(undefined);
                setSubmit({ kind: 'idle' });
              }}
              data-testid="kid-login-pick-different"
              className="flex min-h-[44px] items-center gap-1 rounded-lg font-body text-sm font-bold text-gray-500 transition-colors hover:text-black focus:outline-none focus-visible:ring-4 focus-visible:ring-purple-400"
            >
              <ChevronLeft size={16} aria-hidden="true" /> Back
            </button>

            {/* The chosen child, front and centre, as in the design. */}
            <div className="flex flex-col items-center gap-3">
              <div
                className={`flex h-20 w-20 items-center justify-center rounded-full border-2 border-black shadow-neo-sm ${selectedTile?.color ?? 'bg-yellow-300'}`}
                aria-hidden="true"
              >
                <span className="text-4xl">{selectedKid.avatarEmoji ?? '🙂'}</span>
              </div>
              <p className="font-heading text-2xl">{selectedKid.displayName}</p>
            </div>

            <div>
              <p className="mb-4 text-center font-body text-sm font-bold text-gray-500">
                Enter your PIN
              </p>
              <PinInput
                key={pinNonce}
                length={4}
                onComplete={onPinComplete}
                disabled={submit.kind === 'submitting' || submit.kind === 'locked'}
                error={submit.kind === 'wrong-pin' || submit.kind === 'locked'}
                label={`PIN for ${selectedKid.displayName}`}
                testId="kid-login-pin"
              />
            </div>

            {submit.kind === 'submitting' && (
              <p
                className="text-center font-body text-sm text-gray-600"
                data-testid="kid-login-status-submitting"
              >
                Checking&hellip;
              </p>
            )}
            {submit.kind === 'wrong-pin' && (
              <p
                className="text-center font-body text-sm text-red-600"
                role="alert"
                data-testid="kid-login-error"
              >
                That PIN didn&rsquo;t match. Try again.
              </p>
            )}
            {submit.kind === 'locked' && (
              <p
                className="text-center font-body text-sm text-red-600"
                role="alert"
                data-testid="kid-login-locked"
              >
                Too many tries. Wait {Math.ceil(submit.retryAfterSec / 60)} minute
                {Math.ceil(submit.retryAfterSec / 60) === 1 ? '' : 's'} or ask a grown-up.
              </p>
            )}
            {submit.kind === 'error' && (
              <p
                className="text-center font-body text-sm text-red-600"
                role="alert"
                data-testid="kid-login-error"
              >
                {submit.message}
              </p>
            )}
          </motion.section>
        )}
      </AnimatePresence>
    </div>
  );
}
