import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';

// FHS-625: a child's board hands MyWorldTab an `isAdmin` flag, and that flag
// is what closes the money controls that cannot be undone (closing a week,
// setting a balance by hand, editing a past day). Two lines apart,
// ChildWorldPage also computes `isParentCaller` from `isGrownUpRole`, which is
// true for an adult. Swapping one for the other would quietly hand every adult
// the admin-only money controls, and no existing test would notice: the
// MyWorldTab suite only ever renders with isAdmin true, and the ChildWorldPage
// suite only checks the Insights tab.
//
// So this stubs MyWorldTab and reads the flag it is actually given. Its own
// file because the stub is hoisted across the whole module.

const fetchMock = vi.fn();

vi.mock('../../../../../src/app/lib/auth-context', () => ({
  useAuth: () => ({
    user: { email: 'parent@example.com', id: 'u-1', user_metadata: {} },
    session: { access_token: 'tok-abc' },
  }),
  signOutAll: vi.fn(async () => ({ error: null })),
}));

vi.mock('../../../../../src/areas/my-world/MyWorldTab', () => ({
  MyWorldTab: (props: { isAdmin?: boolean }) => (
    <div data-testid="my-world-stub" data-is-admin={String(props.isAdmin ?? false)} />
  ),
}));

import { ChildWorldPage } from '../../../../../src/areas/kids/ChildWorldPage';
import { TenantProvider } from '../../../../../src/app/lib/tenant-context';

const MEMBER = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc';

function installApi(callerRole: string) {
  fetchMock.mockImplementation((url: string) => {
    const u = String(url);
    if (u.includes('/api/members')) {
      return Promise.resolve({
        ok: true,
        status: 200,
        json: async () => ({
          callerRole,
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
  vi.stubGlobal('fetch', fetchMock);
}

function renderAt() {
  return render(
    <MemoryRouter initialEntries={[`/t/khan/child/${MEMBER}`]}>
      <Routes>
        <Route
          path="/t/:slug/child/:memberId"
          element={
            <TenantProvider>
              <ChildWorldPage />
            </TenantProvider>
          }
        />
        <Route path="/t/:slug/dashboard" element={<div data-testid="dashboard-page" />} />
        <Route path="/login" element={<div data-testid="login-page" />} />
      </Routes>
    </MemoryRouter>,
  );
}

async function adminFlagFor(callerRole: string): Promise<string | null> {
  installApi(callerRole);
  renderAt();
  const stub = await screen.findByTestId('my-world-stub');
  await waitFor(() => expect(screen.getByTestId('child-world-name')).toBeInTheDocument());
  return stub.getAttribute('data-is-admin');
}

beforeEach(() => {
  fetchMock.mockReset();
  vi.unstubAllGlobals();
});

describe("the admin flag on a child's board (FHS-625)", () => {
  it('an admin gets the admin-only money controls', async () => {
    expect(await adminFlagFor('admin')).toBe('true');
  });

  it.each(['adult', 'teen', 'child', 'guest'])('a %s does not', async (role) => {
    expect(await adminFlagFor(role)).toBe('false');
  });
});
