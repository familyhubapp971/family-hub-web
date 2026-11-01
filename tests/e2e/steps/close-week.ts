import { createBdd } from 'playwright-bdd';
import { test, expect } from '../support/fixtures.js';
import { CloseWeekPage, type ChooserRow } from '../support/pages/CloseWeekPage.js';

// FHS-638: drives the real Close Week journey in a browser, on any day of the
// week, using the `authedFamilyClosableWeek` fixture (its week ends today).

const { Given, When, Then } = createBdd(test);

const PHONE = { width: 375, height: 812 };
const TABLET = { width: 768, height: 1024 };
const ROWS: ChooserRow[] = ['claim', 'cash', 'save', 'invest', 'withdraw'];

Given(
  'I am signed in as the admin of a family whose week ends today',
  async ({ authedFamilyClosableWeek }) => {
    expect(authedFamilyClosableWeek.slug).toMatch(/^[0-9a-f]{4}-[0-9a-f]{4}$/);
  },
);

Given('I am on a phone-sized screen for closing the week', async ({ page }) => {
  await page.setViewportSize(PHONE);
});

Given('I am on a tablet-sized screen for closing the week', async ({ page }) => {
  await page.setViewportSize(TABLET);
});

When("I open my child's board and tap Close Week", async ({ page, authedFamilyClosableWeek }) => {
  const board = new CloseWeekPage(page);
  await board.openBoard(authedFamilyClosableWeek.slug, authedFamilyClosableWeek.childMemberId);
  await board.expectBannerVisible();
  await board.tapCloseWeek();
});

Then(
  'I see the chooser, with what the stickers are worth',
  async ({ page, authedFamilyClosableWeek }) => {
    const board = new CloseWeekPage(page);
    await board.expectChooserVisible();
    const text = await board.chooserText();
    // The child's own name, and a real money figure rather than a bare count.
    expect(text).toContain(authedFamilyClosableWeek.childMemberName);
    expect(text).toMatch(/\$\d/);
    expect(text).toContain('finish the week');
  },
);

Then('every choice is there, each with a line of explanation', async ({ page }) => {
  const board = new CloseWeekPage(page);
  for (const row of ROWS) await board.expectRow(row);
  const text = await board.chooserText();
  expect(text).toContain('Swap stickers for something from the shop.');
  expect(text).toContain('Keep stickers safe in savings for later.');
});

Then('the chooser fits the screen with no sideways scrolling', async ({ page }) => {
  const board = new CloseWeekPage(page);
  await board.expectChooserVisible();
  expect(await board.horizontalOverflow()).toBeLessThanOrEqual(1);
});

Then('every choice is big enough to tap', async ({ page }) => {
  const board = new CloseWeekPage(page);
  for (const row of ROWS) {
    const box = await board.rowBox(row);
    expect(box.height).toBeGreaterThanOrEqual(44);
    expect(box.width).toBeGreaterThanOrEqual(44);
  }
  const finish = await board.finishBox();
  expect(finish.height).toBeGreaterThanOrEqual(44);
});

// FHS-642: closing the week showed the loading screen and then the chooser
// again, so the parent never saw that it had worked.

When('I finish the week', async ({ page }) => {
  const board = new CloseWeekPage(page);
  await board.expectChooserVisible();
  await board.tapFinish();
});

Then(
  'I see the all done screen, and it stays there',
  async ({ page, authedFamilyClosableWeek }) => {
    const board = new CloseWeekPage(page);
    await board.expectDoneVisible();
    // The board behind refreshes itself here. Before FHS-642 that refresh
    // unmounted the sheet, so the message vanished a beat after it appeared.
    await board.expectDoneStillVisible();
    const done = await board.doneText();
    expect(done).toContain('All done');
    expect(done).toContain(authedFamilyClosableWeek.childMemberName);
    expect(done).toContain('a new one has started');
  },
);

Then('the list of choices is not back on screen', async ({ page }) => {
  await new CloseWeekPage(page).expectChooserGone();
});

Then('the all done screen fits the screen with no sideways scrolling', async ({ page }) => {
  const board = new CloseWeekPage(page);
  await board.expectDoneVisible();
  expect(await board.horizontalOverflow()).toBeLessThanOrEqual(1);
});

Then('every way on from it is big enough to tap', async ({ page }) => {
  const board = new CloseWeekPage(page);
  for (const box of await board.doneButtonBoxes()) {
    expect(box.height).toBeGreaterThanOrEqual(44);
    expect(box.width).toBeGreaterThanOrEqual(44);
  }
});

// FHS-639: the header shipped white on white, because a colour name from the
// design's own Tailwind config does not exist in this app's. Nothing errored:
// the class simply produced no rule, and the white title stayed white.

Then('the header is the deep purple from the design', async ({ page }) => {
  const { background } = await new CloseWeekPage(page).headerColours();
  // kingdom-900, #3d1065, the exact purple the design uses.
  expect(background).toBe('rgb(61, 16, 101)');
});

Then('nothing in the header is the same colour as what it sits on', async ({ page }) => {
  const { background, title, closeIcon, closeButton } = await new CloseWeekPage(
    page,
  ).headerColours();
  // The title sits on the header.
  expect(title).not.toBe(background);
  // FHS-640: the cross sits on its own white disc, NOT on the header, and that
  // is the comparison the first version of this check got wrong.
  expect(closeIcon).not.toBe(closeButton);
});

// FHS-641: the design specifies a 512px sheet; the founder asked for roomier on
// a computer. Pinned as a number so a future tidy-up cannot quietly narrow it
// back, and so the phone case below still proves it stays full-bleed there.

Then('the sheet is at least {int} pixels wide', async ({ page }, minimum: number) => {
  expect(await new CloseWeekPage(page).sheetWidth()).toBeGreaterThanOrEqual(minimum);
});
