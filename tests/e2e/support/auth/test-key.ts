// FHS-516: fixed ES256 keypair used ONLY to mint test JWTs for the E2E
// authed-page fixture. This is not a production secret: the api only
// trusts it when the operator explicitly sets E2E_TEST_JWKS (see
// family-hub-api src/security/auth.ts + config.ts), which never happens outside
// a local or CI e2e run: config.ts refuses to boot a production process
// with that var set at all.
//
// The key is a fixed, committed constant (not generated fresh per run) so
// two SEPARATE Node processes agree on it without any cross-process
// coordination:
//   1. playwright.config.ts / playwright.critical.config.ts (the process
//      that starts the api's webServer): reads the PUBLIC half to build
//      the E2E_TEST_JWKS env var the api verifies against.
//   2. The Playwright worker process running a spec's fixture (jwt.ts):
//      reads the PRIVATE half to sign tokens.
// If this were generated randomly at import time, the two processes could
// end up with different keys and every authed request would 401.
//
// Generated once via (same pattern as tests/integration/steps/auth.steps.ts,
// which uses jose's generateKeyPair('ES256') + exportJWK):
//   node --input-type=module -e "
//     import { generateKeyPair, exportJWK } from 'jose';
//     const { privateKey } = await generateKeyPair('ES256', { extractable: true });
//     const jwk = await exportJWK(privateKey);
//     jwk.alg = 'ES256'; jwk.use = 'sig'; jwk.kid = 'e2e-test-key-1';
//     console.log(JSON.stringify(jwk));
//   "

export const E2E_TEST_KEY_ID = 'e2e-test-key-1';

/**
 * Private JWK (ES256 / P-256), including `d`. Only `jwt.ts` (running inside
 * the Playwright test/worker process) imports this to sign tokens.
 */
export const E2E_TEST_PRIVATE_JWK = {
  kty: 'EC',
  crv: 'P-256',
  alg: 'ES256',
  use: 'sig',
  kid: E2E_TEST_KEY_ID,
  x: 'kwYosv7q3nx-8zD9DU_lFSkzTbp4XJ4-jzbmPRE3yt0',
  y: 't_EdEUuoaRtjJJPMtWNBQ1Ug7REVEUftfFR09Sf3ebI',
  d: 'BUJrU97WUr4ZI7WKUZiLFdCk-h56IH23fz5FKEQpvXk',
} as const;

/**
 * The JWKS handed to the running api via E2E_TEST_JWKS: the PUBLIC half
 * only (no `d`). Same shape a real `/.well-known/jwks.json` response has.
 */
export function e2eTestJwksJson(): string {
  // Public half only: explicitly pick every field EXCEPT the private `d`
  // scalar, so the JWKS handed to the api can never carry the signing key.
  const { kty, crv, alg, use, kid, x, y } = E2E_TEST_PRIVATE_JWK;
  return JSON.stringify({ keys: [{ kty, crv, alg, use, kid, x, y }] });
}
