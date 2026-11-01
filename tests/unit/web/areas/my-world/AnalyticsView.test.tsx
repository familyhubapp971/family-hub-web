// FHS-481/482: Unit tests for AnalyticsView's summary tile label and
// leaderboard completion display.

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';

import { AnalyticsView } from '../../../../../src/areas/my-world/AnalyticsView';

const fetchMock = vi.fn();

beforeEach(() => {
  fetchMock.mockReset();
  vi.stubGlobal('fetch', fetchMock);
});
afterEach(() => vi.unstubAllGlobals());

function mockAnalytics(body: unknown) {
  fetchMock.mockImplementation(() =>
    Promise.resolve({ ok: true, status: 200, json: async () => body }),
  );
}

describe('<AnalyticsView />', () => {
  it('labels the sticker summary tile "Current Value", not "Potential Value" (FHS-481)', async () => {
    mockAnalytics({
      stickersPerWeek: [
        {
          weekNumber: 9,
          year: 2026,
          startDate: '2026-02-23',
          totalStickers: 12,
          completionRate: 60,
        },
      ],
      habitStats: [],
    });
    render(<AnalyticsView analyticsUrl="/api/mw/analytics" headers={{}} />);

    await waitFor(() => expect(screen.getByTestId('analytics-view')).toBeInTheDocument());
    expect(screen.getByTestId('analytics-summary-total-stickers')).toHaveTextContent(
      'Current Value',
    );
    expect(screen.queryByText('Potential Value')).not.toBeInTheDocument();
  });

  it('shows a habit\'s leaderboard completion as "X of Y days", not a bare count (FHS-482)', async () => {
    mockAnalytics({
      stickersPerWeek: [],
      habitStats: [
        {
          habitId: 'h1',
          name: 'Read a book',
          habitIcon: 'heart',
          totalDays: 21,
          completedDays: 9,
          rate: 43,
        },
      ],
    });
    render(<AnalyticsView analyticsUrl="/api/mw/analytics" headers={{}} />);

    await waitFor(() => expect(screen.getByTestId('analytics-leaderboard')).toBeInTheDocument());
    expect(screen.getByText('9 of 21 days')).toBeInTheDocument();
    expect(screen.queryByText('9 days')).not.toBeInTheDocument();
  });
});
