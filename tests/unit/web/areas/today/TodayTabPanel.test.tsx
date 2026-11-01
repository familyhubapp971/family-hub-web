import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import type { DashboardMember, DashboardTodayResponse } from '@familyhub/shared';

// FHS-263 exact-match: TodayTabPanel. Family Overview 4-up cards (kid
// bar + streak + View World link; adult tasks + status box), Today's
// Snapshot ratio tiles, the purple Family Goals card with Kids' Star
// Balances, and the Recent Activity feed.

const fetchMock = vi.fn();
const authState: { session: { access_token?: string } | null } = {
  session: { access_token: 'tok-abc' },
};
vi.mock('../../../../../src/app/lib/auth-context', () => ({
  useAuth: () => authState,
}));

import { TodayTabPanel } from '../../../../../src/areas/today/TodayTabPanel';
import { TenantProvider } from '../../../../../src/app/lib/tenant-context';

function renderAt(initial: string) {
  return render(
    <MemoryRouter initialEntries={[initial]}>
      <Routes>
        <Route
          path="/t/:slug/dashboard"
          element={
            <TenantProvider>
              <TodayTabPanel />
            </TenantProvider>
          }
        />
      </Routes>
    </MemoryRouter>,
  );
}

function member(over: Partial<DashboardMember> = {}): DashboardMember {
  return {
    id: 'm',
    displayName: 'Member',
    role: 'child',
    avatarEmoji: null,
    habitsDone: 0,
    habitsTotal: 0,
    streak: 0,
    tasksPending: 0,
    statusText: '',
    starBalance: 0,
    pendingSignup: false,
    ...over,
  };
}

function makeResponse(overrides: Partial<DashboardTodayResponse> = {}): DashboardTodayResponse {
  return {
    date: '2026-06-11',
    greetingName: 'Sarah',
    callerMemberId: '00000000-0000-4000-8000-000000000001',
    members: [],
    counts: {
      members: 0,
      habits: 0,
      rewards: 0,
      tasksDoneToday: 0,
      tasksTotalToday: 0,
      mealsPlanned: 0,
    },
    goals: [],
    recentActivity: [],
    ...overrides,
  };
}

function mockJson(body: DashboardTodayResponse, ok = true, statusCode = 200) {
  fetchMock.mockResolvedValueOnce({ ok, status: statusCode, json: async () => body });
}

beforeEach(() => {
  fetchMock.mockReset();
  vi.stubGlobal('fetch', fetchMock);
  authState.session = { access_token: 'tok-abc' };
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('<TodayTabPanel />', () => {
  it('renders a loading hint while the request is in flight', () => {
    fetchMock.mockReturnValue(new Promise(() => {}));
    renderAt('/t/khans/dashboard');
    expect(screen.getByTestId('today-loading')).toBeInTheDocument();
  });

  it('renders the inline error when the API returns a non-2xx', async () => {
    fetchMock.mockResolvedValueOnce({ ok: false, status: 500, json: async () => ({}) });
    renderAt('/t/khans/dashboard');
    await waitFor(() => expect(screen.getByTestId('today-error')).toBeInTheDocument());
  });

  it('renders empty states for no members, goals, stars, and activity', async () => {
    mockJson(makeResponse());
    renderAt('/t/khans/dashboard');
    await waitFor(() => expect(screen.getByTestId('today-ready')).toBeInTheDocument());
    expect(screen.getByTestId('today-members-empty')).toBeInTheDocument();
    expect(screen.getByTestId('today-goals-empty')).toBeInTheDocument();
    expect(screen.getByTestId('today-stars-empty')).toBeInTheDocument();
    expect(screen.getByTestId('today-activity-empty')).toBeInTheDocument();
  });

  it('has a prominent "Manage family" button in the Family Overview header (FHS-520)', async () => {
    mockJson(makeResponse());
    renderAt('/t/khans/dashboard');
    await waitFor(() => expect(screen.getByTestId('today-ready')).toBeInTheDocument());
    const add = screen.getByTestId('today-add-member');
    expect(add.textContent).toMatch(/Manage family/i);
    expect(add.getAttribute('href')).toBe('/t/khans/members');
    // Manage members moved to the account dropdown: no longer in the header.
    expect(screen.queryByTestId('today-manage-members')).toBeNull();
  });

  it('renders the snapshot ratio tiles (kids habits, tasks done/total, meals/3)', async () => {
    mockJson(
      makeResponse({
        members: [member({ id: 'k', role: 'child', habitsDone: 2, habitsTotal: 3 })],
        counts: {
          members: 1,
          habits: 3,
          rewards: 0,
          tasksDoneToday: 2,
          tasksTotalToday: 6,
          mealsPlanned: 3,
        },
      }),
    );
    renderAt('/t/khans/dashboard');
    await waitFor(() => expect(screen.getByTestId('today-ready')).toBeInTheDocument());
    expect(screen.getByTestId('today-snapshot-habits').textContent).toContain('2/3');
    expect(screen.getByTestId('today-snapshot-tasks').textContent).toContain('2/6');
    expect(screen.getByTestId('today-snapshot-meals').textContent).toContain('3/3');
  });

  it('renders a clickable kid card (bar + streak + View World) and a non-linked adult card', async () => {
    mockJson(
      makeResponse({
        members: [
          member({
            id: 'm1',
            displayName: 'Sarah Khan',
            role: 'admin',
            tasksPending: 2,
            statusText: '2 tasks left',
          }),
          member({
            id: 'm2',
            displayName: 'Iman',
            role: 'child',
            habitsDone: 2,
            habitsTotal: 3,
            streak: 4,
            starBalance: 87,
          }),
        ],
      }),
    );
    renderAt('/t/khans/dashboard');
    await waitFor(() => expect(screen.getByTestId('today-ready')).toBeInTheDocument());

    // Adult: role label, pending tasks, status box, not a link.
    expect(screen.getByTestId('today-member-0-name').textContent).toBe('Sarah Khan');
    expect(screen.getByTestId('today-member-0-role').textContent).toBe('Admin');
    expect(screen.getByTestId('today-member-0-tasks').textContent).toBe('2');
    expect(screen.getByTestId('today-member-0-status').textContent).toContain('2 tasks left');
    expect(screen.queryByTestId('today-member-0-link')).not.toBeInTheDocument();

    // Kid: clickable to their world, habit bar (progressbar), streak, View World.
    expect(screen.getByTestId('today-member-1-link').getAttribute('href')).toBe(
      '/t/khans/child/m2',
    );
    expect(screen.getByTestId('today-member-1-streak').textContent).toContain('4 week streak');
    expect(screen.getByLabelText('Iman: 2 of 3 habits done')).toBeInTheDocument();
    expect(screen.getByText('View World')).toBeInTheDocument();
  });

  it('hides the streak for a kid with a zero streak', async () => {
    mockJson(
      makeResponse({
        members: [member({ id: 'm2', role: 'child', habitsTotal: 3, streak: 0 })],
      }),
    );
    renderAt('/t/khans/dashboard');
    await waitFor(() => expect(screen.getByTestId('today-ready')).toBeInTheDocument());
    expect(screen.queryByTestId('today-member-0-streak')).not.toBeInTheDocument();
  });

  it('renders the top goal percentage and per-kid star balances', async () => {
    mockJson(
      makeResponse({
        members: [
          member({ id: 'a', displayName: 'Amina', role: 'teen', starBalance: 87 }),
          member({ id: 'b', displayName: 'Ibrahim', role: 'child', starBalance: 122 }),
        ],
        goals: [{ id: 'g1', label: 'Family Holiday Fund', progress: 650, target: 1000 }],
      }),
    );
    renderAt('/t/khans/dashboard');
    await waitFor(() => expect(screen.getByTestId('today-ready')).toBeInTheDocument());

    expect(screen.getByTestId('today-goal-0').textContent).toContain('Family Holiday Fund');
    expect(screen.getByTestId('today-goal-0').textContent).toContain('65%');
    expect(screen.getByTestId('today-star-a').textContent).toContain('Amina');
    expect(screen.getByTestId('today-star-a').textContent).toContain('87');
    expect(screen.getByTestId('today-star-b').textContent).toContain('122');
  });

  it('renders the activity feed with actor + action', async () => {
    mockJson(
      makeResponse({
        recentActivity: [
          {
            id: 'a1',
            actor: 'Amina',
            action: 'completed Morning Routine',
            timestamp: '2026-06-11T08:00:00.000Z',
          },
          {
            id: 'a2',
            actor: null,
            action: 'family created',
            timestamp: '2026-06-11T07:00:00.000Z',
          },
        ],
      }),
    );
    renderAt('/t/khans/dashboard');
    await waitFor(() => expect(screen.getByTestId('today-ready')).toBeInTheDocument());
    expect(screen.getByTestId('today-activity-0').textContent).toContain('Amina');
    expect(screen.getByTestId('today-activity-0').textContent).toContain(
      'completed Morning Routine',
    );
    expect(screen.getByTestId('today-activity-1').textContent).toContain('family created');
  });

  it('shows the pending-signup chip and the adult task-title status (FHS-273)', async () => {
    mockJson(
      makeResponse({
        members: [
          member({
            id: 'm1',
            displayName: 'Yusuf',
            role: 'adult',
            tasksPending: 3,
            statusText: 'Fixing the bike',
            pendingSignup: true,
          }),
          member({ id: 'm2', displayName: 'Iman', role: 'child', habitsTotal: 3 }),
        ],
      }),
    );
    renderAt('/t/khans/dashboard');
    await waitFor(() => expect(screen.getByTestId('today-ready')).toBeInTheDocument());
    // Adult status box shows their newest open task, never habit copy.
    expect(screen.getByTestId('today-member-0-status').textContent).toContain('Fixing the bike');
    expect(screen.getByTestId('today-member-0-pending')).toBeInTheDocument();
    // Signed-up member: no chip.
    expect(screen.queryByTestId('today-member-1-pending')).not.toBeInTheDocument();
  });

  it('passes the tenant slug + bearer token on the request', async () => {
    mockJson(makeResponse());
    renderAt('/t/khans/dashboard');
    await waitFor(() => expect(fetchMock).toHaveBeenCalled());
    const [url, init] = fetchMock.mock.calls[0]!;
    expect(url).toBe('http://localhost:3001/api/dashboard/today');
    expect(init.headers).toMatchObject({
      Authorization: 'Bearer tok-abc',
      'x-tenant-slug': 'khans',
    });
  });

  it('does not fetch when no session is present', () => {
    authState.session = null;
    renderAt('/t/khans/dashboard');
    expect(fetchMock).not.toHaveBeenCalled();
    expect(screen.getByTestId('today-loading')).toBeInTheDocument();
  });
});
