// AppHeader: shared top-navigation header for all authenticated parent pages.
//
// Encapsulates:
//  • FamilyHero brand area (family-initial disc + name + members-active pulse)
//  • TopNav with the six dashboard tabs + per-tab badges
//  • ProfilePill dropdown (child links, Manage family, Reward settings,
//    and a Log out button at the bottom of the menu: FHS-520)
//
// Self-fetches family name + members + Tasks badge from /api/me +
// /api/dashboard/today. Listens to fh:dashboard-stale (FHS-309) to
// refresh badge counts live when a task mutation fires in any tab.
//
// Props:
//  activeTab: which tab to highlight; pass null when no tab is active
//                (e.g. Admin Panel, Members page).
//  onTabChange: called with the tab id when the user clicks a tab;
//                the caller decides how to handle the navigation.

import { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ChevronDown, LogOut, Settings, Sliders, Users, Wallet } from 'lucide-react';
import { TopNav, type TopNavTab } from '@familyhub/ui';
import type { DashboardMember } from '@familyhub/shared';
import { signOutAll, useAuth } from '../lib/auth-context';
import { useTenantSlug } from '../lib/tenant-context';
import { API_BASE } from '../lib/api';
import { useDashboardStaleSignal } from '../lib/dashboard-refresh';
import { TABS, DEFAULT_TAB } from './dashboard-tabs';
import { isKidRole, isGrownUpRole, isFamilyAdminRole } from '@familyhub/shared';
import { ScreenFeedback } from '../components/ScreenFeedback';

// FHS-621: one menu door. The note under the label is what stops a parent
// having to open a page to find out whether it is the one they wanted.
function MenuDoor({
  testId,
  icon,
  label,
  note,
  onClick,
}: {
  testId: string;
  icon: React.ReactNode;
  label: string;
  note: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      role="menuitem"
      onClick={onClick}
      data-testid={testId}
      className="flex min-h-11 w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left transition-colors hover:bg-gray-100 focus:outline-none focus-visible:ring-4 focus-visible:ring-pastel-cyan"
    >
      <span className="shrink-0 text-gray-900">{icon}</span>
      <span className="min-w-0">
        <span className="block text-sm font-bold text-gray-900">{label}</span>
        <span className="block text-xs font-bold text-gray-500">{note}</span>
      </span>
    </button>
  );
}

// In-app tab badge counts: typed map so wiring is in place for FHS-262.
type TabBadgeMap = Partial<Record<(typeof TABS)[number]['id'], number>>;

interface MeResponseTenant {
  id: string;
  slug: string;
  name: string;
  role: string;
}

// Family-initial avatar that opens the brand area. Picks a deterministic
// gradient out of a small palette so the same family always lands on
// the same colours across reloads.
function FamilyInitialDisc({ name }: { name: string }) {
  const initial = name.trim().charAt(0).toUpperCase() || 'F';
  const palette = [
    'from-pink-400 to-purple-500',
    'from-amber-400 to-pink-500',
    'from-cyan-400 to-blue-500',
    'from-emerald-400 to-cyan-500',
    'from-violet-400 to-fuchsia-500',
  ];
  const idx = [...name].reduce((acc, c) => acc + c.charCodeAt(0), 0) % palette.length;
  return (
    <span
      aria-hidden="true"
      data-testid="dashboard-family-initial"
      className={`grid h-12 w-12 place-items-center rounded-full border-2 border-black bg-gradient-to-br ${palette[idx]} font-display text-2xl font-black text-white shadow-neo-sm`}
    >
      {initial}
    </span>
  );
}

// Build the hero title from the tenant's stored name. Always appends
// "Family Hub" branding but skips the append when the name already ends
// in "Family" or "Family Hub" to avoid "KHAN FAMILY FAMILY HUB".
function buildHeroTitle(name: string | null): string {
  const base = (name ?? 'Family').trim();
  if (/family\s*hub$/i.test(base)) return base;
  if (/family$/i.test(base)) return `${base} Hub`;
  return `${base} Family Hub`;
}

function FamilyHero({
  familyName,
  memberCount,
  loading,
}: {
  familyName: string | null;
  memberCount: number | null;
  loading: boolean;
}) {
  if (loading) {
    return (
      <div className="flex items-center gap-3" data-testid="dashboard-family-hero-loading">
        <span className="h-10 w-10 rounded-full bg-white/10" />
        <span className="h-5 w-32 rounded bg-white/10" />
      </div>
    );
  }
  return (
    <div className="flex min-w-0 items-center gap-4" data-testid="dashboard-family-hero">
      <FamilyInitialDisc name={familyName ?? 'Family'} />
      <div className="flex min-w-0 flex-col">
        {/* FHR-24: a long name wraps to two lines at most, then ends in "...". */}
        <h1 className="flex min-w-0 items-center gap-1.5 font-heading text-2xl uppercase leading-tight tracking-wide text-white drop-shadow-md md:text-3xl">
          <span
            className="line-clamp-2 min-w-0 [overflow-wrap:anywhere]"
            title={buildHeroTitle(familyName)}
            data-testid="dashboard-family-name"
          >
            {buildHeroTitle(familyName)}
          </span>
          <span aria-hidden="true" className="text-yellow-300">
            ✨
          </span>
        </h1>
        {memberCount !== null && memberCount > 0 && (
          <span
            className="mt-1 flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-pink-300"
            data-testid="dashboard-members-active"
          >
            <span
              aria-hidden="true"
              className="inline-block h-2.5 w-2.5 animate-pulse rounded-full border border-black bg-green-400"
            />
            {memberCount} {memberCount === 1 ? 'member' : 'members'} active
          </span>
        )}
      </div>
    </div>
  );
}

// Children in the dropdown get coloured initial discs (MP cycles
// yellow/purple). Same order = same colour across reloads.
const CHILD_DISC_COLORS = ['bg-yellow-300', 'bg-purple-300', 'bg-pink-300', 'bg-cyan-300'];

// FHS-485 / ADR 0019: the caller's own role line in the profile menu.
// This used to be hardcoded "Parent · Admin" for everyone, which is wrong
// for an adult/teen/guest (only `admin` is the parent/partner with full
// rights). Read the caller's real role and label it to match the matrix.
const ROLE_PILL_LABEL: Record<string, string> = {
  admin: 'Parent · Admin',
  adult: 'Adult',
  teen: 'Teen',
  guest: 'Guest',
  child: 'Child',
};

// FHS-523: exported so the child-world header (ChildWorldPage) renders the
// same account pill as the parent dashboard, matching the design.
export function ProfilePill({
  parentName,
  role,
  childMembers,
  onManageMembers,
  onRewardSettings,
  onKidsMoney,
  onFamilySettings,
  onLogout,
  onSelectChild,
  activeChildId,
  signingOut,
  slug,
}: {
  parentName: string;
  role: string | null;
  // Only id + displayName are read here (the "View World" links), so accept the
  // minimal shape: both the dashboard roster and the child-world roster fit.
  childMembers: Array<{ id: string; displayName: string }>;
  onManageMembers: () => void;
  onRewardSettings: () => void;
  onKidsMoney: () => void;
  onFamilySettings: () => void;
  onLogout: () => void;
  // FHS-523: when provided, "View World" switches child via this handler
  // (in-app SPA nav). Without it, we hard-navigate (dashboard's default).
  onSelectChild?: (childId: string) => void;
  // FHS-585: the child whose world is on screen, so the menu can say which
  // one you are looking at. Left out on the family dashboard, where no
  // child's world is open and nothing should be marked.
  activeChildId?: string;
  signingOut: boolean;
  slug: string;
}) {
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement | null>(null);

  // FHS-625: which doors this person can actually walk through. `role` is null
  // until /api/me answers, and an unknown role gets nothing: showing a door and
  // taking it away reads worse than it arriving a moment late.
  const grownUp = isGrownUpRole(role);
  const familyAdmin = isFamilyAdminRole(role);

  // Close on outside click + Escape.
  useEffect(() => {
    if (!open) return;
    const onDocClick = (e: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    window.addEventListener('mousedown', onDocClick);
    window.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('mousedown', onDocClick);
      window.removeEventListener('keydown', onKey);
    };
  }, [open]);

  const initial = [...parentName.trim()][0]?.toUpperCase() ?? '?';
  const firstName = parentName.trim().split(/\s+/)[0] ?? parentName;

  return (
    <div ref={wrapRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="menu"
        aria-expanded={open}
        data-testid="dashboard-profile-pill"
        className={`flex items-center gap-3 rounded-full border-2 border-black py-1.5 pl-1.5 pr-4 text-sm font-bold text-white shadow-neo-xs transition-colors hover:bg-[#5a1d8a] focus:outline-none focus-visible:ring-4 focus-visible:ring-yellow-400 ${open ? 'bg-[#5a1d8a]' : 'bg-[#4a1578]'}`}
      >
        <span
          aria-hidden="true"
          className="flex h-8 w-8 items-center justify-center rounded-full border-2 border-black bg-pink-300 font-heading text-lg text-black"
        >
          {initial}
        </span>
        <span className="max-w-[120px] truncate uppercase tracking-wide sm:max-w-[180px]">
          {firstName}
        </span>
        <ChevronDown
          size={14}
          strokeWidth={3}
          aria-hidden="true"
          className={`transition-transform ${open ? 'rotate-180' : ''}`}
        />
      </button>
      {open && (
        <div
          role="menu"
          aria-label="Profile menu"
          data-testid="dashboard-profile-menu"
          className="absolute right-0 z-40 mt-2 w-64 overflow-hidden rounded-xl border-2 border-black bg-white text-gray-900 shadow-neo-md"
        >
          <div className="border-b-2 border-black bg-pink-50 px-4 py-3">
            <div className="flex items-center gap-3">
              <span
                aria-hidden="true"
                className="flex h-10 w-10 items-center justify-center rounded-full border-2 border-black bg-pink-300 font-heading text-xl"
              >
                {initial}
              </span>
              <div className="min-w-0">
                <p
                  className="truncate font-heading text-sm uppercase tracking-wide"
                  data-testid="dashboard-profile-parent-name"
                >
                  {parentName}
                </p>
                <p
                  className="text-[10px] font-bold uppercase tracking-widest text-gray-500"
                  data-testid="dashboard-profile-role"
                >
                  {ROLE_PILL_LABEL[role ?? ''] ?? 'Member'}
                </p>
              </div>
            </div>
          </div>
          {/* FHS-471: the "+" always shows here (even with zero children)
              since that's exactly when a tester most wants to add the
              family's first member; the dropdown was previously read as
              "my profile" with no obvious add-member control. */}
          <div className="px-3 py-2">
            <p className="mb-2 px-1 text-[10px] font-bold uppercase tracking-widest text-gray-400">
              Children
            </p>
            {childMembers.length > 0 ? (
              <ul>
                {childMembers.map((c, i) => {
                  // FHS-585: every row used to read "View World", including
                  // the world already on screen, so with two children a
                  // parent had to remember which one they opened.
                  const viewing = c.id === activeChildId;
                  return (
                    <li key={c.id}>
                      <button
                        type="button"
                        role="menuitem"
                        aria-current={viewing ? 'true' : undefined}
                        onClick={() => {
                          setOpen(false);
                          // Already here: closing the menu is the whole job.
                          if (viewing) return;
                          if (onSelectChild) onSelectChild(c.id);
                          else window.location.assign(`/t/${slug}/child/${c.id}`);
                        }}
                        data-testid={`dashboard-profile-child-${c.id}`}
                        className={`group flex min-h-11 w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left transition-colors ${
                          viewing
                            ? 'bg-purple-100 ring-2 ring-inset ring-purple-700'
                            : 'hover:bg-gray-100'
                        }`}
                      >
                        <span
                          aria-hidden="true"
                          className={`flex h-8 w-8 items-center justify-center rounded-full border-2 border-black font-heading text-sm ${CHILD_DISC_COLORS[i % CHILD_DISC_COLORS.length]}`}
                        >
                          {[...c.displayName.trim()][0]?.toUpperCase() ?? '?'}
                        </span>
                        <span className="truncate text-sm font-bold">{c.displayName}</span>
                        <span
                          aria-hidden="true"
                          data-testid={`dashboard-profile-child-${c.id}-state`}
                          className={`ml-auto shrink-0 text-[10px] font-bold uppercase tracking-wider ${
                            viewing
                              ? 'text-purple-800'
                              : 'text-gray-400 group-hover:text-purple-600'
                          }`}
                        >
                          {viewing ? 'Viewing ✓' : 'View World →'}
                        </span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            ) : (
              <button
                type="button"
                role="menuitem"
                onClick={() => {
                  setOpen(false);
                  onManageMembers();
                }}
                data-testid="dashboard-profile-add-first-child"
                className="flex min-h-11 w-full items-center gap-3 rounded-lg border-2 border-dashed border-gray-300 px-3 py-3 text-left transition-colors hover:border-black hover:bg-gray-50"
              >
                <span
                  aria-hidden="true"
                  className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border-2 border-black bg-yellow-300 text-base"
                >
                  👋
                </span>
                <span className="min-w-0">
                  <span className="block text-sm font-bold">No kids added yet</span>
                  <span className="text-xs font-bold text-gray-500">Add your first child</span>
                </span>
              </button>
            )}
          </div>
          {grownUp && (
            <div className="space-y-2 border-t-2 border-black px-3 pb-3 pt-3">
              {/* FHS-621: one door per job, in the order a parent needs them,
                  each saying what is behind it so nobody has to guess.
                  FHS-625: and only if the person can actually use what is
                  behind it. An adult can move money and set a kid's PIN, so
                  they keep the first three doors; every control behind Family
                  settings is admin-only, so that door is not offered to them. */}
              {grownUp && (
                <MenuDoor
                  testId="dashboard-profile-kids-money"
                  icon={<Wallet size={16} strokeWidth={3} aria-hidden="true" />}
                  label="Kids money"
                  note="Balances and week history"
                  onClick={() => {
                    setOpen(false);
                    onKidsMoney();
                  }}
                />
              )}
              {grownUp && (
                <MenuDoor
                  testId="dashboard-profile-reward-settings"
                  icon={<Sliders size={16} strokeWidth={3} aria-hidden="true" />}
                  label="Earning rules"
                  note="What a sticker is worth"
                  onClick={() => {
                    setOpen(false);
                    onRewardSettings();
                  }}
                />
              )}
              {grownUp && (
                <MenuDoor
                  testId="dashboard-profile-manage-members"
                  icon={<Users size={16} strokeWidth={3} aria-hidden="true" />}
                  label="Manage family"
                  note="Grown-ups and kids"
                  onClick={() => {
                    setOpen(false);
                    onManageMembers();
                  }}
                />
              )}
              {familyAdmin && (
                <MenuDoor
                  testId="dashboard-profile-family-settings"
                  icon={<Settings size={16} strokeWidth={3} aria-hidden="true" />}
                  label="Family settings"
                  note="Name, currency, your data"
                  onClick={() => {
                    setOpen(false);
                    onFamilySettings();
                  }}
                />
              )}
            </div>
          )}
          {/* FHS-520 (design-fidelity): Log out now lives at the bottom of
              this dropdown (not a separate top-nav button) to match the
              Magic Patterns mock. */}
          <div className="border-t-2 border-black bg-gray-50 p-3">
            <button
              type="button"
              role="menuitem"
              onClick={() => {
                setOpen(false);
                onLogout();
              }}
              disabled={signingOut}
              data-testid="dashboard-logout"
              className="flex min-h-[48px] w-full items-center justify-center gap-2 rounded-xl border-2 border-black bg-red-500 font-heading text-base text-white shadow-neo-xs transition-transform hover:bg-red-600 disabled:opacity-50 motion-safe:hover:-translate-y-0.5"
            >
              <LogOut size={16} strokeWidth={3} aria-hidden="true" />
              {signingOut ? 'Signing out…' : 'Log out'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ── AppHeader ─────────────────────────────────────────────────────────────────

export interface AppHeaderProps {
  /** Which tab to highlight in the nav. Pass null when no tab is active. */
  activeTab: string | null;
  /** Called with the tab id when the user clicks a nav tab. */
  onTabChange: (tabId: string) => void;
}

export function AppHeader({ activeTab, onTabChange }: AppHeaderProps) {
  const { user, session } = useAuth();
  const slug = useTenantSlug();
  const navigate = useNavigate();

  const [familyName, setFamilyName] = useState<string | null>(null);
  const [callerRole, setCallerRole] = useState<string | null>(null);
  const [callerName, setCallerName] = useState<string | null>(null);
  const [members, setMembers] = useState<DashboardMember[] | null>(null);
  const [openTasks, setOpenTasks] = useState<number>(0);
  const [headerLoading, setHeaderLoading] = useState(true);
  const [signingOut, setSigningOut] = useState(false);

  // Hydrate family name + member roster once on mount.
  useEffect(() => {
    if (!session) return;
    let cancelled = false;
    const headers = { Authorization: `Bearer ${session.access_token}` };
    Promise.all([
      fetch(`${API_BASE}/api/me`, { headers })
        .then((r) => (r.ok ? r.json() : null))
        .catch(() => null),
      fetch(`${API_BASE}/api/dashboard/today`, {
        headers: { ...headers, 'x-tenant-slug': slug },
      })
        .then((r) => (r.ok ? r.json() : null))
        .catch(() => null),
    ]).then(([me, today]) => {
      if (cancelled) return;
      const tenant =
        me && Array.isArray(me.tenants)
          ? (me.tenants as MeResponseTenant[]).find((t) => t.slug === slug)
          : undefined;
      if (tenant) {
        setFamilyName(tenant.name);
        setCallerRole(tenant.role);
      }
      if (today && Array.isArray(today.members)) {
        const roster = today.members as DashboardMember[];
        setMembers(roster);
        const caller = roster.find((m) => m.id === (today.callerMemberId as string | undefined));
        setOpenTasks(caller?.tasksPending ?? 0);
        setCallerName(caller?.displayName?.trim() || null);
      }
      setHeaderLoading(false);
    });
    return () => {
      cancelled = true;
    };
  }, [session, slug]);

  // FHS-309: refresh badge counts when a task/notice mutation elsewhere
  // fires the dashboard-stale signal so the badge updates live.
  // FHS-312: two signals firing close together used to race two fetches
  // with no guarantee the newer one lands last, so a stale response could
  // overwrite fresh badge counts. Aborting the previous in-flight fetch
  // before starting a new one makes "last request wins" instead of
  // "last response wins".
  const refreshTodayAbortRef = useRef<AbortController | null>(null);
  const refreshToday = useCallback(() => {
    if (!session) return;
    refreshTodayAbortRef.current?.abort();
    const controller = new AbortController();
    refreshTodayAbortRef.current = controller;
    fetch(`${API_BASE}/api/dashboard/today`, {
      headers: { Authorization: `Bearer ${session.access_token}`, 'x-tenant-slug': slug },
      signal: controller.signal,
    })
      .then((r) => (r.ok ? r.json() : null))
      .then((today) => {
        if (today && Array.isArray(today.members)) {
          const roster = today.members as DashboardMember[];
          setMembers(roster);
          const caller = roster.find((m) => m.id === (today.callerMemberId as string | undefined));
          setOpenTasks(caller?.tasksPending ?? 0);
          setCallerName(caller?.displayName?.trim() || null);
        }
      })
      .catch(() => {});
  }, [session, slug]);
  useDashboardStaleSignal(refreshToday);
  // Abort any in-flight refresh when the header unmounts.
  useEffect(() => {
    return () => {
      refreshTodayAbortRef.current?.abort();
    };
  }, []);

  const onLogout = useCallback(async () => {
    setSigningOut(true);
    const { error } = await signOutAll();
    if (error) {
      console.error('signOut failed', error);
      setSigningOut(false);
      return;
    }
    navigate('/', { replace: true });
  }, [navigate]);

  const onManageMembers = useCallback(() => {
    navigate(`/t/${slug}/members`);
  }, [navigate, slug]);

  const onRewardSettings = useCallback(() => {
    navigate(`/t/${slug}/reward-settings`);
  }, [navigate, slug]);

  // FHS-621: the Admin Panel's two halves, each with its own door.
  const onKidsMoney = useCallback(() => {
    navigate(`/t/${slug}/money`);
  }, [navigate, slug]);

  const onFamilySettings = useCallback(() => {
    navigate(`/t/${slug}/family-settings`);
  }, [navigate, slug]);

  // FHS-506: prefer the caller's roster display name (the name shown on their
  // member card) over the auth email. Magic-link signups often carry no
  // full_name, so the email used to leak into the account menu.
  const parentName =
    // FHR-27: the name saved in the family comes first; the Google name is
    // only a fallback, so signing in again cannot replace a name you chose.
    callerName ??
    (user?.user_metadata?.full_name as string | undefined) ??
    (user?.user_metadata?.name as string | undefined) ??
    user?.email ??
    'You';

  // FHS-569: this filtered on 'child' alone, so a family whose only kid
  // was a teen saw "No kids added yet" while that teen showed on the
  // dashboard behind the menu.
  const childMembers = (members ?? []).filter((m) => isKidRole(m.role));

  const tabBadges: TabBadgeMap = { tasks: openTasks };
  const navTabs: TopNavTab[] = TABS.map((t) => ({
    id: t.id,
    label: t.label,
    icon: t.icon,
    badge: tabBadges[t.id] ?? 0,
  }));

  return (
    <TopNav
      brand={
        <button
          type="button"
          onClick={() => onTabChange(DEFAULT_TAB)}
          aria-label="Go to Family Dashboard"
          data-testid="dashboard-brand-home"
          className="text-left transition-opacity hover:opacity-90 focus:outline-none focus-visible:ring-2 focus-visible:ring-yellow-400"
        >
          <FamilyHero
            familyName={familyName}
            memberCount={members?.length ?? null}
            loading={headerLoading}
          />
        </button>
      }
      tabs={navTabs}
      activeTab={activeTab ?? ''}
      onTabChange={onTabChange}
      rightSlot={
        <div className="flex items-center gap-2">
          {/* FHS-670: the screen comes from the URL; it hides itself for kids. */}
          <ScreenFeedback role={callerRole} />
          <ProfilePill
            parentName={parentName}
            role={callerRole}
            childMembers={childMembers}
            onManageMembers={onManageMembers}
            onRewardSettings={onRewardSettings}
            onKidsMoney={onKidsMoney}
            onFamilySettings={onFamilySettings}
            onLogout={() => void onLogout()}
            signingOut={signingOut}
            slug={slug}
          />
        </div>
      }
      testId="dashboard-nav"
    />
  );
}
