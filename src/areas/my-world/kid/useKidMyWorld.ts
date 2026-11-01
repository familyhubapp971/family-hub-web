import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { API_BASE } from '../../../app/lib/api';
import type {
  KidAnalytics,
  KidApiHabitsResponse,
  KidApiWeek,
  KidHabitView,
  KidInvestment,
  KidReward,
  KidRewardsResponse,
  KidSavings,
} from './types';

// FHS-376: the data layer behind the dedicated kid My World. It owns every
// /api/kid/* fetch the kid screen needs, sorts + selects the current week,
// derives per-habit "done" days, and exposes the reward-request action.
//
// All calls carry the kid bearer token; none take a memberId (the server scopes
// each call to the kid the token belongs to).

export type LoadStatus = 'loading' | 'ready' | 'error';

interface KidWeekHabits {
  habits: KidHabitView[];
  balance: number;
  currency: string;
}

export interface KidMyWorldData {
  status: LoadStatus;
  reload: () => void;

  // weeks (sorted ascending) + the index the user is currently viewing
  weeks: KidApiWeek[];
  weekIndex: number;
  goPrevWeek: () => void;
  goNextWeek: () => void;
  isCurrentWeek: boolean; // viewing the latest (live) week → next is disabled
  // FHS-484: a fresh week can exist before its Monday arrives (e.g. a parent
  // finalizes this week early, which immediately creates next week). "Not
  // finalized" alone doesn't mean "has started", so callers that need to
  // lock a not-yet-started week check this instead of isCurrentWeek.
  isFutureWeek: boolean;

  // the viewed week's habits + economy headline numbers
  habits: KidHabitView[];
  balance: number; // spendable sticker balance (from the rewards feed)
  currency: string;

  // savings + investments
  savings: KidSavings | null;
  investments: KidInvestment[];

  // rewards shop
  rewards: KidReward[];
  requestReward: (rewardId: string) => void;

  // analytics
  analytics: KidAnalytics | null;

  // Fetch state of the *viewed* week's habits. Boot uses the top-level `status`;
  // this covers lazy loads when navigating to a not-yet-fetched week so the UI
  // can show a spinner (loading) or a retry (error) instead of a false "no
  // habits" empty state.
  viewWeekStatus: LoadStatus;
  retryWeek: () => void;
}

function buildHabitViews(body: KidApiHabitsResponse): KidHabitView[] {
  const stickers = body.stickers ?? [];
  return (body.habits ?? []).map((h) => {
    const days = [false, false, false, false, false, false, false];
    for (const s of stickers) {
      if (s.habitId === h.id && s.day >= 0 && s.day <= 6) days[s.day] = true;
    }
    const progress = days.filter(Boolean).length;
    return {
      id: h.id,
      name: h.name,
      color: h.color || 'bg-pink-400',
      icon: h.icon ?? 'star',
      isBonus: h.isBonus ?? false,
      days,
      progress,
      total: 7,
    };
  });
}

export function useKidMyWorld(kidToken: string | null): KidMyWorldData {
  const [status, setStatus] = useState<LoadStatus>('loading');
  const [reloadKey, setReloadKey] = useState(0);

  const [weeks, setWeeks] = useState<KidApiWeek[]>([]);
  const [weekIndex, setWeekIndex] = useState(0);
  const [weekHabits, setWeekHabits] = useState<Record<string, KidWeekHabits>>({});
  // Per-week lazy-fetch state (keyed by week id); a week is 'ready' once it
  // lands in weekHabits, so we only track in-flight + failed weeks here.
  const [weekStatus, setWeekStatus] = useState<Record<string, 'loading' | 'error'>>({});
  const [weekRetry, setWeekRetry] = useState(0);

  const [balance, setBalance] = useState(0);
  const [currency, setCurrency] = useState('USD');
  const [savings, setSavings] = useState<KidSavings | null>(null);
  const [investments, setInvestments] = useState<KidInvestment[]>([]);
  const [rewards, setRewards] = useState<KidReward[]>([]);
  const [analytics, setAnalytics] = useState<KidAnalytics | null>(null);

  const requestingRef = useRef<Set<string>>(new Set());

  const headers = useMemo(
    () => (kidToken ? { Authorization: `Bearer ${kidToken}` } : null),
    [kidToken],
  );

  const reload = useCallback(() => setReloadKey((k) => k + 1), []);

  // Fetch a single week's habits (cached by week id) and adopt the
  // headline balance/currency from it. Returns the parsed view list.
  const fetchWeekHabits = useCallback(
    async (weekId: string, signal: AbortSignal): Promise<KidWeekHabits | null> => {
      if (!headers) return null;
      const res = await fetch(`${API_BASE}/api/kid/habits?weekId=${weekId}`, { headers, signal });
      if (!res.ok) return null;
      const body = (await res.json()) as KidApiHabitsResponse;
      const view: KidWeekHabits = {
        habits: buildHabitViews(body),
        balance: body.balance ?? 0,
        currency: body.currency || 'USD',
      };
      return view;
    },
    [headers],
  );

  // ── Boot: weeks + savings + investments + rewards + analytics in parallel ──
  useEffect(() => {
    if (!headers) {
      setStatus('error');
      return;
    }
    const ac = new AbortController();
    const { signal } = ac;
    let cancelled = false;

    const getJson = async <T>(path: string): Promise<T | null> => {
      try {
        const res = await fetch(`${API_BASE}${path}`, { headers, signal });
        if (!res.ok) return null;
        return (await res.json()) as T;
      } catch (err) {
        if (err instanceof Error && err.name === 'AbortError') throw err;
        return null;
      }
    };

    (async () => {
      setStatus('loading');
      try {
        const [weeksBody, savingsBody, investmentsBody, rewardsBody, analyticsBody] =
          await Promise.all([
            getJson<{ weeks: KidApiWeek[] }>('/api/kid/weeks'),
            getJson<KidSavings>('/api/kid/financial/savings'),
            getJson<{ investments: KidInvestment[] }>('/api/kid/financial/investments'),
            getJson<KidRewardsResponse>('/api/kid/rewards'),
            getJson<KidAnalytics>('/api/kid/analytics'),
          ]);

        if (cancelled) return;
        if (!weeksBody) {
          setStatus('error');
          return;
        }

        const sorted = [...(weeksBody.weeks ?? [])].sort((a, b) =>
          a.year !== b.year ? a.year - b.year : a.weekNumber - b.weekNumber,
        );
        setWeeks(sorted);
        if (savingsBody) setSavings(savingsBody);
        if (investmentsBody) setInvestments(investmentsBody.investments ?? []);
        if (rewardsBody) {
          setRewards(rewardsBody.rewards ?? []);
          if (typeof rewardsBody.stickerBalance === 'number')
            setBalance(rewardsBody.stickerBalance);
        }
        if (analyticsBody) setAnalytics(analyticsBody);

        if (sorted.length === 0) {
          setWeekHabits({});
          setStatus('ready');
          return;
        }

        // current = last non-finalized; fall back to the last week
        const currentIdx = sorted.findIndex((w) => !w.isFinalized);
        const idx = currentIdx >= 0 ? currentIdx : sorted.length - 1;
        const active = sorted[idx]!;
        const view = await fetchWeekHabits(active.id, signal);
        if (cancelled) return;
        if (view) {
          setWeekHabits({ [active.id]: view });
          // The habits feed carries the freshest currency for the week;
          // prefer it over the rewards feed's blank default.
          setCurrency(view.currency);
        }
        setWeekIndex(idx);
        setStatus('ready');
      } catch (err) {
        if (err instanceof Error && err.name === 'AbortError') return;
        if (!cancelled) setStatus('error');
      }
    })();

    return () => {
      cancelled = true;
      ac.abort();
    };
  }, [headers, reloadKey, fetchWeekHabits]);

  // ── Lazy-load habits when navigating to a not-yet-fetched week ────────────
  useEffect(() => {
    const week = weeks[weekIndex];
    if (!week || weekHabits[week.id] || !headers) return;
    const ac = new AbortController();
    let cancelled = false;
    setWeekStatus((p) => (p[week.id] === 'loading' ? p : { ...p, [week.id]: 'loading' }));
    (async () => {
      try {
        const view = await fetchWeekHabits(week.id, ac.signal);
        if (cancelled) return;
        if (view) {
          setWeekHabits((prev) => ({ ...prev, [week.id]: view }));
          setWeekStatus((p) => {
            const next = { ...p };
            delete next[week.id];
            return next;
          });
        } else {
          setWeekStatus((p) => ({ ...p, [week.id]: 'error' }));
        }
      } catch (err) {
        if (err instanceof Error && err.name === 'AbortError') return;
        if (!cancelled) setWeekStatus((p) => ({ ...p, [week.id]: 'error' }));
      }
    })();
    return () => {
      cancelled = true;
      ac.abort();
    };
    // weekRetry lets retryWeek() re-trigger a failed week without it being in
    // the cache; weekStatus is intentionally omitted so setting 'loading'
    // doesn't re-run this effect.
  }, [weekIndex, weeks, weekHabits, headers, fetchWeekHabits, weekRetry]);

  const retryWeek = useCallback(() => {
    // Clear errored entries first so the view flips straight to the spinner
    // (no one-render error flash) before the re-fetch the nonce triggers.
    setWeekStatus((p) => {
      const next: Record<string, 'loading' | 'error'> = {};
      for (const [k, v] of Object.entries(p)) if (v !== 'error') next[k] = v;
      return next;
    });
    setWeekRetry((n) => n + 1);
  }, []);

  const goPrevWeek = useCallback(() => setWeekIndex((i) => Math.max(0, i - 1)), []);
  const goNextWeek = useCallback(
    () => setWeekIndex((i) => Math.min(weeks.length - 1, i + 1)),
    [weeks.length],
  );

  // ── Reward request (kid asks; a parent approves: optimistic to pending) ──
  const requestReward = useCallback(
    (rewardId: string) => {
      if (!headers || requestingRef.current.has(rewardId)) return;
      // Only a fresh ('none') reward can be requested: never re-ask a reward
      // that's already pending/approved/declined (guards a remount race too).
      if (rewards.find((r) => r.id === rewardId)?.requestStatus !== 'none') return;
      requestingRef.current.add(rewardId);
      // Optimistically flip the card to pending before the round-trip.
      setRewards((prev) =>
        prev.map((r) => (r.id === rewardId ? { ...r, requestStatus: 'pending' } : r)),
      );
      void (async () => {
        try {
          const res = await fetch(`${API_BASE}/api/kid/rewards/${rewardId}/request`, {
            method: 'POST',
            headers: { ...headers, 'Content-Type': 'application/json' },
          });
          if (!res.ok) {
            // revert on failure so the kid can try again
            setRewards((prev) =>
              prev.map((r) => (r.id === rewardId ? { ...r, requestStatus: 'none' } : r)),
            );
          }
        } catch {
          setRewards((prev) =>
            prev.map((r) => (r.id === rewardId ? { ...r, requestStatus: 'none' } : r)),
          );
        } finally {
          requestingRef.current.delete(rewardId);
        }
      })();
    },
    [headers, rewards],
  );

  const week = weeks[weekIndex];
  const active = week ? weekHabits[week.id] : undefined;
  // No week (e.g. zero weeks) is a legit ready-empty state, not "loading".
  const viewWeekStatus: LoadStatus = !week
    ? 'ready'
    : active
      ? 'ready'
      : weekStatus[week.id] === 'error'
        ? 'error'
        : 'loading';

  // FHS-484: startDate is a Monday-anchored 'YYYY-MM-DD' UTC string, so a
  // plain lexicographic compare against today's UTC date tells us the week
  // hasn't started yet (mirrors the same check in routes/dashboard.ts).
  const todayIso = new Date().toISOString().slice(0, 10);
  const isFutureWeek = week ? week.startDate > todayIso : false;

  return {
    status,
    reload,
    viewWeekStatus,
    retryWeek,
    weeks,
    weekIndex,
    goPrevWeek,
    goNextWeek,
    // A week is "live" only if it isn't finalized: not merely the newest index
    // (when every week is closed, the last one is still a finalized past week).
    isCurrentWeek: weeks[weekIndex]?.isFinalized === false,
    isFutureWeek,
    habits: active?.habits ?? [],
    balance,
    currency,
    savings,
    investments,
    rewards,
    requestReward,
    analytics,
  };
}
