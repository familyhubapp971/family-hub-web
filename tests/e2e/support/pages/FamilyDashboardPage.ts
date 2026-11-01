import type { Page } from '@playwright/test';

/**
 * FHS-645: the six areas of the parent dashboard, driven the way a parent
 * drives them. Labels are the ones the app actually renders (see
 * src/app/layout/dashboard-tabs.ts); the panel test id is the
 * "loaded" landmark each panel raises once its request has answered.
 */
export const DASHBOARD_AREAS = {
  'Family Dashboard': 'today',
  Meals: 'meals',
  Calendar: 'calendar',
  Assignments: 'assignments',
  Noticeboard: 'notices',
  Tasks: 'tasks',
} as const;

export type DashboardAreaLabel = keyof typeof DASHBOARD_AREAS;

export class FamilyDashboardPO {
  constructor(private readonly page: Page) {}

  async open(slug: string) {
    await this.page.goto(`/t/${slug}/dashboard`);
  }

  /** The family name only renders once /api/me has answered, so it doubles as "the page is ready". */
  familyName() {
    return this.page.getByTestId('dashboard-family-name');
  }

  // Not an exact name match on purpose: a tab with unread items carries a
  // badge whose aria-label joins the accessible name ("Tasks 1 unread").
  async openArea(label: DashboardAreaLabel) {
    await this.page.getByRole('tab', { name: label }).click();
  }

  panelReady(label: DashboardAreaLabel) {
    return this.page.getByTestId(`${DASHBOARD_AREAS[label]}-ready`);
  }

  panelError(label: DashboardAreaLabel) {
    return this.page.getByTestId(`${DASHBOARD_AREAS[label]}-error`);
  }

  panelEmpty(label: DashboardAreaLabel) {
    return this.page.getByTestId(`${DASHBOARD_AREAS[label]}-empty`);
  }

  horizontalOverflowPx() {
    return this.page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    );
  }
}
