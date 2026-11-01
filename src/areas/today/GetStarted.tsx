import { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Check, KeyRound, PartyPopper, Plus, Sparkles, Wallet, X } from 'lucide-react';
import {
  GET_STARTED_STEP_KEYS,
  countGetStartedDone,
  type GetStartedState,
  type GetStartedStepKey,
} from '@familyhub/shared';
import { useAuth } from '../../app/lib/auth-context';
import { useTenantSlug } from '../../app/lib/tenant-context';
import { API_BASE } from '../../app/lib/api';

// FHS-511: first-run "Getting started" guide on the parent dashboard.
// FHS-634: its state moved to the server.
//
// Walks a brand-new family through the first four setup steps, celebrates when
// all four are done, then clears itself.
//
// A step is ticked when the family REALLY has that thing (a kid exists, every
// kid has a PIN, the sticker rate has been chosen, a kid has a habit), not
// when someone tapped the button here. Hiding the guide is remembered against
// the parent's own member row. Both used to live in this browser's storage,
// which is why a parent who had already set everything up was greeted with
// "0 of 4 done: add your kids" the first time they signed in somewhere else.

interface GetStartedStep {
  key: GetStartedStepKey;
  icon: React.ReactNode;
  title: string;
  blurb: string;
  cta: string;
}

const STEPS: GetStartedStep[] = [
  {
    key: 'kids',
    icon: <Plus size={16} strokeWidth={3} aria-hidden="true" />,
    title: 'Add your kids',
    blurb: 'Everything else hangs off who is in the family.',
    cta: 'Add a child',
  },
  {
    key: 'pins',
    icon: <KeyRound size={16} strokeWidth={3} aria-hidden="true" />,
    title: 'Give each kid a PIN',
    blurb: 'It is how they sign in to their own world.',
    cta: 'Set PINs',
  },
  {
    key: 'rate',
    icon: <Wallet size={16} strokeWidth={3} aria-hidden="true" />,
    title: 'Choose what a sticker is worth',
    blurb: 'Decide how much a finished habit pays.',
    cta: 'Set pocket money',
  },
  {
    key: 'habits',
    icon: <Sparkles size={16} strokeWidth={3} aria-hidden="true" />,
    title: 'Pick their first habits',
    blurb: 'Start with two or three easy wins.',
    cta: 'Open their world',
  },
];

const TOTAL = STEPS.length;

// FHS-634: the pre-server storage key. Read so a parent who already hid the
// guide in this browser does not see it come back when the fix ships. Nothing
// is ever written here again.
const legacyStorageKey = (slug: string) => `fh.getStarted.${slug}`;

function readLegacyDismissal(slug: string): boolean {
  try {
    const raw = window.localStorage.getItem(legacyStorageKey(slug));
    if (!raw) return false;
    return (JSON.parse(raw) as { dismissed?: unknown }).dismissed === true;
  } catch {
    // Corrupted or storage blocked: drop the key if we can, and treat this
    // browser as having nothing to carry over.
    clearLegacyDismissal(slug);
    return false;
  }
}

function clearLegacyDismissal(slug: string): void {
  try {
    window.localStorage.removeItem(legacyStorageKey(slug));
  } catch {
    /* private mode: nothing to clean up */
  }
}

export function GetStarted() {
  const slug = useTenantSlug();
  const navigate = useNavigate();
  const { session } = useAuth();

  // null = not loaded yet, or the caller is not an admin. The guide is admin
  // work top to bottom (add kids, set PINs, set the rate), so the API answers
  // 403 for anyone else and the card simply never renders.
  const [state, setState] = useState<GetStartedState | null>(null);

  // Once this parent has hidden the guide in this tab, nothing may un-hide it.
  // Supabase pushes a new session object on every background token refresh
  // (roughly hourly on a tab left open), which re-runs the load below; without
  // this guard a refresh landing just after the tap would fetch a not-yet-saved
  // `dismissed: false` and pop the card back open in their face.
  const dismissedHere = useRef(false);

  // Depend on the TOKEN, not the session object: a refresh that hands back the
  // same token should not refetch at all.
  const accessToken = session?.access_token ?? null;

  const authedFetch = useCallback(
    (path: string, init?: RequestInit) =>
      fetch(`${API_BASE}${path}`, {
        ...init,
        headers: {
          ...(init?.headers ?? {}),
          Authorization: `Bearer ${accessToken ?? ''}`,
          'x-tenant-slug': slug,
        },
      }),
    [accessToken, slug],
  );

  useEffect(() => {
    if (!accessToken) return;
    const ac = new AbortController();
    let cancelled = false;

    void (async () => {
      try {
        const res = await authedFetch('/api/onboarding/get-started', { signal: ac.signal });
        if (!res.ok || cancelled) return;
        const body = (await res.json()) as GetStartedState;
        if (cancelled) return;

        // One-time carry-over of a dismissal made before the state moved
        // server-side. Done here rather than in a migration because only the
        // browser that holds it knows about it.
        if (!body.dismissed && readLegacyDismissal(slug)) {
          dismissedHere.current = true;
          setState({ ...body, dismissed: true });
          const saved = await authedFetch('/api/onboarding/get-started/dismiss', {
            method: 'POST',
            signal: ac.signal,
          }).catch(() => null);
          // Only forget the old key once the server has it. If this call was
          // dropped, the key survives and the next visit tries again: deleting
          // first would lose the carry-over for good on a single network blip.
          if (saved?.ok) clearLegacyDismissal(slug);
          return;
        }
        setState(dismissedHere.current ? { ...body, dismissed: true } : body);
      } catch {
        /* aborted or failed load: the card stays hidden */
      }
    })();

    return () => {
      cancelled = true;
      ac.abort();
    };
  }, [accessToken, slug, authedFetch]);

  const dismiss = useCallback(() => {
    // Optimistic: the card goes away on tap, and the server catches up. A
    // failed call leaves it hidden for this visit and showing on the next one,
    // which is the right way round to be wrong.
    dismissedHere.current = true;
    setState((prev) => (prev ? { ...prev, dismissed: true } : prev));
    void authedFetch('/api/onboarding/get-started/dismiss', { method: 'POST' }).catch(
      () => undefined,
    );
  }, [authedFetch]);

  const targetFor = useCallback(
    (key: GetStartedStepKey): string => {
      switch (key) {
        case 'kids':
        case 'pins':
          return `/t/${slug}/members`;
        case 'rate':
          return `/t/${slug}/reward-settings`;
        case 'habits':
          return state?.firstKidId ? `/t/${slug}/child/${state.firstKidId}` : `/t/${slug}/members`;
        default:
          return `/t/${slug}/members`;
      }
    },
    [slug, state],
  );

  if (!state || state.dismissed) return null;

  const doneCount = countGetStartedDone(state.steps);
  // The next step to do = the first one the family hasn't actually done.
  const nextKey = GET_STARTED_STEP_KEYS.find((k) => !state.steps[k]) ?? null;
  const allDone = doneCount >= TOTAL;

  // ── Celebrate card: every step done ────────────────────────────────────
  if (allDone) {
    return (
      <div
        data-testid="get-started-celebrate"
        className="mb-6 rounded-2xl border-2 border-black bg-emerald-300 p-5 shadow-neo-md md:p-6"
      >
        <div className="flex items-start gap-3">
          <span
            aria-hidden="true"
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full border-2 border-black bg-white shadow-neo-xs"
          >
            <PartyPopper size={22} strokeWidth={2.5} aria-hidden="true" />
          </span>
          <div className="min-w-0">
            <h2 className="font-heading text-xl uppercase tracking-wide text-black md:text-2xl">
              You are all set up
            </h2>
            <p className="mt-1 text-sm font-bold text-emerald-950">
              Your family is ready. Check back tomorrow to see their first stickers land.
            </p>
          </div>
        </div>
        <div className="mt-4 flex justify-end">
          <button
            type="button"
            data-testid="get-started-got-it"
            onClick={dismiss}
            className="flex min-h-[44px] items-center gap-2 rounded-xl border-2 border-black bg-black px-5 font-heading text-sm uppercase tracking-wide text-white shadow-neo-xs transition-transform motion-safe:hover:-translate-y-0.5"
          >
            Got it
          </button>
        </div>
      </div>
    );
  }

  // ── Setup checklist ─────────────────────────────────────────────────────
  return (
    <div
      data-testid="get-started"
      className="mb-6 rounded-2xl border-2 border-black bg-white p-4 shadow-neo-md md:p-6"
    >
      {/* Header: title + "N of 4 done" + dismiss. */}
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 className="font-heading text-lg uppercase tracking-wide text-black md:text-xl">
            Getting started
            <span className="ml-2 text-sm font-bold text-gray-500" data-testid="get-started-count">
              · {doneCount} of {TOTAL} done
            </span>
          </h2>
        </div>
        <button
          type="button"
          data-testid="get-started-dismiss"
          onClick={dismiss}
          aria-label="Hide setup guide"
          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg border-2 border-black bg-white text-gray-500 transition-colors hover:bg-gray-100 hover:text-black"
        >
          <X size={16} strokeWidth={3} aria-hidden="true" />
        </button>
      </div>

      {/* 4-segment progress bar. */}
      <div
        className="mt-3 flex gap-1.5"
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={TOTAL}
        aria-valuenow={doneCount}
        aria-label={`${doneCount} of ${TOTAL} setup steps done`}
      >
        {STEPS.map((s) => (
          <span
            key={s.key}
            aria-hidden="true"
            className={`h-2.5 flex-1 rounded-full border-2 border-black ${
              state.steps[s.key] ? 'bg-green-400' : 'bg-gray-100'
            }`}
          />
        ))}
      </div>

      {/* Steps. */}
      <ul className="mt-4 space-y-2.5">
        {STEPS.map((s) => {
          const isDone = state.steps[s.key];
          const isNext = s.key === nextKey;
          const isFuture = !isDone && !isNext;
          return (
            <li
              key={s.key}
              data-testid={`get-started-step-${s.key}`}
              className={`flex flex-col gap-3 rounded-xl border-2 border-black p-3 sm:flex-row sm:items-center ${
                isNext ? 'bg-yellow-50 shadow-neo-xs' : 'bg-white'
              } ${isFuture ? 'opacity-60' : ''}`}
            >
              <span
                aria-hidden="true"
                className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full border-2 border-black ${
                  isDone
                    ? 'bg-green-400 text-black'
                    : isNext
                      ? 'bg-yellow-300 text-black'
                      : 'bg-white text-gray-500'
                }`}
              >
                {isDone ? <Check size={16} strokeWidth={3} aria-hidden="true" /> : s.icon}
              </span>
              <span className="min-w-0 flex-1">
                <span
                  className={`block font-heading text-sm uppercase tracking-wide ${
                    isDone ? 'text-gray-400 line-through' : 'text-black'
                  }`}
                >
                  {s.title}
                </span>
                {!isDone && (
                  <span className="mt-0.5 block text-xs font-bold text-gray-500">{s.blurb}</span>
                )}
              </span>
              {/* Only the NEXT step is actionable: earlier steps show Done,
                  later ones sit as a quiet "Up next" so you can't skip ahead
                  and complete an empty family out of order (FHS-511 QA). */}
              {isDone ? (
                <span
                  data-testid={`get-started-done-${s.key}`}
                  className="shrink-0 text-xs font-bold uppercase tracking-wider text-green-600"
                >
                  Done
                </span>
              ) : isNext ? (
                <button
                  type="button"
                  data-testid={`get-started-cta-${s.key}`}
                  onClick={() => navigate(targetFor(s.key))}
                  className="flex min-h-[44px] shrink-0 items-center justify-center gap-2 rounded-xl border-2 border-black bg-yellow-300 px-4 font-heading text-sm uppercase tracking-wide text-black shadow-neo-xs transition-transform motion-safe:hover:-translate-y-0.5"
                >
                  {s.cta}
                </button>
              ) : (
                <span
                  data-testid={`get-started-upnext-${s.key}`}
                  className="shrink-0 text-xs font-bold uppercase tracking-wider text-gray-400"
                >
                  Up next
                </span>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
