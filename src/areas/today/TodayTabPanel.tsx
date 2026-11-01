import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Activity,
  ArrowRight,
  CheckCircle2,
  CheckSquare,
  Flame,
  Star,
  Target,
  Users,
  Utensils,
} from 'lucide-react';
import type {
  DashboardActivity,
  DashboardGoal,
  DashboardMember,
  DashboardTodayResponse,
} from '@familyhub/shared';
import { roleStyle } from '@familyhub/ui';
import { useAuth } from '../../app/lib/auth-context';
import { useTenantSlug } from '../../app/lib/tenant-context';
import { API_BASE } from '../../app/lib/api';
import { isKidRole } from '@familyhub/shared';

// FHS-263 (exact Magic Patterns match): Today / Family Dashboard tab.
//
// One GET /api/dashboard/today feeds: a full-width Family Overview grid
// (4-up member cards: kids show a habit bar + streak + "View World"
// link, adults show pending tasks + a status box), then a two-column
// row of Today's Snapshot (three round-icon stat tiles) and the purple
// Family Goals card (top goal bar + Kids' Star Balances) above the
// Recent Activity feed.
//
// FHS-513: role → colour/label map now lives in @familyhub/ui
// (`roleStyle`) so it isn't duplicated between here and MembersPage.

type Status =
  | { kind: 'loading' }
  | { kind: 'ready'; data: DashboardTodayResponse }
  | { kind: 'error'; message: string };

function goalPercent(goal: DashboardGoal): number | null {
  if (goal.target === null || goal.target <= 0) return null;
  return Math.max(0, Math.min(100, Math.round((goal.progress / goal.target) * 100)));
}

// "Thursday, Jun 11" anchored in UTC so the server date doesn't shift.
function formatDate(iso: string): string {
  const [y, m, d] = iso.split('-').map((s) => Number.parseInt(s, 10));
  if (!y || !m || !d) return iso;
  return new Date(Date.UTC(y, m - 1, d)).toLocaleDateString(undefined, {
    weekday: 'long',
    month: 'short',
    day: 'numeric',
    timeZone: 'UTC',
  });
}

function timeAgo(iso: string, now: Date = new Date()): string {
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return '';
  const secs = Math.max(0, Math.round((now.getTime() - then) / 1000));
  if (secs < 60) return 'just now';
  const mins = Math.round(secs / 60);
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.round(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  return days <= 1 ? 'yesterday' : `${days}d ago`;
}

export function TodayTabPanel() {
  const slug = useTenantSlug();
  const { session } = useAuth();
  const [status, setStatus] = useState<Status>({ kind: 'loading' });

  useEffect(() => {
    if (!session) return;
    let cancelled = false;
    const ac = new AbortController();
    (async () => {
      try {
        const res = await fetch(`${API_BASE}/api/dashboard/today`, {
          headers: { Authorization: `Bearer ${session.access_token}`, 'x-tenant-slug': slug },
          signal: ac.signal,
        });
        if (cancelled) return;
        if (!res.ok) {
          setStatus({
            kind: 'error',
            message: `Couldn't load your dashboard (server ${res.status})`,
          });
          return;
        }
        const data = (await res.json()) as DashboardTodayResponse;
        if (!cancelled) setStatus({ kind: 'ready', data });
      } catch (err) {
        if (cancelled || (err instanceof Error && err.name === 'AbortError')) return;
        setStatus({
          kind: 'error',
          message: err instanceof Error ? err.message : 'Network error.',
        });
      }
    })();
    return () => {
      cancelled = true;
      ac.abort();
    };
  }, [session, slug]);

  if (status.kind === 'loading') {
    return (
      <p data-testid="today-loading" className="font-bold text-purple-200" aria-busy="true">
        Loading your family hub…
      </p>
    );
  }
  if (status.kind === 'error') {
    return (
      <p data-testid="today-error" role="alert" className="font-bold text-red-300">
        {status.message}
      </p>
    );
  }

  const { date, members, counts, goals, recentActivity } = status.data;
  const kids = members.filter((m) => isKidRole(m.role));
  const kidsHabitsDone = kids.reduce((s, m) => s + m.habitsDone, 0);
  const kidsHabitsTotal = kids.reduce((s, m) => s + m.habitsTotal, 0);
  const topGoal = goals[0] ?? null;

  return (
    <div className="space-y-8" data-testid="today-ready">
      {/* Family Overview */}
      <section>
        {/* FHS-520 (design-fidelity): the Family Overview header button
            links to the full Manage Family screen (Grown-ups/Kids groups,
            invite + add-child forms live there); it no longer deep-links
            straight into the add-child form via ?add=member (that query
            param still works for any other entry point that sets it). */}
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <h2 className="font-heading text-2xl tracking-wide text-white">Family Overview</h2>
          <Link
            to={`/t/${slug}/members`}
            data-testid="today-add-member"
            className="flex min-h-[44px] items-center gap-1.5 rounded-lg border-2 border-black bg-yellow-300 px-4 py-2.5 font-bold text-black shadow-neo-xs transition-all hover:bg-yellow-400 motion-safe:hover:-translate-y-0.5"
          >
            Manage family <Users size={18} strokeWidth={3} aria-hidden="true" />
          </Link>
        </div>
        {members.length === 0 ? (
          <p data-testid="today-members-empty" className="font-bold text-purple-200">
            No family members yet.
          </p>
        ) : (
          <ul className="grid list-none grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {members.map((member, i) => (
              <MemberCard key={member.id} slug={slug} member={member} index={i} />
            ))}
          </ul>
        )}
      </section>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Today's Snapshot */}
        <section>
          <div className="mb-4 flex items-end justify-between">
            <h2 className="font-heading text-2xl tracking-wide text-white">
              Today&rsquo;s Snapshot
            </h2>
            <span className="text-sm font-bold text-purple-200">{formatDate(date)}</span>
          </div>
          <div className="grid grid-cols-3 gap-2 sm:gap-3">
            <SnapshotTile
              testId="today-snapshot-habits"
              icon={<CheckSquare size={18} className="text-pink-600" />}
              ring="bg-pink-100"
              value={kids.length === 0 ? '-' : `${kidsHabitsDone}/${kidsHabitsTotal}`}
              label="Kids Habits"
            />
            <SnapshotTile
              testId="today-snapshot-tasks"
              icon={<CheckCircle2 size={18} className="text-yellow-600" />}
              ring="bg-yellow-100"
              value={`${counts.tasksDoneToday}/${counts.tasksTotalToday}`}
              label="Tasks Done"
            />
            <SnapshotTile
              testId="today-snapshot-meals"
              icon={<Utensils size={18} className="text-cyan-600" />}
              ring="bg-cyan-100"
              value={`${counts.mealsPlanned}/3`}
              label="Meals Planned"
            />
          </div>
        </section>

        {/* Family Goals + Recent Activity */}
        <div className="space-y-6">
          <div className="rounded-xl border-2 border-black bg-[#6b21a8] p-5 text-white shadow-neo-sm">
            <h3 className="mb-5 flex items-center gap-2 font-heading text-xl">
              <Target size={20} className="text-yellow-300" /> Family Goals
            </h3>
            {topGoal ? (
              <div className="mb-6" data-testid="today-goal-0">
                <div className="mb-2 flex items-end justify-between">
                  <span className="text-sm font-bold">{topGoal.label}</span>
                  <span className="font-heading text-yellow-300">
                    {goalPercent(topGoal) === null ? '-' : `${goalPercent(topGoal)}%`}
                  </span>
                </div>
                <div className="h-3 w-full overflow-hidden rounded-full border-2 border-black bg-purple-900">
                  <div
                    className="h-full border-r-2 border-black bg-green-400"
                    style={{ width: `${goalPercent(topGoal) ?? 0}%` }}
                  />
                </div>
              </div>
            ) : (
              <p data-testid="today-goals-empty" className="mb-6 text-sm font-bold text-purple-200">
                No family goals yet.
              </p>
            )}
            <div className="border-t-2 border-purple-800 pt-4">
              <p className="mb-3 text-xs font-bold uppercase tracking-wider text-purple-300">
                Kids&rsquo; Star Balances
              </p>
              {kids.length === 0 ? (
                <p data-testid="today-stars-empty" className="text-sm font-bold text-purple-200">
                  No kids yet.
                </p>
              ) : (
                <div className="flex flex-wrap gap-3">
                  {kids.map((kid) => (
                    <div
                      key={kid.id}
                      data-testid={`today-star-${kid.id}`}
                      className="flex min-w-[8rem] flex-1 items-center justify-between rounded-lg border-2 border-black bg-white p-2 text-black shadow-neo-xs"
                    >
                      <span className="truncate text-sm font-bold">{kid.displayName}</span>
                      <span className="flex items-center gap-1 rounded-full border-2 border-black bg-yellow-200 px-2 py-0.5 text-xs font-bold">
                        <Star size={10} className="fill-yellow-500 text-yellow-600" />{' '}
                        {kid.starBalance}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          <div className="rounded-xl border-2 border-black bg-gray-50 p-5 shadow-neo-sm">
            <h3 className="mb-4 flex items-center gap-2 font-heading text-lg text-black">
              <Activity size={18} /> Recent Activity
            </h3>
            {recentActivity.length === 0 ? (
              <p data-testid="today-activity-empty" className="text-sm font-bold text-gray-500">
                Nothing yet. Activity shows up here.
              </p>
            ) : (
              <ul className="space-y-4">
                {recentActivity.map((entry, i) => (
                  <ActivityRow key={entry.id} entry={entry} index={i} />
                ))}
              </ul>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function MemberCard({
  slug,
  member,
  index,
}: {
  slug: string;
  member: DashboardMember;
  index: number;
}) {
  const rs = roleStyle(member.role);
  const young = isKidRole(member.role);
  const habitPct =
    member.habitsTotal > 0 ? Math.round((member.habitsDone / member.habitsTotal) * 100) : 0;

  const inner = (
    <div className="flex h-full flex-col rounded-xl border-2 border-black bg-white p-5">
      <div className="mb-4 flex items-start justify-between">
        <div className="flex items-center gap-3">
          <div
            aria-hidden="true"
            className={`flex h-12 w-12 items-center justify-center rounded-full border-2 border-black font-heading text-xl shadow-neo-xs ${rs.disc}`}
          >
            {[...member.displayName.trim()][0]?.toUpperCase() ?? '?'}
          </div>
          <div>
            <h3
              className="font-heading text-lg leading-none"
              data-testid={`today-member-${index}-name`}
            >
              {member.displayName}
            </h3>
            <span
              data-testid={`today-member-${index}-role`}
              className={`mt-1 inline-block rounded-full border-2 border-black px-2 py-0.5 text-[10px] font-bold ${rs.badge}`}
            >
              {rs.label}
            </span>
          </div>
        </div>
        {young && (
          <span className="flex shrink-0 items-center gap-1 rounded-full border-2 border-black bg-purple-300 px-3 py-1.5 text-[11px] font-bold uppercase tracking-wide text-purple-900 shadow-neo-xs">
            View World <ArrowRight size={12} strokeWidth={3} />
          </span>
        )}
      </div>

      {member.pendingSignup && (
        <span
          data-testid={`today-member-${index}-pending`}
          className="mb-3 inline-flex w-fit items-center gap-1.5 rounded-md border-2 border-yellow-400 bg-yellow-50 px-2 py-1 text-[10px] font-bold text-yellow-800"
        >
          <span aria-hidden="true" className="h-2 w-2 animate-pulse rounded-full bg-yellow-500" />
          Pending: hasn&rsquo;t signed up
        </span>
      )}

      <div className="mt-auto">
        {young ? (
          <div className="space-y-2">
            <div className="flex items-end justify-between text-sm font-bold">
              <span className="text-gray-500">Today&rsquo;s Habits</span>
              <span>
                {member.habitsDone}/{member.habitsTotal}
              </span>
            </div>
            <div
              className="h-2.5 w-full overflow-hidden rounded-full border-2 border-black bg-gray-100"
              {...(member.habitsTotal > 0
                ? {
                    role: 'progressbar',
                    'aria-label': `${member.displayName}: ${member.habitsDone} of ${member.habitsTotal} habits done`,
                    'aria-valuenow': member.habitsDone,
                    'aria-valuemin': 0,
                    'aria-valuemax': member.habitsTotal,
                  }
                : { 'aria-label': `${member.displayName}: no habits assigned` })}
            >
              <div
                className="h-full border-r-2 border-black bg-green-400"
                style={{ width: `${habitPct}%` }}
              />
            </div>
            {member.streak > 0 && (
              <div
                data-testid={`today-member-${index}-streak`}
                className="flex items-center gap-1 pt-1 text-xs font-bold text-orange-500"
              >
                <Flame size={12} className="fill-orange-500" /> {member.streak} week streak
              </div>
            )}
          </div>
        ) : (
          <div className="space-y-3 border-t-2 border-dashed border-gray-200 pt-2">
            <div className="flex items-center justify-between">
              <span className="flex items-center gap-1 text-sm font-bold text-gray-500">
                <CheckSquare size={14} /> Pending Tasks
              </span>
              <span className="font-heading text-lg" data-testid={`today-member-${index}-tasks`}>
                {member.tasksPending}
              </span>
            </div>
            <div className="rounded-lg border-2 border-black bg-gray-50 p-2 shadow-neo-xs">
              <p
                data-testid={`today-member-${index}-status`}
                className="flex min-w-0 items-center gap-1 text-xs font-bold text-gray-600"
              >
                <Activity size={12} className="shrink-0" />
                <span className="truncate">{member.statusText}</span>
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );

  if (young) {
    return (
      <li className="block list-none" data-testid={`today-member-${index}`}>
        <Link
          to={`/t/${slug}/child/${member.id}`}
          data-testid={`today-member-${index}-link`}
          className="block h-full rounded-xl shadow-neo-sm transition-transform focus:outline-none focus-visible:ring-2 focus-visible:ring-white motion-safe:hover:-translate-y-1 motion-safe:hover:shadow-neo-lg"
        >
          {inner}
        </Link>
      </li>
    );
  }
  return (
    <li className="h-full list-none rounded-xl shadow-neo-sm" data-testid={`today-member-${index}`}>
      {inner}
    </li>
  );
}

function SnapshotTile({
  testId,
  icon,
  ring,
  value,
  label,
}: {
  testId: string;
  icon: React.ReactNode;
  ring: string;
  value: string;
  label: string;
}) {
  return (
    <div
      data-testid={testId}
      className="flex min-w-0 flex-col items-center rounded-xl border-2 border-black bg-white p-4 text-center shadow-neo-sm"
    >
      <span
        aria-hidden="true"
        className={`mb-2 flex h-10 w-10 items-center justify-center rounded-full border-2 border-black ${ring}`}
      >
        {icon}
      </span>
      <span className="font-heading text-xl text-black sm:text-2xl">{value}</span>
      <span className="mt-1 text-[10px] font-bold uppercase tracking-wider text-gray-500">
        {label}
      </span>
    </div>
  );
}

function ActivityRow({ entry, index }: { entry: DashboardActivity; index: number }) {
  const ago = timeAgo(entry.timestamp);
  return (
    <li className="flex items-start gap-3" data-testid={`today-activity-${index}`}>
      <span
        className="mt-0.5 rounded-full border border-gray-200 bg-white p-1 shadow-sm"
        aria-hidden="true"
      >
        <CheckCircle2 size={14} className="text-green-600" />
      </span>
      <div className="min-w-0">
        <p className="text-sm font-bold leading-tight text-black">
          {entry.actor ? `${entry.actor} ` : ''}
          {entry.action}
        </p>
        {ago && <p className="mt-0.5 text-[10px] font-bold text-gray-400">{ago}</p>}
      </div>
    </li>
  );
}
