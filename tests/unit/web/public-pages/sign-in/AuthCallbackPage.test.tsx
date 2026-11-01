import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { AuthCallbackPage } from '../../../../../src/public-pages/sign-in/AuthCallbackPage';

// Auth-first onboarding (option A in the duplication thread).
// AuthCallbackPage now does two things and nothing else:
//   1. Claim the PKCE `?code=` (if present) via exchangeCodeForSession
//      so the AuthProvider sees the session before falling to /login.
//   2. Once the session is established, navigate to /dashboard. The
//      tenant-create + "first-time setup" flow has moved to the
//      CreateFamilyPanel under LegacyDashboardRedirect: see
//      `LegacyDashboardRedirect.test.tsx` for that contract.

type SessionLike = {
  access_token?: string;
  user?: { id?: string; email?: string; user_metadata?: Record<string, unknown> };
} | null;
const authState: { loading: boolean; session: SessionLike } = { loading: false, session: null };
vi.mock('../../../../../src/app/lib/auth-context', () => ({
  useAuth: () => authState,
}));

const exchangeCodeForSession = vi.fn();
const signOut = vi.fn();
vi.mock('../../../../../src/app/lib/supabase', () => ({
  supabase: {
    auth: {
      exchangeCodeForSession: (...args: unknown[]) => exchangeCodeForSession(...args),
      signOut: (...args: unknown[]) => signOut(...args),
    },
  },
}));

function renderAt(initial: string) {
  return render(
    <MemoryRouter initialEntries={[initial]}>
      <Routes>
        <Route path="/auth/callback" element={<AuthCallbackPage />} />
        <Route path="/dashboard" element={<div data-testid="route-marker">dashboard</div>} />
        <Route path="/login" element={<div data-testid="route-marker">login</div>} />
      </Routes>
    </MemoryRouter>,
  );
}

describe('<AuthCallbackPage />', () => {
  beforeEach(() => {
    sessionStorage.clear();
    localStorage.clear();
    authState.loading = false;
    authState.session = null;
    exchangeCodeForSession.mockReset();
    exchangeCodeForSession.mockResolvedValue({ error: null });
    signOut.mockReset();
    signOut.mockResolvedValue({ error: null });
  });

  afterEach(() => {
    sessionStorage.clear();
    localStorage.clear();
  });

  it('navigates to /dashboard once the session is established', async () => {
    authState.session = {
      access_token: 'jwt-abc',
      user: { id: 'u1', email: 'sarah@example.com', user_metadata: {} },
    };
    renderAt('/auth/callback');
    await waitFor(() => expect(screen.getByTestId('route-marker').textContent).toBe('dashboard'));
  });

  // FHS-331: an expired magic link must not look "signed in" via a stale
  // persisted session. The callback shows the expired message and does not
  // navigate into the app on its own.
  // FHS-714: but tapping an old email no longer signs out whoever is signed
  // in. They are told nothing needs fixing and can carry on.
  it('FHS-714: an old sign-in email keeps a signed-in parent signed in', async () => {
    authState.session = {
      access_token: 'live-jwt',
      user: { id: 'u1', email: 'sarah@example.com', user_metadata: {} },
    };
    renderAt(
      '/auth/callback#error=access_denied&error_code=otp_expired&error_description=Email+link+is+invalid+or+has+expired',
    );
    // FHS-575: a dead link gets its own screen, not the loader's alert.
    expect(screen.getByTestId('link-expired-title').textContent).toMatch(/expired/i);
    expect(
      screen.getByText("You're still signed in, so there's nothing to fix."),
    ).toBeInTheDocument();
    // Must NOT have navigated into the app by itself.
    expect(screen.queryByTestId('route-marker')).toBeNull();
    expect(signOut).not.toHaveBeenCalled();
  });

  it('FHS-714: "Continue as" takes a signed-in parent to their dashboard', async () => {
    authState.session = {
      access_token: 'live-jwt',
      user: { id: 'u1', email: 'sarah@example.com', user_metadata: {} },
    };
    renderAt(
      '/auth/callback#error=access_denied&error_code=otp_expired&error_description=Email+link+is+invalid+or+has+expired',
    );
    const button = screen.getByTestId('link-expired-continue');
    expect(button.textContent).toBe('Continue as sarah@example.com');
    expect(screen.queryByTestId('link-expired-send')).toBeNull();
    fireEvent.click(button);
    expect(screen.getByTestId('route-marker').textContent).toBe('dashboard');
  });

  it('FHS-714: with nobody signed in, an old link still signs out and offers a new one', async () => {
    renderAt(
      '/auth/callback#error=access_denied&error_code=otp_expired&error_description=Email+link+is+invalid+or+has+expired',
    );
    expect(screen.getByTestId('link-expired-send')).toBeInTheDocument();
    expect(screen.queryByTestId('link-expired-continue')).toBeNull();
    await waitFor(() => expect(signOut).toHaveBeenCalled());
  });

  it('FHS-714: waits to know who is signed in before choosing the screen', () => {
    authState.loading = true;
    renderAt(
      '/auth/callback#error=access_denied&error_code=otp_expired&error_description=Email+link+is+invalid+or+has+expired',
    );
    expect(screen.getByTestId('loading-screen')).toBeInTheDocument();
    expect(screen.queryByTestId('link-expired')).toBeNull();
    expect(signOut).not.toHaveBeenCalled();
  });

  // FHS-604: an email link opens a NEW tab, whose sessionStorage is empty.
  // The device-level memory has to carry the address across, or the screen
  // asks who you are even though we sent the link to you.
  it('FHS-712: a Google sign-in left open too long says so, and offers sign-in again', async () => {
    renderAt(
      '/auth/callback?error=invalid_request&error_code=bad_oauth_state&error_description=OAuth+state+has+expired',
    );
    expect(await screen.findByTestId('link-expired-title')).toHaveTextContent('That took too long');
    expect(
      screen.getByText('We stopped it to keep your account safe. Please try again.'),
    ).toBeInTheDocument();
    expect(screen.getByTestId('link-expired-try-again')).toBeInTheDocument();
    expect(screen.queryByTestId('link-expired-send')).not.toBeInTheDocument();
  });

  it("FHS-714: Cancel on Google says Google sign-in didn't finish, not a broken email link", async () => {
    renderAt('/auth/callback?error=access_denied&error_description=User+cancelled+the+request');
    expect(await screen.findByTestId('link-expired-title')).toHaveTextContent(
      "Google sign-in didn't finish",
    );
    expect(screen.getByTestId('link-expired-try-again')).toBeInTheDocument();
    expect(screen.queryByTestId('link-expired-send')).not.toBeInTheDocument();
  });

  it('FHS-714: an expired email link still says so, not "Google"', async () => {
    renderAt(
      '/auth/callback#error=access_denied&error_code=otp_expired&error_description=Email+link+is+invalid+or+has+expired',
    );
    expect(await screen.findByTestId('link-expired-title')).toHaveTextContent(
      'That link has expired',
    );
  });

  it('FHS-604: a fresh tab recalls the address from device memory', async () => {
    localStorage.setItem('fh.auth.email', 'sarah@khan.family');
    renderAt(
      '/auth/callback#error=access_denied&error_code=otp_expired&error_description=Email+link+is+invalid+or+has+expired',
    );
    await screen.findByTestId('link-expired-title');
    // FHS-609: a known address is stated in the panel, not typed in a box.
    expect(screen.getByTestId('link-expired-known-address').textContent).toContain(
      'sarah@khan.family',
    );
  });

  it('FHS-604: the same tab still wins over device memory', async () => {
    sessionStorage.setItem('fh.signup.email', 'tab@khan.family');
    localStorage.setItem('fh.auth.email', 'device@khan.family');
    renderAt(
      '/auth/callback#error=access_denied&error_code=otp_expired&error_description=Email+link+is+invalid+or+has+expired',
    );
    await screen.findByTestId('link-expired-title');
    expect(screen.getByTestId('link-expired-known-address').textContent).toContain(
      'tab@khan.family',
    );
  });

  // FHS-605: the link itself carries the address, so a device that never
  // requested anything still knows who the link was for.
  it('FHS-605: the address in the link wins on a strange device', async () => {
    renderAt(
      '/auth/callback?email=sarah%40khan.family#error=access_denied&error_code=otp_expired&error_description=Email+link+is+invalid+or+has+expired',
    );
    await screen.findByTestId('link-expired-title');
    expect(screen.getByTestId('link-expired-known-address').textContent).toContain(
      'sarah@khan.family',
    );
  });

  it('FHS-605: junk in the email parameter is ignored', async () => {
    renderAt(
      '/auth/callback?email=%3Cscript%3Enope#error=access_denied&error_code=otp_expired&error_description=Email+link+is+invalid+or+has+expired',
    );
    await screen.findByTestId('link-expired-title');
    expect(screen.getByTestId('link-expired-email')).toHaveValue('');
    expect(screen.queryByTestId('link-expired-known-address')).not.toBeInTheDocument();
  });

  it('FHS-605: a valid sign-in carrying the address still lands on the dashboard', async () => {
    authState.session = {
      access_token: 'jwt-abc',
      user: { id: 'u1', email: 'sarah@example.com', user_metadata: {} },
    };
    renderAt('/auth/callback?email=sarah%40khan.family');
    await waitFor(() => expect(screen.getByTestId('route-marker').textContent).toBe('dashboard'));
  });

  it('FHS-604: a device that never asked for a link still gets the empty box', async () => {
    renderAt(
      '/auth/callback#error=access_denied&error_code=otp_expired&error_description=Email+link+is+invalid+or+has+expired',
    );
    await screen.findByTestId('link-expired-title');
    expect(screen.getByTestId('link-expired-email')).toHaveValue('');
    expect(screen.queryByTestId('link-expired-known-address')).not.toBeInTheDocument();
  });

  it('does NOT POST any tenant-create call from the callback page', async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    authState.session = {
      access_token: 'jwt-abc',
      user: { id: 'u1', email: 'sarah@example.com', user_metadata: {} },
    };
    renderAt('/auth/callback');
    await waitFor(() => expect(screen.getByTestId('route-marker').textContent).toBe('dashboard'));
    // Tenant creation is the create-family panel's job now.
    expect(fetchMock).not.toHaveBeenCalled();
    vi.unstubAllGlobals();
  });

  it('clears any legacy fh.signup.intent left over from older flows', async () => {
    sessionStorage.setItem(
      'fh.signup.intent',
      JSON.stringify({ familyName: 'old', displayName: 'old', slug: 'old' }),
    );
    authState.session = {
      access_token: 'jwt-abc',
      user: { id: 'u1', email: 'sarah@example.com', user_metadata: {} },
    };
    renderAt('/auth/callback');
    await waitFor(() => expect(screen.getByTestId('route-marker').textContent).toBe('dashboard'));
    expect(sessionStorage.getItem('fh.signup.intent')).toBeNull();
  });

  it('bounces to /login when there is no session (cancelled / failed OAuth)', async () => {
    authState.session = null;
    renderAt('/auth/callback');
    await waitFor(() => expect(screen.getByTestId('route-marker').textContent).toBe('login'));
  });

  it('shows the loading copy while auth-context is still resolving', () => {
    authState.loading = true;
    authState.session = null;
    renderAt('/auth/callback');
    expect(screen.getByTestId('loading-screen')).toBeInTheDocument();
    expect(screen.queryByTestId('route-marker')).toBeNull();
  });

  describe('PKCE callback (URL has ?code=)', () => {
    it('exchanges the code, strips it from the URL, then continues to /dashboard', async () => {
      exchangeCodeForSession.mockResolvedValueOnce({ error: null });
      // Simulate the SDK populating the session after the exchange resolves.
      authState.session = {
        access_token: 'jwt-after-exchange',
        user: { id: 'u1', email: 'sarah@example.com', user_metadata: {} },
      };
      renderAt('/auth/callback?code=pkce-abc&state=xyz');
      await waitFor(() => expect(exchangeCodeForSession).toHaveBeenCalledWith('pkce-abc'));
      await waitFor(() => expect(screen.getByTestId('route-marker').textContent).toBe('dashboard'));
    });

    it('surfaces an inline error when the code has expired or already been used', async () => {
      exchangeCodeForSession.mockResolvedValueOnce({
        error: { message: 'one-time use' },
      });
      renderAt('/auth/callback?code=stale&state=xyz');
      await waitFor(() =>
        expect(screen.getByTestId('link-expired-title').textContent).toMatch(/expired|used/i),
      );
      // We do NOT bounce to /login on an exchange error: the user
      // needs to see the message and request a fresh link.
      expect(screen.queryByTestId('route-marker')).toBeNull();
    });
  });
});
