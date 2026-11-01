import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor, fireEvent, act } from '@testing-library/react';

// FHS-376 - the DEDICATED kid My World (its own components, pixel-matched to the
// Magic Patterns kid mock - NOT the parent's MyWorldTab reused). Reads the
// self-scoped /api/kid/* endpoints with the kid bearer token.

import { KidMyWorld } from '../../../../../../src/areas/my-world/kid/KidMyWorld';

const KID_TOKEN = 'kid.jwt.token';

const WEEK = {
  id: 'w1',
  weekNumber: 24,
  year: 2026,
  startDate: '2026-06-15',
  isFinalized: false,
  carriedOverStickers: 0,
  carriedOverCash: 0,
  retrievedStickers: 0,
  retrievedCash: 0,
};

const HABITS_BODY = {
  habits: [
    {
      id: 'h1',
      name: 'Read a book',
      description: null,
      color: 'bg-yellow-400',
      icon: 'heart',
      isBonus: false,
    },
    {
      id: 'h2',
      name: 'Brush teeth',
      description: null,
      color: 'bg-pink-400',
      icon: 'star',
      isBonus: false,
    },
  ],
  // h1 has 2 done days (Mon + Tue); h2 has 1 (Mon).
  stickers: [
    { habitId: 'h1', day: 0, sticker: 'gold-star', stickerValue: 1 },
    { habitId: 'h1', day: 1, sticker: 'gold-star', stickerValue: 1 },
    { habitId: 'h2', day: 0, sticker: 'gold-star', stickerValue: 1 },
  ],
  week: { id: 'w1', weekNumber: 24, year: 2026, startDate: '2026-06-15', isFinalized: false },
  balance: 8,
  currency: 'AED',
};

// A configurable fetch mock. `overrides` lets a test bend a single endpoint's
// JSON; everything else falls back to a sensible default.
const fetchMock = vi.fn();

interface BootOverrides {
  rewards?: unknown;
  savings?: unknown;
  investments?: unknown;
  habits?: unknown;
  analytics?: unknown;
  onRequest?: (url: string) => void;
  requestFails?: boolean;
}

function mockBoot(over: BootOverrides = {}) {
  fetchMock.mockImplementation((url: string, init?: RequestInit) => {
    const u = String(url);
    if (u.includes('/api/kid/rewards/') && u.endsWith('/request')) {
      over.onRequest?.(u);
      return Promise.resolve({
        ok: !over.requestFails,
        status: over.requestFails ? 500 : 200,
        json: async () => (over.requestFails ? {} : { id: 'req1', status: 'pending' }),
      });
    }
    if (u.endsWith('/api/kid/weeks')) {
      return Promise.resolve({ ok: true, status: 200, json: async () => ({ weeks: [WEEK] }) });
    }
    if (u.includes('/api/kid/habits')) {
      return Promise.resolve({
        ok: true,
        status: 200,
        json: async () => over.habits ?? HABITS_BODY,
      });
    }
    if (u.includes('/api/kid/financial/savings')) {
      return Promise.resolve({
        ok: true,
        status: 200,
        json: async () =>
          over.savings ?? { savedStickers: 10, savedCash: 5, currency: 'AED', stickerRate: 0.5 },
      });
    }
    if (u.includes('/api/kid/financial/investments')) {
      return Promise.resolve({
        ok: true,
        status: 200,
        json: async () => over.investments ?? { investments: [] },
      });
    }
    if (u.endsWith('/api/kid/rewards')) {
      return Promise.resolve({
        ok: true,
        status: 200,
        json: async () =>
          over.rewards ?? {
            rewards: [
              {
                id: 'rw1',
                name: 'Ice Cream',
                description: null,
                stickerCost: 5,
                icon: '\u{1F366}',
                requestStatus: 'none',
              },
            ],
            stickerBalance: 8,
          },
      });
    }
    if (u.includes('/api/kid/analytics')) {
      return Promise.resolve({
        ok: true,
        status: 200,
        json: async () =>
          over.analytics ?? {
            stickersPerWeek: [],
            habitStats: [
              {
                habitId: 'h1',
                name: 'Read a book',
                habitIcon: 'heart',
                totalDays: 7,
                completedDays: 4,
                rate: 57,
              },
            ],
          },
      });
    }
    // init referenced so the signature stays meaningful for POST detection above
    void init;
    return Promise.resolve({ ok: true, status: 200, json: async () => ({}) });
  });
}

beforeEach(() => {
  fetchMock.mockReset();
  mockBoot();
  vi.stubGlobal('fetch', fetchMock);
});
afterEach(() => {
  // FHS-484 tests fake the clock; always restore it so a failed assertion
  // can't leave later tests running against a frozen "now".
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe('<KidMyWorld />', () => {
  it('renders habits, money skills, reward goals and my account from the kid endpoints', async () => {
    render(<KidMyWorld kidToken={KID_TOKEN} displayName="Amina" />);

    await waitFor(() => expect(screen.getByTestId('kid-myworld')).toBeInTheDocument());

    // Habits (the name also appears in the My Account earned list, so scope
    // the card-level assertion to the habit card itself).
    expect(screen.getByTestId('kid-habit-card-h1')).toHaveTextContent('Read a book');
    expect(screen.getByTestId('kid-habit-card-h2')).toHaveTextContent('Brush teeth');
    // 'heart' icon name renders a Heart SVG, never the literal word.
    expect(document.querySelector('.lucide-heart')).toBeInTheDocument();
    expect(screen.queryByText('heart')).not.toBeInTheDocument();

    // Money Skills
    expect(screen.getByTestId('kid-moneyskills')).toBeInTheDocument();
    expect(screen.getByTestId('kid-moneyskills')).toHaveTextContent('You have 8 stars');

    // Reward Goals
    expect(screen.getByTestId('kid-reward-goals')).toBeInTheDocument();
    expect(screen.getByText('Reward Goals')).toBeInTheDocument();

    // My Account: earned this week = 2 (h1) + 1 (h2) = 3 stars -> AED 1.50
    expect(screen.getByTestId('kid-my-account')).toBeInTheDocument();
    expect(screen.getByTestId('kid-account-cash')).toHaveTextContent('AED 1.50');
  });

  it('asks for a reward: ask -> confirm -> POST -> pending', async () => {
    const requested: string[] = [];
    mockBoot({ onRequest: (u) => requested.push(u) });
    render(<KidMyWorld kidToken={KID_TOKEN} displayName="Amina" />);

    await waitFor(() => expect(screen.getByTestId('reward-ask-rw1')).toBeInTheDocument());

    await act(async () => {
      fireEvent.click(screen.getByTestId('reward-ask-rw1'));
    });
    // confirm step
    await waitFor(() => expect(screen.getByTestId('reward-confirm-rw1')).toBeInTheDocument());
    await act(async () => {
      fireEvent.click(screen.getByTestId('reward-confirm-rw1'));
    });

    await waitFor(() => expect(requested.length).toBe(1));
    expect(requested[0]).toContain('/api/kid/rewards/rw1/request');
    await waitFor(() => expect(screen.getByTestId('reward-pending-rw1')).toBeInTheDocument());
  });

  it('confirm then "Not yet" returns to Ask without sending a request', async () => {
    const requested: string[] = [];
    mockBoot({ onRequest: (u) => requested.push(u) });
    render(<KidMyWorld kidToken={KID_TOKEN} displayName="Amina" />);
    await waitFor(() => expect(screen.getByTestId('reward-ask-rw1')).toBeInTheDocument());
    await act(async () => {
      fireEvent.click(screen.getByTestId('reward-ask-rw1'));
    });
    await waitFor(() => expect(screen.getByTestId('reward-cancel-rw1')).toBeInTheDocument());
    await act(async () => {
      fireEvent.click(screen.getByTestId('reward-cancel-rw1'));
    });
    await waitFor(() => expect(screen.getByTestId('reward-ask-rw1')).toBeInTheDocument());
    expect(requested).toHaveLength(0);
  });

  it('reverts to Ask when the request POST fails', async () => {
    mockBoot({ requestFails: true });
    render(<KidMyWorld kidToken={KID_TOKEN} displayName="Amina" />);
    await waitFor(() => expect(screen.getByTestId('reward-ask-rw1')).toBeInTheDocument());
    await act(async () => {
      fireEvent.click(screen.getByTestId('reward-ask-rw1'));
    });
    await act(async () => {
      fireEvent.click(screen.getByTestId('reward-confirm-rw1'));
    });
    await waitFor(() => expect(screen.getByTestId('reward-ask-rw1')).toBeInTheDocument());
    expect(screen.queryByTestId('reward-pending-rw1')).not.toBeInTheDocument();
  });

  it('a reward already pending shows no Ask button', async () => {
    mockBoot({
      rewards: {
        rewards: [
          {
            id: 'p1',
            name: 'Pending Treat',
            description: null,
            stickerCost: 5,
            icon: '⏳',
            requestStatus: 'pending',
          },
        ],
        stickerBalance: 50,
      },
    });
    render(<KidMyWorld kidToken={KID_TOKEN} displayName="Amina" />);
    await waitFor(() => expect(screen.getByTestId('reward-pending-p1')).toBeInTheDocument());
    expect(screen.queryByTestId('reward-ask-p1')).not.toBeInTheDocument();
  });

  it('shows "Keep saving" when the reward is unaffordable', async () => {
    mockBoot({
      // Affordability is measured against SAVINGS (what approval spends): 8 saved
      // stars, no banked cash -> 92 short of a 100-star reward.
      savings: { savedStickers: 8, savedCash: 0, currency: 'AED' },
      rewards: {
        rewards: [
          {
            id: 'rw2',
            name: 'Big Lego Set',
            description: null,
            stickerCost: 100,
            icon: '\u{1F9F1}',
            requestStatus: 'none',
          },
        ],
        stickerBalance: 8,
      },
    });
    render(<KidMyWorld kidToken={KID_TOKEN} displayName="Amina" />);

    await waitFor(() => expect(screen.getByTestId('reward-keepsaving-rw2')).toBeInTheDocument());
    expect(screen.queryByTestId('reward-ask-rw2')).not.toBeInTheDocument();
    expect(screen.getByText(/92 more stars to go/)).toBeInTheDocument();
  });

  it('shows pending / approved / declined states from requestStatus', async () => {
    mockBoot({
      rewards: {
        rewards: [
          {
            id: 'p1',
            name: 'Pending One',
            description: null,
            stickerCost: 5,
            icon: '⏳',
            requestStatus: 'pending',
          },
          {
            id: 'a1',
            name: 'Approved One',
            description: null,
            stickerCost: 5,
            icon: '\u{1F389}',
            requestStatus: 'approved',
          },
          {
            id: 'd1',
            name: 'Declined One',
            description: null,
            stickerCost: 5,
            icon: '\u{1F615}',
            requestStatus: 'declined',
          },
        ],
        stickerBalance: 50,
      },
    });
    render(<KidMyWorld kidToken={KID_TOKEN} displayName="Amina" />);

    await waitFor(() => expect(screen.getByTestId('reward-pending-p1')).toBeInTheDocument());
    expect(screen.getByTestId('reward-approved-a1')).toBeInTheDocument();
    expect(screen.getByTestId('reward-declined-d1')).toBeInTheDocument();
  });

  it('toggles to Analytics and shows the celebration view', async () => {
    render(<KidMyWorld kidToken={KID_TOKEN} displayName="Amina" />);
    await waitFor(() => expect(screen.getByTestId('kid-myworld-stats-tab')).toBeInTheDocument());

    await act(async () => {
      fireEvent.click(screen.getByTestId('kid-myworld-stats-tab'));
    });

    await waitFor(() => expect(screen.getByTestId('kid-stats')).toBeInTheDocument());
    expect(screen.getByText('Wow, Amina!')).toBeInTheDocument();
    expect(screen.getByText('What I Did This Week')).toBeInTheDocument();
    expect(screen.getByText('Stickers Earned')).toBeInTheDocument();
  });

  it('day cells expose role=img with full-day labels (FHS-377)', async () => {
    render(<KidMyWorld kidToken={KID_TOKEN} displayName="Amina" />);
    await waitFor(() => expect(screen.getByTestId('kid-habit-day-h1-0')).toBeInTheDocument());
    // h1 done Mon(0) + Tue(1); Wed(2) not done.
    const mon = screen.getByTestId('kid-habit-day-h1-0');
    expect(mon).toHaveAttribute('role', 'img');
    expect(mon).toHaveAttribute('aria-label', 'Read a book, Monday: done');
    expect(screen.getByTestId('kid-habit-day-h1-2')).toHaveAttribute(
      'aria-label',
      'Read a book, Wednesday: not done',
    );
  });

  it('arrow keys move + activate between the two tabs (FHS-377)', async () => {
    render(<KidMyWorld kidToken={KID_TOKEN} displayName="Amina" />);
    await waitFor(() => expect(screen.getByTestId('kid-myworld-habits-tab')).toBeInTheDocument());
    const habitsTab = screen.getByTestId('kid-myworld-habits-tab');
    const analyticsTab = screen.getByTestId('kid-myworld-stats-tab');
    // Roving tabindex: the selected tab is the single tab stop.
    expect(habitsTab).toHaveAttribute('tabindex', '0');
    expect(analyticsTab).toHaveAttribute('tabindex', '-1');
    await act(async () => {
      fireEvent.keyDown(habitsTab, { key: 'ArrowRight' });
    });
    await waitFor(() => expect(screen.getByTestId('kid-stats')).toBeInTheDocument());
    expect(analyticsTab).toHaveAttribute('aria-selected', 'true');
    expect(analyticsTab).toHaveAttribute('tabindex', '0');
    await act(async () => {
      fireEvent.keyDown(analyticsTab, { key: 'ArrowLeft' });
    });
    await waitFor(() => expect(habitsTab).toHaveAttribute('aria-selected', 'true'));
  });

  it('Stickers Earned sums weekly sticker totals, not completed days (FHS-377)', async () => {
    mockBoot({
      analytics: {
        stickersPerWeek: [
          {
            weekNumber: 23,
            year: 2026,
            startDate: '2026-06-08',
            totalStickers: 12,
            daysCompleted: 5,
            completionRate: 71,
          },
          {
            weekNumber: 24,
            year: 2026,
            startDate: '2026-06-15',
            totalStickers: 8,
            daysCompleted: 3,
            completionRate: 43,
          },
        ],
        habitStats: [
          {
            habitId: 'h1',
            name: 'Read a book',
            habitIcon: 'heart',
            totalDays: 7,
            completedDays: 4,
            rate: 57,
          },
        ],
      },
    });
    render(<KidMyWorld kidToken={KID_TOKEN} displayName="Amina" />);
    await waitFor(() => expect(screen.getByTestId('kid-myworld-stats-tab')).toBeInTheDocument());
    await act(async () => {
      fireEvent.click(screen.getByTestId('kid-myworld-stats-tab'));
    });
    await waitFor(() => expect(screen.getByTestId('kid-stats')).toBeInTheDocument());
    // 12 + 8 = 20, NOT habitStats.completedDays (4).
    const tile = screen.getByText('Stickers Earned').closest('div')!;
    expect(tile).toHaveTextContent('20');
  });

  it('shows a retry when a navigated week fails to load (FHS-377)', async () => {
    const w1 = { ...WEEK, id: 'w1', weekNumber: 23, startDate: '2026-06-08', isFinalized: true };
    const w2 = { ...WEEK, id: 'w2', weekNumber: 24, startDate: '2026-06-15', isFinalized: false };
    fetchMock.mockImplementation((url: string) => {
      const u = String(url);
      if (u.endsWith('/api/kid/weeks'))
        return Promise.resolve({ ok: true, status: 200, json: async () => ({ weeks: [w1, w2] }) });
      if (u.includes('/api/kid/habits')) {
        if (u.includes('weekId=w1'))
          return Promise.resolve({ ok: false, status: 500, json: async () => ({}) });
        return Promise.resolve({ ok: true, status: 200, json: async () => HABITS_BODY });
      }
      if (u.includes('/api/kid/financial/savings'))
        return Promise.resolve({
          ok: true,
          status: 200,
          json: async () => ({ savedStickers: 0, savedCash: 0, currency: 'AED' }),
        });
      if (u.includes('/api/kid/financial/investments'))
        return Promise.resolve({ ok: true, status: 200, json: async () => ({ investments: [] }) });
      if (u.endsWith('/api/kid/rewards'))
        return Promise.resolve({
          ok: true,
          status: 200,
          json: async () => ({ rewards: [], stickerBalance: 0 }),
        });
      if (u.includes('/api/kid/analytics'))
        return Promise.resolve({
          ok: true,
          status: 200,
          json: async () => ({ stickersPerWeek: [], habitStats: [] }),
        });
      return Promise.resolve({ ok: true, status: 200, json: async () => ({}) });
    });
    render(<KidMyWorld kidToken={KID_TOKEN} displayName="Amina" />);
    // Boot lands on the current week (w2); navigate back to the uncached w1.
    await waitFor(() => expect(screen.getByTestId('kid-week-prev')).toBeEnabled());
    await act(async () => {
      fireEvent.click(screen.getByTestId('kid-week-prev'));
    });
    await waitFor(() => expect(screen.getByTestId('kid-week-error')).toBeInTheDocument());
    expect(screen.getByTestId('kid-week-retry')).toBeInTheDocument();
  });

  // FHS-484 - a week can exist before its Monday (closing this week early
  // creates next week right away); it must read as locked, not "current".
  it('locks a future week: blurred habit cards + a "Not Started" badge (FHS-484)', async () => {
    // Default WEEK fixture starts Mon 2026-06-15; freeze "now" a week earlier
    // so it reads as not-yet-started.
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date('2026-06-08T10:00:00'));
    render(<KidMyWorld kidToken={KID_TOKEN} displayName="Amina" />);

    await waitFor(() => expect(screen.getByTestId('kid-myworld')).toBeInTheDocument());
    expect(screen.getByText('🔒 Not Started')).toBeInTheDocument();
    expect(screen.getByTestId('kid-future-week-banner')).toHaveTextContent(
      /This week hasn.t started yet/,
    );
    expect(screen.getByTestId('kid-future-week-lock')).toBeInTheDocument();
  });

  it('does not lock the live (current) week (FHS-484)', async () => {
    // Default mockBoot's WEEK fixture is not finalized and startDate is today
    // by construction of this test: real clock, no future date involved.
    render(<KidMyWorld kidToken={KID_TOKEN} displayName="Amina" />);
    await waitFor(() => expect(screen.getByTestId('kid-myworld')).toBeInTheDocument());
    expect(screen.queryByText('🔒 Not Started')).not.toBeInTheDocument();
    expect(screen.queryByTestId('kid-future-week-lock')).not.toBeInTheDocument();
  });

  // FHS-399 - finished-week single-column recap design

  // Shared helper: boots with a single finalized week + an actions stub.
  function mockFinalizedBoot(
    actionsBody: { actions: { actionType: string; stickersUsed: number }[] } | null = null,
    habitStickers = HABITS_BODY.stickers,
  ) {
    const finalizedWeek = { ...WEEK, isFinalized: true };
    fetchMock.mockImplementation((url: string) => {
      const u = String(url);
      if (u.endsWith('/api/kid/weeks'))
        return Promise.resolve({
          ok: true,
          status: 200,
          json: async () => ({ weeks: [finalizedWeek] }),
        });
      if (u.includes('/api/kid/habits'))
        return Promise.resolve({
          ok: true,
          status: 200,
          json: async () => ({ ...HABITS_BODY, stickers: habitStickers, week: finalizedWeek }),
        });
      if (u.includes('/api/kid/financial/savings'))
        return Promise.resolve({
          ok: true,
          status: 200,
          json: async () => ({
            savedStickers: 10,
            savedCash: 5,
            currency: 'AED',
            stickerRate: 0.5,
          }),
        });
      if (u.includes('/api/kid/financial/investments'))
        return Promise.resolve({ ok: true, status: 200, json: async () => ({ investments: [] }) });
      if (u.endsWith('/api/kid/rewards'))
        return Promise.resolve({
          ok: true,
          status: 200,
          json: async () => ({ rewards: [], stickerBalance: 8 }),
        });
      if (u.includes('/api/kid/analytics'))
        return Promise.resolve({
          ok: true,
          status: 200,
          json: async () => ({ stickersPerWeek: [], habitStats: [] }),
        });
      if (u.includes('/api/kid/weeks/') && u.includes('/actions'))
        return Promise.resolve({
          ok: actionsBody !== null,
          status: actionsBody !== null ? 200 : 500,
          json: async () => actionsBody ?? {},
        });
      return Promise.resolve({ ok: true, status: 200, json: async () => ({}) });
    });
  }

  it('live week: shows two-column layout (Money Skills + right sidebar present)', async () => {
    // Default mockBoot uses WEEK with isFinalized: false
    render(<KidMyWorld kidToken={KID_TOKEN} displayName="Amina" />);
    await waitFor(() => expect(screen.getByTestId('kid-myworld')).toBeInTheDocument());

    // Live banner visible
    expect(screen.getByText('How are you doing this week?')).toBeInTheDocument();
    // Money Skills present
    expect(screen.getByTestId('kid-moneyskills')).toBeInTheDocument();
    // Right sidebar present
    expect(screen.getByTestId('kid-reward-goals')).toBeInTheDocument();
    expect(screen.getByTestId('kid-my-account')).toBeInTheDocument();
    // Recap card NOT shown
    expect(screen.queryByTestId('kid-finished-week-recap')).not.toBeInTheDocument();
  });

  it('finalized week: shows the "What I Did That Week" recap card', async () => {
    // h1: 2 done days, h2: 1 done day -> earnedThisWeek = 3
    // actions: save=3 + auto_save=2 = 5 saved; invest=2 planted
    mockFinalizedBoot({
      actions: [
        { actionType: 'save', stickersUsed: 3 },
        { actionType: 'auto_save', stickersUsed: 2 },
        { actionType: 'invest', stickersUsed: 2 },
      ],
    });

    render(<KidMyWorld kidToken={KID_TOKEN} displayName="Amina" />);
    await waitFor(() => expect(screen.getByTestId('kid-finished-week-recap')).toBeInTheDocument());

    // Stars earned: 3 x AED 0.50 = 1.50
    const recap = screen.getByTestId('kid-finished-week-recap');
    expect(recap).toHaveTextContent(/What I Did That Week/);
    expect(screen.getByTestId('kid-recap-stars-earned')).toHaveTextContent('3');
    expect(screen.getByTestId('kid-recap-stars-earned')).toHaveTextContent('AED 1.50');

    // Saved + Planted rows
    await waitFor(() => expect(screen.getByTestId('kid-recap-saved-stars')).toBeInTheDocument());
    expect(screen.getByTestId('kid-recap-saved-stars')).toHaveTextContent('Saved 5 stars');
    expect(screen.getByTestId('kid-recap-planted-stars')).toHaveTextContent('Planted 2 stars');

    // Completion: 3 done / 14 total = 21% -> gentle message
    expect(screen.getByTestId('kid-recap-completion-pct')).toHaveTextContent('21%');
    expect(screen.getByTestId('kid-recap-completion-message')).toHaveTextContent(
      /how this week went/,
    );
  });

  it('finalized week: hides Money Skills, reward shop, and My Account', async () => {
    mockFinalizedBoot({ actions: [] });

    render(<KidMyWorld kidToken={KID_TOKEN} displayName="Amina" />);
    await waitFor(() => expect(screen.getByTestId('kid-finished-week-recap')).toBeInTheDocument());

    expect(screen.queryByTestId('kid-moneyskills')).not.toBeInTheDocument();
    expect(screen.queryByTestId('kid-reward-goals')).not.toBeInTheDocument();
    expect(screen.queryByTestId('kid-my-account')).not.toBeInTheDocument();
  });

  it('finalized week: also shows the finished-week banner above the habits', async () => {
    mockFinalizedBoot({ actions: [] });

    render(<KidMyWorld kidToken={KID_TOKEN} displayName="Amina" />);
    await waitFor(() => expect(screen.getByTestId('kid-finished-week-banner')).toBeInTheDocument());
    expect(screen.getByTestId('kid-finished-week-banner')).toHaveTextContent(
      /looking at a finished week/,
    );
    expect(screen.queryByText('How are you doing this week?')).not.toBeInTheDocument();
  });

  it('finalized week: celebratory completion message when >= 50%', async () => {
    // Give h1 + h2 each 4 done days -> 8/14 = 57%
    const richStickers = [
      ...Array.from({ length: 4 }, (_, d) => ({
        habitId: 'h1',
        day: d,
        sticker: 'gold-star',
        stickerValue: 1,
      })),
      ...Array.from({ length: 4 }, (_, d) => ({
        habitId: 'h2',
        day: d,
        sticker: 'gold-star',
        stickerValue: 1,
      })),
    ];
    mockFinalizedBoot({ actions: [] }, richStickers);

    render(<KidMyWorld kidToken={KID_TOKEN} displayName="Amina" />);
    await waitFor(() => expect(screen.getByTestId('kid-recap-completion')).toBeInTheDocument());
    expect(screen.getByTestId('kid-recap-completion-pct')).toHaveTextContent('57%');
    expect(screen.getByTestId('kid-recap-completion-message')).toHaveTextContent(/Great job/);
  });

  // FHS-617: an `invest_continue` carries the WHOLE value of an investment
  // that keeps running, not stickers newly planted. Counting it told the child
  // they planted the same stars again every week the investment rolled on.
  it('finalized week: a rolled-over investment is not counted as newly planted', async () => {
    mockFinalizedBoot({
      actions: [
        { actionType: 'invest', stickersUsed: 1 },
        { actionType: 'invest_continue', stickersUsed: 3 },
      ],
    });

    render(<KidMyWorld kidToken={KID_TOKEN} displayName="Amina" />);
    await waitFor(() => expect(screen.getByTestId('kid-recap-planted-stars')).toBeInTheDocument());
    expect(screen.getByTestId('kid-recap-planted-stars')).toHaveTextContent('Planted 1 star');
    // No save actions and carriedOverStickers = 0 -> no Saved row
    expect(screen.queryByTestId('kid-recap-saved-stars')).not.toBeInTheDocument();
  });

  it('finalized week: a carry-in from the previous week is not shown as saved', async () => {
    // carriedOverStickers = 7 (override WEEK fixture)
    const weekWithCarry = { ...WEEK, isFinalized: true, carriedOverStickers: 7 };
    fetchMock.mockImplementation((url: string) => {
      const u = String(url);
      if (u.endsWith('/api/kid/weeks'))
        return Promise.resolve({
          ok: true,
          status: 200,
          json: async () => ({ weeks: [weekWithCarry] }),
        });
      if (u.includes('/api/kid/habits'))
        return Promise.resolve({
          ok: true,
          status: 200,
          json: async () => ({ ...HABITS_BODY, week: weekWithCarry }),
        });
      if (u.includes('/api/kid/financial/savings'))
        return Promise.resolve({
          ok: true,
          status: 200,
          json: async () => ({ savedStickers: 0, savedCash: 0, currency: 'AED', stickerRate: 0.5 }),
        });
      if (u.includes('/api/kid/financial/investments'))
        return Promise.resolve({ ok: true, status: 200, json: async () => ({ investments: [] }) });
      if (u.endsWith('/api/kid/rewards'))
        return Promise.resolve({
          ok: true,
          status: 200,
          json: async () => ({ rewards: [], stickerBalance: 0 }),
        });
      if (u.includes('/api/kid/analytics'))
        return Promise.resolve({
          ok: true,
          status: 200,
          json: async () => ({ stickersPerWeek: [], habitStats: [] }),
        });
      if (u.includes('/api/kid/weeks/') && u.includes('/actions'))
        return Promise.resolve({
          ok: true,
          status: 200,
          // no save or invest actions - only a spend-type action
          json: async () => ({ actions: [{ actionType: 'spend', stickersUsed: 1 }] }),
        });
      return Promise.resolve({ ok: true, status: 200, json: async () => ({}) });
    });

    render(<KidMyWorld kidToken={KID_TOKEN} displayName="Amina" />);
    await waitFor(() => expect(screen.getByTestId('kid-finished-week-recap')).toBeInTheDocument());
    // FHS-608: carriedOverStickers is what came INTO this week from the last
    // close, not what this week saved, so it is no longer shown as "Saved".
    expect(screen.queryByTestId('kid-recap-saved-stars')).not.toBeInTheDocument();
  });

  it('finalized week: actions-fetch failure degrades gracefully (stars + % still show)', async () => {
    // null -> actionsBody null -> ok: false (500)
    mockFinalizedBoot(null);

    render(<KidMyWorld kidToken={KID_TOKEN} displayName="Amina" />);
    await waitFor(() => expect(screen.getByTestId('kid-finished-week-recap')).toBeInTheDocument());

    // Stars earned still visible
    expect(screen.getByTestId('kid-recap-stars-earned')).toHaveTextContent('3');
    // Completion % still visible
    await waitFor(() => expect(screen.getByTestId('kid-recap-completion')).toBeInTheDocument());
    expect(screen.getByTestId('kid-recap-completion-pct')).toBeInTheDocument();
    // Allocation section shows the error fallback text
    await waitFor(() =>
      expect(screen.getByTestId('kid-recap-stars-allocation')).toBeInTheDocument(),
    );
    expect(screen.getByTestId('kid-recap-stars-allocation')).toHaveTextContent(
      /Couldn.t load star details/,
    );
    // No individual saved/planted rows
    expect(screen.queryByTestId('kid-recap-saved-stars')).not.toBeInTheDocument();
    expect(screen.queryByTestId('kid-recap-planted-stars')).not.toBeInTheDocument();
  });

  it('live week: Money Skills shows forward-looking copy', async () => {
    // Default mockBoot -> current week, isFinalized: false
    render(<KidMyWorld kidToken={KID_TOKEN} displayName="Amina" />);
    await waitFor(() => expect(screen.getByTestId('kid-moneyskills')).toBeInTheDocument());
    const ms = screen.getByTestId('kid-moneyskills');
    expect(ms).toHaveTextContent('What will you do with them?');
    expect(ms).not.toHaveTextContent(/what you did with your stars this week/);
    expect(ms).toHaveTextContent('Spend Now');
    expect(ms).toHaveTextContent('Save Up');
    expect(ms).toHaveTextContent('Grow (Invest)');
  });

  it('shows an error state and can retry', async () => {
    fetchMock.mockImplementation((url: string) => {
      const u = String(url);
      if (u.endsWith('/api/kid/weeks')) {
        return Promise.resolve({ ok: false, status: 500, json: async () => ({}) });
      }
      return Promise.resolve({ ok: true, status: 200, json: async () => ({}) });
    });
    render(<KidMyWorld kidToken={KID_TOKEN} displayName="Amina" />);
    await waitFor(() => expect(screen.getByTestId('kid-myworld-error')).toBeInTheDocument());
  });

  it('shows a gentle empty state when there are no habits', async () => {
    mockBoot({
      habits: {
        habits: [],
        stickers: [],
        week: { id: 'w1', weekNumber: 24, year: 2026, startDate: '2026-06-15', isFinalized: false },
        balance: 0,
        currency: 'AED',
      },
    });
    render(<KidMyWorld kidToken={KID_TOKEN} displayName="Amina" />);
    await waitFor(() => expect(screen.getByTestId('kid-myworld')).toBeInTheDocument());
    expect(screen.getByText(/No habits yet/)).toBeInTheDocument();
  });

  // FHS-387 - cash values and the "worth" label derive from the API stickerRate,
  // never from a hardcoded 0.5.
  it('uses the API stickerRate to compute weekly value and "worth" label', async () => {
    // stickerRate = 1.0 -> each star is worth 1 AED.
    // earnedThisWeek = 3 (h1:2 + h2:1), weeklyValue = 3 * 1.0 = "3.00".
    mockBoot({
      savings: { savedStickers: 10, savedCash: 5, currency: 'AED', stickerRate: 1.0 },
    });
    render(<KidMyWorld kidToken={KID_TOKEN} displayName="Amina" />);

    await waitFor(() => expect(screen.getByTestId('kid-my-account')).toBeInTheDocument());

    // weeklyValue: 3 x 1.0 = "3.00"
    expect(screen.getByTestId('kid-account-cash')).toHaveTextContent('AED 3.00');
    // "worth" label: "Each star is worth AED 1.00"
    expect(screen.getByText(/Each star is worth AED 1\.00/)).toBeInTheDocument();
  });

  // FHS-399 QA regression: layout restoration + week-switch clearing

  it('navigating from a finalized week back to the live week restores the two-column layout', async () => {
    // Two weeks: w1=finalized (older), w2=live (current). Boot lands on w2.
    const w1 = { ...WEEK, id: 'w1', weekNumber: 23, startDate: '2026-06-08', isFinalized: true };
    const w2 = { ...WEEK, id: 'w2', weekNumber: 24, startDate: '2026-06-15', isFinalized: false };
    fetchMock.mockImplementation((url: string) => {
      const u = String(url);
      if (u.endsWith('/api/kid/weeks'))
        return Promise.resolve({
          ok: true,
          status: 200,
          json: async () => ({ weeks: [w1, w2] }),
        });
      if (u.includes('/api/kid/habits'))
        return Promise.resolve({
          ok: true,
          status: 200,
          json: async () =>
            u.includes('weekId=w1') ? { ...HABITS_BODY, week: w1 } : { ...HABITS_BODY, week: w2 },
        });
      if (u.includes('/api/kid/financial/savings'))
        return Promise.resolve({
          ok: true,
          status: 200,
          json: async () => ({ savedStickers: 5, savedCash: 0, currency: 'AED', stickerRate: 0.5 }),
        });
      if (u.includes('/api/kid/financial/investments'))
        return Promise.resolve({ ok: true, status: 200, json: async () => ({ investments: [] }) });
      if (u.endsWith('/api/kid/rewards'))
        return Promise.resolve({
          ok: true,
          status: 200,
          json: async () => ({ rewards: [], stickerBalance: 5 }),
        });
      if (u.includes('/api/kid/analytics'))
        return Promise.resolve({
          ok: true,
          status: 200,
          json: async () => ({ stickersPerWeek: [], habitStats: [] }),
        });
      if (u.includes('/api/kid/weeks/') && u.includes('/actions'))
        return Promise.resolve({
          ok: true,
          status: 200,
          json: async () => ({ actions: [] }),
        });
      return Promise.resolve({ ok: true, status: 200, json: async () => ({}) });
    });

    render(<KidMyWorld kidToken={KID_TOKEN} displayName="Amina" />);

    // Boot lands on live week -> two-column layout present
    await waitFor(() => expect(screen.getByTestId('kid-myworld')).toBeInTheDocument());
    expect(screen.getByTestId('kid-moneyskills')).toBeInTheDocument();
    expect(screen.getByTestId('kid-reward-goals')).toBeInTheDocument();
    expect(screen.getByTestId('kid-my-account')).toBeInTheDocument();

    // Navigate back to the finalized week
    await act(async () => {
      fireEvent.click(screen.getByTestId('kid-week-prev'));
    });
    await waitFor(() => expect(screen.getByTestId('kid-finished-week-recap')).toBeInTheDocument());
    expect(screen.queryByTestId('kid-moneyskills')).not.toBeInTheDocument();
    expect(screen.queryByTestId('kid-reward-goals')).not.toBeInTheDocument();
    expect(screen.queryByTestId('kid-my-account')).not.toBeInTheDocument();

    // Navigate forward back to the live week -> two-column layout restored
    await act(async () => {
      fireEvent.click(screen.getByTestId('kid-week-next'));
    });
    await waitFor(() => expect(screen.getByTestId('kid-moneyskills')).toBeInTheDocument());
    expect(screen.getByTestId('kid-reward-goals')).toBeInTheDocument();
    expect(screen.getByTestId('kid-my-account')).toBeInTheDocument();
    expect(screen.queryByTestId('kid-finished-week-recap')).not.toBeInTheDocument();
  });

  it('switching between two finalized weeks clears stale Saved/Planted rows', async () => {
    // w1 has save actions; w2 has invest actions only.
    const w1 = { ...WEEK, id: 'w1', weekNumber: 22, startDate: '2026-06-01', isFinalized: true };
    const w2 = { ...WEEK, id: 'w2', weekNumber: 23, startDate: '2026-06-08', isFinalized: true };
    fetchMock.mockImplementation((url: string) => {
      const u = String(url);
      if (u.endsWith('/api/kid/weeks'))
        return Promise.resolve({
          ok: true,
          status: 200,
          json: async () => ({ weeks: [w1, w2] }),
        });
      if (u.includes('/api/kid/habits'))
        return Promise.resolve({
          ok: true,
          status: 200,
          json: async () =>
            u.includes('weekId=w1') ? { ...HABITS_BODY, week: w1 } : { ...HABITS_BODY, week: w2 },
        });
      if (u.includes('/api/kid/financial/savings'))
        return Promise.resolve({
          ok: true,
          status: 200,
          json: async () => ({ savedStickers: 5, savedCash: 0, currency: 'AED', stickerRate: 0.5 }),
        });
      if (u.includes('/api/kid/financial/investments'))
        return Promise.resolve({ ok: true, status: 200, json: async () => ({ investments: [] }) });
      if (u.endsWith('/api/kid/rewards'))
        return Promise.resolve({
          ok: true,
          status: 200,
          json: async () => ({ rewards: [], stickerBalance: 0 }),
        });
      if (u.includes('/api/kid/analytics'))
        return Promise.resolve({
          ok: true,
          status: 200,
          json: async () => ({ stickersPerWeek: [], habitStats: [] }),
        });
      if (u.includes('/api/kid/weeks/w1/actions'))
        return Promise.resolve({
          ok: true,
          status: 200,
          json: async () => ({ actions: [{ actionType: 'save', stickersUsed: 4 }] }),
        });
      if (u.includes('/api/kid/weeks/w2/actions'))
        return Promise.resolve({
          ok: true,
          status: 200,
          json: async () => ({ actions: [{ actionType: 'invest', stickersUsed: 3 }] }),
        });
      return Promise.resolve({ ok: true, status: 200, json: async () => ({}) });
    });

    render(<KidMyWorld kidToken={KID_TOKEN} displayName="Amina" />);

    // Boot lands on w2 (last finalized = highest index); shows Planted, no Saved
    await waitFor(() => expect(screen.getByTestId('kid-recap-planted-stars')).toBeInTheDocument());
    expect(screen.queryByTestId('kid-recap-saved-stars')).not.toBeInTheDocument();

    // Navigate to w1 -> should show Saved, no Planted
    await act(async () => {
      fireEvent.click(screen.getByTestId('kid-week-prev'));
    });
    // Allocation area clears (loading) then shows the new week's data
    await waitFor(() => expect(screen.getByTestId('kid-recap-saved-stars')).toBeInTheDocument());
    expect(screen.queryByTestId('kid-recap-planted-stars')).not.toBeInTheDocument();
  });
});
