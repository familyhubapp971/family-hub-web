import { describe, it, expect, vi, beforeEach } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';

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
  user?: { email?: string; user_metadata?: Record<string, unknown> };
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

function renderRoute() {
  return render(
    <MemoryRouter initialEntries={['/dashboard']}>
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

  it('renders the create-family panel when /api/me returns no tenants', async () => {
    mocks.fetchMock.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ tenants: [] }),
    });
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
    });

    it('auto-derives the slug from the family name and submits to /api/public/tenant', async () => {
      renderRoute();
      await waitFor(() => expect(screen.getByTestId('no-tenant-create-form')).toBeInTheDocument());
      fireEvent.change(screen.getByTestId('no-tenant-your-name'), {
        target: { value: 'Sarah' },
      });
      fireEvent.change(screen.getByTestId('no-tenant-family-name'), {
        target: { value: 'The Khan Family' },
      });
      expect((screen.getByTestId('no-tenant-slug') as HTMLInputElement).value).toBe(
        'the-khan-family',
      );
      // 201 on tenant create → navigate to onboarding under the chosen slug.
      mocks.fetchMock.mockResolvedValueOnce({
        ok: true,
        status: 201,
        json: async () => ({ tenant: { slug: 'the-khan-family' } }),
      });
      fireEvent.submit(screen.getByTestId('no-tenant-create-form'));
      await waitFor(() => expect(screen.getByTestId('tenant-onboarding')).toBeInTheDocument());
      // The /api/public/tenant POST carried the existing session token
      // and the founder's typed name (FHS-274, no metadata guessing).
      expect(mocks.fetchMock).toHaveBeenLastCalledWith(
        expect.stringContaining('/api/public/tenant'),
        expect.objectContaining({
          method: 'POST',
          headers: expect.objectContaining({ Authorization: 'Bearer tok-1' }),
        }),
      );
      const lastCall = mocks.fetchMock.mock.calls.at(-1)!;
      expect(JSON.parse((lastCall[1] as RequestInit).body as string).displayName).toBe('Sarah');
    });

    it('shows an inline error and re-enables editing on 409 (slug taken)', async () => {
      renderRoute();
      await waitFor(() => expect(screen.getByTestId('no-tenant-create-form')).toBeInTheDocument());
      fireEvent.change(screen.getByTestId('no-tenant-your-name'), {
        target: { value: 'Sarah' },
      });
      fireEvent.change(screen.getByTestId('no-tenant-family-name'), {
        target: { value: 'Khans' },
      });
      mocks.fetchMock.mockResolvedValueOnce({ ok: false, status: 409, json: async () => ({}) });
      fireEvent.submit(screen.getByTestId('no-tenant-create-form'));
      await waitFor(() =>
        expect(screen.getByTestId('no-tenant-error').textContent).toMatch(/taken/i),
      );
      // No redirect: user stays on the form to pick another slug.
      expect(screen.queryByTestId('tenant-onboarding')).toBeNull();
    });

    it('FHS-713: keeps the taken address in the box to edit, instead of emptying it', async () => {
      renderRoute();
      await waitFor(() => expect(screen.getByTestId('no-tenant-create-form')).toBeInTheDocument());
      fireEvent.change(screen.getByTestId('no-tenant-your-name'), { target: { value: 'Tinu' } });
      fireEvent.change(screen.getByTestId('no-tenant-family-name'), { target: { value: 'Abass' } });
      mocks.fetchMock.mockResolvedValueOnce({ ok: false, status: 409, json: async () => ({}) });
      fireEvent.submit(screen.getByTestId('no-tenant-create-form'));
      await waitFor(() => expect(screen.getByTestId('no-tenant-error')).toBeInTheDocument());
      expect((screen.getByTestId('no-tenant-slug') as HTMLInputElement).value).toBe('abass');
    });

    it.each([
      ['Oyin26', 'oyin26'],
      ['TAbass1', 'tabass1'],
      ['Tabb-21', 'tabb-21'],
      ['Tinu.!12', 'tinu-12'],
      ['Oyin26–', 'oyin26-'],
    ])('FHS-713: tidies phone typing %j into %j as it is typed', async (typed, shown) => {
      renderRoute();
      await waitFor(() => expect(screen.getByTestId('no-tenant-create-form')).toBeInTheDocument());
      fireEvent.change(screen.getByTestId('no-tenant-slug'), { target: { value: typed } });
      expect((screen.getByTestId('no-tenant-slug') as HTMLInputElement).value).toBe(shown);
    });

    it('FHS-713: creates the family without a hyphen left at the end', async () => {
      renderRoute();
      await waitFor(() => expect(screen.getByTestId('no-tenant-create-form')).toBeInTheDocument());
      fireEvent.change(screen.getByTestId('no-tenant-your-name'), { target: { value: 'Tinu' } });
      fireEvent.change(screen.getByTestId('no-tenant-family-name'), { target: { value: 'Abass' } });
      fireEvent.change(screen.getByTestId('no-tenant-slug'), { target: { value: 'Oyin26–' } });
      expect(screen.getByTestId('no-tenant-slug')).toHaveAttribute('autocapitalize', 'none');
      mocks.fetchMock.mockResolvedValueOnce({ ok: true, status: 201, json: async () => ({}) });
      fireEvent.submit(screen.getByTestId('no-tenant-create-form'));
      await waitFor(() => expect(screen.getByTestId('tenant-onboarding')).toBeInTheDocument());
      const lastCall = mocks.fetchMock.mock.calls.at(-1)!;
      expect(JSON.parse((lastCall[1] as RequestInit).body as string).slug).toBe('oyin26');
    });

    it("FHS-714: keeps the address within the server's 30 characters", async () => {
      renderRoute();
      await waitFor(() => expect(screen.getByTestId('no-tenant-create-form')).toBeInTheDocument());
      fireEvent.change(screen.getByTestId('no-tenant-slug'), { target: { value: 'a'.repeat(40) } });
      expect((screen.getByTestId('no-tenant-slug') as HTMLInputElement).value).toHaveLength(30);
    });

    it('FHS-714: keeps accented letters in the suggested address', async () => {
      renderRoute();
      await waitFor(() => expect(screen.getByTestId('no-tenant-create-form')).toBeInTheDocument());
      fireEvent.change(screen.getByTestId('no-tenant-family-name'), {
        target: { value: 'Müller' },
      });
      expect((screen.getByTestId('no-tenant-slug') as HTMLInputElement).value).toBe('muller');
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

    it("FHS-714: shows the site's real address in front of the box", async () => {
      renderRoute();
      await waitFor(() => expect(screen.getByTestId('no-tenant-create-form')).toBeInTheDocument());
      expect(screen.getByText(`${window.location.host}/t/`)).toBeInTheDocument();
    });
  });
});
