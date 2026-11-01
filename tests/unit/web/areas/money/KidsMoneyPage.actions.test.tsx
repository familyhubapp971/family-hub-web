import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';

// FHS-623: the Kids money page's own action buttons, wired to the real
// sheet (no `onMoneyAction` override, unlike the FHS-622 seam tests in
// KidsMoneyPage.test.tsx). Uses a STATEFUL mock: a save/cash-out/etc.
// actually mutates the same numbers the GET handlers read back, so this
// proves the figures move after a save AND survive a fresh render (the
// stand-in for "survives a reload": a brand new mount reading the same
// mocked server state).

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
const CURRENT_WEEK_ID = 'week-current';

interface ServerState {
  available: number;
  saved: number;
  investedStickers: number;
  currency: string;
  stickerRate: number;
}

function installStatefulApi(initial: Partial<ServerState> = {}) {
  const state: ServerState = {
    available: 40,
    saved: 60,
    investedStickers: 30,
    currency: 'AED',
    stickerRate: 0.5,
    ...initial,
  };
  let failNextSave = false;

  const fetchMock = vi.fn((url: string, init?: RequestInit) => {
    const u = String(url);
    const method = init?.method ?? 'GET';

    if (u.includes('/api/members')) {
      return Promise.resolve({
        ok: true,
        json: async () => ({ callerRole: 'admin', members: ONE_KID }),
      });
    }
    if (u.includes('/api/mw/weeks/current')) {
      return Promise.resolve({ ok: true, json: async () => ({ week: { id: CURRENT_WEEK_ID } }) });
    }
    if (/\/api\/mw\/weeks\/[^/?]+\/stats/.test(u)) {
      return Promise.resolve({
        ok: true,
        json: async () => ({
          weekId: CURRENT_WEEK_ID,
          totalStickers: state.available,
          unallocatedStickers: state.available,
          allocatedStickers: 0,
          cashValue: state.available * state.stickerRate,
        }),
      });
    }
    if (/\/api\/mw\/weeks\/[^/?]+\/actions/.test(u)) {
      return Promise.resolve({ ok: true, json: async () => ({ actions: [] }) });
    }
    if (u.includes('/api/mw/weeks?')) {
      return Promise.resolve({
        ok: true,
        json: async () => ({
          weeks: [
            {
              id: CURRENT_WEEK_ID,
              weekNumber: 24,
              year: 2026,
              startDate: '2026-06-08',
              isFinalized: false,
            },
          ],
        }),
      });
    }
    if (u.includes('/api/mw/financial/savings') && method === 'POST') {
      const body = JSON.parse((init!.body as string) ?? '{}') as { amount: number };
      if (failNextSave) {
        return Promise.resolve({
          ok: false,
          status: 409,
          json: async () => ({
            error: 'not enough weekly stickers',
            errorCode: 'INSUFFICIENT_STICKERS',
          }),
        });
      }
      state.available -= body.amount;
      state.saved += body.amount;
      return Promise.resolve({ ok: true, json: async () => ({ success: true }) });
    }
    if (u.includes('/api/mw/financial/savings')) {
      return Promise.resolve({
        ok: true,
        json: async () => ({
          savedStickers: state.saved,
          savedCash: state.saved * state.stickerRate,
          currency: state.currency,
          stickerRate: state.stickerRate,
          stickerRateMinor: Math.round(state.stickerRate * 100),
          earnedLastWeekStickers: 0,
          keptFromEarlierStickers: state.saved,
        }),
      });
    }
    if (u.includes('/api/mw/financial/investments')) {
      return Promise.resolve({
        ok: true,
        json: async () => ({
          investments:
            state.investedStickers > 0
              ? [
                  {
                    id: 'inv-1',
                    habitId: 'habit-1',
                    habitName: 'Read a book',
                    habitIcon: null,
                    investedStickers: state.investedStickers,
                    originalInvestedStickers: state.investedStickers,
                    currentValue: state.investedStickers * state.stickerRate,
                    currentValueStickers: state.investedStickers,
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
    return Promise.resolve({ ok: true, json: async () => ({}) });
  });

  vi.stubGlobal('fetch', fetchMock);
  return {
    state,
    failNextSave: (v: boolean) => {
      failNextSave = v;
    },
  };
}

beforeEach(() => {
  vi.unstubAllGlobals();
});

function renderPage() {
  return render(
    <MemoryRouter initialEntries={['/t/khans/money']}>
      <Routes>
        <Route
          path="/t/:slug/money"
          element={
            <TenantProvider>
              <KidsMoneyPage />
            </TenantProvider>
          }
        />
        <Route path="/t/:slug/dashboard" element={<div data-testid="on-dashboard" />} />
      </Routes>
    </MemoryRouter>,
  );
}

describe('Kids money actions save for real (FHS-623)', () => {
  it('a successful move-to-savings action updates the figures, and a fresh mount still shows them', async () => {
    const api = installStatefulApi({ available: 40, saved: 60 });
    renderPage();

    await waitFor(() =>
      expect(screen.getByTestId('kids-money-figure-available')).toHaveTextContent('40 stickers'),
    );

    fireEvent.click(screen.getByTestId('kids-money-action-save'));
    await waitFor(() => expect(screen.getByTestId('money-save-amount')).toBeInTheDocument());
    fireEvent.click(screen.getByTestId('money-save-confirm'));

    // The done screen shows while the page's own figures already moved.
    await screen.findByTestId('money-actions-done-message');
    await waitFor(() =>
      expect(screen.getByTestId('kids-money-figure-available')).toHaveTextContent('0 stickers'),
    );
    expect(screen.getByTestId('kids-money-figure-saved')).toHaveTextContent('100 stickers');
    expect(api.state.available).toBe(0);
    expect(api.state.saved).toBe(100);

    fireEvent.click(screen.getByTestId('money-actions-done-close'));
    expect(screen.queryByTestId('money-actions-sheet')).not.toBeInTheDocument();

    // "Survives a reload": a brand new mount against the same server state.
    renderPage();
    await waitFor(() =>
      expect(screen.getAllByTestId('kids-money-figure-available')[1]).toHaveTextContent(
        '0 stickers',
      ),
    );
    expect(screen.getAllByTestId('kids-money-figure-saved')[1]).toHaveTextContent('100 stickers');
  });

  it('a failed save leaves the figures untouched and keeps the sheet open', async () => {
    const api = installStatefulApi({ available: 40, saved: 60 });
    api.failNextSave(true);
    renderPage();

    await waitFor(() =>
      expect(screen.getByTestId('kids-money-figure-available')).toHaveTextContent('40 stickers'),
    );

    fireEvent.click(screen.getByTestId('kids-money-action-save'));
    await waitFor(() => expect(screen.getByTestId('money-save-amount')).toBeInTheDocument());
    fireEvent.click(screen.getByTestId('money-save-confirm'));

    expect(await screen.findByTestId('money-save-error')).toHaveTextContent("didn't save");
    expect(screen.queryByTestId('money-actions-done-message')).not.toBeInTheDocument();
    expect(screen.getByTestId('money-actions-sheet')).toBeInTheDocument();

    // Nothing changed: same 40/60 both server-side and on screen.
    expect(api.state.available).toBe(40);
    expect(api.state.saved).toBe(60);
    expect(screen.getByTestId('kids-money-figure-available')).toHaveTextContent('40 stickers');
    expect(screen.getByTestId('kids-money-figure-saved')).toHaveTextContent('60 stickers');
  });
});
