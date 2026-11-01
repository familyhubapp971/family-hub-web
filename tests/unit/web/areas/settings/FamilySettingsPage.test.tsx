import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor, fireEvent, act } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';

// FHS-624: FamilySettingsPage unit tests.
// Uses a URL-matched fetch mock: no MSW, no window.confirm.
// Covers: loading the current name + currency, saving the name (FHS-626),
// saving the currency, the real data export, and the delete confirmation
// gate (including that a wrong confirmation cannot delete).

const fetchMock = vi.fn();
const authState: {
  session: { access_token?: string } | null;
  user: { email?: string; id?: string; user_metadata?: Record<string, unknown> } | null;
} = {
  session: { access_token: 'tok-admin' },
  user: { email: 'sarah@example.com', id: 'u-admin', user_metadata: {} },
};

vi.mock('../../../../../src/app/lib/auth-context', () => ({
  useAuth: () => authState,
  signOutAll: vi.fn().mockResolvedValue({ error: null }),
  getKidToken: () => null,
  clearKidToken: vi.fn(),
}));

import { FamilySettingsPage } from '../../../../../src/areas/settings/FamilySettingsPage';
import { TenantProvider } from '../../../../../src/app/lib/tenant-context';
import { signOutAll } from '../../../../../src/app/lib/auth-context';

const SETTINGS = { currency: 'AED', familyName: 'The Khans' };

function installApi(overrides: { callerRole?: string; settings?: typeof SETTINGS } = {}) {
  const callerRole = overrides.callerRole ?? 'admin';
  const settings = overrides.settings ?? SETTINGS;

  fetchMock.mockImplementation((url: string, init?: RequestInit) => {
    const u = String(url);

    // AppHeader self-fetches these two on mount.
    if (/\/api\/me(\?|$)/.test(u)) {
      return Promise.resolve({
        ok: true,
        status: 200,
        json: async () => ({
          id: 'u-admin',
          email: 'sarah@example.com',
          tenants: [{ id: 't-1', slug: 'khans', name: settings.familyName, role: 'admin' }],
        }),
      });
    }
    if (u.includes('/api/dashboard/today')) {
      return Promise.resolve({
        ok: true,
        status: 200,
        json: async () => ({ date: '2026-06-15', callerMemberId: 'admin-1', members: [] }),
      });
    }
    if (u.includes('/api/members')) {
      return Promise.resolve({
        ok: true,
        status: 200,
        json: async () => ({ members: [], callerRole }),
      });
    }
    if (u.includes('/api/admin/export')) {
      return Promise.resolve({
        ok: true,
        status: 200,
        headers: {
          get: (name: string) =>
            name === 'Content-Disposition'
              ? 'attachment; filename="familyhub-export-khans-2026-06-15.json"'
              : null,
        },
        blob: async () => new Blob([JSON.stringify({ exportedAt: '2026-06-15' })]),
      });
    }
    if (u.includes('/api/admin/delete-account')) {
      return Promise.resolve({ ok: true, status: 200, json: async () => ({ deleted: true }) });
    }
    if (u.includes('/api/admin/settings/familyName') && init?.method === 'PUT') {
      return Promise.resolve({
        ok: true,
        status: 200,
        json: async () => ({ key: 'familyName', value: 'New Family Name' }),
      });
    }
    if (u.includes('/api/admin/settings/currency') && init?.method === 'PUT') {
      return Promise.resolve({
        ok: true,
        status: 200,
        json: async () => ({ key: 'currency', value: 'GBP' }),
      });
    }
    if (u.includes('/api/admin/settings')) {
      return Promise.resolve({ ok: true, status: 200, json: async () => settings });
    }
    return Promise.resolve({ ok: true, status: 200, json: async () => ({}) });
  });
}

function renderAt(path = '/t/khans/family-settings') {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route
          path="/t/:slug/family-settings"
          element={
            <TenantProvider>
              <FamilySettingsPage />
            </TenantProvider>
          }
        />
        <Route path="/t/:slug/dashboard" element={<div data-testid="dashboard-page" />} />
        <Route
          path="/t/:slug/reward-settings"
          element={<div data-testid="reward-settings-page" />}
        />
        <Route path="/" element={<div data-testid="home-page" />} />
      </Routes>
    </MemoryRouter>,
  );
}

beforeEach(() => {
  fetchMock.mockReset();
  vi.stubGlobal('fetch', fetchMock);
  authState.session = { access_token: 'tok-admin' };
  authState.user = { email: 'sarah@example.com', id: 'u-admin', user_metadata: {} };
  vi.mocked(signOutAll).mockClear();
  installApi();
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('<FamilySettingsPage />', () => {
  it('loads and shows the current family name and currency', async () => {
    renderAt();
    await waitFor(() => expect(screen.getByTestId('family-settings-ready')).toBeInTheDocument());
    expect(screen.getByTestId('family-settings-name-input')).toHaveValue('The Khans');
    expect(screen.getByTestId('family-settings-currency').textContent).toContain('AED');
  });

  it.each(['adult', 'teen', 'child', 'guest'])(
    'redirects a %s caller to the dashboard',
    async (role) => {
      installApi({ callerRole: role });
      renderAt();
      await waitFor(() => expect(screen.getByTestId('dashboard-page')).toBeInTheDocument());
      expect(screen.queryByTestId('family-settings-page')).not.toBeInTheDocument();
    },
  );

  // FHS-625: the redirect runs in an effect, one render AFTER the role lands.
  // Gating the page on "do we know the role yet" therefore painted the family
  // name, the currency picker and the Download / Delete buttons to a non-admin
  // for a frame first. Nothing but the holding screen may ever appear.
  it('never paints the settings, or the Download and Delete buttons, to a non-admin', async () => {
    installApi({ callerRole: 'adult' });
    renderAt();
    // Watch every render between mount and the redirect landing, not just the
    // end state: the leak this guards was only ever visible in between.
    const seen: string[] = [];
    await waitFor(() => {
      if (screen.queryByTestId('family-settings-ready')) seen.push('the settings form');
      if (screen.queryByTestId('family-settings-careful-zone')) seen.push('the careful zone');
      expect(screen.getByTestId('dashboard-page')).toBeInTheDocument();
    });
    expect(seen, 'a non-admin saw admin-only content before being redirected').toEqual([]);
  });

  it('links to Earning rules for what a sticker is worth', async () => {
    renderAt();
    await waitFor(() => expect(screen.getByTestId('family-settings-ready')).toBeInTheDocument());
    const link = screen.getByTestId('family-settings-earning-rules-link');
    expect(link).toHaveAttribute('href', '/t/khans/reward-settings');
  });

  // FHS-626: renaming the family.
  it('saving a new family name issues PUT /api/admin/settings/familyName', async () => {
    renderAt();
    await waitFor(() => expect(screen.getByTestId('family-settings-ready')).toBeInTheDocument());

    fireEvent.change(screen.getByTestId('family-settings-name-input'), {
      target: { value: 'New Family Name' },
    });
    await act(async () => {
      fireEvent.click(screen.getByTestId('family-settings-save-btn'));
    });

    await waitFor(() => {
      const call = fetchMock.mock.calls.find(
        ([u, init]) =>
          String(u).includes('/api/admin/settings/familyName') && init?.method === 'PUT',
      );
      expect(call).toBeTruthy();
      const body = JSON.parse((call![1] as RequestInit).body as string) as { value: string };
      expect(body.value).toBe('New Family Name');
    });
    await waitFor(() =>
      expect(screen.getByTestId('family-settings-saved-notice')).toBeInTheDocument(),
    );
  });

  it('a blank family name disables Save and shows a plain-words error', async () => {
    renderAt();
    await waitFor(() => expect(screen.getByTestId('family-settings-ready')).toBeInTheDocument());

    fireEvent.change(screen.getByTestId('family-settings-name-input'), {
      target: { value: '   ' },
    });

    expect(screen.getByTestId('family-settings-save-btn')).toBeDisabled();
    expect(screen.getByTestId('family-settings-name-error')).toBeInTheDocument();
  });

  // Scenario: Changing the currency sticks.
  it('saving a new currency issues PUT /api/admin/settings/currency', async () => {
    renderAt();
    await waitFor(() => expect(screen.getByTestId('family-settings-ready')).toBeInTheDocument());

    await act(async () => {
      fireEvent.click(screen.getByTestId('family-settings-currency-trigger'));
    });
    const gbpOption = await screen.findByTestId('family-settings-currency-option-GBP');
    await act(async () => {
      fireEvent.click(gbpOption);
    });

    await act(async () => {
      fireEvent.click(screen.getByTestId('family-settings-save-btn'));
    });

    await waitFor(() => {
      const call = fetchMock.mock.calls.find(
        ([u, init]) => String(u).includes('/api/admin/settings/currency') && init?.method === 'PUT',
      );
      expect(call).toBeTruthy();
      const body = JSON.parse((call![1] as RequestInit).body as string) as { value: string };
      expect(body.value).toBe('GBP');
    });
  });

  // A save that changes both fields where only one PUT succeeds must not
  // lose track of the half that landed on the server.
  it('keeps a successfully-saved name even when the currency save fails', async () => {
    fetchMock.mockImplementation((url: string, init?: RequestInit) => {
      const u = String(url);
      if (u.includes('/api/admin/settings/familyName') && init?.method === 'PUT') {
        return Promise.resolve({
          ok: true,
          status: 200,
          json: async () => ({ key: 'familyName', value: 'New Family Name' }),
        });
      }
      if (u.includes('/api/admin/settings/currency') && init?.method === 'PUT') {
        return Promise.resolve({
          ok: false,
          status: 500,
          json: async () => ({ detail: 'Couldn’t save the currency' }),
        });
      }
      if (u.includes('/api/admin/settings')) {
        return Promise.resolve({ ok: true, status: 200, json: async () => SETTINGS });
      }
      if (u.includes('/api/members')) {
        return Promise.resolve({
          ok: true,
          status: 200,
          json: async () => ({ members: [], callerRole: 'admin' }),
        });
      }
      return Promise.resolve({ ok: true, status: 200, json: async () => ({}) });
    });

    renderAt();
    await waitFor(() => expect(screen.getByTestId('family-settings-ready')).toBeInTheDocument());

    fireEvent.change(screen.getByTestId('family-settings-name-input'), {
      target: { value: 'New Family Name' },
    });
    await act(async () => {
      fireEvent.click(screen.getByTestId('family-settings-currency-trigger'));
    });
    const gbpOption = await screen.findByTestId('family-settings-currency-option-GBP');
    await act(async () => {
      fireEvent.click(gbpOption);
    });
    await act(async () => {
      fireEvent.click(screen.getByTestId('family-settings-save-btn'));
    });

    await waitFor(() =>
      expect(screen.getByTestId('family-settings-save-error')).toBeInTheDocument(),
    );

    fetchMock.mockClear();
    // Save again: the name already landed server-side, so only the
    // currency PUT should fire this time.
    await act(async () => {
      fireEvent.click(screen.getByTestId('family-settings-save-btn'));
    });
    await waitFor(() => {
      const nameCall = fetchMock.mock.calls.find(([u]) =>
        String(u).includes('/api/admin/settings/familyName'),
      );
      expect(nameCall).toBeUndefined();
      const currencyCall = fetchMock.mock.calls.find(([u]) =>
        String(u).includes('/api/admin/settings/currency'),
      );
      expect(currencyCall).toBeTruthy();
    });
  });

  // Scenario: Export gives a real file.
  it('Download our data calls GET /api/admin/export and triggers a real file download', async () => {
    URL.createObjectURL ??= () => '';
    URL.revokeObjectURL ??= () => {};
    const createObjectURL = vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:mock-url');
    const revokeObjectURL = vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {});
    const anchorClick = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});

    renderAt();
    await waitFor(() => expect(screen.getByTestId('family-settings-ready')).toBeInTheDocument());

    await act(async () => {
      fireEvent.click(screen.getByTestId('family-settings-export-btn'));
    });

    await waitFor(() => {
      const call = fetchMock.mock.calls.find(([u]) => String(u).includes('/api/admin/export'));
      expect(call).toBeTruthy();
    });
    expect(createObjectURL).toHaveBeenCalled();
    expect(anchorClick).toHaveBeenCalled();
    expect(revokeObjectURL).toHaveBeenCalledWith('blob:mock-url');

    createObjectURL.mockRestore();
    revokeObjectURL.mockRestore();
    anchorClick.mockRestore();
  });

  // Scenario: Deleting takes real effort.
  describe('Delete our family hub', () => {
    async function openDeleteDialog() {
      renderAt();
      await waitFor(() => expect(screen.getByTestId('family-settings-ready')).toBeInTheDocument());
      act(() => {
        fireEvent.click(screen.getByTestId('family-settings-delete-btn'));
      });
      await waitFor(() =>
        expect(screen.getByTestId('family-settings-delete-confirm')).toBeInTheDocument(),
      );
      expect(screen.getByTestId('family-settings-delete-family-name').textContent).toBe(
        'The Khans',
      );
    }

    it('keeps Delete disabled until the exact family name is typed', async () => {
      await openDeleteDialog();
      const confirmBtn = screen.getByTestId('family-settings-delete-confirm-confirm');
      expect(confirmBtn).toBeDisabled();

      fireEvent.change(screen.getByTestId('family-settings-delete-confirm-input'), {
        target: { value: 'Wrong Name' },
      });
      expect(confirmBtn).toBeDisabled();

      fireEvent.change(screen.getByTestId('family-settings-delete-confirm-input'), {
        target: { value: 'The Khans' },
      });
      expect(confirmBtn).not.toBeDisabled();
    });

    it('a wrong confirmation can never delete the family', async () => {
      await openDeleteDialog();
      fireEvent.change(screen.getByTestId('family-settings-delete-confirm-input'), {
        target: { value: 'not the family name' },
      });
      // The button stays disabled: clicking it (even via fireEvent) fires no
      // handler, so no delete request is ever sent.
      fireEvent.click(screen.getByTestId('family-settings-delete-confirm-confirm'));

      await waitFor(() => {
        const call = fetchMock.mock.calls.find(([u]) =>
          String(u).includes('/api/admin/delete-account'),
        );
        expect(call).toBeUndefined();
      });
      expect(screen.getByTestId('family-settings-delete-confirm')).toBeInTheDocument();
    });

    it('calls POST /api/admin/delete-account with the typed name and clears the session', async () => {
      await openDeleteDialog();
      fireEvent.change(screen.getByTestId('family-settings-delete-confirm-input'), {
        target: { value: 'The Khans' },
      });
      await act(async () => {
        fireEvent.click(screen.getByTestId('family-settings-delete-confirm-confirm'));
      });

      await waitFor(() => {
        const call = fetchMock.mock.calls.find(
          ([u, init]) => String(u).includes('/api/admin/delete-account') && init?.method === 'POST',
        );
        expect(call).toBeTruthy();
        const body = JSON.parse((call![1] as RequestInit).body as string) as { confirm: string };
        expect(body.confirm).toBe('The Khans');
      });
      await waitFor(() => expect(signOutAll).toHaveBeenCalled());
      await waitFor(() => expect(screen.getByTestId('home-page')).toBeInTheDocument());
    });

    it('shows an error and does not sign out when the API rejects the request', async () => {
      installApi();
      fetchMock.mockImplementation((url: string) => {
        const u = String(url);
        if (u.includes('/api/admin/delete-account')) {
          return Promise.resolve({
            ok: false,
            status: 400,
            json: async () => ({
              error: 'confirmation mismatch',
              errorCode: 'CONFIRM_MISMATCH',
              detail: 'confirm must match the family name exactly',
            }),
          });
        }
        if (/\/api\/me(\?|$)/.test(u)) {
          return Promise.resolve({
            ok: true,
            status: 200,
            json: async () => ({
              id: 'u-admin',
              tenants: [{ id: 't-1', slug: 'khans', name: 'The Khans', role: 'admin' }],
            }),
          });
        }
        if (u.includes('/api/members')) {
          return Promise.resolve({
            ok: true,
            status: 200,
            json: async () => ({ members: [], callerRole: 'admin' }),
          });
        }
        if (u.includes('/api/admin/settings')) {
          return Promise.resolve({ ok: true, status: 200, json: async () => SETTINGS });
        }
        return Promise.resolve({ ok: true, status: 200, json: async () => ({}) });
      });

      await openDeleteDialog();
      fireEvent.change(screen.getByTestId('family-settings-delete-confirm-input'), {
        target: { value: 'The Khans' },
      });
      await act(async () => {
        fireEvent.click(screen.getByTestId('family-settings-delete-confirm-confirm'));
      });

      await waitFor(() =>
        expect(screen.getByTestId('family-settings-delete-error').textContent).toContain(
          'confirm must match the family name exactly',
        ),
      );
      expect(signOutAll).not.toHaveBeenCalled();
      expect(screen.queryByTestId('home-page')).not.toBeInTheDocument();
    });
  });
});
