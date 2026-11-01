import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';

// FHS-715: an old surname address (/t/smith/...) forwards to the family's
// private code, but only for people in that family, and a kid page goes to
// the code step.
// FHS-718: a signed-in grown-up on a family address that is not one of their
// families sees "We can't find that family." instead of a half-loaded page
// with a server error. Kid pages stay as they were.

type FakeSession = { access_token: string; user: { id: string } };
const authState: { session: FakeSession | null; loading: boolean } = {
  session: { access_token: 'tok-1', user: { id: 'user-1' } },
  loading: false,
};
const signOutAll = vi.fn();
vi.mock('../../../../../src/app/lib/auth-context', () => ({
  useAuth: () => authState,
  signOutAll: () => signOutAll(),
}));

import { FamilyAddressGate } from '../../../../../src/app/components/FamilyAddressGate';
import {
  FAMILY_CHECK_TIME_LIMIT_MS,
  forgetFamilyCodes,
} from '../../../../../src/app/lib/my-families';

const OURS = 'e29b-41d4';
const THEIRS = 'aaaa-1111';

const fetchMock = vi.fn();

function Where() {
  const loc = useLocation();
  return <span data-testid="where">{`${loc.pathname}${loc.search}${loc.hash}`}</span>;
}

function renderAt(path: string) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <Where />
      <Routes>
        <Route path="/t/:slug" element={<FamilyAddressGate />}>
          <Route path="kid-login" element={<p data-testid="page">faces</p>} />
          <Route path="members" element={<p data-testid="page">members</p>} />
          <Route path="dashboard" element={<p data-testid="page">home</p>} />
          <Route path="child/:memberId" element={<p data-testid="page">child</p>} />
        </Route>
        <Route path="/login" element={<p data-testid="page">code step</p>} />
        <Route path="/dashboard" element={<p data-testid="page">after sign-in</p>} />
      </Routes>
    </MemoryRouter>,
  );
}

function reply(status: number, body: unknown = {}) {
  return { ok: status >= 200 && status < 300, status, json: async () => body };
}

/** The server: who I am (my families) and the old-address lookup. */
function server({
  myFamilies = [OURS],
  me,
  oldAddress = reply(404),
}: {
  myFamilies?: string[];
  me?: () => Promise<unknown>;
  oldAddress?: unknown;
} = {}) {
  fetchMock.mockImplementation((url: string) => {
    if (url.endsWith('/api/me')) {
      return me
        ? me()
        : Promise.resolve(reply(200, { tenants: myFamilies.map((slug) => ({ slug })) }));
    }
    if (url.includes('/api/family-address/')) return Promise.resolve(oldAddress);
    return Promise.reject(new Error(`unexpected call to ${url}`));
  });
}

function calledUrls(): string[] {
  return fetchMock.mock.calls.map(([url]) => String(url));
}

async function expectCantFind() {
  expect(
    await screen.findByRole('heading', { name: 'We can’t find that family.' }),
  ).toBeInTheDocument();
  expect(screen.getByText('The link may be old or mistyped.')).toBeInTheDocument();
  expect(screen.queryByTestId('page')).toBeNull();
}

beforeEach(() => {
  fetchMock.mockReset();
  signOutAll.mockReset();
  signOutAll.mockResolvedValue({ error: null });
  vi.stubGlobal('fetch', fetchMock);
  forgetFamilyCodes();
  localStorage.clear();
  authState.session = { access_token: 'tok-1', user: { id: 'user-1' } };
  authState.loading = false;
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe('<FamilyAddressGate />: family codes (FHS-718)', () => {
  it('my own family code opens the page', async () => {
    server();
    renderAt(`/t/${OURS}/members`);
    expect(await screen.findByTestId('page')).toHaveTextContent('members');
    expect(screen.queryByTestId('family-not-found')).toBeNull();
  });

  it('a code no family has shows "We can\'t find that family." and no server error', async () => {
    server({ myFamilies: [OURS] });
    renderAt('/t/0000-9999/members');
    await expectCantFind();
    expect(screen.getByRole('button', { name: 'Go to my family' })).toBeInTheDocument();
    expect(screen.queryByText(/server returned/i)).toBeNull();
    expect(screen.queryByText(/your family/i)).toBeNull();
  });

  it("another family's code shows the same screen, without asking the server about that family", async () => {
    server({ myFamilies: [OURS] });
    renderAt(`/t/${THEIRS}/members`);
    await expectCantFind();
    expect(screen.getByRole('button', { name: 'Go to my family' })).toBeInTheDocument();
    // Only "who am I" is asked, so nothing can tell a real family from a made-up one.
    expect(calledUrls().every((url) => url.endsWith('/api/me'))).toBe(true);
  });

  it('"Go to my family" opens my family\'s home', async () => {
    server({ myFamilies: [OURS] });
    renderAt(`/t/${THEIRS}/members`);
    fireEvent.click(await screen.findByRole('button', { name: 'Go to my family' }));
    await waitFor(() =>
      expect(screen.getByTestId('where')).toHaveTextContent(`/t/${OURS}/dashboard`),
    );
    expect(await screen.findByTestId('page')).toHaveTextContent('home');
  });

  it('someone with no family is offered "Create your family", which opens the create step', async () => {
    server({ myFamilies: [] });
    renderAt(`/t/${THEIRS}/members`);
    await expectCantFind();
    expect(screen.queryByRole('button', { name: 'Go to my family' })).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Create your family' }));
    await waitFor(() => expect(screen.getByTestId('where')).toHaveTextContent(/^\/dashboard$/));
  });

  it('the button is a full-width tap target of at least 44px', async () => {
    server({ myFamilies: [OURS] });
    renderAt(`/t/${THEIRS}/members`);
    const button = await screen.findByRole('button', { name: 'Go to my family' });
    expect(button).toHaveClass('min-h-[44px]', 'w-full');
  });

  it('shows the loading screen while checking, never the broken page', () => {
    server({ me: () => new Promise(() => {}) });
    renderAt(`/t/${OURS}/members`);
    expect(screen.queryByTestId('page')).toBeNull();
    expect(screen.queryByTestId('family-not-found')).toBeNull();
  });

  it('opens the page as before when the check cannot reach the server', async () => {
    server({ me: () => Promise.reject(new TypeError('Load failed')) });
    renderAt(`/t/${THEIRS}/members`);
    expect(await screen.findByTestId('page')).toHaveTextContent('members');
  });

  it('opens the page as before when the server cannot answer the check', async () => {
    server({ me: () => Promise.resolve(reply(500)) });
    renderAt(`/t/${THEIRS}/members`);
    expect(await screen.findByTestId('page')).toHaveTextContent('members');
  });

  it('moving between pages of my own family asks the server only once', async () => {
    server();
    const first = renderAt(`/t/${OURS}/members`);
    expect(await screen.findByTestId('page')).toHaveTextContent('members');
    first.unmount();
    renderAt(`/t/${OURS}/dashboard`);
    expect(screen.getByTestId('page')).toHaveTextContent('home');
    expect(calledUrls().filter((url) => url.endsWith('/api/me'))).toHaveLength(1);
  });

  it('a family I have just joined opens, even after my families were checked', async () => {
    server({ myFamilies: [OURS] });
    const first = renderAt(`/t/${OURS}/members`);
    expect(await screen.findByTestId('page')).toHaveTextContent('members');
    first.unmount();
    server({ myFamilies: [OURS, THEIRS] });
    renderAt(`/t/${THEIRS}/members`);
    expect(await screen.findByTestId('page')).toHaveTextContent('members');
  });

  it('a code typed in capitals opens the same family in small letters', async () => {
    server();
    renderAt('/t/E29B-41D4/members');
    await waitFor(() =>
      expect(screen.getByTestId('where')).toHaveTextContent(`/t/${OURS}/members`),
    );
    expect(await screen.findByTestId('page')).toHaveTextContent('members');
  });

  it('opens the page as before when the check takes longer than 8 seconds', async () => {
    vi.useFakeTimers();
    server({ me: () => new Promise(() => {}) });
    renderAt(`/t/${OURS}/members`);
    expect(screen.queryByTestId('page')).toBeNull();
    await act(async () => {
      await vi.advanceTimersByTimeAsync(FAMILY_CHECK_TIME_LIMIT_MS);
    });
    expect(FAMILY_CHECK_TIME_LIMIT_MS).toBe(8000);
    expect(screen.getByTestId('page')).toHaveTextContent('members');
  });

  it("the can't-find heading is focused, so a screen reader reads it out first", async () => {
    server({ myFamilies: [OURS] });
    renderAt(`/t/${THEIRS}/members`);
    const heading = await screen.findByRole('heading', { name: 'We can’t find that family.' });
    await waitFor(() => expect(heading).toHaveFocus());
  });

  it('"Use a different account" signs out and opens the sign-in page', async () => {
    server({ myFamilies: [OURS] });
    renderAt(`/t/${THEIRS}/members`);
    fireEvent.click(await screen.findByRole('button', { name: 'Use a different account' }));
    expect(signOutAll).toHaveBeenCalledTimes(1);
    await waitFor(() => expect(screen.getByTestId('where')).toHaveTextContent(/^\/login$/));
  });

  it("a different person signing in on the same tab never gets the first person's families", async () => {
    server({ myFamilies: [OURS] });
    const first = renderAt(`/t/${OURS}/members`);
    expect(await screen.findByTestId('page')).toHaveTextContent('members');
    first.unmount();
    authState.session = { access_token: 'tok-2', user: { id: 'user-2' } };
    server({ myFamilies: [THEIRS] });
    renderAt(`/t/${OURS}/members`);
    await expectCantFind();
    expect(calledUrls().filter((url) => url.endsWith('/api/me'))).toHaveLength(2);
  });
});

describe('<FamilyAddressGate />: old surname addresses (FHS-715, FHS-718)', () => {
  it('a member opening an old surname address lands on the same page at the new code', async () => {
    server({ oldAddress: reply(200, { slug: OURS, name: 'Smith' }) });
    renderAt('/t/smith/child/kid-1?tab=money#top');
    await waitFor(() =>
      expect(screen.getByTestId('where')).toHaveTextContent(`/t/${OURS}/child/kid-1?tab=money#top`),
    );
    expect(await screen.findByTestId('page')).toHaveTextContent('child');
    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining('/api/family-address/smith'),
      expect.objectContaining({ headers: { Authorization: 'Bearer tok-1' } }),
    );
  });

  it('an old surname that does not forward shows "We can\'t find that family."', async () => {
    server({ myFamilies: [OURS], oldAddress: reply(404) });
    renderAt('/t/smith/members');
    await expectCantFind();
    expect(screen.getByRole('button', { name: 'Go to my family' })).toBeInTheDocument();
    expect(screen.getByTestId('where')).toHaveTextContent('/t/smith/members');
  });

  it('no signal on the old-address check shows the usual page rather than a dead end', async () => {
    fetchMock.mockImplementation((url: string) =>
      url.includes('/api/family-address/')
        ? Promise.reject(new TypeError('Load failed'))
        : Promise.resolve(reply(200, { tenants: [{ slug: OURS }] })),
    );
    renderAt('/t/smith/members');
    expect(await screen.findByTestId('page')).toHaveTextContent('members');
  });

  it('a family still on its surname address opens its own pages', async () => {
    server({ myFamilies: ['smith'], oldAddress: reply(404) });
    renderAt('/t/smith/members');
    expect(await screen.findByTestId('page')).toHaveTextContent('members');
    expect(screen.queryByTestId('family-not-found')).toBeNull();
  });

  it('"Go to my family" for a family still on its surname opens its home, never the can\'t-find page again', async () => {
    server({ myFamilies: ['smith'], oldAddress: reply(404) });
    renderAt(`/t/${THEIRS}/members`);
    fireEvent.click(await screen.findByRole('button', { name: 'Go to my family' }));
    await waitFor(() =>
      expect(screen.getByTestId('where')).toHaveTextContent('/t/smith/dashboard'),
    );
    expect(await screen.findByTestId('page')).toHaveTextContent('home');
    expect(screen.queryByTestId('family-not-found')).toBeNull();
  });

  it('opens the page as before when the old-address check takes longer than 8 seconds', async () => {
    vi.useFakeTimers();
    fetchMock.mockImplementation((url: string) =>
      url.includes('/api/family-address/')
        ? new Promise(() => {})
        : Promise.resolve(reply(200, { tenants: [{ slug: OURS }] })),
    );
    renderAt('/t/smith/members');
    expect(screen.queryByTestId('page')).toBeNull();
    await act(async () => {
      await vi.advanceTimersByTimeAsync(FAMILY_CHECK_TIME_LIMIT_MS);
    });
    expect(screen.getByTestId('page')).toHaveTextContent('members');
  });
});

describe('<FamilyAddressGate />: signed out and kids (unchanged)', () => {
  it('someone not signed in gets the usual sign-in, with no check made', () => {
    authState.session = null;
    renderAt('/t/smith/members');
    expect(screen.getByTestId('page')).toHaveTextContent('members');
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('waits for the sign-in to load before deciding', () => {
    authState.loading = true;
    renderAt('/t/smith/members');
    expect(screen.queryByTestId('page')).toBeNull();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('a kid signed in on the tablet opens their family page with no check made', () => {
    authState.session = null;
    localStorage.setItem('fh.kid.token', 'kid.jwt.token');
    renderAt(`/t/${OURS}/dashboard`);
    expect(screen.getByTestId('page')).toHaveTextContent('home');
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('a kid page with an old surname goes to the family-code step, not the faces', async () => {
    renderAt('/t/smith/kid-login');
    await waitFor(() => expect(screen.getByTestId('page')).toHaveTextContent('code step'));
    expect(screen.getByTestId('where')).toHaveTextContent('/login?role=kid');
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('a kid page with the family code shows the faces, with no check made', () => {
    renderAt(`/t/${THEIRS}/kid-login`);
    expect(screen.getByTestId('page')).toHaveTextContent('faces');
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
