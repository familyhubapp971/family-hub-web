import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  BookOpen,
  CalendarDays,
  ListChecks,
  LogOut,
  NotebookPen,
  Sparkles,
  UtensilsCrossed,
} from 'lucide-react';
import { TopNav, type TopNavTab } from '@familyhub/ui';
import { clearKidToken, getKidToken } from '../../app/lib/auth-context';
import { useTenantSlug } from '../../app/lib/tenant-context';
import { API_BASE } from '../../app/lib/api';
import { KidMyWorld } from '../my-world/kid/KidMyWorld';
import { KidMealsPanel } from '../meals/KidMealsPanel';
import { KidCalendarPanel } from '../calendar/KidCalendarPanel';
import { KidJournalPanel } from '../journal/KidJournalPanel';
import { KidLearnPanel } from '../learn/KidLearnPanel';

// FHS-257 / FHS-362: kid dashboard shell.
//
// A child who finishes kid-login lands here (the dashboard route admits a
// kid token via ProtectedRoute allowKid). It deliberately shows NONE of the
// parent surface: no profile pill, no Manage Members / Add member / admin
// links: just the kid's own avatar + name + banked stars/cash, the five-tab
// kid world (My World, Meals, Calendar, Journal, Learn) matching the Magic
// Patterns design, and a "Switch user" button that drops the kid token and
// returns to the avatar picker.
//
// FHS-362 ships the SHAPE: the MP header + tab nav. My World carries the
// kid's existing content (today's habits + tasks). The interactive
// habit grid + rewards land in FHS-363; Meals / Calendar / Journal / Learn
// are kid-scoped in FHS-364..367. The shell confirms the session via
// GET /api/kid/me and loads the header via GET /api/kid/profile.

interface KidTab {
  id: string;
  label: string;
  icon: React.ReactNode;
}

const KID_TABS: KidTab[] = [
  { id: 'world', label: 'My World', icon: <Sparkles size={16} aria-hidden="true" /> },
  { id: 'meals', label: 'Meals', icon: <UtensilsCrossed size={16} aria-hidden="true" /> },
  { id: 'calendar', label: 'Calendar', icon: <CalendarDays size={16} aria-hidden="true" /> },
  { id: 'journal', label: 'Journal', icon: <NotebookPen size={16} aria-hidden="true" /> },
  { id: 'learn', label: 'Learn', icon: <BookOpen size={16} aria-hidden="true" /> },
  { id: 'tasks', label: 'Tasks', icon: <ListChecks size={16} aria-hidden="true" /> },
];

const DEFAULT_TAB = 'world';

// FHS-362: the kid's header profile (name + avatar + banked stars/cash).
interface KidProfile {
  displayName: string;
  avatarEmoji: string | null;
  savedStickers: number;
  savedCash: number;
  currency: string;
}

// FHS-370: kid Tasks tab. The kid's own tasks (GET /api/kid/tasks), tickable
// via PATCH /api/kid/tasks/:id. Optimistic toggle with revert on failure.
interface KidTask {
  id: string;
  title: string;
  dueDate: string | null;
  done: boolean;
}
type KidTasksState = { kind: 'loading' } | { kind: 'error' } | { kind: 'loaded'; tasks: KidTask[] };

function KidTasksPanel({ kidToken }: { kidToken: string | null }) {
  const [state, setState] = useState<KidTasksState>({ kind: 'loading' });

  useEffect(() => {
    if (!kidToken) return;
    const ac = new AbortController();
    fetch(`${API_BASE}/api/kid/tasks`, {
      headers: { Authorization: `Bearer ${kidToken}` },
      signal: ac.signal,
    })
      .then(async (r) => {
        if (!r.ok) {
          setState({ kind: 'error' });
          return;
        }
        const body = (await r.json()) as { tasks: KidTask[] };
        setState({ kind: 'loaded', tasks: body.tasks ?? [] });
      })
      .catch((err: unknown) => {
        if (err instanceof Error && err.name === 'AbortError') return;
        setState({ kind: 'error' });
      });
    return () => ac.abort();
  }, [kidToken]);

  const toggle = useCallback(
    async (id: string, done: boolean) => {
      if (!kidToken) return;
      // Optimistic flip; revert if the server rejects.
      setState((s) =>
        s.kind === 'loaded'
          ? { kind: 'loaded', tasks: s.tasks.map((t) => (t.id === id ? { ...t, done } : t)) }
          : s,
      );
      try {
        const r = await fetch(`${API_BASE}/api/kid/tasks/${id}`, {
          method: 'PATCH',
          headers: { Authorization: `Bearer ${kidToken}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({ done }),
        });
        if (!r.ok) throw new Error('patch failed');
      } catch {
        setState((s) =>
          s.kind === 'loaded'
            ? {
                kind: 'loaded',
                tasks: s.tasks.map((t) => (t.id === id ? { ...t, done: !done } : t)),
              }
            : s,
        );
      }
    },
    [kidToken],
  );

  if (state.kind === 'loading') {
    return (
      <p
        data-testid="kid-tasks-loading"
        aria-busy="true"
        className="text-sm font-bold text-gray-600"
      >
        Loading tasks…
      </p>
    );
  }
  if (state.kind === 'error') {
    return (
      <p data-testid="kid-tasks-error" role="alert" className="text-sm font-bold text-red-600">
        Couldn&rsquo;t load tasks. Try again.
      </p>
    );
  }
  if (state.tasks.length === 0) {
    return (
      <div data-testid="kid-tasks-empty">
        <p aria-hidden="true" className="text-5xl">
          ⭐
        </p>
        <h2 className="mt-3 font-heading text-2xl text-black">Tasks</h2>
        <p className="mt-1 text-sm font-bold text-gray-600">Nothing to do right now. Nice!</p>
      </div>
    );
  }
  return (
    <div className="flex flex-col gap-2 text-left" data-testid="kid-tasks-list">
      <h2 className="text-center font-heading text-2xl text-black">Tasks</h2>
      {state.tasks.map((t) => (
        <label
          key={t.id}
          data-testid="kid-task"
          className="flex min-h-[44px] cursor-pointer items-center gap-3 rounded-xl border-2 border-black bg-white p-3 shadow-neo-sm"
        >
          <input
            type="checkbox"
            checked={t.done}
            onChange={() => void toggle(t.id, !t.done)}
            className="h-6 w-6 shrink-0 accent-purple-600"
            data-testid="kid-task-check"
          />
          <span
            className={t.done ? 'font-bold text-gray-400 line-through' : 'font-bold text-black'}
          >
            {t.title}
          </span>
        </label>
      ))}
    </div>
  );
}

// FHS-376: My World tab. A DEDICATED kid My World (its own components), pixel-
// matched to the Magic Patterns kid mock: NOT the parent's MyWorldTab reused.
// It carries the Weekly Habits / Analytics toggle, the kid's week banner + habit
// cards, Money Skills, and the Reward Goals + My Account sidebar. The kid's tasks
// live in their own tab (FHS-370).
function MyWorldPanel({ kidToken, displayName }: { kidToken: string | null; displayName: string }) {
  // FHS-370: My World is the kid habit/economy screen only (matches the mock).
  // Tasks live in their own tab; Notices were removed from the kid view (FHS-386).
  return <KidMyWorld kidToken={kidToken} displayName={displayName} />;
}

export function KidDashboardShell() {
  const slug = useTenantSlug();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<string>(DEFAULT_TAB);
  const [confirmed, setConfirmed] = useState<boolean | null>(null);
  const [profile, setProfile] = useState<KidProfile | null>(null);

  const kidToken = useMemo(() => getKidToken(), []);

  // Confirm the kid session against the new consumer endpoint. If the
  // token is gone or rejected, bounce back to kid-login.
  useEffect(() => {
    if (!kidToken) {
      navigate(`/t/${slug}/kid-login`, { replace: true });
      return;
    }
    let cancelled = false;
    const ejectToLogin = () => {
      clearKidToken();
      navigate(`/t/${slug}/kid-login`, { replace: true });
    };
    fetch(`${API_BASE}/api/kid/me`, { headers: { Authorization: `Bearer ${kidToken}` } })
      .then(async (r) => {
        if (cancelled) return;
        if (!r.ok) {
          setConfirmed(false);
          ejectToLogin();
          return;
        }
        // Tenant guard: a kid token minted for tenant A must not run the
        // shell on tenant B's URL. The token's own tenantSlug is the
        // source of truth; a mismatch means a copied/stale token.
        const body = (await r.json().catch(() => null)) as { tenantSlug?: string } | null;
        if (cancelled) return;
        if (body?.tenantSlug && body.tenantSlug !== slug) {
          setConfirmed(false);
          ejectToLogin();
          return;
        }
        setConfirmed(true);
      })
      .catch(() => {
        // Network blip: keep the shell up (tabs are placeholders), but
        // don't announce "session active" since we couldn't confirm.
        if (!cancelled) setConfirmed(null);
      });
    return () => {
      cancelled = true;
    };
  }, [kidToken, slug, navigate]);

  // FHS-362: load the kid's profile for the header (name + avatar + banked
  // stars/cash). Non-fatal: a blip just leaves the generic brand showing.
  // FHS-364: exposed as a callback so a reward claim can refresh the chip.
  const loadProfile = useCallback(
    async (signal?: AbortSignal) => {
      if (!kidToken) return;
      try {
        const r = await fetch(`${API_BASE}/api/kid/profile`, {
          headers: { Authorization: `Bearer ${kidToken}` },
          signal: signal ?? null,
        });
        if (!r.ok) return;
        const body = (await r.json()) as Partial<KidProfile>;
        // Only adopt a well-formed profile (guards against an unexpected shape).
        if (
          typeof body.displayName === 'string' &&
          typeof body.savedStickers === 'number' &&
          typeof body.savedCash === 'number'
        ) {
          setProfile(body as KidProfile);
        }
      } catch (err) {
        if (err instanceof Error && err.name === 'AbortError') return;
      }
    },
    [kidToken],
  );

  useEffect(() => {
    const ac = new AbortController();
    void loadProfile(ac.signal);
    return () => ac.abort();
  }, [loadProfile]);

  const onSwitchUser = useCallback(() => {
    clearKidToken();
    navigate(`/t/${slug}/kid-login`, { replace: true });
  }, [navigate, slug]);

  const navTabs: TopNavTab[] = KID_TABS.map((t) => ({
    id: t.id,
    label: t.label,
    icon: t.icon,
    badge: 0,
  }));
  const active = KID_TABS.find((t) => t.id === activeTab) ?? KID_TABS[0]!;

  return (
    <div
      className="flex min-h-screen flex-col bg-kingdom-bg font-body text-gray-900"
      data-testid="kid-dashboard"
    >
      <TopNav
        brand={
          <div className="flex min-w-0 items-center gap-3" data-testid="kid-brand">
            <span className="grid h-12 w-12 shrink-0 place-items-center rounded-full border-2 border-black bg-gradient-to-br from-yellow-300 to-pink-400 text-2xl shadow-neo-sm">
              {profile?.avatarEmoji ? (
                <span aria-hidden="true">{profile.avatarEmoji}</span>
              ) : profile?.displayName ? (
                <span aria-hidden="true" className="font-heading text-purple-900">
                  {profile.displayName.charAt(0).toUpperCase()}
                </span>
              ) : (
                <Sparkles size={22} className="text-purple-900" aria-hidden="true" />
              )}
            </span>
            <div className="min-w-0">
              <h1
                className="truncate font-heading text-xl uppercase tracking-wide text-white drop-shadow-md md:text-2xl"
                data-testid="kid-title"
              >
                {profile?.displayName ? (
                  <>
                    Hi, {profile.displayName}! <span aria-hidden="true">👋</span>
                  </>
                ) : (
                  'My Hub'
                )}
              </h1>
              <p
                className="mt-0.5 flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-green-300"
                data-testid="kid-status-pill"
              >
                <span
                  className="inline-block h-2 w-2 rounded-full bg-green-400 motion-safe:animate-pulse"
                  aria-hidden="true"
                />
                Magic Active
              </p>
            </div>
          </div>
        }
        tabs={navTabs}
        activeTab={activeTab}
        onTabChange={setActiveTab}
        rightSlot={
          <div className="flex flex-wrap items-center justify-end gap-2">
            {profile && (
              <div className="flex items-center gap-2" data-testid="kid-balance">
                <span
                  className="flex min-h-[36px] items-center gap-1 rounded-full border-2 border-black bg-yellow-300 px-3 py-1 font-bold text-black shadow-neo-xs"
                  data-testid="kid-stars"
                >
                  <span aria-hidden="true">⭐</span>
                  {profile.savedStickers} Stars
                  <span className="sr-only"> saved</span>
                </span>
              </div>
            )}
            <button
              type="button"
              onClick={onSwitchUser}
              aria-label="Sign out"
              data-testid="kid-switch-user"
              className="flex min-h-[44px] items-center gap-2 rounded-md border-2 border-black bg-white px-3 py-2 font-bold text-purple-900 shadow-neo-sm transition-transform hover:bg-yellow-50 motion-safe:hover:-translate-y-0.5"
            >
              <LogOut size={16} strokeWidth={3} aria-hidden="true" />
              <span className="hidden sm:inline">Sign out</span>
            </button>
          </div>
        }
        testId="kid-nav"
      />

      <main className="mx-auto w-full max-w-[1400px] flex-1 px-4 py-6 md:px-6">
        <section
          id={`kid-panel-${active.id}`}
          role="tabpanel"
          aria-labelledby={`tab-${active.id}`}
          data-testid={`kid-panel-${active.id}`}
        >
          {active.id === 'world' ? (
            <MyWorldPanel kidToken={kidToken} displayName={profile?.displayName ?? 'Friend'} />
          ) : active.id === 'meals' ? (
            <KidMealsPanel kidToken={kidToken} />
          ) : active.id === 'calendar' ? (
            <KidCalendarPanel kidToken={kidToken} />
          ) : active.id === 'journal' ? (
            <KidJournalPanel kidToken={kidToken} />
          ) : active.id === 'learn' ? (
            <KidLearnPanel kidToken={kidToken} />
          ) : (
            <div className="rounded-xl border-2 border-black bg-white p-5 shadow-neo-sm">
              <KidTasksPanel kidToken={kidToken} />
            </div>
          )}
        </section>
      </main>

      <p className="sr-only" aria-live="polite" data-testid="kid-session-confirmed">
        {confirmed === true ? 'Kid session active' : ''}
      </p>
    </div>
  );
}
