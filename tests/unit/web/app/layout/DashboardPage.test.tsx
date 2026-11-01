import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, act, waitFor } from '@testing-library/react';
import { MemoryRouter, Routes, Route, useLocation } from 'react-router-dom';

// FHS-227 + FHS-261: Parent Dashboard shell. Tab framework invariants
// (6 tabs render, default = home, ?tab= drives the active panel) plus
// the FHS-261 header refactor: family-name hero replaces the plain
// "Family Hub" wordmark; profile pill dropdown replaces the email +
// Log out pair; per-tab icons + badge support are wired into TopNav.

const mocks = vi.hoisted(() => ({
  signOut: vi.fn(),
  signOutAll: vi.fn(),
  fetchMock: vi.fn(),
}));

vi.mock('../../../../../src/app/lib/supabase', () => ({
  supabase: { auth: { signOut: mocks.signOut } },
}));

const authState: {
  user: { email?: string; id?: string; user_metadata?: Record<string, unknown> } | null;
  session: { access_token?: string } | null;
} = {
  user: { email: 'sarah@example.com', id: 'u-1', user_metadata: {} },
  session: { access_token: 'tok-1' },
};
vi.mock('../../../../../src/app/lib/auth-context', () => ({
  useAuth: () => authState,
  signOutAll: mocks.signOutAll,
  // FHS-257: DashboardPage now branches to the kid shell when a kid
  // token is present. These parent tests have no kid token.
  getKidToken: () => null,
  clearKidToken: vi.fn(),
}));

vi.stubGlobal('fetch', mocks.fetchMock);

import { DashboardPage } from '../../../../../src/app/layout/DashboardPage';
import { TenantProvider } from '../../../../../src/app/lib/tenant-context';

function LocationProbe() {
  const loc = useLocation();
  return <span data-testid="location-search">{loc.search}</span>;
}

function renderAt(initial: string) {
  return render(
    <MemoryRouter initialEntries={[initial]}>
      {/* LocationProbe sits above <Routes> so it survives navigation
          and keeps reporting the current URL even after the dashboard
          route unmounts (e.g. when Add member pushes /t/<slug>/members). */}
      <LocationProbe />
      <Routes>
        <Route
          path="/t/:slug/dashboard"
          element={
            <TenantProvider>
              <DashboardPage />
            </TenantProvider>
          }
        />
        <Route path="/t/:slug/members" element={<div data-testid="members-route" />} />
        <Route
          path="/t/:slug/reward-settings"
          element={<div data-testid="reward-settings-route" />}
        />
        {/* FHS-621: the Admin Panel's two halves have their own doors. */}
        <Route path="/t/:slug/money" element={<div data-testid="money-route" />} />
        <Route
          path="/t/:slug/family-settings"
          element={<div data-testid="family-settings-route" />}
        />
        <Route path="/" element={<div data-testid="welcome-route" />} />
      </Routes>
    </MemoryRouter>,
  );
}

// Sensible defaults for /api/me and /api/dashboard/today so each test
// only overrides what it actually cares about.
function defaultFetchMocks() {
  mocks.fetchMock.mockImplementation(async (url: string) => {
    if (url.includes('/api/me')) {
      return {
        ok: true,
        json: async () => ({
          id: 'u-1',
          email: 'sarah@example.com',
          tenants: [{ id: 't-1', slug: 'khans', name: 'The Khans', role: 'admin' }],
        }),
      } as Response;
    }
    if (url.includes('/api/dashboard/today')) {
      return {
        ok: true,
        json: async () => ({
          date: '2026-06-10',
          greetingName: 'Sarah',
          callerMemberId: 'm-1',
          counts: {
            members: 4,
            habits: 5,
            rewards: 3,
            tasksDoneToday: 1,
            tasksTotalToday: 2,
            mealsPlanned: 2,
          },
          members: [
            {
              id: 'm-1',
              displayName: 'Sarah',
              role: 'admin',
              avatarEmoji: null,
              habitsDone: 0,
              habitsTotal: 0,
              streak: 0,
              tasksPending: 1,
              statusText: '1 task left',
              starBalance: 0,
              pendingSignup: false,
            },
            {
              id: 'm-2',
              displayName: 'Yusuf',
              role: 'adult',
              avatarEmoji: null,
              habitsDone: 0,
              habitsTotal: 0,
              streak: 0,
              tasksPending: 0,
              statusText: 'All done',
              starBalance: 0,
              pendingSignup: false,
            },
            {
              id: 'm-3',
              displayName: 'Iman',
              role: 'child',
              avatarEmoji: '👧',
              habitsDone: 1,
              habitsTotal: 3,
              streak: 2,
              tasksPending: 0,
              statusText: '1/3 habits',
              starBalance: 87,
              pendingSignup: false,
            },
            {
              id: 'm-4',
              displayName: 'Ali',
              role: 'child',
              avatarEmoji: '👦',
              habitsDone: 3,
              habitsTotal: 3,
              streak: 5,
              tasksPending: 0,
              statusText: 'All done',
              starBalance: 122,
              pendingSignup: false,
            },
          ],
          goals: [],
          recentActivity: [],
        }),
      } as Response;
    }
    if (url.includes('/api/members')) {
      return {
        ok: true,
        json: async () => ({ callerRole: 'admin' }),
      } as Response;
    }
    if (url.includes('/api/mw/redemption-requests')) {
      return {
        ok: true,
        json: async () => ({ requests: [] }),
      } as Response;
    }
    return { ok: false, status: 404, json: async () => ({}) } as Response;
  });
}

beforeEach(() => {
  mocks.signOut.mockReset();
  mocks.signOut.mockResolvedValue({});
  mocks.signOutAll.mockReset();
  mocks.signOutAll.mockResolvedValue({ error: null });
  mocks.fetchMock.mockReset();
  defaultFetchMocks();
  authState.user = { email: 'sarah@example.com', id: 'u-1', user_metadata: {} };
  authState.session = { access_token: 'tok-1' };
});

afterEach(() => {
  vi.clearAllMocks();
});

describe('<DashboardPage />: tab framework', () => {
  it('renders six tabs in the nav (FHS-401: Learning Insights moved to child world view)', () => {
    renderAt('/t/khans/dashboard');
    for (const label of ['Dashboard', 'Meals', 'Calendar', 'Assignments', 'Noticeboard', 'Tasks']) {
      expect(screen.getByRole('tab', { name: new RegExp(label) })).toBeInTheDocument();
    }
    // Learning Insights tab removed from parent dashboard (FHS-401)
    expect(screen.queryByRole('tab', { name: /Learning Insights/ })).not.toBeInTheDocument();
    // Reward Requests tab also not on parent dashboard
    expect(screen.queryByRole('tab', { name: /Reward Requests/ })).not.toBeInTheDocument();
  });

  it('?tab=learning-insights falls back to the default home panel (tab no longer exists)', () => {
    renderAt('/t/khans/dashboard?tab=learning-insights');
    // Tab removed: falls back to home
    expect(screen.getByTestId('dashboard-panel-home')).toBeInTheDocument();
    expect(screen.queryByTestId('dashboard-panel-learning-insights')).not.toBeInTheDocument();
  });

  it('defaults to the home (Dashboard) panel when ?tab is absent', () => {
    renderAt('/t/khans/dashboard');
    expect(screen.getByTestId('dashboard-panel-home')).toBeInTheDocument();
    expect(screen.getByTestId('today-loading')).toBeInTheDocument();
  });

  it('honours ?tab=meals on initial render', () => {
    renderAt('/t/khans/dashboard?tab=meals');
    expect(screen.getByTestId('dashboard-panel-meals')).toBeInTheDocument();
    expect(screen.getByTestId('meals-loading')).toBeInTheDocument();
  });

  it('renders the Meals tab unwrapped: not inside the white card (FHS-318)', () => {
    renderAt('/t/khans/dashboard?tab=meals');
    // The Meals header uses white text for the purple page; if it were still
    // wrapped in the white card the heading would be invisible. Assert it has
    // no white-card ancestor (Home/Calendar render the same way).
    expect(screen.getByTestId('meals-loading').closest('.bg-white')).toBeNull();
  });

  it('falls back to the default panel when ?tab is unknown', () => {
    renderAt('/t/khans/dashboard?tab=does-not-exist');
    expect(screen.getByTestId('dashboard-panel-home')).toBeInTheDocument();
  });

  it('clicking a tab updates the active panel content + URL ?tab param', () => {
    renderAt('/t/khans/dashboard');
    const tab = screen.getByRole('tab', { name: /Tasks/ });
    act(() => {
      fireEvent.click(tab);
    });
    expect(screen.getByTestId('dashboard-panel-tasks')).toBeInTheDocument();
    expect(screen.queryByTestId('dashboard-panel-home')).not.toBeInTheDocument();
    expect(screen.getByTestId('location-search').textContent).toBe('?tab=tasks');
  });

  it('clicking back to Dashboard removes the ?tab param entirely', () => {
    renderAt('/t/khans/dashboard?tab=meals');
    expect(screen.getByTestId('location-search').textContent).toBe('?tab=meals');
    act(() => {
      fireEvent.click(screen.getByRole('tab', { name: /Dashboard/ }));
    });
    expect(screen.getByTestId('location-search').textContent).toBe('');
    expect(screen.getByTestId('dashboard-panel-home')).toBeInTheDocument();
  });

  it('marks the active tab with aria-selected=true and others false', () => {
    renderAt('/t/khans/dashboard?tab=tasks');
    expect(screen.getByRole('tab', { name: /Tasks/ }).getAttribute('aria-selected')).toBe('true');
    expect(screen.getByRole('tab', { name: /Meals/ }).getAttribute('aria-selected')).toBe('false');
  });

  // FHS-392: reward-requests tab removed; panel moved to ChildWorldPage sidebar.
  it('?tab=reward-requests falls back to the default home panel (tab no longer exists)', () => {
    renderAt('/t/khans/dashboard?tab=reward-requests');
    // Unknown tab → fallback to home
    expect(screen.getByTestId('dashboard-panel-home')).toBeInTheDocument();
    expect(screen.queryByTestId('reward-requests-panel')).not.toBeInTheDocument();
  });

  it('home tab does not show RewardRequestsPanel', async () => {
    renderAt('/t/khans/dashboard');
    expect(screen.getByTestId('dashboard-panel-home')).toBeInTheDocument();
    await waitFor(() => expect(mocks.fetchMock).toHaveBeenCalled());
    expect(screen.queryByTestId('reward-requests-panel')).not.toBeInTheDocument();
  });
});

describe('<DashboardPage />: FHS-261 header', () => {
  it('fetches /api/me + /api/dashboard/today and renders "<name> Family Hub"', async () => {
    renderAt('/t/khans/dashboard');
    await waitFor(() =>
      expect(screen.getByTestId('dashboard-family-name').textContent).toBe('The Khans Family Hub'),
    );
    // Both lookups went out with the slug as the tenant context.
    expect(mocks.fetchMock).toHaveBeenCalledWith(
      expect.stringContaining('/api/me'),
      expect.objectContaining({
        headers: expect.objectContaining({ Authorization: 'Bearer tok-1' }),
      }),
    );
    expect(mocks.fetchMock).toHaveBeenCalledWith(
      expect.stringContaining('/api/dashboard/today'),
      expect.objectContaining({
        headers: expect.objectContaining({ 'x-tenant-slug': 'khans' }),
      }),
    );
  });

  it('shows "N members active" pulse when /api/dashboard/today returns members', async () => {
    renderAt('/t/khans/dashboard');
    await waitFor(() =>
      expect(screen.getByTestId('dashboard-members-active').textContent).toMatch(
        /4 members active/i,
      ),
    );
  });

  it('renders the loading skeleton until both fetches resolve', () => {
    // Reset the fetch so it never resolves during this test.
    mocks.fetchMock.mockReset();
    mocks.fetchMock.mockReturnValue(new Promise(() => {}));
    renderAt('/t/khans/dashboard');
    expect(screen.getByTestId('dashboard-family-hero-loading')).toBeInTheDocument();
  });

  it('profile pill is collapsed by default and opens on click', async () => {
    renderAt('/t/khans/dashboard');
    expect(screen.queryByTestId('dashboard-profile-menu')).toBeNull();
    fireEvent.click(screen.getByTestId('dashboard-profile-pill'));
    expect(screen.getByTestId('dashboard-profile-menu')).toBeInTheDocument();
  });

  it('dropdown lists every child member with a View World link', async () => {
    renderAt('/t/khans/dashboard');
    await waitFor(() => expect(screen.getByTestId('dashboard-family-name')).toBeInTheDocument());
    fireEvent.click(screen.getByTestId('dashboard-profile-pill'));
    expect(screen.getByTestId('dashboard-profile-child-m-3').textContent).toMatch(/Iman/);
    expect(screen.getByTestId('dashboard-profile-child-m-4').textContent).toMatch(/Ali/);
    // Adults must NOT appear under Children.
    expect(screen.queryByTestId('dashboard-profile-child-m-1')).toBeNull();
    expect(screen.queryByTestId('dashboard-profile-child-m-2')).toBeNull();
  });

  // FHS-585: the marker belongs on a child's world, not here. No child's
  // world is open on the family dashboard, so nothing should be marked.
  it('marks no child as being viewed on the family dashboard', async () => {
    renderAt('/t/khans/dashboard');
    await waitFor(() => expect(screen.getByTestId('dashboard-family-name')).toBeInTheDocument());
    fireEvent.click(screen.getByTestId('dashboard-profile-pill'));
    for (const id of ['m-3', 'm-4']) {
      expect(screen.getByTestId(`dashboard-profile-child-${id}`)).not.toHaveAttribute(
        'aria-current',
      );
      expect(screen.getByTestId(`dashboard-profile-child-${id}-state`).textContent).toMatch(
        /View World/,
      );
    }
  });

  // FHS-625: the account-menu doors only render once the caller's role has
  // arrived, so tests must open the menu after /api/me answers. The family
  // name comes back in that same response, which makes it the signal to wait
  // on. Before FHS-625 the doors rendered for everyone immediately, so these
  // tests could click in the same tick as render.
  async function openAccountMenu() {
    await waitFor(() => expect(screen.getByTestId('dashboard-family-name')).toBeInTheDocument());
    fireEvent.click(screen.getByTestId('dashboard-profile-pill'));
  }

  // FHS-500: add-member now lives on the Family Overview (FHS-498), so the
  // profile dropdown no longer carries a "+" or an "Add member" button.
  it('the profile dropdown has no add-member controls (FHS-500)', async () => {
    renderAt('/t/khans/dashboard');
    await openAccountMenu();
    expect(screen.queryByTestId('dashboard-profile-add-member')).toBeNull();
    expect(screen.queryByTestId('dashboard-profile-add-member-plus')).toBeNull();
    // Manage members stays.
    expect(screen.getByTestId('dashboard-profile-manage-members')).toBeInTheDocument();
  });

  it('Manage members item navigates to the members page (FHS-273)', async () => {
    renderAt('/t/khans/dashboard');
    await openAccountMenu();
    fireEvent.click(screen.getByTestId('dashboard-profile-manage-members'));
    await waitFor(() => expect(screen.getByTestId('members-route')).toBeInTheDocument());
    expect(screen.getByTestId('location-search').textContent).toBe('');
  });

  // FHS-512 / FHS-514: "Reward settings" opens the Pocket money screen.
  it('the profile dropdown has a Reward settings item that navigates to /t/:slug/reward-settings', async () => {
    renderAt('/t/khans/dashboard');
    await openAccountMenu();
    expect(screen.getByTestId('dashboard-profile-reward-settings')).toBeInTheDocument();
    fireEvent.click(screen.getByTestId('dashboard-profile-reward-settings'));
    await waitFor(() => expect(screen.getByTestId('reward-settings-route')).toBeInTheDocument());
  });

  // FHS-621: four doors, one per job, each saying what is behind it.
  it('the account menu offers one door per job, in order, each with a note', async () => {
    renderAt('/t/khans/dashboard');
    await openAccountMenu();
    const doors = [
      ['dashboard-profile-kids-money', 'Kids money', 'Balances and week history'],
      ['dashboard-profile-reward-settings', 'Earning rules', 'What a sticker is worth'],
      ['dashboard-profile-manage-members', 'Manage family', 'Grown-ups and kids'],
      ['dashboard-profile-family-settings', 'Family settings', 'Name, currency, your data'],
    ] as const;
    for (const [testId, label, note] of doors) {
      const door = screen.getByTestId(testId);
      expect(door).toHaveTextContent(label);
      expect(door, `${label} should say what is behind it`).toHaveTextContent(note);
    }
    // In the order a parent needs them, top to bottom.
    const order = doors.map(([id]) => screen.getByTestId(id));
    for (let i = 1; i < order.length; i += 1) {
      expect(
        order[i - 1]!.compareDocumentPosition(order[i]!) & Node.DOCUMENT_POSITION_FOLLOWING,
      ).toBeTruthy();
    }
  });

  it('the Kids money door opens the money page', async () => {
    renderAt('/t/khans/dashboard');
    await openAccountMenu();
    fireEvent.click(screen.getByTestId('dashboard-profile-kids-money'));
    await waitFor(() => expect(screen.getByTestId('money-route')).toBeInTheDocument());
  });

  it('the Family settings door opens the family settings page', async () => {
    renderAt('/t/khans/dashboard');
    await openAccountMenu();
    fireEvent.click(screen.getByTestId('dashboard-profile-family-settings'));
    await waitFor(() => expect(screen.getByTestId('family-settings-route')).toBeInTheDocument());
  });

  // FHS-514: with no kids, the account menu shows an actionable "add your first child" row.
  it('shows an "add your first child" row in the account menu when there are no kids', async () => {
    mocks.fetchMock.mockImplementation(async (url: string) => {
      if (url.includes('/api/me')) {
        return {
          ok: true,
          json: async () => ({
            id: 'u-1',
            email: 'sarah@example.com',
            tenants: [{ id: 't-1', slug: 'khans', name: 'The Khans', role: 'admin' }],
          }),
        } as Response;
      }
      if (url.includes('/api/dashboard/today')) {
        return {
          ok: true,
          json: async () => ({
            date: '2026-06-10',
            greetingName: 'Sarah',
            callerMemberId: 'm-1',
            counts: {
              members: 1,
              habits: 0,
              rewards: 0,
              tasksDoneToday: 0,
              tasksTotalToday: 0,
              mealsPlanned: 0,
            },
            members: [
              {
                id: 'm-1',
                displayName: 'Sarah',
                role: 'admin',
                avatarEmoji: null,
                habitsDone: 0,
                habitsTotal: 0,
                streak: 0,
                tasksPending: 0,
                statusText: '',
                starBalance: 0,
                pendingSignup: false,
              },
            ],
            goals: [],
            recentActivity: [],
          }),
        } as Response;
      }
      return { ok: false, status: 404, json: async () => ({}) } as Response;
    });
    renderAt('/t/khans/dashboard');
    fireEvent.click(screen.getByTestId('dashboard-profile-pill'));
    await waitFor(() =>
      expect(screen.getByTestId('dashboard-profile-add-first-child')).toBeInTheDocument(),
    );
    fireEvent.click(screen.getByTestId('dashboard-profile-add-first-child'));
    await waitFor(() => expect(screen.getByTestId('members-route')).toBeInTheDocument());
  });

  // FHR-24: a very long family name wraps to two lines, then ends in "...".
  it('keeps a long family name inside the header', async () => {
    renderAt('/t/khans/dashboard');
    await waitFor(() =>
      expect(screen.getByTestId('dashboard-family-name')).toHaveTextContent(/Khans/),
    );
    expect(screen.getByTestId('dashboard-family-name')).toHaveClass('line-clamp-2', 'min-w-0');
  });

  // FHR-27: signing in with Google again must not replace the name you chose.
  it('shows your saved family name in the account menu, not your Google name', async () => {
    authState.user = {
      email: 'sarah@example.com',
      id: 'u-1',
      user_metadata: { full_name: 'Tanvi Google' },
    };
    renderAt('/t/khans/dashboard');
    fireEvent.click(screen.getByTestId('dashboard-profile-pill'));
    await waitFor(() =>
      expect(screen.getByTestId('dashboard-profile-parent-name')).toHaveTextContent('Sarah'),
    );
    expect(screen.getByTestId('dashboard-profile-parent-name')).not.toHaveTextContent('Tanvi');
  });

  it('Log out lives at the bottom of the profile menu and calls signOutAll()', async () => {
    renderAt('/t/khans/dashboard');
    // FHS-520 (design-fidelity): Log out is no longer a standalone nav
    // button; it's the last item inside the account dropdown (MP).
    expect(screen.queryByTestId('dashboard-profile-menu')).toBeNull();
    fireEvent.click(screen.getByTestId('dashboard-profile-pill'));
    expect(screen.getByTestId('dashboard-profile-menu')).toBeInTheDocument();
    await act(async () => {
      fireEvent.click(screen.getByTestId('dashboard-logout'));
    });
    expect(mocks.signOutAll).toHaveBeenCalledTimes(1);
  });

  it('Tasks tab shows an open-tasks badge from the dashboard counts', async () => {
    renderAt('/t/khans/dashboard');
    // Fixture: tasksTotalToday 2 - tasksDoneToday 1 = 1 open task.
    await waitFor(() => expect(screen.getByTestId('tab-tasks-badge')).toBeInTheDocument());
    expect(screen.getByTestId('tab-tasks-badge').textContent).toBe('1');
  });

  it('refreshes the My Tasks badge on the dashboard-stale signal (FHS-309)', async () => {
    renderAt('/t/khans/dashboard');
    await waitFor(() => expect(screen.getByTestId('tab-tasks-badge').textContent).toBe('1'));
    // Simulate the caller's pending task being marked done elsewhere: the
    // next /today fetch returns 0 pending for the caller member.
    mocks.fetchMock.mockImplementation(async (url: string) => {
      if (url.includes('/api/dashboard/today')) {
        return {
          ok: true,
          json: async () => ({
            callerMemberId: 'm-1',
            members: [
              {
                id: 'm-1',
                displayName: 'Sarah',
                role: 'admin',
                avatarEmoji: null,
                habitsDone: 0,
                habitsTotal: 0,
                streak: 0,
                tasksPending: 0,
                statusText: 'All done',
                starBalance: 0,
                pendingSignup: false,
              },
            ],
          }),
        } as Response;
      }
      return { ok: false, status: 404, json: async () => ({}) } as Response;
    });
    await act(async () => {
      window.dispatchEvent(new Event('fh:dashboard-stale'));
    });
    // Badge only renders when > 0, so it disappears once pending hits 0.
    await waitFor(() => expect(screen.queryByTestId('tab-tasks-badge')).not.toBeInTheDocument());
  });

  // FHS-312: two dashboard-stale signals fired close together used to race
  // two /today fetches with no ordering guarantee, so a slow "older" response
  // could land after the newer one and overwrite fresh badge counts with
  // stale data. Aborting the older in-flight fetch when a newer signal fires
  // fixes that: only the newest request's response can ever apply.
  it('aborts the older in-flight refresh when a second dashboard-stale signal fires before it resolves (FHS-312)', async () => {
    type TodayCall = { signal?: AbortSignal; resolve: (v: Response) => void };
    const todayCalls: TodayCall[] = [];
    mocks.fetchMock.mockImplementation((url: string, options?: RequestInit) => {
      if (url.includes('/api/me')) {
        return Promise.resolve({
          ok: true,
          json: async () => ({
            id: 'u-1',
            email: 'sarah@example.com',
            tenants: [{ id: 't-1', slug: 'khans', name: 'The Khans', role: 'admin' }],
          }),
        } as Response);
      }
      if (url.includes('/api/dashboard/today')) {
        return new Promise<Response>((resolve, reject) => {
          todayCalls.push({ signal: options?.signal, resolve });
          // Mirrors the browser's real fetch()-vs-AbortSignal contract: an
          // aborted signal rejects the in-flight request.
          options?.signal?.addEventListener('abort', () => {
            reject(new DOMException('Aborted', 'AbortError'));
          });
        });
      }
      return Promise.resolve({ ok: false, status: 404, json: async () => ({}) } as Response);
    });

    // Shape matches the full DashboardTodayResponse (not just the fields
    // AppHeader reads) because TodayTabPanel and GetStarted also render
    // from whatever resolves these same /today calls.
    const memberFixture = (tasksPending: number) => ({
      date: '2026-06-10',
      callerMemberId: 'm-1',
      counts: {
        members: 1,
        habits: 0,
        rewards: 0,
        tasksDoneToday: 0,
        tasksTotalToday: tasksPending,
        mealsPlanned: 0,
      },
      members: [
        {
          id: 'm-1',
          displayName: 'Sarah',
          role: 'admin',
          avatarEmoji: null,
          habitsDone: 0,
          habitsTotal: 0,
          streak: 0,
          tasksPending,
          statusText: tasksPending > 0 ? `${tasksPending} task left` : 'All done',
          starBalance: 0,
          pendingSignup: false,
        },
      ],
      goals: [],
      recentActivity: [],
    });

    renderAt('/t/khans/dashboard');

    // The home tab has more than one panel that independently fetches
    // /api/dashboard/today on mount (AppHeader itself, plus the Today and
    // GetStarted panels), so more than one call can be in flight before any
    // signal ever fires. None of those other panels listen for
    // fh:dashboard-stale, so resolve every call currently pending (mount
    // effects only) with the caller's task still open, then treat the call
    // count from here as the baseline: any call pushed after this point can
    // only come from AppHeader's refreshToday.
    await waitFor(() => expect(todayCalls.length).toBeGreaterThan(0));
    await act(async () => {
      todayCalls.forEach((call) =>
        call.resolve({ ok: true, json: async () => memberFixture(1) } as Response),
      );
    });
    await waitFor(() => expect(screen.getByTestId('tab-tasks-badge').textContent).toBe('1'));
    const baseline = todayCalls.length;

    // First dashboard-stale signal starts the "slow, stale" refresh that
    // will get superseded before it resolves.
    await act(async () => {
      window.dispatchEvent(new Event('fh:dashboard-stale'));
    });
    await waitFor(() => expect(todayCalls.length).toBe(baseline + 1));
    const staleCall = todayCalls[baseline];
    expect(staleCall.signal?.aborted).toBe(false);

    // Second dashboard-stale signal fires before the first refresh resolves:
    // it starts a newer refresh and must abort the older one.
    await act(async () => {
      window.dispatchEvent(new Event('fh:dashboard-stale'));
    });
    await waitFor(() => expect(todayCalls.length).toBe(baseline + 2));
    const freshCall = todayCalls[baseline + 1];
    expect(staleCall.signal?.aborted).toBe(true);
    expect(freshCall.signal?.aborted).toBe(false);

    // Resolve the newer call first: the caller's task is now done.
    await act(async () => {
      freshCall.resolve({ ok: true, json: async () => memberFixture(0) } as Response);
    });
    await waitFor(() => expect(screen.queryByTestId('tab-tasks-badge')).not.toBeInTheDocument());

    // The stale call's own promise already rejected when it was aborted, so
    // this resolve() is a no-op; confirms the stale "1 pending" data can
    // never resurrect the badge, even if something tried to apply it late.
    await act(async () => {
      staleCall.resolve({ ok: true, json: async () => memberFixture(1) } as Response);
    });
    expect(screen.queryByTestId('tab-tasks-badge')).not.toBeInTheDocument();
  });

  // FHS-506: the account menu shows the person's roster name, not their email,
  // when the login carries no name (common for magic-link signups).
  it('uses the roster display name (not the email) when the login has no name', async () => {
    authState.user = { email: 'sarah@example.com', id: 'u-1', user_metadata: {} };
    renderAt('/t/khans/dashboard');
    fireEvent.click(screen.getByTestId('dashboard-profile-pill'));
    // Default mock: caller m-1's roster displayName is 'Sarah'.
    await waitFor(() =>
      expect(screen.getByTestId('dashboard-profile-parent-name').textContent).toBe('Sarah'),
    );
  });

  it('falls back to the email only when there is no auth name and no roster name', async () => {
    authState.user = { email: 'sarah@example.com', id: 'u-1', user_metadata: {} };
    mocks.fetchMock.mockImplementation(async (url: string) => {
      if (url.includes('/api/me')) {
        return {
          ok: true,
          json: async () => ({
            id: 'u-1',
            email: 'sarah@example.com',
            tenants: [{ id: 't-1', slug: 'khans', name: 'The Khans', role: 'admin' }],
          }),
        } as Response;
      }
      if (url.includes('/api/dashboard/today')) {
        return {
          ok: true,
          json: async () => ({
            date: '2026-06-10',
            greetingName: 'Sarah',
            callerMemberId: 'm-x',
            counts: {
              members: 0,
              habits: 0,
              rewards: 0,
              tasksDoneToday: 0,
              tasksTotalToday: 0,
              mealsPlanned: 0,
            },
            members: [],
            goals: [],
            recentActivity: [],
          }),
        } as Response;
      }
      return { ok: false, status: 404, json: async () => ({}) } as Response;
    });
    renderAt('/t/khans/dashboard');
    fireEvent.click(screen.getByTestId('dashboard-profile-pill'));
    await waitFor(() =>
      expect(screen.getByTestId('dashboard-profile-parent-name').textContent).toBe(
        'sarah@example.com',
      ),
    );
  });

  it('uses user_metadata.full_name as the parent name when present', async () => {
    authState.user = {
      email: 'sarah@example.com',
      id: 'u-1',
      user_metadata: { full_name: 'Sarah Khan' },
    };
    renderAt('/t/khans/dashboard');
    fireEvent.click(screen.getByTestId('dashboard-profile-pill'));
    expect(screen.getByTestId('dashboard-profile-parent-name').textContent).toBe('Sarah Khan');
  });

  // FHS-485 / ADR 0019: the profile menu's role line reflects the caller's
  // real role, not a hardcoded "Parent · Admin" for everyone.
  it('shows the caller role in the profile menu (admin => Parent · Admin)', async () => {
    renderAt('/t/khans/dashboard');
    fireEvent.click(screen.getByTestId('dashboard-profile-pill'));
    await waitFor(() =>
      expect(screen.getByTestId('dashboard-profile-role').textContent).toBe('Parent · Admin'),
    );
  });

  it('labels a non-admin adult caller "Adult" in the profile menu, not Parent', async () => {
    mocks.fetchMock.mockImplementation(async (url: string) => {
      if (url.includes('/api/me')) {
        return {
          ok: true,
          json: async () => ({
            id: 'u-1',
            email: 'sarah@example.com',
            tenants: [{ id: 't-1', slug: 'khans', name: 'The Khans', role: 'adult' }],
          }),
        } as Response;
      }
      if (url.includes('/api/dashboard/today')) {
        return {
          ok: true,
          json: async () => ({
            date: '2026-06-10',
            greetingName: 'Sarah',
            callerMemberId: 'm-1',
            counts: {
              members: 0,
              habits: 0,
              rewards: 0,
              tasksDoneToday: 0,
              tasksTotalToday: 0,
              mealsPlanned: 0,
            },
            members: [],
            goals: [],
            recentActivity: [],
          }),
        } as Response;
      }
      return { ok: false, status: 404, json: async () => ({}) } as Response;
    });
    renderAt('/t/khans/dashboard');
    fireEvent.click(screen.getByTestId('dashboard-profile-pill'));
    await waitFor(() =>
      expect(screen.getByTestId('dashboard-profile-role').textContent).toBe('Adult'),
    );
  });
});
