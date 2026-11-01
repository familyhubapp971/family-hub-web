import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Routes, Route, useLocation } from 'react-router-dom';
import { KidLoginPage } from '../../../../../src/public-pages/sign-in/KidLoginPage';

// FHS-238: kid log-in page at /t/:slug/kid-login. Loads the family +
// avatar grid from GET /api/public/kid-members/:slug, lets the kid
// pick a face, then POSTs the 4-digit PIN to /api/auth/kid-pin
// (FHS-236). On success the kid JWT is stashed in localStorage and
// the page navigates to /t/:slug/dashboard.

const KIDS = [
  { id: '11111111-1111-1111-1111-111111111111', displayName: 'Aisha', avatarEmoji: null },
  { id: '22222222-2222-2222-2222-222222222222', displayName: 'Yusuf', avatarEmoji: null },
];

function LocationProbe() {
  const loc = useLocation();
  return <span data-testid="location-pathname">{loc.pathname}</span>;
}

function renderPage(slug = 'khan') {
  return render(
    <MemoryRouter initialEntries={[`/t/${slug}/kid-login`]}>
      <Routes>
        <Route
          path="/t/:slug/kid-login"
          element={
            <>
              <KidLoginPage />
              <LocationProbe />
            </>
          }
        />
        <Route
          path="/t/:slug/dashboard"
          element={
            <>
              <div data-testid="route-marker">dashboard</div>
              <LocationProbe />
            </>
          }
        />
        <Route
          path="/login"
          element={
            <>
              <div data-testid="route-marker">login</div>
              <LocationProbe />
            </>
          }
        />
      </Routes>
    </MemoryRouter>,
  );
}

function jsonResponse(body: unknown, init: ResponseInit = {}) {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { 'content-type': 'application/json' },
    ...init,
  });
}

describe('<KidLoginPage />', () => {
  const originalFetch = global.fetch;
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    fetchMock = vi.fn();
    global.fetch = fetchMock as unknown as typeof global.fetch;
    localStorage.clear();
  });

  afterEach(() => {
    global.fetch = originalFetch;
    vi.restoreAllMocks();
  });

  it('renders the avatar grid + family name from GET /api/public/kid-members/:slug', async () => {
    fetchMock.mockResolvedValueOnce(
      jsonResponse({ family: { slug: 'khan', name: 'Khan Family' }, kids: KIDS }),
    );
    renderPage();

    await waitFor(() => expect(screen.getByText('Khan Family')).toBeInTheDocument());
    expect(screen.getByTestId('kid-login-avatars')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Aisha/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Yusuf/ })).toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledWith(expect.stringContaining('/api/public/kid-members/khan'));
  });

  it('remembers the family on the device after a successful load (FHS-353)', async () => {
    fetchMock.mockResolvedValueOnce(
      jsonResponse({ family: { slug: 'khan', name: 'Khan Family' }, kids: KIDS }),
    );
    renderPage();
    await waitFor(() => expect(screen.getByText('Khan Family')).toBeInTheDocument());
    // The login screen's "Continue as <family>" shortcut reads this.
    const remembered = JSON.parse(localStorage.getItem('fh.kid.lastFamily') ?? 'null');
    expect(remembered).toEqual({ slug: 'khan', name: 'Khan Family' });
  });

  it('shows "family not found" on 404', async () => {
    fetchMock.mockResolvedValueOnce(new Response('not found', { status: 404 }));
    renderPage('no-such');
    await waitFor(() => expect(screen.getByTestId('kid-login-not-found')).toBeInTheDocument());
  });

  it('shows "no kid logins set up yet" when the family has zero kids with PINs', async () => {
    fetchMock.mockResolvedValueOnce(
      jsonResponse({ family: { slug: 'khan', name: 'Khan Family' }, kids: [] }),
    );
    renderPage();
    await waitFor(() => expect(screen.getByTestId('kid-login-empty')).toBeInTheDocument());
  });

  it('shows the load-error pane on a 500', async () => {
    fetchMock.mockResolvedValueOnce(new Response('boom', { status: 500 }));
    renderPage();
    await waitFor(() => expect(screen.getByTestId('kid-login-load-error')).toBeInTheDocument());
  });

  it('selecting a kid reveals the PIN input + submitting a correct PIN navigates to /t/:slug/dashboard', async () => {
    fetchMock.mockResolvedValueOnce(
      jsonResponse({ family: { slug: 'khan', name: 'Khan Family' }, kids: KIDS }),
    );
    fetchMock.mockResolvedValueOnce(
      jsonResponse({ token: 'kid.jwt.here', member: { id: KIDS[0]!.id, displayName: 'Aisha' } }),
    );
    renderPage();

    await waitFor(() => expect(screen.getByText('Khan Family')).toBeInTheDocument());
    fireEvent.click(screen.getByRole('button', { name: /Aisha/ }));
    expect(screen.getByTestId('kid-login-pin-section')).toBeInTheDocument();

    const inputs = screen.getByTestId('kid-login-pin').querySelectorAll<HTMLInputElement>('input');
    expect(inputs).toHaveLength(4);
    ['1', '2', '3', '4'].forEach((d, i) => {
      fireEvent.change(inputs[i]!, { target: { value: d } });
    });

    await waitFor(() => expect(screen.getByTestId('route-marker').textContent).toBe('dashboard'));
    expect(screen.getByTestId('location-pathname').textContent).toBe('/t/khan/dashboard');
    expect(localStorage.getItem('fh.kid.token')).toBe('kid.jwt.here');

    expect(fetchMock).toHaveBeenLastCalledWith(
      expect.stringContaining('/api/auth/kid-pin'),
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({ tenantSlug: 'khan', memberId: KIDS[0]!.id, pin: '1234' }),
      }),
    );
  });

  it('shows the wrong-PIN error on 401 and clears the digits', async () => {
    fetchMock.mockResolvedValueOnce(
      jsonResponse({ family: { slug: 'khan', name: 'Khan Family' }, kids: KIDS }),
    );
    fetchMock.mockResolvedValueOnce(
      jsonResponse({ error: 'invalid login', errorCode: 'KID_PIN_INVALID' }, { status: 401 }),
    );
    renderPage();

    await waitFor(() => expect(screen.getByText('Khan Family')).toBeInTheDocument());
    fireEvent.click(screen.getByRole('button', { name: /Aisha/ }));
    const inputs = screen.getByTestId('kid-login-pin').querySelectorAll<HTMLInputElement>('input');
    ['9', '9', '9', '9'].forEach((d, i) => {
      fireEvent.change(inputs[i]!, { target: { value: d } });
    });

    await waitFor(() => expect(screen.getByTestId('kid-login-error')).toBeInTheDocument());
    expect(screen.getByTestId('kid-login-error').textContent).toMatch(/didn.t match/i);
    // No JWT stored, no navigation away from /kid-login.
    expect(localStorage.getItem('fh.kid.token')).toBeNull();
    expect(screen.getByTestId('location-pathname').textContent).toBe('/t/khan/kid-login');
  });

  it('shows the lockout pane on 429 with the Retry-After cooldown', async () => {
    fetchMock.mockResolvedValueOnce(
      jsonResponse({ family: { slug: 'khan', name: 'Khan Family' }, kids: KIDS }),
    );
    fetchMock.mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          error: 'too many attempts',
          errorCode: 'KID_PIN_LOCKED',
          retryAfter: 600,
        }),
        { status: 429, headers: { 'content-type': 'application/json', 'Retry-After': '600' } },
      ),
    );
    renderPage();

    await waitFor(() => expect(screen.getByText('Khan Family')).toBeInTheDocument());
    fireEvent.click(screen.getByRole('button', { name: /Aisha/ }));
    const inputs = screen.getByTestId('kid-login-pin').querySelectorAll<HTMLInputElement>('input');
    ['1', '2', '3', '4'].forEach((d, i) => {
      fireEvent.change(inputs[i]!, { target: { value: d } });
    });

    await waitFor(() => expect(screen.getByTestId('kid-login-locked')).toBeInTheDocument());
    expect(screen.getByTestId('kid-login-locked').textContent).toMatch(/10 minutes/);
  });

  it('"Pick a different face" returns to the avatar grid and clears any error', async () => {
    fetchMock.mockResolvedValueOnce(
      jsonResponse({ family: { slug: 'khan', name: 'Khan Family' }, kids: KIDS }),
    );
    fetchMock.mockResolvedValueOnce(jsonResponse({ error: 'invalid login' }, { status: 401 }));
    renderPage();

    await waitFor(() => expect(screen.getByText('Khan Family')).toBeInTheDocument());
    fireEvent.click(screen.getByRole('button', { name: /Aisha/ }));
    const inputs = screen.getByTestId('kid-login-pin').querySelectorAll<HTMLInputElement>('input');
    ['9', '9', '9', '9'].forEach((d, i) => {
      fireEvent.change(inputs[i]!, { target: { value: d } });
    });
    await waitFor(() => expect(screen.getByTestId('kid-login-error')).toBeInTheDocument());

    fireEvent.click(screen.getByTestId('kid-login-pick-different'));
    // FHS-577: the outgoing view now fades out, so it lingers for a beat.
    // waitFor covers the exit rather than asserting mid-animation.
    await waitFor(() => expect(screen.queryByTestId('kid-login-pin-section')).toBeNull());
    expect(screen.queryByTestId('kid-login-error')).toBeNull();
  });

  it('discards an in-flight PIN submit if a sibling switches to a different avatar mid-flight', async () => {
    fetchMock.mockResolvedValueOnce(
      jsonResponse({ family: { slug: 'khan', name: 'Khan Family' }, kids: KIDS }),
    );
    // Hold the kid-pin POST open so the avatar swap happens before it
    // resolves. Then resolve as 200: the token + navigate must be
    // discarded because the active selection changed.
    let resolvePinFetch: (r: Response) => void = () => {};
    const pendingPin = new Promise<Response>((resolve) => {
      resolvePinFetch = resolve;
    });
    fetchMock.mockReturnValueOnce(pendingPin);
    renderPage();

    await waitFor(() => expect(screen.getByText('Khan Family')).toBeInTheDocument());
    fireEvent.click(screen.getByRole('button', { name: /Aisha/ }));
    const inputs = screen.getByTestId('kid-login-pin').querySelectorAll<HTMLInputElement>('input');
    ['1', '2', '3', '4'].forEach((d, i) => {
      fireEvent.change(inputs[i]!, { target: { value: d } });
    });

    // Sibling grabs the iPad mid-flight. FHS-573 made this two steps to
    // match the design, so they go Back to the faces first. The stale-submit
    // guard is the point of this test and still has to hold.
    fireEvent.click(screen.getByTestId('kid-login-pick-different'));
    fireEvent.click(screen.getByRole('button', { name: /Yusuf/ }));

    // Now resolve the original (Aisha's) fetch with a successful token.
    resolvePinFetch(
      jsonResponse({ token: 'aisha.jwt', member: { id: KIDS[0]!.id, displayName: 'Aisha' } }),
    );
    await Promise.resolve();
    await Promise.resolve();

    // The original submit is stale: neither Aisha's token nor a
    // navigation away from /kid-login should land.
    expect(localStorage.getItem('fh.kid.token')).toBeNull();
    expect(screen.getByTestId('location-pathname').textContent).toBe('/t/khan/kid-login');
  });

  it('"Switch to parent log-in" link routes to /login', async () => {
    fetchMock.mockResolvedValueOnce(
      jsonResponse({ family: { slug: 'khan', name: 'Khan Family' }, kids: KIDS }),
    );
    renderPage();
    await waitFor(() => expect(screen.getByText('Khan Family')).toBeInTheDocument());
    fireEvent.click(screen.getByTestId('kid-login-to-parent'));
    expect(screen.getByTestId('route-marker').textContent).toBe('login');
  });

  // FHS-399 / FHS-402 - PIN-slot reserved height: the wrapper div stays in the
  // DOM whether or not a kid is selected, keeping the card height constant.
  it('going back from the PIN lands on the faces with the PIN view gone', async () => {
    fetchMock.mockResolvedValueOnce(
      jsonResponse({ family: { slug: 'khan', name: 'Khan Family' }, kids: KIDS }),
    );
    fetchMock.mockResolvedValueOnce(jsonResponse({ error: 'invalid login' }, { status: 401 }));
    renderPage();

    await waitFor(() => expect(screen.getByText('Khan Family')).toBeInTheDocument());

    // Select a kid -> PIN section appears inside the reserve wrapper
    fireEvent.click(screen.getByRole('button', { name: /Aisha/ }));
    expect(screen.getByTestId('kid-login-pin-section')).toBeInTheDocument();

    // Click "Pick a different face"
    fireEvent.click(screen.getByTestId('kid-login-pick-different'));

    // FHS-573 made this two steps and FHS-577 gave them a fade, so the PIN
    // view leaves rather than collapsing a reserved slot. Going back lands on
    // the faces with the PIN view gone.
    await waitFor(() => expect(screen.queryByTestId('kid-login-pin-section')).toBeNull());
    expect(screen.queryByTestId('kid-login-pick-different')).toBeNull();
    expect(screen.getByTestId('kid-login-avatars')).toBeInTheDocument();
  });
  // FHS-577: the faces must fill the card, and three must still fit one row.
  it('lays two faces out two-up at the roomy size', async () => {
    fetchMock.mockResolvedValueOnce(
      jsonResponse({ family: { slug: 'khan', name: 'Khan Family' }, kids: KIDS }),
    );
    renderPage();
    await waitFor(() => expect(screen.getByText('Khan Family')).toBeInTheDocument());

    const grid = screen.getByTestId('kid-login-avatars');
    expect(grid.className).toContain('grid-cols-2');
    for (const tile of grid.querySelectorAll('button')) {
      expect(tile.className).toContain('w-full');
      expect(tile.className).toContain('p-6');
    }
  });

  it('squeezes three faces into one row at the tighter size', async () => {
    const three = [...KIDS, { id: 'kid-3', displayName: 'Faith', avatarEmoji: '🐼' }];
    fetchMock.mockResolvedValueOnce(
      jsonResponse({ family: { slug: 'khan', name: 'Khan Family' }, kids: three }),
    );
    renderPage();
    await waitFor(() => expect(screen.getByText('Khan Family')).toBeInTheDocument());

    const grid = screen.getByTestId('kid-login-avatars');
    expect(grid.className).toContain('grid-cols-3');
    // Tighter padding so three fit a 375px card without overflowing.
    for (const tile of grid.querySelectorAll('button')) {
      expect(tile.className).toContain('p-3');
    }
  });
});
