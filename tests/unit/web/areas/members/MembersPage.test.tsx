import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { MembersPage } from '../../../../../src/areas/members/MembersPage';
import { TenantProvider } from '../../../../../src/app/lib/tenant-context';

// FHS-513: Manage Family rebuild to the finalised Magic Patterns design:
// header CTAs ("Invite an adult" / "Add a child"), members split into
// collapsible "Grown-ups" (email login) / "Kids" (PIN login) groups, a
// "How your kids sign in" helper card, and a separate "Waiting to join"
// section for unclaimed grown-up seats. Everything under here that was
// covered before FHS-513 (FHS-108 / FHS-252 / FHS-276 / FHS-471/472/473 /
// FHS-486) is re-covered against the new structure: no behaviour dropped,
// only the "Add a plain adult with no login" path (removed from the UI;
// see the ticket's decision notes).
//
// FHS-322: AppHeader added to MembersPage. Fetch mock is now URL-aware
// so AppHeader's + MembersPage's own self-fetches (/api/me,
// /api/dashboard/today) don't consume or pollute the /api/members call
// ordering.

const fetchMock = vi.fn();
const authState: {
  session: { access_token?: string } | null;
  user: { email?: string; id?: string; user_metadata?: Record<string, unknown> } | null;
} = {
  session: { access_token: 'fake-jwt' },
  user: { email: 'sarah@example.com', id: 'u-1', user_metadata: {} },
};

vi.mock('../../../../../src/app/lib/auth-context', () => ({
  useAuth: () => authState,
  signOutAll: vi.fn().mockResolvedValue({ error: null }),
  getKidToken: vi.fn(() => null),
  clearKidToken: vi.fn(),
}));

// ── Per-test response slot ────────────────────────────────────────────────────
// Each test sets membersResponse before rendering; the URL-aware mock
// routes /api/members GET to it. Mutation calls (PUT/DELETE/POST/PATCH)
// are handled via extra mockResolvedValueOnce calls appended by the test.

let membersResponse: { ok: boolean; status?: number; json: () => Promise<unknown> } | null = null;

function installApi() {
  fetchMock.mockImplementation((url: string, init?: RequestInit) => {
    const u = String(url);

    // AppHeader + MembersPage self-fetches. Exact-path match on /api/me
    // to avoid catching /api/members.
    if (/\/api\/me(\?|$)/.test(u)) {
      return Promise.resolve({
        ok: true,
        status: 200,
        json: async () => ({ tenants: [] }),
      });
    }
    if (u.includes('/api/dashboard/today')) {
      return Promise.resolve({
        ok: true,
        status: 200,
        json: async () => ({ members: [], callerMemberId: null, counts: {} }),
      });
    }

    // /api/members GET: return whatever the test has set.
    if (u.includes('/api/members') && (!init?.method || init.method === 'GET')) {
      return Promise.resolve(
        membersResponse ?? { ok: true, status: 200, json: async () => ({ members: [] }) },
      );
    }

    // Pass-through for any test-appended mockResolvedValueOnce calls
    // (POST/PATCH/DELETE, GET reload after mutation, etc.). The mock
    // queue drains before this default fires.
    return Promise.resolve({ ok: true, status: 200, json: async () => ({}) });
  });
}

function renderAt(initial: string) {
  return render(
    <MemoryRouter initialEntries={[initial]}>
      <Routes>
        <Route
          path="/t/:slug/members"
          element={
            <TenantProvider>
              <MembersPage />
            </TenantProvider>
          }
        />
      </Routes>
    </MemoryRouter>,
  );
}

// FHS-522: the Grown-ups / Kids / "How your kids sign in" sections now
// start collapsed, so their body content (member cards, kid-login steps)
// isn't in the DOM until the header is clicked. Waits for the header to
// render, then clicks its toggle to reveal the body.
async function expandGroup(testId: string) {
  await waitFor(() => expect(screen.getByTestId(testId)).toBeInTheDocument());
  fireEvent.click(screen.getByTestId(`${testId}-toggle`));
}

const expandGrownups = () => expandGroup('members-group-grownups');
const expandKids = () => expandGroup('members-group-kids');
const expandKidLogin = () => expandGroup('members-kid-login-share');

beforeEach(() => {
  membersResponse = null;
  fetchMock.mockReset();
  vi.stubGlobal('fetch', fetchMock);
  authState.session = { access_token: 'fake-jwt' };
  authState.user = { email: 'sarah@example.com', id: 'u-1', user_metadata: {} };
  installApi();
});

afterEach(() => {
  vi.unstubAllGlobals();
});

// ── Shared fixtures ─────────────────────────────────────────────────────────

function adminOnlyList() {
  return {
    ok: true,
    json: async () => ({
      callerRole: 'admin',
      // FHS-510: self-serve: the change-email control only renders on the
      // caller's OWN card, so fixtures must echo callerMemberId matching the
      // row that should be treated as "me" (here, admin-1 / Sarah Khan).
      callerMemberId: 'admin-1',
      members: [
        {
          id: 'admin-1',
          displayName: 'Sarah Khan',
          role: 'admin',
          avatarEmoji: '👩',
          status: 'active',
          createdAt: '2026-05-02T00:00:00.000Z',
          isChild: false,
          hasPin: false,
          age: null,
          inviteEmail: null,
          inviteId: null,
          email: 'sarah@example.com',
          pendingEmail: null,
        },
      ],
    }),
  };
}

// FHS-510: same single-admin roster, but with a pending email change in
// flight for the caller (the "Confirm the new email" yellow card state).
function adminWithPendingEmailList() {
  return {
    ok: true,
    json: async () => ({
      callerRole: 'admin',
      callerMemberId: 'admin-1',
      members: [
        {
          id: 'admin-1',
          displayName: 'Sarah Khan',
          role: 'admin',
          avatarEmoji: '👩',
          status: 'active',
          createdAt: '2026-05-02T00:00:00.000Z',
          isChild: false,
          hasPin: false,
          age: null,
          inviteEmail: null,
          inviteId: null,
          email: 'sarah@example.com',
          pendingEmail: 'sarah.new@example.com',
        },
      ],
    }),
  };
}

// FHS-510 blocker #6: a defensive edge case: an "active" grown-up whose
// `email` field is null (the API is expected to always populate it for a
// linked login, but the UI must not assume that and should disable the
// trigger rather than open a broken form).
function adminWithNoEmailOnFileList() {
  return {
    ok: true,
    json: async () => ({
      callerRole: 'admin',
      callerMemberId: 'admin-1',
      members: [
        {
          id: 'admin-1',
          displayName: 'Sarah Khan',
          role: 'admin',
          avatarEmoji: '👩',
          status: 'active',
          createdAt: '2026-05-02T00:00:00.000Z',
          isChild: false,
          hasPin: false,
          age: null,
          inviteEmail: null,
          inviteId: null,
          email: null,
          pendingEmail: null,
        },
      ],
    }),
  };
}

function fullFamilyList() {
  return {
    ok: true,
    json: async () => ({
      callerRole: 'admin',
      callerMemberId: 'admin-1',
      members: [
        {
          id: 'admin-1',
          displayName: 'Sarah Khan',
          role: 'admin',
          avatarEmoji: '👩',
          status: 'active',
          createdAt: '2026-05-02T00:00:00.000Z',
          isChild: false,
          hasPin: false,
          age: null,
          inviteEmail: null,
          inviteId: null,
          email: 'sarah@example.com',
          pendingEmail: null,
        },
        {
          id: 'adult-1',
          displayName: 'Yusuf',
          role: 'adult',
          avatarEmoji: null,
          status: 'active',
          createdAt: '2026-05-02T00:00:00.000Z',
          isChild: false,
          hasPin: false,
          age: null,
          inviteEmail: null,
          inviteId: null,
          email: 'yusuf@example.com',
          pendingEmail: null,
        },
        {
          id: 'kid-1',
          displayName: 'Iman',
          role: 'child',
          avatarEmoji: null,
          status: 'unclaimed',
          createdAt: '2026-05-02T00:00:00.000Z',
          isChild: true,
          hasPin: false,
          age: 6,
          inviteEmail: null,
          inviteId: null,
          email: null,
          pendingEmail: null,
        },
        {
          id: 'pending-1',
          displayName: 'Jumi',
          role: 'adult',
          avatarEmoji: null,
          status: 'unclaimed',
          createdAt: '2026-05-02T00:00:00.000Z',
          isChild: false,
          hasPin: false,
          age: null,
          inviteEmail: 'jumi@example.com',
          inviteId: '44444444-4444-4444-8444-444444444444',
          email: null,
          pendingEmail: null,
        },
      ],
    }),
  };
}

function listWithKid(opts: { callerRole: string; kidHasPin: boolean }) {
  return {
    ok: true,
    json: async () => ({
      callerRole: opts.callerRole,
      members: [
        {
          id: 'admin-id',
          displayName: 'Sarah Khan',
          role: 'admin',
          avatarEmoji: '👩',
          status: 'active',
          createdAt: '2026-05-02T00:00:00.000Z',
          isChild: false,
          hasPin: false,
          age: null,
          inviteEmail: null,
          inviteId: null,
          email: 'sarah@example.com',
          pendingEmail: null,
        },
        {
          id: 'kid-id',
          displayName: 'Iman',
          role: 'child',
          avatarEmoji: null,
          status: 'unclaimed',
          createdAt: '2026-05-02T00:00:00.000Z',
          isChild: opts.kidHasPin,
          hasPin: opts.kidHasPin,
          age: null,
          inviteEmail: null,
          inviteId: null,
          email: null,
          pendingEmail: null,
        },
      ],
    }),
  };
}

// FHS-519: two active admins, caller is admin-1. Used to cover (a)
// demoting the OTHER admin, and (b) the server-enforced rule that an
// admin can't demote THEMSELF.
function twoAdminFamily(opts: { secondRole?: 'admin' | 'adult' } = {}) {
  return {
    ok: true,
    json: async () => ({
      callerRole: 'admin',
      callerMemberId: 'admin-1',
      members: [
        {
          id: 'admin-1',
          displayName: 'Sarah Khan',
          role: 'admin',
          avatarEmoji: '👩',
          status: 'active',
          createdAt: '2026-05-02T00:00:00.000Z',
          isChild: false,
          hasPin: false,
          age: null,
          inviteEmail: null,
          inviteId: null,
          email: 'sarah@example.com',
          pendingEmail: null,
        },
        {
          id: 'admin-2',
          displayName: 'Malik Khan',
          role: opts.secondRole ?? 'admin',
          avatarEmoji: '👨',
          status: 'active',
          createdAt: '2026-05-02T00:00:00.000Z',
          isChild: false,
          hasPin: false,
          age: null,
          inviteEmail: null,
          inviteId: null,
          email: 'malik@example.com',
          pendingEmail: null,
        },
      ],
    }),
  };
}

// FHS-519: a guest-role grown-up viewing their own card. `guest` is a
// GROWN_UP_ROLES member (sign-in with email) but never admin-eligible.
function guestSelfList() {
  return {
    ok: true,
    json: async () => ({
      callerRole: 'guest',
      callerMemberId: 'guest-1',
      members: [
        {
          id: 'admin-1',
          displayName: 'Sarah Khan',
          role: 'admin',
          avatarEmoji: '👩',
          status: 'active',
          createdAt: '2026-05-02T00:00:00.000Z',
          isChild: false,
          hasPin: false,
          age: null,
          inviteEmail: null,
          inviteId: null,
          email: 'sarah@example.com',
          pendingEmail: null,
        },
        {
          id: 'guest-1',
          displayName: 'Grandma Rukayat',
          role: 'guest',
          avatarEmoji: null,
          status: 'active',
          createdAt: '2026-05-02T00:00:00.000Z',
          isChild: false,
          hasPin: false,
          age: null,
          inviteEmail: null,
          inviteId: null,
          email: 'rukayat@example.com',
          pendingEmail: null,
        },
      ],
    }),
  };
}

// FHS-519: grown-ups only, no kids at all.
function grownUpsOnlyList() {
  return {
    ok: true,
    json: async () => ({
      callerRole: 'admin',
      callerMemberId: 'admin-1',
      members: [
        {
          id: 'admin-1',
          displayName: 'Sarah Khan',
          role: 'admin',
          avatarEmoji: '👩',
          status: 'active',
          createdAt: '2026-05-02T00:00:00.000Z',
          isChild: false,
          hasPin: false,
          age: null,
          inviteEmail: null,
          inviteId: null,
          email: 'sarah@example.com',
          pendingEmail: null,
        },
      ],
    }),
  };
}

// FHS-519: kids only, no active grown-up (caller here is a non-admin
// role purely so the fixture is self-consistent; the placeholder itself
// doesn't depend on who's viewing).
function kidsOnlyList() {
  return {
    ok: true,
    json: async () => ({
      callerRole: 'adult',
      callerMemberId: null,
      members: [
        {
          id: 'kid-1',
          displayName: 'Iman',
          role: 'child',
          avatarEmoji: null,
          status: 'active',
          createdAt: '2026-05-02T00:00:00.000Z',
          isChild: true,
          hasPin: false,
          age: 6,
          inviteEmail: null,
          inviteId: null,
          email: null,
          pendingEmail: null,
        },
      ],
    }),
  };
}

describe('<MembersPage />', () => {
  it('renders a loading hint while the request is in flight', () => {
    fetchMock.mockImplementation((url: string) => {
      if (String(url).includes('/api/members')) return new Promise(() => {});
      if (/\/api\/me(\?|$)/.test(String(url)))
        return Promise.resolve({ ok: true, status: 200, json: async () => ({ tenants: [] }) });
      if (String(url).includes('/api/dashboard/today'))
        return Promise.resolve({
          ok: true,
          status: 200,
          json: async () => ({ members: [], callerMemberId: null, counts: {} }),
        });
      return new Promise(() => {});
    });
    renderAt('/t/khans/members');
    expect(screen.getByTestId('members-loading')).toBeInTheDocument();
  });

  it('renders the "Nobody here yet" empty state when the tenant has no members', async () => {
    membersResponse = { ok: true, json: async () => ({ members: [] }) };
    renderAt('/t/khans/members');
    await waitFor(() => expect(screen.getByTestId('members-empty')).toBeInTheDocument());
    expect(screen.getByTestId('members-empty').textContent).toBe('Nobody here yet');
  });

  it('renders the inline error when the API returns a non-2xx', async () => {
    membersResponse = { ok: false, status: 500, json: async () => ({}) };
    renderAt('/t/khans/members');
    await waitFor(() => expect(screen.getByTestId('members-error')).toBeInTheDocument());
  });

  it('shows the global app header (brand home button) on the members page', async () => {
    membersResponse = { ok: true, json: async () => ({ members: [] }) };
    renderAt('/t/khans/members');
    await waitFor(() => expect(screen.getByTestId('members-empty')).toBeInTheDocument());
    expect(screen.getByTestId('dashboard-brand-home')).toBeInTheDocument();
  });

  it('shows the family name + "N members · M waiting to join" summary', async () => {
    membersResponse = fullFamilyList();
    renderAt('/t/khans/members');
    // 3 members (admin + adult + kid) count as "members"; the unclaimed
    // adult ("Jumi") counts as "waiting to join", not as a member. Wait for
    // the loaded text: the summary renders "0 members · 0 waiting to join"
    // before the fetch resolves, so asserting on presence alone races.
    await waitFor(() =>
      expect(screen.getByTestId('members-summary').textContent).toBe(
        '3 members · 1 waiting to join',
      ),
    );
  });

  describe('Grown-ups / Kids groups', () => {
    it('renders the Grown-ups and Kids groups collapsed by default', async () => {
      membersResponse = fullFamilyList();
      renderAt('/t/khans/members');
      await waitFor(() => expect(screen.getByTestId('members-group-grownups')).toBeInTheDocument());
      expect(screen.queryByTestId('members-grownup-0-name')).not.toBeInTheDocument();
      expect(screen.queryByTestId('members-kid-0-name')).not.toBeInTheDocument();
    });

    it('splits members into the Grown-ups and Kids collapsible groups', async () => {
      membersResponse = fullFamilyList();
      renderAt('/t/khans/members');
      await waitFor(() => expect(screen.getByTestId('members-group-grownups')).toBeInTheDocument());
      await expandGrownups();
      await expandKids();

      expect(screen.getByTestId('members-grownup-0-name').textContent).toBe('Sarah Khan');
      expect(screen.getByTestId('members-grownup-1-name').textContent).toBe('Yusuf');
      expect(screen.getByTestId('members-kid-0-name').textContent).toBe('Iman');
      // The unclaimed adult does NOT show up in the Grown-ups grid.
      expect(screen.queryByText('Jumi')).toBeInTheDocument(); // still shown, but in Waiting to join
      expect(screen.getByTestId('members-waiting-0-name').textContent).toBe('Jumi');
    });

    it('shows "Sign in with email" / "Sign in with a PIN" subtitles on each group', async () => {
      membersResponse = fullFamilyList();
      renderAt('/t/khans/members');
      await waitFor(() => expect(screen.getByTestId('members-group-grownups')).toBeInTheDocument());
      expect(screen.getByText('Sign in with email')).toBeInTheDocument();
      expect(screen.getByText('Sign in with a PIN')).toBeInTheDocument();
    });

    it('collapses and re-expands a group when its header is clicked', async () => {
      membersResponse = fullFamilyList();
      renderAt('/t/khans/members');
      await waitFor(() => expect(screen.getByTestId('members-group-grownups')).toBeInTheDocument());
      // Starts collapsed (FHS-522): the body isn't in the DOM yet.
      expect(screen.queryByTestId('members-grownup-0-name')).not.toBeInTheDocument();
      fireEvent.click(screen.getByTestId('members-group-grownups-toggle'));
      expect(screen.getByTestId('members-grownup-0-name')).toBeInTheDocument();
      fireEvent.click(screen.getByTestId('members-group-grownups-toggle'));
      expect(screen.queryByTestId('members-grownup-0-name')).not.toBeInTheDocument();
    });

    // FHR-30: the edit box has its own Save and Cancel, so "Edit name" hides.
    it('hides "Edit name" while the name is being edited, and brings it back on Cancel', async () => {
      membersResponse = fullFamilyList();
      renderAt('/t/khans/members');
      await expandGrownups();
      await waitFor(() => screen.getByTestId('members-grownup-0-edit-name'));
      fireEvent.click(screen.getByTestId('members-grownup-0-edit-name'));
      expect(screen.getByTestId('members-grownup-0-edit-form')).toBeInTheDocument();
      expect(screen.queryByTestId('members-grownup-0-edit-name')).not.toBeInTheDocument();
      expect(document.activeElement).toBe(screen.getByTestId('members-grownup-0-edit-input'));
      fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
      expect(screen.getByTestId('members-grownup-0-edit-name')).toBeInTheDocument();
    });

    // FHR-31: on phones the main buttons share one row on both card types.
    it('lets the main card buttons share a row on phones', async () => {
      membersResponse = fullFamilyList();
      renderAt('/t/khans/members');
      await expandGrownups();
      await expandKids();
      await waitFor(() => screen.getByTestId('members-kid-0-edit-name'));
      for (const id of ['members-grownup-0-edit-name', 'members-kid-0-edit-name']) {
        expect(screen.getByTestId(id)).toHaveClass('flex-1', 'min-w-0', 'sm:flex-none');
        expect(screen.getByTestId(id).parentElement).toHaveClass('w-full', 'sm:w-auto');
      }
    });

    // FHR-29: the remove question wraps inside the card instead of running off it.
    it('wraps the remove question inside the card', async () => {
      membersResponse = fullFamilyList();
      renderAt('/t/khans/members');
      await expandKids();
      await waitFor(() => screen.getByTestId('members-kid-0-remove'));
      fireEvent.click(screen.getByTestId('members-kid-0-remove'));
      const confirm = screen.getByTestId('members-kid-0-remove-confirm');
      expect(confirm).toHaveClass('whitespace-normal', 'break-words', 'min-w-0');
      expect(confirm).not.toHaveClass('truncate');
    });

    it('shows the child/teen "signs in with a PIN, cannot be given admin" panel on a kid card', async () => {
      membersResponse = fullFamilyList();
      renderAt('/t/khans/members');
      await expandKids();
      await waitFor(() => expect(screen.getByTestId('members-kid-0-name')).toBeInTheDocument());
      expect(screen.getByTestId('members-kid-0-account-note').textContent).toContain(
        'Signs in with a PIN, cannot be given admin',
      );
    });

    it('shows role badges with the design colours (admin/adult/teen/child/guest)', async () => {
      membersResponse = fullFamilyList();
      renderAt('/t/khans/members');
      await expandGrownups();
      await expandKids();
      await waitFor(() => expect(screen.getByTestId('members-grownup-0-role')).toBeInTheDocument());
      expect(screen.getByTestId('members-grownup-0-role').textContent).toBe('Admin');
      expect(screen.getByTestId('members-grownup-1-role').textContent).toBe('Adult');
      expect(screen.getByTestId('members-kid-0-role').textContent).toBe('Child (6)');
    });

    it('does not show an admin toggle on a grown-up when the caller is not admin', async () => {
      membersResponse = fullFamilyList();
      // Force a non-admin caller so the header CTAs + admin toggles hide.
      membersResponse.json = async () => ({
        callerRole: 'adult',
        members: (await fullFamilyList().json()).members,
      });
      renderAt('/t/khans/members');
      await waitFor(() => expect(screen.getByTestId('members-group-grownups')).toBeInTheDocument());
      expect(screen.queryByTestId('members-grownup-0-admin-toggle')).not.toBeInTheDocument();
      expect(screen.queryByTestId('members-invite-adult')).not.toBeInTheDocument();
      expect(screen.queryByTestId('members-add-child')).not.toBeInTheDocument();
    });
  });

  // FHS-519: a `guest` grown-up (read-only, GROWN_UP_ROLES includes it):
  // no admin toggle ever, but the self-serve change-email control still
  // shows on their OWN card, same as any other grown-up role.
  describe('Guest role member (FHS-519)', () => {
    it('shows the "Guest" badge, no admin toggle, and the Change-email control on their own card', async () => {
      membersResponse = guestSelfList();
      renderAt('/t/khans/members');
      await expandGrownups();
      await waitFor(() => expect(screen.getByTestId('members-grownup-1-name')).toBeInTheDocument());

      expect(screen.getByTestId('members-grownup-1-name').textContent).toBe('Grandma Rukayat');
      expect(screen.getByTestId('members-grownup-1-role').textContent).toBe('Guest');
      // No admin panel/toggle at all for a guest row, regardless of caller.
      expect(screen.queryByTestId('members-grownup-1-admin-panel')).not.toBeInTheDocument();
      expect(screen.queryByTestId('members-grownup-1-admin-toggle')).not.toBeInTheDocument();
      // The guest is viewing their OWN card: the change-email trigger
      // shows even though they aren't an admin.
      const changeEmailBtn = screen.getByTestId(
        'members-grownup-1-change-email',
      ) as HTMLButtonElement;
      expect(changeEmailBtn.disabled).toBe(false);
      // Not an admin: no "Edit name" button.
      expect(screen.queryByTestId('members-grownup-1-edit-name')).not.toBeInTheDocument();
      expect(screen.queryByTestId('members-admin-panel-btn')).not.toBeInTheDocument();
    });
  });

  // FHS-519: a group with zero members shows a placeholder instead of
  // just vanishing from the page.
  describe('Empty group placeholders (FHS-519)', () => {
    it('shows the Kids-group empty placeholder for a grown-ups-only family', async () => {
      membersResponse = grownUpsOnlyList();
      renderAt('/t/khans/members');
      await waitFor(() => expect(screen.getByTestId('members-group-grownups')).toBeInTheDocument());
      expect(screen.queryByTestId('members-group-kids')).not.toBeInTheDocument();
      const placeholder = screen.getByTestId('members-group-kids-empty');
      expect(placeholder.textContent).toContain('No kids yet');
      expect(placeholder.textContent).toContain('Add a child');
    });

    it('shows the Grown-ups-group empty placeholder for a kids-only family', async () => {
      membersResponse = kidsOnlyList();
      renderAt('/t/khans/members');
      await waitFor(() => expect(screen.getByTestId('members-group-kids')).toBeInTheDocument());
      expect(screen.queryByTestId('members-group-grownups')).not.toBeInTheDocument();
      const placeholder = screen.getByTestId('members-group-grownups-empty');
      expect(placeholder.textContent).toContain('No grown-ups yet');
    });
  });

  describe('Waiting to join', () => {
    it('renders a "Waiting to join" section with the pending email + a Resend button', async () => {
      membersResponse = fullFamilyList();
      renderAt('/t/khans/members');
      await waitFor(() =>
        expect(screen.getByTestId('members-waiting-section')).toBeInTheDocument(),
      );
      expect(screen.getByTestId('members-waiting-0-status').textContent).toBe('jumi@example.com');
      expect(screen.getByTestId('members-waiting-0-pending').textContent).toContain('signed up');
      expect(screen.getByTestId('members-waiting-0-resend')).toBeInTheDocument();
      // FHS-278 / FHS-519: an unclaimed adult/admin-candidate seat shows the
      // admin toggle so the affordance isn't just missing, but it's DISABLED
      // (you can't promote someone who hasn't signed up yet) with a hint.
      const waitingToggle = screen.getByTestId(
        'members-waiting-0-admin-toggle',
      ) as HTMLButtonElement;
      expect(waitingToggle.disabled).toBe(true);
      expect(waitingToggle.getAttribute('aria-checked')).toBe('false');
      expect(screen.getByTestId('members-waiting-0-admin-panel').textContent).toContain(
        'Available once they sign up',
      );

      fetchMock.mockResolvedValueOnce({ ok: true, json: async () => ({ resent: true }) });
      fireEvent.click(screen.getByTestId('members-waiting-0-resend'));
      await waitFor(() => {
        const resendCall = fetchMock.mock.calls.find(
          (c) =>
            typeof c[0] === 'string' &&
            c[0].includes('/api/invitations/44444444-4444-4444-8444-444444444444/resend'),
        );
        expect(resendCall).toBeDefined();
      });
    });

    it('does not render the "Waiting to join" section when nobody is pending', async () => {
      membersResponse = adminOnlyList();
      renderAt('/t/khans/members');
      await waitFor(() => expect(screen.getByTestId('members-group-grownups')).toBeInTheDocument());
      expect(screen.queryByTestId('members-waiting-section')).not.toBeInTheDocument();
    });
  });

  describe('How your kids sign in', () => {
    it('shows the kid-login card with the family code + a working copy button', async () => {
      membersResponse = adminOnlyList();
      const writeText = vi.fn().mockResolvedValue(undefined);
      Object.defineProperty(navigator, 'clipboard', {
        value: { writeText },
        configurable: true,
      });
      renderAt('/t/khans/members');
      await waitFor(() =>
        expect(screen.getByTestId('members-kid-login-share')).toBeInTheDocument(),
      );
      await expandKidLogin();

      expect(screen.getByText('How your kids sign in')).toBeInTheDocument();
      expect(screen.getByTestId('members-kid-login-code').textContent).toBe('khans');
      expect(screen.getByTestId('members-kid-login-url').textContent).toContain(
        '/t/khans/kid-login',
      );

      fireEvent.click(screen.getByTestId('members-kid-login-copy'));
      await waitFor(() =>
        expect(writeText).toHaveBeenCalledWith(expect.stringContaining('/t/khans/kid-login')),
      );
      await waitFor(() =>
        expect(screen.getByTestId('members-kid-login-copy').textContent).toContain('Copied'),
      );
    });

    it('is collapsible', async () => {
      membersResponse = adminOnlyList();
      renderAt('/t/khans/members');
      await waitFor(() =>
        expect(screen.getByTestId('members-kid-login-share')).toBeInTheDocument(),
      );
      // Starts collapsed (FHS-522): the body isn't in the DOM yet.
      expect(screen.queryByTestId('members-kid-login-url')).not.toBeInTheDocument();
      fireEvent.click(screen.getByTestId('members-kid-login-share-toggle'));
      expect(screen.getByTestId('members-kid-login-url')).toBeInTheDocument();
      fireEvent.click(screen.getByTestId('members-kid-login-share-toggle'));
      expect(screen.queryByTestId('members-kid-login-url')).not.toBeInTheDocument();
    });
  });

  describe('Header CTAs', () => {
    it('renders "Invite an adult" and "Add a child" (not the old "Invite member" / "Add member")', async () => {
      membersResponse = adminOnlyList();
      renderAt('/t/khans/members');
      await waitFor(() => expect(screen.getByTestId('members-invite-adult')).toBeInTheDocument());
      expect(screen.getByTestId('members-invite-adult').textContent).toContain('Invite an adult');
      expect(screen.getByTestId('members-add-child').textContent).toContain('Add a child');
      expect(screen.queryByText('Invite member')).toBeNull();
      expect(screen.queryByText('Add member')).toBeNull();
    });

    it('the dashboard\'s "+" deep link (?add=member) still opens the Add-a-child form', async () => {
      membersResponse = adminOnlyList();
      renderAt('/t/khans/members?add=member');
      await waitFor(() => expect(screen.getByTestId('members-add-child-form')).toBeInTheDocument());
    });
  });

  describe('Invite an adult (FHS-486 role picker, no Teen)', () => {
    it('opens a role picker defaulting to Parent / partner for an admin, with no Teen option', async () => {
      membersResponse = adminOnlyList();
      renderAt('/t/khans/members');
      await waitFor(() => expect(screen.getByTestId('members-invite-adult')).toBeInTheDocument());
      fireEvent.click(screen.getByTestId('members-invite-adult'));
      expect(screen.getByTestId('members-invite-form')).toBeInTheDocument();
      // FHS-524: default selection is the Parent / partner (admin) card, so
      // inviting a co-parent is one tap. The form only opens for admins.
      expect(screen.getByTestId('members-invite-role-admin')).toHaveAttribute(
        'aria-checked',
        'true',
      );
      expect(screen.getByTestId('members-invite-role-adult')).toHaveAttribute(
        'aria-checked',
        'false',
      );
      // Exactly 3 role cards, in design order: no Teen card on this form.
      const cards = screen.getAllByTestId(/^members-invite-role-/);
      expect(cards.map((c) => c.getAttribute('data-testid'))).toEqual([
        'members-invite-role-admin',
        'members-invite-role-adult',
        'members-invite-role-guest',
      ]);
      expect(screen.getByText('Parent / partner')).toBeInTheDocument();
      expect(screen.getByText('Guest')).toBeInTheDocument();
    });

    it('hides the admin-only "Parent / partner" option for a non-admin caller', async () => {
      membersResponse = {
        ok: true,
        json: async () => ({
          callerRole: 'adult',
          members: [
            {
              id: 'admin-1',
              displayName: 'Sarah Khan',
              role: 'admin',
              avatarEmoji: '👩',
              status: 'active',
              createdAt: '2026-05-02T00:00:00.000Z',
              isChild: false,
              hasPin: false,
              age: null,
              inviteEmail: null,
              inviteId: null,
            },
            {
              id: 'adult-1',
              displayName: 'Yusuf',
              role: 'adult',
              avatarEmoji: null,
              status: 'active',
              createdAt: '2026-05-02T00:00:00.000Z',
              isChild: false,
              hasPin: false,
              age: null,
              inviteEmail: null,
              inviteId: null,
            },
          ],
        }),
      };
      renderAt('/t/khans/members');
      // Non-admin caller: no header CTAs at all (mutations are admin-only).
      await waitFor(() => expect(screen.getByTestId('members-group-grownups')).toBeInTheDocument());
      expect(screen.queryByTestId('members-invite-adult')).not.toBeInTheDocument();
    });

    it('sends the chosen role (admin) on submit: not hardcoded "adult"', async () => {
      membersResponse = adminOnlyList();
      renderAt('/t/khans/members');
      await waitFor(() => expect(screen.getByTestId('members-invite-adult')).toBeInTheDocument());
      fireEvent.click(screen.getByTestId('members-invite-adult'));

      fireEvent.click(screen.getByTestId('members-invite-role-admin'));
      fireEvent.change(screen.getByTestId('members-invite-email'), {
        target: { value: 'partner@example.com' },
      });

      fetchMock.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ invitation: { id: 'inv-1', role: 'admin', status: 'pending' } }),
      });
      fetchMock.mockResolvedValueOnce(adminOnlyList());
      fireEvent.click(screen.getByTestId('members-invite-send'));

      await waitFor(() =>
        expect(screen.queryByTestId('members-invite-form')).not.toBeInTheDocument(),
      );
      const postCall = fetchMock.mock.calls.find(
        (c) =>
          typeof c[0] === 'string' && c[0].endsWith('/api/invitations') && c[1]?.method === 'POST',
      );
      expect(postCall).toBeDefined();
      expect(JSON.parse(postCall![1].body as string)).toEqual({
        email: 'partner@example.com',
        role: 'admin',
      });
    });

    it("surfaces the server's 403 detail on submit", async () => {
      membersResponse = adminOnlyList();
      renderAt('/t/khans/members');
      await waitFor(() => expect(screen.getByTestId('members-invite-adult')).toBeInTheDocument());
      fireEvent.click(screen.getByTestId('members-invite-adult'));

      fireEvent.change(screen.getByTestId('members-invite-email'), {
        target: { value: 'partner@example.com' },
      });

      fetchMock.mockResolvedValueOnce({
        ok: false,
        status: 403,
        json: async () => ({
          error: 'forbidden',
          detail: 'only an admin can invite someone as admin',
        }),
      });
      fireEvent.click(screen.getByTestId('members-invite-send'));
      await waitFor(() =>
        expect(screen.getByTestId('members-invite-error').textContent).toMatch(/only an admin/i),
      );
    });

    it('the submit button reads "Send sign-in link"', async () => {
      membersResponse = adminOnlyList();
      renderAt('/t/khans/members');
      await waitFor(() => expect(screen.getByTestId('members-invite-adult')).toBeInTheDocument());
      fireEvent.click(screen.getByTestId('members-invite-adult'));
      expect(screen.getByTestId('members-invite-send').textContent?.trim()).toBe(
        'Send sign-in link',
      );
    });
  });

  describe('Add a child (FHS-472/473, child/teen only)', () => {
    it('opens a Child/Teen picker defaulting to Child with Name, Age + emoji picker', async () => {
      membersResponse = adminOnlyList();
      renderAt('/t/khans/members');
      await waitFor(() => expect(screen.getByTestId('members-add-child')).toBeInTheDocument());
      fireEvent.click(screen.getByTestId('members-add-child'));
      expect(screen.getByTestId('members-add-child-form')).toBeInTheDocument();
      // Default selection is the Child card.
      expect(screen.getByTestId('members-add-child-role-child')).toHaveAttribute(
        'aria-checked',
        'true',
      );
      expect(screen.getByTestId('members-add-child-role-teen')).toHaveAttribute(
        'aria-checked',
        'false',
      );
      expect(screen.getByTestId('members-add-child-name')).toBeInTheDocument();
      // No "Adult" card any more: the plain no-login adult path moved
      // to Invite. Exactly the Child + Teen cards render.
      const cards = screen.getAllByTestId(/^members-add-child-role-/);
      expect(cards.map((c) => c.getAttribute('data-testid'))).toEqual([
        'members-add-child-role-child',
        'members-add-child-role-teen',
      ]);
    });

    it('picking Teen creates a teen member (no login)', async () => {
      membersResponse = adminOnlyList();
      renderAt('/t/khans/members');
      await waitFor(() => expect(screen.getByTestId('members-add-child')).toBeInTheDocument());
      fireEvent.click(screen.getByTestId('members-add-child'));

      fireEvent.click(screen.getByTestId('members-add-child-role-teen'));
      fireEvent.change(screen.getByTestId('members-add-child-name'), {
        target: { value: 'Zayd' },
      });
      fetchMock.mockResolvedValueOnce({ ok: true, json: async () => ({ member: {} }) });
      fetchMock.mockResolvedValueOnce(adminOnlyList());
      fireEvent.click(screen.getByTestId('members-add-child-save'));

      await waitFor(() =>
        expect(screen.queryByTestId('members-add-child-form')).not.toBeInTheDocument(),
      );
      const postCall = fetchMock.mock.calls.find(
        (c) => typeof c[0] === 'string' && c[0].endsWith('/api/members') && c[1]?.method === 'POST',
      );
      // FHS-521: the design's Add-a-child sends just name + role (avatar/age dropped).
      expect(JSON.parse(postCall![1].body as string)).toEqual({
        displayName: 'Zayd',
        role: 'teen',
      });
    });

    it('the submit button reads "Add to the family"', async () => {
      membersResponse = adminOnlyList();
      renderAt('/t/khans/members');
      await waitFor(() => expect(screen.getByTestId('members-add-child')).toBeInTheDocument());
      fireEvent.click(screen.getByTestId('members-add-child'));
      expect(screen.getByTestId('members-add-child-save').textContent?.trim()).toBe(
        'Add to the family',
      );
    });
  });

  // FHS-252: admin/adult-only PIN management, kept covered on the new
  // per-card testId scheme.
  describe('Kid PIN management (FHS-252)', () => {
    it('admin sees a "Set PIN" toggle on a kid card + can submit a fresh PIN', async () => {
      membersResponse = listWithKid({ callerRole: 'admin', kidHasPin: false });
      renderAt('/t/khans/members');
      await expandKids();
      await waitFor(() =>
        expect(screen.getByTestId('members-kid-0-pin-toggle')).toBeInTheDocument(),
      );
      expect(screen.getByTestId('members-kid-0-pin-toggle').textContent).toContain('Set PIN');

      fireEvent.click(screen.getByTestId('members-kid-0-pin-toggle'));
      expect(screen.getByTestId('members-kid-0-pin-form')).toBeInTheDocument();

      fireEvent.change(screen.getByTestId('members-kid-0-pin-input'), {
        target: { value: '1234' },
      });
      fireEvent.change(screen.getByTestId('members-kid-0-pin-confirm'), {
        target: { value: '1234' },
      });

      fetchMock.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          member: { id: 'kid-id', displayName: 'Iman', isChild: true, hasPin: true },
        }),
      });
      fetchMock.mockResolvedValueOnce(listWithKid({ callerRole: 'admin', kidHasPin: true }));

      fireEvent.click(screen.getByTestId('members-kid-0-pin-save'));
      await waitFor(() =>
        expect(screen.getByTestId('members-kid-0-pin-toggle').textContent).toContain('Reset PIN'),
      );

      const putCall = fetchMock.mock.calls.find(
        (c) => typeof c[0] === 'string' && c[0].endsWith('/kid-id/pin') && c[1]?.method === 'PUT',
      );
      expect(putCall).toBeDefined();
      expect(JSON.parse(putCall![1].body as string)).toEqual({ pin: '1234' });
    });

    it('mismatched PIN + Confirm shows inline error and does NOT call the API', async () => {
      membersResponse = listWithKid({ callerRole: 'admin', kidHasPin: false });
      renderAt('/t/khans/members');
      await expandKids();
      await waitFor(() =>
        expect(screen.getByTestId('members-kid-0-pin-toggle')).toBeInTheDocument(),
      );

      fireEvent.click(screen.getByTestId('members-kid-0-pin-toggle'));
      fireEvent.change(screen.getByTestId('members-kid-0-pin-input'), {
        target: { value: '1234' },
      });
      fireEvent.change(screen.getByTestId('members-kid-0-pin-confirm'), {
        target: { value: '5678' },
      });
      fireEvent.click(screen.getByTestId('members-kid-0-pin-save'));

      expect(screen.getByTestId('members-kid-0-pin-error').textContent).toMatch(/don.t match/i);
      const putCalls = fetchMock.mock.calls.filter(
        (c) => c[1]?.method === 'PUT' || c[1]?.method === 'DELETE',
      );
      expect(putCalls).toHaveLength(0);
    });

    it('"Remove kid login" DELETEs the PIN and reloads the list', async () => {
      membersResponse = listWithKid({ callerRole: 'admin', kidHasPin: true });
      renderAt('/t/khans/members');
      await expandKids();
      await waitFor(() =>
        expect(screen.getByTestId('members-kid-0-pin-toggle')).toBeInTheDocument(),
      );
      expect(screen.getByTestId('members-kid-0-pin-toggle').textContent).toContain('Reset PIN');

      fireEvent.click(screen.getByTestId('members-kid-0-pin-toggle'));
      fetchMock.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          member: { id: 'kid-id', displayName: 'Iman', isChild: false, hasPin: false },
        }),
      });
      fetchMock.mockResolvedValueOnce(listWithKid({ callerRole: 'admin', kidHasPin: false }));

      fireEvent.click(screen.getByTestId('members-kid-0-pin-remove'));
      await waitFor(() =>
        expect(screen.getByTestId('members-kid-0-pin-toggle').textContent).toContain('Set PIN'),
      );

      const deleteCall = fetchMock.mock.calls.find(
        (c) =>
          typeof c[0] === 'string' && c[0].endsWith('/kid-id/pin') && c[1]?.method === 'DELETE',
      );
      expect(deleteCall).toBeDefined();
    });

    it('a child role caller does NOT see the PIN toggle (admin/adult only)', async () => {
      membersResponse = listWithKid({ callerRole: 'child', kidHasPin: false });
      renderAt('/t/khans/members');
      await expandKids();
      await waitFor(() => expect(screen.getByTestId('members-kid-0-name')).toBeInTheDocument());
      expect(screen.queryByTestId('members-kid-0-pin-toggle')).not.toBeInTheDocument();
    });

    it('a teen role caller does NOT see the PIN toggle either', async () => {
      membersResponse = listWithKid({ callerRole: 'teen', kidHasPin: false });
      renderAt('/t/khans/members');
      await expandKids();
      await waitFor(() => expect(screen.getByTestId('members-kid-0-name')).toBeInTheDocument());
      expect(screen.queryByTestId('members-kid-0-pin-toggle')).not.toBeInTheDocument();
    });

    it('shows the server detail message (not just "forbidden") when a 403 fires', async () => {
      membersResponse = listWithKid({ callerRole: 'admin', kidHasPin: false });
      renderAt('/t/khans/members');
      await expandKids();
      await waitFor(() =>
        expect(screen.getByTestId('members-kid-0-pin-toggle')).toBeInTheDocument(),
      );
      fireEvent.click(screen.getByTestId('members-kid-0-pin-toggle'));
      fireEvent.change(screen.getByTestId('members-kid-0-pin-input'), {
        target: { value: '1234' },
      });
      fireEvent.change(screen.getByTestId('members-kid-0-pin-confirm'), {
        target: { value: '1234' },
      });

      fetchMock.mockResolvedValueOnce({
        ok: false,
        status: 403,
        json: async () => ({ error: 'forbidden', detail: 'admins and adults can manage kid PINs' }),
      });
      fireEvent.click(screen.getByTestId('members-kid-0-pin-save'));
      await waitFor(() =>
        expect(screen.getByTestId('members-kid-0-pin-error').textContent).toMatch(
          /admins and adults/i,
        ),
      );
    });
  });

  describe('Edit name, admin toggle, Remove: grown-up card actions', () => {
    it('edits a grown-up name via the inline edit form', async () => {
      membersResponse = fullFamilyList();
      renderAt('/t/khans/members');
      await expandGrownups();
      await waitFor(() =>
        expect(screen.getByTestId('members-grownup-1-edit-name')).toBeInTheDocument(),
      );
      fireEvent.click(screen.getByTestId('members-grownup-1-edit-name'));
      fireEvent.change(screen.getByTestId('members-grownup-1-edit-input'), {
        target: { value: 'Yusuf Khan' },
      });
      fetchMock.mockResolvedValueOnce({ ok: true, json: async () => ({ member: {} }) });
      fetchMock.mockResolvedValueOnce(fullFamilyList());
      fireEvent.click(screen.getByTestId('members-grownup-1-edit-save'));
      await waitFor(() =>
        expect(screen.queryByTestId('members-grownup-1-edit-form')).not.toBeInTheDocument(),
      );
      const patchCall = fetchMock.mock.calls.find(
        (c) => typeof c[0] === 'string' && c[0].endsWith('/adult-1') && c[1]?.method === 'PATCH',
      );
      expect(JSON.parse(patchCall![1].body as string)).toEqual({ displayName: 'Yusuf Khan' });
    });

    // FHS-510: admin changes a grown-up's sign-in email, confirmed by a
    // one-time emailed link.
    describe('Change email (FHS-510)', () => {
      it('opens the "New email for …" form and sends the request on submit', async () => {
        membersResponse = fullFamilyList();
        renderAt('/t/khans/members');
        await expandGrownups();
        await waitFor(() =>
          expect(screen.getByTestId('members-grownup-0-change-email')).toBeInTheDocument(),
        );
        const btn = screen.getByTestId('members-grownup-0-change-email') as HTMLButtonElement;
        expect(btn.disabled).toBe(false);

        fireEvent.click(btn);
        expect(screen.getByTestId('members-grownup-0-email-change-form')).toBeInTheDocument();
        expect(screen.getByText('New email for Sarah Khan')).toBeInTheDocument();

        fireEvent.change(screen.getByTestId('members-grownup-0-email-change-input'), {
          target: { value: 'sarah.new@example.com' },
        });
        fetchMock.mockResolvedValueOnce({
          ok: true,
          json: async () => ({ pendingEmail: 'sarah.new@example.com' }),
        });
        fetchMock.mockResolvedValueOnce(adminWithPendingEmailList());
        fireEvent.click(screen.getByTestId('members-grownup-0-email-change-send'));

        await waitFor(() =>
          expect(
            screen.queryByTestId('members-grownup-0-email-change-form'),
          ).not.toBeInTheDocument(),
        );
        const postCall = fetchMock.mock.calls.find(
          (c) =>
            typeof c[0] === 'string' &&
            c[0].endsWith('/admin-1/email-change') &&
            c[1]?.method === 'POST',
        );
        expect(postCall).toBeDefined();
        expect(JSON.parse(postCall![1].body as string)).toEqual({
          email: 'sarah.new@example.com',
        });
      });

      it('is disabled when the member has no sign-in email yet', async () => {
        membersResponse = adminWithNoEmailOnFileList();
        renderAt('/t/khans/members');
        await expandGrownups();
        await waitFor(() =>
          expect(screen.getByTestId('members-grownup-0-change-email')).toBeInTheDocument(),
        );
        const btn = screen.getByTestId('members-grownup-0-change-email') as HTMLButtonElement;
        expect(btn.disabled).toBe(true);
        expect(btn.title).toMatch(/no sign-in email yet/i);
        // Clicking a disabled button is a no-op: the form never opens.
        fireEvent.click(btn);
        expect(screen.queryByTestId('members-grownup-0-email-change-form')).not.toBeInTheDocument();
      });

      it('shows the pending "Confirm the new email" card, disables the trigger button, and supports Resend + Cancel', async () => {
        membersResponse = adminWithPendingEmailList();
        renderAt('/t/khans/members');
        await expandGrownups();
        await waitFor(() =>
          expect(screen.getByTestId('members-grownup-0-pending-email')).toBeInTheDocument(),
        );
        expect(screen.getByTestId('members-grownup-0-pending-email').textContent).toContain(
          'sarah.new@example.com',
        );
        expect(screen.getByTestId('members-grownup-0-pending-email').textContent).toContain(
          'sarah@example.com',
        );
        expect(
          (screen.getByTestId('members-grownup-0-change-email') as HTMLButtonElement).disabled,
        ).toBe(true);

        // Resend re-POSTs the same pending address.
        fetchMock.mockResolvedValueOnce({
          ok: true,
          json: async () => ({ pendingEmail: 'sarah.new@example.com' }),
        });
        fetchMock.mockResolvedValueOnce(adminWithPendingEmailList());
        fireEvent.click(screen.getByTestId('members-grownup-0-pending-email-resend'));
        await waitFor(() => {
          const resendCall = fetchMock.mock.calls.find(
            (c) =>
              typeof c[0] === 'string' &&
              c[0].endsWith('/admin-1/email-change') &&
              c[1]?.method === 'POST',
          );
          expect(resendCall).toBeDefined();
          expect(JSON.parse(resendCall![1].body as string)).toEqual({
            email: 'sarah.new@example.com',
          });
        });

        // Cancel clears the pending change and the page reloads without it.
        fetchMock.mockResolvedValueOnce({ ok: true, json: async () => ({ cancelled: true }) });
        fetchMock.mockResolvedValueOnce(adminOnlyList());
        fireEvent.click(screen.getByTestId('members-grownup-0-pending-email-cancel'));
        await waitFor(() => {
          const cancelCall = fetchMock.mock.calls.find(
            (c) =>
              typeof c[0] === 'string' &&
              c[0].endsWith('/admin-1/email-change/cancel') &&
              c[1]?.method === 'POST',
          );
          expect(cancelCall).toBeDefined();
        });
        await waitFor(() =>
          expect(screen.queryByTestId('members-grownup-0-pending-email')).not.toBeInTheDocument(),
        );
      });

      // FHS-510 blocker #7: defense-in-depth: even if the API ever returned
      // pendingEmail data for a card that isn't the caller's own (it
      // shouldn't: self-serve gates purely on identity, not role, per the
      // backend's `target.userId !== userRow.id` check), the UI must still
      // hide the pending card AND the change-email trigger for that row.
      // Deliberately uses an ADMIN caller here to prove the gate is about
      // "is this my row?", not "am I an admin?".
      it("a caller viewing another member's card sees neither the pending card nor the change-email controls", async () => {
        membersResponse = {
          ok: true,
          json: async () => ({
            callerRole: 'admin',
            callerMemberId: 'someone-else-id', // caller is NOT the admin-1 row below
            members: (await adminWithPendingEmailList().json()).members,
          }),
        };
        renderAt('/t/khans/members');
        await expandGrownups();
        await waitFor(() =>
          expect(screen.getByTestId('members-grownup-0-name')).toBeInTheDocument(),
        );
        expect(screen.queryByTestId('members-grownup-0-pending-email')).not.toBeInTheDocument();
        expect(screen.queryByTestId('members-grownup-0-change-email')).not.toBeInTheDocument();
        expect(screen.queryByTestId('members-grownup-0-email-change-form')).not.toBeInTheDocument();
      });

      it("surfaces the server's error detail (e.g. email already registered) via the shared action-error banner", async () => {
        membersResponse = fullFamilyList();
        renderAt('/t/khans/members');
        await expandGrownups();
        await waitFor(() =>
          expect(screen.getByTestId('members-grownup-0-change-email')).toBeInTheDocument(),
        );
        fireEvent.click(screen.getByTestId('members-grownup-0-change-email'));
        fireEvent.change(screen.getByTestId('members-grownup-0-email-change-input'), {
          target: { value: 'taken@example.com' },
        });
        fetchMock.mockResolvedValueOnce({
          ok: false,
          status: 409,
          json: async () => ({
            error: 'email already registered',
            detail: 'That email already belongs to a Family Hub account.',
          }),
        });
        fireEvent.click(screen.getByTestId('members-grownup-0-email-change-send'));
        await waitFor(() =>
          expect(screen.getByTestId('members-action-error').textContent).toMatch(
            /already belongs to a family hub account/i,
          ),
        );
        // The form stays open so the admin can correct the address and retry.
        expect(screen.getByTestId('members-grownup-0-email-change-form')).toBeInTheDocument();
      });
    });

    it('admin toggle is disabled for the last admin and enabled ("Make admin") on another parent', async () => {
      membersResponse = fullFamilyList();
      renderAt('/t/khans/members');
      await expandGrownups();
      await waitFor(() =>
        expect(screen.getByTestId('members-grownup-0-admin-toggle')).toBeInTheDocument(),
      );
      expect(
        (screen.getByTestId('members-grownup-0-admin-toggle') as HTMLButtonElement).disabled,
      ).toBe(true);
      const make = screen.getByTestId('members-grownup-1-admin-toggle') as HTMLButtonElement;
      expect(make.disabled).toBe(false);
      expect(make.textContent).toContain('Make admin');
      // Kid cards never show an admin toggle.
      expect(screen.queryByTestId('members-kid-0-admin-toggle')).not.toBeInTheDocument();
    });

    // FHS-519: a two-admin family: demoting the OTHER admin works and
    // leaves the family with its remaining admin; demoting yourself is
    // blocked by the server (not the client: the toggle isn't disabled
    // for your own row when a second admin exists), and the rejection
    // surfaces via the shared action-error banner.
    describe('Two-admin family (FHS-519)', () => {
      it('demoting the other admin fires the PATCH and the family keeps its remaining admin', async () => {
        membersResponse = twoAdminFamily();
        renderAt('/t/khans/members');
        await expandGrownups();
        await waitFor(() =>
          expect(screen.getByTestId('members-grownup-1-admin-toggle')).toBeInTheDocument(),
        );
        // Neither toggle is last-admin-locked: two admins exist.
        expect(
          (screen.getByTestId('members-grownup-0-admin-toggle') as HTMLButtonElement).disabled,
        ).toBe(false);
        const otherToggle = screen.getByTestId(
          'members-grownup-1-admin-toggle',
        ) as HTMLButtonElement;
        expect(otherToggle.disabled).toBe(false);

        fetchMock.mockResolvedValueOnce({
          ok: true,
          json: async () => ({ member: { id: 'admin-2', role: 'adult' } }),
        });
        fetchMock.mockResolvedValueOnce(twoAdminFamily({ secondRole: 'adult' }));
        fireEvent.click(otherToggle);

        await waitFor(() =>
          expect(screen.getByTestId('members-grownup-1-role').textContent).toBe('Adult'),
        );
        const patchCall = fetchMock.mock.calls.find(
          (c) => typeof c[0] === 'string' && c[0].endsWith('/admin-2') && c[1]?.method === 'PATCH',
        );
        expect(patchCall).toBeDefined();
        expect(JSON.parse(patchCall![1].body as string)).toEqual({ role: 'adult' });
        // The caller (admin-1) keeps their admin role: the family always
        // has one.
        expect(screen.getByTestId('members-grownup-0-role').textContent).toBe('Admin');
        expect(screen.queryByTestId('members-action-error')).not.toBeInTheDocument();
      });

      it("an admin cannot demote their OWN row: the server's rejection surfaces via the action-error banner", async () => {
        membersResponse = twoAdminFamily();
        renderAt('/t/khans/members');
        await expandGrownups();
        await waitFor(() =>
          expect(screen.getByTestId('members-grownup-0-admin-toggle')).toBeInTheDocument(),
        );
        const ownToggle = screen.getByTestId('members-grownup-0-admin-toggle') as HTMLButtonElement;
        // Not client-side disabled: a second admin exists, so the
        // last-admin lock doesn't apply. The server is what blocks this.
        expect(ownToggle.disabled).toBe(false);

        fetchMock.mockResolvedValueOnce({
          ok: false,
          status: 400,
          json: async () => ({
            error: 'forbidden',
            detail: 'ask another admin to remove your admin access',
          }),
        });
        fireEvent.click(ownToggle);

        await waitFor(() =>
          expect(screen.getByTestId('members-action-error').textContent).toMatch(
            /ask another admin/i,
          ),
        );
        // The failed PATCH never refreshed the list: the caller is still
        // shown as admin.
        expect(screen.getByTestId('members-grownup-0-role').textContent).toBe('Admin');
      });
    });

    // FHS-629: the Admin Panel button is gone. FHS-621 split that panel into
    // Kids money, Earning rules and Family settings, each with its own door in
    // the profile menu, so a button named after a screen that no longer exists
    // was sending parents somewhere other than where it said.
    it('has no Admin Panel button, because that panel no longer exists', async () => {
      membersResponse = adminOnlyList();
      renderAt('/t/khans/members');
      await expandGrownups();
      await waitFor(() => expect(screen.getByTestId('members-grownup-0-role')).toBeInTheDocument());
      expect(screen.queryByTestId('members-admin-panel-btn')).not.toBeInTheDocument();
      expect(screen.queryByText('Admin Panel')).not.toBeInTheDocument();
    });

    it('remove is last-admin-protected on the sole admin, and works on a second grown-up', async () => {
      membersResponse = fullFamilyList();
      renderAt('/t/khans/members');
      await expandGrownups();
      await waitFor(() =>
        expect(screen.getByTestId('members-grownup-0-remove')).toBeInTheDocument(),
      );
      expect((screen.getByTestId('members-grownup-0-remove') as HTMLButtonElement).disabled).toBe(
        true,
      );

      const removeBtn = screen.getByTestId('members-grownup-1-remove') as HTMLButtonElement;
      expect(removeBtn.disabled).toBe(false);
      fireEvent.click(removeBtn);
      fetchMock.mockResolvedValueOnce({ ok: true, json: async () => ({ deleted: true }) });
      fetchMock.mockResolvedValueOnce(adminOnlyList());
      fireEvent.click(screen.getByTestId('members-grownup-1-remove-confirm'));
      await waitFor(() => {
        const deleteCall = fetchMock.mock.calls.find(
          (c) => typeof c[0] === 'string' && c[0].endsWith('/adult-1') && c[1]?.method === 'DELETE',
        );
        expect(deleteCall).toBeDefined();
      });
    });
  });

  it('passes the tenant slug + bearer token on the /api/members request', async () => {
    membersResponse = { ok: true, json: async () => ({ members: [] }) };
    renderAt('/t/khans/members');
    await waitFor(() => expect(fetchMock).toHaveBeenCalled());
    const membersCall = fetchMock.mock.calls.find(([u]) => String(u).includes('/api/members'));
    expect(membersCall).toBeDefined();
    const [url, init] = membersCall!;
    expect(url).toBe('http://localhost:3001/api/members');
    expect(init.headers).toMatchObject({
      Authorization: 'Bearer fake-jwt',
      'x-tenant-slug': 'khans',
    });
  });
});
