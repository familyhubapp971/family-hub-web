import { createBdd } from 'playwright-bdd';
import { test } from '../support/fixtures.js';
import { ScreenFeedbackPage } from '../support/pages/ScreenFeedbackPage.js';

// FHS-670: the per-screen feedback form in a real browser. The sign-in and
// screen-size steps are shared, defined in authed-smoke.ts and
// getting-started.ts.

const { Given, When, Then } = createBdd(test);

When('I open the Meals screen', async ({ page, authedFamily }) => {
  await page.goto(`/t/${authedFamily.slug}/dashboard?tab=meals`);
});

When('I open Feedback on this screen', async ({ page }) => {
  await new ScreenFeedbackPage(page).open();
});

Then('the form asks {string}', async ({ page }, question: string) => {
  await new ScreenFeedbackPage(page).expectQuestion(question);
});

When(
  'I tap {string}, rate ease of use {int} and send it',
  async ({ page }, feature: string, ease: number) => {
    const form = new ScreenFeedbackPage(page);
    await form.tapFeature(feature);
    await form.rateEase(ease);
    await form.send();
  },
);

Then('I see the thank-you message', async ({ page }) => {
  await new ScreenFeedbackPage(page).expectThanks();
});

Then('the feedback button is big enough to tap', async ({ page }) => {
  await new ScreenFeedbackPage(page).expectButtonTappable();
});

Then('the page has no sideways scrolling', async ({ page }) => {
  await new ScreenFeedbackPage(page).expectNoSidewaysScroll();
});

Then('the feedback form fits the screen', async ({ page }) => {
  await new ScreenFeedbackPage(page).expectDialogFits();
});

When('I switch to the Calendar tab', async ({ page, authedFamily }) => {
  await page.goto(`/t/${authedFamily.slug}/dashboard?tab=calendar`);
});

Then('a bubble says I can give feedback on {string}', async ({ page }, area: string) => {
  await new ScreenFeedbackPage(page).expectReminder(area);
});

Then('the feedback button does not cover the end of the page', async ({ page }) => {
  await new ScreenFeedbackPage(page).expectBottomClear();
});

Given('my screen is {int} by {int}', async ({ page }, width: number, height: number) => {
  await page.setViewportSize({ width, height });
});

Then('the header and close button of the feedback form are on screen', async ({ page }) => {
  await new ScreenFeedbackPage(page).expectHeaderVisible();
});

When('I scroll to Send inside the feedback form', async ({ page }) => {
  await new ScreenFeedbackPage(page).scrollToSend();
});

// FHS-717: report an issue with a photo.
Then('the issue report is at the top of the feedback form', async ({ page }) => {
  await new ScreenFeedbackPage(page).expectIssueReportOnScreen();
});

Then('the Add photos button is big enough to tap', async ({ page }) => {
  await new ScreenFeedbackPage(page).expectAddPhotosTappable();
});

When('I write {string} under What went wrong', async ({ page }, words: string) => {
  await new ScreenFeedbackPage(page).describeIssue(words);
});

When('I add a photo of the problem', async ({ page }) => {
  await new ScreenFeedbackPage(page).addPhoto();
});

Then('I see the photo ready to send', async ({ page }) => {
  await new ScreenFeedbackPage(page).expectPhotoReady();
});

When('I send the feedback', async ({ page }) => {
  await new ScreenFeedbackPage(page).send();
});
