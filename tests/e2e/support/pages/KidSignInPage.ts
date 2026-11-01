import type { Page } from '@playwright/test';

/**
 * FHS-645: the child's own way in, at /t/:slug/kid-login: pick your face,
 * type four digits. No grown-up session is injected for these specs; the PIN
 * screen IS the thing under test (src/public-pages/sign-in/KidSignIn.tsx).
 */
export class KidSignInPO {
  constructor(private readonly page: Page) {}

  async open(slug: string) {
    await this.page.goto(`/t/${slug}/kid-login`);
  }

  avatars() {
    return this.page.getByTestId('kid-login-avatars');
  }

  /** Tiles carry the child's name as their accessible name. */
  async choose(name: string) {
    await this.avatars().getByRole('button', { name, exact: false }).click();
  }

  pinSection() {
    return this.page.getByTestId('kid-login-pin-section');
  }

  /** One digit per cell: the component moves focus on, but filling each cell is what a child does. */
  async enterPin(pin: string) {
    const cells = this.page.getByTestId('kid-login-pin').locator('input');
    for (let i = 0; i < pin.length; i += 1) {
      await cells.nth(i).fill(pin[i] ?? '');
    }
  }

  error() {
    return this.page.getByTestId('kid-login-error');
  }
}
