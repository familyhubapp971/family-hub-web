import { importJWK, SignJWT } from 'jose';
import { E2E_TEST_KEY_ID, E2E_TEST_PRIVATE_JWK } from './test-key.js';
import { LOCAL_AUTH_ISSUER } from './env.js';

// FHS-516: mint an ES256 JWT the RUNNING e2e api will accept, using the
// same pattern as the integration tier's mintToken() helper
// (tests/integration/steps/auth.steps.ts): SignJWT from `jose`, ES256,
// signed with the fixed test private key. The api verifies it against
// E2E_TEST_JWKS (the PUBLIC half of the same key, see test-key.ts).

export interface MintOptions {
  sub: string;
  email: string;
  /** Seconds from now until expiry. Long default (1h), well past the
   * 90s "expiring soon" margin supabase-js uses before it would try to
   * refresh (which would hit the real network and fail). */
  expSecondsFromNow?: number;
}

export async function mintE2eAccessToken(opts: MintOptions): Promise<string> {
  const privateKey = await importJWK(E2E_TEST_PRIVATE_JWK, 'ES256');
  const now = Math.floor(Date.now() / 1000);
  const exp = now + (opts.expSecondsFromNow ?? 3600);
  return new SignJWT({
    email: opts.email,
    // Not checked by the middleware, but present on every real session
    // pass from the sign-in service, so the shape matches production.
    role: 'authenticated',
    aud: 'authenticated',
  })
    .setProtectedHeader({ alg: 'ES256', kid: E2E_TEST_KEY_ID })
    .setSubject(opts.sub)
    .setIssuer(LOCAL_AUTH_ISSUER)
    .setIssuedAt(now)
    .setExpirationTime(exp)
    .sign(privateKey);
}
