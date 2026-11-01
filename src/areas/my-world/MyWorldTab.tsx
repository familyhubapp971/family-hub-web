import React, { cloneElement, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { RewardRequestsPanel } from './RewardRequestsPanel';
import {
  AlertTriangle,
  Award,
  BarChart2,
  Check,
  CheckCircle,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Coins,
  ShieldCheck,
  Edit2,
  Heart,
  Lock,
  Plus,
  Sparkles,
  Star,
  Wallet,
  X,
  Zap,
} from 'lucide-react';
import { Button, InvestmentTag, investmentRule, useBodyScrollLock } from '@familyhub/ui';
import { useNavigate } from 'react-router-dom';
import { formatMoney, summariseWeekActions } from '@familyhub/shared';
import { useAuth } from '../../app/lib/auth-context';
import { useTenantSlug } from '../../app/lib/tenant-context';
import { API_BASE } from '../../app/lib/api';
import { MoneyActionsSheet } from '../money/MoneyActionsSheet';
import { AnalyticsView } from './AnalyticsView';
import { type MyWorldDataApi, kidDataApi, parentDataApi } from './myWorldApi';

// FHS-292: My World habit grid (legacy HabitTracker UI port).
// Pixel / behaviour parity with the legacy HabitTracker component.

// FIX 2 (BLOCKER): a rate <= 0 must never be divided by (Infinity/NaN
// stickers). Mirrors the api's cashAsStickers guard (family-hub-api/src/areas/my-world/myworld.ts).
function stickersFromCash(cash: number, rate: number): number {
  return rate <= 0 ? 0 : cash / rate;
}

// FHS-608: how many habit days the week could have had. Four places computed
// this, each assuming seven days per habit, while the per-habit pill already
// read `habit.target`. The api does not surface a target yet, so every habit
// is seven today and nothing on screen moves: this exists so the week total
// and the pill cannot drift apart the moment one does arrive.
function possibleDays(habits: Array<{ target: number }>): number {
  return habits.reduce((sum, h) => sum + h.target, 0);
}

// ── Re-exported for other modules / tests ────────────────────────────────────
export function isoDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}
export function mondayOfWeek(d: Date): Date {
  const day = d.getUTCDay();
  const shift = day === 0 ? -6 : 1 - day;
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate() + shift));
}

// ── Types ────────────────────────────────────────────────────────────────────
interface ApiHabit {
  id: string;
  name: string;
  description: string | null;
  color: string;
  icon: string;
  isBonus: boolean;
  // FHS-399: bonus habits may have a target < 7. Defaults to 7 when absent.
  target?: number;
}
interface ApiSticker {
  habitId: string;
  day: number; // 0=Mon … 6=Sun
  sticker: string;
  stickerValue: number;
}
interface ApiWeek {
  id: string;
  weekNumber: number;
  year: number;
  startDate: string;
  isFinalized: boolean;
  carriedOverStickers?: number;
  carriedOverCash?: number;
}
interface WeekAction {
  id: number;
  weekId: string;
  actionType:
    | 'claim'
    | 'cashout'
    | 'save'
    | 'auto_save'
    | 'invest'
    | 'invest_continue'
    | 'withdraw';
  stickersUsed: number | null;
  cashAmount: number | null;
  rewardName: string | null;
  habitId: string | null;
  habitName: string | null;
  createdAt: string;
}
interface Reward {
  id: string;
  name: string;
  description: string | null;
  stickerCost: number;
  icon: string | null;
  // FHS-376: kid mode only: the kid's latest request state for this reward.
  requestStatus?: 'none' | 'pending' | 'approved' | 'declined';
}

interface Investment {
  id: string;
  habitId: string;
  // Nullable: the habit can be deleted while an investment is still active,
  // in which case the GET's LEFT JOIN returns null for these.
  habitName: string | null;
  habitIcon: string | null;
  investedStickers: number;
  originalInvestedStickers: number;
  currentValue: number;
  currentValueStickers: number;
  daysCompleted: number;
  daysMissed: number;
  // FHS-378: when false, missed days don't subtract value (no-penalty mode).
  deductible: boolean;
  // FHS-534: how many stickers this investment grows per completed day
  // (and, on invest, the pay boost applied to the underlying habit).
  // Optional so a legacy investment record without the field still falls
  // back to the historical default of 5.
  coefficient?: number;
}

// ── Local rich-habit model (mirrors legacy HabitTracker Habit interface) ─────
interface Habit {
  id: string;
  title: string;
  icon: React.ReactNode;
  iconName: string; // display name e.g. "Star"
  color: string;
  isBonus: boolean;
  progress: (string | boolean)[]; // length 7; string = sticker id, true = plain tick
  total: number;
  target: number;
  stickers: string[]; // habit-level sticker badges (cosmetic)
}

interface WeekSummary {
  totalStickers: number;
  performance: number;
  carriedOver: number;
  cashOut: number;
  actions?: WeekAction[] | undefined;
  /** FHS-608: the week's actions could not be loaded, so the split is unknown. */
  actionsFailed?: boolean | undefined;
}

interface WeekData {
  weekId: string;
  weekNumber: number;
  year: number;
  startDate: string;
  label: string;
  isFinalized: boolean;
  habits: Habit[];
  summary?: WeekSummary;
}

// ── Constants ────────────────────────────────────────────────────────────────
const AVAILABLE_STICKERS: Array<{
  id: string;
  name: string;
  icon: React.ReactElement;
  color: string;
}> = [
  {
    id: 'gold-star',
    name: 'Gold Star',
    icon: <Star className="w-8 h-8" />,
    color: 'bg-yellow-400',
  },
  { id: 'heart', name: 'Heart', icon: <Heart className="w-8 h-8" />, color: 'bg-pink-400' },
  { id: 'magic', name: 'Magic', icon: <Sparkles className="w-8 h-8" />, color: 'bg-fuchsia-400' },
  { id: 'trophy', name: 'Trophy', icon: <Award className="w-8 h-8" />, color: 'bg-lime-400' },
];

const daysShort = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];
const days = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

const ICON_MAP: Record<string, React.ReactElement> = {
  star: <Star className="w-6 h-6" />,
  heart: <Heart className="w-6 h-6" />,
  sparkles: <Sparkles className="w-6 h-6" />,
  zap: <Zap className="w-6 h-6" />,
  award: <Award className="w-6 h-6" />,
  checkcircle: <CheckCircle className="w-6 h-6" />,
};

// Display name → API icon string
const ICON_NAME_MAP: Record<string, string> = {
  Star: 'star',
  Heart: 'heart',
  Sparkles: 'sparkles',
  Lightning: 'zap',
  Trophy: 'award',
  Check: 'checkcircle',
};

// API icon string → display name
const ICON_API_TO_NAME: Record<string, string> = {
  star: 'Star',
  heart: 'Heart',
  sparkles: 'Sparkles',
  zap: 'Lightning',
  award: 'Trophy',
  checkcircle: 'Check',
};

const iconOptions = [
  { icon: <Star className="w-6 h-6" />, name: 'Star' },
  { icon: <Heart className="w-6 h-6" />, name: 'Heart' },
  { icon: <Sparkles className="w-6 h-6" />, name: 'Sparkles' },
  { icon: <Zap className="w-6 h-6" />, name: 'Lightning' },
  { icon: <Award className="w-6 h-6" />, name: 'Trophy' },
  { icon: <CheckCircle className="w-6 h-6" />, name: 'Check' },
];

const colorOptions = [
  { color: 'bg-yellow-400', name: 'Yellow' },
  { color: 'bg-pink-400', name: 'Pink' },
  { color: 'bg-lime-400', name: 'Lime' },
  { color: 'bg-fuchsia-400', name: 'Fuchsia' },
  { color: 'bg-cyan-400', name: 'Cyan' },
  { color: 'bg-rose-400', name: 'Rose' },
  { color: 'bg-purple-400', name: 'Purple' },
  { color: 'bg-orange-400', name: 'Orange' },
];

// ── Helpers ───────────────────────────────────────────────────────────────────
function mapIconStringToElement(iconStr: string | null | undefined): React.ReactElement {
  return ICON_MAP[iconStr?.toLowerCase() ?? ''] ?? <Star className="w-6 h-6" />;
}

function computeWeekLabel(startDate: string): string {
  const start = new Date(startDate);
  const end = new Date(start);
  end.setDate(end.getDate() + 6);
  const fmt = (d: Date) => d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  return `${fmt(start)} – ${fmt(end)}`;
}

function mapApiHabitToLocal(apiHabit: ApiHabit, apiStickers: ApiSticker[]): Habit {
  const progress: (string | boolean)[] = [false, false, false, false, false, false, false];
  for (const s of apiStickers) {
    if (s.habitId === apiHabit.id && s.day >= 0 && s.day <= 6) {
      progress[s.day] = s.sticker;
    }
  }
  const total = progress.filter((p) => typeof p === 'string' || p === true).length;
  return {
    id: String(apiHabit.id),
    title: apiHabit.name,
    icon: mapIconStringToElement(apiHabit.icon ?? 'star'),
    iconName: ICON_API_TO_NAME[apiHabit.icon?.toLowerCase()] ?? 'Star',
    color: apiHabit.color ?? 'bg-pink-400',
    isBonus: apiHabit.isBonus ?? false,
    progress,
    total,
    // Use the API-supplied target when present; default to 7 for regular habits.
    target: apiHabit.target ?? 7,
    stickers: [], // habit-level cosmetic stickers not exposed in API; start empty
  };
}

// ── Main component ────────────────────────────────────────────────────────────
export function MyWorldTab(
  props:
    | {
        memberId: string;
        // FHS-336: only an admin may edit past days, close a week, or touch the
        // economy. A normal user (adult) can still tick today + the rest of this
        // week. Defaults to false so controls stay hidden until the caller's role
        // is known. The server (FHS-335) is the real boundary; this hides the UI.
        isAdmin?: boolean;
        // FHS-637: the child's name, for the close-week sheet's header.
        memberName?: string;
      }
    // FHS-374: kid mode: the logged-in kid reuses this exact screen READ-ONLY.
    // Data comes from /api/kid/* (self-scoped by the kid token); every write
    // control is hidden (`readOnly`). The parent does all ticking/editing.
    | { kidToken: string; isAdmin?: boolean },
) {
  const kidToken = 'kidToken' in props ? props.kidToken : null;
  const memberId = 'memberId' in props ? props.memberId : '';
  const isAdmin = props.isAdmin ?? false;
  const memberName = 'memberName' in props ? (props.memberName ?? '') : '';
  const slug = useTenantSlug();
  const navigate = useNavigate();
  const { session } = useAuth();

  // Key on the token STRING, not the session object. Supabase re-fires
  // onAuthStateChange with a fresh session object on window/tab refocus; if
  // `headers` depended on the object it would change identity every refocus,
  // re-running fetchData and flashing the loading screen ("reloads on tab switch").
  const accessToken = session?.access_token ?? null;
  const api = useMemo<MyWorldDataApi | null>(
    () =>
      kidToken
        ? kidDataApi(kidToken)
        : accessToken && memberId
          ? parentDataApi(memberId, {
              Authorization: `Bearer ${accessToken}`,
              'x-tenant-slug': slug,
            })
          : null,
    [kidToken, accessToken, memberId, slug],
  );
  const headers = api?.headers ?? null;
  const readOnly = api?.readOnly ?? false;

  // ── State ──────────────────────────────────────────────────────────────────
  const [activeTab, setActiveTab] = useState<'habits' | 'analytics'>('habits');
  const [loading, setLoading] = useState(true);
  const [weekLoading, setWeekLoading] = useState(false);
  const [weeks, setWeeks] = useState<WeekData[]>([]);
  const [weekIndex, setWeekIndex] = useState(0);

  // Rewards shop state
  const [rewards, setRewards] = useState<Reward[]>([]);
  const [balance, setBalance] = useState(0);
  // Family currency (chosen at registration) for all cash labels.
  const [currency, setCurrency] = useState('USD');
  // FHS-512: this child's effective (configurable) sticker rate. 0.5 is
  // only the fallback shown before the first savings fetch resolves.
  const [stickerRate, setStickerRate] = useState(0.5);

  // Dialogs
  const [editHabitId, setEditHabitId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState('');
  const [editColor, setEditColor] = useState('bg-pink-400');
  const [editIconName, setEditIconName] = useState('Star');
  const [stickerDialogId, setStickerDialogId] = useState<string | null>(null);
  const [dayStickerDialog, setDayStickerDialog] = useState<{
    habitId: string;
    dayIndex: number;
  } | null>(null);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [showAddHabit, setShowAddHabit] = useState(false);
  const [newHabitTitle, setNewHabitTitle] = useState('');
  const [newHabitColor, setNewHabitColor] = useState('bg-pink-400');
  const [newHabitIconName, setNewHabitIconName] = useState('Star');

  // ── Savings / banking state ───────────────────────────────────────────────
  const [savedStickers, setSavedStickers] = useState(0);
  const [savedCash, setSavedCash] = useState(0);
  // FHS-606: the design splits saved stickers into last week's banking and
  // everything kept before it. Server-derived; defaults keep an older API
  // honest (everything reads as kept from earlier until it sends the split).
  const [earnedLastWeekStickers, setEarnedLastWeekStickers] = useState(0);
  const [unallocatedStickers, setUnallocatedStickers] = useState(0);

  // ── Investments state ─────────────────────────────────────────────────────
  const [investments, setInvestments] = useState<Investment[]>([]);
  // FHS-607: which investment row is open. One at a time, so the card's height
  // does not run away with five habits invested.
  const [openInvestmentId, setOpenInvestmentId] = useState<string | null>(null);

  // ── Close Week dialog state ───────────────────────────────────────────────
  const [closeWeekOpen, setCloseWeekOpen] = useState(false);

  // Lock body scroll whenever any overlay is open (FHS-412).
  useBodyScrollLock(
    Boolean(
      stickerDialogId ||
        dayStickerDialog ||
        editHabitId ||
        showAddHabit ||
        deleteConfirmId ||
        closeWeekOpen,
    ),
  );

  const habitsCache = useRef<Map<string, Habit[]>>(new Map());
  const redeemingRef = useRef<Set<string>>(new Set());

  // ── Data fetch helpers ────────────────────────────────────────────────────
  const fetchWeekHabits = useCallback(
    async (weekId: string): Promise<Habit[]> => {
      const cached = habitsCache.current.get(weekId);
      if (cached) return cached;
      if (!api) return [];
      const res = await fetch(api.habits(weekId), { headers: api.headers });
      if (!res.ok) throw new Error(`habits fetch failed: ${res.status}`);
      const body = (await res.json()) as {
        habits: ApiHabit[];
        stickers: ApiSticker[];
        balance: number;
        currency?: string;
      };
      const habits = (body.habits ?? []).map((h) => mapApiHabitToLocal(h, body.stickers ?? []));
      habitsCache.current.set(weekId, habits);
      // Update balance + currency from the current week
      setBalance(body.balance ?? 0);
      if (body.currency) setCurrency(body.currency);
      return habits;
    },
    [api],
  );

  const buildWeekData = useCallback((apiWeek: ApiWeek, habits: Habit[]): WeekData => {
    const totalStickers = habits.reduce((s, h) => s + h.total, 0);
    const totalPossible = possibleDays(habits);
    const performance = totalPossible > 0 ? Math.round((totalStickers / totalPossible) * 100) : 0;
    const data: WeekData = {
      weekId: apiWeek.id,
      weekNumber: apiWeek.weekNumber,
      year: apiWeek.year,
      startDate: apiWeek.startDate,
      label: computeWeekLabel(apiWeek.startDate),
      isFinalized: apiWeek.isFinalized,
      habits,
    };
    if (apiWeek.isFinalized) {
      data.summary = {
        totalStickers,
        performance,
        carriedOver: apiWeek.carriedOverStickers ?? 0,
        cashOut: apiWeek.carriedOverCash ?? 0,
      };
    }
    return data;
  }, []);

  // FHS-642: `silent` refreshes the board WITHOUT the full-page loading screen.
  // That screen is an early return, so a refresh after a mutation unmounted the
  // whole board, and with it the money sheet that had just said "All done": the
  // sheet came back on its opening step, which read as the dialog reloading.
  const fetchData = useCallback(
    async ({ silent = false }: { silent?: boolean } = {}) => {
      if (!api) return;
      if (!silent) setLoading(true);
      habitsCache.current.clear();
      try {
        // Fetch weeks list + rewards in parallel
        const [wRes, rRes] = await Promise.all([
          fetch(api.weeks(), { headers: api.headers }),
          fetch(api.rewards(), { headers: api.headers }),
        ]);
        if (!wRes.ok) throw new Error(`weeks fetch failed: ${wRes.status}`);

        const wBody = (await wRes.json()) as { weeks: ApiWeek[] };
        const apiWeeks = [...(wBody.weeks ?? [])].sort((a, b) => {
          if (a.year !== b.year) return a.year - b.year;
          return a.weekNumber - b.weekNumber;
        });

        if (rRes.ok) {
          const rBody = (await rRes.json()) as { rewards: Reward[]; stickerBalance?: number };
          setRewards(rBody.rewards ?? []);
          if (rBody.stickerBalance !== null && rBody.stickerBalance !== undefined)
            setBalance(rBody.stickerBalance);
        }

        if (apiWeeks.length === 0) {
          // Same reasoning as the catch below: a silent top-up never empties
          // a board that is already showing something.
          if (!silent) setWeeks([]);
          return;
        }

        // Find current (non-finalized) week, fall back to last
        const currentIdx = apiWeeks.findIndex((w) => !w.isFinalized);
        const idx = currentIdx >= 0 ? currentIdx : apiWeeks.length - 1;

        // Fetch habits only for the active week up front; lazy-load the rest
        const activeWeek = apiWeeks[idx];
        if (!activeWeek) {
          if (!silent) setWeeks([]);
          return;
        }
        const currentHabits = await fetchWeekHabits(activeWeek.id);

        const weekDataList = apiWeeks.map((apiWeek, i) =>
          buildWeekData(apiWeek, i === idx ? currentHabits : []),
        );

        setWeeks(weekDataList);
        setWeekIndex(idx);
      } catch (err) {
        console.error('Failed to fetch My World data:', err);
        // A silent refresh that fails keeps whatever is already on screen: it
        // is a background top-up, not the first load, so emptying the board
        // would replace a working screen with "No weeks found".
        if (!silent) setWeeks([]);
      } finally {
        if (!silent) setLoading(false);
      }
    },
    [api, fetchWeekHabits, buildWeekData],
  );

  useEffect(() => {
    void fetchData();
  }, [fetchData]);

  // ── Savings fetch ─────────────────────────────────────────────────────────
  const fetchSavings = useCallback(async () => {
    if (!api) return;
    try {
      const res = await fetch(api.savings(), { headers: api.headers });
      if (!res.ok) return;
      const body = (await res.json()) as {
        savedStickers: number;
        savedCash: number;
        earnedLastWeekStickers?: number;
        keptFromEarlierStickers?: number;
        currency?: string;
        stickerRate?: number;
      };
      setSavedStickers(body.savedStickers ?? 0);
      setSavedCash(body.savedCash ?? 0);
      setEarnedLastWeekStickers(body.earnedLastWeekStickers ?? 0);
      if (body.currency) setCurrency(body.currency);
      if (typeof body.stickerRate === 'number') setStickerRate(body.stickerRate);
    } catch {
      // Non-fatal; leave prior values
    }
  }, [api]);

  const fetchWeekStats = useCallback(
    async (weekId: string) => {
      if (!api) return;
      try {
        const res = await fetch(api.weekStats(weekId), { headers: api.headers });
        if (!res.ok) return;
        const body = (await res.json()) as { unallocatedStickers?: number };
        setUnallocatedStickers(body.unallocatedStickers ?? 0);
      } catch {
        // Non-fatal
      }
    },
    [api],
  );

  // ── Investments fetch ─────────────────────────────────────────────────────
  const fetchInvestments = useCallback(async () => {
    if (!api) return;
    try {
      const res = await fetch(api.investments(), { headers: api.headers });
      if (!res.ok) return;
      const body = (await res.json()) as { investments: Investment[] };
      setInvestments(body.investments ?? []);
    } catch {
      // Non-fatal
    }
  }, [api]);

  // FHS-378: flip an active investment's deductible flag (admin only). The
  // server recalculates the value; we refresh to show it.
  const setInvestmentDeductible = useCallback(
    async (inv: Investment, deductible: boolean) => {
      if (readOnly || !headers || inv.deductible === deductible) return;
      try {
        const res = await fetch(
          `${API_BASE}/api/mw/financial/investments/${inv.id}/settings?memberId=${memberId}`,
          {
            method: 'POST',
            headers: { ...headers, 'Content-Type': 'application/json' },
            body: JSON.stringify({ memberId, deductible }),
          },
        );
        if (!res.ok) return;
        void fetchInvestments();
      } catch {
        // Non-fatal: the toggle can be retried
      }
    },
    [readOnly, headers, memberId, fetchInvestments],
  );

  useEffect(() => {
    void fetchSavings();
  }, [fetchSavings]);

  useEffect(() => {
    void fetchInvestments();
  }, [fetchInvestments]);

  // Fetch week stats whenever the active week changes
  useEffect(() => {
    const w = weeks[weekIndex];
    if (w && !w.isFinalized) {
      void fetchWeekStats(w.weekId);
    }
  }, [weekIndex, weeks, fetchWeekStats]);

  // Lazy-load habits when navigating to a week with no cached data
  useEffect(() => {
    const w = weeks[weekIndex];
    if (!w || w.habits.length > 0) return;
    if (habitsCache.current.has(w.weekId)) {
      const cached = habitsCache.current.get(w.weekId)!;
      setWeeks((prev) => prev.map((wk, i) => (i === weekIndex ? { ...wk, habits: cached } : wk)));
      return;
    }

    let cancelled = false;
    setWeekLoading(true);

    const habitsPromise = fetchWeekHabits(w.weekId);
    // FHS-608: null means "we could not load this", which is NOT the same as
    // an empty list. Swallowing the failure let the card fall back to the
    // carried-over balance and present it as this week's savings.
    const actionsPromise: Promise<WeekAction[] | null> = w.isFinalized
      ? fetch(api!.weekActions(w.weekId), {
          headers: api!.headers,
        })
          .then((r) => (r.ok ? (r.json() as Promise<{ actions: WeekAction[] }>) : null))
          .then((b) => b?.actions ?? null)
          .catch(() => null)
      : Promise.resolve([]);

    Promise.all([habitsPromise, actionsPromise])
      .then(([habits, actions]) => {
        if (cancelled) return;
        setWeeks((prev) =>
          prev.map((wk, i) => {
            if (i !== weekIndex) return wk;
            const totalStickers = habits.reduce((s, h) => s + h.total, 0);
            const totalPossible = possibleDays(habits);
            const performance =
              totalPossible > 0 ? Math.round((totalStickers / totalPossible) * 100) : 0;
            if (wk.isFinalized) {
              return {
                ...wk,
                habits,
                summary: {
                  totalStickers,
                  performance,
                  carriedOver: wk.summary?.carriedOver ?? 0,
                  cashOut: wk.summary?.cashOut ?? 0,
                  // undefined = we could not load them (see actionsPromise).
                  actions: actions ?? undefined,
                  actionsFailed: actions === null,
                },
              };
            }
            return { ...wk, habits };
          }),
        );
      })
      .catch((err) => console.error('Failed to lazy-load week data:', err))
      .finally(() => {
        if (!cancelled) setWeekLoading(false);
      });

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [weekIndex, weeks.length]);

  // ── Derived week values ───────────────────────────────────────────────────
  const week = weeks[weekIndex];
  const isCurrentWeek = week ? !week.isFinalized : false;
  // FHS-484: a week can exist before its Monday arrives (closing this week
  // early immediately creates next week). "Not finalized" alone doesn't mean
  // "has started", so this is checked separately from isCurrentWeek. UTC
  // matches how the rest of My World anchors weeks (see stickerDayRelation).
  const todayIso = new Date().toISOString().slice(0, 10);
  const isFutureWeek = week ? week.startDate > todayIso : false;
  // FHS-374: a kid views read-only: never editable, regardless of week.
  const canEdit = readOnly
    ? false
    : isFutureWeek
      ? false
      : isAdmin
        ? week
          ? !week.isFinalized
          : false
        : isCurrentWeek;

  // FHS-319: the Close Week banner only appears once the week is actually
  // over: from its last day (Sunday) onward, and stays until the week is
  // closed (so a week left open past Sunday keeps prompting). A fresh week
  // shows nothing until its own Sunday.
  const fmtLocalDate = (d: Date) =>
    `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  const showCloseWeekBanner = (() => {
    if (!isAdmin) return false; // FHS-336: closing a week is admin-only
    if (!week || week.isFinalized) return false;
    const lastDay = new Date(`${week.startDate}T00:00:00`);
    lastDay.setDate(lastDay.getDate() + 6); // Mon start → Sunday is the 7th day
    return fmtLocalDate(new Date()) >= fmtLocalDate(lastDay);
  })();

  const canEditDay = (dayIndex: number) => {
    if (!canEdit) return false;
    if (isAdmin) return true;
    // FHS-336: a normal user may tick today or later, never a PAST day. Compare
    // the cell's real calendar date to today (mirrors the server rule in
    // FHS-335), not the day-of-week index: so a stale/old open week is handled.
    if (!week) return false;
    const cellDate = new Date(`${week.startDate}T00:00:00`);
    cellDate.setDate(cellDate.getDate() + dayIndex);
    return fmtLocalDate(cellDate) >= fmtLocalDate(new Date());
  };

  const habits = week?.habits ?? [];
  const totalDone = habits.reduce((s, h) => s + h.total, 0);
  const totalPossible = possibleDays(habits);

  // ── Investment derived values ─────────────────────────────────────────────
  // FHS-607: one map from habit to its investment. The habit row now needs the
  // kind as well as the multiplier (FHS-534), and two parallel lookups of the
  // same join drift apart, so the whole record crosses over.
  const investmentByHabitId = useMemo(
    () => new Map(investments.map((inv) => [inv.habitId, inv])),
    [investments],
  );
  // At-risk first: those are the ones a parent may want to change.
  const sortedInvestments = useMemo(
    () => [...investments].sort((a, b) => Number(b.deductible) - Number(a.deductible)),
    [investments],
  );

  // FHS-613: every money figure on this board goes through one formatter, so
  // the family's currency renders the way the viewer's locale writes it
  // ("$7.50", "£7.50", "7,50 €") instead of a hand-glued "USD 7.50".
  const money = useCallback((amount: number) => formatMoney(amount, currency), [currency]);

  // ── Savings derived values ────────────────────────────────────────────────
  const weeklyValue = money(unallocatedStickers * stickerRate);
  // FHS-376: a kid's reward request is paid from SAVINGS on approval, so the
  // "Ask for this" affordability must match savings (banked stars + banked
  // cash converted at this child's rate), not the spendable balance.
  const savingsStars = savedStickers + Math.floor(stickersFromCash(savedCash, stickerRate));

  // FHS-606/607: one investments card, rendered both in the kid pair and in the
  // parent money row. withTotals adds the row footer: what the investments are
  // worth right now, and how many a missed day can still hurt.
  //
  // Rows are one compact line each and only one opens at a time, so ten
  // investments take ten lines and the card keeps a steady height (the design
  // dropped the older inner-scroll idea for this).
  const renderActiveInvestments = (withTotals: boolean) => {
    const count = investments.length;
    // The kid sees every tag but never the control (FHS-376/378 gates).
    const canFlip = isAdmin && !readOnly;
    return (
      <div data-testid="active-investments" className="relative">
        <div className="absolute inset-0 bg-fuchsia-400 rounded-2xl translate-x-1.5 translate-y-1.5 border-2 sm:border-3 border-black" />
        <div className="relative h-full flex flex-col bg-purple-900 border-2 sm:border-3 border-fuchsia-400/30 rounded-2xl p-4 sm:p-5">
          <div className="flex flex-wrap items-center gap-2 sm:gap-3 mb-4">
            <div className="bg-fuchsia-400 p-1.5 sm:p-2 rounded-lg border-2 border-black text-black">
              <Coins className="w-4 h-4 sm:w-5 sm:h-5" />
            </div>
            <h3 className="text-base sm:text-lg font-black text-white uppercase tracking-wide">
              Active Investments
            </h3>
            {count > 0 && (
              <span
                data-testid="investments-count"
                className="ml-auto whitespace-nowrap rounded-full border-2 border-black bg-yellow-300 px-2.5 py-1 text-xs font-bold text-black shadow-neo-xs"
              >
                {count} {count === 1 ? 'habit' : 'habits'}
              </span>
            )}
          </div>
          {count === 0 ? (
            <div className="flex-1 flex flex-col">
              <div className="flex items-center justify-between gap-3">
                <span className="text-sm font-bold text-slate-200">Habits invested</span>
                <span className="text-2xl font-black text-purple-300">0</span>
              </div>
              <p className="mt-4 pt-4 border-t-2 border-white/10 text-sm font-bold text-slate-300">
                Nothing growing yet. Mark a habit as invested to pay a multiple.
              </p>
            </div>
          ) : (
            <>
              <ul className="flex-1 flex flex-col gap-2">
                {sortedInvestments.map((inv) => {
                  const isOpen = openInvestmentId === inv.id;
                  const multiplier = inv.coefficient ?? 5;
                  // FHS-613: three points in time, not three loose stats.
                  // What was put in, what it had grown to when last week rolled
                  // over (the principal the server carried forward), and what
                  // it is worth today.
                  const putIn = inv.originalInvestedStickers ?? inv.investedStickers;
                  const afterRollOver = inv.investedStickers;
                  const today = inv.currentValueStickers;
                  // Against LAST WEEK's total, not the original: this week's
                  // growth less anything a deductible habit clawed back for
                  // days missed. A no-penalty habit can only stay flat or rise.
                  const change = today - afterRollOver;
                  const changeNote =
                    change > 0
                      ? `Up ${change} ${change === 1 ? 'sticker' : 'stickers'} since last week`
                      : change < 0
                        ? `Down ${Math.abs(change)} ${
                            Math.abs(change) === 1 ? 'sticker' : 'stickers'
                          } since last week`
                        : 'No change since last week';
                  const kind = inv.deductible ? 'Deductible' : 'No penalty';
                  return (
                    <li
                      key={inv.id}
                      data-testid={`investment-card-${inv.id}`}
                      className={`rounded-xl border-2 bg-white/10 ${
                        isOpen ? 'border-yellow-300' : 'border-white/20'
                      }`}
                    >
                      <button
                        type="button"
                        data-testid={`investment-row-${inv.id}`}
                        onClick={() => setOpenInvestmentId(isOpen ? null : inv.id)}
                        aria-expanded={isOpen}
                        className="flex w-full min-h-[44px] items-center gap-2 rounded-xl p-2.5 text-left focus:outline-none focus-visible:ring-4 focus-visible:ring-yellow-300"
                      >
                        {/* Kind as a dot with its icon; the word rides along for
                            screen readers, so a closed row still says which it is. */}
                        <span
                          className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full border-2 border-black text-black ${
                            inv.deductible ? 'bg-red-300' : 'bg-green-300'
                          }`}
                        >
                          {inv.deductible ? (
                            <AlertTriangle size={12} strokeWidth={3} aria-hidden="true" />
                          ) : (
                            <ShieldCheck size={12} strokeWidth={3} aria-hidden="true" />
                          )}
                          <span className="sr-only">{kind}</span>
                        </span>
                        <span className="min-w-0 flex-1 truncate text-sm font-bold text-slate-100">
                          {inv.habitName ?? `Investment #${inv.id}`}
                        </span>
                        <span
                          data-testid={`investment-worth-${inv.id}`}
                          className="shrink-0 whitespace-nowrap text-base font-black text-lime-400"
                        >
                          {money(inv.currentValue)}
                        </span>
                        <ChevronDown
                          size={16}
                          aria-hidden="true"
                          className={`shrink-0 text-purple-200 transition-transform ${
                            isOpen ? 'rotate-180' : ''
                          }`}
                        />
                      </button>
                      {isOpen && (
                        <div className="px-2.5 pb-2.5">
                          <InvestmentTag
                            testId={`investment-mode-${inv.id}`}
                            multiplier={multiplier}
                            deductible={inv.deductible}
                          />
                          {/* FHS-613: the value over time. A sticker count is
                              never shown without its money value beside it. */}
                          <dl className="mt-2.5 flex flex-col gap-1">
                            <div className="flex items-center justify-between gap-3">
                              <dt className="text-xs font-bold text-slate-300">
                                Put in at the start
                              </dt>
                              <dd
                                data-testid="investment-original"
                                className="whitespace-nowrap text-sm font-bold text-slate-100"
                              >
                                {putIn} stickers
                                <span className="text-slate-300">
                                  {' '}
                                  ({money(putIn * stickerRate)})
                                </span>
                              </dd>
                            </div>
                            <div className="flex items-center justify-between gap-3">
                              <dt className="text-xs font-bold text-slate-300">
                                After last week&rsquo;s roll over
                              </dt>
                              <dd
                                data-testid="investment-invested"
                                className="whitespace-nowrap text-sm font-bold text-slate-100"
                              >
                                {afterRollOver} stickers
                                <span className="text-slate-300">
                                  {' '}
                                  ({money(afterRollOver * stickerRate)})
                                </span>
                              </dd>
                            </div>
                            <div className="flex items-center justify-between gap-3">
                              <dt className="text-xs font-bold text-slate-300">Today</dt>
                              <dd
                                data-testid="investment-current"
                                className="whitespace-nowrap text-sm font-black text-yellow-300"
                              >
                                {today} stickers
                                <span className="text-yellow-200">
                                  {' '}
                                  ({money(inv.currentValue)})
                                </span>
                                {/* Sign as well as colour, so the direction
                                    still reads in greyscale. The sentence
                                    below carries it for screen readers. */}
                                <span
                                  aria-hidden="true"
                                  data-testid="investment-delta"
                                  className={`ml-1.5 inline-block rounded-full border-2 border-black px-1.5 align-middle text-[10px] font-bold text-black ${
                                    change > 0
                                      ? 'bg-green-300'
                                      : change < 0
                                        ? 'bg-red-300'
                                        : 'bg-gray-200'
                                  }`}
                                >
                                  {change > 0 ? '+' : change < 0 ? '\u2212' : ''}
                                  {Math.abs(change)}
                                </span>
                              </dd>
                            </div>
                          </dl>
                          {/* Outside the list: a <dl> may only hold dt/dd
                              groups, and axe flags anything else. */}
                          <p
                            data-testid={`investment-change-note-${inv.id}`}
                            className="text-right text-xs font-bold text-slate-300"
                          >
                            {changeNote}
                          </p>
                          <div className="mt-2.5 flex items-center justify-between gap-3 text-xs font-mono text-slate-300">
                            <span>{inv.daysCompleted}/7 days done</span>
                            {inv.daysMissed > 0 && (
                              <span className={inv.deductible ? 'text-red-200' : 'text-slate-300'}>
                                {inv.daysMissed} missed
                              </span>
                            )}
                          </div>
                          <div
                            className="mt-1 h-2 w-full overflow-hidden rounded-full border border-white/10 bg-white/10"
                            role="img"
                            aria-label={`${inv.daysCompleted} of 7 days done, ${inv.daysMissed} missed`}
                          >
                            <div
                              className="h-full rounded-full bg-fuchsia-400"
                              style={{ width: `${(inv.daysCompleted / 7) * 100}%` }}
                            />
                          </div>
                          <p
                            data-testid={`investment-per-day-${inv.id}`}
                            className="mt-2 text-xs font-bold text-slate-200"
                          >
                            Pays {money(multiplier * stickerRate)} each day it is done.
                          </p>
                          {canFlip ? (
                            <button
                              type="button"
                              data-testid={`investment-toggle-${inv.id}`}
                              onClick={() => void setInvestmentDeductible(inv, !inv.deductible)}
                              className="mt-2.5 min-h-[44px] w-full rounded-xl border-2 border-black bg-white text-sm font-bold text-black shadow-neo-xs transition-transform motion-safe:hover:-translate-y-0.5 focus:outline-none focus-visible:ring-4 focus-visible:ring-yellow-300"
                            >
                              {inv.deductible ? 'Switch to no penalty' : 'Switch to deductible'}
                            </button>
                          ) : (
                            <p className="mt-2 text-xs font-bold text-slate-200">
                              {investmentRule(inv.deductible)}
                            </p>
                          )}
                        </div>
                      )}
                    </li>
                  );
                })}
              </ul>
              {/* FHS-606: totals, so five investments still read at a glance. */}
              {withTotals && (
                <div className="mt-4 pt-4 border-t-2 border-white/10">
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-slate-300 font-bold text-sm sm:text-base">
                      Worth this week
                    </span>
                    <span
                      data-testid="investments-worth"
                      className="text-2xl font-black text-lime-400"
                    >
                      {money(investments.reduce((sum, inv) => sum + inv.currentValue, 0))}
                    </span>
                  </div>
                  <p
                    data-testid="investments-at-risk"
                    className="mt-1 text-right text-xs font-bold text-slate-300"
                  >
                    {investments.filter((inv) => inv.deductible).length} of {count} could lose value
                  </p>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    );
  };

  // ── Habit state updater ───────────────────────────────────────────────────
  const updateWeekHabits = useCallback(
    (updater: (hs: Habit[]) => Habit[]) => {
      setWeeks((prev) =>
        prev.map((w, i) => {
          if (i !== weekIndex) return w;
          const updated = updater(w.habits);
          habitsCache.current.set(w.weekId, updated);
          return { ...w, habits: updated };
        }),
      );
    },
    [weekIndex],
  );

  // ── Edit dialog ───────────────────────────────────────────────────────────
  const openEditDialog = (habit: Habit) => {
    setEditHabitId(habit.id);
    setEditTitle(habit.title);
    setEditColor(habit.color);
    setEditIconName(habit.iconName);
  };
  const closeEditDialog = () => setEditHabitId(null);

  const saveEditHabit = async () => {
    if (readOnly) return;
    if (!editHabitId || !editTitle.trim() || !headers) return;
    const iconString = ICON_NAME_MAP[editIconName] ?? 'star';
    try {
      const res = await fetch(`${API_BASE}/api/habits/${editHabitId}`, {
        method: 'PUT',
        headers: { ...headers, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          memberId,
          name: editTitle.trim(),
          icon: iconString,
          color: editColor,
        }),
      });
      if (!res.ok) throw new Error(`PUT habits failed: ${res.status}`);
      updateWeekHabits((hs) =>
        hs.map((h) =>
          h.id === editHabitId
            ? {
                ...h,
                title: editTitle.trim(),
                icon: mapIconStringToElement(iconString),
                iconName: editIconName,
                color: editColor,
              }
            : h,
        ),
      );
      // The investment card shows the habit name live (server JOIN), so refresh
      // the investments list after a rename or its card keeps the old name.
      void fetchInvestments();
    } catch (err) {
      console.error('Failed to update habit:', err);
    }
    closeEditDialog();
  };

  // ── Habit-level sticker toggle (cosmetic badges on the card) ─────────────
  const toggleSticker = (habitId: string, stickerId: string) => {
    if (readOnly) return;
    updateWeekHabits((hs) =>
      hs.map((h) => {
        if (h.id !== habitId) return h;
        const has = h.stickers.includes(stickerId);
        return {
          ...h,
          stickers: has ? h.stickers.filter((s) => s !== stickerId) : [...h.stickers, stickerId],
        };
      }),
    );
  };

  // ── Day sticker placement / removal (optimistic) ─────────────────────────
  const selectDaySticker = async (habitId: string, dayIndex: number, stickerId: string) => {
    if (readOnly) return;
    if (!week || !headers) return;
    // Capture the prior cell so a failed REPLACE restores the old sticker
    // rather than wiping the cell (review FHS-293).
    const previousValue = habits.find((h) => h.id === habitId)?.progress[dayIndex] ?? false;
    // Optimistic
    updateWeekHabits((hs) =>
      hs.map((h) => {
        if (h.id !== habitId) return h;
        const np = [...h.progress];
        np[dayIndex] = stickerId;
        return {
          ...h,
          progress: np,
          total: np.filter((p) => typeof p === 'string' || p === true).length,
        };
      }),
    );
    setDayStickerDialog(null);
    try {
      const res = await fetch(`${API_BASE}/api/habits/${habitId}/stickers`, {
        method: 'POST',
        headers: { ...headers, 'Content-Type': 'application/json' },
        body: JSON.stringify({ memberId, weekId: week.weekId, day: dayIndex, sticker: stickerId }),
      });
      if (!res.ok) throw new Error(`sticker POST failed: ${res.status}`);
      // Refresh the dependent cards immediately: Bankable This Week (week
      // stats) and Active Investments (value tracks completed/missed days).
      void fetchWeekStats(week.weekId);
      void fetchInvestments();
    } catch (err) {
      console.error('Failed to place sticker:', err);
      // Revert to the prior value (old sticker or empty).
      updateWeekHabits((hs) =>
        hs.map((h) => {
          if (h.id !== habitId) return h;
          const np = [...h.progress];
          np[dayIndex] = previousValue;
          return {
            ...h,
            progress: np,
            total: np.filter((p) => typeof p === 'string' || p === true).length,
          };
        }),
      );
    }
  };

  const clearDay = async (habitId: string, dayIndex: number) => {
    if (readOnly) return;
    if (!week || !headers) return;
    const previousValue = habits.find((h) => h.id === habitId)?.progress[dayIndex];
    // Optimistic
    updateWeekHabits((hs) =>
      hs.map((h) => {
        if (h.id !== habitId) return h;
        const np = [...h.progress];
        np[dayIndex] = false;
        return {
          ...h,
          progress: np,
          total: np.filter((p) => typeof p === 'string' || p === true).length,
        };
      }),
    );
    try {
      const res = await fetch(`${API_BASE}/api/habits/${habitId}/stickers`, {
        method: 'DELETE',
        headers: { ...headers, 'Content-Type': 'application/json' },
        body: JSON.stringify({ memberId, weekId: week.weekId, day: dayIndex }),
      });
      if (!res.ok) throw new Error(`sticker DELETE failed: ${res.status}`);
      // Refresh the dependent cards immediately (Bankable + Active Investments).
      void fetchWeekStats(week.weekId);
      void fetchInvestments();
    } catch (err) {
      console.error('Failed to clear sticker:', err);
      // Revert (restore the prior sticker; a non-string/false prior means
      // nothing to restore).
      if (previousValue !== undefined && previousValue !== false) {
        updateWeekHabits((hs) =>
          hs.map((h) => {
            if (h.id !== habitId) return h;
            const np = [...h.progress];
            np[dayIndex] = previousValue;
            return {
              ...h,
              progress: np,
              total: np.filter((p) => typeof p === 'string' || p === true).length,
            };
          }),
        );
      }
    }
  };

  // ── Add new habit ─────────────────────────────────────────────────────────
  const addNewHabit = async () => {
    if (readOnly) return;
    if (!newHabitTitle.trim() || !headers) return;
    const iconString = ICON_NAME_MAP[newHabitIconName] ?? 'star';
    try {
      const res = await fetch(`${API_BASE}/api/habits`, {
        method: 'POST',
        headers: { ...headers, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          memberId,
          name: newHabitTitle.trim(),
          icon: iconString,
          color: newHabitColor,
        }),
      });
      if (!res.ok) throw new Error(`habit POST failed: ${res.status}`);
      // The create endpoint returns the habit object directly (not wrapped).
      const created = (await res.json()) as ApiHabit;
      const newHabit: Habit = {
        id: String(created.id),
        title: created.name,
        icon: mapIconStringToElement(created.icon),
        iconName: newHabitIconName,
        color: created.color,
        isBonus: false,
        progress: [false, false, false, false, false, false, false],
        total: 0,
        target: 7,
        stickers: [],
      };
      updateWeekHabits((hs) => [...hs, newHabit]);
      setNewHabitTitle('');
      setNewHabitColor('bg-pink-400');
      setNewHabitIconName('Star');
      setShowAddHabit(false);
    } catch (err) {
      console.error('Failed to add habit:', err);
    }
  };

  // ── Delete habit ──────────────────────────────────────────────────────────
  const deleteHabit = async (id: string) => {
    if (readOnly) return;
    if (!headers) return;
    try {
      const res = await fetch(`${API_BASE}/api/habits/${id}`, {
        method: 'DELETE',
        headers: { ...headers, 'Content-Type': 'application/json' },
        body: JSON.stringify({ memberId }),
      });
      if (!res.ok) throw new Error(`habit DELETE failed: ${res.status}`);
      updateWeekHabits((hs) => hs.filter((h) => h.id !== id));
    } catch (err) {
      console.error('Failed to delete habit:', err);
    }
  };

  // ── Reward redemption ─────────────────────────────────────────────────────
  const onRedeem = useCallback(
    async (reward: Reward) => {
      // FHS-374: kids can't redeem directly; a parent approves a request
      // (FHS-376). Read-only mode never reaches the redeem control anyway.
      if (readOnly) return;
      if (!headers || redeemingRef.current.has(reward.id)) return;
      if (balance < reward.stickerCost) return;
      redeemingRef.current.add(reward.id);
      try {
        const res = await fetch(`${API_BASE}/api/rewards/${reward.id}/redeem`, {
          method: 'POST',
          headers: { ...headers, 'Content-Type': 'application/json' },
          body: JSON.stringify({ memberId }),
        });
        if (!res.ok) return;
        const body = (await res.json()) as { stickerBalance: number };
        setBalance(body.stickerBalance);
      } catch (err) {
        console.error('Failed to redeem reward:', err);
      } finally {
        redeemingRef.current.delete(reward.id);
      }
    },
    [headers, balance, memberId, readOnly],
  );

  // ── Reward request (kid asks; a parent approves: FHS-376) ────────────────
  const onRequestReward = useCallback(
    async (reward: Reward) => {
      if (!api?.rewardRequest || redeemingRef.current.has(reward.id)) return;
      // Match the server: a request is paid from savings on approval.
      if (savingsStars < reward.stickerCost) return;
      redeemingRef.current.add(reward.id);
      try {
        const res = await fetch(api.rewardRequest(reward.id), {
          method: 'POST',
          headers: { ...api.headers, 'Content-Type': 'application/json' },
        });
        if (!res.ok) return;
        // Optimistically flip the card to "asked / pending".
        setRewards((prev) =>
          prev.map((r) => (r.id === reward.id ? { ...r, requestStatus: 'pending' } : r)),
        );
      } catch {
        // non-fatal: the kid can tap again
      } finally {
        redeemingRef.current.delete(reward.id);
      }
    },
    [api, savingsStars],
  );

  // ── Dialogs lookup ────────────────────────────────────────────────────────
  const currentHabit = habits.find((h) => h.id === stickerDialogId);
  const dayStickerHabit = dayStickerDialog
    ? habits.find((h) => h.id === dayStickerDialog.habitId)
    : null;

  // ── Habit card renderer (mirrors legacy renderHabitCard exactly) ──────────
  const renderHabitCard = (
    habit: Habit,
    editEnabled: boolean,
    editDayFn: (i: number) => boolean,
    // FHS-607: the habit's investment, or undefined when it has none. Carries
    // both the kind and the growth rate (FHS-534), which the tag needs.
    investment: Investment | undefined,
    // FHS-342: adding/editing/deleting a habit is admin-only. Sticker
    // affordances stay on `editEnabled` so a normal user can still tick.
    canManageHabits: boolean,
    // FHS-399: when true, replace the live "Progress this week" label with
    // the finalized "PROGRESS THAT WEEK X/7" pill used in the kid view.
    weekIsFinalized = false,
  ) => (
    <div
      className={`relative ${
        investment
          ? 'bg-amber-50 border-2 sm:border-3 border-amber-400'
          : 'bg-white border-2 sm:border-3 border-black'
      } rounded-2xl p-4 md:p-6 transition-transform ${
        editEnabled
          ? 'motion-safe:group-hover:-translate-y-1 motion-safe:group-hover:-translate-x-1'
          : ''
      }`}
    >
      <div className="flex flex-col md:flex-row md:items-center gap-6">
        {/* LEFT: icon + name + progress + sticker badges */}
        <div className={`flex items-center gap-4 md:w-1/3 ${editEnabled ? 'sm:pr-8' : ''}`}>
          <div
            className={`w-10 h-10 sm:w-14 sm:h-14 flex-shrink-0 ${habit.color} border-2 sm:border-3 border-black rounded-xl flex items-center justify-center shadow-neo`}
          >
            {habit.icon}
          </div>

          <div className="flex-1 min-w-0">
            <div className="flex items-start gap-2">
              <div className="flex-1 min-w-0">
                <h3
                  className="font-black text-lg leading-tight"
                  data-testid={`habit-card-title-${habit.id}`}
                >
                  {habit.title}
                </h3>
              </div>
              {canManageHabits && (
                <button
                  data-testid={`habit-card-edit-btn-${habit.id}`}
                  onClick={() => openEditDialog(habit)}
                  className="text-gray-300 hover:text-pink-500 transition-colors flex-shrink-0"
                  title="Edit habit"
                >
                  <Edit2 className="w-4 h-4" />
                </button>
              )}
            </div>

            {/* FHS-607: on phone and tablet the tag sits under the habit name,
                where it cannot push the day circles. From desktop it moves to
                the right column instead (see below). */}
            {investment && (
              <div className="mt-1 lg:hidden">
                <InvestmentTag
                  testId={`habit-card-invested-badge-${habit.id}`}
                  multiplier={investment.coefficient ?? 5}
                  deductible={investment.deductible}
                />
              </div>
            )}

            {/* Progress bar */}
            <div className="w-full bg-gray-200 h-3 rounded-full mt-2 border-2 border-black overflow-hidden">
              <div
                className={`h-full ${habit.color}`}
                style={{ width: `${(habit.total / habit.target) * 100}%` }}
              />
            </div>
            {weekIsFinalized ? (
              <p
                data-testid={`habit-finalized-progress-${habit.id}`}
                className="text-xs font-black text-gray-700 uppercase tracking-wide mt-1"
              >
                Progress that week{' '}
                {/* Neutral pill so text stays readable regardless of habit colour */}
                <span className="inline-flex items-center justify-center rounded-full border-2 border-black bg-gray-100 text-gray-800 px-2 py-0.5 text-[10px] font-black">
                  {habit.total}/{habit.target}
                </span>
              </p>
            ) : (
              <p className="text-xs text-gray-500 font-mono mt-1">
                Progress this week{' '}
                <span className="font-black text-gray-700">
                  {habit.total}/{habit.target}
                </span>
              </p>
            )}

            {/* Habit-level sticker badges */}
            {habit.stickers.length > 0 && (
              <div className="flex items-center gap-1.5 mt-2">
                {habit.stickers.map((stickerId) => {
                  const sticker = AVAILABLE_STICKERS.find((s) => s.id === stickerId);
                  if (!sticker) return null;
                  return (
                    <div
                      key={stickerId}
                      className={`${sticker.color} border-2 border-black rounded-lg p-1 flex items-center justify-center`}
                      title={sticker.name}
                    >
                      {cloneElement(sticker.icon, { className: 'w-3 h-3' })}
                    </div>
                  );
                })}
                {editEnabled && (
                  <button
                    onClick={() => setStickerDialogId(habit.id)}
                    className="text-xs font-bold text-pink-500 hover:text-pink-600 underline ml-1"
                  >
                    Edit
                  </button>
                )}
              </div>
            )}
            {habit.stickers.length === 0 && editEnabled && (
              <button
                onClick={() => setStickerDialogId(habit.id)}
                className="text-xs font-bold text-gray-400 hover:text-pink-500 mt-2 flex items-center gap-1"
              >
                <Star className="w-3 h-3" /> Add stickers
              </button>
            )}
          </div>
        </div>

        {/* RIGHT: 7-day grid. FHS-406: the tag sits in-flow above the grid (it
            was an absolute badge that overlapped the day cells). FHS-607: from
            desktop this is the design's top-right position; below lg the tag
            renders under the habit name instead, so it shows exactly once. */}
        <div className="flex-1">
          {investment && (
            <div className="mb-2 hidden justify-end lg:flex">
              <InvestmentTag
                testId={`habit-card-invested-badge-lg-${habit.id}`}
                multiplier={investment.coefficient ?? 5}
                deductible={investment.deductible}
              />
            </div>
          )}
          <div className="grid grid-cols-7 gap-1 sm:gap-2">
            {daysShort.map((day, index) => {
              const dayValue = habit.progress[index];
              const isSticker = typeof dayValue === 'string';
              const sticker = isSticker ? AVAILABLE_STICKERS.find((s) => s.id === dayValue) : null;
              return (
                <div key={index} className="flex flex-col items-center gap-1">
                  <span
                    className={`text-xs font-black font-mono ${
                      editDayFn(index) ? 'text-gray-400' : 'text-gray-300'
                    }`}
                  >
                    {day}
                  </span>
                  <button
                    data-testid={`habit-day-cell-${habit.id}-${index}`}
                    aria-pressed={isSticker}
                    onClick={() => {
                      if (!editDayFn(index)) return;
                      if (isSticker) {
                        void clearDay(habit.id, index);
                        return;
                      }
                      setDayStickerDialog({ habitId: habit.id, dayIndex: index });
                    }}
                    disabled={!editDayFn(index)}
                    className={`w-full aspect-square min-h-[44px] rounded-lg border-2 flex items-center justify-center transition-all ${
                      isSticker && sticker
                        ? editDayFn(index)
                          ? `${sticker.color} shadow-neo-xs translate-x-[-2px] translate-y-[-2px] border-black hover:opacity-80`
                          : readOnly
                            ? `${sticker.color} border-black`
                            : `${sticker.color} border-gray-300 opacity-40 cursor-not-allowed grayscale-[30%]`
                        : dayValue === true
                          ? `${habit.color} shadow-neo-xs translate-x-[-2px] translate-y-[-2px] border-black`
                          : editDayFn(index)
                            ? 'bg-gray-100 hover:bg-pink-50 border-black'
                            : readOnly
                              ? 'bg-gray-50 border-gray-200'
                              : 'bg-gray-50 border-gray-200 opacity-30 cursor-not-allowed'
                    }`}
                  >
                    {isSticker && sticker ? (
                      cloneElement(sticker.icon, { className: 'w-4 h-4' })
                    ) : dayValue === true ? (
                      <Check className="w-5 h-5" />
                    ) : !editDayFn(index) && !readOnly ? (
                      <Lock className="w-3 h-3 text-gray-300" />
                    ) : null}
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Delete X: top-right (admin-only, FHS-342) */}
      {canManageHabits && (
        <button
          data-testid={`habit-card-delete-btn-${habit.id}`}
          onClick={() => setDeleteConfirmId(habit.id)}
          className="absolute top-4 right-4 text-gray-300 hover:text-red-500 transition-colors"
          title="Delete habit"
        >
          <X className="w-4 h-4" />
        </button>
      )}
    </div>
  );

  // ── Loading state ─────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="space-y-6" data-testid="habit-tracker-loading">
        <div className="bg-white border-2 sm:border-3 border-black rounded-2xl p-4 sm:p-6 shadow-neo flex items-center justify-center">
          <div className="text-center">
            <Sparkles className="w-8 h-8 sm:w-10 sm:h-10 text-pink-400 mx-auto mb-3 animate-pulse" />
            <p className="font-black text-gray-700 text-base sm:text-lg uppercase">
              Loading Habits...
            </p>
            <p className="text-sm text-gray-400 mt-1">Fetching your weekly data</p>
          </div>
        </div>
      </div>
    );
  }

  // ── No data / error state ─────────────────────────────────────────────────
  if (!week || weeks.length === 0) {
    return (
      <div className="space-y-6" data-testid="habit-tracker-no-data">
        <div className="bg-white border-2 sm:border-3 border-black rounded-2xl p-4 sm:p-6 shadow-neo flex items-center justify-center">
          <div className="text-center">
            <Star className="w-8 h-8 sm:w-10 sm:h-10 text-yellow-400 mx-auto mb-3" />
            <p className="font-black text-gray-700 text-base sm:text-lg uppercase">
              No Weeks Found
            </p>
            <p className="text-sm text-gray-400 mt-1">
              Something went wrong loading your habit data.
            </p>
            <button
              onClick={() => void fetchData()}
              data-testid="habit-tracker-retry-btn"
              className="mt-4 bg-pink-400 border-2 border-black text-black font-black text-sm px-6 py-3 rounded-xl shadow-neo-sm hover:brightness-105 active:translate-y-0.5 transition-all"
            >
              Retry
            </button>
          </div>
        </div>
        {/* keep error testid for callers that check it */}
        <p data-testid="my-world-error" className="sr-only">
          No data
        </p>
      </div>
    );
  }

  // ── Main render ───────────────────────────────────────────────────────────
  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-12" data-testid="my-world">
      {/* ════════════════════════════════════════════════════════════════════
          HABIT TRACKER: left column (lg:col-span-8). 8/4 split: the habit
          tracker (Weekly Habits / Analytics) gets the room; the right widget
          column is narrower (FHS-327). On a finalised week the right column
          is hidden so the left goes full-width (FHS-316).
          ════════════════════════════════════════════════════════════════════ */}
      {/* FHS-608: a finished week keeps the 8/4 split too, so the Final summary
          sits beside the habit cards instead of below them. */}
      <div className="space-y-6 lg:col-span-8">
        {/* ── Day Sticker Dialog ── */}
        {dayStickerDialog && dayStickerHabit && canEdit && (
          // eslint-disable-next-line jsx-a11y/no-static-element-interactions, jsx-a11y/click-events-have-key-events
          <div
            data-testid="habit-day-sticker-dialog"
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
            onClick={() => setDayStickerDialog(null)}
          >
            {/* eslint-disable-next-line jsx-a11y/no-static-element-interactions, jsx-a11y/click-events-have-key-events */}
            <div
              className="relative bg-white border-2 sm:border-3 border-black rounded-2xl shadow-neo-lg max-w-md w-full"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between px-6 py-4 border-b-2 border-gray-100">
                <div className="flex items-center gap-3">
                  <div className={`${dayStickerHabit.color} p-2 rounded-lg border-2 border-black`}>
                    {dayStickerHabit.icon}
                  </div>
                  <div>
                    <h2 className="text-lg font-black uppercase">Select Sticker</h2>
                    <p className="text-xs text-gray-500 font-bold">
                      {days[dayStickerDialog.dayIndex]} – {dayStickerHabit.title}
                    </p>
                  </div>
                </div>
                <button
                  data-testid="habit-day-sticker-dialog-close-btn"
                  onClick={() => setDayStickerDialog(null)}
                  className="w-8 h-8 min-h-[44px] min-w-[44px] flex items-center justify-center bg-gray-100 hover:bg-red-100 hover:text-red-600 rounded-xl transition-colors"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
              <div className="p-6">
                {/* FHS-479: the 4 looks are a cosmetic choice only, so
                    spell that out right where the pick happens. */}
                <p
                  data-testid="habit-day-sticker-hint"
                  className="mb-2 flex items-start gap-1.5 rounded-lg border-2 border-purple-200 bg-purple-50 px-3 py-2 text-xs font-bold text-purple-700"
                >
                  <Sparkles className="h-3.5 w-3.5 shrink-0 translate-y-0.5" aria-hidden="true" />
                  <span>Just pick your favourite look: it&apos;s worth the same either way.</span>
                </p>
                {/* FHS-480: the sticker→cash rate isn't shown anywhere the
                    sticker is actually picked; surface it here too. */}
                <p
                  data-testid="habit-day-sticker-value"
                  className="mb-4 text-xs font-bold text-gray-500"
                >
                  1 sticker = {money(stickerRate)}
                </p>
                <div className="grid grid-cols-2 gap-4 mb-4">
                  {AVAILABLE_STICKERS.map((sticker) => (
                    <button
                      key={sticker.id}
                      data-testid={`habit-day-sticker-option-${sticker.id}`}
                      onClick={() =>
                        void selectDaySticker(
                          dayStickerDialog.habitId,
                          dayStickerDialog.dayIndex,
                          sticker.id,
                        )
                      }
                      className={`${sticker.color} min-h-[44px] border-2 sm:border-3 border-black rounded-xl p-5 sm:p-6 flex flex-col items-center gap-2 transition-all motion-safe:hover:-translate-y-1 hover:shadow-neo`}
                    >
                      {sticker.icon}
                      <span className="text-sm font-black uppercase">{sticker.name}</span>
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ── Habit-level Sticker Dialog ── */}
        {stickerDialogId && currentHabit && (
          // eslint-disable-next-line jsx-a11y/no-static-element-interactions, jsx-a11y/click-events-have-key-events
          <div
            data-testid="habit-sticker-dialog"
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
            onClick={() => setStickerDialogId(null)}
          >
            {/* eslint-disable-next-line jsx-a11y/no-static-element-interactions, jsx-a11y/click-events-have-key-events */}
            <div
              className="relative bg-white border-2 sm:border-3 border-black rounded-2xl shadow-neo-lg max-w-lg w-full"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between px-6 py-4 border-b-2 border-gray-100">
                <div className="flex items-center gap-3">
                  <div className="bg-pink-400 p-2 rounded-lg border-2 border-black">
                    <Star className="w-5 h-5" />
                  </div>
                  <h2 className="text-xl font-black uppercase">My Stickers 💖</h2>
                </div>
                <button
                  data-testid="habit-sticker-dialog-close-btn"
                  onClick={() => setStickerDialogId(null)}
                  className="w-8 h-8 min-h-[44px] min-w-[44px] flex items-center justify-center bg-gray-100 hover:bg-red-100 hover:text-red-600 rounded-xl transition-colors"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
              <div className="p-6">
                <p className="text-sm text-gray-600 font-bold mb-4">
                  Select stickers for: <span className="text-black">{currentHabit.title}</span>
                </p>
                <div className="grid grid-cols-2 gap-3">
                  {AVAILABLE_STICKERS.map((sticker) => {
                    const isSelected = currentHabit.stickers.includes(sticker.id);
                    return (
                      <button
                        key={sticker.id}
                        onClick={() => toggleSticker(stickerDialogId, sticker.id)}
                        className={`${sticker.color} border-2 sm:border-3 rounded-xl p-4 flex flex-col items-center gap-2 transition-all relative ${
                          isSelected
                            ? 'border-black shadow-neo -translate-y-1'
                            : 'border-gray-300 hover:border-black'
                        }`}
                      >
                        {sticker.icon}
                        <span className="text-xs font-black uppercase">{sticker.name}</span>
                        {isSelected && (
                          <Check className="w-5 h-5 absolute top-2 right-2 text-black" />
                        )}
                      </button>
                    );
                  })}
                </div>
                <button
                  data-testid="habit-sticker-dialog-done-btn"
                  onClick={() => setStickerDialogId(null)}
                  className="w-full mt-6 bg-pink-400 border-2 border-black text-black font-black text-sm px-6 py-3 rounded-xl shadow-neo-sm hover:brightness-105 active:translate-y-0.5 transition-all"
                >
                  Done
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ── Add New Habit Dialog ── */}
        {showAddHabit && (
          // eslint-disable-next-line jsx-a11y/no-static-element-interactions, jsx-a11y/click-events-have-key-events
          <div
            data-testid="habit-add-dialog"
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
            onClick={() => setShowAddHabit(false)}
          >
            {/* eslint-disable-next-line jsx-a11y/no-static-element-interactions, jsx-a11y/click-events-have-key-events */}
            <div
              className="relative bg-white border-2 sm:border-3 border-black rounded-2xl shadow-neo-lg max-w-lg w-full"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between px-6 py-4 border-b-2 border-gray-100">
                <div className="flex items-center gap-3">
                  <div className="bg-pink-400 p-2 rounded-lg border-2 border-black">
                    <Plus className="w-5 h-5" />
                  </div>
                  <h2 className="text-xl font-black uppercase">Add New Habit</h2>
                </div>
                <button
                  data-testid="habit-add-dialog-close-btn"
                  onClick={() => setShowAddHabit(false)}
                  className="w-8 h-8 min-h-[44px] min-w-[44px] flex items-center justify-center bg-gray-100 hover:bg-red-100 hover:text-red-600 rounded-xl transition-colors"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
              <div className="p-6 space-y-4">
                <div>
                  <label
                    htmlFor="habit-add-title"
                    className="text-xs font-black text-gray-600 uppercase tracking-widest mb-2 block"
                  >
                    Habit Title
                  </label>
                  <input
                    id="habit-add-title"
                    data-testid="habit-add-title-input"
                    value={newHabitTitle}
                    onChange={(e) => setNewHabitTitle(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && void addNewHabit()}
                    placeholder="e.g., I was kind today"
                    className="w-full font-bold text-sm border-2 border-gray-200 rounded-xl px-4 py-3 outline-none focus:border-pink-400"
                  />
                </div>
                <div>
                  <label
                    htmlFor="habit-add-icon-group"
                    className="text-xs font-black text-gray-600 uppercase tracking-widest mb-2 block"
                  >
                    Choose Icon
                  </label>
                  <div id="habit-add-icon-group" className="grid grid-cols-6 gap-2">
                    {iconOptions.map((opt, i) => (
                      <button
                        key={i}
                        data-testid={`habit-add-icon-${i}`}
                        onClick={() => setNewHabitIconName(opt.name)}
                        className={`w-full aspect-square rounded-lg border-2 flex items-center justify-center transition-all ${
                          newHabitIconName === opt.name
                            ? 'border-black bg-pink-50'
                            : 'border-gray-200 hover:border-gray-400'
                        }`}
                      >
                        {opt.icon}
                      </button>
                    ))}
                  </div>
                </div>
                <div>
                  <label
                    htmlFor="habit-add-color-group"
                    className="text-xs font-black text-gray-600 uppercase tracking-widest mb-2 block"
                  >
                    Choose Color
                  </label>
                  <div id="habit-add-color-group" className="grid grid-cols-6 gap-2 sm:grid-cols-8">
                    {colorOptions.map((opt) => (
                      <button
                        key={opt.color}
                        data-testid={`habit-add-color-${opt.color}`}
                        onClick={() => setNewHabitColor(opt.color)}
                        className={`w-full aspect-square ${opt.color} rounded-lg border-2 transition-all ${
                          newHabitColor === opt.color ? 'border-black scale-110' : 'border-gray-300'
                        }`}
                        title={opt.name}
                      />
                    ))}
                  </div>
                </div>
                <div className="flex gap-2 pt-2">
                  <button
                    data-testid="habit-add-submit-btn"
                    onClick={() => void addNewHabit()}
                    className="flex-1 bg-pink-400 border-2 border-black text-black font-black text-sm px-6 py-3 rounded-xl shadow-neo-sm hover:brightness-105 active:translate-y-0.5 transition-all"
                  >
                    Add Habit
                  </button>
                  <button
                    data-testid="habit-add-cancel-btn"
                    onClick={() => setShowAddHabit(false)}
                    className="bg-gray-100 border-2 border-black text-gray-600 font-black text-sm px-6 py-3 rounded-xl hover:bg-gray-200 transition-all"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ── Delete Confirmation Dialog ── */}
        {deleteConfirmId &&
          (() => {
            const habitToDelete = habits.find((h) => h.id === deleteConfirmId);
            if (!habitToDelete) return null;
            return (
              // eslint-disable-next-line jsx-a11y/no-static-element-interactions, jsx-a11y/click-events-have-key-events
              <div
                data-testid="habit-delete-dialog"
                className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
                onClick={() => setDeleteConfirmId(null)}
              >
                {/* eslint-disable-next-line jsx-a11y/no-static-element-interactions, jsx-a11y/click-events-have-key-events */}
                <div
                  className="relative bg-white border-2 sm:border-3 border-black rounded-2xl shadow-neo-lg max-w-sm w-full"
                  onClick={(e) => e.stopPropagation()}
                >
                  <div className="flex items-center gap-3 px-6 py-4 border-b-2 border-gray-100">
                    <div className="bg-red-100 p-2 rounded-lg border-2 border-red-300">
                      <X className="w-5 h-5 text-red-600" />
                    </div>
                    <h2 className="text-lg font-black uppercase text-gray-800">Delete Habit</h2>
                  </div>
                  <div className="p-6">
                    <p className="text-sm text-gray-600 font-bold mb-1">
                      Are you sure you want to delete
                    </p>
                    <div className="flex items-center gap-3 bg-gray-50 border-2 border-gray-200 rounded-xl p-3 mb-4">
                      <div
                        className={`w-8 h-8 ${habitToDelete.color} border-2 border-black rounded-lg flex items-center justify-center`}
                      >
                        {habitToDelete.icon}
                      </div>
                      <span className="font-black text-gray-800">{habitToDelete.title}</span>
                    </div>
                    <p className="text-xs text-gray-400 mb-5">
                      This will remove the habit and all its stickers permanently.
                    </p>
                    <div className="flex gap-2">
                      <button
                        data-testid="habit-delete-confirm-btn"
                        onClick={async () => {
                          await deleteHabit(deleteConfirmId);
                          setDeleteConfirmId(null);
                        }}
                        className="flex-1 bg-red-500 border-2 border-black text-white font-black text-sm px-6 py-3 rounded-xl shadow-neo-sm hover:bg-red-600 active:translate-y-0.5 transition-all"
                      >
                        Delete
                      </button>
                      <button
                        data-testid="habit-delete-cancel-btn"
                        onClick={() => setDeleteConfirmId(null)}
                        className="flex-1 bg-gray-100 border-2 border-black text-gray-600 font-black text-sm px-6 py-3 rounded-xl hover:bg-gray-200 transition-all"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            );
          })()}

        {/* ── Edit Habit Dialog ── */}
        {editHabitId && (
          // eslint-disable-next-line jsx-a11y/no-static-element-interactions, jsx-a11y/click-events-have-key-events
          <div
            data-testid="habit-edit-dialog"
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
            onClick={closeEditDialog}
          >
            {/* eslint-disable-next-line jsx-a11y/no-static-element-interactions, jsx-a11y/click-events-have-key-events */}
            <div
              className="relative bg-white border-2 sm:border-3 border-black rounded-2xl shadow-neo-lg max-w-lg w-full"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between px-6 py-4 border-b-2 border-gray-100">
                <div className="flex items-center gap-3">
                  <div className="bg-fuchsia-400 p-2 rounded-lg border-2 border-black">
                    <Edit2 className="w-5 h-5" />
                  </div>
                  <h2 className="text-xl font-black uppercase">Edit Habit</h2>
                </div>
                <button
                  data-testid="habit-edit-dialog-close-btn"
                  onClick={closeEditDialog}
                  className="w-8 h-8 min-h-[44px] min-w-[44px] flex items-center justify-center bg-gray-100 hover:bg-red-100 hover:text-red-600 rounded-xl transition-colors"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
              <div className="p-6 space-y-4">
                <div>
                  <label
                    htmlFor="habit-edit-title"
                    className="text-xs font-black text-gray-600 uppercase tracking-widest mb-2 block"
                  >
                    Habit Title
                  </label>
                  <input
                    id="habit-edit-title"
                    data-testid="habit-edit-title-input"
                    value={editTitle}
                    onChange={(e) => setEditTitle(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && void saveEditHabit()}
                    placeholder="e.g., I was kind today"
                    className="w-full font-bold text-sm border-2 border-gray-200 rounded-xl px-4 py-3 outline-none focus:border-pink-400"
                  />
                </div>
                <div>
                  <label
                    htmlFor="habit-edit-icon-group"
                    className="text-xs font-black text-gray-600 uppercase tracking-widest mb-2 block"
                  >
                    Choose Icon
                  </label>
                  <div id="habit-edit-icon-group" className="grid grid-cols-6 gap-2">
                    {iconOptions.map((opt, i) => (
                      <button
                        key={i}
                        data-testid={`habit-edit-icon-${i}`}
                        onClick={() => setEditIconName(opt.name)}
                        className={`w-full aspect-square rounded-lg border-2 flex items-center justify-center transition-all ${
                          editIconName === opt.name
                            ? 'border-black bg-pink-50'
                            : 'border-gray-200 hover:border-gray-400'
                        }`}
                      >
                        {opt.icon}
                      </button>
                    ))}
                  </div>
                </div>
                <div>
                  <label
                    htmlFor="habit-edit-color-group"
                    className="text-xs font-black text-gray-600 uppercase tracking-widest mb-2 block"
                  >
                    Choose Color
                  </label>
                  <div
                    id="habit-edit-color-group"
                    className="grid grid-cols-6 gap-2 sm:grid-cols-8"
                  >
                    {colorOptions.map((opt) => (
                      <button
                        key={opt.color}
                        data-testid={`habit-edit-color-${opt.color}`}
                        onClick={() => setEditColor(opt.color)}
                        className={`w-full aspect-square ${opt.color} rounded-lg border-2 transition-all ${
                          editColor === opt.color ? 'border-black scale-110' : 'border-gray-300'
                        }`}
                        title={opt.name}
                      />
                    ))}
                  </div>
                </div>
                <div className="flex gap-2 pt-2">
                  <button
                    data-testid="habit-edit-submit-btn"
                    onClick={() => void saveEditHabit()}
                    className="flex-1 bg-fuchsia-400 border-2 border-black text-black font-black text-sm px-6 py-3 rounded-xl shadow-neo-sm hover:brightness-105 active:translate-y-0.5 transition-all"
                  >
                    Save Changes
                  </button>
                  <button
                    data-testid="habit-edit-cancel-btn"
                    onClick={closeEditDialog}
                    className="bg-gray-100 border-2 border-black text-gray-600 font-black text-sm px-6 py-3 rounded-xl hover:bg-gray-200 transition-all"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ── Tab Switcher ── */}
        <div className="bg-white border-2 sm:border-3 border-black rounded-2xl p-2 flex gap-2 shadow-neo">
          <button
            data-testid="habit-tracker-tab-habits"
            onClick={() => setActiveTab('habits')}
            className={`flex-1 flex items-center justify-center gap-2 py-3 px-4 rounded-xl font-black text-sm transition-all ${
              activeTab === 'habits'
                ? 'bg-gradient-to-r from-purple-500 to-pink-500 text-white shadow-neo-xs'
                : 'text-gray-500 hover:bg-gray-50'
            }`}
          >
            <CheckCircle className="w-4 h-4" /> Weekly Habits
          </button>
          <button
            data-testid="habit-tracker-tab-analytics"
            onClick={() => setActiveTab('analytics')}
            className={`flex-1 flex items-center justify-center gap-2 py-3 px-4 rounded-xl font-black text-sm transition-all ${
              activeTab === 'analytics'
                ? 'bg-gradient-to-r from-purple-500 to-pink-500 text-white shadow-neo-xs'
                : 'text-gray-500 hover:bg-gray-50'
            }`}
          >
            <BarChart2 className="w-4 h-4" /> Analytics
          </button>
        </div>

        {activeTab === 'analytics' ? (
          api ? (
            <AnalyticsView analyticsUrl={api.analytics()} headers={api.headers} />
          ) : null
        ) : (
          <>
            {/* ── Week Navigator ── */}
            <div className="bg-purple-900 rounded-2xl p-4 sm:p-5 text-white border-2 sm:border-3 border-pink-400/30 relative overflow-hidden">
              <div className="absolute right-0 top-0 w-32 h-32 bg-pink-400/10 rounded-full -mr-10 -mt-10 blur-2xl" />
              <div className="relative z-10 flex items-center justify-between">
                <button
                  data-testid="habit-tracker-week-prev-btn"
                  onClick={() => setWeekIndex((i) => Math.max(0, i - 1))}
                  disabled={weekIndex === 0}
                  className="w-9 h-9 min-h-[44px] min-w-[44px] flex-shrink-0 flex items-center justify-center rounded-full hover:bg-white/10 disabled:opacity-30 transition-colors"
                >
                  <ChevronLeft className="w-5 h-5 text-white" />
                </button>

                <div className="text-center flex-1 min-w-0" data-testid="habit-tracker-week-label">
                  <div className="flex items-center justify-center gap-2">
                    <span className="font-black text-white text-lg sm:text-xl uppercase tracking-wider">
                      Week {week.weekNumber}, {week.year}
                    </span>
                    {isFutureWeek ? (
                      <span
                        data-testid="habit-tracker-week-future-badge"
                        className="bg-gray-400/20 text-gray-200 text-xs font-bold px-2.5 py-1 rounded-full border border-gray-400/30 flex items-center gap-1"
                      >
                        <Lock className="w-3 h-3" /> Not Started
                      </span>
                    ) : isCurrentWeek ? (
                      <span className="bg-blue-400/20 text-blue-200 text-xs font-bold px-2.5 py-1 rounded-full border border-blue-400/30">
                        Current
                      </span>
                    ) : (
                      <span className="bg-green-400/20 text-green-200 text-xs font-bold px-2.5 py-1 rounded-full border border-green-400/30 flex items-center gap-1">
                        <CheckCircle className="w-3 h-3" /> Finalized
                      </span>
                    )}
                  </div>
                  <p className="text-pink-300 font-mono text-sm mt-0.5">
                    {week.label.toUpperCase()}
                  </p>
                  <div
                    className="mt-1 text-xs text-yellow-400 font-black"
                    data-testid="habit-tracker-total-display"
                  >
                    {totalDone}/{totalPossible} DONE ✨
                  </div>
                </div>

                <button
                  data-testid="habit-tracker-week-next-btn"
                  onClick={() => setWeekIndex((i) => Math.min(weeks.length - 1, i + 1))}
                  disabled={weekIndex === weeks.length - 1}
                  className="w-9 h-9 min-h-[44px] min-w-[44px] flex-shrink-0 flex items-center justify-center rounded-full hover:bg-white/10 disabled:opacity-30 transition-colors"
                >
                  <ChevronRight className="w-5 h-5 text-white" />
                </button>
              </div>

              {/* FHS-608: the design's calm, parent-facing wording. It used to
                  read like the kid's copy, which is wrong for this viewer. */}
              {week.isFinalized && (
                <div
                  data-testid="finalized-week-banner"
                  className="relative z-10 mt-3 flex items-start gap-3 rounded-xl border-2 border-black bg-white px-4 py-3 shadow-neo-sm"
                >
                  <span
                    aria-hidden="true"
                    className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border-2 border-black bg-green-200"
                  >
                    <Check size={16} strokeWidth={3} className="text-black" />
                  </span>
                  <div className="min-w-0">
                    <h3 className="font-heading text-base uppercase tracking-wide text-gray-900">
                      This week is finished
                    </h3>
                    <p className="text-sm font-bold text-gray-600">
                      A record of what happened. Nothing here can be changed.
                    </p>
                  </div>
                </div>
              )}
            </div>

            {/* ── Week Loading Spinner ── */}
            {weekLoading && habits.length === 0 && (
              <div className="bg-white border-2 sm:border-3 border-black rounded-2xl p-4 sm:p-6 shadow-neo flex items-center justify-center">
                <div className="text-center">
                  <Sparkles className="w-6 h-6 text-pink-400 mx-auto mb-2 animate-pulse" />
                  <p className="font-bold text-gray-500 text-sm">Loading week data...</p>
                </div>
              </div>
            )}

            {/* ── Invested habits (no investedHabitIds prop here; section renders when empty array) ── */}
            {/* investedHabitIds is Dashboard-level state; hardcode [] for now: section stays hidden */}

            {/* FHS-608: on a finished week the cards are a record, so they get
                a heading that says so. The live week needs no heading: the
                board's own header already frames it. */}
            {week.isFinalized && habits.length > 0 && (
              <div className="flex items-center gap-2" data-testid="finalized-habits-heading">
                <span
                  aria-hidden="true"
                  className="flex h-7 w-7 items-center justify-center rounded-lg border-2 border-black bg-pink-100"
                >
                  <Star className="h-3.5 w-3.5 text-pink-500" />
                </span>
                <h2 className="font-heading text-lg uppercase tracking-widest text-pink-300">
                  Habits that week
                </h2>
                <div className="h-0.5 flex-1 rounded-full bg-purple-800/50" />
              </div>
            )}

            {/* ── Regular Habit Cards: a future week (not yet started) blurs
                the cards under a lock overlay: nothing to mark done yet
                (FHS-484). ── */}
            <div className="relative">
              {isFutureWeek && habits.length > 0 && (
                <div
                  data-testid="habit-tracker-future-week-lock"
                  className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-2 rounded-2xl border-2 sm:border-3 border-black bg-white/70 p-6 text-center backdrop-blur-sm"
                >
                  <div className="grid h-12 w-12 place-items-center rounded-full border-2 border-black bg-yellow-300 shadow-neo-xs">
                    <Lock className="h-5 w-5 text-black" aria-hidden="true" />
                  </div>
                  <p className="font-black text-sm uppercase tracking-wide text-black">
                    This week hasn&apos;t started yet
                  </p>
                  <p className="max-w-xs text-xs font-bold text-gray-600">
                    Come back on{' '}
                    {new Date(`${week.startDate}T00:00:00`).toLocaleDateString('en-US', {
                      month: 'short',
                      day: 'numeric',
                    })}{' '}
                    to start logging habits.
                  </p>
                </div>
              )}
              <div
                className={`grid gap-4 sm:gap-6 ${isFutureWeek ? 'pointer-events-none select-none blur-[2px]' : ''}`}
                aria-hidden={isFutureWeek || undefined}
              >
                {habits.map((habit) => (
                  <div
                    key={habit.id}
                    className="relative group"
                    data-testid={`habit-card-${habit.id}`}
                  >
                    <div className="absolute inset-0 bg-black rounded-2xl translate-x-1.5 translate-y-1.5" />
                    {renderHabitCard(
                      habit,
                      canEdit,
                      canEditDay,
                      investmentByHabitId.get(habit.id),
                      isAdmin && canEdit,
                      week.isFinalized,
                    )}
                  </div>
                ))}
              </div>
            </div>

            {/* ── Add New Habit button (admin-only, FHS-342) ── */}
            {isAdmin && canEdit && (
              <button
                data-testid="habit-tracker-add-habit-btn"
                onClick={() => setShowAddHabit(true)}
                className="w-full py-4 sm:py-6 rounded-2xl border-2 sm:border-3 border-dashed border-pink-400/40 text-pink-300/70 font-black text-base sm:text-xl hover:bg-pink-400/5 hover:text-pink-200 hover:border-pink-400 transition-all flex items-center justify-center gap-3 uppercase tracking-widest"
              >
                <Plus className="w-6 h-6 sm:w-8 sm:h-8" /> Add New Habit
              </button>
            )}
          </>
        )}

        {/* ════════════════════════════════════════════════════════════════════
            SAVINGS / BANKING CARDS: below habit tracker
            ════════════════════════════════════════════════════════════════════ */}

        {/* ── Your Savings + Active Investments (side by side): kid view only
            since FHS-606 moved the parent money cards into their own row.
            Current week only: a closed week shows just its records (FHS-316). ── */}
        {isCurrentWeek && readOnly && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-start">
            {/* ── Your Savings ── */}
            <div data-testid="your-savings" className="relative">
              <div className="absolute inset-0 bg-pink-400 rounded-2xl translate-x-1.5 translate-y-1.5 border-2 sm:border-3 border-black" />
              <div className="relative bg-purple-900 border-2 sm:border-3 border-pink-400/30 rounded-2xl p-4 sm:p-5">
                <div className="flex items-center gap-2 sm:gap-3 mb-4">
                  <div className="bg-pink-400 p-1.5 sm:p-2 rounded-lg border-2 border-black text-black">
                    <Wallet className="w-4 h-4 sm:w-5 sm:h-5" />
                  </div>
                  <h3 className="text-base sm:text-lg font-black text-white uppercase tracking-wide">
                    Your Savings
                  </h3>
                </div>
                <div className="flex justify-between items-center py-2 sm:py-3 border-b border-white/10">
                  <div className="flex items-center gap-2 sm:gap-3">
                    <Star className="w-4 h-4 sm:w-5 sm:h-5 text-yellow-400 fill-current" />
                    <span className="text-slate-300 font-bold text-sm sm:text-base">Stickers</span>
                  </div>
                  <div className="text-right">
                    <span className="text-2xl sm:text-3xl font-black text-yellow-400">
                      {savedStickers + Math.floor(stickersFromCash(savedCash, stickerRate))}
                    </span>
                    {savedCash > 0 && savedStickers > 0 && (
                      <p className="text-xs text-slate-300 font-bold mt-0.5">
                        {savedStickers} saved +{' '}
                        {Math.floor(stickersFromCash(savedCash, stickerRate))} from cash
                      </p>
                    )}
                  </div>
                </div>
                <div className="flex justify-between items-center pt-3 sm:pt-4">
                  <div className="flex items-center gap-2 sm:gap-3">
                    <div className="w-5 h-5 sm:w-6 sm:h-6 rounded-lg bg-lime-400 border-2 border-black text-black flex items-center justify-center text-xs font-black">
                      $
                    </div>
                    <span className="text-slate-300 font-bold text-sm sm:text-base">
                      Total Value
                    </span>
                  </div>
                  <span className="text-2xl sm:text-3xl font-black text-lime-400">
                    {money(savedStickers * stickerRate + savedCash)}
                  </span>
                </div>
              </div>
            </div>

            {renderActiveInvestments(false)}
          </div>
        )}
        {/* end side-by-side savings/investments grid */}
      </div>

      {/* ════════════════════════════════════════════════════════════════════
          RIGHT COLUMN (lg:col-span-4): Reward Requests + Rewards Shop + Bankable.
          Narrower 4/12 so the habit tracker gets more room (FHS-327). Live,
          current-week-only controls; a finalised week hides the whole column
          (FHS-316). (FHS-537/539 removed the Big-Rewards + My-Stickers cards.)
          ════════════════════════════════════════════════════════════════════ */}
      {/* ── FHS-608: Final summary (finished weeks only) ── */}
      {week && week.isFinalized && week.summary && (
        <div className="space-y-4 lg:col-span-4 lg:self-start">
          {(() => {
            const outcome = summariseWeekActions(week.summary.actions ?? []);
            const earned = week.summary.totalStickers;
            // FHS-608: an unreadable week must say so rather than show a
            // confident split built from nothing.
            const splitUnknown = week.summary.actionsFailed === true;
            // A close-week that banked everything automatically leaves no
            // explicit save action on older weeks, so fall back to what the
            // week carried over rather than showing nothing.
            // Still fetching this week: the figures are all zero until it lands,
            // and a flash of "0 earned, 0%" reads as a real answer.
            const stillLoading = weekLoading && habits.length === 0;
            const split = [
              // Only this week's own save actions. `carriedOver` is what came
              // INTO the week from the previous close, so reporting it here
              // showed the same stickers as saved in two different weeks.
              { key: 'saved', label: 'Saved', stickers: outcome.saved, bar: 'bg-cyan-300' },
              {
                key: 'invested',
                label: 'Invested',
                stickers: outcome.invested,
                bar: 'bg-green-300',
              },
              {
                key: 'spent',
                label: 'Spent on rewards',
                stickers: outcome.spent,
                bar: 'bg-pink-300',
              },
              // FHS-608: the mock had no cash-outs, but turning stickers into
              // money is a real, different outcome. Shown only when it happened.
              {
                key: 'cashed-out',
                label: 'Cashed out',
                stickers: outcome.cashedOut,
                bar: 'bg-yellow-300',
              },
            ].filter((part) => part.stickers > 0 || part.key !== 'cashed-out');
            const splitTotal = split.reduce((sum, part) => sum + part.stickers, 0);
            const percent =
              totalPossible > 0
                ? Math.min(100, Math.max(0, Math.round((totalDone / totalPossible) * 100)))
                : 0;
            if (stillLoading) return null;
            return (
              <div
                data-testid="finalized-week-summary"
                className="overflow-hidden rounded-2xl border-2 sm:border-3 border-black bg-white shadow-neo"
              >
                <div className="border-b-2 border-black bg-yellow-100 px-5 py-3">
                  <h3 className="font-heading text-lg uppercase tracking-wide text-gray-900">
                    Final summary
                  </h3>
                </div>
                <div className="flex flex-col gap-5 p-5">
                  <div>
                    <p className="text-xs font-bold uppercase tracking-widest text-gray-500">
                      Stickers earned
                    </p>
                    <div
                      data-testid="finalized-stars-earned"
                      className="mt-1 flex flex-wrap items-baseline gap-2"
                    >
                      <span className="font-heading text-3xl text-gray-900">{earned}</span>
                      <span className="font-bold text-green-700">
                        = {money(earned * stickerRate)}
                      </span>
                    </div>
                  </div>

                  {splitUnknown && (
                    <p
                      data-testid="finalized-split-unavailable"
                      className="text-sm font-bold text-gray-600"
                    >
                      We could not load what happened that week. Try again in a moment.
                    </p>
                  )}

                  {!splitUnknown && splitTotal > 0 && (
                    <div data-testid="finalized-stars-allocation">
                      <p className="text-xs font-bold uppercase tracking-widest text-gray-500">
                        Where they went
                      </p>
                      <div
                        className="mt-2 flex h-4 w-full overflow-hidden rounded-full border-2 border-black bg-gray-100"
                        role="img"
                        aria-label={split
                          .map((part) => `${part.stickers} ${part.label.toLowerCase()}`)
                          .join(', ')}
                      >
                        {split.map(
                          (part) =>
                            part.stickers > 0 && (
                              <div
                                key={part.key}
                                className={`h-full ${part.bar} border-r-2 border-black last:border-r-0`}
                                style={{ width: `${(part.stickers / splitTotal) * 100}%` }}
                              />
                            ),
                        )}
                      </div>
                      <ul className="mt-2 flex flex-col gap-1.5">
                        {split.map((part) => (
                          <li
                            key={part.key}
                            data-testid={`finalized-${part.key}-stars`}
                            className="flex items-center justify-between gap-3"
                          >
                            <span className="flex items-center gap-2 text-sm font-bold text-gray-900">
                              <span
                                aria-hidden="true"
                                className={`h-3 w-3 shrink-0 rounded-full border-2 border-black ${part.bar}`}
                              />
                              {part.label}
                            </span>
                            {/* FHS-619: a sticker count never stands alone on
                                this board; its money value rides beside it. */}
                            <span className="whitespace-nowrap text-sm font-bold text-gray-900">
                              {part.stickers} stickers{' '}
                              <span className="font-bold text-gray-500">
                                ({money(part.stickers * stickerRate)})
                              </span>
                            </span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {totalPossible === 0 ? (
                    <p
                      data-testid="finalized-no-habits"
                      className="border-t-2 border-gray-100 pt-4 text-sm font-bold text-gray-600"
                    >
                      No habits are on record for that week.
                    </p>
                  ) : (
                    <div className="border-t-2 border-gray-100 pt-4">
                      <div className="flex items-center justify-between gap-3">
                        <span className="font-bold text-gray-900">Habit days done</span>
                        <span
                          data-testid="finalized-days-done"
                          className="whitespace-nowrap font-heading text-xl text-gray-900"
                        >
                          {totalDone} of {totalPossible}
                        </span>
                      </div>
                      <div
                        className="mt-2 h-4 w-full overflow-hidden rounded-full border-2 border-black bg-gray-100"
                        role="img"
                        aria-label={`${totalDone} of ${totalPossible} habit days done, ${percent} percent`}
                      >
                        <div className="h-full bg-yellow-300" style={{ width: `${percent}%` }} />
                      </div>
                      <p
                        data-testid="finalized-completion-message"
                        className="mt-1.5 text-sm font-bold text-gray-600"
                      >
                        {percent}% of the week&rsquo;s habits were done.
                      </p>
                    </div>
                  )}
                </div>
              </div>
            );
          })()}
        </div>
      )}

      {isCurrentWeek && (
        <div className="space-y-4 lg:col-span-4 lg:self-start">
          {/* FHS-392: Reward Requests in-context sidebar (parent/admin only).
              The panel handles its own admin gate; showing the list to any
              non-kid viewer matches the Magic Patterns mock. */}
          {!readOnly && memberId && (
            <div data-testid="reward-requests-sidebar">
              {/* The panel is its own labelled region (reward-requests-heading);
                  no extra landmark needed here. */}
              <RewardRequestsPanel memberId={memberId} />
            </div>
          )}

          <section
            aria-labelledby="rewards-shop-heading"
            className="rounded-xl border-2 border-black bg-white p-4 shadow-neo-sm md:p-6"
            data-testid="rewards-shop"
          >
            <div className="mb-4 flex items-center justify-between">
              <h2 id="rewards-shop-heading" className="font-heading text-xl text-black">
                {readOnly ? 'Reward Goals' : 'Rewards Shop'}
              </h2>
              <span
                data-testid="sticker-balance"
                className="flex items-center gap-1.5 rounded-full border-2 border-black bg-black px-3 py-1.5 font-heading text-sm text-white shadow-neo-xs"
              >
                <Star size={14} className="fill-yellow-300 text-yellow-300" aria-hidden="true" />
                {balance} Stars
              </span>
            </div>
            {rewards.length === 0 ? (
              <p
                data-testid="rewards-empty"
                className="py-3 text-center text-sm font-bold text-gray-500"
              >
                No rewards yet. A grown-up can add some.
              </p>
            ) : (
              <ul className="grid grid-cols-1 gap-3" data-testid="rewards-grid">
                {rewards.map((r) => {
                  // Parent spends the live balance; a kid asks against savings.
                  const affordable = readOnly
                    ? savingsStars >= r.stickerCost
                    : balance >= r.stickerCost;
                  return (
                    <li
                      key={r.id}
                      data-testid={`reward-card-${r.id}`}
                      className={`flex items-center justify-between gap-2 rounded-lg border-2 border-black p-2.5 ${
                        affordable ? 'bg-white' : 'bg-gray-100 opacity-70'
                      }`}
                    >
                      <span className="min-w-0 truncate text-sm font-bold text-black">
                        {r.icon ? `${r.icon} ` : ''}
                        {r.name}
                      </span>
                      <span className="flex shrink-0 items-center gap-2">
                        <span
                          data-testid={`reward-cost-${r.id}`}
                          className="flex items-center gap-1 text-xs font-bold text-purple-700"
                        >
                          <Star size={12} className="fill-yellow-500" aria-hidden="true" />{' '}
                          {r.stickerCost}
                        </span>
                        {/* Parent redeems directly; a kid asks and a parent
                            approves (FHS-376). */}
                        {!readOnly && (
                          <Button
                            type="button"
                            variant="primary"
                            size="sm"
                            onClick={() => void onRedeem(r)}
                            disabled={!affordable}
                            testId={`reward-buy-${r.id}`}
                          >
                            {affordable ? 'Buy' : 'Locked'}
                          </Button>
                        )}
                        {readOnly &&
                          (r.requestStatus === 'approved' ? (
                            <span
                              data-testid={`reward-approved-${r.id}`}
                              className="shrink-0 rounded-full border-2 border-black bg-emerald-300 px-2.5 py-1 text-xs font-black text-black"
                            >
                              Yay! 🎉
                            </span>
                          ) : r.requestStatus === 'pending' ? (
                            <span
                              data-testid={`reward-pending-${r.id}`}
                              className="shrink-0 rounded-full border-2 border-black bg-yellow-200 px-2.5 py-1 text-xs font-bold text-black"
                            >
                              Asked ⏳
                            </span>
                          ) : r.requestStatus === 'declined' ? (
                            <span
                              data-testid={`reward-declined-${r.id}`}
                              className="shrink-0 text-xs font-bold text-gray-500"
                            >
                              Not yet
                            </span>
                          ) : affordable ? (
                            <Button
                              type="button"
                              variant="primary"
                              size="sm"
                              onClick={() => void onRequestReward(r)}
                              testId={`reward-ask-${r.id}`}
                            >
                              Ask for this 🎁
                            </Button>
                          ) : (
                            <span
                              data-testid={`reward-keepsaving-${r.id}`}
                              className="shrink-0 text-xs font-bold text-gray-400"
                            >
                              Keep saving
                            </span>
                          ))}
                      </span>
                    </li>
                  );
                })}
              </ul>
            )}
          </section>

          {/* FHS-376: kid "My Account": what's banked + what they earned this week. */}
          {readOnly && (
            <section
              data-testid="kid-my-account"
              aria-labelledby="kid-account-heading"
              className="rounded-2xl border-2 border-black bg-purple-900 p-4 shadow-neo sm:border-3"
            >
              <h2 id="kid-account-heading" className="font-heading text-lg uppercase text-white">
                My Account
              </h2>
              <p className="mb-3 text-xs font-bold uppercase tracking-widest text-slate-300">
                What you earned this week
              </p>
              <div className="rounded-xl border-2 border-black bg-emerald-50 p-4 text-center">
                <p className="text-[10px] font-bold uppercase tracking-widest text-emerald-700">
                  In your account right now
                </p>
                <p className="mt-1 flex items-center justify-center gap-1 text-3xl font-black text-emerald-700">
                  {balance}
                  <Star size={22} className="fill-yellow-400 text-yellow-500" aria-hidden="true" />
                </p>
                <p className="text-lg font-black text-emerald-700" data-testid="kid-account-cash">
                  {money(balance * stickerRate)}
                </p>
                <p className="text-[10px] font-bold text-emerald-600">
                  Each star is worth {money(stickerRate)}
                </p>
              </div>
              {habits.some((h) => h.total > 0) && (
                <ul className="mt-3 space-y-2" data-testid="kid-account-earned">
                  {habits
                    .filter((h) => h.total > 0)
                    .map((h) => (
                      <li
                        key={h.id}
                        className="flex items-center justify-between gap-2 rounded-lg border-2 border-black bg-white px-3 py-1.5 text-sm font-bold text-black"
                      >
                        <span className="flex min-w-0 items-center gap-1 truncate">{h.title}</span>
                        <span className="flex shrink-0 items-center gap-1 text-purple-700">
                          +{h.total}
                          <Star size={12} className="fill-yellow-500" aria-hidden="true" />
                        </span>
                      </li>
                    ))}
                </ul>
              )}
            </section>
          )}
        </div>
      )}

      {/* ── Money row (FHS-606): Your Savings, Active Investments and This Week
          share one full-width row with matched heights. Parent only: the kid
          view keeps its simpler pair in the left column and never sees
          bankable figures (FHS-376). Current week only (FHS-316). ── */}
      {isCurrentWeek && !readOnly && (
        <div
          data-testid="money-row"
          className="grid grid-cols-1 items-stretch gap-4 md:grid-cols-2 xl:grid-cols-3 lg:col-span-12"
        >
          {/* ── Your Savings ── */}
          <div data-testid="your-savings" className="relative">
            <div className="absolute inset-0 bg-pink-400 rounded-2xl translate-x-1.5 translate-y-1.5 border-2 sm:border-3 border-black" />
            <div className="relative h-full flex flex-col bg-purple-900 border-2 sm:border-3 border-pink-400/30 rounded-2xl p-4 sm:p-5">
              <div className="flex items-center gap-2 sm:gap-3 mb-4">
                <div className="bg-pink-400 p-1.5 sm:p-2 rounded-lg border-2 border-black text-black">
                  <Wallet className="w-4 h-4 sm:w-5 sm:h-5" />
                </div>
                <h3 className="text-base sm:text-lg font-black text-white uppercase tracking-wide">
                  Your Savings
                </h3>
              </div>
              <div className="flex-1 flex flex-col gap-3">
                <div className="flex items-center justify-between gap-3">
                  <span className="flex items-center gap-2 text-slate-300 font-bold text-sm sm:text-base">
                    <Star className="w-4 h-4 sm:w-5 sm:h-5 text-yellow-400 fill-current" />
                    Stickers
                  </span>
                  <span className="text-2xl sm:text-3xl font-black text-yellow-400">
                    {savedStickers}
                  </span>
                </div>
                {/* FHS-606: the two numbers that matter, from the server so
                    they always sum to the sticker total. */}
                <div className="rounded-xl border-2 border-black bg-purple-950 p-3 flex flex-col gap-2">
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-slate-200 font-bold text-xs sm:text-sm">
                      Earned last week
                    </span>
                    <span
                      data-testid="savings-earned-last-week"
                      className="text-sm font-bold text-white"
                    >
                      {earnedLastWeekStickers}
                    </span>
                  </div>
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-slate-200 font-bold text-xs sm:text-sm">
                      Rest of the total
                    </span>
                    <span
                      data-testid="savings-kept-from-earlier"
                      className="text-sm font-bold text-white"
                    >
                      {Math.max(0, savedStickers - earnedLastWeekStickers)}
                    </span>
                  </div>
                  {savedCash > 0 && (
                    <div className="flex items-center justify-between gap-3">
                      <span className="text-slate-200 font-bold text-xs sm:text-sm">
                        Saved as cash
                      </span>
                      <span data-testid="savings-cash" className="text-sm font-bold text-white">
                        {money(savedCash)}
                      </span>
                    </div>
                  )}
                </div>
              </div>
              <div className="mt-4 pt-4 border-t-2 border-white/10 flex items-center justify-between gap-3">
                <span className="flex items-center gap-2 text-slate-300 font-bold text-sm sm:text-base">
                  <span className="w-5 h-5 sm:w-6 sm:h-6 rounded-lg bg-lime-400 border-2 border-black text-black flex items-center justify-center text-xs font-black">
                    $
                  </span>
                  Total Value
                </span>
                <span className="text-2xl sm:text-3xl font-black text-lime-400">
                  {money(savedStickers * stickerRate + savedCash)}
                </span>
              </div>
            </div>
          </div>

          {/* ── Active Investments, with the row totals ── */}
          {renderActiveInvestments(true)}

          {/* ── This Week ── */}
          <div data-testid="bankable-week" className="relative">
            <div className="absolute inset-0 bg-pink-400 rounded-2xl translate-x-1.5 translate-y-1.5 border-2 sm:border-3 border-black" />
            <div className="relative h-full flex flex-col bg-purple-900 border-2 sm:border-3 border-pink-400/30 rounded-2xl p-4 sm:p-5">
              <div className="flex items-center gap-2 sm:gap-3 mb-4">
                <div className="bg-yellow-300 p-1.5 sm:p-2 rounded-lg border-2 border-black text-black">
                  <Star className="w-4 h-4 sm:w-5 sm:h-5" />
                </div>
                <h3 className="text-base sm:text-lg font-black text-white uppercase tracking-wide">
                  This Week
                </h3>
              </div>
              <div className="flex-1 flex flex-col gap-3">
                <div
                  data-testid="bankable-week-stickers"
                  className="flex items-center justify-between gap-3"
                >
                  <span className="flex items-center gap-2 text-slate-300 font-bold text-sm sm:text-base">
                    <Star className="w-4 h-4 sm:w-5 sm:h-5 text-yellow-400 fill-current" />
                    Stickers to bank
                  </span>
                  <span className="text-2xl sm:text-3xl font-black text-yellow-400">
                    {unallocatedStickers}
                  </span>
                </div>
                {/* How the week is going, so the card carries its height. */}
                <div className="rounded-xl border-2 border-black bg-purple-950 p-3 flex flex-col gap-2">
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-slate-200 font-bold text-xs sm:text-sm">
                      Habit days done
                    </span>
                    <span data-testid="week-days-done" className="text-sm font-bold text-white">
                      {totalDone} of {totalPossible}
                    </span>
                  </div>
                  <div
                    role="img"
                    aria-label={`${totalDone} of ${totalPossible} habit days done this week`}
                    className="h-2 w-full overflow-hidden rounded-full border-2 border-black bg-purple-900"
                  >
                    <div
                      className="h-full bg-yellow-300"
                      style={{
                        width: `${totalPossible > 0 ? (totalDone / totalPossible) * 100 : 0}%`,
                      }}
                    />
                  </div>
                  <div className="mt-1 pt-2 border-t-2 border-white/10 flex items-center justify-between gap-3">
                    <span className="text-slate-200 font-bold text-xs sm:text-sm">
                      One sticker is
                    </span>
                    <span data-testid="week-sticker-rate" className="text-sm font-bold text-white">
                      {money(stickerRate)}
                    </span>
                  </div>
                  <p className="text-xs font-bold text-slate-300">
                    Invested habits are counted separately
                  </p>
                </div>
              </div>
              <div className="mt-4 pt-4 border-t-2 border-white/10 flex items-center justify-between gap-3">
                <span className="flex items-center gap-2 text-slate-300 font-bold text-sm sm:text-base">
                  <span className="w-5 h-5 sm:w-6 sm:h-6 rounded-lg bg-lime-400 border-2 border-black text-black flex items-center justify-center text-xs font-black">
                    $
                  </span>
                  Worth
                </span>
                <span
                  data-testid="bankable-week-value"
                  className="text-2xl sm:text-3xl font-black text-lime-400"
                >
                  {weeklyValue}
                </span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Close Week Banner: full width (only from the week's last day) ── */}
      {showCloseWeekBanner && (
        <div className="lg:col-span-12">
          <div data-testid="my-world-close-week-banner" className="mt-2">
            <div className="bg-yellow-400 border-2 sm:border-3 border-black rounded-2xl p-4 sm:p-5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 sm:gap-4 shadow-neo">
              <div className="flex items-center gap-3">
                <div className="text-2xl sm:text-3xl">🗓️</div>
                <div>
                  <h3 className="font-black text-black text-base sm:text-lg">
                    Are you ready to close the week?
                  </h3>
                  <p className="text-black/60 text-xs sm:text-sm font-medium">
                    Review your stickers and choose what to do with them
                  </p>
                </div>
              </div>
              <button
                data-testid="my-world-close-week-banner-btn"
                onClick={() => setCloseWeekOpen(true)}
                className="flex-shrink-0 bg-black text-yellow-400 font-black px-4 sm:px-6 py-2 sm:py-3 rounded-xl border-2 border-black hover:bg-gray-900 active:translate-y-0.5 transition-all whitespace-nowrap text-sm sm:text-base w-full sm:w-auto text-center"
              >
                Close Week →
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Close Week Dialog ── */}
      {week && !week.isFinalized && headers && (
        <MoneyActionsSheet
          isOpen={closeWeekOpen}
          action="chooser"
          child={{ id: memberId, name: memberName }}
          snapshot={{
            available: unallocatedStickers,
            saved: savedStickers,
            // Today's value, matching what `invested` means on Kids money.
            invested: investments.reduce((sum, inv) => sum + inv.currentValueStickers, 0),
            currency,
            stickerRate,
          }}
          weekId={week.weekId}
          memberId={memberId}
          headers={headers}
          onClose={() => setCloseWeekOpen(false)}
          onSaved={() => {
            void fetchSavings();
            void fetchInvestments();
            // The sticker count the chooser shows, and the ceiling the Save and
            // Invest flows offer, both come from the week's stats. Without this
            // a second action in the same sitting is offered a stale total.
            if (week) void fetchWeekStats(week.weekId);
          }}
          // Kids money is an admin screen, so the button is only offered to one.
          onSeeMoney={
            isAdmin
              ? () => {
                  // Kids money opens on whichever child the link names, so it
                  // lands on THIS child rather than the family's first one.
                  navigate(`/t/${slug}/money?child=${memberId}`);
                }
              : undefined
          }
          onWeekFinalized={(nextWeekId) => {
            // Deliberately does NOT close the sheet: it is showing the "week
            // closed" message, and the parent dismisses it themselves. Closing
            // it here unmounted the sheet in the same render that message
            // appeared, so nobody ever saw it.
            //
            // FHS-642: and deliberately SILENT. A loud refresh flips the board
            // to its loading screen, which is an early return, so the sheet
            // unmounted anyway and came back on the chooser.
            // Refresh all data and jump to the newly-created week
            void fetchData({ silent: true }).then(() => {
              setWeeks((prev) => {
                const nextIdx = prev.findIndex((w) => w.weekId === nextWeekId);
                if (nextIdx >= 0) setWeekIndex(nextIdx);
                return prev;
              });
            });
            void fetchSavings();
            void fetchInvestments();
          }}
        />
      )}
    </div>
  );
}
