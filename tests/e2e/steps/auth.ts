import { expect } from '@playwright/test';
import { createBdd } from 'playwright-bdd';
import { LoginPage } from '../support/pages/LoginPage';
import { MePage } from '../support/pages/MePage';

const { Given, When, Then } = createBdd();

// Synthetic e2e account (e2e@familyhub.test) on our own staging sign-in
// service, the only account there with a password (FHS-700). Credentials
// live in .env.local (local dev) and the E2E_AUTH_USER_* GH Actions secrets
// (CI). If either is missing the test throws a clear error instead of
// silently signing in as the empty string.
function e2eUser() {
  const email = process.env['E2E_USER_EMAIL'];
  const password = process.env['E2E_USER_PASSWORD'];
  if (!email || !password) {
    throw new Error(
      'E2E_USER_EMAIL and E2E_USER_PASSWORD must be set ' +
        '(.env.local for local runs; GH Actions secrets for CI). ' +
        'See documents/technical/deployment.md for how the e2e account is provisioned.',
    );
  }
  return { email, password };
}

// Note: password-based signup steps removed in FHS-26 alongside the
// MP signup redesign (no password field in new flow). The new signup
// page is exercised by tests/e2e/steps/signup.ts; FHS-224 will own
// the magic-link replacement scenario.

// ─── FHS-196 ──────────────────────────────────────────────────────────
// "Sign in with the e2e account" → visit /me → see greeting.

Given('I am signed in with the e2e test account', async ({ page }) => {
  const { email, password } = e2eUser();
  const login = new LoginPage(page);
  await login.loginAndWaitForRedirect(email, password);
});

// Slash escaped: Cucumber Expressions treat `/` as alternation.
When('I navigate to \\/me', async ({ page }) => {
  const me = new MePage(page);
  await me.open();
});

Then('I see a greeting with my email', async ({ page }) => {
  const { email } = e2eUser();
  const me = new MePage(page);
  if (await me.errorMessage().isVisible()) {
    const text = await me.errorMessage().textContent();
    throw new Error(`/me errored: ${text ?? '(no message)'}`);
  }
  await expect(me.greeting()).toBeVisible({ timeout: 15_000 });
  await expect(me.greeting()).toHaveText(`Hello, ${email}`);
});

Then('my user id and account-creation timestamp are visible', async ({ page }) => {
  const me = new MePage(page);
  // Don't pin the exact id (it's the sign-in service's account id, stable
  // across runs but env-specific) or the timestamp (created when the
  // user was first provisioned). Just assert the elements are non-empty:
  // proves the mirror row was returned, not a placeholder.
  await expect(me.userId()).toBeVisible();
  await expect(me.userId()).not.toBeEmpty();
  await expect(me.createdAt()).toBeVisible();
  await expect(me.createdAt()).not.toBeEmpty();
});
