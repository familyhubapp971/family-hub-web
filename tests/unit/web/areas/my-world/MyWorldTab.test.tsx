import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor, fireEvent, act, within } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';

// FHS-293: My World habit tracker (faithful legacy port): week navigator,
// Weekly Habits / Analytics tabs, habit cards with the day → sticker
// dialog, add/edit/delete habit, and the rewards shop.

const fetchMock = vi.fn();
const authState: { session: { access_token?: string } | null } = {
  session: { access_token: 'tok-abc' },
};
vi.mock('../../../../../src/app/lib/auth-context', () => ({ useAuth: () => authState }));

import { MyWorldTab } from '../../../../../src/areas/my-world/MyWorldTab';
import { TenantProvider } from '../../../../../src/app/lib/tenant-context';

const MEMBER = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc';
const HABIT = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const REWARD = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const WEEK = 'dddddddd-dddd-4ddd-8ddd-dddddddddddd';

interface St {
  weeks: Array<Record<string, unknown>>;
  habits: Array<{
    id: string;
    name: string;
    description: string | null;
    color: string;
    icon: string | null;
    isBonus: boolean;
  }>;
  stickers: Array<{ habitId: string; day: number; sticker: string; stickerValue: number }>;
  balance: number;
  savedStickers: number;
  savedCash: number;
  earnedLastWeekStickers?: number;
  unallocated: number;
  stickerRate: number;
  rewards: Array<{
    id: string;
    name: string;
    description: string | null;
    stickerCost: number;
    icon: string | null;
  }>;
}

function installApi(over: Partial<St> = {}) {
  const state: St = {
    weeks: over.weeks ?? [
      {
        id: WEEK,
        weekNumber: 9,
        year: 2026,
        startDate: '2026-02-23',
        isFinalized: false,
        carriedOverStickers: 0,
        carriedOverCash: 0,
        retrievedStickers: 0,
        retrievedCash: 0,
      },
    ],
    habits: over.habits ?? [
      {
        id: HABIT,
        name: 'Brush teeth',
        description: null,
        color: 'bg-yellow-400',
        icon: 'star',
        isBonus: false,
      },
    ],
    stickers: over.stickers ?? [],
    balance: over.balance ?? 0,
    earnedLastWeekStickers: over.earnedLastWeekStickers,
    savedStickers: over.savedStickers ?? 0,
    savedCash: over.savedCash ?? 0,
    unallocated: over.unallocated ?? 0,
    stickerRate: over.stickerRate ?? 0.5,
    rewards: over.rewards ?? [
      { id: REWARD, name: 'Ice cream', description: null, stickerCost: 2, icon: '🍦' },
    ],
  };
  fetchMock.mockImplementation((url: string, init?: RequestInit) => {
    const u = String(url);
    if (init?.method === 'POST' && u.includes('/stickers')) {
      const b = JSON.parse(init.body as string) as { day: number; sticker: string };
      return Promise.resolve({
        ok: true,
        status: 200,
        json: async () => ({ habitId: HABIT, ...b, stickerValue: 1 }),
      });
    }
    if (init?.method === 'DELETE' && u.includes('/stickers')) {
      return Promise.resolve({ ok: true, status: 204, json: async () => ({}) });
    }
    if (init?.method === 'POST' && /\/api\/habits$/.test(u)) {
      // The real endpoint returns the created habit object DIRECTLY (not wrapped).
      const b = JSON.parse(init.body as string) as { name: string; color?: string; icon?: string };
      return Promise.resolve({
        ok: true,
        status: 201,
        json: async () => ({
          id: 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee',
          name: b.name,
          description: null,
          color: b.color ?? 'bg-yellow-400',
          icon: b.icon ?? 'star',
          isBonus: false,
        }),
      });
    }
    if (init?.method === 'POST' && u.includes('/redeem')) {
      state.balance -= state.rewards[0]!.stickerCost;
      return Promise.resolve({
        ok: true,
        status: 201,
        json: async () => ({ stickerBalance: state.balance, redemptionId: 'r1' }),
      });
    }
    // FHS-392: RewardRequestsPanel in the sidebar calls this endpoint.
    if (u.includes('/api/mw/redemption-requests')) {
      return Promise.resolve({
        ok: true,
        status: 200,
        json: async () => ({ requests: [] }),
      });
    }
    if (u.includes('/api/members')) {
      return Promise.resolve({
        ok: true,
        status: 200,
        json: async () => ({ callerRole: 'admin' }),
      });
    }
    if (u.includes('/api/mw/financial/savings')) {
      return Promise.resolve({
        ok: true,
        status: 200,
        json: async () => ({
          savedStickers: state.savedStickers,
          savedCash: state.savedCash,
          // FHS-606: the server-derived split; the two always sum to the total.
          earnedLastWeekStickers: state.earnedLastWeekStickers ?? 0,
          keptFromEarlierStickers: state.savedStickers - (state.earnedLastWeekStickers ?? 0),
          currency: 'AED',
          stickerRate: state.stickerRate,
          stickerRateMinor: Math.round(state.stickerRate * 100),
        }),
      });
    }
    if (u.includes('/api/mw/weeks') && u.includes('/stats')) {
      return Promise.resolve({
        ok: true,
        status: 200,
        json: async () => ({
          weekId: WEEK,
          totalStickers: 0,
          unallocatedStickers: state.unallocated,
          allocatedStickers: 0,
          cashValue: state.unallocated * state.stickerRate,
        }),
      });
    }
    if (u.includes('/api/mw/analytics')) {
      return Promise.resolve({
        ok: true,
        status: 200,
        json: async () => ({ stickersPerWeek: [], habitStats: [] }),
      });
    }
    if (u.includes('/api/mw/weeks') && u.includes('/actions')) {
      return Promise.resolve({ ok: true, status: 200, json: async () => ({ actions: [] }) });
    }
    if (u.includes('/api/mw/weeks')) {
      return Promise.resolve({ ok: true, status: 200, json: async () => ({ weeks: state.weeks }) });
    }
    if (u.includes('/api/rewards')) {
      return Promise.resolve({
        ok: true,
        status: 200,
        json: async () => ({ rewards: state.rewards, stickerBalance: state.balance }),
      });
    }
    // GET /api/habits?weekId=
    return Promise.resolve({
      ok: true,
      status: 200,
      json: async () => ({
        habits: state.habits,
        stickers: state.stickers,
        week: { id: WEEK, weekNumber: 9, year: 2026, startDate: '2026-02-23', isFinalized: false },
        balance: state.balance,
      }),
    });
  });
  return state;
}

function renderTab(isAdmin = true) {
  return render(
    <MemoryRouter initialEntries={['/t/khan/child/' + MEMBER]}>
      <Routes>
        <Route
          path="/t/:slug/child/:memberId"
          element={
            <TenantProvider>
              <MyWorldTab memberId={MEMBER} isAdmin={isAdmin} />
            </TenantProvider>
          }
        />
      </Routes>
    </MemoryRouter>,
  );
}

beforeEach(() => {
  fetchMock.mockReset();
  vi.stubGlobal('fetch', fetchMock);
  authState.session = { access_token: 'tok-abc' };
});
afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe('<MyWorldTab /> (legacy habit tracker)', () => {
  it('renders the week navigator, summary, habit card + rewards balance', async () => {
    installApi({ balance: 3 });
    renderTab();
    await waitFor(() => expect(screen.getByTestId('my-world')).toBeInTheDocument());
    expect(screen.getByTestId('habit-tracker-week-label').textContent).toContain('Week 9, 2026');
    expect(screen.getByTestId('habit-tracker-total-display').textContent).toContain('0/7');
    expect(screen.getByTestId(`habit-card-title-${HABIT}`).textContent).toContain('Brush teeth');
    expect(screen.getByTestId(`habit-day-cell-${HABIT}-0`)).toBeInTheDocument();
    expect(screen.getByTestId('sticker-balance').textContent).toContain('3');
  });

  it('shows the no-data state when there are no weeks', async () => {
    installApi({ weeks: [] });
    renderTab();
    await waitFor(() => expect(screen.getByTestId('habit-tracker-no-data')).toBeInTheDocument());
  });

  it('switches to the Analytics tab', async () => {
    installApi();
    renderTab();
    await waitFor(() =>
      expect(screen.getByTestId('habit-tracker-tab-analytics')).toBeInTheDocument(),
    );
    act(() => {
      fireEvent.click(screen.getByTestId('habit-tracker-tab-analytics'));
    });
    // The Analytics sub-tab now renders the real AnalyticsView (FHS-298),
    // which loads then shows its summary + chart + leaderboard.
    await waitFor(() => expect(screen.getByTestId('analytics-view')).toBeInTheDocument());
  });

  it('placing a sticker via the day dialog POSTs the chosen type', async () => {
    installApi({ balance: 0 });
    renderTab();
    await waitFor(() =>
      expect(screen.getByTestId(`habit-day-cell-${HABIT}-0`)).toBeInTheDocument(),
    );
    act(() => {
      fireEvent.click(screen.getByTestId(`habit-day-cell-${HABIT}-0`));
    });
    await waitFor(() => expect(screen.getByTestId('habit-day-sticker-dialog')).toBeInTheDocument());
    await act(async () => {
      fireEvent.click(screen.getByTestId('habit-day-sticker-option-gold-star'));
    });
    const post = fetchMock.mock.calls.find(
      ([u, i]) => i?.method === 'POST' && String(u).includes('/stickers'),
    );
    expect(post).toBeDefined();
    expect(JSON.parse((post![1] as RequestInit).body as string)).toMatchObject({
      memberId: MEMBER,
      weekId: WEEK,
      day: 0,
      sticker: 'gold-star',
    });
    // Placing a sticker must refresh the dependent cards: investments are
    // re-fetched (once on mount + once after the change).
    await waitFor(() => {
      const invCalls = fetchMock.mock.calls.filter(([u]) =>
        String(u).includes('/api/mw/financial/investments'),
      ).length;
      expect(invCalls).toBeGreaterThanOrEqual(2);
    });
  });

  it('adds a habit via the add dialog', async () => {
    installApi();
    renderTab();
    await waitFor(() =>
      expect(screen.getByTestId('habit-tracker-add-habit-btn')).toBeInTheDocument(),
    );
    act(() => {
      fireEvent.click(screen.getByTestId('habit-tracker-add-habit-btn'));
    });
    await waitFor(() => expect(screen.getByTestId('habit-add-title-input')).toBeInTheDocument());
    act(() => {
      fireEvent.change(screen.getByTestId('habit-add-title-input'), {
        target: { value: 'Read a book' },
      });
    });
    await act(async () => {
      fireEvent.click(screen.getByTestId('habit-add-submit-btn'));
    });
    const post = fetchMock.mock.calls.find(
      ([u, i]) => i?.method === 'POST' && /\/api\/habits$/.test(String(u)),
    );
    expect(post).toBeDefined();
    expect(JSON.parse((post![1] as RequestInit).body as string)).toMatchObject({
      name: 'Read a book',
    });
    // The created habit must appear in the list (regression: the UI used to read
    // a wrongly-wrapped response, so the habit saved but never showed + the
    // dialog stayed open).
    await waitFor(() =>
      expect(
        screen.getByTestId('habit-card-title-eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee').textContent,
      ).toContain('Read a book'),
    );
    expect(screen.queryByTestId('habit-add-title-input')).toBeNull();
  });

  it('disables Buy when the balance is below the reward cost', async () => {
    installApi({ balance: 1 }); // reward costs 2
    renderTab();
    await waitFor(() => expect(screen.getByTestId(`reward-buy-${REWARD}`)).toBeDisabled());
  });

  it('shows the Your Savings + Bankable cards with the family currency', async () => {
    installApi({ savedStickers: 10, savedCash: 5, unallocated: 4 });
    renderTab();
    await waitFor(() => expect(screen.getByTestId('your-savings')).toBeInTheDocument());
    // Total value = 5 cash + 10*0.5 = 10.00, in AED
    expect(screen.getByTestId('your-savings').textContent).toContain('AED');
    expect(screen.getByTestId('bankable-week')).toBeInTheDocument();
  });

  // FHS-512: the total-value conversion must use THIS child's configured
  // rate (from GET /mw/financial/savings), never a hardcoded 0.5. A rate of
  // 0.5 would show 10.00; the configured 1.25 rate must show 17.50.
  it('Your Savings total value uses the configured sticker rate, not a hardcoded 0.5', async () => {
    installApi({ savedStickers: 10, savedCash: 5, unallocated: 4, stickerRate: 1.25 });
    renderTab();
    await waitFor(() => expect(screen.getByTestId('your-savings')).toBeInTheDocument());
    // Total value = 5 cash + 10*1.25 = 17.50: NOT 10.00 (the old fixed-0.5 result).
    expect(screen.getByTestId('your-savings').textContent).toContain('17.50');
    expect(screen.getByTestId('your-savings').textContent).not.toContain('10.00');
  });

  it('hides live current-week widgets when viewing a finalised past week (FHS-316)', async () => {
    const PREV_WEEK = 'ffffffff-ffff-4fff-8fff-ffffffffffff';
    installApi({
      savedStickers: 10,
      savedCash: 5,
      weeks: [
        {
          id: PREV_WEEK,
          weekNumber: 8,
          year: 2026,
          startDate: '2026-02-16',
          isFinalized: true,
          carriedOverStickers: 0,
          carriedOverCash: 0,
          retrievedStickers: 0,
          retrievedCash: 0,
        },
        {
          id: WEEK,
          weekNumber: 9,
          year: 2026,
          startDate: '2026-02-23',
          isFinalized: false,
          carriedOverStickers: 0,
          carriedOverCash: 0,
          retrievedStickers: 0,
          retrievedCash: 0,
        },
      ],
    });
    renderTab();
    // Current week: all the live widgets are present.
    await waitFor(() => expect(screen.getByTestId('rewards-shop')).toBeInTheDocument());
    expect(screen.getByTestId('bankable-week')).toBeInTheDocument();
    expect(screen.getByTestId('your-savings')).toBeInTheDocument();

    // Navigate back to the finalised week.
    await act(async () => {
      fireEvent.click(screen.getByTestId('habit-tracker-week-prev-btn'));
    });

    // Live current-week-only widgets are gone…
    await waitFor(() => expect(screen.queryByTestId('rewards-shop')).not.toBeInTheDocument());
    expect(screen.queryByTestId('bankable-week')).not.toBeInTheDocument();
    expect(screen.queryByTestId('your-savings')).not.toBeInTheDocument();
    expect(screen.queryByTestId('active-investments')).not.toBeInTheDocument();
    // …but the week record itself still renders.
    expect(screen.getByTestId('habit-tracker-week-label')).toBeInTheDocument();
  });

  it('redeeming an affordable reward updates the balance', async () => {
    installApi({ balance: 5 });
    renderTab();
    await waitFor(() => expect(screen.getByTestId(`reward-buy-${REWARD}`)).toBeEnabled());
    await act(async () => {
      fireEvent.click(screen.getByTestId(`reward-buy-${REWARD}`));
    });
    // reward costs 2 → 5 - 2 = 3
    await waitFor(() => expect(screen.getByTestId('sticker-balance').textContent).toContain('3'));
  });

  it('shows the deductible tag on an active investment and an admin can flip it (FHS-378)', async () => {
    installApi();
    const base = fetchMock.getMockImplementation()!;
    const settingsCalls: string[] = [];
    fetchMock.mockImplementation((url: string, init?: RequestInit) => {
      const u = String(url);
      if (u.includes('/api/mw/financial/investments/') && u.includes('/settings')) {
        settingsCalls.push(u);
        return Promise.resolve({ ok: true, status: 200, json: async () => ({ id: 'inv1' }) });
      }
      if (u.includes('/api/mw/financial/investments')) {
        return Promise.resolve({
          ok: true,
          status: 200,
          json: async () => ({
            investments: [
              {
                id: 'inv1',
                habitId: HABIT,
                habitName: 'Read a book',
                habitIcon: 'star',
                investedStickers: 10,
                originalInvestedStickers: 10,
                currentValue: 5,
                currentValueStickers: 10,
                daysCompleted: 2,
                daysMissed: 1,
                deductible: false,
              },
            ],
          }),
        });
      }
      return base(url, init);
    });
    renderTab(true);
    await waitFor(() => expect(screen.getByTestId('investment-card-inv1')).toBeInTheDocument());
    // FHS-607: the row is one compact line until it is opened, so the kind tag
    // and the switch control live behind the row's own button.
    expect(screen.queryByTestId('investment-mode-inv1')).not.toBeInTheDocument();
    await act(async () => {
      fireEvent.click(screen.getByTestId('investment-row-inv1'));
    });
    expect(screen.getByTestId('investment-mode-inv1')).toHaveTextContent('No penalty');
    // FHS-406: the invested habit shows its "Invested · 5x" tag (now in-flow
    // above the day grid instead of an absolute badge that overlapped the cells).
    // FHS-534: this investment has no `coefficient` field (legacy record),
    // so the badge falls back to the historical default of 5x.
    expect(screen.getByTestId(`habit-card-invested-badge-${HABIT}`)).toHaveTextContent('5x');
    await act(async () => {
      fireEvent.click(screen.getByTestId('investment-toggle-inv1'));
    });
    await waitFor(() => expect(settingsCalls.length).toBe(1));
    expect(settingsCalls[0]).toContain('/api/mw/financial/investments/inv1/settings');
  });

  it('shows the investment\'s real coefficient on the "Invested · Nx" badge (FHS-534)', async () => {
    installApi();
    const base = fetchMock.getMockImplementation()!;
    fetchMock.mockImplementation((url: string, init?: RequestInit) => {
      const u = String(url);
      if (u.includes('/api/mw/financial/investments')) {
        return Promise.resolve({
          ok: true,
          status: 200,
          json: async () => ({
            investments: [
              {
                id: 'inv1',
                habitId: HABIT,
                habitName: 'Brush teeth',
                habitIcon: 'star',
                investedStickers: 10,
                originalInvestedStickers: 10,
                currentValue: 5,
                currentValueStickers: 12,
                daysCompleted: 2,
                daysMissed: 0,
                deductible: true,
                coefficient: 3,
              },
            ],
          }),
        });
      }
      return base(url, init);
    });
    renderTab(true);
    await waitFor(() => expect(screen.getByTestId('investment-card-inv1')).toBeInTheDocument());
    // A coefficient-3 investment shows "3x", never the hardcoded "5x".
    expect(screen.getByTestId(`habit-card-invested-badge-${HABIT}`)).toHaveTextContent('3x');
    expect(screen.getByTestId(`habit-card-invested-badge-${HABIT}`)).not.toHaveTextContent('5x');
    // FHS-607: the tag also names the kind, not just the multiplier.
    expect(screen.getByTestId(`habit-card-invested-badge-${HABIT}`)).toHaveTextContent(
      'Deductible',
    );
  });

  // FHS-607: the design puts the tag under the habit name on phone and tablet
  // (where it cannot push the day circles) and in the card's right column from
  // desktop. Exactly one of the two shows at any width.
  it('places the habit tag under the name on small screens and right on desktop', async () => {
    installApi();
    const base = fetchMock.getMockImplementation()!;
    fetchMock.mockImplementation((url: string, init?: RequestInit) => {
      const u = String(url);
      if (u.includes('/api/mw/financial/investments')) {
        return Promise.resolve({
          ok: true,
          status: 200,
          json: async () => ({
            investments: [
              {
                id: 'inv1',
                habitId: HABIT,
                habitName: 'Brush teeth',
                habitIcon: 'star',
                investedStickers: 10,
                originalInvestedStickers: 10,
                currentValue: 5,
                currentValueStickers: 12,
                daysCompleted: 2,
                daysMissed: 0,
                deductible: false,
                coefficient: 3,
              },
            ],
          }),
        });
      }
      return base(url, init);
    });
    renderTab(true);
    await waitFor(() =>
      expect(screen.getByTestId(`habit-card-invested-badge-${HABIT}`)).toBeInTheDocument(),
    );
    const small = screen.getByTestId(`habit-card-invested-badge-${HABIT}`).parentElement!;
    const large = screen.getByTestId(`habit-card-invested-badge-lg-${HABIT}`).parentElement!;
    expect(small.className).toContain('lg:hidden');
    expect(large.className).toContain('hidden');
    expect(large.className).toContain('lg:flex');
    // A habit with no investment gets no tag and no empty wrapper.
    expect(screen.queryByTestId('habit-card-invested-badge-no-such-habit')).not.toBeInTheDocument();
  });

  it('shows the Close Week banner only from the last day of the week (FHS-319)', async () => {
    // Default week starts Mon 2026-02-23 → its last day (Sunday) is 2026-03-01.
    // Fake only Date so async fetch/waitFor still run on real timers.
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date('2026-03-01T10:00:00')); // Sunday = last day
    installApi();
    renderTab();
    await waitFor(() =>
      expect(screen.getByTestId('my-world-close-week-banner')).toBeInTheDocument(),
    );
  });

  it('hides the Close Week banner mid-week (FHS-319)', async () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date('2026-02-25T10:00:00')); // Wednesday, within the week
    installApi();
    renderTab();
    await waitFor(() => expect(screen.getByTestId('habit-tracker-week-label')).toBeInTheDocument());
    expect(screen.queryByTestId('my-world-close-week-banner')).not.toBeInTheDocument();
  });

  it('hides the Close Week banner from a normal user even on the last day (FHS-336)', async () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date('2026-03-01T10:00:00')); // Sunday: admin would see the banner
    installApi();
    renderTab(false); // normal user (not admin)
    await waitFor(() => expect(screen.getByTestId('habit-tracker-week-label')).toBeInTheDocument());
    expect(screen.queryByTestId('my-world-close-week-banner')).not.toBeInTheDocument();
  });

  it('locks a week that has not started yet: blurred cards, disabled day cells, no edits (FHS-484)', async () => {
    // Default week fixture starts Mon 2026-02-23; freeze "now" a week earlier
    // so that week reads as a future week (e.g. this week was finalized early).
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date('2026-02-16T10:00:00'));
    installApi();
    renderTab();
    await waitFor(() => expect(screen.getByTestId('my-world')).toBeInTheDocument());

    expect(screen.getByTestId('habit-tracker-week-future-badge')).toHaveTextContent('Not Started');
    expect(screen.getByTestId('habit-tracker-future-week-lock')).toBeInTheDocument();
    expect(screen.getByTestId(`habit-day-cell-${HABIT}-0`)).toBeDisabled();

    // Clicking a locked day cell doesn't open the sticker picker.
    fireEvent.click(screen.getByTestId(`habit-day-cell-${HABIT}-0`));
    expect(screen.queryByTestId('habit-day-sticker-dialog')).not.toBeInTheDocument();

    // Admin-only "Add habit" affordance is hidden too: nothing is editable.
    expect(screen.queryByTestId('habit-tracker-add-habit-btn')).not.toBeInTheDocument();
  });

  it('does not lock the live (current) week (FHS-484)', async () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date('2026-02-25T10:00:00')); // Wednesday, within the week
    installApi();
    renderTab();
    await waitFor(() => expect(screen.getByTestId('my-world')).toBeInTheDocument());

    expect(screen.queryByTestId('habit-tracker-week-future-badge')).not.toBeInTheDocument();
    expect(screen.queryByTestId('habit-tracker-future-week-lock')).not.toBeInTheDocument();
    expect(screen.getByTestId(`habit-day-cell-${HABIT}-0`)).toBeEnabled();
  });

  it('hides Add Habit + per-habit edit/delete from a normal user (FHS-342)', async () => {
    installApi();
    renderTab(false); // normal user (not admin)
    await waitFor(() =>
      expect(screen.getByTestId(`habit-card-title-${HABIT}`)).toBeInTheDocument(),
    );
    expect(screen.queryByTestId('habit-tracker-add-habit-btn')).not.toBeInTheDocument();
    expect(screen.queryByTestId(`habit-card-edit-btn-${HABIT}`)).not.toBeInTheDocument();
    expect(screen.queryByTestId(`habit-card-delete-btn-${HABIT}`)).not.toBeInTheDocument();
  });

  it('shows Add Habit + edit/delete to an admin (FHS-342)', async () => {
    installApi();
    renderTab(true);
    await waitFor(() =>
      expect(screen.getByTestId('habit-tracker-add-habit-btn')).toBeInTheDocument(),
    );
    expect(screen.getByTestId(`habit-card-edit-btn-${HABIT}`)).toBeInTheDocument();
    expect(screen.getByTestId(`habit-card-delete-btn-${HABIT}`)).toBeInTheDocument();
  });

  it('add-habit with an empty name does not POST', async () => {
    installApi();
    renderTab();
    await waitFor(() =>
      expect(screen.getByTestId('habit-tracker-add-habit-btn')).toBeInTheDocument(),
    );
    act(() => {
      fireEvent.click(screen.getByTestId('habit-tracker-add-habit-btn'));
    });
    await waitFor(() => expect(screen.getByTestId('habit-add-title-input')).toBeInTheDocument());
    await act(async () => {
      fireEvent.click(screen.getByTestId('habit-add-submit-btn'));
    });
    expect(
      fetchMock.mock.calls.some(
        ([u, i]) => i?.method === 'POST' && /\/api\/habits$/.test(String(u)),
      ),
    ).toBe(false);
  });

  // FHS-392: Reward Requests sidebar in parent/admin mode
  it('renders the reward-requests sidebar for an admin parent (FHS-392)', async () => {
    installApi();
    renderTab(true /* isAdmin */);
    await waitFor(() => expect(screen.getByTestId('my-world')).toBeInTheDocument());
    // Sidebar section must be present for parent/admin
    expect(screen.getByTestId('reward-requests-sidebar')).toBeInTheDocument();
    // The panel itself renders inside (even empty-state is fine)
    expect(screen.getByTestId('reward-requests-panel')).toBeInTheDocument();
  });

  it('does NOT render the reward-requests sidebar in kid (readOnly) mode (FHS-392)', async () => {
    installApi();
    // Kid mode uses kidToken prop: readOnly=true suppresses the sidebar.
    // Kid API uses /api/kid/* paths so the data may not load, but the
    // sidebar guard fires before data (readOnly branch).
    render(
      <MemoryRouter initialEntries={['/t/khan/child/' + MEMBER]}>
        <Routes>
          <Route
            path="/t/:slug/child/:memberId"
            element={
              <TenantProvider>
                <MyWorldTab kidToken="kid.jwt.tok" />
              </TenantProvider>
            }
          />
        </Routes>
      </MemoryRouter>,
    );
    // Wait for the component to mount and settle (loading or no-data)
    await waitFor(() =>
      expect(
        screen.queryByTestId('habit-tracker-loading') ??
          screen.queryByTestId('habit-tracker-no-data') ??
          screen.queryByTestId('my-world'),
      ).toBeInTheDocument(),
    );
    // The sidebar must never appear in kid/readOnly mode
    expect(screen.queryByTestId('reward-requests-sidebar')).not.toBeInTheDocument();
  });

  it('reverts the cell when the sticker POST fails', async () => {
    installApi({ balance: 0 });
    const base = fetchMock.getMockImplementation()!;
    fetchMock.mockImplementation((url: string, init?: RequestInit) => {
      if (init?.method === 'POST' && String(url).includes('/stickers')) {
        return Promise.resolve({ ok: false, status: 500, json: async () => ({}) });
      }
      return base(url, init);
    });
    renderTab();
    await waitFor(() =>
      expect(screen.getByTestId(`habit-day-cell-${HABIT}-0`)).toBeInTheDocument(),
    );
    act(() => {
      fireEvent.click(screen.getByTestId(`habit-day-cell-${HABIT}-0`));
    });
    await waitFor(() => expect(screen.getByTestId('habit-day-sticker-dialog')).toBeInTheDocument());
    await act(async () => {
      fireEvent.click(screen.getByTestId('habit-day-sticker-option-gold-star'));
    });
    // POST failed → optimistic sticker reverts; cell ends up empty again.
    await waitFor(() =>
      expect(screen.getByTestId(`habit-day-cell-${HABIT}-0`).getAttribute('aria-pressed')).toBe(
        'false',
      ),
    );
  });

  // ── FHS-399: Finalized week kid view ────────────────────────────────────

  // Two-week setup: week 9 is the live current week (habits load at mount);
  // week 8 is finalized and lazy-loads when the user navigates back.
  // This mirrors the real app flow where actions are only fetched via the
  // lazy-load effect (which fires when habits.length === 0 for a non-active week).
  const FINALIZED_WEEK = 'ffffffff-ffff-4fff-8fff-ffffffffffff';

  // 5 stickers placed across days 0-4 on the finalized week
  const FINALIZED_STICKERS = [0, 1, 2, 3, 4].map((day) => ({
    habitId: HABIT,
    day,
    sticker: 'gold-star',
    stickerValue: 1,
  }));

  type TestAction = {
    id: number;
    weekId: string;
    actionType: string;
    stickersUsed: number | null;
    cashAmount: number | null;
    rewardName: string | null;
    habitId: string | null;
    habitName: string | null;
    createdAt: string;
  };

  const DEFAULT_FINALIZED_ACTIONS: TestAction[] = [
    {
      id: 1,
      weekId: FINALIZED_WEEK,
      actionType: 'save',
      stickersUsed: 3,
      cashAmount: 1.5,
      rewardName: null,
      habitId: null,
      habitName: null,
      createdAt: '2026-02-22T00:00:00Z',
    },
    {
      id: 2,
      weekId: FINALIZED_WEEK,
      actionType: 'invest',
      stickersUsed: 2,
      cashAmount: 1.0,
      rewardName: null,
      habitId: HABIT,
      habitName: 'Brush teeth',
      createdAt: '2026-02-22T00:00:00Z',
    },
  ];

  function installFinalizedWeekApi(actions: TestAction[] = DEFAULT_FINALIZED_ACTIONS) {
    // Base install: two weeks: week 8 finalized, week 9 current
    installApi({
      weeks: [
        {
          id: FINALIZED_WEEK,
          weekNumber: 8,
          year: 2026,
          startDate: '2026-02-16',
          isFinalized: true,
          carriedOverStickers: 3,
          carriedOverCash: 0,
          retrievedStickers: 0,
          retrievedCash: 0,
        },
        {
          id: WEEK,
          weekNumber: 9,
          year: 2026,
          startDate: '2026-02-23',
          isFinalized: false,
          carriedOverStickers: 0,
          carriedOverCash: 0,
          retrievedStickers: 0,
          retrievedCash: 0,
        },
      ],
    });

    // Extend the base mock to handle the finalized week's habits + actions
    const base = fetchMock.getMockImplementation()!;
    fetchMock.mockImplementation((url: string, init?: RequestInit) => {
      const u = String(url);
      // Finalized week actions
      if (u.includes('/api/mw/weeks') && u.includes(FINALIZED_WEEK) && u.includes('/actions')) {
        return Promise.resolve({
          ok: true,
          status: 200,
          json: async () => ({ actions }),
        });
      }
      // Habits for the finalized week: 5 stickers across days 0-4
      if (u.includes('/api/habits') && u.includes(FINALIZED_WEEK) && !init?.method) {
        return Promise.resolve({
          ok: true,
          status: 200,
          json: async () => ({
            habits: [
              {
                id: HABIT,
                name: 'Brush teeth',
                description: null,
                color: 'bg-yellow-400',
                icon: 'star',
                isBonus: false,
              },
            ],
            stickers: FINALIZED_STICKERS,
            balance: 5,
          }),
        });
      }
      return base(url, init);
    });
  }

  // Navigate to the finalized (previous) week and wait for it to load
  async function navigateToFinalizedWeek() {
    await waitFor(() =>
      expect(screen.getByTestId('habit-tracker-week-prev-btn')).toBeInTheDocument(),
    );
    await act(async () => {
      fireEvent.click(screen.getByTestId('habit-tracker-week-prev-btn'));
    });
    // Wait for the finalized week label to appear
    await waitFor(() =>
      expect(screen.getByTestId('habit-tracker-week-label').textContent).toContain('Week 8'),
    );
  }

  // FHS-608: the banner is parent-facing now. It used to carry the kid's
  // celebratory line, which is the wrong voice for this viewer.
  it('says plainly that a finished week is a record and cannot change', async () => {
    installFinalizedWeekApi();
    renderTab();
    await navigateToFinalizedWeek();
    await waitFor(() => expect(screen.getByTestId('finalized-week-banner')).toBeInTheDocument());
    const banner = screen.getByTestId('finalized-week-banner');
    expect(banner).toHaveTextContent('This week is finished');
    expect(banner).toHaveTextContent('Nothing here can be changed');
    // The heading over the cards says what they are.
    expect(screen.getByTestId('finalized-habits-heading')).toHaveTextContent('Habits that week');
  });

  it('FHS-399: shows the "What I Did That Week" summary card with stars + cash', async () => {
    installFinalizedWeekApi();
    renderTab();
    await navigateToFinalizedWeek();
    await waitFor(() => expect(screen.getByTestId('finalized-week-summary')).toBeInTheDocument());
    // Stars earned section: 5 stickers * 0.5 = 2.50
    const earned = screen.getByTestId('finalized-stars-earned');
    expect(earned.textContent).toContain('5');
    expect(earned.textContent).toContain('2.50');
  });

  // FHS-608: "where they went", read from the actions rather than inferred.
  it('splits the finished week into where the stickers went', async () => {
    installFinalizedWeekApi();
    renderTab();
    await navigateToFinalizedWeek();
    await waitFor(() =>
      expect(screen.getByTestId('finalized-stars-allocation')).toBeInTheDocument(),
    );
    // FHS-619: every line pairs its sticker count with its money value, at the
    // family's own rate (0.50 here), including the zero line.
    expect(screen.getByTestId('finalized-saved-stars')).toHaveTextContent(
      /Saved\s*3 stickers \(AED 1\.50\)/,
    );
    expect(screen.getByTestId('finalized-invested-stars')).toHaveTextContent(
      /Invested\s*2 stickers \(AED 1\.00\)/,
    );
    expect(screen.getByTestId('finalized-spent-stars')).toHaveTextContent(
      /Spent on rewards\s*0 stickers \(AED 0\.00\)/,
    );
    // Nothing was cashed out in this week, so that line stays off.
    expect(screen.queryByTestId('finalized-cashed-out-stars')).not.toBeInTheDocument();
  });

  // FHS-608: turning stickers into money is a real outcome the mock's sample
  // data never had. It only shows when it happened, and it is never folded
  // into "spent on rewards".
  it('shows a cashed-out line only when the week actually cashed out', async () => {
    installFinalizedWeekApi([
      {
        id: 1,
        weekId: FINALIZED_WEEK,
        actionType: 'save',
        stickersUsed: 2,
        cashAmount: 1.0,
        rewardName: null,
        habitId: null,
        habitName: null,
        createdAt: '2026-02-22T00:00:00Z',
      },
      {
        id: 2,
        weekId: FINALIZED_WEEK,
        actionType: 'cashout',
        stickersUsed: 4,
        cashAmount: 2.0,
        rewardName: null,
        habitId: null,
        habitName: null,
        createdAt: '2026-02-22T00:00:00Z',
      },
    ]);
    renderTab();
    await navigateToFinalizedWeek();
    await waitFor(() =>
      expect(screen.getByTestId('finalized-stars-allocation')).toBeInTheDocument(),
    );
    expect(screen.getByTestId('finalized-cashed-out-stars')).toHaveTextContent('Cashed out');
    expect(screen.getByTestId('finalized-cashed-out-stars')).toHaveTextContent('4 stickers');
    // Not double-counted as a reward.
    expect(screen.getByTestId('finalized-spent-stars')).toHaveTextContent('0 stickers');
  });

  // FHS-608: a bonus habit can ask for fewer than seven days. The week total
  // used to assume seven for every habit, so it disagreed with the habit's
  // own pill.
  it("counts the week out of each habit's own target, not seven each", async () => {
    installApi({
      habits: [
        {
          id: HABIT,
          name: 'Brush teeth',
          description: null,
          color: 'bg-yellow-400',
          icon: 'star',
          isBonus: false,
        },
        {
          id: 'habit-bonus',
          name: 'Extra reading',
          description: null,
          color: 'bg-cyan-400',
          icon: 'star',
          isBonus: true,
          target: 3,
        },
      ],
    });
    renderTab();
    await waitFor(() => expect(screen.getByTestId('bankable-week')).toBeInTheDocument());
    // 7 for the daily habit + 3 for the bonus one, never 14.
    const days = screen.getByTestId('week-days-done');
    expect(days).toHaveTextContent('of 10');
    expect(days).not.toHaveTextContent('of 14');
  });

  // FHS-608: the summary states the week plainly instead of praising it.
  it('states how much of the week was done, without praise', async () => {
    // Default fixture: 5 of 7 habit days = 71%.
    installFinalizedWeekApi();
    renderTab();
    await navigateToFinalizedWeek();
    await waitFor(() =>
      expect(screen.getByTestId('finalized-completion-message')).toBeInTheDocument(),
    );
    expect(screen.getByTestId('finalized-days-done')).toHaveTextContent('5 of 7');
    const message = screen.getByTestId('finalized-completion-message');
    expect(message).toHaveTextContent('71% of the week\u2019s habits were done.');
    expect(message).not.toHaveTextContent('Great job');
  });

  it('reads a week with nothing done as zero, with no split to draw', async () => {
    // Zero stickers on the finalized week → performance=0 from the lazy-load rebuild
    const base2 = fetchMock.getMockImplementation()!;
    // Call installApi first to set up the weeks array, then override habits for FINALIZED_WEEK
    installApi({
      weeks: [
        {
          id: FINALIZED_WEEK,
          weekNumber: 8,
          year: 2026,
          startDate: '2026-02-16',
          isFinalized: true,
          carriedOverStickers: 0,
          carriedOverCash: 0,
          retrievedStickers: 0,
          retrievedCash: 0,
        },
        {
          id: WEEK,
          weekNumber: 9,
          year: 2026,
          startDate: '2026-02-23',
          isFinalized: false,
          carriedOverStickers: 0,
          carriedOverCash: 0,
          retrievedStickers: 0,
          retrievedCash: 0,
        },
      ],
    });
    const base3 = fetchMock.getMockImplementation()!;
    fetchMock.mockImplementation((url: string, init?: RequestInit) => {
      const u = String(url);
      if (u.includes('/api/mw/weeks') && u.includes(FINALIZED_WEEK) && u.includes('/actions')) {
        return Promise.resolve({ ok: true, status: 200, json: async () => ({ actions: [] }) });
      }
      if (u.includes('/api/habits') && u.includes(FINALIZED_WEEK) && !init?.method) {
        return Promise.resolve({
          ok: true,
          status: 200,
          json: async () => ({
            habits: [
              {
                id: HABIT,
                name: 'Brush teeth',
                description: null,
                color: 'bg-yellow-400',
                icon: 'star',
                isBonus: false,
              },
            ],
            stickers: [], // zero stickers
            balance: 0,
          }),
        });
      }
      return base3(url, init);
    });
    void base2; // suppress unused warning
    renderTab();
    await navigateToFinalizedWeek();
    await waitFor(() =>
      expect(screen.getByTestId('finalized-completion-message')).toBeInTheDocument(),
    );
    expect(screen.getByTestId('finalized-days-done')).toHaveTextContent('0 of 7');
    expect(screen.getByTestId('finalized-completion-message')).toHaveTextContent(
      '0% of the week\u2019s habits were done.',
    );
    // Nothing happened, so there is no split to draw.
    expect(screen.queryByTestId('finalized-stars-allocation')).not.toBeInTheDocument();
  });

  it('FHS-399: each habit card shows PROGRESS THAT WEEK X/target on a finalized week', async () => {
    installFinalizedWeekApi();
    renderTab();
    await navigateToFinalizedWeek();
    await waitFor(() =>
      expect(screen.getByTestId(`habit-finalized-progress-${HABIT}`)).toBeInTheDocument(),
    );
    // 5 stickers / target=7 → "5/7"
    expect(screen.getByTestId(`habit-finalized-progress-${HABIT}`).textContent).toMatch(/5.*7/);
  });

  it('FHS-399 #1: bonus habit (target=3, 2 stickers) shows 2/3 in the pill', async () => {
    const BONUS_HABIT = 'bbbbbbbb-cccc-4bbb-8bbb-bbbbbbbbbbbc';
    installApi({
      weeks: [
        {
          id: FINALIZED_WEEK,
          weekNumber: 8,
          year: 2026,
          startDate: '2026-02-16',
          isFinalized: true,
          carriedOverStickers: 0,
          carriedOverCash: 0,
          retrievedStickers: 0,
          retrievedCash: 0,
        },
        {
          id: WEEK,
          weekNumber: 9,
          year: 2026,
          startDate: '2026-02-23',
          isFinalized: false,
          carriedOverStickers: 0,
          carriedOverCash: 0,
          retrievedStickers: 0,
          retrievedCash: 0,
        },
      ],
    });
    const baseB = fetchMock.getMockImplementation()!;
    fetchMock.mockImplementation((url: string, init?: RequestInit) => {
      const u = String(url);
      if (u.includes('/api/mw/weeks') && u.includes(FINALIZED_WEEK) && u.includes('/actions')) {
        return Promise.resolve({ ok: true, status: 200, json: async () => ({ actions: [] }) });
      }
      if (u.includes('/api/habits') && u.includes(FINALIZED_WEEK) && !init?.method) {
        return Promise.resolve({
          ok: true,
          status: 200,
          json: async () => ({
            habits: [
              {
                id: BONUS_HABIT,
                name: 'Bonus habit',
                description: null,
                color: 'bg-lime-400',
                icon: 'star',
                isBonus: true,
                target: 3, // bonus habit with lower target
              },
            ],
            stickers: [
              { habitId: BONUS_HABIT, day: 0, sticker: 'gold-star', stickerValue: 1 },
              { habitId: BONUS_HABIT, day: 1, sticker: 'gold-star', stickerValue: 1 },
            ],
            balance: 2,
          }),
        });
      }
      return baseB(url, init);
    });
    renderTab();
    await navigateToFinalizedWeek();
    await waitFor(() =>
      expect(screen.getByTestId(`habit-finalized-progress-${BONUS_HABIT}`)).toBeInTheDocument(),
    );
    // Must show 2/3, NOT 2/7
    const pill = screen.getByTestId(`habit-finalized-progress-${BONUS_HABIT}`);
    expect(pill.textContent).toContain('2/3');
    expect(pill.textContent).not.toContain('2/7');
  });

  it('FHS-399: day cells do not trigger a sticker POST on a finalized week (kid readOnly)', async () => {
    installFinalizedWeekApi();
    renderTab();
    await navigateToFinalizedWeek();
    await waitFor(() =>
      expect(screen.getByTestId(`habit-day-cell-${HABIT}-0`)).toBeInTheDocument(),
    );
    act(() => {
      fireEvent.click(screen.getByTestId(`habit-day-cell-${HABIT}-0`));
    });
    expect(screen.queryByTestId('habit-day-sticker-dialog')).not.toBeInTheDocument();
    expect(
      fetchMock.mock.calls.some(
        ([u, i]) => i?.method === 'POST' && String(u).includes('/stickers'),
      ),
    ).toBe(false);
  });

  it('FHS-399 #5: admin on a finalized week: clicking a cell fires no POST and opens no dialog', async () => {
    // Admins are also read-only on finalized weeks (canEdit=false when week.isFinalized)
    installFinalizedWeekApi();
    renderTab(true /* isAdmin */);
    await navigateToFinalizedWeek();
    await waitFor(() =>
      expect(screen.getByTestId(`habit-day-cell-${HABIT}-0`)).toBeInTheDocument(),
    );
    act(() => {
      fireEvent.click(screen.getByTestId(`habit-day-cell-${HABIT}-0`));
    });
    expect(screen.queryByTestId('habit-day-sticker-dialog')).not.toBeInTheDocument();
    expect(
      fetchMock.mock.calls.some(
        ([u, i]) => i?.method === 'POST' && String(u).includes('/stickers'),
      ),
    ).toBe(false);
  });

  it("does not report the previous week's carry-in as this week's savings", async () => {
    installApi({
      weeks: [
        {
          id: FINALIZED_WEEK,
          weekNumber: 8,
          year: 2026,
          startDate: '2026-02-16',
          isFinalized: true,
          carriedOverStickers: 5,
          carriedOverCash: 0,
          retrievedStickers: 0,
          retrievedCash: 0,
        },
        {
          id: WEEK,
          weekNumber: 9,
          year: 2026,
          startDate: '2026-02-23',
          isFinalized: false,
          carriedOverStickers: 0,
          carriedOverCash: 0,
          retrievedStickers: 0,
          retrievedCash: 0,
        },
      ],
    });
    const baseC = fetchMock.getMockImplementation()!;
    fetchMock.mockImplementation((url: string, init?: RequestInit) => {
      const u = String(url);
      if (u.includes('/api/mw/weeks') && u.includes(FINALIZED_WEEK) && u.includes('/actions')) {
        return Promise.resolve({ ok: true, status: 200, json: async () => ({ actions: [] }) });
      }
      if (u.includes('/api/habits') && u.includes(FINALIZED_WEEK) && !init?.method) {
        return Promise.resolve({
          ok: true,
          status: 200,
          json: async () => ({
            habits: [
              {
                id: HABIT,
                name: 'Brush teeth',
                description: null,
                color: 'bg-yellow-400',
                icon: 'star',
                isBonus: false,
              },
            ],
            stickers: FINALIZED_STICKERS,
            balance: 5,
          }),
        });
      }
      return baseC(url, init);
    });
    renderTab();
    await navigateToFinalizedWeek();
    await waitFor(() => expect(screen.getByTestId('finalized-week-summary')).toBeInTheDocument());
    // FHS-608: `carriedOver` is what came INTO this week from the previous
    // week's close, not what this week saved. Reporting it here put the same
    // stickers in two weeks and contradicted "Stickers earned: 0" above it.
    // With nothing recorded, there is simply no split to draw.
    expect(screen.queryByTestId('finalized-stars-allocation')).not.toBeInTheDocument();
    expect(screen.queryByTestId('finalized-saved-stars')).not.toBeInTheDocument();
  });

  it('FHS-399 #7: navigating across two finalized weeks updates finalized-stars-earned', async () => {
    // Three weeks: wk A (finalized, 3 stars), wk B (finalized, 7 stars), wk C (current, 0 stars)
    const WEEK_A = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaab';
    const WEEK_B = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbc0';
    installApi({
      weeks: [
        {
          id: WEEK_A,
          weekNumber: 7,
          year: 2026,
          startDate: '2026-02-09',
          isFinalized: true,
          carriedOverStickers: 0,
          carriedOverCash: 0,
          retrievedStickers: 0,
          retrievedCash: 0,
        },
        {
          id: WEEK_B,
          weekNumber: 8,
          year: 2026,
          startDate: '2026-02-16',
          isFinalized: true,
          carriedOverStickers: 0,
          carriedOverCash: 0,
          retrievedStickers: 0,
          retrievedCash: 0,
        },
        {
          id: WEEK,
          weekNumber: 9,
          year: 2026,
          startDate: '2026-02-23',
          isFinalized: false,
          carriedOverStickers: 0,
          carriedOverCash: 0,
          retrievedStickers: 0,
          retrievedCash: 0,
        },
      ],
    });
    const stickersA = [0, 1, 2].map((d) => ({
      habitId: HABIT,
      day: d,
      sticker: 'gold-star',
      stickerValue: 1,
    }));
    const stickersB = [0, 1, 2, 3, 4, 5, 6].map((d) => ({
      habitId: HABIT,
      day: d,
      sticker: 'gold-star',
      stickerValue: 1,
    }));
    const baseD = fetchMock.getMockImplementation()!;
    fetchMock.mockImplementation((url: string, init?: RequestInit) => {
      const u = String(url);
      // Actions for both finalized weeks
      if (u.includes('/api/mw/weeks') && u.includes('/actions')) {
        return Promise.resolve({ ok: true, status: 200, json: async () => ({ actions: [] }) });
      }
      // Habits for week A → 3 stickers
      if (u.includes('/api/habits') && u.includes(WEEK_A) && !init?.method) {
        return Promise.resolve({
          ok: true,
          status: 200,
          json: async () => ({
            habits: [
              {
                id: HABIT,
                name: 'Brush teeth',
                description: null,
                color: 'bg-yellow-400',
                icon: 'star',
                isBonus: false,
              },
            ],
            stickers: stickersA,
            balance: 3,
          }),
        });
      }
      // Habits for week B → 7 stickers
      if (u.includes('/api/habits') && u.includes(WEEK_B) && !init?.method) {
        return Promise.resolve({
          ok: true,
          status: 200,
          json: async () => ({
            habits: [
              {
                id: HABIT,
                name: 'Brush teeth',
                description: null,
                color: 'bg-yellow-400',
                icon: 'star',
                isBonus: false,
              },
            ],
            stickers: stickersB,
            balance: 7,
          }),
        });
      }
      return baseD(url, init);
    });
    renderTab();
    // Navigate to wk B (one back from current wk C)
    await waitFor(() =>
      expect(screen.getByTestId('habit-tracker-week-prev-btn')).toBeInTheDocument(),
    );
    await act(async () => {
      fireEvent.click(screen.getByTestId('habit-tracker-week-prev-btn'));
    });
    await waitFor(() =>
      expect(screen.getByTestId('habit-tracker-week-label').textContent).toContain('Week 8'),
    );
    await waitFor(() => expect(screen.getByTestId('finalized-stars-earned')).toBeInTheDocument());
    expect(screen.getByTestId('finalized-stars-earned').textContent).toContain('7');

    // Navigate to wk A (two back)
    await act(async () => {
      fireEvent.click(screen.getByTestId('habit-tracker-week-prev-btn'));
    });
    await waitFor(() =>
      expect(screen.getByTestId('habit-tracker-week-label').textContent).toContain('Week 7'),
    );
    await waitFor(() =>
      expect(screen.getByTestId('finalized-stars-earned').textContent).toContain('3'),
    );
    // Must not still show 7 (confirms the card updates per week)
    expect(screen.getByTestId('finalized-stars-earned').textContent).not.toContain('= AED 3.50');
    // 3 stars * 0.5 = 1.50
    expect(screen.getByTestId('finalized-stars-earned').textContent).toContain('1.50');
  });

  it('FHS-399: omits the planted section when only save actions were recorded', async () => {
    installFinalizedWeekApi([DEFAULT_FINALIZED_ACTIONS[0]!]);
    renderTab();
    await navigateToFinalizedWeek();
    await waitFor(() => expect(screen.getByTestId('finalized-week-summary')).toBeInTheDocument());
    await waitFor(() => expect(screen.getByTestId('finalized-saved-stars')).toBeInTheDocument());
    expect(screen.getByTestId('finalized-saved-stars')).toHaveTextContent('3 stickers');
    expect(screen.getByTestId('finalized-invested-stars')).toHaveTextContent('0 stickers');
  });

  // FHS-608: the live sidebar must not leak onto a finished week now that the
  // finished week has a sidebar of its own.
  it('keeps the live sidebar and money row off a finished week', async () => {
    installFinalizedWeekApi();
    renderTab();
    await navigateToFinalizedWeek();
    await waitFor(() => expect(screen.getByTestId('finalized-week-summary')).toBeInTheDocument());
    expect(screen.queryByTestId('reward-requests-sidebar')).not.toBeInTheDocument();
    expect(screen.queryByTestId('rewards-shop')).not.toBeInTheDocument();
    expect(screen.queryByTestId('money-row')).not.toBeInTheDocument();
    expect(screen.queryByTestId('bankable-week')).not.toBeInTheDocument();
  });
});

// ── FHS-606: the parent money row ────────────────────────────────────────────
describe('<MyWorldTab /> money row (FHS-606)', () => {
  it('lays Savings, Investments and This Week out as one row with the split', async () => {
    installApi({ savedStickers: 475, earnedLastWeekStickers: 240, unallocated: 15 });
    renderTab();
    await waitFor(() => expect(screen.getByTestId('money-row')).toBeInTheDocument());
    const row = screen.getByTestId('money-row');
    // Three cards inside one grid that goes 1 → 2 → 3 columns.
    expect(row.className).toContain('md:grid-cols-2');
    expect(row.className).toContain('xl:grid-cols-3');
    expect(within(row).getByTestId('your-savings')).toBeInTheDocument();
    expect(within(row).getByTestId('active-investments')).toBeInTheDocument();
    expect(within(row).getByTestId('bankable-week')).toBeInTheDocument();
    // The split reconciles: 240 earned + 235 kept = 475.
    expect(screen.getByTestId('savings-earned-last-week').textContent).toBe('240');
    expect(screen.getByTestId('savings-kept-from-earlier').textContent).toBe('235');
    // FHS-618: the two lines are named plainly, and together they are the total.
    expect(screen.getByTestId('your-savings')).toHaveTextContent('Earned last week');
    expect(screen.getByTestId('your-savings')).toHaveTextContent('Rest of the total');
    expect(screen.getByTestId('your-savings')).not.toHaveTextContent('Kept from every week');
  });

  it('sums the investments and counts the ones that can lose value', async () => {
    installApi({ savedStickers: 10 });
    const base = fetchMock.getMockImplementation()!;
    fetchMock.mockImplementation((url: string, init?: RequestInit) => {
      const u = String(url);
      if (u.includes('/api/mw/financial/investments')) {
        return Promise.resolve({
          ok: true,
          status: 200,
          json: async () => ({
            investments: [
              {
                id: 'inv1',
                habitId: HABIT,
                habitName: 'Read a book',
                habitIcon: 'star',
                investedStickers: 10,
                originalInvestedStickers: 10,
                currentValue: 7.5,
                currentValueStickers: 15,
                daysCompleted: 3,
                daysMissed: 0,
                deductible: true,
              },
              {
                id: 'inv2',
                habitId: HABIT,
                habitName: 'Tidy up',
                habitIcon: 'zap',
                investedStickers: 8,
                originalInvestedStickers: 8,
                currentValue: 4,
                currentValueStickers: 8,
                daysCompleted: 1,
                daysMissed: 1,
                deductible: false,
              },
            ],
          }),
        });
      }
      return base(url, init);
    });
    renderTab();
    await waitFor(() => expect(screen.getByTestId('investments-worth')).toBeInTheDocument());
    // 7.50 + 4.00, and one of the two is deductible.
    expect(screen.getByTestId('investments-worth').textContent).toContain('11.50');
    expect(screen.getByTestId('investments-at-risk').textContent).toContain('1 of 2 could');
  });

  // FHS-607: the card as the approved design draws it — a count badge, one
  // compact line per investment, at-risk first, and only one row open at once.
  const twoInvestments = (base: ReturnType<typeof fetchMock.getMockImplementation>) => {
    fetchMock.mockImplementation((url: string, init?: RequestInit) => {
      const u = String(url);
      if (u.includes('/api/mw/financial/investments')) {
        return Promise.resolve({
          ok: true,
          status: 200,
          json: async () => ({
            investments: [
              // Deliberately no-penalty FIRST in the payload, so the rendered
              // order proves the sort rather than echoing the response.
              {
                id: 'safe1',
                habitId: HABIT,
                habitName: 'Tidy up',
                habitIcon: 'zap',
                investedStickers: 8,
                originalInvestedStickers: 8,
                currentValue: 4,
                currentValueStickers: 8,
                daysCompleted: 1,
                daysMissed: 1,
                deductible: false,
                coefficient: 2,
              },
              {
                id: 'risk1',
                habitId: HABIT,
                habitName: 'Read a book',
                habitIcon: 'star',
                investedStickers: 10,
                originalInvestedStickers: 6,
                currentValue: 7.5,
                currentValueStickers: 15,
                daysCompleted: 3,
                daysMissed: 2,
                deductible: true,
                coefficient: 3,
              },
            ],
          }),
        });
      }
      return base!(url, init);
    });
  };

  it('counts the invested habits and puts the at-risk ones first', async () => {
    installApi({ savedStickers: 10 });
    twoInvestments(fetchMock.getMockImplementation());
    renderTab();
    await waitFor(() => expect(screen.getByTestId('investments-count')).toBeInTheDocument());
    expect(screen.getByTestId('investments-count')).toHaveTextContent('2 habits');
    const rows = screen
      .getAllByTestId(/^investment-row-/)
      .map((el) => el.getAttribute('data-testid'));
    expect(rows).toEqual(['investment-row-risk1', 'investment-row-safe1']);
    // Each row is one line: name and worth, nothing else on show.
    expect(screen.getByTestId('investment-worth-risk1')).toHaveTextContent('AED 7.50');
    expect(screen.queryByTestId('investment-mode-risk1')).not.toBeInTheDocument();
  });

  it('opens one investment at a time and shows its detail', async () => {
    installApi({ savedStickers: 10 });
    twoInvestments(fetchMock.getMockImplementation());
    renderTab();
    await waitFor(() => expect(screen.getByTestId('investment-row-risk1')).toBeInTheDocument());

    await act(async () => {
      fireEvent.click(screen.getByTestId('investment-row-risk1'));
    });
    expect(screen.getByTestId('investment-row-risk1')).toHaveAttribute('aria-expanded', 'true');
    expect(screen.getByTestId('investment-mode-risk1')).toHaveTextContent('Deductible');
    expect(screen.getByTestId('investment-mode-risk1')).toHaveTextContent('Invested · 3x');
    // FHS-613: three points in time, from the real payload.
    expect(screen.getByTestId('investment-original')).toHaveTextContent('6 stickers');
    expect(screen.getByTestId('investment-invested')).toHaveTextContent('10 stickers');
    expect(screen.getByTestId('investment-current')).toHaveTextContent('15 stickers');
    // 3 stickers a day at AED 0.50 each.
    expect(screen.getByTestId('investment-per-day-risk1')).toHaveTextContent(
      'Pays AED 1.50 each day it is done.',
    );
    expect(screen.getByTestId('investment-toggle-risk1')).toHaveTextContent('Switch to no penalty');

    // Opening the second row closes the first.
    await act(async () => {
      fireEvent.click(screen.getByTestId('investment-row-safe1'));
    });
    expect(screen.queryByTestId('investment-mode-risk1')).not.toBeInTheDocument();
    expect(screen.getByTestId('investment-mode-safe1')).toHaveTextContent('No penalty');
    expect(screen.getByTestId('investment-toggle-safe1')).toHaveTextContent('Switch to deductible');
  });

  // FHS-611: the faint purple/slate-400 labels were unreadable on the dark
  // cards, and the investment-row ones measured below the 4.5:1 floor (the
  // maths is in money-row-contrast.test.tsx). None of them may come back.
  it('keeps faint text off the money row and the investments card', async () => {
    installApi({ savedStickers: 10 });
    twoInvestments(fetchMock.getMockImplementation());
    renderTab();
    await waitFor(() => expect(screen.getByTestId('money-row')).toBeInTheDocument());
    await act(async () => {
      fireEvent.click(screen.getByTestId('investment-row-risk1'));
    });
    const faint = ['text-purple-200', 'text-purple-300', 'text-slate-400', 'text-red-400'];
    for (const testId of ['your-savings', 'bankable-week', 'active-investments']) {
      const card = screen.getByTestId(testId);
      const offenders = [...card.querySelectorAll<HTMLElement>('*')]
        .filter((el) => faint.some((c) => el.className?.toString().split(/\s+/).includes(c)))
        .map((el) => `${el.tagName}.${el.className}`);
      expect(offenders, `${testId} still has faint text`).toEqual([]);
    }
  });

  // FHS-613: the detail reads as three moments in time, and the change is
  // measured against LAST WEEK's total, not the original amount.
  it('labels the three figures as moments in time, with money beside each', async () => {
    installApi({ savedStickers: 10 });
    twoInvestments(fetchMock.getMockImplementation());
    renderTab();
    await waitFor(() => expect(screen.getByTestId('investment-row-risk1')).toBeInTheDocument());
    await act(async () => {
      fireEvent.click(screen.getByTestId('investment-row-risk1'));
    });
    const card = screen.getByTestId('active-investments');
    expect(card).toHaveTextContent('Put in at the start');
    expect(card).toHaveTextContent('After last week\u2019s roll over');
    expect(card).toHaveTextContent('Today');
    // Every sticker count carries its money value: 6, 10 and 15 stickers at
    // AED 0.50, and Today uses the server's own cash figure (7.50).
    expect(screen.getByTestId('investment-original')).toHaveTextContent('6 stickers');
    expect(screen.getByTestId('investment-original')).toHaveTextContent('3.00');
    expect(screen.getByTestId('investment-invested')).toHaveTextContent('10 stickers');
    expect(screen.getByTestId('investment-invested')).toHaveTextContent('5.00');
    expect(screen.getByTestId('investment-current')).toHaveTextContent('15 stickers');
    expect(screen.getByTestId('investment-current')).toHaveTextContent('7.50');
  });

  it('shows a gain against last week as a signed green tag and a sentence', async () => {
    installApi({ savedStickers: 10 });
    twoInvestments(fetchMock.getMockImplementation());
    renderTab();
    await waitFor(() => expect(screen.getByTestId('investment-row-risk1')).toBeInTheDocument());
    await act(async () => {
      fireEvent.click(screen.getByTestId('investment-row-risk1'));
    });
    // 15 today against 10 after the roll over.
    const tag = screen.getByTestId('investment-delta');
    // Exact, not a substring: the sign is what makes the direction readable
    // in greyscale, so a refactor that drops it must fail here.
    expect(tag.textContent).toBe('+5');
    expect(tag.className).toContain('bg-green-300');
    expect(screen.getByTestId('investment-change-note-risk1')).toHaveTextContent(
      'Up 5 stickers since last week',
    );
  });

  it('shows a real loss on a deductible habit, and never one on a no-penalty habit', async () => {
    installApi({ savedStickers: 10 });
    const base = fetchMock.getMockImplementation()!;
    fetchMock.mockImplementation((url: string, init?: RequestInit) => {
      const u = String(url);
      if (u.includes('/api/mw/financial/investments')) {
        return Promise.resolve({
          ok: true,
          status: 200,
          json: async () => ({
            investments: [
              // Deductible: grew 2, lost 5 to missed days, so it is down 3.
              {
                id: 'lost1',
                habitId: HABIT,
                habitName: 'Read a book',
                habitIcon: 'star',
                investedStickers: 20,
                originalInvestedStickers: 20,
                currentValue: 8.5,
                currentValueStickers: 17,
                daysCompleted: 2,
                daysMissed: 5,
                deductible: true,
                coefficient: 1,
              },
              // No penalty: missed days cost nothing, so it only held flat.
              {
                id: 'flat1',
                habitId: HABIT,
                habitName: 'Tidy up',
                habitIcon: 'zap',
                investedStickers: 12,
                originalInvestedStickers: 12,
                currentValue: 6,
                currentValueStickers: 12,
                daysCompleted: 0,
                daysMissed: 5,
                deductible: false,
                coefficient: 2,
              },
            ],
          }),
        });
      }
      return base(url, init);
    });
    renderTab();
    await waitFor(() => expect(screen.getByTestId('investment-row-lost1')).toBeInTheDocument());

    await act(async () => {
      fireEvent.click(screen.getByTestId('investment-row-lost1'));
    });
    const down = screen.getByTestId('investment-delta');
    expect(down.textContent).toBe('\u22123');
    expect(down.className).toContain('bg-red-300');
    expect(screen.getByTestId('investment-change-note-lost1')).toHaveTextContent(
      'Down 3 stickers since last week',
    );

    await act(async () => {
      fireEvent.click(screen.getByTestId('investment-row-flat1'));
    });
    const flat = screen.getByTestId('investment-delta');
    expect(flat.textContent).toBe('0');
    expect(flat.className).toContain('bg-gray-200');
    expect(screen.getByTestId('investment-change-note-flat1')).toHaveTextContent(
      'No change since last week',
    );
  });

  // FHS-615: the labels were lightened but the values beside them carried no
  // colour at all, so they inherited the page's near-black body text onto a
  // dark purple panel. This catches the whole class: any text inside these
  // cards whose colour comes from OUTSIDE the card.
  it('never lets text on the money cards inherit its colour from the page', async () => {
    installApi({ savedStickers: 240, savedCash: 10 });
    twoInvestments(fetchMock.getMockImplementation());
    renderTab();
    await waitFor(() => expect(screen.getByTestId('money-row')).toBeInTheDocument());
    await act(async () => {
      fireEvent.click(screen.getByTestId('investment-row-risk1'));
    });
    const hasTextColour = (el: Element) =>
      /(^|\s)text-(white|black|slate-|purple-|yellow-|lime-|green-|red-|emerald-|gray-|fuchsia-)/.test(
        el.className?.toString() ?? '',
      );
    for (const testId of ['your-savings', 'bankable-week', 'active-investments']) {
      const card = screen.getByTestId(testId);
      const orphans: string[] = [];
      for (const el of card.querySelectorAll<HTMLElement>('*')) {
        // Only elements that own visible text of their own.
        const ownText = [...el.childNodes]
          .filter((n) => n.nodeType === 3)
          .map((n) => n.textContent?.trim() ?? '')
          .join('');
        if (!ownText) continue;
        let node: Element | null = el;
        let coloured = false;
        while (node && node !== card.parentElement) {
          if (hasTextColour(node)) {
            coloured = true;
            break;
          }
          node = node.parentElement;
        }
        if (!coloured) orphans.push(`"${ownText.slice(0, 30)}" in ${el.tagName}.${el.className}`);
      }
      expect(orphans, `${testId} has text with no colour of its own`).toEqual([]);
    }
  });

  it('tells a parent when nothing is invested yet', async () => {
    installApi({ savedStickers: 10 });
    renderTab();
    await waitFor(() => expect(screen.getByTestId('active-investments')).toBeInTheDocument());
    const card = screen.getByTestId('active-investments');
    expect(card).toHaveTextContent('Habits invested');
    expect(card).toHaveTextContent(
      'Nothing growing yet. Mark a habit as invested to pay a multiple.',
    );
    expect(screen.queryByTestId('investments-count')).not.toBeInTheDocument();
  });

  it('shows the week progress inside This Week', async () => {
    installApi({ unallocated: 15 });
    renderTab();
    await waitFor(() => expect(screen.getByTestId('bankable-week')).toBeInTheDocument());
    const card = screen.getByTestId('bankable-week');
    expect(card.textContent).toContain('Stickers to bank');
    expect(card.textContent).toContain('Habit days done');
    expect(card.textContent).toContain('One sticker is');
  });

  // QA gap: the cash display path is new code, distinct from the kid card.
  it('shows the cash line and folds cash into Total Value when cash exists', async () => {
    installApi({ savedStickers: 10, savedCash: 5, earnedLastWeekStickers: 4, stickerRate: 0.5 });
    renderTab();
    await waitFor(() => expect(screen.getByTestId('money-row')).toBeInTheDocument());
    const card = screen.getByTestId('your-savings');
    expect(card.textContent).toContain('Saved as cash');
    // 10 stickers at 0.5 + 5.00 cash = 10.00 total.
    expect(card.textContent).toContain('10.00');
    expect(screen.getByTestId('savings-earned-last-week').textContent).toBe('4');
    expect(screen.getByTestId('savings-kept-from-earlier').textContent).toBe('6');
  });

  // QA gap: the readOnly gate is the exact line this ticket changed. A kid
  // must keep the simple pair and never see the parent money row.
  it('keeps the kid pair and hides the money row in kid (readOnly) mode', async () => {
    installApi();
    const base = fetchMock.getMockImplementation()!;
    fetchMock.mockImplementation((url: string, init?: RequestInit) => {
      const u = String(url);
      if (u.includes('/api/kid/weeks') && u.includes('/stats')) {
        return Promise.resolve({
          ok: true,
          status: 200,
          json: async () => ({
            weekId: WEEK,
            totalStickers: 0,
            unallocatedStickers: 2,
            allocatedStickers: 0,
            cashValue: 1,
          }),
        });
      }
      if (u.includes('/api/kid/weeks') && u.includes('/actions')) {
        return Promise.resolve({ ok: true, status: 200, json: async () => ({ actions: [] }) });
      }
      if (u.includes('/api/kid/weeks')) {
        return Promise.resolve({
          ok: true,
          status: 200,
          json: async () => ({
            weeks: [
              {
                id: WEEK,
                weekNumber: 9,
                year: 2026,
                startDate: '2026-02-23',
                isFinalized: false,
                carriedOverStickers: 0,
                carriedOverCash: 0,
                retrievedStickers: 0,
                retrievedCash: 0,
              },
            ],
          }),
        });
      }
      if (u.includes('/api/kid/financial/savings')) {
        return Promise.resolve({
          ok: true,
          status: 200,
          json: async () => ({
            savedStickers: 12,
            savedCash: 0,
            earnedLastWeekStickers: 2,
            keptFromEarlierStickers: 10,
            currency: 'AED',
            stickerRate: 0.5,
            stickerRateMinor: 50,
          }),
        });
      }
      if (u.includes('/api/kid/financial/investments')) {
        return Promise.resolve({ ok: true, status: 200, json: async () => ({ investments: [] }) });
      }
      if (u.includes('/api/kid/rewards')) {
        return Promise.resolve({
          ok: true,
          status: 200,
          json: async () => ({ rewards: [], stickerBalance: 0 }),
        });
      }
      return base(url, init);
    });
    render(
      <MemoryRouter initialEntries={['/t/khan/child/' + MEMBER]}>
        <Routes>
          <Route
            path="/t/:slug/child/:memberId"
            element={
              <TenantProvider>
                <MyWorldTab kidToken="kid.jwt.tok" />
              </TenantProvider>
            }
          />
        </Routes>
      </MemoryRouter>,
    );
    await waitFor(() => expect(screen.getByTestId('your-savings')).toBeInTheDocument());
    expect(screen.getByTestId('active-investments')).toBeInTheDocument();
    // The parent-only surfaces stay hidden from a kid.
    expect(screen.queryByTestId('money-row')).not.toBeInTheDocument();
    expect(screen.queryByTestId('bankable-week')).not.toBeInTheDocument();
  });

  // FHS-607: a kid sees the same tags and rows, but never the control that
  // changes what an investment costs them.
  it('shows a kid the investment detail without the switch control', async () => {
    installApi();
    const base = fetchMock.getMockImplementation()!;
    fetchMock.mockImplementation((url: string, init?: RequestInit) => {
      const u = String(url);
      if (u.includes('/api/kid/weeks') && u.includes('/stats')) {
        return Promise.resolve({
          ok: true,
          status: 200,
          json: async () => ({
            weekId: WEEK,
            totalStickers: 0,
            unallocatedStickers: 2,
            allocatedStickers: 0,
            cashValue: 1,
          }),
        });
      }
      if (u.includes('/api/kid/weeks') && u.includes('/actions')) {
        return Promise.resolve({ ok: true, status: 200, json: async () => ({ actions: [] }) });
      }
      if (u.includes('/api/kid/weeks')) {
        return Promise.resolve({
          ok: true,
          status: 200,
          json: async () => ({
            weeks: [
              {
                id: WEEK,
                weekNumber: 9,
                year: 2026,
                startDate: '2026-02-23',
                isFinalized: false,
                carriedOverStickers: 0,
                carriedOverCash: 0,
                retrievedStickers: 0,
                retrievedCash: 0,
              },
            ],
          }),
        });
      }
      if (u.includes('/api/kid/financial/savings')) {
        return Promise.resolve({
          ok: true,
          status: 200,
          json: async () => ({
            savedStickers: 12,
            savedCash: 0,
            earnedLastWeekStickers: 2,
            keptFromEarlierStickers: 10,
            currency: 'AED',
            stickerRate: 0.5,
            stickerRateMinor: 50,
          }),
        });
      }
      if (u.includes('/api/kid/financial/investments')) {
        return Promise.resolve({
          ok: true,
          status: 200,
          json: async () => ({
            investments: [
              {
                id: 'kidinv1',
                habitId: HABIT,
                habitName: 'Read a book',
                habitIcon: 'star',
                investedStickers: 10,
                originalInvestedStickers: 10,
                currentValue: 7.5,
                currentValueStickers: 15,
                daysCompleted: 3,
                daysMissed: 0,
                deductible: true,
                // FHS-607: the kid endpoint now carries the coefficient too,
                // so a kid's tag shows the real multiplier, not a flat 5x.
                coefficient: 3,
              },
            ],
          }),
        });
      }
      if (u.includes('/api/kid/rewards')) {
        return Promise.resolve({
          ok: true,
          status: 200,
          json: async () => ({ rewards: [], stickerBalance: 0 }),
        });
      }
      return base(url, init);
    });
    render(
      <MemoryRouter initialEntries={['/t/khan/child/' + MEMBER]}>
        <Routes>
          <Route
            path="/t/:slug/child/:memberId"
            element={
              <TenantProvider>
                <MyWorldTab kidToken="kid.jwt.tok" />
              </TenantProvider>
            }
          />
        </Routes>
      </MemoryRouter>,
    );
    await waitFor(() => expect(screen.getByTestId('investment-row-kidinv1')).toBeInTheDocument());
    await act(async () => {
      fireEvent.click(screen.getByTestId('investment-row-kidinv1'));
    });
    expect(screen.getByTestId('investment-mode-kidinv1')).toHaveTextContent('Invested · 3x');
    expect(screen.queryByTestId('investment-toggle-kidinv1')).not.toBeInTheDocument();
    // Instead of the control, a kid gets the plain sentence explaining the kind.
    expect(screen.getByTestId('active-investments')).toHaveTextContent(
      'A missed day takes value off this investment.',
    );
  });

  // FHS-612: the heading carried the week for one release. The board already
  // says which week it is, so the label only crowded the pending count.
  it('keeps the Reward Requests heading to its title and pending count', async () => {
    installApi({});
    renderTab();
    await waitFor(() => expect(screen.getByTestId('reward-requests-count')).toBeInTheDocument());
    expect(screen.queryByTestId('reward-requests-week')).not.toBeInTheDocument();
    expect(screen.getByTestId('reward-requests-count').textContent).toContain('Pending');
  });
});

// FHS-642: closing the week never showed the "all done" screen. The sheet
// itself was innocent: it set its done phase and kept it. The board ABOVE it
// reloaded loudly, and the loading screen is an early return, so the whole
// board unmounted and took the sheet with it; it came back mounted fresh, on
// the chooser. So the guard has to live here, where both the loading screen
// and the sheet are, and not in MoneyActionsSheet.test.tsx: a test that renders
// the sheet on its own passes just as happily on the broken code.
describe('<MyWorldTab /> closing the week (FHS-642)', () => {
  const NEXT_WEEK = 'ffffffff-ffff-4fff-8fff-ffffffffffff';

  it('keeps the all done screen up while the board refreshes behind it', async () => {
    // The Close Week banner only appears from the week's last day. The default
    // fixture week starts Mon 2026-02-23, so its Sunday is 2026-03-01. Fake
    // only Date so the fetches still run on real timers.
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date('2026-03-01T10:00:00'));
    installApi({ unallocated: 5 });
    const base = fetchMock.getMockImplementation()!;

    let finalized = false;
    // Holds the post-finalize weeks read open, so the refresh is observably
    // still in flight when we look. That window is the whole bug: it is when
    // the loading screen used to take the board (and the sheet) off screen.
    let releaseWeeks: (() => void) | null = null;

    fetchMock.mockImplementation((url: string, init?: RequestInit) => {
      const u = String(url);
      if (init?.method === 'POST' && u.includes('/finalize')) {
        finalized = true;
        return Promise.resolve({
          ok: true,
          status: 200,
          json: async () => ({ nextWeekId: NEXT_WEEK }),
        });
      }
      // finalizeWeek reads the running investments first, to carry them over.
      if (u.includes('/api/mw/financial/investments')) {
        return Promise.resolve({ ok: true, status: 200, json: async () => ({ investments: [] }) });
      }
      if (u.includes('/api/mw/weeks') && !u.includes('/stats') && !u.includes('/actions')) {
        if (!finalized) return base(url, init);
        const weeks = [
          {
            id: WEEK,
            weekNumber: 9,
            year: 2026,
            startDate: '2026-02-23',
            isFinalized: true,
            carriedOverStickers: 0,
            carriedOverCash: 0,
            retrievedStickers: 0,
            retrievedCash: 0,
          },
          {
            id: NEXT_WEEK,
            weekNumber: 10,
            year: 2026,
            startDate: '2026-03-02',
            isFinalized: false,
            carriedOverStickers: 0,
            carriedOverCash: 0,
            retrievedStickers: 0,
            retrievedCash: 0,
          },
        ];
        if (releaseWeeks === null) {
          return new Promise((resolve) => {
            releaseWeeks = () => resolve({ ok: true, status: 200, json: async () => ({ weeks }) });
          });
        }
        return Promise.resolve({ ok: true, status: 200, json: async () => ({ weeks }) });
      }
      return base(url, init);
    });

    renderTab(true);
    await waitFor(() =>
      expect(screen.getByTestId('my-world-close-week-banner')).toBeInTheDocument(),
    );
    fireEvent.click(screen.getByTestId('my-world-close-week-banner-btn'));
    await waitFor(() => expect(screen.getByTestId('close-week-chooser')).toBeInTheDocument());

    fireEvent.click(screen.getByTestId('close-week-chooser-finish'));
    await waitFor(() =>
      expect(screen.getByTestId('money-actions-done-message')).toBeInTheDocument(),
    );

    // Mid-refresh: the board must not have swapped itself for the loading
    // screen, because that early return is what unmounted the sheet.
    await waitFor(() => expect(releaseWeeks).not.toBeNull());
    expect(screen.queryByTestId('habit-tracker-loading')).not.toBeInTheDocument();
    expect(screen.getByTestId('money-actions-done-message')).toBeInTheDocument();

    // And after it: still the all done screen, not the list of choices again.
    await act(async () => {
      releaseWeeks!();
    });
    await waitFor(() => expect(screen.getByTestId('my-world')).toBeInTheDocument());
    expect(screen.getByTestId('money-actions-done-message')).toHaveTextContent(
      'The week is closed and a new one has started',
    );
    expect(screen.queryByTestId('close-week-chooser')).not.toBeInTheDocument();
  });
});
