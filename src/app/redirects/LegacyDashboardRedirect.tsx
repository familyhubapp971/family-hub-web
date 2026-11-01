import { useEffect, useState, type FormEvent } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { Button, Card } from '@familyhub/ui';
import type { Session } from '@supabase/supabase-js';
import { useAuth } from '../lib/auth-context';
import { API_BASE } from '../lib/api';
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

const SLUG_RE = /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/;

interface MeResponse {
  tenants?: Array<{ slug: string }>;
}

type State = { kind: 'loading' } | { kind: 'redirect'; to: string } | { kind: 'no-tenant' };

function deriveSlug(name: string): string {
  return name
    .toLowerCase()
    .trim()
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 30);
}

export function LegacyDashboardRedirect() {
  const { session } = useAuth();
  const [state, setState] = useState<State>({ kind: 'loading' });

  useEffect(() => {
    if (!session) return;
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`${API_BASE}/api/me`, {
          headers: { Authorization: `Bearer ${session.access_token}` },
        });
        if (!res.ok) {
          if (!cancelled) setState({ kind: 'no-tenant' });
          return;
        }
        const body = (await res.json()) as MeResponse;
        const slug = body.tenants?.[0]?.slug;
        // FHS-275: ALWAYS try to claim pending invites first, even when
        // the user already has a family of their own: a newly-claimed
        // invite should land them on the inviting family, and skipping
        // the claim would leave their seat pending forever.
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
        } catch {
          // Claim is best-effort: fall through.
        }
        if (!cancelled) {
          setState(slug ? { kind: 'redirect', to: `/t/${slug}/dashboard` } : { kind: 'no-tenant' });
        }
      } catch {
        if (!cancelled) setState({ kind: 'no-tenant' });
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [session]);

  if (state.kind === 'redirect') return <Navigate to={state.to} replace />;
  if (state.kind === 'no-tenant') {
    // Defensive: a render at no-tenant without a session means the user
    // hit /dashboard unauthenticated. The ProtectedRoute wrapper would
    // normally have bounced them already, but cover the case anyway.
    if (!session) return <Navigate to="/" replace />;
    return <CreateFamilyPanel session={session} />;
  }
  // FHS-550: this was near-invisible grey text on the dark background while
  // the family was looked up. It is the shared branded wait now.
  return <LoadingScreen context="redirect" />;
}

interface CreateFamilyPanelProps {
  session: Session;
}

function CreateFamilyPanel({ session }: CreateFamilyPanelProps) {
  const navigate = useNavigate();
  const [familyName, setFamilyName] = useState('');
  const [yourName, setYourName] = useState('');
  const [slug, setSlug] = useState('');
  const [editingSlug, setEditingSlug] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // The slug input mirrors the family name until the user edits it
  // directly. This matches the SignupPage UX so a user who's seen it
  // before recognises the pattern.
  const effectiveSlug = editingSlug ? slug : deriveSlug(familyName);

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fName = familyName.trim();
    if (fName.length < 2) {
      setError('Family name is required.');
      return;
    }
    if (!SLUG_RE.test(effectiveSlug) || effectiveSlug.length < 2) {
      setError('Family URL must be 2+ lowercase letters, digits or hyphens.');
      return;
    }
    setSubmitting(true);
    setError(null);
    // FHS-274: the founder types their own name; no more guessing from
    // auth metadata / email prefixes (which produced names like "FAMILY").
    const displayName = yourName.trim();
    if (displayName.length < 2) {
      setError('Your name is required.');
      return;
    }
    try {
      const res = await fetch(`${API_BASE}/api/public/tenant`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ familyName: fName, displayName, slug: effectiveSlug }),
      });
      if (res.status === 200 || res.status === 201) {
        navigate(`/t/${effectiveSlug}/onboarding`, { replace: true });
        return;
      }
      if (res.status === 409) {
        setError('That family URL is taken. Try a different one.');
        setSubmitting(false);
        setEditingSlug(true);
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
      setError(err instanceof Error ? err.message : 'Network error. Try again.');
      setSubmitting(false);
    }
  }

  return (
    <main className="flex min-h-full items-center justify-center bg-kingdom-bg px-4 py-10">
      <Card className="w-full max-w-md border-4 border-black bg-white p-8 shadow-neo-lg">
        <h1 className="mb-2 font-display text-2xl text-kingdom-bg">Create your family hub</h1>
        <p className="mb-6 font-body text-sm text-gray-600">
          You&rsquo;re signed in, but don&rsquo;t have a family hub yet. Pick a name to get started.
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
          <div>
            <label className="mb-1 block font-body text-sm font-bold" htmlFor="no-tenant-slug">
              Family URL
            </label>
            <div className="flex items-center gap-2 font-body text-sm">
              <span className="text-gray-500">familyhub.app/t/</span>
              <input
                id="no-tenant-slug"
                type="text"
                value={effectiveSlug}
                onChange={(e) => {
                  setEditingSlug(true);
                  setSlug(e.target.value);
                }}
                className="flex-1 rounded-md border-2 border-black px-3 py-2"
                data-testid="no-tenant-slug"
              />
            </div>
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
            disabled={submitting || familyName.trim().length < 2 || yourName.trim().length < 2}
            testId="no-tenant-submit"
          >
            {submitting ? 'Creating…' : 'Create my family'}
          </Button>
        </form>
      </Card>
    </main>
  );
}
