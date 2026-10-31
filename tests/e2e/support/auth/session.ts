// FHS-516: build the exact localStorage entry supabase-js writes on a real
// sign-in, so `context.addInitScript` can pre-seed it and the web app's
// `supabase.auth.getSession()` (src/app/lib/auth-context.tsx) finds a
// session already there on first render: no real login round trip needed.
//
// Verified against @supabase/supabase-js 2.105.1's actual behaviour (traced
// through dist/umd/supabase.js, since the package ships minified with no
// public docs page for this internal shape):
//   - storageKey = `sb-${new URL(url).hostname.split('.')[0]}-auth-token`
//     (set in the SupabaseClient constructor from the sign-in address,
//     VITE_AUTH_URL since FHS-696/700).
//   - The stored value is `JSON.stringify(session)`: a plain deep clone of
//     the Session object, no wrapper.
//   - `getSession()` returns it AS-IS with no network call, UNLESS
//     `expires_at*1000 - Date.now() < 90_000` (a 90s "expiring soon"
//     margin), in which case it tries to refresh over the network, which
//     would fail here since refresh_token is fake. jwt.ts's default 1h
//     expiry keeps every test well clear of that margin.
//   - `_isValidSession()` only checks that access_token / refresh_token /
//     expires_at are present: no signature check on the client side.

export function sessionStorageKey(authUrl: string): string {
  const hostname = new URL(authUrl).hostname;
  const ref = hostname.split('.')[0];
  return `sb-${ref}-auth-token`;
}

export interface BuildSessionOptions {
  /** The address the web's sign-in client uses (VITE_AUTH_URL). */
  authUrl: string;
  accessToken: string;
  userId: string;
  email: string;
  /** Unix seconds, MUST match the access token's `exp` claim. */
  expiresAt: number;
}

export interface LocalStorageEntry {
  key: string;
  /** Already JSON-stringified, write verbatim via localStorage.setItem. */
  value: string;
}

/** Builds the (key, value) pair to inject via `context.addInitScript`. */
export function buildSupabaseLocalStorageEntry(opts: BuildSessionOptions): LocalStorageEntry {
  const now = new Date().toISOString();
  const session = {
    access_token: opts.accessToken,
    token_type: 'bearer',
    // supabase-js only reads expires_at for the client-side expiry check;
    // expires_in is cosmetic (some UI could read it) so it's derived rather
    // than hardcoded.
    expires_in: Math.max(0, opts.expiresAt - Math.floor(Date.now() / 1000)),
    expires_at: opts.expiresAt,
    // Never actually used (no refresh happens within a test's lifetime,
    // see the 90s-margin note above), but `_isValidSession()` requires the
    // field to be present.
    refresh_token: 'e2e-test-fixture-refresh-token-unused',
    user: {
      id: opts.userId,
      aud: 'authenticated',
      role: 'authenticated',
      email: opts.email,
      email_confirmed_at: now,
      phone: '',
      confirmed_at: now,
      last_sign_in_at: now,
      app_metadata: { provider: 'email', providers: ['email'] },
      user_metadata: {},
      identities: [],
      created_at: now,
      updated_at: now,
    },
  };
  return {
    key: sessionStorageKey(opts.authUrl),
    value: JSON.stringify(session),
  };
}
