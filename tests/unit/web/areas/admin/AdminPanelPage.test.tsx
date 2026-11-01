import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor, fireEvent, act } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';

// FHS-308: AdminPanelPage unit tests.
// Uses URL-matched fetch mock: no MSW, no window.confirm.
// Tests: render with child selected, tab switching, Savings edit PUT,
// History reopen via ConfirmDialog, Settings tab (FHS-455 rename of "App
// Info") currency PUT, and FHS-435 GDPR export/delete-account flows.

const fetchMock = vi.fn();
const authState: {
  session: { access_token?: string } | null;
  user: { email?: string; id?: string; user_metadata?: Record<string, unknown> } | null;
} = {
  session: { access_token: 'tok-admin' },
  user: { email: 'sarah@example.com', id: 'u-admin', user_metadata: {} },
};

vi.mock('../../../../../src/app/lib/auth-context', () => ({
  useAuth: () => authState,
  signOutAll: vi.fn().mockResolvedValue({ error: null }),
  getKidToken: () => null,
  clearKidToken: vi.fn(),
}));

import { AdminPanelPage } from '../../../../../src/areas/admin/AdminPanelPage';
import { TenantProvider } from '../../../../../src/app/lib/tenant-context';
import { signOutAll } from '../../../../../src/app/lib/auth-context';

// ── Fixtures ──────────────────────────────────────────────────────────────────

const CHILD_ID = 'child-uuid-1111';
const WEEK_ID = 'week-uuid-aaaa';

const MEMBERS = [
  { id: 'admin-1', displayName: 'Sarah', role: 'admin', avatarEmoji: null, isChild: false },
  { id: CHILD_ID, displayName: 'Amina', role: 'child', avatarEmoji: '🦄', isChild: true },
];

const CURRENT_WEEK = {
  id: WEEK_ID,
  weekNumber: 23,
  year: 2026,
  isFinalized: false,
};

// FHS-512: field names + values match the real GET /mw/weeks/:id/stats
// response (previously `availableStickers`/`availableCash`, which the real
// API never returns: the display silently always read 0). cashValue is
// what the server computes at this child's configured rate.
const WEEK_STATS = {
  weekId: WEEK_ID,
  totalStickers: 20,
  unallocatedStickers: 12,
  allocatedStickers: 8,
  cashValue: 6,
};

const SAVINGS = {
  savedStickers: 5,
  savedCash: 3.5,
  cashEquivalent: 6,
  currency: 'AED',
};

const WEEKS_LIST = [
  {
    id: WEEK_ID,
    weekNumber: 23,
    year: 2026,
    // FHS-444: the API returns the week's Monday so the UI can show a real
    // date range next to "Week 23" instead of a bare number.
    startDate: '2026-06-01',
    status: 'Active',
    isFinalized: false,
    carriedOverStickers: 0,
    carriedOverCash: 0,
    retrievedStickers: 0,
    retrievedCash: 0,
  },
  {
    id: 'week-prev',
    weekNumber: 22,
    year: 2026,
    startDate: '2026-05-25',
    status: 'Finalized',
    isFinalized: true,
    carriedOverStickers: 2,
    carriedOverCash: 1,
    retrievedStickers: 1,
    retrievedCash: 0.5,
  },
];

const APP_SETTINGS = {
  currency: 'AED',
};

// FHS-435: a fake downloadable JSON payload + a Content-Disposition header
// matching what GET /api/admin/export returns.
const EXPORT_PAYLOAD = {
  exportedAt: '2026-06-15T00:00:00.000Z',
  family: { id: 't-1', slug: 'khans', name: 'The Khans' },
  data: { members: [], tasks: [] },
};

// ── Mock fetch router ─────────────────────────────────────────────────────────

function installApi(
  callerRole = 'admin',
  appSettings: Partial<typeof APP_SETTINGS> = APP_SETTINGS,
  // FHS-614: the page reads the family's currency once and passes it to every
  // tab. Tests that care about the money text set this.
  currency?: string,
) {
  fetchMock.mockImplementation((url: string, init?: RequestInit) => {
    const u = String(url);

    if (u.includes('/api/reward-config')) {
      return Promise.resolve({
        ok: true,
        status: 200,
        json: async () => (currency ? { currency } : {}),
      });
    }

    // AppHeader self-fetches these two on mount.
    // Use exact-path match (/api/me) to avoid catching /api/members.
    if (/\/api\/me(\?|$)/.test(u)) {
      return Promise.resolve({
        ok: true,
        status: 200,
        json: async () => ({
          id: 'u-admin',
          email: 'sarah@example.com',
          tenants: [{ id: 't-1', slug: 'khans', name: 'The Khans', role: 'admin' }],
        }),
      });
    }
    if (u.includes('/api/dashboard/today')) {
      return Promise.resolve({
        ok: true,
        status: 200,
        json: async () => ({
          date: '2026-06-15',
          callerMemberId: 'admin-1',
          members: [],
        }),
      });
    }

    if (u.includes('/api/members')) {
      return Promise.resolve({
        ok: true,
        status: 200,
        json: async () => ({ members: MEMBERS, callerRole }),
      });
    }
    if (u.includes('/api/mw/weeks/current')) {
      // Real API wraps the week: { week: {...} }: mock must match or the
      // Balance tab's unwrap regression slips through (FHS-311).
      return Promise.resolve({ ok: true, status: 200, json: async () => ({ week: CURRENT_WEEK }) });
    }
    if (u.includes('/api/mw/weeks/') && u.includes('/stats')) {
      return Promise.resolve({ ok: true, status: 200, json: async () => WEEK_STATS });
    }
    if (
      u.includes('/api/mw/weeks') &&
      !u.includes('/stats') &&
      !u.includes('/current') &&
      !u.includes('/reopen') &&
      !u.includes('/repair') &&
      !u.includes('/finalize') &&
      !u.includes('/actions') &&
      !u.includes('/cash')
    ) {
      return Promise.resolve({ ok: true, status: 200, json: async () => ({ weeks: WEEKS_LIST }) });
    }
    if (u.includes('/actions')) {
      return Promise.resolve({ ok: true, status: 200, json: async () => ({ actions: [] }) });
    }
    if (u.includes('/reopen')) {
      return Promise.resolve({ ok: true, status: 200, json: async () => ({}) });
    }
    if (u.includes('/repair')) {
      return Promise.resolve({ ok: true, status: 200, json: async () => ({}) });
    }
    if (u.includes('/finalize')) {
      return Promise.resolve({ ok: true, status: 200, json: async () => ({}) });
    }
    if (u.includes('/cash') && init?.method === 'PUT') {
      return Promise.resolve({ ok: true, status: 200, json: async () => ({}) });
    }
    if (u.includes('/api/mw/financial/savings/admin-set')) {
      return Promise.resolve({ ok: true, status: 200, json: async () => ({}) });
    }
    if (u.includes('/api/mw/financial/savings')) {
      return Promise.resolve({ ok: true, status: 200, json: async () => SAVINGS });
    }
    if (u.includes('/api/admin/export')) {
      return Promise.resolve({
        ok: true,
        status: 200,
        headers: {
          get: (name: string) =>
            name === 'Content-Disposition'
              ? 'attachment; filename="familyhub-export-khans-2026-06-15.json"'
              : null,
        },
        blob: async () => new Blob([JSON.stringify(EXPORT_PAYLOAD)], { type: 'application/json' }),
      });
    }
    if (u.includes('/api/admin/delete-account')) {
      return Promise.resolve({ ok: true, status: 200, json: async () => ({ deleted: true }) });
    }
    if (u.includes('/api/admin/settings/')) {
      return Promise.resolve({ ok: true, status: 200, json: async () => ({}) });
    }
    if (u.includes('/api/admin/settings')) {
      return Promise.resolve({ ok: true, status: 200, json: async () => appSettings });
    }
    // Fallback
    return Promise.resolve({ ok: true, status: 200, json: async () => ({}) });
  });
}

function renderAt(path = '/t/khans/admin') {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route
          path="/t/:slug/admin"
          element={
            <TenantProvider>
              <AdminPanelPage />
            </TenantProvider>
          }
        />
        <Route path="/t/:slug/members" element={<div data-testid="members-page" />} />
        <Route path="/t/:slug/dashboard" element={<div data-testid="dashboard-page" />} />
        <Route path="/" element={<div data-testid="home-page" />} />
      </Routes>
    </MemoryRouter>,
  );
}

beforeEach(() => {
  fetchMock.mockReset();
  vi.stubGlobal('fetch', fetchMock);
  authState.session = { access_token: 'tok-admin' };
  authState.user = { email: 'sarah@example.com', id: 'u-admin', user_metadata: {} };
  vi.mocked(signOutAll).mockClear();
  installApi();
});

afterEach(() => {
  vi.unstubAllGlobals();
});

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('<AdminPanelPage />', () => {
  it('redirects a non-admin/adult caller away from the admin panel', async () => {
    fetchMock.mockImplementation((url: string) => {
      const u = String(url);
      if (u.includes('/api/members')) {
        return Promise.resolve({
          ok: true,
          status: 200,
          json: async () => ({ members: MEMBERS, callerRole: 'child' }),
        });
      }
      return Promise.resolve({ ok: true, status: 200, json: async () => ({}) });
    });
    renderAt();
    await waitFor(() => expect(screen.getByTestId('dashboard-page')).toBeInTheDocument());
    expect(screen.queryByTestId('admin-panel')).not.toBeInTheDocument();
  });

  it('redirects a normal-user adult away from the admin panel (FHS-343)', async () => {
    installApi('adult');
    renderAt();
    await waitFor(() => expect(screen.getByTestId('dashboard-page')).toBeInTheDocument());
    expect(screen.queryByTestId('admin-panel')).not.toBeInTheDocument();
  });

  it('renders the gradient header and child selector on Balance tab', async () => {
    renderAt();
    await waitFor(() => expect(screen.getByTestId('admin-panel')).toBeInTheDocument());
    // Orange→pink gradient header
    expect(screen.getByText('Admin Panel')).toBeInTheDocument();
    // Child selector renders Amina
    await waitFor(() =>
      expect(screen.getByTestId(`admin-child-selector-${CHILD_ID}`)).toBeInTheDocument(),
    );
  });

  it('shows the global app header (brand home button) on the admin panel', async () => {
    renderAt();
    await waitFor(() => expect(screen.getByTestId('admin-panel')).toBeInTheDocument());
    expect(screen.getByTestId('dashboard-brand-home')).toBeInTheDocument();
  });

  it('Balance tab shows available stickers and cash value for the selected child', async () => {
    renderAt();
    await waitFor(() => expect(screen.getByTestId('admin-balance-ready')).toBeInTheDocument());
    expect(screen.getByTestId('admin-balance-stickers-display').textContent).toBe('12');
    // FHS-614: formatted through the shared helper. This test mocks no
    // currency, so it falls back to USD, the same fallback the database and
    // every other screen use.
    expect(screen.getByTestId('admin-balance-cash-display').textContent).toBe('$6.00');
  });

  // FHS-512: the Balance tab must show the SERVER-computed cashValue
  // verbatim, never recompute it client-side at a hardcoded 0.5. Uses a
  // cashValue that would NOT match stickers*0.5, so a regression to the old
  // client-side recompute fails this test.
  it('Balance tab shows the cash value from the API, not a client-side 0.5 recompute', async () => {
    fetchMock.mockImplementation((url: string) => {
      const u = String(url);
      if (/\/api\/me(\?|$)/.test(u))
        return Promise.resolve({
          ok: true,
          status: 200,
          json: async () => ({
            id: 'u-admin',
            email: 'sarah@example.com',
            tenants: [{ id: 't-1', slug: 'khans', name: 'The Khans', role: 'admin' }],
          }),
        });
      if (u.includes('/api/dashboard/today'))
        return Promise.resolve({
          ok: true,
          status: 200,
          json: async () => ({ date: '2026-06-15', callerMemberId: 'admin-1', members: [] }),
        });
      if (u.includes('/api/members'))
        return Promise.resolve({
          ok: true,
          status: 200,
          json: async () => ({ members: MEMBERS, callerRole: 'admin' }),
        });
      if (u.includes('/api/mw/weeks/current'))
        return Promise.resolve({
          ok: true,
          status: 200,
          json: async () => ({ week: CURRENT_WEEK }),
        });
      if (u.includes('/api/mw/weeks/') && u.includes('/stats'))
        return Promise.resolve({
          ok: true,
          status: 200,
          // 12 stickers at a 1.25 rate = 15.00: NOT 6.00 (12 * the old
          // hardcoded 0.5). A client-side recompute would show the wrong number.
          json: async () => ({
            weekId: WEEK_ID,
            totalStickers: 20,
            unallocatedStickers: 12,
            allocatedStickers: 8,
            cashValue: 15,
          }),
        });
      return Promise.resolve({ ok: true, status: 200, json: async () => ({}) });
    });
    renderAt();
    await waitFor(() => expect(screen.getByTestId('admin-balance-ready')).toBeInTheDocument());
    expect(screen.getByTestId('admin-balance-cash-display').textContent).toContain('15.00');
    expect(screen.getByTestId('admin-balance-cash-display').textContent).not.toContain('6.00');
  });

  it('renders all five Quick Action buttons', async () => {
    renderAt();
    await waitFor(() => expect(screen.getByTestId('admin-balance-ready')).toBeInTheDocument());
    expect(screen.getByTestId('admin-balance-action-claim')).toBeInTheDocument();
    expect(screen.getByTestId('admin-balance-action-cashout')).toBeInTheDocument();
    expect(screen.getByTestId('admin-balance-action-save')).toBeInTheDocument();
    expect(screen.getByTestId('admin-balance-action-invest')).toBeInTheDocument();
    expect(screen.getByTestId('admin-balance-action-withdraw')).toBeInTheDocument();
  });

  it('FHS-416: invest with too few stickers shows a clear reason, not the raw 409', async () => {
    const HABIT = { id: 'habit-1', name: 'Read a book' };
    fetchMock.mockImplementation((url: string, init?: RequestInit) => {
      const u = String(url);
      if (/\/api\/me(\?|$)/.test(u))
        return Promise.resolve({
          ok: true,
          status: 200,
          json: async () => ({
            id: 'u-admin',
            email: 'sarah@example.com',
            tenants: [{ id: 't-1', slug: 'khans', name: 'The Khans', role: 'admin' }],
          }),
        });
      if (u.includes('/api/dashboard/today'))
        return Promise.resolve({
          ok: true,
          status: 200,
          json: async () => ({ date: '2026-06-15', callerMemberId: 'admin-1', members: [] }),
        });
      if (u.includes('/api/members'))
        return Promise.resolve({
          ok: true,
          status: 200,
          json: async () => ({ members: MEMBERS, callerRole: 'admin' }),
        });
      if (u.includes('/api/mw/weeks/current'))
        return Promise.resolve({
          ok: true,
          status: 200,
          json: async () => ({ week: CURRENT_WEEK }),
        });
      if (u.includes('/stats'))
        return Promise.resolve({ ok: true, status: 200, json: async () => WEEK_STATS });
      if (u.includes('/api/habits'))
        return Promise.resolve({ ok: true, status: 200, json: async () => ({ habits: [HABIT] }) });
      if (u.includes('/api/mw/financial/investments') && init?.method === 'POST')
        return Promise.resolve({
          ok: false,
          status: 409,
          json: async () => ({
            error: 'not enough stickers',
            errorCode: 'INSUFFICIENT_STICKERS',
            available: 1,
          }),
        });
      return Promise.resolve({ ok: true, status: 200, json: async () => ({}) });
    });
    renderAt();
    await waitFor(() => expect(screen.getByTestId('admin-balance-ready')).toBeInTheDocument());
    act(() => {
      fireEvent.click(screen.getByTestId('admin-balance-action-invest'));
    });
    fireEvent.change(await screen.findByTestId('admin-quick-action-invest-amount'), {
      target: { value: '10' },
    });
    fireEvent.click(await screen.findByText('Read a book'));
    act(() => {
      fireEvent.click(screen.getByTestId('admin-quick-action-invest-submit'));
    });
    // Friendly reason with have-vs-need, NOT the raw status code.
    await screen.findByText(/Not enough stickers to invest.*1 available.*10 needed/);
    expect(screen.queryByText(/Invest failed: 409/)).not.toBeInTheDocument();
  });

  it('switching to Savings tab fetches and renders savings data', async () => {
    renderAt();
    await waitFor(() => expect(screen.getByTestId('admin-panel-tab-savings')).toBeInTheDocument());
    act(() => {
      fireEvent.click(screen.getByTestId('admin-panel-tab-savings'));
    });
    await waitFor(() => expect(screen.getByTestId('admin-savings-ready')).toBeInTheDocument());
    expect(screen.getByTestId('admin-savings-cash-display').textContent).toContain('3.50');
    expect(screen.getByTestId('admin-savings-sticker-display').textContent).toBe('5');
  });

  it('Savings tab shows the family currency from the API, not a hardcoded AED (FHS-441)', async () => {
    fetchMock.mockImplementation((url: string) => {
      const u = String(url);
      if (/\/api\/me(\?|$)/.test(u))
        return Promise.resolve({
          ok: true,
          status: 200,
          json: async () => ({
            id: 'u-admin',
            email: 'sarah@example.com',
            tenants: [{ id: 't-1', slug: 'khans', name: 'The Khans', role: 'admin' }],
          }),
        });
      if (u.includes('/api/dashboard/today'))
        return Promise.resolve({
          ok: true,
          status: 200,
          json: async () => ({ date: '2026-06-15', callerMemberId: 'admin-1', members: [] }),
        });
      if (u.includes('/api/members'))
        return Promise.resolve({
          ok: true,
          status: 200,
          json: async () => ({ members: MEMBERS, callerRole: 'admin' }),
        });
      if (u.includes('/api/reward-config'))
        return Promise.resolve({ ok: true, status: 200, json: async () => ({ currency: 'GBP' }) });
      if (u.includes('/api/mw/financial/savings'))
        return Promise.resolve({
          ok: true,
          status: 200,
          json: async () => ({ ...SAVINGS, currency: 'GBP' }),
        });
      return Promise.resolve({ ok: true, status: 200, json: async () => ({}) });
    });
    renderAt();
    await waitFor(() => expect(screen.getByTestId('admin-panel-tab-savings')).toBeInTheDocument());
    act(() => {
      fireEvent.click(screen.getByTestId('admin-panel-tab-savings'));
    });
    await waitFor(() => expect(screen.getByTestId('admin-savings-ready')).toBeInTheDocument());
    // FHS-614: a British family reads "£3.50", never "GBP 3.50".
    const shown = screen.getByTestId('admin-savings-cash-display').textContent ?? '';
    expect(shown).toContain('£');
    expect(shown).not.toContain('GBP');
    expect(screen.getByTestId('admin-savings-cash-display').textContent).not.toContain('AED');
  });

  // FHS-512: the sticker→cash conversion must use THIS child's configured
  // rate, never a hardcoded 0.5. Locks the regression where a non-default
  // rate would previously be silently ignored client-side.
  it('Savings tab converts saved stickers to cash using the configured rate, not a hardcoded 0.5', async () => {
    fetchMock.mockImplementation((url: string) => {
      const u = String(url);
      if (/\/api\/me(\?|$)/.test(u))
        return Promise.resolve({
          ok: true,
          status: 200,
          json: async () => ({
            id: 'u-admin',
            email: 'sarah@example.com',
            tenants: [{ id: 't-1', slug: 'khans', name: 'The Khans', role: 'admin' }],
          }),
        });
      if (u.includes('/api/dashboard/today'))
        return Promise.resolve({
          ok: true,
          status: 200,
          json: async () => ({ date: '2026-06-15', callerMemberId: 'admin-1', members: [] }),
        });
      if (u.includes('/api/members'))
        return Promise.resolve({
          ok: true,
          status: 200,
          json: async () => ({ members: MEMBERS, callerRole: 'admin' }),
        });
      if (u.includes('/api/mw/financial/savings'))
        return Promise.resolve({
          ok: true,
          status: 200,
          // 5 saved stickers + 0 saved cash at a 1.00 rate = 5.00, NOT 2.50
          // (what a hardcoded 0.5 would wrongly compute).
          json: async () => ({
            savedStickers: 5,
            savedCash: 0,
            currency: 'AED',
            stickerRate: 1,
            stickerRateMinor: 100,
          }),
        });
      return Promise.resolve({ ok: true, status: 200, json: async () => ({}) });
    });
    renderAt();
    await waitFor(() => expect(screen.getByTestId('admin-panel-tab-savings')).toBeInTheDocument());
    act(() => {
      fireEvent.click(screen.getByTestId('admin-panel-tab-savings'));
    });
    await waitFor(() => expect(screen.getByTestId('admin-savings-ready')).toBeInTheDocument());
    expect(screen.getByTestId('admin-savings-cash-equivalent').textContent).toContain('5.00');
    expect(screen.getByTestId('admin-savings-cash-equivalent').textContent).not.toContain('2.50');
  });

  it('Savings edit issues PUT to admin-set endpoint', async () => {
    renderAt();
    await waitFor(() => expect(screen.getByTestId('admin-panel-tab-savings')).toBeInTheDocument());
    act(() => {
      fireEvent.click(screen.getByTestId('admin-panel-tab-savings'));
    });
    await waitFor(() => expect(screen.getByTestId('admin-savings-edit-btn')).toBeInTheDocument());
    act(() => {
      fireEvent.click(screen.getByTestId('admin-savings-edit-btn'));
    });
    await waitFor(() => expect(screen.getByTestId('admin-savings-cash-input')).toBeInTheDocument());
    act(() => {
      fireEvent.change(screen.getByTestId('admin-savings-cash-input'), {
        target: { value: '10' },
      });
      fireEvent.change(screen.getByTestId('admin-savings-sticker-input'), {
        target: { value: '8' },
      });
    });
    await act(async () => {
      fireEvent.click(screen.getByTestId('admin-savings-save-btn'));
    });
    await waitFor(() => {
      const putCall = fetchMock.mock.calls.find(
        ([u, init]) =>
          String(u).includes('/api/mw/financial/savings/admin-set') && init?.method === 'PUT',
      );
      expect(putCall).toBeTruthy();
      const body = JSON.parse((putCall![1] as RequestInit).body as string) as {
        memberId: string;
        savedStickers: number;
        savedCash: number;
      };
      expect(body.memberId).toBe(CHILD_ID);
      expect(body.savedCash).toBe(10);
      expect(body.savedStickers).toBe(8);
    });
  });

  // FHS-614 review: the History tab renders seven money figures (carried and
  // retrieved cash, the action log, the editable labels) and not one of them
  // was asserted, so a wrong conversion there would have shipped in silence.
  it('History tab writes its cash figures the family way', async () => {
    installApi('admin', APP_SETTINGS, 'GBP');
    renderAt();
    await waitFor(() => expect(screen.getByTestId('admin-panel-tab-history')).toBeInTheDocument());
    act(() => {
      fireEvent.click(screen.getByTestId('admin-panel-tab-history'));
    });
    await waitFor(() => expect(screen.getByTestId('admin-history-ready')).toBeInTheDocument());
    const shown = screen.getByTestId('admin-history-ready').textContent ?? '';
    // The finalized week carried 1.00 and retrieved 0.50.
    expect(shown).toContain('£1.00');
    expect(shown).toContain('£0.50');
    expect(shown).not.toContain('GBP');
    expect(shown).not.toContain('AED');
  });

  it('History tab shows week list with Active and Finalized rows', async () => {
    renderAt();
    await waitFor(() => expect(screen.getByTestId('admin-panel-tab-history')).toBeInTheDocument());
    act(() => {
      fireEvent.click(screen.getByTestId('admin-panel-tab-history'));
    });
    await waitFor(() => expect(screen.getByTestId('admin-history-ready')).toBeInTheDocument());
    expect(screen.getByTestId(`admin-history-week-${WEEK_ID}`)).toBeInTheDocument();
    expect(screen.getByTestId('admin-history-week-week-prev')).toBeInTheDocument();
    // Active week has Repair + Close Week buttons
    expect(screen.getByTestId(`admin-history-week-repair-btn-${WEEK_ID}`)).toBeInTheDocument();
    expect(screen.getByTestId(`admin-history-week-close-btn-${WEEK_ID}`)).toBeInTheDocument();
    // Finalized week has Reopen button
    expect(screen.getByTestId('admin-history-week-reopen-btn-week-prev')).toBeInTheDocument();
    // FHS-444: "Week 23" alone reads like a mystery code; the real Mon–Sun
    // date range shows right next to it (UTC-anchored, matches startDate).
    expect(screen.getByTestId(`admin-history-week-${WEEK_ID}-range`).textContent).toMatch(
      /Jun 1.*Jun 7/,
    );
  });

  it('History reopen opens ConfirmDialog and POSTs to /reopen on confirm', async () => {
    renderAt();
    await waitFor(() => expect(screen.getByTestId('admin-panel-tab-history')).toBeInTheDocument());
    act(() => {
      fireEvent.click(screen.getByTestId('admin-panel-tab-history'));
    });
    await waitFor(() =>
      expect(screen.getByTestId('admin-history-week-reopen-btn-week-prev')).toBeInTheDocument(),
    );
    act(() => {
      fireEvent.click(screen.getByTestId('admin-history-week-reopen-btn-week-prev'));
    });
    // ConfirmDialog should be open
    await waitFor(() =>
      expect(screen.getByTestId('admin-history-reopen-confirm')).toBeInTheDocument(),
    );
    await act(async () => {
      fireEvent.click(screen.getByTestId('admin-history-reopen-confirm-confirm'));
    });
    await waitFor(() => {
      const reopenCall = fetchMock.mock.calls.find(
        ([u, init]) => String(u).includes('/reopen') && init?.method === 'POST',
      );
      expect(reopenCall).toBeTruthy();
    });
  });

  // FHS-455: App Info was renamed to Settings and its App Name/Subtitle
  // fields were dropped (they were never rendered anywhere else in the app).
  it('Settings tab no longer shows App Name/Subtitle fields; only Currency', async () => {
    renderAt();
    await waitFor(() => expect(screen.getByTestId('admin-panel-tab-settings')).toBeInTheDocument());
    act(() => {
      fireEvent.click(screen.getByTestId('admin-panel-tab-settings'));
    });
    await waitFor(() => expect(screen.getByTestId('admin-settings-ready')).toBeInTheDocument());

    expect(screen.getByTestId('admin-settings-currency-display').textContent).toBe('AED');
    expect(screen.queryByTestId('admin-app-info-name-display')).not.toBeInTheDocument();
    expect(screen.queryByTestId('admin-app-info-subtitle-display')).not.toBeInTheDocument();
    expect(screen.queryByText('App Name')).not.toBeInTheDocument();
    expect(screen.queryByText('Subtitle')).not.toBeInTheDocument();

    // The heading + tab label were renamed too (tab label asserted via its
    // testid above; "Settings" alone would also match the tab button text).
    expect(screen.getByText('Family settings')).toBeInTheDocument();
    expect(screen.queryByText('App Info')).not.toBeInTheDocument();
    expect(screen.queryByText('Family app settings')).not.toBeInTheDocument();
  });

  it('Settings tab shows the current currency and saving a new one issues a currency PUT (FHS-441)', async () => {
    renderAt();
    await waitFor(() => expect(screen.getByTestId('admin-panel-tab-settings')).toBeInTheDocument());
    act(() => {
      fireEvent.click(screen.getByTestId('admin-panel-tab-settings'));
    });
    await waitFor(() => expect(screen.getByTestId('admin-settings-ready')).toBeInTheDocument());
    expect(screen.getByTestId('admin-settings-currency-display').textContent).toBe('AED');

    // Open edit: the CurrencyPicker starts on the currently-saved currency.
    act(() => {
      fireEvent.click(screen.getByTestId('admin-settings-edit-btn'));
    });
    await waitFor(() =>
      expect(screen.getByTestId('admin-settings-currency-trigger')).toBeInTheDocument(),
    );
    expect(screen.getByTestId('admin-settings-currency-trigger').textContent).toContain('AED');

    // Switch to GBP via the searchable dropdown.
    act(() => {
      fireEvent.click(screen.getByTestId('admin-settings-currency-trigger'));
    });
    const gbpOption = await screen.findByTestId('admin-settings-currency-option-GBP');
    act(() => {
      fireEvent.click(gbpOption);
    });
    await act(async () => {
      fireEvent.click(screen.getByTestId('admin-settings-save-btn'));
    });

    await waitFor(() => {
      const putCall = fetchMock.mock.calls.find(
        ([u, fetchInit]) =>
          String(u).includes('/api/admin/settings/currency') && fetchInit?.method === 'PUT',
      );
      expect(putCall).toBeTruthy();
      const body = JSON.parse((putCall![1] as RequestInit).body as string) as { value: string };
      expect(body.value).toBe('GBP');
    });
  });

  // FHS-435: GDPR: Download my data.
  it('Download my data calls GET /api/admin/export and triggers a file download', async () => {
    // jsdom doesn't implement the Blob URL APIs at all: define them first
    // so vi.spyOn has something to wrap.
    URL.createObjectURL ??= () => '';
    URL.revokeObjectURL ??= () => {};
    const createObjectURL = vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:mock-url');
    const revokeObjectURL = vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {});
    // jsdom doesn't understand the `download` attribute and tries to
    // "navigate" the fake blob: URL on click: stub the click so the test
    // only asserts the download was wired up, not a real navigation.
    const anchorClick = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});

    renderAt();
    await waitFor(() => expect(screen.getByTestId('admin-panel-tab-settings')).toBeInTheDocument());
    act(() => {
      fireEvent.click(screen.getByTestId('admin-panel-tab-settings'));
    });
    await waitFor(() => expect(screen.getByTestId('admin-settings-ready')).toBeInTheDocument());

    await act(async () => {
      fireEvent.click(screen.getByTestId('admin-settings-export-btn'));
    });

    await waitFor(() => {
      const exportCall = fetchMock.mock.calls.find(([u]) =>
        String(u).includes('/api/admin/export'),
      );
      expect(exportCall).toBeTruthy();
    });
    expect(createObjectURL).toHaveBeenCalled();
    expect(anchorClick).toHaveBeenCalled();
    expect(revokeObjectURL).toHaveBeenCalledWith('blob:mock-url');

    createObjectURL.mockRestore();
    revokeObjectURL.mockRestore();
    anchorClick.mockRestore();
  });

  // FHS-435: GDPR: Delete my account (irreversible; two-step confirm).
  describe('Delete my account', () => {
    async function openSettingsAndDeleteDialog() {
      renderAt();
      await waitFor(() =>
        expect(screen.getByTestId('admin-panel-tab-settings')).toBeInTheDocument(),
      );
      act(() => {
        fireEvent.click(screen.getByTestId('admin-panel-tab-settings'));
      });
      await waitFor(() => expect(screen.getByTestId('admin-settings-ready')).toBeInTheDocument());
      act(() => {
        fireEvent.click(screen.getByTestId('admin-settings-delete-btn'));
      });
      await waitFor(() =>
        expect(screen.getByTestId('admin-settings-delete-confirm')).toBeInTheDocument(),
      );
      // Family name is loaded async from /api/me: wait for it to render.
      await waitFor(() =>
        expect(screen.getByTestId('admin-settings-delete-family-name').textContent).toBe(
          'The Khans',
        ),
      );
    }

    it('keeps Delete disabled until the exact family name is typed', async () => {
      await openSettingsAndDeleteDialog();
      const confirmBtn = screen.getByTestId('admin-settings-delete-confirm-confirm');
      expect(confirmBtn).toBeDisabled();

      fireEvent.change(screen.getByTestId('admin-settings-delete-confirm-input'), {
        target: { value: 'Wrong Name' },
      });
      expect(confirmBtn).toBeDisabled();

      fireEvent.change(screen.getByTestId('admin-settings-delete-confirm-input'), {
        target: { value: 'The Khans' },
      });
      expect(confirmBtn).not.toBeDisabled();
    });

    it('calls POST /api/admin/delete-account and clears the session on success', async () => {
      await openSettingsAndDeleteDialog();
      fireEvent.change(screen.getByTestId('admin-settings-delete-confirm-input'), {
        target: { value: 'The Khans' },
      });
      await act(async () => {
        fireEvent.click(screen.getByTestId('admin-settings-delete-confirm-confirm'));
      });

      await waitFor(() => {
        const deleteCall = fetchMock.mock.calls.find(
          ([u, init]) => String(u).includes('/api/admin/delete-account') && init?.method === 'POST',
        );
        expect(deleteCall).toBeTruthy();
        const body = JSON.parse((deleteCall![1] as RequestInit).body as string) as {
          confirm: string;
        };
        expect(body.confirm).toBe('The Khans');
      });
      await waitFor(() => expect(signOutAll).toHaveBeenCalled());
      await waitFor(() => expect(screen.getByTestId('home-page')).toBeInTheDocument());
    });

    it('shows an error and does not sign out when the API rejects the request', async () => {
      fetchMock.mockImplementation((url: string) => {
        const u = String(url);
        if (u.includes('/api/admin/delete-account')) {
          return Promise.resolve({
            ok: false,
            status: 400,
            json: async () => ({
              error: 'confirmation mismatch',
              errorCode: 'CONFIRM_MISMATCH',
              detail: 'confirm must match the family name exactly',
            }),
          });
        }
        if (/\/api\/me(\?|$)/.test(u)) {
          return Promise.resolve({
            ok: true,
            status: 200,
            json: async () => ({
              id: 'u-admin',
              email: 'sarah@example.com',
              tenants: [{ id: 't-1', slug: 'khans', name: 'The Khans', role: 'admin' }],
            }),
          });
        }
        if (u.includes('/api/members')) {
          return Promise.resolve({
            ok: true,
            status: 200,
            json: async () => ({ members: MEMBERS, callerRole: 'admin' }),
          });
        }
        return Promise.resolve({ ok: true, status: 200, json: async () => ({}) });
      });
      await openSettingsAndDeleteDialog();
      fireEvent.change(screen.getByTestId('admin-settings-delete-confirm-input'), {
        target: { value: 'The Khans' },
      });
      await act(async () => {
        fireEvent.click(screen.getByTestId('admin-settings-delete-confirm-confirm'));
      });

      await waitFor(() =>
        expect(screen.getByTestId('admin-settings-delete-error').textContent).toContain(
          'confirm must match the family name exactly',
        ),
      );
      expect(signOutAll).not.toHaveBeenCalled();
      expect(screen.queryByTestId('home-page')).not.toBeInTheDocument();
    });
  });

  // FHS-535: the read-only "Users" tab was removed (redundant with Manage
  // Members); add a guard that it no longer appears.
  it('has no Users tab (member management lives on Manage Members)', async () => {
    renderAt();
    await waitFor(() => expect(screen.getByTestId('admin-panel-tab-balance')).toBeInTheDocument());
    expect(screen.queryByTestId('admin-panel-tab-users')).not.toBeInTheDocument();
  });

  it('passes bearer token and tenant slug on every request', async () => {
    renderAt();
    await waitFor(() => expect(fetchMock).toHaveBeenCalled());
    const firstCall = fetchMock.mock.calls[0];
    expect((firstCall![1] as RequestInit).headers).toMatchObject({
      Authorization: 'Bearer tok-admin',
      'x-tenant-slug': 'khans',
    });
  });

  it('selecting a different child from the selector re-fetches Balance data', async () => {
    // Add a second child to members
    const secondChildId = 'child-uuid-2222';
    fetchMock.mockImplementation((url: string) => {
      const u = String(url);
      if (u.includes('/api/members')) {
        return Promise.resolve({
          ok: true,
          status: 200,
          json: async () => ({
            members: [
              ...MEMBERS,
              {
                id: secondChildId,
                displayName: 'Ibrahim',
                role: 'child',
                avatarEmoji: null,
                isChild: true,
              },
            ],
            callerRole: 'admin',
          }),
        });
      }
      if (u.includes('/api/mw/weeks/current')) {
        return Promise.resolve({
          ok: true,
          status: 200,
          json: async () => ({ week: CURRENT_WEEK }),
        });
      }
      if (u.includes('/stats')) {
        return Promise.resolve({ ok: true, status: 200, json: async () => WEEK_STATS });
      }
      return Promise.resolve({ ok: true, status: 200, json: async () => ({}) });
    });

    renderAt();
    await waitFor(() =>
      expect(screen.getByTestId(`admin-child-selector-${CHILD_ID}`)).toBeInTheDocument(),
    );
    await waitFor(() =>
      expect(screen.getByTestId(`admin-child-selector-${secondChildId}`)).toBeInTheDocument(),
    );
    act(() => {
      fireEvent.click(screen.getByTestId(`admin-child-selector-${secondChildId}`));
    });
    // Stats should be re-fetched for the new child
    await waitFor(() => {
      const statsCalls = fetchMock.mock.calls.filter(
        ([u]) => String(u).includes('/stats') && String(u).includes(secondChildId),
      );
      expect(statsCalls.length).toBeGreaterThan(0);
    });
  });
});
