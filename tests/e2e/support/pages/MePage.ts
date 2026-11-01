import type { Page } from '@playwright/test';

// Page object for /me: mirrors src/areas/members/MePage.tsx.
// Testid selectors:
//   me-loading       : initial spinner
//   me-greeting      : "Hello, {email}" h1
//   me-id            : mirror row id
//   me-created-at    : mirror row createdAt
//   me-error         : non-2xx / malformed-body fallback
export class MePage {
  constructor(private readonly page: Page) {}

  async open() {
    await this.page.goto('/me');
  }

  greeting() {
    return this.page.getByTestId('me-greeting');
  }

  userId() {
    return this.page.getByTestId('me-id');
  }

  createdAt() {
    return this.page.getByTestId('me-created-at');
  }

  errorMessage() {
    return this.page.getByTestId('me-error');
  }
}
