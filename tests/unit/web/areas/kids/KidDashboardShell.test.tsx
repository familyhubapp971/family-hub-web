import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor, fireEvent, act } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';

// FHS-257 / FHS-362: kid dashboard shell. Renders for a child signed in
// with a kid JWT: the MP header (avatar + name + banked stars/cash), the
// six-tab kid world (My World, Meals, Calendar, Journal, Learn, Tasks: no parent
// profile pill / admin links), and a Switch user button that drops the token
// + returns to kid-login. My World carries the kid's habits + tasks.

import { KidDashboardShell } from '../../../../../src/areas/kids/KidDashboardShell';
import { TenantProvider } from '../../../../../src/app/lib/tenant-context';
import { AuthProvider, KID_TOKEN_STORAGE_KEY } from '../../../../../src/app/lib/auth-context';

const fetchMock = vi.fn();

function b64url(obj: unknown): string {
  return btoa(JSON.stringify(obj)).replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');
}
function fakeKidJwt(expSecondsFromNow = 3600): string {
  const header = b64url({ alg: 'HS256', typ: 'JWT' });
  const payload = b64url({
    exp: Math.floor(Date.now() / 1000) + expSecondsFromNow,
    scope: 'child',
  });
  return `${header}.${payload}.sig`;
}

function renderShell(entry = '/t/khan/dashboard') {
  return render(
    <MemoryRouter initialEntries={[entry]}>
      <Routes>
        <Route
          path="/t/:slug/dashboard"
          element={
            <AuthProvider>
              <TenantProvider>
                <KidDashboardShell />
              </TenantProvider>
            </AuthProvider>
          }
        />
        <Route
          path="/t/:slug/kid-login"
          element={<div data-testid="kid-login-page">KID LOGIN</div>}
        />
      </Routes>
    </MemoryRouter>,
  );
}

// The shell makes two boot calls: GET /api/kid/me (session confirm) and
// GET /api/kid/profile (header). This default routes both; the My World
// data feeds (today/tasks) fall through to empty.
function mockKidBoot(over?: (url: string) => unknown) {
  fetchMock.mockImplementation((url: string) => {
    const u = String(url);
    const custom = over?.(u);
    if (custom !== undefined) {
      return Promise.resolve({ ok: true, status: 200, json: async () => custom });
    }
    if (u.includes('/api/kid/profile')) {
      return Promise.resolve({
        ok: true,
        status: 200,
        json: async () => ({
          displayName: 'Amina',
          avatarEmoji: '🦊',
          savedStickers: 12,
          savedCash: 6,
          currency: 'AED',
        }),
      });
    }
    if (u.includes('/api/kid/weeks')) {
      return Promise.resolve({ ok: true, status: 200, json: async () => ({ weeks: [] }) });
    }
    if (u.includes('/api/kid/habits')) {
      return Promise.resolve({
        ok: true,
        status: 200,
        json: async () => ({
          habits: [],
          stickers: [],
          week: {
            id: 'w1',
            weekNumber: 24,
            year: 2026,
            startDate: '2026-06-15',
            isFinalized: false,
          },
          balance: 0,
          currency: 'AED',
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
    if (u.includes('/api/kid/financial')) {
      return Promise.resolve({
        ok: true,
        status: 200,
        json: async () => ({ savedStickers: 0, savedCash: 0, currency: 'AED', investments: [] }),
      });
    }
    if (u.includes('/api/kid/meals')) {
      return Promise.resolve({ ok: true, status: 200, json: async () => ({ meals: [] }) });
    }
    if (u.includes('/api/kid/events')) {
      return Promise.resolve({
        ok: true,
        status: 200,
        json: async () => ({ weekStart: '2026-06-15', events: [] }),
      });
    }
    if (u.includes('/api/kid/analytics')) {
      return Promise.resolve({
        ok: true,
        status: 200,
        json: async () => ({ stickersPerWeek: [], habitStats: [] }),
      });
    }
    if (u.includes('/api/kid/journal/entries')) {
      return Promise.resolve({ ok: true, status: 200, json: async () => ({ entries: [] }) });
    }
    if (u.includes('/api/kid/journal/earliest')) {
      return Promise.resolve({ ok: true, status: 200, json: async () => ({ earliest: null }) });
    }
    if (u.includes('/api/kid/journal')) {
      return Promise.resolve({ ok: true, status: 200, json: async () => ({}) });
    }
    // /api/kid/me + any unrouted feed.
    return Promise.resolve({
      ok: true,
      status: 200,
      json: async () => ({ memberId: 'm1', tenantId: 't1', tenantSlug: 'khan' }),
    });
  });
}

beforeEach(() => {
  localStorage.clear();
  fetchMock.mockReset();
  mockKidBoot();
  vi.stubGlobal('fetch', fetchMock);
});

afterEach(() => {
  vi.unstubAllGlobals();
  localStorage.clear();
});

describe('<KidDashboardShell />', () => {
  it('renders the six kid tabs and a Switch user button', async () => {
    localStorage.setItem(KID_TOKEN_STORAGE_KEY, fakeKidJwt());
    renderShell();
    await waitFor(() => expect(screen.getByTestId('kid-dashboard')).toBeInTheDocument());
    expect(screen.getByTestId('kid-switch-user')).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: /My World/ })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: /Meals/ })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: /Calendar/ })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: /Journal/ })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: /Learn/ })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: /Tasks/ })).toBeInTheDocument();
  });

  it('shows the kid name + banked stars from GET /api/kid/profile', async () => {
    localStorage.setItem(KID_TOKEN_STORAGE_KEY, fakeKidJwt());
    renderShell();
    await waitFor(() => expect(screen.getByTestId('kid-title')).toHaveTextContent(/Amina/));
    // FHS-376: the header is now a single Stars pill (the mock dropped the
    // separate cash chip); a "Magic Active" status pill sits under the name.
    expect(screen.getByTestId('kid-stars')).toHaveTextContent('12 Stars');
    expect(screen.queryByTestId('kid-cash')).not.toBeInTheDocument();
    expect(screen.getByTestId('kid-status-pill')).toHaveTextContent(/Magic Active/);
  });

  it('falls back to the generic header when GET /api/kid/profile fails (404)', async () => {
    localStorage.setItem(KID_TOKEN_STORAGE_KEY, fakeKidJwt());
    fetchMock.mockImplementation((url: string) => {
      if (String(url).includes('/api/kid/profile')) {
        return Promise.resolve({ ok: false, status: 404, json: async () => ({}) });
      }
      return Promise.resolve({
        ok: true,
        status: 200,
        json: async () => ({ memberId: 'm1', tenantId: 't1', tenantSlug: 'khan' }),
      });
    });
    renderShell();
    await waitFor(() => expect(screen.getByTestId('kid-dashboard')).toBeInTheDocument());
    // No crash; the header shows the generic brand and no balance chips.
    expect(screen.getByTestId('kid-title')).toHaveTextContent('My Hub');
    expect(screen.queryByTestId('kid-balance')).not.toBeInTheDocument();
  });

  it('shows none of the parent profile / admin affordances', async () => {
    localStorage.setItem(KID_TOKEN_STORAGE_KEY, fakeKidJwt());
    renderShell();
    await waitFor(() => expect(screen.getByTestId('kid-dashboard')).toBeInTheDocument());
    expect(screen.queryByTestId('dashboard-profile-pill')).not.toBeInTheDocument();
    expect(screen.queryByRole('tab', { name: /Members/ })).not.toBeInTheDocument();
  });

  it('confirms the kid session against GET /api/kid/me', async () => {
    localStorage.setItem(KID_TOKEN_STORAGE_KEY, fakeKidJwt());
    renderShell();
    await waitFor(() =>
      expect(fetchMock.mock.calls.some(([u]) => String(u).includes('/api/kid/me'))).toBe(true),
    );
    const meCall = fetchMock.mock.calls.find(([u]) => String(u).includes('/api/kid/me'))!;
    expect((meCall[1] as RequestInit).headers).toMatchObject({
      Authorization: expect.stringContaining('Bearer '),
    });
  });

  it('switches the active tab', async () => {
    localStorage.setItem(KID_TOKEN_STORAGE_KEY, fakeKidJwt());
    renderShell();
    await waitFor(() => expect(screen.getByTestId('kid-panel-world')).toBeInTheDocument());
    act(() => {
      fireEvent.click(screen.getByRole('tab', { name: /Calendar/ }));
    });
    expect(screen.getByTestId('kid-panel-calendar')).toBeInTheDocument();
  });

  it('Meals tab shows the kid meals from GET /api/kid/meals', async () => {
    localStorage.setItem(KID_TOKEN_STORAGE_KEY, fakeKidJwt());
    mockKidBoot((u) =>
      u.includes('/api/kid/meals')
        ? {
            meals: [
              {
                id: 'm1',
                dayOfWeek: 'mon',
                slot: 'lunch',
                name: 'Pasta',
                memberId: null,
                recurring: false,
              },
            ],
          }
        : undefined,
    );
    renderShell();
    await waitFor(() => expect(screen.getByTestId('kid-dashboard')).toBeInTheDocument());
    act(() => {
      fireEvent.click(screen.getByRole('tab', { name: /Meals/ }));
    });
    await waitFor(() => expect(screen.getByTestId('kid-meals-tab')).toBeInTheDocument());
    expect(screen.getByText('Pasta')).toBeInTheDocument();
  });

  // FHS-386: Notices was removed from the kid view; the tab must not render.
  it('has no Notices tab (removed in FHS-386)', async () => {
    localStorage.setItem(KID_TOKEN_STORAGE_KEY, fakeKidJwt());
    renderShell();
    await waitFor(() => expect(screen.getByTestId('kid-dashboard')).toBeInTheDocument());
    expect(screen.queryByRole('tab', { name: /Notices/ })).not.toBeInTheDocument();
  });

  // FHS-386: a stale ?tab=notices link must not strand the kid; tabs are
  // in-memory and default to My World, so it falls back gracefully.
  it('ignores a stale ?tab=notices deep link and lands on My World (FHS-386)', async () => {
    localStorage.setItem(KID_TOKEN_STORAGE_KEY, fakeKidJwt());
    renderShell('/t/khan/dashboard?tab=notices');
    await waitFor(() => expect(screen.getByTestId('kid-dashboard')).toBeInTheDocument());
    expect(screen.queryByRole('tab', { name: /Notices/ })).not.toBeInTheDocument();
    expect(screen.getByRole('tab', { name: /My World/ })).toHaveAttribute('aria-selected', 'true');
  });

  // FHS-370: Tasks is its own kid tab now (off My World); ticking PATCHes.
  it('Tasks tab lists the kid tasks and ticking one PATCHes /api/kid/tasks/:id', async () => {
    localStorage.setItem(KID_TOKEN_STORAGE_KEY, fakeKidJwt());
    const patchCalls: string[] = [];
    fetchMock.mockImplementation((url: string) => {
      const u = String(url);
      if (u.includes('/api/kid/tasks/')) {
        patchCalls.push(u);
        return Promise.resolve({ ok: true, status: 200, json: async () => ({ ok: true }) });
      }
      if (u.includes('/api/kid/tasks')) {
        return Promise.resolve({
          ok: true,
          status: 200,
          json: async () => ({
            tasks: [{ id: 't1', title: 'Brush teeth', dueDate: null, done: false }],
          }),
        });
      }
      if (u.includes('/api/kid/profile')) {
        return Promise.resolve({
          ok: true,
          status: 200,
          json: async () => ({
            displayName: 'Amina',
            avatarEmoji: '🦊',
            savedStickers: 0,
            savedCash: 0,
            currency: 'AED',
          }),
        });
      }
      return Promise.resolve({
        ok: true,
        status: 200,
        json: async () => ({ memberId: 'm1', tenantId: 't1', tenantSlug: 'khan' }),
      });
    });
    renderShell();
    await waitFor(() => expect(screen.getByTestId('kid-dashboard')).toBeInTheDocument());
    act(() => {
      fireEvent.click(screen.getByRole('tab', { name: /Tasks/ }));
    });
    await waitFor(() => expect(screen.getByTestId('kid-tasks-list')).toBeInTheDocument());
    expect(screen.getByText('Brush teeth')).toBeInTheDocument();
    await act(async () => {
      fireEvent.click(screen.getByTestId('kid-task-check'));
    });
    await waitFor(() => expect(patchCalls.length).toBe(1));
    expect(patchCalls[0]).toContain('/api/kid/tasks/t1');
  });

  // FHS-374: My World reuses the real (parent) My World screen in read-only
  // kid mode, fed by the self-scoped /api/kid/* endpoints.
  it('My World renders the real My World screen with the kid habits (read-only)', async () => {
    localStorage.setItem(KID_TOKEN_STORAGE_KEY, fakeKidJwt());
    mockKidBoot((u) => {
      if (u.endsWith('/api/kid/weeks'))
        return {
          weeks: [
            {
              id: 'w1',
              weekNumber: 24,
              year: 2026,
              startDate: '2026-06-15',
              isFinalized: false,
              carriedOverStickers: 0,
              carriedOverCash: 0,
              retrievedStickers: 0,
              retrievedCash: 0,
            },
          ],
        };
      if (u.includes('/api/kid/habits'))
        return {
          habits: [
            {
              id: 'h1',
              name: 'Read a book',
              description: null,
              color: 'bg-yellow-400',
              // 'heart' is an icon NAME: it must render a symbol, never the
              // literal text "heart" (the FHS-374 bug the reuse fixes).
              icon: 'heart',
              isBonus: false,
            },
          ],
          stickers: [],
          week: {
            id: 'w1',
            weekNumber: 24,
            year: 2026,
            startDate: '2026-06-15',
            isFinalized: false,
          },
          balance: 0,
          currency: 'AED',
        };
      return undefined;
    });
    const { container } = renderShell();
    await waitFor(() => expect(screen.getByText('Read a book')).toBeInTheDocument());
    // Icon bug locked: a Heart SVG renders, not the word "heart".
    expect(container.querySelector('.lucide-heart')).toBeInTheDocument();
    expect(screen.queryByText('heart')).not.toBeInTheDocument();
    // Read-only: none of the write controls render for a kid.
    expect(screen.queryByTestId('habit-card-edit-btn-h1')).not.toBeInTheDocument();
    expect(screen.queryByTestId('habit-card-delete-btn-h1')).not.toBeInTheDocument();
    expect(screen.queryByText('Add stickers')).not.toBeInTheDocument();
    expect(screen.queryByTestId('reward-buy-r1')).not.toBeInTheDocument();
  });

  // FHS-376: kid Reward Goals ("Ask for this") + My Account, and a kid can ask.
  it('kid My World shows Reward Goals (Ask for this) + My Account and can ask', async () => {
    localStorage.setItem(KID_TOKEN_STORAGE_KEY, fakeKidJwt());
    const postCalls: string[] = [];
    mockKidBoot((u) => {
      // (over() can't see method, so the request POST falls through to default: fine)
      if (u.endsWith('/api/kid/weeks'))
        return {
          weeks: [
            {
              id: 'w1',
              weekNumber: 24,
              year: 2026,
              startDate: '2026-06-15',
              isFinalized: false,
              carriedOverStickers: 0,
              carriedOverCash: 0,
              retrievedStickers: 0,
              retrievedCash: 0,
            },
          ],
        };
      if (u.includes('/api/kid/habits'))
        return {
          habits: [
            {
              id: 'h1',
              name: 'Read a book',
              description: null,
              color: 'bg-yellow-400',
              icon: 'star',
              isBonus: false,
            },
          ],
          stickers: [{ habitId: 'h1', day: 0, sticker: 'gold-star', stickerValue: 1 }],
          week: {
            id: 'w1',
            weekNumber: 24,
            year: 2026,
            startDate: '2026-06-15',
            isFinalized: false,
          },
          balance: 10,
          currency: 'AED',
        };
      if (u.endsWith('/api/kid/rewards'))
        return {
          rewards: [
            {
              id: 'rw1',
              name: 'Ice Cream',
              description: null,
              stickerCost: 5,
              icon: '🍦',
              requestStatus: 'none',
            },
          ],
          stickerBalance: 10,
        };
      // Affordability for asking is based on SAVINGS (what approval spends).
      if (u.includes('/api/kid/financial/savings'))
        return { savedStickers: 10, savedCash: 0, currency: 'AED' };
      return undefined;
    });
    // Capture the request POST.
    const base = fetchMock.getMockImplementation()!;
    fetchMock.mockImplementation((url: string, init?: RequestInit) => {
      const u = String(url);
      if (u.includes('/api/kid/rewards/rw1/request')) {
        postCalls.push(u);
        return Promise.resolve({
          ok: true,
          status: 200,
          json: async () => ({ id: 'req1', status: 'pending' }),
        });
      }
      return base(url, init);
    });

    renderShell();
    await waitFor(() => expect(screen.getByTestId('kid-my-account')).toBeInTheDocument());
    // FHS-376: My Account "earned this week" = sum of this week's habit
    // progress (1 sticker), worth 1 × 0.5 = AED 0.50.
    expect(screen.getByTestId('kid-account-cash')).toHaveTextContent('AED 0.50');
    // Reward goal shows "Ask for this"; clicking it confirms, then asks + flips
    // to pending (the kid mock affords it: balance 10 ≥ cost 5).
    expect(screen.getByText('Reward Goals')).toBeInTheDocument();
    await act(async () => {
      fireEvent.click(screen.getByTestId('reward-ask-rw1'));
    });
    await act(async () => {
      fireEvent.click(screen.getByTestId('reward-confirm-rw1'));
    });
    await waitFor(() => expect(postCalls.length).toBe(1));
    await waitFor(() => expect(screen.getByTestId('reward-pending-rw1')).toBeInTheDocument());
  });

  // FHS-376: kid Journal is read-only: Past Entries only, no "My Journal".
  it('kid Journal shows past entries only (no write tab)', async () => {
    localStorage.setItem(KID_TOKEN_STORAGE_KEY, fakeKidJwt());
    renderShell();
    await waitFor(() => expect(screen.getByTestId('kid-dashboard')).toBeInTheDocument());
    act(() => {
      fireEvent.click(screen.getByRole('tab', { name: /Journal/ }));
    });
    await waitFor(() => expect(screen.getByTestId('journal-tab')).toBeInTheDocument());
    expect(screen.queryByTestId('journal-subtab-write')).not.toBeInTheDocument();
    expect(screen.queryByTestId('journal-subtab-past')).not.toBeInTheDocument();
  });

  it('Switch user clears the kid token and returns to kid-login', async () => {
    localStorage.setItem(KID_TOKEN_STORAGE_KEY, fakeKidJwt());
    renderShell();
    await waitFor(() => expect(screen.getByTestId('kid-switch-user')).toBeInTheDocument());
    await act(async () => {
      fireEvent.click(screen.getByTestId('kid-switch-user'));
    });
    expect(localStorage.getItem(KID_TOKEN_STORAGE_KEY)).toBeNull();
    await waitFor(() => expect(screen.getByTestId('kid-login-page')).toBeInTheDocument());
  });

  it('bounces to kid-login when there is no kid token', async () => {
    renderShell();
    await waitFor(() => expect(screen.getByTestId('kid-login-page')).toBeInTheDocument());
  });

  it('ejects to kid-login when /api/kid/me returns 401 (revoked token)', async () => {
    localStorage.setItem(KID_TOKEN_STORAGE_KEY, fakeKidJwt());
    fetchMock.mockResolvedValue({ ok: false, status: 401, json: async () => ({}) });
    renderShell();
    await waitFor(() => expect(screen.getByTestId('kid-login-page')).toBeInTheDocument());
    expect(localStorage.getItem(KID_TOKEN_STORAGE_KEY)).toBeNull();
  });

  it('ejects when the token is for a different tenant than the URL', async () => {
    localStorage.setItem(KID_TOKEN_STORAGE_KEY, fakeKidJwt());
    fetchMock.mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ memberId: 'm1', tenantId: 't1', tenantSlug: 'other' }),
    });
    renderShell();
    await waitFor(() => expect(screen.getByTestId('kid-login-page')).toBeInTheDocument());
    expect(localStorage.getItem(KID_TOKEN_STORAGE_KEY)).toBeNull();
  });

  it('keeps the shell up when /api/kid/me fails with a network error', async () => {
    localStorage.setItem(KID_TOKEN_STORAGE_KEY, fakeKidJwt());
    fetchMock.mockRejectedValue(new Error('offline'));
    renderShell();
    await waitFor(() => expect(screen.getByTestId('kid-dashboard')).toBeInTheDocument());
    expect(screen.queryByTestId('kid-login-page')).not.toBeInTheDocument();
    expect(screen.getByTestId('kid-session-confirmed').textContent).toBe('');
  });
});
