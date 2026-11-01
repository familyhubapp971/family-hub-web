import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor, fireEvent, act } from '@testing-library/react';
import { MemoryRouter, Routes, Route, useLocation } from 'react-router-dom';

// FHS-268: ChildWorld shell: five tabs (My World active, the rest
// placeholders) + a "Back to family" button.

const fetchMock = vi.fn();
const authState: {
  user: { email?: string; id?: string; user_metadata?: Record<string, unknown> } | null;
  session: { access_token?: string } | null;
} = {
  // No full_name in the JWT: parentName must fall back to the roster display
  // name, never the login email (FHS-506/FHS-523).
  user: { email: 'parent@example.com', id: 'u-1', user_metadata: {} },
  session: { access_token: 'tok-abc' },
};
vi.mock('../../../../../src/app/lib/auth-context', () => ({
  useAuth: () => authState,
  signOutAll: vi.fn(async () => ({ error: null })),
}));

import { ChildWorldPage } from '../../../../../src/areas/kids/ChildWorldPage';
import { TenantProvider } from '../../../../../src/app/lib/tenant-context';

const MEMBER = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc';
const SIBLING = 'dddddddd-dddd-4ddd-8ddd-dddddddddddd';
const CALLER = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';

const STUB_INSIGHTS = {
  memberId: MEMBER,
  displayName: 'Ali',
  hasActivity: false,
  subjects: [
    {
      subject: 'Maths',
      progressPct: 0,
      certificatesEarned: 0,
      certificatesTotal: 48,
      lastActive: null,
      needsHelp: false,
      accuracyPct: null,
      continentsExplored: 0,
      continentsTotal: 0,
      exploredContinents: [],
    },
    {
      subject: 'Logic',
      progressPct: 0,
      certificatesEarned: 0,
      certificatesTotal: 15,
      lastActive: null,
      needsHelp: false,
      accuracyPct: null,
      continentsExplored: 0,
      continentsTotal: 0,
      exploredContinents: [],
    },
    {
      subject: 'Science',
      progressPct: 0,
      certificatesEarned: 0,
      certificatesTotal: 1,
      lastActive: null,
      needsHelp: false,
      accuracyPct: null,
      continentsExplored: 0,
      continentsTotal: 0,
      exploredContinents: [],
    },
    {
      subject: 'World Flags',
      progressPct: 0,
      certificatesEarned: 0,
      certificatesTotal: 6,
      lastActive: null,
      needsHelp: false,
      accuracyPct: null,
      continentsExplored: 0,
      continentsTotal: 6,
      exploredContinents: [],
    },
  ],
  weakest: null,
};

function installApi() {
  fetchMock.mockImplementation((url: string) => {
    const u = String(url);
    if (u.includes('/api/mw/financial/savings')) {
      return Promise.resolve({
        ok: true,
        status: 200,
        json: async () => ({ savedStickers: 12, savedCash: 5 }),
      });
    }
    if (u.includes('/api/members')) {
      return Promise.resolve({
        ok: true,
        status: 200,
        json: async () => ({
          callerRole: 'admin',
          callerMemberId: CALLER,
          members: [
            { id: CALLER, displayName: 'Nadia Khan', avatarEmoji: '👩', isChild: false },
            { id: MEMBER, displayName: 'Ali', avatarEmoji: '👦', isChild: true },
            { id: SIBLING, displayName: 'Sara', avatarEmoji: '👧', isChild: true },
          ],
        }),
      });
    }
    if (u.includes('/api/learn/insights')) {
      return Promise.resolve({
        ok: true,
        status: 200,
        json: async () => STUB_INSIGHTS,
      });
    }
    if (u.includes('/api/rewards')) {
      return Promise.resolve({
        ok: true,
        status: 200,
        json: async () => ({ rewards: [], stickerBalance: 0 }),
      });
    }
    if (u.includes('/api/mw/weeks')) {
      return Promise.resolve({ ok: true, status: 200, json: async () => ({ weeks: [] }) });
    }
    if (u.includes('/api/journal')) {
      return Promise.resolve({ ok: true, status: 200, json: async () => ({ entries: [] }) });
    }
    // /api/habits
    return Promise.resolve({
      ok: true,
      status: 200,
      json: async () => ({
        habits: [],
        stickers: [],
        week: { id: 'wk1', weekNumber: 9, year: 2026, startDate: '2026-02-23', isFinalized: false },
        balance: 0,
      }),
    });
  });
}

function LocationProbe() {
  const loc = useLocation();
  return <div data-testid="location">{loc.pathname}</div>;
}

function renderAt() {
  return render(
    <MemoryRouter initialEntries={['/t/khan/child/' + MEMBER]}>
      <LocationProbe />
      <Routes>
        <Route
          path="/t/:slug/child/:memberId"
          element={
            <TenantProvider>
              <ChildWorldPage />
            </TenantProvider>
          }
        />
        <Route path="/t/:slug/dashboard" element={<div data-testid="dashboard-page">DASH</div>} />
        <Route path="/login" element={<div data-testid="login-page">LOGIN</div>} />
      </Routes>
    </MemoryRouter>,
  );
}

beforeEach(() => {
  fetchMock.mockReset();
  installApi();
  vi.stubGlobal('fetch', fetchMock);
  authState.user = { email: 'parent@example.com', id: 'u-1', user_metadata: {} };
  authState.session = { access_token: 'tok-abc' };
});
afterEach(() => vi.unstubAllGlobals());

describe('<ChildWorldPage />', () => {
  it('renders the five ChildWorld tabs including Learning Insights (FHS-401)', async () => {
    renderAt();
    // Wait for callerRole to load (admin) so the Insights tab appears.
    await waitFor(() =>
      expect(screen.getByRole('tab', { name: /Learning Insights/ })).toBeInTheDocument(),
    );
    for (const label of ['My World', 'Meals', 'Calendar', 'Journal', 'Learning Insights']) {
      expect(screen.getByRole('tab', { name: new RegExp(label) })).toBeInTheDocument();
    }
    expect(screen.getByTestId('child-panel-world')).toBeInTheDocument();
  });

  it('switching to Learning Insights tab renders the child insights panel (FHS-401)', async () => {
    renderAt();
    // Wait for the members fetch to resolve so callerRole='admin' is set and
    // the Insights tab becomes visible.
    await waitFor(() =>
      expect(screen.getByRole('tab', { name: /Learning Insights/ })).toBeInTheDocument(),
    );
    act(() => {
      fireEvent.click(screen.getByRole('tab', { name: /Learning Insights/ }));
    });
    expect(screen.getByTestId('child-panel-insights')).toBeInTheDocument();
    await waitFor(() => expect(screen.getByTestId('child-insights-panel')).toBeInTheDocument());
  });

  it("shows the child's name in the header once members load", async () => {
    renderAt();
    await waitFor(() =>
      expect(screen.getByTestId('child-world-name').textContent).toContain('Ali'),
    );
  });

  it('switches to the Journal tab', async () => {
    renderAt();
    await waitFor(() => expect(screen.getByTestId('child-world')).toBeInTheDocument());
    act(() => {
      fireEvent.click(screen.getByRole('tab', { name: /Journal/ }));
    });
    expect(screen.getByTestId('child-panel-journal')).toBeInTheDocument();
    await waitFor(() => expect(screen.getByTestId('journal-tab')).toBeInTheDocument());
  });

  // FHS-523: header: the shared account pill (parent name, child switcher via
  // "View World" links, log out) + a "Family Hub" breadcrumb to the dashboard.
  it("shows the parent's account pill with their name, not their login email", async () => {
    renderAt();
    const pill = await screen.findByTestId('dashboard-profile-pill');
    await waitFor(() => expect(pill.textContent).toMatch(/Nadia/));
    expect(pill.textContent).not.toMatch(/parent@example\.com/);
  });

  it('the "Family Hub" breadcrumb returns to the dashboard', async () => {
    renderAt();
    await waitFor(() => expect(screen.getByTestId('child-world-home')).toBeInTheDocument());
    await act(async () => {
      fireEvent.click(screen.getByTestId('child-world-home'));
    });
    await waitFor(() => expect(screen.getByTestId('dashboard-page')).toBeInTheDocument());
  });

  it("the account menu lists each child's world (the switcher) and logs out to /login", async () => {
    renderAt();
    const pill = await screen.findByTestId('dashboard-profile-pill');
    await waitFor(() => expect(pill.textContent).toMatch(/Nadia/));
    await act(async () => {
      fireEvent.click(pill);
    });
    // The sibling appears as a "View World" link: this replaces the old switcher.
    expect(await screen.findByTestId(`dashboard-profile-child-${SIBLING}`)).toBeInTheDocument();
    // Log out from the menu → /login.
    await act(async () => {
      fireEvent.click(screen.getByTestId('dashboard-logout'));
    });
    await waitFor(() => expect(screen.getByTestId('login-page')).toBeInTheDocument());
  });

  // FHS-585: every row read "View World", including the world already on
  // screen, so with two children a parent had to remember which one they
  // opened or tap one to find out.
  it('the account menu marks the child whose world is open', async () => {
    renderAt();
    const pill = await screen.findByTestId('dashboard-profile-pill');
    await waitFor(() => expect(pill.textContent).toMatch(/Nadia/));
    await act(async () => {
      fireEvent.click(pill);
    });

    const open = await screen.findByTestId(`dashboard-profile-child-${MEMBER}`);
    const other = await screen.findByTestId(`dashboard-profile-child-${SIBLING}`);

    expect(open).toHaveAttribute('aria-current', 'true');
    expect(other).not.toHaveAttribute('aria-current');
    expect(screen.getByTestId(`dashboard-profile-child-${MEMBER}-state`).textContent).toMatch(
      /Viewing/,
    );
    expect(screen.getByTestId(`dashboard-profile-child-${SIBLING}-state`).textContent).toMatch(
      /View World/,
    );
    // Marked in more than colour: the row carries a ring, not just a tint.
    expect(open.className).toMatch(/ring-purple-700/);
  });

  it('tapping the child already on screen just closes the menu', async () => {
    renderAt();
    const pill = await screen.findByTestId('dashboard-profile-pill');
    await waitFor(() => expect(pill.textContent).toMatch(/Nadia/));
    await act(async () => {
      fireEvent.click(pill);
    });
    await act(async () => {
      fireEvent.click(await screen.findByTestId(`dashboard-profile-child-${MEMBER}`));
    });
    // No pointless re-navigation to the page we are already on.
    expect(screen.getByTestId('location').textContent).toBe(`/t/khan/child/${MEMBER}`);
    await waitFor(() =>
      expect(screen.queryByTestId(`dashboard-profile-child-${SIBLING}`)).toBeNull(),
    );
  });

  it('switching to a sibling from the account menu navigates in-app to their world', async () => {
    renderAt();
    const pill = await screen.findByTestId('dashboard-profile-pill');
    await waitFor(() => expect(pill.textContent).toMatch(/Nadia/));
    await act(async () => {
      fireEvent.click(pill);
    });
    // FHS-523: "View World" must switch child via SPA nav (react-router), not a
    // full page reload, so the URL changes without leaving the app.
    await act(async () => {
      fireEvent.click(await screen.findByTestId(`dashboard-profile-child-${SIBLING}`));
    });
    await waitFor(() =>
      expect(screen.getByTestId('location').textContent).toBe(`/t/khan/child/${SIBLING}`),
    );
  });

  // FHS-401: Learning Insights tab visibility gated by callerRole.

  it('Learning Insights tab is visible when callerRole = admin', async () => {
    // Default installApi already returns callerRole: 'admin'.
    renderAt();
    await waitFor(() =>
      expect(screen.getByTestId('child-world-name').textContent).toContain('Ali'),
    );
    expect(screen.getByRole('tab', { name: /Learning Insights/ })).toBeInTheDocument();
  });

  it('Learning Insights tab is visible when callerRole = adult', async () => {
    fetchMock.mockImplementation((url: string) => {
      const u = String(url);
      if (u.includes('/api/members')) {
        return Promise.resolve({
          ok: true,
          status: 200,
          json: async () => ({
            callerRole: 'adult',
            members: [{ id: MEMBER, displayName: 'Ali', avatarEmoji: '👦', isChild: true }],
          }),
        });
      }
      if (u.includes('/api/mw/financial/savings')) {
        return Promise.resolve({
          ok: true,
          status: 200,
          json: async () => ({ savedStickers: 0, savedCash: 0 }),
        });
      }
      return Promise.resolve({ ok: true, status: 200, json: async () => ({ habits: [] }) });
    });
    renderAt();
    await waitFor(() =>
      expect(screen.getByTestId('child-world-name').textContent).toContain('Ali'),
    );
    expect(screen.getByRole('tab', { name: /Learning Insights/ })).toBeInTheDocument();
  });

  it('Learning Insights tab is NOT visible when callerRole = child (FHS-401)', async () => {
    fetchMock.mockImplementation((url: string) => {
      const u = String(url);
      if (u.includes('/api/members')) {
        return Promise.resolve({
          ok: true,
          status: 200,
          json: async () => ({
            callerRole: 'child',
            members: [{ id: MEMBER, displayName: 'Ali', avatarEmoji: '👦', isChild: true }],
          }),
        });
      }
      if (u.includes('/api/mw/financial/savings')) {
        return Promise.resolve({
          ok: true,
          status: 200,
          json: async () => ({ savedStickers: 0, savedCash: 0 }),
        });
      }
      return Promise.resolve({ ok: true, status: 200, json: async () => ({ habits: [] }) });
    });
    renderAt();
    await waitFor(() =>
      expect(screen.getByTestId('child-world-name').textContent).toContain('Ali'),
    );
    expect(screen.queryByRole('tab', { name: /Learning Insights/ })).not.toBeInTheDocument();
    // Other tabs still present
    expect(screen.getByRole('tab', { name: /My World/ })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: /Journal/ })).toBeInTheDocument();
  });
});
