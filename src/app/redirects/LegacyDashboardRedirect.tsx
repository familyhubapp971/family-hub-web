import { useEffect, useState, type FormEvent } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { Button, Card } from '@familyhub/ui';
import type { Session } from '@supabase/supabase-js';
import { signOutAll, useAuth } from '../lib/auth-context';
import { API_BASE } from '../lib/api';
import { friendlyAuthErrorMessage } from '../lib/auth-errors';
import { rememberFamilyCodes } from '../lib/my-families';
import { LoadingScreen } from '../components/LoadingScreen';

// FHS-227: bridge for the un-prefixed `/dashboard` route. Fetches
// /api/me, picks the user's first tenant, and forwards to the
// tenant-scoped dashboard. When the user is authenticated but has no
// tenant yet (most often because a previous signup tenant-create call
// dropped between Supabase auth and the API POST), render an inline
// create-family form rather than silently bouncing to the homepage.
//
// Cleanup tracked under FHS-205 (drop legacy un-prefixed routes once
// AuthCallback resolves the tenant itself).

interface MeResponse {
  tenants?: Array<{ slug: string }>;
}

type State =
  | { kind: 'loading' }
  | { kind: 'redirect'; to: string }
  | { kind: 'no-tenant' }
  | { kind: 'unreachable' };

export function LegacyDashboardRedirect() {
  const { session } = useAuth();
  const [state, setState] = useState<State>({ kind: 'loading' });
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    if (!session) return;
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`${API_BASE}/api/me`, {
          headers: { Authorization: `Bearer ${session.access_token}` },
        });
        // FHS-714: a failed check says nothing about whether they have a
        // family. Treating it as "no family" offered an existing family the
        // create-a-family form, so it gets a retry instead.
        if (res.status === 401) {
          // The server no longer accepts this sign-in: "Try again" would only
          // repeat it, so start a fresh sign-in instead.
          await signOutAll();
          if (!cancelled) setState({ kind: 'redirect', to: '/login' });
          return;
        }
        if (!res.ok) {
          if (!cancelled) setState({ kind: 'unreachable' });
          return;
        }
        const body = (await res.json()) as MeResponse;
        // FHS-718: keep the list, so the family page we open next does not
        // ask for it a second time.
        if (session.user?.id) rememberFamilyCodes(session.user.id, body.tenants);
        const slug = body.tenants?.[0]?.slug;
        // FHS-275: ALWAYS try to claim pending invites first, even when
        // the user already has a family of their own: a newly-claimed
        // invite should land them on the inviting family, and skipping
        // the claim would leave their seat pending forever.
        let claimFailed = false;
        try {
          const claimRes = await fetch(`${API_BASE}/api/invitations/claim`, {
            method: 'POST',
            headers: { Authorization: `Bearer ${session.access_token}` },
          });
          if (claimRes.ok) {
            const claimBody = (await claimRes.json()) as {
              claimed?: Array<{ slug: string }>;
            };
            const claimedSlug = claimBody.claimed?.[0]?.slug;
            if (claimedSlug) {
              if (!cancelled) {
                setState({ kind: 'redirect', to: `/t/${claimedSlug}/dashboard` });
              }
              return;
            }
          }
          if (!claimRes.ok) claimFailed = true;
        } catch {
          // Claim is best-effort for someone who already has a family.
          claimFailed = true;
        }
        // FHS-714: with no family of their own, a failed invite check may be
        // hiding the family they were invited to. Offering the create form
        // would make a second family by mistake, so retry instead.
        if (!slug && claimFailed) {
          if (!cancelled) setState({ kind: 'unreachable' });
          return;
        }
        if (!cancelled) {
          setState(slug ? { kind: 'redirect', to: `/t/${slug}/dashboard` } : { kind: 'no-tenant' });
        }
      } catch {
        if (!cancelled) setState({ kind: 'unreachable' });
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [session, attempt]);

  if (state.kind === 'redirect') return <Navigate to={state.to} replace />;
  if (state.kind === 'unreachable') {
    return (
      <CouldNotReach
        onRetry={() => {
          setState({ kind: 'loading' });
          setAttempt((n) => n + 1);
        }}
        onLogOut={() => {
          void signOutAll().finally(() => setState({ kind: 'redirect', to: '/login' }));
        }}
      />
    );
  }
  if (state.kind === 'no-tenant') {
    // Defensive: a render at no-tenant without a session means the user
    // hit /dashboard unauthenticated. The ProtectedRoute wrapper would
    // normally have bounced them already, but cover the case anyway.
    if (!session) return <Navigate to="/" replace />;
    return (
      <CreateFamilyPanel
        session={session}
        onRecheck={() => {
          setState({ kind: 'loading' });
          setAttempt((n) => n + 1);
        }}
      />
    );
  }
  // FHS-550: this was near-invisible grey text on the dark background while
  // the family was looked up. It is the shared branded wait now.
  return <LoadingScreen context="redirect" />;
}

function CouldNotReach({ onRetry, onLogOut }: { onRetry: () => void; onLogOut: () => void }) {
  return (
    <main className="flex min-h-full items-center justify-center bg-kingdom-bg px-4 py-10">
      <Card
        className="w-full max-w-md border-4 border-black bg-white p-8 text-center shadow-neo-lg"
        testId="me-unreachable"
      >
        <p className="mb-6 font-body font-bold text-gray-700" role="alert">
          We couldn&rsquo;t reach Family Hub. Check your signal and try again.
        </p>
        <Button
          type="button"
          variant="primary"
          size="lg"
          fullWidth
          onClick={onRetry}
          testId="me-retry"
        >
          Try again
        </Button>
        <button
          type="button"
          onClick={onLogOut}
          data-testid="me-log-out"
          className="mt-3 inline-flex min-h-[44px] items-center font-body text-sm font-bold text-purple-600 underline decoration-2 underline-offset-2"
        >
          Log out
        </button>
      </Card>
    </main>
  );
}

interface CreateFamilyPanelProps {
  session: Session;
  /** Checks for the family again, for a reply that did not say where it is. */
  onRecheck: () => void;
}

interface CreateFamilyResponse {
  tenant?: { slug?: unknown };
}

// FHS-715 / FHS-716: people never type a family address any more. The server
// makes every family's private code and answers with it, and someone who
// already made a family gets that family back (one family per home), so
// there is no "address taken" to deal with here.
function CreateFamilyPanel({ session, onRecheck }: CreateFamilyPanelProps) {
  const navigate = useNavigate();
  const [familyName, setFamilyName] = useState('');
  const [yourName, setYourName] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fName = familyName.trim();
    // FHS-714: one character is enough (a family called 李, a one-letter
    // name), the same as the server and the phone app.
    if (fName.length < 1) {
      setError('Family name is required.');
      return;
    }
    // FHS-274: the founder types their own name; no more guessing from
    // auth metadata / email prefixes (which produced names like "FAMILY").
    const displayName = yourName.trim();
    if (displayName.length < 1) {
      setError('Your name is required.');
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch(`${API_BASE}/api/public/tenant`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ familyName: fName, displayName }),
      });
      // 201 is a new family; 200 is the family this person already made.
      // Both open the family at the code the server gave it.
      if (res.status === 200 || res.status === 201) {
        const body = (await res.json().catch(() => ({}))) as CreateFamilyResponse;
        const slug = body.tenant?.slug;
        if (typeof slug === 'string' && slug.length > 0) {
          navigate(`/t/${slug}/onboarding`, { replace: true });
        } else {
          onRecheck();
        }
        return;
      }
      if (res.status === 400) {
        setError("Couldn't read your family details. Please check the inputs.");
        setSubmitting(false);
        return;
      }
      setError(
        `Couldn't create your family (server returned ${res.status}). Please try again or contact support.`,
      );
      setSubmitting(false);
    } catch (err) {
      setError(friendlyAuthErrorMessage(err instanceof Error ? err.message : 'Network error'));
      setSubmitting(false);
    }
  }

  async function onLogOut() {
    await signOutAll();
    navigate('/login', { replace: true });
  }

  return (
    <main className="flex min-h-full items-center justify-center bg-kingdom-bg px-4 py-10">
      <Card className="w-full max-w-md border-4 border-black bg-white p-8 shadow-neo-lg">
        <h1 className="mb-2 font-display text-2xl text-kingdom-bg">Create your family hub</h1>
        <p className="mb-2 font-body text-sm text-gray-600">
          You&rsquo;re signed in, but don&rsquo;t have a family hub yet. Pick a name to get started.
        </p>
        {/* FHS-714: an invited parent who signed in with a different email
            lands here and would make a second family by mistake. Same words
            as the phone app. */}
        <p className="mb-6 font-body text-xs text-gray-500" data-testid="no-tenant-invited-hint">
          Invited to a family? Log out and sign in with the email the invite went to.
        </p>
        <form
          onSubmit={onSubmit}
          className="space-y-4"
          data-testid="no-tenant-create-form"
          noValidate
        >
          <div>
            <label className="mb-1 block font-body text-sm font-bold" htmlFor="no-tenant-your-name">
              Your name
            </label>
            <input
              id="no-tenant-your-name"
              type="text"
              value={yourName}
              onChange={(e) => setYourName(e.target.value)}
              required
              minLength={2}
              maxLength={40}
              className="w-full rounded-md border-2 border-black px-3 py-2 font-body"
              placeholder="e.g. Sarah"
              data-testid="no-tenant-your-name"
            />
            <p className="mt-1 font-body text-xs text-gray-500">
              You&rsquo;ll appear on the dashboard with this name, as the family admin.
            </p>
          </div>
          <div>
            <label className="mb-1 block font-body text-sm font-bold" htmlFor="no-tenant-family">
              Family name
            </label>
            <input
              id="no-tenant-family"
              type="text"
              value={familyName}
              onChange={(e) => setFamilyName(e.target.value)}
              required
              minLength={2}
              maxLength={40}
              className="w-full rounded-md border-2 border-black px-3 py-2 font-body"
              placeholder="The Khan family"
              data-testid="no-tenant-family-name"
            />
          </div>
          {error !== null && (
            <p
              className="font-body text-sm text-red-600"
              role="alert"
              data-testid="no-tenant-error"
            >
              {error}
            </p>
          )}
          <Button
            type="submit"
            variant="primary"
            size="lg"
            fullWidth
            disabled={submitting || familyName.trim().length < 1 || yourName.trim().length < 1}
            testId="no-tenant-submit"
          >
            {submitting ? 'Creating…' : 'Create my family'}
          </Button>
        </form>
        <p className="mt-4 text-center font-body text-sm text-gray-600">
          Not you?{' '}
          <button
            type="button"
            onClick={() => void onLogOut()}
            className="inline-flex min-h-[44px] items-center font-bold text-purple-600 underline decoration-2 underline-offset-2 hover:text-purple-800 focus:outline-none focus-visible:ring-4 focus-visible:ring-pastel-cyan"
            data-testid="no-tenant-log-out"
          >
            Log out
          </button>
        </p>
      </Card>
    </main>
  );
}
