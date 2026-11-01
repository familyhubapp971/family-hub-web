// FHS-700: where the browser tests' sign-in passes come from. No Supabase,
// no secret, no .env.local lookup.
//
// The quick run (playwright.critical.config.ts) signs nobody in for real. It
// mints its own pass with the fixed test key (test-key.ts) and boots the local
// api trusting that key (E2E_TEST_JWKS) and LOCAL_AUTH_ISSUER. The web points
// its sign-in client at the local api (VITE_AUTH_URL), so supabase-js looks for
// the session under LOCAL_AUTH_URL's storage key.
//
// The full run's one real sign-in (auth.feature, FHS-196) uses the e2e account
// on our own staging sign-in service, reached through the staging api's
// /auth/v1 pass-through. The local api trusts that service's public keys.

export const LOCAL_AUTH_URL = 'http://localhost:3001';
export const LOCAL_AUTH_ISSUER = `${LOCAL_AUTH_URL}/auth/v1`;

export const STAGING_AUTH_URL =
  process.env['E2E_STAGING_AUTH_URL'] ?? 'https://fh-api-staging.up.railway.app';

/** Api settings that trust sign-in passes from the service behind `authUrl`. */
export function trustSettings(authUrl: string): { AUTH_ISSUER: string; AUTH_JWKS_URL: string } {
  return {
    AUTH_ISSUER: `${authUrl}/auth/v1`,
    AUTH_JWKS_URL: `${authUrl}/auth/v1/.well-known/jwks.json`,
  };
}
