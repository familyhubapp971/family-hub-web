import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, CalendarDays, GraduationCap, Home, PenLine, Utensils } from 'lucide-react';
import { TopNav, type TopNavTab } from '@familyhub/ui';
import { isGrownUpRole, isFamilyAdminRole } from '@familyhub/shared';
import { useAuth, signOutAll } from '../../app/lib/auth-context';
import { useTenantSlug } from '../../app/lib/tenant-context';
import { API_BASE } from '../../app/lib/api';
import { ProfilePill } from '../../app/layout/AppHeader';
import { ScreenFeedback } from '../../app/components/ScreenFeedback';
import { MyWorldTab } from '../my-world/MyWorldTab';
import { MealsTab } from '../meals/MealsTab';
import { CalendarTab } from '../calendar/CalendarTab';
import { JournalTab } from '../journal/JournalTab';
import { ChildLearningInsights } from '../learn/ChildLearningInsights';

// FHS-268: ChildWorld shell.
//
// A friendly per-child surface at /t/:slug/child/:memberId, reached from
// the parent dashboard's "View World" links. Five tabs: My World (this
// ticket: habit tracker + rewards shop), then Meals + Calendar
// (FHS-269) and Journal + Learn (FHS-270) as placeholders for now.

interface ChildTab {
  id: string;
  label: string;
  icon: React.ReactNode;
}

const CHILD_TABS: ChildTab[] = [
  { id: 'world', label: 'My World', icon: <Home size={16} aria-hidden="true" /> },
  { id: 'meals', label: 'Meals', icon: <Utensils size={16} aria-hidden="true" /> },
  { id: 'calendar', label: 'Calendar', icon: <CalendarDays size={16} aria-hidden="true" /> },
  { id: 'journal', label: 'Journal', icon: <PenLine size={16} aria-hidden="true" /> },
  // FHS-401: Learning Insights moved from parent dashboard into each child's world view.
  {
    id: 'insights',
    label: 'Learning Insights',
    icon: <GraduationCap size={16} aria-hidden="true" />,
  },
];

const DEFAULT_TAB = 'world';

interface MemberLite {
  id: string;
  displayName: string;
  avatarEmoji: string | null;
  isChild: boolean;
}

export function ChildWorldPage() {
  const slug = useTenantSlug();
  const { memberId = '' } = useParams();
  const navigate = useNavigate();
  const { user, session } = useAuth();
  const [activeTab, setActiveTab] = useState<string>(DEFAULT_TAB);
  const [members, setMembers] = useState<MemberLite[]>([]);
  // FHS-336: the caller's role in this family (from /api/members), so My World
  // hides admin-only controls from a normal user. Null until loaded.
  const [callerRole, setCallerRole] = useState<string | null>(null);
  // FHS-523: the caller's own member id, so the account pill shows their roster
  // name rather than leaking their login email.
  const [callerMemberId, setCallerMemberId] = useState<string | null>(null);
  const [signingOut, setSigningOut] = useState(false);

  const headers = useMemo(
    () =>
      session ? { Authorization: `Bearer ${session.access_token}`, 'x-tenant-slug': slug } : null,
    [session, slug],
  );

  useEffect(() => {
    if (!headers) return;
    let cancelled = false;
    fetch(`${API_BASE}/api/members`, { headers })
      .then((r) => (r.ok ? r.json() : null))
      .then((body) => {
        if (cancelled || !body) return;
        setMembers(((body.members as MemberLite[]) ?? []).map((m) => ({ ...m })));
        setCallerRole(typeof body.callerRole === 'string' ? body.callerRole : null);
        setCallerMemberId(typeof body.callerMemberId === 'string' ? body.callerMemberId : null);
      })
      .catch(() => {
        /* leave members empty: header falls back to a generic greeting */
      });
    return () => {
      cancelled = true;
    };
  }, [headers]);

  const member = useMemo(() => members.find((m) => m.id === memberId) ?? null, [members, memberId]);
  // FHS-523: the family's children power the account pill's "View World" links
  // (the switcher), and the caller's own row supplies the pill's name.
  const childMembers = useMemo(() => members.filter((m) => m.isChild), [members]);
  const callerMember = useMemo(
    () => members.find((m) => m.id === callerMemberId) ?? null,
    [members, callerMemberId],
  );

  // FHS-506/FHS-523: prefer a real name over the login email: the auth
  // full_name, else the caller's roster display name, else email as last resort.
  const parentName =
    // FHR-27: the name saved in the family comes first; the Google name is
    // only a fallback, so signing in again cannot replace a name you chose.
    callerMember?.displayName ??
    (user?.user_metadata?.full_name as string | undefined) ??
    (user?.user_metadata?.name as string | undefined) ??
    user?.email ??
    'You';

  const onHome = useCallback(() => navigate(`/t/${slug}/dashboard`), [navigate, slug]);
  const onManageMembers = useCallback(() => navigate(`/t/${slug}/members`), [navigate, slug]);
  const onRewardSettings = useCallback(
    () => navigate(`/t/${slug}/reward-settings`),
    [navigate, slug],
  );
  // FHS-621: the Admin Panel's two halves have their own doors now.
  const onKidsMoney = useCallback(() => navigate(`/t/${slug}/money`), [navigate, slug]);
  const onFamilySettings = useCallback(
    () => navigate(`/t/${slug}/family-settings`),
    [navigate, slug],
  );
  const onLogout = useCallback(async () => {
    setSigningOut(true);
    const { error } = await signOutAll();
    if (error) {
      console.error('signOut failed', error);
      setSigningOut(false);
      return;
    }
    navigate('/login', { replace: true });
  }, [navigate]);

  // FHS-401: Learning Insights is parent/admin-only. A kid viewing their own
  // world sees the page but must not see (or be able to navigate to) the
  // Insights tab: the API returns 403 for child/teen tokens anyway, but we
  // should not surface the tab at all. Only admin and adult callers see it.
  const isParentCaller = isGrownUpRole(callerRole);
  const visibleTabs = CHILD_TABS.filter((t) => t.id !== 'insights' || isParentCaller);

  const navTabs: TopNavTab[] = visibleTabs.map((t) => ({
    id: t.id,
    label: t.label,
    icon: t.icon,
    badge: 0,
  }));
  const active = visibleTabs.find((t) => t.id === activeTab) ?? visibleTabs[0]!;
  const childName = member?.displayName ?? 'My';

  return (
    <div
      className="flex min-h-screen flex-col bg-kingdom-bg font-body text-gray-900"
      data-testid="child-world"
    >
      <TopNav
        brand={
          <div className="flex min-w-0 flex-col gap-2" data-testid="child-world-brand">
            {/* FHS-529: Row 1: breadcrumb "← Family Hub / {Child}'s World".
                "Family Hub" returns to the family dashboard. */}
            <nav
              aria-label="Breadcrumb"
              className="flex min-w-0 items-center gap-1.5 text-white/70"
            >
              <button
                type="button"
                onClick={onHome}
                data-testid="child-world-home"
                className="flex shrink-0 items-center gap-1 rounded font-heading text-xs uppercase tracking-wide transition-colors hover:text-white hover:underline focus:outline-none focus-visible:ring-2 focus-visible:ring-yellow-400 sm:text-sm"
              >
                <ArrowLeft size={14} strokeWidth={3} aria-hidden="true" />
                Family Hub
              </button>
              <span aria-hidden="true" className="shrink-0 text-white/40">
                /
              </span>
              <span className="min-w-0 truncate text-xs font-bold uppercase tracking-wide text-white/60 sm:text-sm">
                {childName === 'My' ? 'My World' : `${childName}'s World`}
              </span>
            </nav>
            {/* FHS-529: Row 2: hero: avatar disc + "{Child}'s Magical World ✨"
                + a "Magic Active" indicator. */}
            <div className="flex items-center gap-3">
              <span
                aria-hidden="true"
                className="grid h-11 w-11 shrink-0 place-items-center rounded-full border-2 border-black bg-yellow-300 font-heading text-xl text-black shadow-neo-sm sm:h-12 sm:w-12"
              >
                {member ? ([...member.displayName.trim()][0]?.toUpperCase() ?? '🌟') : '🌟'}
              </span>
              <div className="min-w-0">
                <h1
                  className="min-w-0 truncate font-heading text-xl uppercase tracking-wide text-white drop-shadow-md sm:text-2xl md:text-3xl"
                  data-testid="child-world-name"
                >
                  {childName === 'My' ? 'My World' : `${childName}'s Magical World ✨`}
                </h1>
                <p className="mt-0.5 flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-green-300">
                  <span
                    aria-hidden="true"
                    className="h-2.5 w-2.5 rounded-full border border-black bg-green-400 motion-safe:animate-pulse"
                  />
                  Magic Active
                </p>
              </div>
            </div>
          </div>
        }
        tabs={navTabs}
        activeTab={activeTab}
        onTabChange={setActiveTab}
        rightSlot={
          // FHS-523: the same account pill as the parent dashboard. Its
          // "View World" links switch between children (replacing the old
          // switcher) and its menu holds Manage family / Reward settings / Log
          // out (replacing the old Back + Logout buttons).
          <div className="flex items-center gap-2">
            {/* FHS-670: the tab is not in the URL, so pass it; it hides itself for kids. */}
            <ScreenFeedback role={callerRole} screenKey={`child-${active.id}`} />
            <ProfilePill
              parentName={parentName}
              role={callerRole}
              childMembers={childMembers}
              onManageMembers={onManageMembers}
              onRewardSettings={onRewardSettings}
              onKidsMoney={onKidsMoney}
              onFamilySettings={onFamilySettings}
              onLogout={() => void onLogout()}
              onSelectChild={(id) => navigate(`/t/${slug}/child/${id}`)}
              activeChildId={memberId}
              signingOut={signingOut}
              slug={slug}
            />
          </div>
        }
        testId="child-world-nav"
      />

      <main className="mx-auto w-full max-w-[1400px] flex-1 px-4 py-6 md:px-6">
        <section
          id={`child-panel-${active.id}`}
          role="tabpanel"
          aria-labelledby={`tab-${active.id}`}
          data-testid={`child-panel-${active.id}`}
        >
          {active.id === 'world' ? (
            <MyWorldTab
              memberId={memberId}
              isAdmin={isFamilyAdminRole(callerRole)}
              memberName={childName}
            />
          ) : active.id === 'meals' ? (
            <MealsTab memberId={memberId} />
          ) : active.id === 'calendar' ? (
            <CalendarTab memberId={memberId} />
          ) : active.id === 'insights' ? (
            // FHS-401: parent/admin view of this child's learning progress.
            <ChildLearningInsights memberId={memberId} />
          ) : (
            <JournalTab memberId={memberId} />
          )}
        </section>
      </main>
    </div>
  );
}
