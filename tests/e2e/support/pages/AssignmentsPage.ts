import type { Page } from '@playwright/test';

/** FHR-39/40/41: the Assignments tab, driven the way a parent drives it. */
export class AssignmentsPO {
  constructor(private readonly page: Page) {}

  row(title: string) {
    return this.page.locator('[data-testid^="assignment-row-"]', { hasText: title });
  }

  async edit(title: string) {
    await this.page.getByRole('button', { name: `Edit "${title}"` }).click();
  }

  async startNew() {
    await this.page.getByTestId('assignments-add').click();
  }

  dueDate() {
    return this.page.getByTestId('assignments-add-due');
  }

  async add(title: string) {
    await this.startNew();
    await this.page.getByTestId('assignments-add-title').fill(title);
    await this.page.getByTestId('assignments-add-submit').click();
  }

  async deleteAndConfirm() {
    await this.page.getByTestId('assignments-delete').click();
    await this.page.getByTestId('assignments-delete-confirm-confirm').click();
  }
}
