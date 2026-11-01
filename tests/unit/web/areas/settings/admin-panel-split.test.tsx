import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { FamilySettingsPage } from '../../../../../src/areas/settings/FamilySettingsPage';
import { TenantProvider } from '../../../../../src/app/lib/tenant-context';

// FHS-621: the Admin Panel is split into pages named after the job they do.
// Each page shows its own half and nothing else, so a parent never lands on a
// tab they have to guess at. FHS-622 then replaced Kids money's body with the
// designed page (no more tab bar there at all): its own coverage lives in
// tests/unit/web/areas/money/KidsMoneyPage.test.tsx, so this file only keeps the
// half still true today, that Family settings shows nothing else.

vi.mock('../../../../../src/app/lib/auth-context', () => ({
  useAuth: () => ({
    session: { access_token: 'tok' },
    user: { id: 'u1', email: 'a@b.c' },
    loading: false,
  }),
  signOutAll: vi.fn(),
}));

const fetchMock = vi.fn();
beforeEach(() => {
  fetchMock.mockReset();
  fetchMock.mockImplementation((url: string) => {
    const u = String(url);
    if (u.includes('/api/members')) {
      return Promise.resolve({
        ok: true,
        status: 200,
        json: async () => ({
          callerRole: 'admin',
          members: [{ id: 'kid1', displayName: 'Amina', role: 'child', isChild: true }],
        }),
      });
    }
    return Promise.resolve({ ok: true, status: 200, json: async () => ({}) });
  });
  vi.stubGlobal('fetch', fetchMock);
});

function renderPage(page: React.ReactNode, path: string) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path="/t/:slug/*" element={<TenantProvider>{page}</TenantProvider>} />
      </Routes>
    </MemoryRouter>,
  );
}

describe('the Admin Panel split (FHS-621)', () => {
  it('Family settings shows only its own half, with no tabs to choose between', async () => {
    renderPage(<FamilySettingsPage />, '/t/khan/family-settings');
    await waitFor(() => expect(screen.queryByTestId('admin-panel-tab-balance')).toBeNull());
    // One job, so there is nothing to tab between.
    expect(screen.queryByTestId('admin-panel-tab-settings')).not.toBeInTheDocument();
    expect(screen.queryByTestId('admin-panel-tab-rewards')).not.toBeInTheDocument();
  });
});
