import { describe, it, expect, vi, beforeEach } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';

// FHS-227: bridge from un-prefixed `/dashboard` to the tenant-scoped
// `/t/<slug>/dashboard`. Covers happy path (first tenant wins), the
// no-tenant inline "Create your family" panel, and the fall-through
// to `/` when there is no session at all.

const mocks = vi.hoisted(() => ({
  fetchMock: vi.fn(),
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
      </Routes>
    </MemoryRouter>,
  );
}

beforeEach(() => {
  mocks.fetchMock.mockReset();
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

  it('renders the create-family panel when /api/me returns non-2xx', async () => {
    mocks.fetchMock.mockResolvedValueOnce({ ok: false, status: 500, json: async () => ({}) });
    renderRoute();
    await waitFor(() => expect(screen.getByTestId('no-tenant-create-form')).toBeInTheDocument());
  });

  it('renders the create-family panel when fetch rejects', async () => {
    mocks.fetchMock.mockRejectedValueOnce(new Error('network down'));
    renderRoute();
    await waitFor(() => expect(screen.getByTestId('no-tenant-create-form')).toBeInTheDocument());
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
  });
});
