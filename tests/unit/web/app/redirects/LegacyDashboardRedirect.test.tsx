import { describe, it, expect, vi, beforeEach } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Routes, Route, useLocation } from 'react-router-dom';

// FHS-227: bridge from un-prefixed `/dashboard` to the tenant-scoped
// `/t/<slug>/dashboard`. Covers happy path (first tenant wins), the
// no-tenant inline "Create your family" panel, the retry shown when the
// check itself fails (FHS-714), and the fall-through to `/` when there is
// no session at all.

const mocks = vi.hoisted(() => ({
  fetchMock: vi.fn(),
  signOutAll: vi.fn(),
}));
vi.stubGlobal('fetch', mocks.fetchMock);

type SessionLike = {
  access_token?: string;
  user?: { id?: string; email?: string; user_metadata?: Record<string, unknown> };
} | null;
const authState: { session: SessionLike } = {
  session: {
    access_token: 'tok-1',
    user: { email: 'sarah@example.com', user_metadata: {} },
  },
};
vi.mock('../../../../../src/app/lib/auth-context', () => ({
  useAuth: () => authState,
  signOutAll: () => mocks.signOutAll(),
}));

import { LegacyDashboardRedirect } from '../../../../../src/app/redirects/LegacyDashboardRedirect';
import { forgetFamilyCodes, knownFamilyCodes } from '../../../../../src/app/lib/my-families';

function Location() {
  return <span data-testid="location">{useLocation().pathname}</span>;
}

function renderRoute() {
  return render(
    <MemoryRouter initialEntries={['/dashboard']}>
      <Location />
      <Routes>
        <Route path="/dashboard" element={<LegacyDashboardRedirect />} />
        <Route path="/t/:slug/dashboard" element={<div data-testid="tenant-dashboard" />} />
        <Route path="/t/:slug/onboarding" element={<div data-testid="tenant-onboarding" />} />
        <Route path="/" element={<div data-testid="welcome" />} />
        <Route path="/login" element={<div data-testid="login" />} />
      </Routes>
    </MemoryRouter>,
  );
}

beforeEach(() => {
  mocks.fetchMock.mockReset();
  mocks.signOutAll.mockReset();
  mocks.signOutAll.mockResolvedValue({ error: null });
  authState.session = {
    access_token: 'tok-1',
    user: { email: 'sarah@example.com', user_metadata: {} },
  };
});

describe('<LegacyDashboardRedirect />', () => {
  it('forwards to the first tenants[].slug from /api/me', async () => {
    mocks.fetchMock.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ tenants: [{ slug: 'khans' }, { slug: 'second' }] }),
    });
    renderRoute();
    await waitFor(() => expect(screen.getByTestId('tenant-dashboard')).toBeInTheDocument());
  });

  // FHS-718: the family page it opens next checks the family is yours. It
  // uses this list instead of asking the server a second time.
  it('keeps the family list, so the family page it opens does not ask again', async () => {
    forgetFamilyCodes();
    authState.session = {
      access_token: 'tok-1',
      user: { id: 'user-1', email: 'sarah@example.com', user_metadata: {} },
    };
    mocks.fetchMock.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ tenants: [{ slug: 'e29b-41d4' }] }),
    });
    mocks.fetchMock.mockResolvedValueOnce({ ok: true, json: async () => ({ claimed: [] }) });
    renderRoute();
    await waitFor(() => expect(screen.getByTestId('tenant-dashboard')).toBeInTheDocument());
    expect(knownFamilyCodes('user-1')).toEqual(['e29b-41d4']);
  });

  it('renders the create-family panel when /api/me returns no tenants', async () => {
    mocks.fetchMock.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ tenants: [] }),
    });
    mocks.fetchMock.mockResolvedValueOnce({ ok: true, json: async () => ({ claimed: [] }) });
    renderRoute();
    await waitFor(() => expect(screen.getByTestId('no-tenant-create-form')).toBeInTheDocument());
    // Does NOT bounce to the homepage: the user can now recover in place.
    expect(screen.queryByTestId('welcome')).toBeNull();
  });

  // FHS-714: a failed check used to show an existing family the
  // create-a-family form, as if they had no family at all.
  it('FHS-714: a server error offers a retry, not the create-a-family form', async () => {
    mocks.fetchMock.mockResolvedValueOnce({ ok: false, status: 500, json: async () => ({}) });
    renderRoute();
    await waitFor(() => expect(screen.getByTestId('me-unreachable')).toBeInTheDocument());
    expect(screen.getByTestId('me-unreachable').textContent).toContain(
      'We couldn’t reach Family Hub. Check your signal and try again.',
    );
    expect(screen.getByTestId('me-retry').textContent).toBe('Try again');
    expect(screen.queryByTestId('no-tenant-create-form')).toBeNull();
  });

  it('FHS-714: a failed invite check with no family offers a retry, never a second family', async () => {
    mocks.fetchMock.mockResolvedValueOnce({ ok: true, json: async () => ({ tenants: [] }) });
    mocks.fetchMock.mockResolvedValueOnce({ ok: false, status: 500, json: async () => ({}) });
    renderRoute();
    await waitFor(() => expect(screen.getByTestId('me-unreachable')).toBeInTheDocument());
    expect(screen.queryByTestId('no-tenant-create-form')).toBeNull();
  });

  it('FHS-714: a sign-in the server no longer accepts goes to log in, not an endless retry', async () => {
    mocks.fetchMock.mockResolvedValueOnce({ ok: false, status: 401, json: async () => ({}) });
    renderRoute();
    await waitFor(() => expect(mocks.signOutAll).toHaveBeenCalled());
    expect(screen.queryByTestId('me-unreachable')).toBeNull();
  });

  it('FHS-714: the retry card has a way out', async () => {
    mocks.fetchMock.mockResolvedValueOnce({ ok: false, status: 500, json: async () => ({}) });
    renderRoute();
    await waitFor(() => expect(screen.getByTestId('me-log-out')).toBeInTheDocument());
    fireEvent.click(screen.getByTestId('me-log-out'));
    await waitFor(() => expect(mocks.signOutAll).toHaveBeenCalled());
  });

  it('FHS-714: no signal offers a retry, not the create-a-family form', async () => {
    mocks.fetchMock.mockRejectedValueOnce(new TypeError('Load failed'));
    renderRoute();
    await waitFor(() => expect(screen.getByTestId('me-unreachable')).toBeInTheDocument());
    expect(screen.queryByTestId('no-tenant-create-form')).toBeNull();
  });

  it('FHS-714: Try again checks once more and opens the family they already have', async () => {
    mocks.fetchMock.mockRejectedValueOnce(new TypeError('Load failed'));
    renderRoute();
    await waitFor(() => expect(screen.getByTestId('me-retry')).toBeInTheDocument());
    mocks.fetchMock.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ tenants: [{ slug: 'khans' }] }),
    });
    mocks.fetchMock.mockResolvedValueOnce({ ok: true, json: async () => ({ claimed: [] }) });
    fireEvent.click(screen.getByTestId('me-retry'));
    await waitFor(() => expect(screen.getByTestId('tenant-dashboard')).toBeInTheDocument());
    expect(screen.queryByTestId('no-tenant-create-form')).toBeNull();
  });

  it('FHS-275: claims a pending invite and redirects to that family', async () => {
    // /api/me → no tenants; /api/invitations/claim → claimed khans.
    mocks.fetchMock.mockResolvedValueOnce({ ok: true, json: async () => ({ tenants: [] }) });
    mocks.fetchMock.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ claimed: [{ tenantId: 't-1', slug: 'khans' }] }),
    });
    renderRoute();
    await waitFor(() => expect(screen.getByTestId('tenant-dashboard')).toBeInTheDocument());
    const claimCall = mocks.fetchMock.mock.calls.find(([u]) =>
      String(u).includes('/api/invitations/claim'),
    );
    expect(claimCall).toBeDefined();
    expect((claimCall![1] as RequestInit).method).toBe('POST');
  });

  describe('create-family panel', () => {
    beforeEach(() => {
      mocks.fetchMock.mockResolvedValueOnce({ ok: true, json: async () => ({ tenants: [] }) });
      // The invite check answers "none": the create form shows only then.
      mocks.fetchMock.mockResolvedValueOnce({ ok: true, json: async () => ({ claimed: [] }) });
    });

    async function fillIn(yourName: string, familyName: string) {
      await waitFor(() => expect(screen.getByTestId('no-tenant-create-form')).toBeInTheDocument());
      fireEvent.change(screen.getByTestId('no-tenant-your-name'), { target: { value: yourName } });
      fireEvent.change(screen.getByTestId('no-tenant-family-name'), {
        target: { value: familyName },
      });
    }

    it('FHS-715: asks only for your name and the family name, with no address box', async () => {
      renderRoute();
      await waitFor(() => expect(screen.getByTestId('no-tenant-create-form')).toBeInTheDocument());
      expect(screen.getByLabelText('Your name')).toBeInTheDocument();
      expect(screen.getByLabelText('Family name')).toBeInTheDocument();
      expect(screen.queryByTestId('no-tenant-slug')).toBeNull();
      expect(screen.queryByText(/Family URL/i)).toBeNull();
      expect(screen.queryByText(`${window.location.host}/t/`)).toBeNull();
    });

    it('FHS-715: sends just the two names, with the sign-in, and no address', async () => {
      renderRoute();
      await fillIn('Sarah', 'The Khan Family');
      mocks.fetchMock.mockResolvedValueOnce({
        ok: true,
        status: 201,
        json: async () => ({ tenant: { id: 't-1', slug: 'e29b-41d4', name: 'The Khan Family' } }),
      });
      fireEvent.submit(screen.getByTestId('no-tenant-create-form'));
      await waitFor(() => expect(screen.getByTestId('tenant-onboarding')).toBeInTheDocument());
      expect(mocks.fetchMock).toHaveBeenLastCalledWith(
        expect.stringContaining('/api/public/tenant'),
        expect.objectContaining({
          method: 'POST',
          headers: expect.objectContaining({ Authorization: 'Bearer tok-1' }),
        }),
      );
      const lastCall = mocks.fetchMock.mock.calls.at(-1)!;
      expect(JSON.parse((lastCall[1] as RequestInit).body as string)).toEqual({
        familyName: 'The Khan Family',
        displayName: 'Sarah',
      });
    });

    it('FHS-715: opens the new family at the code the server gave it', async () => {
      renderRoute();
      await fillIn('Sarah', 'The Khan Family');
      mocks.fetchMock.mockResolvedValueOnce({
        ok: true,
        status: 201,
        json: async () => ({ tenant: { id: 't-1', slug: 'e29b-41d4', name: 'The Khan Family' } }),
      });
      fireEvent.submit(screen.getByTestId('no-tenant-create-form'));
      await waitFor(() =>
        expect(screen.getByTestId('location')).toHaveTextContent('/t/e29b-41d4/onboarding'),
      );
    });

    it('FHS-716: someone who already made a family is taken to that family, not a second one', async () => {
      renderRoute();
      await fillIn('Sarah', 'Khans again');
      mocks.fetchMock.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({ tenant: { id: 't-1', slug: 'a1b2-c3d4', name: 'Khans' } }),
      });
      fireEvent.submit(screen.getByTestId('no-tenant-create-form'));
      await waitFor(() =>
        expect(screen.getByTestId('location')).toHaveTextContent('/t/a1b2-c3d4/onboarding'),
      );
    });

    it('FHS-715: a reply that does not say where the family is checks for it again', async () => {
      renderRoute();
      await fillIn('Sarah', 'Khans');
      mocks.fetchMock.mockResolvedValueOnce({ ok: true, status: 201, json: async () => ({}) });
      // The second check finds the family that was just made.
      mocks.fetchMock.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ tenants: [{ slug: 'e29b-41d4' }] }),
      });
      mocks.fetchMock.mockResolvedValueOnce({ ok: true, json: async () => ({ claimed: [] }) });
      fireEvent.submit(screen.getByTestId('no-tenant-create-form'));
      await waitFor(() => expect(screen.getByTestId('tenant-dashboard')).toBeInTheDocument());
      expect(screen.getByTestId('location')).toHaveTextContent('/t/e29b-41d4/dashboard');
    });

    it('FHS-714: tells an invited parent to sign in with the email the invite went to', async () => {
      renderRoute();
      await waitFor(() => expect(screen.getByTestId('no-tenant-create-form')).toBeInTheDocument());
      expect(screen.getByTestId('no-tenant-invited-hint').textContent).toBe(
        'Invited to a family? Log out and sign in with the email the invite went to.',
      );
    });

    it('FHS-714: "Not you? Log out" signs out and goes to the sign-in page', async () => {
      renderRoute();
      await waitFor(() => expect(screen.getByTestId('no-tenant-create-form')).toBeInTheDocument());
      expect(screen.getByText(/Not you\?/)).toBeInTheDocument();
      fireEvent.click(screen.getByTestId('no-tenant-log-out'));
      await waitFor(() => expect(screen.getByTestId('login')).toBeInTheDocument());
      expect(mocks.signOutAll).toHaveBeenCalledTimes(1);
    });

    it('FHS-714: creating a family with no signal says to check it, not "Load failed"', async () => {
      renderRoute();
      await waitFor(() => expect(screen.getByTestId('no-tenant-create-form')).toBeInTheDocument());
      fireEvent.change(screen.getByTestId('no-tenant-your-name'), { target: { value: 'Sarah' } });
      fireEvent.change(screen.getByTestId('no-tenant-family-name'), { target: { value: 'Khans' } });
      mocks.fetchMock.mockRejectedValueOnce(new TypeError('Load failed'));
      fireEvent.submit(screen.getByTestId('no-tenant-create-form'));
      await waitFor(() =>
        expect(screen.getByTestId('no-tenant-error').textContent).toBe(
          "We couldn't reach Family Hub. Check your signal and try again.",
        ),
      );
    });

    it('FHS-714: welcomes one-character names, like a family called 李', async () => {
      renderRoute();
      await waitFor(() => expect(screen.getByTestId('no-tenant-create-form')).toBeInTheDocument());
      fireEvent.change(screen.getByTestId('no-tenant-your-name'), { target: { value: 'B' } });
      fireEvent.change(screen.getByTestId('no-tenant-family-name'), { target: { value: '李' } });
      mocks.fetchMock.mockResolvedValueOnce({
        ok: true,
        status: 201,
        json: async () => ({ tenant: { slug: 'e29b-41d4' } }),
      });
      fireEvent.submit(screen.getByTestId('no-tenant-create-form'));
      await waitFor(() => expect(screen.getByTestId('tenant-onboarding')).toBeInTheDocument());
      const lastCall = mocks.fetchMock.mock.calls.at(-1)!;
      expect(JSON.parse((lastCall[1] as RequestInit).body as string)).toMatchObject({
        familyName: '李',
        displayName: 'B',
      });
    });
  });
});
