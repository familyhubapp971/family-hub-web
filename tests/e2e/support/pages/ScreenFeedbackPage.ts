import type { Locator, Page } from '@playwright/test';
import { expect } from '@playwright/test';

// FHS-670: the per-screen feedback button and its form.

// FHS-717: a real 1x1 PNG, so the browser can open it and shrink it like a
// phone photo. A made-up file would be refused as not a photo.
const TINY_PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
  'base64',
);

export class ScreenFeedbackPage {
  constructor(private readonly page: Page) {}

  private get button() {
    return this.page.getByTestId('screen-feedback-button');
  }

  private get dialog() {
    return this.page.getByTestId('screen-feedback-dialog');
  }

  async open(): Promise<void> {
    await this.button.click();
    await expect(this.dialog).toBeVisible();
  }

  async expectQuestion(text: string): Promise<void> {
    await expect(this.dialog.getByText(text)).toBeVisible();
  }

  async tapFeature(name: string): Promise<void> {
    await this.dialog.getByRole('button', { name }).click();
  }

  async rateEase(n: number): Promise<void> {
    await this.page.getByTestId(`screen-feedback-ease-${n}`).click();
  }

  async send(): Promise<void> {
    await this.page.getByTestId('screen-feedback-submit').click();
  }

  async expectThanks(): Promise<void> {
    await expect(this.page.getByTestId('screen-feedback-thanks')).toBeVisible();
  }

  async expectButtonTappable(): Promise<void> {
    await expect(this.button).toBeVisible();
    const box = await this.button.boundingBox();
    expect(box?.width ?? 0).toBeGreaterThanOrEqual(44);
    expect(box?.height ?? 0).toBeGreaterThanOrEqual(44);
  }

  async expectNoSidewaysScroll(): Promise<void> {
    const overflow = await this.page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    );
    expect(overflow).toBeLessThanOrEqual(0);
  }

  private get card() {
    return this.page.getByTestId('screen-feedback-card');
  }

  private get closeButton() {
    return this.dialog.getByRole('button', { name: 'Close feedback dialog' });
  }

  /** FHS-678: the whole form box sits inside the screen on every side. */
  async expectDialogFits(): Promise<void> {
    await this.expectInsideViewport(this.card);
  }

  /** FHS-678: the pink header and the close button are on screen and tappable. */
  async expectHeaderVisible(): Promise<void> {
    await this.expectInsideViewport(this.page.getByTestId('screen-feedback-header'));
    await this.expectInsideViewport(this.closeButton);
    const box = await this.closeButton.boundingBox();
    expect(box?.width ?? 0).toBeGreaterThanOrEqual(44);
    expect(box?.height ?? 0).toBeGreaterThanOrEqual(44);
  }

  /** FHS-678: the form scrolls inside its own box, and the header stays put. */
  async scrollToSend(): Promise<void> {
    const submit = this.page.getByTestId('screen-feedback-submit');
    await submit.scrollIntoViewIfNeeded();
    await this.expectInsideViewport(submit);
    await this.expectHeaderVisible();
  }

  private async expectInsideViewport(target: Locator): Promise<void> {
    const box = await target.boundingBox();
    const size = this.page.viewportSize();
    expect(box).not.toBeNull();
    expect(size).not.toBeNull();
    expect(box!.x).toBeGreaterThanOrEqual(0);
    expect(box!.y).toBeGreaterThanOrEqual(0);
    expect(box!.x + box!.width).toBeLessThanOrEqual(size!.width);
    expect(box!.y + box!.height).toBeLessThanOrEqual(size!.height);
  }

  /** FHS-717: the issue report opens at the top, its heading on screen. */
  async expectIssueReportOnScreen(): Promise<void> {
    await this.expectInsideViewport(
      this.dialog.getByRole('heading', { name: 'Found an issue on this screen? Report it.' }),
    );
    await this.expectInsideViewport(this.dialog.getByLabel('What went wrong?'));
  }

  async expectAddPhotosTappable(): Promise<void> {
    const add = this.page.getByTestId('screen-feedback-add-photos');
    await add.scrollIntoViewIfNeeded();
    await this.expectInsideViewport(add);
    const box = await add.boundingBox();
    expect(box?.width ?? 0).toBeGreaterThanOrEqual(44);
    expect(box?.height ?? 0).toBeGreaterThanOrEqual(44);
  }

  async describeIssue(words: string): Promise<void> {
    await this.dialog.getByLabel('What went wrong?').fill(words);
  }

  async addPhoto(): Promise<void> {
    await this.page.getByTestId('screen-feedback-photo-input').setInputFiles({
      name: 'problem.png',
      mimeType: 'image/png',
      buffer: TINY_PNG,
    });
  }

  async expectPhotoReady(): Promise<void> {
    await expect(this.page.getByTestId('screen-feedback-photo')).toHaveCount(1);
    await expect(this.dialog.getByRole('button', { name: 'Remove photo 1' })).toBeVisible();
    await expect(this.page.getByTestId('screen-feedback-submit')).toBeEnabled();
  }

  async expectReminder(area: string): Promise<void> {
    await expect(this.page.getByTestId('screen-feedback-hint')).toContainText(
      `You can give feedback on ${area} here.`,
    );
  }

  /** At the very bottom of the page, the button sits below the page's content. */
  async expectBottomClear(): Promise<void> {
    await this.page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
    const button = await this.button.boundingBox();
    const pageBottom = await this.page.evaluate(
      () => document.querySelector('#root > *')?.getBoundingClientRect().bottom ?? 0,
    );
    expect(button).not.toBeNull();
    expect(button!.y).toBeGreaterThanOrEqual(pageBottom - 1);
  }
}
