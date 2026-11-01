import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';

// FHS-399 - unit tests for KidFinishedWeekRecap in isolation.
// Covers: empty-state (0 stars / 0 habits), save-only, 100% completion,
// and graceful degradation when the actions fetch fails.

import { KidFinishedWeekRecap } from '../../../../../../src/areas/my-world/kid/KidFinishedWeekRecap';

const HEADERS = { Authorization: 'Bearer kid.test.token' };

const fetchMock = vi.fn();

beforeEach(() => {
  fetchMock.mockReset();
  vi.stubGlobal('fetch', fetchMock);
});
afterEach(() => vi.unstubAllGlobals());

function mockActions(actions: { actionType: string; stickersUsed: number }[]) {
  fetchMock.mockResolvedValueOnce({
    ok: true,
    status: 200,
    json: async () => ({ actions }),
  });
}

function mockActionsFail() {
  fetchMock.mockResolvedValueOnce({ ok: false, status: 500, json: async () => ({}) });
}

describe('<KidFinishedWeekRecap />', () => {
  it('0 stars + 0 habits: shows the gentle empty-state line, keeps stars tile and completion badge', async () => {
    mockActions([]);

    render(
      <KidFinishedWeekRecap
        weekId="wEmpty"
        headers={HEADERS}
        earnedThisWeek={0}
        stickerRate={0.5}
        currency="AED"
        carriedOverStickers={0}
        doneThisView={0}
        totalThisView={0}
      />,
    );

    // Stars earned tile always shows (even 0)
    expect(screen.getByTestId('kid-recap-stars-earned')).toHaveTextContent('0');
    expect(screen.getByTestId('kid-recap-stars-earned')).toHaveTextContent('AED 0.00');

    // Completion badge shows (0%)
    await waitFor(() => expect(screen.getByTestId('kid-recap-completion-pct')).toBeInTheDocument());
    expect(screen.getByTestId('kid-recap-completion-pct')).toHaveTextContent('0%');

    // Empty-state line appears in the allocation section
    await waitFor(() => expect(screen.getByTestId('kid-recap-no-activity')).toBeInTheDocument());
    expect(screen.getByTestId('kid-recap-no-activity')).toHaveTextContent(
      /No stars earned this week/,
    );

    // No Saved or Planted rows
    expect(screen.queryByTestId('kid-recap-saved-stars')).not.toBeInTheDocument();
    expect(screen.queryByTestId('kid-recap-planted-stars')).not.toBeInTheDocument();
  });

  it('save-only actions: Saved row shown, Planted row absent', async () => {
    mockActions([
      { actionType: 'save', stickersUsed: 6 },
      { actionType: 'auto_save', stickersUsed: 1 },
    ]);

    render(
      <KidFinishedWeekRecap
        weekId="wSaveOnly"
        headers={HEADERS}
        earnedThisWeek={7}
        stickerRate={0.5}
        currency="AED"
        carriedOverStickers={0}
        doneThisView={7}
        totalThisView={14}
      />,
    );

    await waitFor(() => expect(screen.getByTestId('kid-recap-saved-stars')).toBeInTheDocument());
    expect(screen.getByTestId('kid-recap-saved-stars')).toHaveTextContent('Saved 7 stars');
    expect(screen.queryByTestId('kid-recap-planted-stars')).not.toBeInTheDocument();
    expect(screen.queryByTestId('kid-recap-no-activity')).not.toBeInTheDocument();
  });

  it('100% completion: celebratory "Great job!" message', async () => {
    mockActions([]);

    render(
      <KidFinishedWeekRecap
        weekId="wPerfect"
        headers={HEADERS}
        earnedThisWeek={14}
        stickerRate={0.5}
        currency="AED"
        carriedOverStickers={0}
        doneThisView={14}
        totalThisView={14}
      />,
    );

    await waitFor(() => expect(screen.getByTestId('kid-recap-completion-pct')).toBeInTheDocument());
    expect(screen.getByTestId('kid-recap-completion-pct')).toHaveTextContent('100%');
    expect(screen.getByTestId('kid-recap-completion-message')).toHaveTextContent(/Great job/);
  });

  it('actions-fetch failure: stars tile + completion badge still show; error line in allocation', async () => {
    mockActionsFail();

    render(
      <KidFinishedWeekRecap
        weekId="wError"
        headers={HEADERS}
        earnedThisWeek={5}
        stickerRate={0.5}
        currency="AED"
        carriedOverStickers={0}
        doneThisView={5}
        totalThisView={14}
      />,
    );

    // Stars tile always present
    expect(screen.getByTestId('kid-recap-stars-earned')).toHaveTextContent('5');

    // Allocation section shows error text
    await waitFor(() =>
      expect(screen.getByTestId('kid-recap-stars-allocation')).toBeInTheDocument(),
    );
    expect(screen.getByTestId('kid-recap-stars-allocation')).toHaveTextContent(
      /Couldn.t load star details/,
    );

    // Completion badge still shows
    expect(screen.getByTestId('kid-recap-completion-pct')).toBeInTheDocument();

    // No individual rows
    expect(screen.queryByTestId('kid-recap-saved-stars')).not.toBeInTheDocument();
    expect(screen.queryByTestId('kid-recap-planted-stars')).not.toBeInTheDocument();
  });
});
