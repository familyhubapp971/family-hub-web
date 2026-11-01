// bddgen's createBdd() requires a `test` extended from playwright-bdd's OWN
// `test` export (it carries the Given/When/Then/$bddContext fixtures):
// extending `@playwright/test`'s bare `test` throws
// "createBdd() should use 'test' extended from playwright-bdd" at runtime.
import { test as base } from 'playwright-bdd';
import type { BrowserContext } from '@playwright/test';
import { mintE2eAccessToken } from './auth/jwt.js';
import { LOCAL_AUTH_URL } from './auth/env.js';
import { buildSupabaseLocalStorageEntry } from './auth/session.js';
import { cleanupFamily, seedFamily, type SeededFamily } from './auth/seed.js';

// FHS-516: reusable authenticated fixture for specs that need a signed-in
// family. Any future spec that needs an authed `/t/:slug/*` page imports
// `test`/`expect` from HERE (not from '@playwright/test' directly) and
// depends on the `authedFamily` fixture:
//
//   import { test, expect } from '../support/fixtures.js';
//   import { createBdd } from 'playwright-bdd';
//   const { Given, When, Then } = createBdd(test);
//
//   Given('I am signed in to a fresh family', async ({ authedFamily, page }) => {
//     await page.goto(`/t/${authedFamily.slug}/members`);
//   });
//
// What it does, end to end:
//   1. Seeds a fresh, isolated tenant + admin user + child member + habit
//      directly in Postgres (support/auth/seed.ts), no signup flow, no
//      real email.
//   2. Mints an ES256 JWT for that user (support/auth/jwt.ts), signed with
//      the fixed test key the api trusts ONLY when E2E_TEST_JWKS is set
//      (see playwright.config.ts + family-hub-api src/security/auth.ts).
//   3. Injects a supabase-js-shaped session into localStorage via
//      `context.addInitScript` (support/auth/session.ts), so it's already
//      there before the web app's first script runs: no UI login needed.
//   4. Tears the seeded family down after the test (support/auth/seed.ts).
//
// A test using this fixture can go straight to `page.goto('/t/<slug>/...')`
// already authenticated, exactly like a real signed-in user on a hard
// reload (session restored from localStorage).

export interface AuthedFamily extends SeededFamily {
  accessToken: string;
  /**
   * The injected supabase session, as a localStorage key/value pair.
   *
   * FHS-634: exposed so a spec can open a SECOND browser context signed in as
   * the same parent, which is how "does this survive changing browser?" gets
   * asked honestly rather than by clearing storage in place.
   */
  sessionEntry: { key: string; value: string };
}

async function createSessionEntry(
  userId: string,
  email: string,
): Promise<Pick<AuthedFamily, 'accessToken' | 'sessionEntry'>> {
  const accessToken = await mintE2eAccessToken({ sub: userId, email });
  const payload = JSON.parse(
    Buffer.from(accessToken.split('.')[1] ?? '', 'base64url').toString('utf8'),
  ) as { exp: number };
  const sessionEntry = buildSupabaseLocalStorageEntry({
    authUrl: LOCAL_AUTH_URL,
    accessToken,
    userId,
    email,
    expiresAt: payload.exp,
  });
  return { accessToken, sessionEntry };
}

async function installSession(
  context: BrowserContext,
  entry: AuthedFamily['sessionEntry'],
): Promise<void> {
  await context.addInitScript(({ key, value }) => {
    window.localStorage.setItem(key, value);
  }, entry);
}

/**
 * FHS-638: the same authed family, but with its week anchored so today is the
 * last day. Depend on this instead of `authedFamily` when the spec needs the
 * My World board's "Close Week" banner, which only appears from that day on.
 */
export const test = base.extend<{
  authedFamily: AuthedFamily;
  authedFamilyClosableWeek: AuthedFamily;
  populatedFamily: AuthedFamily;
  savingsFamily: AuthedFamily;
  adultFamily: AuthedFamily;
  kidFamily: SeededFamily;
}>({
  authedFamily: async ({ context }, use) => {
    const family = await seedFamily();
    const session = await createSessionEntry(family.userId, family.email);
    await installSession(context, session.sessionEntry);
    await use({ ...family, ...session });

    await cleanupFamily(family);
  },

  authedFamilyClosableWeek: async ({ context }, use) => {
    const family = await seedFamily({ weekEndsToday: true });
    const session = await createSessionEntry(family.userId, family.email);
    await installSession(context, session.sessionEntry);
    await use({ ...family, ...session });

    await cleanupFamily(family);
  },

  // FHS-645: the admin of a family with one real row behind every dashboard
  // tab, so a spec can tell a loaded tab from an empty one.
  populatedFamily: async ({ context }, use) => {
    const family = await seedFamily({ withContent: true });
    const session = await createSessionEntry(family.userId, family.email);
    await installSession(context, session.sessionEntry);
    await use({ ...family, ...session });
    await cleanupFamily(family);
  },

  // FHS-646: a child with 20 spendable stickers in a week that ends today, so
  // the Close Week chooser is offered and the save flow has something to move.
  savingsFamily: async ({ context }, use) => {
    const family = await seedFamily({ weekEndsToday: true, earnedStickers: 7 });
    const session = await createSessionEntry(family.userId, family.email);
    await installSession(context, session.sessionEntry);
    await use({ ...family, ...session });
    await cleanupFamily(family);
  },

  // FHS-645: signed in as the family's SECOND adult, a real `adult` member
  // with their own user, not the admin demoted in place. That is the only way
  // to prove admin-only doors stay shut while the admin still exists.
  adultFamily: async ({ context }, use) => {
    const family = await seedFamily({ withPersonas: true });
    if (!family.personas) throw new Error('adultFamily: seed returned no personas');
    const session = await createSessionEntry(
      family.personas.adultUserId,
      family.personas.adultEmail,
    );
    await installSession(context, session.sessionEntry);
    await use({ ...family, ...session });
    await cleanupFamily(family);
  },

  // FHS-645: no injected grown-up session on purpose. A child signs in
  // through the PIN screen, which is the thing under test.
  // Playwright requires the first argument to be an object destructuring
  // pattern, even for a fixture that needs nothing out of it.
  // eslint-disable-next-line no-empty-pattern
  kidFamily: async ({}, use) => {
    const family = await seedFamily({ withPersonas: true });
    await use(family);
    await cleanupFamily(family);
  },
});

export { expect } from '@playwright/test';
