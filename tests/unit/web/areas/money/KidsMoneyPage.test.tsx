import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';

// FHS-622: Kids money replaces the FHS-621 wrapper (which just rendered the
// legacy Admin Panel's Balance/Savings/History tabs) with the designed page.
// Every figure here comes from the same endpoints FHS-627 documented, so the
// mock below returns the exact shapes those endpoints return, not invented
// ones.

vi.mock('../../../../../src/app/lib/auth-context', () => ({
  useAuth: () => ({
    session: { access_token: 'tok-admin' },
    user: { id: 'u-admin', email: 'sarah@example.com' },
    loading: false,
  }),
  signOutAll: vi.fn(),
}));

import { KidsMoneyPage } from '../../../../../src/areas/money/KidsMoneyPage';
import { TenantProvider } from '../../../../../src/app/lib/tenant-context';

const ONE_KID = [{ id: 'kid-1', displayName: 'Amina', role: 'child', avatarEmoji: '🦄' }];
const TWO_KIDS = [
  { id: 'kid-1', displayName: 'Amina', role: 'child', avatarEmoji: '🦄' },
  { id: 'kid-2', displayName: 'Yusuf', role: 'child', avatarEmoji: null },
];

const CURRENT_WEEK_ID = 'week-current';
const CLOSED_WEEK_ID = 'week-closed';

const CLOSED_WEEK_ACTIONS = [
  {
    id: 1,
    weekId: CLOSED_WEEK_ID,
    actionType: 'save',
    stickersUsed: 12,
    cashAmount: null,
    rewardName: null,
    habitId: null,
    habitName: null,
    createdAt: '2026-06-01T00:00:00Z',
  },
  {
    id: 2,
    weekId: CLOSED_WEEK_ID,
    actionType: 'claim',
    stickersUsed: 5,
    cashAmount: null,
    rewardName: 'Ice cream',
    habitId: null,
    habitName: null,
    createdAt: '2026-06-01T00:00:00Z',
  },
];

interface Options {
  callerRole?: string;
  members?: typeof ONE_KID;
  available?: number;
  saved?: number;
  investedStickers?: number;
  currency?: string;
  stickerRate?: number;
  weeksFail?: boolean;
}

function installApi(opts: Options = {}) {
  const callerRole = opts.callerRole ?? 'admin';
  const members = opts.members ?? ONE_KID;
  const available = opts.available ?? 40;
  const saved = opts.saved ?? 60;
  const investedStickers = opts.investedStickers ?? 30;
  const currency = opts.currency ?? 'AED';
  const stickerRate = opts.stickerRate ?? 0.5;

  const fetchMock = vi.fn((url: string) => {
    const u = String(url);
    if (u.includes('/api/members')) {
      return Promise.resolve({
        ok: true,
        status: 200,
        json: async () => ({ callerRole, members }),
      });
    }
    if (u.includes('/api/me')) {
      return Promise.resolve({
        ok: true,
        status: 200,
        json: async () => ({
          id: 'u-admin',
          email: 'sarah@example.com',
          tenants: [{ id: 't-1', slug: 'khans', name: 'The Khans', role: callerRole }],
        }),
      });
    }
    if (u.includes('/api/mw/weeks/current')) {
      if (opts.weeksFail)
        return Promise.resolve({ ok: false, status: 500, json: async () => ({}) });
      return Promise.resolve({
        ok: true,
        status: 200,
        json: async () => ({ week: { id: CURRENT_WEEK_ID } }),
      });
    }
    if (/\/api\/mw\/weeks\/[^/?]+\/stats/.test(u)) {
      const weekId = u.includes(CURRENT_WEEK_ID) ? CURRENT_WEEK_ID : CLOSED_WEEK_ID;
      const totalStickers = weekId === CURRENT_WEEK_ID ? available : 17;
      return Promise.resolve({
        ok: true,
        status: 200,
        json: async () => ({
          weekId,
          totalStickers,
          unallocatedStickers: available,
          allocatedStickers: 0,
          cashValue: available * stickerRate,
        }),
      });
    }
    if (/\/api\/mw\/weeks\/[^/?]+\/actions/.test(u)) {
      return Promise.resolve({
        ok: true,
        status: 200,
        json: async () => ({ actions: CLOSED_WEEK_ACTIONS }),
      });
    }
    if (u.includes('/api/mw/weeks?')) {
      return Promise.resolve({
        ok: true,
        status: 200,
        json: async () => ({
          weeks: [
            {
              id: CLOSED_WEEK_ID,
              weekNumber: 23,
              year: 2026,
              startDate: '2026-06-01',
              isFinalized: true,
              carriedOverStickers: 0,
              carriedOverCash: 0,
              retrievedStickers: 0,
              retrievedCash: 0,
            },
            {
              id: CURRENT_WEEK_ID,
              weekNumber: 24,
              year: 2026,
              startDate: '2026-06-08',
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
    if (u.includes('/api/mw/financial/savings')) {
      return Promise.resolve({
        ok: true,
        status: 200,
        json: async () => ({
          savedStickers: saved,
          savedCash: saved * stickerRate,
          currency,
          stickerRate,
          stickerRateMinor: Math.round(stickerRate * 100),
          earnedLastWeekStickers: 0,
          keptFromEarlierStickers: saved,
        }),
      });
    }
    if (u.includes('/api/mw/financial/investments')) {
      return Promise.resolve({
        ok: true,
        status: 200,
        json: async () => ({
          investments:
            investedStickers > 0
              ? [
                  {
                    id: 'inv-1',
                    habitId: 'habit-1',
                    habitName: 'Read a book',
                    habitIcon: null,
                    investedStickers,
                    originalInvestedStickers: investedStickers,
                    currentValue: investedStickers * stickerRate,
                    currentValueStickers: investedStickers,
                    daysCompleted: 3,
                    daysMissed: 0,
                    deductible: true,
                    coefficient: 3,
                  },
                ]
              : [],
        }),
      });
    }
    return Promise.resolve({ ok: true, status: 200, json: async () => ({}) });
  });
  vi.stubGlobal('fetch', fetchMock);
  return fetchMock;
}

beforeEach(() => {
  vi.unstubAllGlobals();
});

function renderPage(props: React.ComponentProps<typeof KidsMoneyPage> = {}) {
  return render(
    <MemoryRouter initialEntries={['/t/khans/money']}>
      <Routes>
        <Route
          path="/t/:slug/money"
          element={
            <TenantProvider>
              <KidsMoneyPage {...props} />
            </TenantProvider>
          }
        />
        <Route path="/t/:slug/dashboard" element={<div data-testid="on-dashboard" />} />
        <Route path="/t/:slug/reward-settings" element={<div data-testid="on-reward-settings" />} />
      </Routes>
    </MemoryRouter>,
  );
}

describe('Kids money (FHS-622)', () => {
  it('shows a loading skeleton before the figures arrive', async () => {
    installApi();
    renderPage();
    // The very first paint is the role gate (waiting on GET /api/members);
    // the money skeleton follows once the caller is confirmed admin.
    await waitFor(() => expect(screen.getByTestId('kids-money-loading')).toBeInTheDocument());
    await waitFor(() =>
      expect(screen.getByTestId('kids-money-figure-available')).toBeInTheDocument(),
    );
  });

  it("one child's money reads as one story, without a picker", async () => {
    installApi({
      available: 40,
      saved: 60,
      investedStickers: 30,
      currency: 'AED',
      stickerRate: 0.5,
    });
    renderPage();

    await waitFor(() =>
      expect(screen.getByTestId('kids-money-figure-available')).toBeInTheDocument(),
    );
    expect(screen.queryByTestId('kids-money-child-picker')).not.toBeInTheDocument();
    expect(screen.getByTestId('kids-money-child-single')).toHaveTextContent('Amina');

    expect(screen.getByTestId('kids-money-figure-available')).toHaveTextContent('40 stickers');
    expect(screen.getByTestId('kids-money-figure-available')).toHaveTextContent('AED 20.00');
    expect(screen.getByTestId('kids-money-figure-saved')).toHaveTextContent('60 stickers');
    expect(screen.getByTestId('kids-money-figure-invested')).toHaveTextContent('30 stickers');
    // 40 + 60 + 30 = 130 stickers, at 0.5/sticker = AED 65.00.
    expect(screen.getByTestId('kids-money-total')).toHaveTextContent('130 stickers');
    expect(screen.getByTestId('kids-money-total')).toHaveTextContent('AED 65.00');
  });

  it('a family with more than one child shows a picker to choose between them', async () => {
    installApi({ members: TWO_KIDS });
    renderPage();

    await waitFor(() => expect(screen.getByTestId('kids-money-child-picker')).toBeInTheDocument());
    expect(screen.getByTestId('kids-money-child-kid-1')).toBeInTheDocument();
    expect(screen.getByTestId('kids-money-child-kid-2')).toBeInTheDocument();
  });

  it('a fresh child with nothing yet does not look broken', async () => {
    installApi({ available: 0, saved: 0, investedStickers: 0 });
    renderPage();

    await waitFor(() => expect(screen.getByTestId('kids-money-nothing-yet')).toBeInTheDocument());
    expect(screen.getByTestId('kids-money-nothing-yet')).toHaveTextContent(
      'Once Amina finishes a habit, their stickers will show up here.',
    );
    expect(screen.queryByTestId('kids-money-figure-available')).not.toBeInTheDocument();
    expect(screen.getByTestId('kids-money-actions-empty')).toBeInTheDocument();
  });

  it('a failed load says nothing is shown, confirms nothing changed, and offers a retry', async () => {
    installApi({ weeksFail: true });
    renderPage();

    await waitFor(() => expect(screen.getByTestId('kids-money-error')).toBeInTheDocument());
    expect(screen.getByTestId('kids-money-error')).toHaveTextContent(
      'Nothing is shown, rather than something wrong. Nothing has changed.',
    );
    expect(screen.queryByTestId('kids-money-figure-available')).not.toBeInTheDocument();

    // Retry re-runs the same fetch; fix the mock so the retry can succeed.
    installApi();
    fireEvent.click(screen.getByTestId('kids-money-retry'));
    await waitFor(() =>
      expect(screen.getByTestId('kids-money-figure-available')).toBeInTheDocument(),
    );
  });

  it('the open week says nothing has moved to savings yet, rather than showing zeroes', async () => {
    installApi();
    renderPage();

    await waitFor(() =>
      expect(screen.getByTestId(`kids-money-week-${CURRENT_WEEK_ID}`)).toBeInTheDocument(),
    );
    fireEvent.click(screen.getByTestId(`kids-money-week-${CURRENT_WEEK_ID}`));
    expect(screen.getByTestId('kids-money-week-open-note')).toHaveTextContent(
      'Still open, so nothing has moved to savings yet.',
    );
  });

  it('opening a closed week shows what was earned, saved and spent', async () => {
    installApi();
    renderPage();

    await waitFor(() =>
      expect(screen.getByTestId(`kids-money-week-${CLOSED_WEEK_ID}`)).toBeInTheDocument(),
    );
    fireEvent.click(screen.getByTestId(`kids-money-week-${CLOSED_WEEK_ID}`));

    await waitFor(() =>
      expect(screen.getByTestId(`kids-money-week-${CLOSED_WEEK_ID}-detail`)).toHaveTextContent(
        '12 stickers',
      ),
    );
    expect(screen.getByTestId(`kids-money-week-${CLOSED_WEEK_ID}-detail`)).toHaveTextContent(
      '5 stickers',
    );
  });

  it('the action buttons call the FHS-623 seam with the tapped action', async () => {
    const onMoneyAction = vi.fn();
    installApi();
    renderPage({ onMoneyAction });

    await waitFor(() => expect(screen.getByTestId('kids-money-action-claim')).toBeInTheDocument());
    fireEvent.click(screen.getByTestId('kids-money-action-claim'));
    expect(onMoneyAction).toHaveBeenCalledWith('claim', { id: 'kid-1', name: 'Amina' });
  });

  it('links out to Earning rules', async () => {
    installApi();
    renderPage();

    await waitFor(() => expect(screen.getByText('Earning rules')).toBeInTheDocument());
    fireEvent.click(screen.getByText('Earning rules'));
    expect(await screen.findByTestId('on-reward-settings')).toBeInTheDocument();
  });

  // FHS-625: this page used to bounce everyone but an admin, inherited from
  // the Admin Panel it replaced. The server has always let an adult move a
  // child's money, so that gate locked adults out of something they were
  // allowed to do. Any grown-up gets in; kids and guests do not.
  it('an adult is let in, because the server lets them move money', async () => {
    installApi({ callerRole: 'adult' });
    renderPage();
    expect(await screen.findByTestId('kids-money-page')).toBeInTheDocument();
    expect(screen.queryByTestId('on-dashboard')).not.toBeInTheDocument();
  });

  it.each(['teen', 'child', 'guest'])(
    'a %s who reaches the address is sent back to the dashboard',
    async (role) => {
      installApi({ callerRole: role });
      renderPage();
      expect(await screen.findByTestId('on-dashboard')).toBeInTheDocument();
    },
  );

  // FHS-625: the redirect runs in an effect, one render AFTER the role lands,
  // so gating the page on "do we know the role yet" showed a child's balances
  // and the money buttons to a teen or guest for a frame first.
  it('never paints a child\u2019s money to someone who may not see it', async () => {
    installApi({ callerRole: 'teen' });
    renderPage();
    // Watch every render between mount and the redirect landing, not just the
    // end state: the leak this guards was only ever visible in between.
    const seen: string[] = [];
    await waitFor(() => {
      if (screen.queryByTestId('kids-money-page')) seen.push('the page');
      if (screen.queryByTestId('kids-money-total')) seen.push('a balance');
      expect(screen.getByTestId('on-dashboard')).toBeInTheDocument();
    });
    expect(seen, 'someone who may not see a kid\u2019s money was shown it').toEqual([]);
  });
});
