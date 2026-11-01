import { useEffect, useRef, useState } from 'react';
import { useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../../app/lib/auth-context';
import { LoadingScreen } from '../../app/components/LoadingScreen';
import { LinkExpired, reasonFromError } from './LinkExpired';
import { emailFromLink, recallAuthEmail } from '../../app/lib/auth-email';
import { supabase } from '../../app/lib/supabase';

// FHS-331: Supabase appends auth failures (expired/used magic link, denied
// OAuth) to the redirect URL: usually the hash
// (`#error=access_denied&error_code=otp_expired&error_description=…`), sometimes
// the query. Pull the error out so an EXPIRED link can never look like a
// successful sign-in just because a stale session sits in localStorage.
function extractAuthError(
  hash: string,
  query: URLSearchParams,
): { code: string; description: string } | null {
  const h = new URLSearchParams(hash.replace(/^#/, ''));
  const code =
    h.get('error_code') ?? h.get('error') ?? query.get('error_code') ?? query.get('error');
  if (!code) return null;
  return { code, description: h.get('error_description') ?? query.get('error_description') ?? '' };
}

function isExpiredLink(err: { code: string; description: string }): boolean {
  return /expired/i.test(err.code) || /expired/i.test(err.description);
}

// Auth landing page. Two responsibilities only:
//   1. If the URL carries a `?code=...` (PKCE), exchange it for a
//      session synchronously here. Supabase's `detectSessionInUrl` does
//      start the exchange on import, but it resolves on a different
//      microtask than AuthProvider's initial getSession(), without
//      the explicit claim the latter can return null first, flip
//      loading=false, and bounce the user to /login before the session
//      lands via onAuthStateChange.
//   2. Once the session is established, navigate to /dashboard. The
//      LegacyDashboardRedirect there fetches /api/me and either
//      forwards a returning user to /t/<slug>/dashboard, or renders
//      the inline create-family panel for a first-timer with no
//      tenant yet. Family name + slug are collected in that panel,
//      not pre-auth on /signup. That keeps a single source of truth
//      for family details and removes the sessionStorage-intent dance
//      that used to break when the magic-link was opened in a
//      different tab / browser / device.

type ExchangeState = 'pending' | 'done' | 'error';
type CallbackStatus = { kind: 'idle' } | { kind: 'error'; message: string };

export function AuthCallbackPage() {
  const navigate = useNavigate();
  const { loading, session } = useAuth();
  const [searchParams] = useSearchParams();
  const location = useLocation();

  // Capture any auth error from the redirect URL on the first render (before
  // the navigate effect can run) so an expired/invalid link never falls
  // through to a stale-session "signed in".
  const authErrorRef = useRef(extractAuthError(location.hash, searchParams));
  const authError = authErrorRef.current;

  const [status, setStatus] = useState<CallbackStatus>(() =>
    authError
      ? {
          kind: 'error',
          message: isExpiredLink(authError)
            ? 'Your sign-in link has expired. Request a new one to log in.'
            : 'That sign-in link is invalid or has already been used. Request a new one.',
        }
      : { kind: 'idle' },
  );

  const exchangeCodeRef = useRef<string | null>(searchParams.get('code'));
  // authError short-circuits to 'error' so the navigate effect bails on the
  // very first render (no race with a stale session).
  const [exchangeState, setExchangeState] = useState<ExchangeState>(() =>
    authError ? 'error' : exchangeCodeRef.current ? 'pending' : 'done',
  );

  // An expired/invalid link must not leave the user signed in via a previously
  // persisted session: sign out so they truly start over with a fresh link.
  useEffect(() => {
    if (!authError) return;
    void supabase.auth.signOut().catch(() => {
      /* best-effort: the error message + no-navigate already protect the user */
    });
    if (typeof window !== 'undefined' && window.history?.replaceState) {
      try {
        const url = new URL(window.location.href);
        url.hash = '';
        window.history.replaceState({}, '', url.toString());
      } catch {
        /* History API unavailable: non-fatal */
      }
    }
  }, [authError]);

  useEffect(() => {
    if (exchangeState !== 'pending') return;
    const code = exchangeCodeRef.current;
    if (!code) {
      setExchangeState('done');
      return;
    }
    let cancelled = false;
    void supabase.auth.exchangeCodeForSession(code).then(({ error }) => {
      if (cancelled) return;
      if (error) {
        setStatus({
          kind: 'error',
          message: 'Your sign-in link has expired or already been used. Request a new one.',
        });
        setExchangeState('error');
        return;
      }
      // Strip the one-shot PKCE params from the URL so a refresh or
      // share doesn't retry (a second exchange of the same code fails).
      if (typeof window !== 'undefined' && window.history?.replaceState) {
        try {
          const url = new URL(window.location.href);
          url.searchParams.delete('code');
          url.searchParams.delete('state');
          window.history.replaceState({}, '', url.toString());
        } catch {
          // History API unavailable: non-fatal.
        }
      }
      setExchangeState('done');
    });
    return () => {
      cancelled = true;
    };
  }, [exchangeState]);

  useEffect(() => {
    if (exchangeState === 'pending') return;
    if (exchangeState === 'error') return;
    if (loading) return;
    if (!session) {
      // No session means OAuth failed or was cancelled. Bounce to login
      // so the user can retry instead of being stuck on a blank screen.
      navigate('/login', { replace: true });
      return;
    }
    // Cleanup any legacy intent left over from older flows so it
    // doesn't follow the user around across browsers.
    sessionStorage.removeItem('fh.signup.intent');
    navigate('/dashboard', { replace: true });
  }, [exchangeState, loading, session, navigate]);

  // FHS-575: a dead link is not a slow load. It gets its own screen with the
  // form to request a new one, rather than borrowing the loading screen's
  // stalled state and showing a progress bar while nothing is happening.
  if (status.kind === 'error') {
    return (
      <LinkExpired
        reason={reasonFromError(status.message)}
        email={
          emailFromLink(searchParams) ||
          sessionStorage.getItem('fh.signup.email') ||
          recallAuthEmail()
        }
      />
    );
  }

  // Still genuinely waiting: this one really is a load.
  return <LoadingScreen context="callback" />;
}
