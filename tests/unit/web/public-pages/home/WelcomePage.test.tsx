import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

// FHS-358: the homepage reflects logged-in state. WelcomePage reads useAuth()
// (adult session) + fh.kid.token (kid) to switch between the public ad hero and
// a "Welcome back" landing. Mock the auth module + fetch.

const authState: {
  session: { access_token: string; user: object } | null;
  loading: boolean;
} = { session: null, loading: false };
let kidTokenReturn: string | null = null;
vi.mock('../../../../../src/app/lib/auth-context', () => ({
  useAuth: () => authState,
  signOutAll: vi.fn(async () => ({ error: null })),
  // The page uses getKidToken (validates expiry), not raw localStorage.
  getKidToken: () => kidTokenReturn,
}));

import { WelcomePage } from '../../../../../src/public-pages/home/WelcomePage';

const fetchMock = vi.fn();

function installAdultApi() {
  fetchMock.mockImplementation((url: string) => {
    const u = String(url);
    if (u.includes('/api/members')) {
      return Promise.resolve({
        ok: true,
        status: 200,
        json: async () => ({
          callerRole: 'admin',
          members: [
            { id: 'k1', displayName: 'Iman', avatarEmoji: '👦', isChild: true },
            { id: 'a1', displayName: 'Dad', avatarEmoji: '🧔', isChild: false },
          ],
        }),
      });
    }
    // /api/me
    return Promise.resolve({
      ok: true,
      status: 200,
      json: async () => ({ tenants: [{ slug: 'khans', name: 'Khan Family' }] }),
    });
  });
}

function renderPage() {
  return render(
    <MemoryRouter>
      <WelcomePage />
    </MemoryRouter>,
  );
}

beforeEach(() => {
  authState.session = null;
  authState.loading = false;
  kidTokenReturn = null;
  fetchMock.mockReset();
  localStorage.clear();
  vi.stubGlobal('fetch', fetchMock);
});
afterEach(() => vi.unstubAllGlobals());

describe('<WelcomePage />: logged-in state (FHS-358)', () => {
  it('logged out: shows the public CTAs, not the welcome-back landing', () => {
    renderPage();
    expect(screen.getByText('Start free')).toBeInTheDocument();
    expect(screen.getByText('Log in')).toBeInTheDocument();
    expect(screen.queryByTestId('welcome-loggedin')).not.toBeInTheDocument();
  });

  // FHS-541: the "What is Family Hub" value-prop card was removed (its content
  // lives on the About page, reachable from the header). The homepage now
  // surfaces the /legal hub in the header nav and the footer.
  it('logged out: no value-prop card; About stays in the header, Legal is surfaced', () => {
    renderPage();
    expect(screen.queryByTestId('welcome-value-prop')).not.toBeInTheDocument();
    // About still reachable from the header nav.
    expect(screen.getByRole('link', { name: /^about$/i })).toHaveAttribute('href', '/about');
    // FHS-544: the logged-out homepage now uses the shared SiteHeader +
    // SiteFooter, so the chrome matches the legal/marketing pages exactly.
    // Header Legal link → /legal.
    // FHS-561 + FHS-572: the header names it "Legal" and the footer renders
    // a phone nav and a desktop nav, so several match. All go to the index.
    const legalLinks = screen.getAllByRole('link', { name: /^legal$/i });
    expect(legalLinks.length).toBeGreaterThan(0);
    for (const link of legalLinks) expect(link).toHaveAttribute('href', '/legal');
    // Shared footer: the full legal-links set.
    for (const l of screen.getAllByRole('link', { name: /^privacy$/i }))
      expect(l).toHaveAttribute('href', '/legal/privacy');
    for (const l of screen.getAllByRole('link', { name: /children & parents/i }))
      expect(l).toHaveAttribute('href', '/legal/children');
    for (const l of screen.getAllByRole('link', { name: /^terms$/i }))
      expect(l).toHaveAttribute('href', '/legal/terms');
    for (const l of screen.getAllByRole('link', { name: /^cookies$/i }))
      expect(l).toHaveAttribute('href', '/legal/cookies');
    // FHS-561: the footer index link is named "Legal" too, asserted above.
  });

  it('while the session is restoring: shows a splash, not the logged-out hero', () => {
    authState.loading = true; // session still being restored
    renderPage();
    expect(screen.getByTestId('welcome-auth-loading')).toBeInTheDocument();
    expect(screen.queryByText('Start free')).not.toBeInTheDocument();
  });

  it('adult logged in: welcome-back landing with dashboard + members + child world', async () => {
    authState.session = { access_token: 'tok', user: {} };
    installAdultApi();
    renderPage();
    await waitFor(() => expect(screen.getByTestId('welcome-loggedin')).toBeInTheDocument());
    // Profile pill + logout instead of Log in / Start free.
    expect(screen.getByTestId('welcome-logout')).toBeInTheDocument();
    expect(screen.queryByText('Start free')).not.toBeInTheDocument();
    // Quick links: dashboard, manage members, and the child's world.
    await waitFor(() => expect(screen.getByText("Iman's World")).toBeInTheDocument());
    expect(screen.getByText('Manage family')).toBeInTheDocument();
    expect(screen.getByText('Reward settings')).toBeInTheDocument();
    expect(screen.getAllByText('Go to your dashboard').length).toBeGreaterThan(0);
  });

  // FHR-32: never say the hub is ready when it is not.
  it('adult signed in with no family yet: asks them to finish setting up', async () => {
    authState.session = { access_token: 'tok', user: {} };
    fetchMock.mockResolvedValue({ ok: true, status: 200, json: async () => ({ tenants: [] }) });
    renderPage();
    await waitFor(() => expect(screen.getByTestId('welcome-loggedin-setup')).toBeInTheDocument());
    expect(screen.getByText(/not set up yet/)).toBeInTheDocument();
    expect(screen.getByTestId('welcome-finish-setup')).toBeInTheDocument();
    expect(screen.queryByText(/hub is ready/)).not.toBeInTheDocument();
    expect(screen.queryByText('Go to your dashboard')).not.toBeInTheDocument();
  });

  it('adult whose setup is unfinished: asks them to finish setting up', async () => {
    authState.session = { access_token: 'tok', user: {} };
    fetchMock.mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        tenants: [{ slug: 'khans', name: 'Khan Family', onboardingCompleted: false }],
      }),
    });
    renderPage();
    await waitFor(() => expect(screen.getByTestId('welcome-loggedin-setup')).toBeInTheDocument());
    expect(screen.queryByText(/hub is ready/)).not.toBeInTheDocument();
  });

  it('adult in two families: a half-made second family does not hide the ready one', async () => {
    authState.session = { access_token: 'tok', user: {} };
    fetchMock.mockImplementation((url: string) =>
      Promise.resolve(
        String(url).includes('/api/members')
          ? { ok: true, status: 200, json: async () => ({ members: [] }) }
          : {
              ok: true,
              status: 200,
              json: async () => ({
                tenants: [
                  { slug: 'draft', name: 'Draft Family', onboardingCompleted: false },
                  { slug: 'khans', name: 'Khan Family', onboardingCompleted: true },
                ],
              }),
            },
      ),
    );
    renderPage();
    await waitFor(() => expect(screen.getByTestId('welcome-loggedin')).toBeInTheDocument());
    expect(screen.getByText(/Khan Family hub is ready/)).toBeInTheDocument();
  });

  it('invited adult joining a finished family sees it as ready', async () => {
    authState.session = { access_token: 'tok', user: {} };
    fetchMock.mockImplementation((url: string) =>
      Promise.resolve(
        String(url).includes('/api/members')
          ? { ok: true, status: 200, json: async () => ({ members: [] }) }
          : {
              ok: true,
              status: 200,
              json: async () => ({
                tenants: [{ slug: 'khans', name: 'Khan Family', onboardingCompleted: true }],
              }),
            },
      ),
    );
    renderPage();
    await waitFor(() => expect(screen.getByTestId('welcome-loggedin')).toBeInTheDocument());
    expect(screen.queryByTestId('welcome-loggedin-setup')).not.toBeInTheDocument();
  });

  it('adult logged in but /api/me fails: degrades to welcome-back + dashboard CTA, no crash', async () => {
    authState.session = { access_token: 'tok', user: {} };
    fetchMock.mockResolvedValue({ ok: false, status: 500, json: async () => ({}) });
    renderPage();
    await waitFor(() => expect(screen.getByTestId('welcome-loggedin')).toBeInTheDocument());
    expect(screen.getAllByText('Go to your dashboard').length).toBeGreaterThan(0);
    expect(screen.queryByText('Start free')).not.toBeInTheDocument();
  });

  it('kid logged in: welcome-back landing, no member management', async () => {
    kidTokenReturn = 'kid-jwt';
    localStorage.setItem(
      'fh.kid.lastFamily',
      JSON.stringify({ slug: 'khans', name: 'Khan Family' }),
    );
    renderPage();
    await waitFor(() => expect(screen.getByTestId('welcome-loggedin')).toBeInTheDocument());
    expect(screen.getByTestId('welcome-logout')).toBeInTheDocument();
    expect(screen.getAllByText('Go to my hub').length).toBeGreaterThan(0);
    expect(screen.queryByText('Manage family')).not.toBeInTheDocument();
    expect(screen.queryByText('Reward settings')).not.toBeInTheDocument();
    expect(screen.queryByText('Start free')).not.toBeInTheDocument();
  });
});
