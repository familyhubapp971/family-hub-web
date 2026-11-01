import { createBdd } from 'playwright-bdd';
import { test, expect } from '../support/fixtures.js';

// FHS-516: the ONE spec proving the authed e2e harness works. Uses the
// `authedFamily` fixture (support/fixtures.ts) instead of `@playwright/test`
// directly: that's what wires in the seeded family + injected session.

const { Given, When, Then } = createBdd(test);

Given('I am signed in as the admin of a freshly seeded family', async ({ authedFamily }) => {
  // The fixture already seeded the family and injected the session before
  // this step runs (it's a Playwright fixture, resolved on first use in the
  // test), this step just asserts we got one, so a seeding failure shows
  // up here with a clear message rather than as a confusing page-content
  // mismatch two steps later.
  expect(authedFamily.tenantId).toBeTruthy();
  expect(authedFamily.slug).toMatch(/^[0-9a-f]{4}-[0-9a-f]{4}$/);
});

When('I open the Manage Family page for that family', async ({ page, authedFamily }) => {
  await page.goto(`/t/${authedFamily.slug}/members`);
});

Then("I see that family's name in the page header", async ({ page, authedFamily }) => {
  await expect(page.getByTestId('members-family-name')).toHaveText(authedFamily.tenantName);
});

Then('the member summary shows 2 members and 0 waiting to join', async ({ page }) => {
  await expect(page.getByTestId('members-summary')).toHaveText('2 members · 0 waiting to join');
});
