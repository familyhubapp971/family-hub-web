import { expect } from '@playwright/test';
import { createBdd } from 'playwright-bdd';
import { VerifyEmailPage } from '../support/pages/VerifyEmailPage';

const { Then, When } = createBdd();

// `Given I open the page "..."` is shared with tests/e2e/steps/tenant-routing.ts,
// don't redefine it here.

Then('I see the verify-email heading', async ({ page }) => {
  await expect(new VerifyEmailPage(page).heading()).toBeVisible();
});

Then('I see the email {string} on the verify-email page', async ({ page }, email: string) => {
  await expect(new VerifyEmailPage(page).emailReadout()).toHaveText(email);
});

Then('the Open Gmail link points at mail.google.com', async ({ page }) => {
  // The button is provider-aware: gmail.com → Gmail / mail.google.com.
  // Outlook / Yahoo / iCloud / etc. map to their own webmail (covered
  // by unit tests in tests/unit/web/app/lib/webmail.test.ts).
  const link = new VerifyEmailPage(page).openMailboxLink();
  await expect(link).toHaveAttribute('href', 'https://mail.google.com/');
  await expect(link).toHaveAttribute('target', '_blank');
});

When('I click the verify-email back link', async ({ page }) => {
  await new VerifyEmailPage(page).backLink().click();
});

Then('I am on the signup page', async ({ page }) => {
  await page.waitForURL(/\/signup(\?|$)/);
  await expect(page).toHaveURL(/\/signup(\?|$)/);
});
