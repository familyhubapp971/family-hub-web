import { createBdd } from 'playwright-bdd';
import { test, expect } from '../support/fixtures.js';
import { AssignmentsPO } from '../support/pages/AssignmentsPage.js';
import { FamilyDashboardPO } from '../support/pages/FamilyDashboardPage.js';

// FHR-39/40/41. The sign-in, phone-size, open-area and no-sideways-scroll
// steps are shared with dashboard-daily-use.ts.

const { When, Then } = createBdd(test);

const LONG_TITLE = 'x'.repeat(50);

When('I edit the assignment {string}', async ({ page }, title: string) => {
  const assignments = new AssignmentsPO(page);
  await expect(assignments.row(title)).toBeVisible({ timeout: 15000 });
  await assignments.edit(title);
});

// Checks only the screen as it is, so the edit form stays open. The shared
// "no area scrolls sideways" step opens every area and would close it.
Then('the open edit form does not scroll sideways', async ({ page }) => {
  await expect(page.getByTestId('assignments-delete')).toBeVisible({ timeout: 15000 });
  const overflow = await new FamilyDashboardPO(page).horizontalOverflowPx();
  // 1px of slack: sub-pixel rounding, not a layout that runs off the screen.
  expect(overflow, 'Assignments edit form overflows sideways').toBeLessThanOrEqual(1);
});

When('I delete it and confirm', async ({ page }) => {
  await new AssignmentsPO(page).deleteAndConfirm();
});

Then('the assignment {string} is no longer listed', async ({ page }, title: string) => {
  await expect(new AssignmentsPO(page).row(title)).toHaveCount(0, { timeout: 15000 });
});

When('I start a new assignment', async ({ page }) => {
  await new AssignmentsPO(page).startNew();
});

Then('the earliest due date I can pick is today', async ({ page }) => {
  const today = await page.evaluate(() => {
    const d = new Date();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${d.getFullYear()}-${m}-${day}`;
  });
  await expect(new AssignmentsPO(page).dueDate()).toHaveAttribute('min', today);
});

When('I add an assignment with a 50-character title that has no spaces', async ({ page }) => {
  await new AssignmentsPO(page).add(LONG_TITLE);
});

Then('the new assignment is listed', async ({ page }) => {
  await expect(new AssignmentsPO(page).row(LONG_TITLE)).toBeVisible({ timeout: 15000 });
});
