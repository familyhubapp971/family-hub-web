import { useEffect, useState } from 'react';
import { PiggyBank, Star, TrendingUp } from 'lucide-react';
import { API_BASE } from '../../../app/lib/api';

// FHS-399 - "What I Did That Week" recap card shown on the FINALIZED kid week.
// Single card: stars earned + cash value, where stars went (Saved / Planted),
// and a completion-% badge. Data for Saved/Planted fetched via
// GET /api/kid/weeks/:id/actions (Bearer kidToken).

import { formatMoney, summariseWeekActions } from '@familyhub/shared';

interface WeekAction {
  actionType: string;
  stickersUsed: number | null;
}

interface RecapProps {
  weekId: string;
  headers: Record<string, string>;
  earnedThisWeek: number; // sum of habit-progress days (already computed by KidMyWorld)
  stickerRate: number;
  currency: string;
  doneThisView: number;
  totalThisView: number;
}

function computeCompletion(done: number, total: number): number {
  if (total <= 0) return 0;
  return Math.min(100, Math.round((done / total) * 100));
}

// FHS-608: the split comes from the one shared function, so a kid and their
// parent can never read different numbers off the same finished week. This
// copy netted no withdrawals, so a week that invested 10 and pulled 4 back
// showed the kid "Planted 10" while the parent's card said 6.
//
// The old carriedOverStickers fallback is gone with it: that figure is what
// came INTO the week from the previous close, not what this week saved.
function mapActions(actions: WeekAction[]) {
  const { saved, invested } = summariseWeekActions(actions);
  return { saved, planted: invested };
}

export function KidFinishedWeekRecap({
  weekId,
  headers,
  earnedThisWeek,
  stickerRate,
  currency,
  doneThisView,
  totalThisView,
}: RecapProps) {
  const [saved, setSaved] = useState<number | null>(null);
  const [planted, setPlanted] = useState<number | null>(null);
  const [actionsStatus, setActionsStatus] = useState<'loading' | 'ready' | 'error'>('loading');

  useEffect(() => {
    let cancelled = false;
    setActionsStatus('loading');
    setSaved(null);
    setPlanted(null);

    (async () => {
      try {
        const res = await fetch(`${API_BASE}/api/kid/weeks/${weekId}/actions`, { headers });
        if (cancelled) return;
        if (!res.ok) {
          setActionsStatus('error');
          return;
        }
        const body = (await res.json()) as { actions: WeekAction[] };
        if (cancelled) return;
        const { saved: s, planted: p } = mapActions(body.actions ?? []);
        setSaved(s);
        setPlanted(p);
        setActionsStatus('ready');
      } catch {
        if (!cancelled) setActionsStatus('error');
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [weekId, headers]);

  const pct = computeCompletion(doneThisView, totalThisView);
  const cashValue = formatMoney(earnedThisWeek * stickerRate, currency);

  return (
    <section
      data-testid="kid-finished-week-recap"
      className="overflow-hidden rounded-xl border-2 border-black bg-white shadow-neo-sm"
    >
      {/* Header */}
      <div className="flex items-center gap-3 border-b-2 border-gray-100 bg-purple-50 px-5 py-4">
        <span className="text-xl" aria-hidden="true">
          &#127942;
        </span>
        <h3 className="font-heading text-base uppercase tracking-wide text-black sm:text-lg">
          What I Did That Week
        </h3>
      </div>

      <div className="space-y-4 p-5">
        {/* Stars Earned */}
        <div
          data-testid="kid-recap-stars-earned"
          className="flex items-center gap-3 rounded-xl border-2 border-yellow-300 bg-yellow-50 px-4 py-3"
        >
          <Star className="h-6 w-6 flex-shrink-0 fill-current text-yellow-500" aria-hidden="true" />
          <div className="min-w-0 flex-1">
            <p className="text-[10px] font-black uppercase tracking-widest text-yellow-700">
              Stars Earned
            </p>
            <p className="font-heading text-2xl leading-none text-yellow-700">
              {earnedThisWeek}
              <span className="ml-2 text-sm font-bold text-yellow-600">= {cashValue}</span>
            </p>
          </div>
        </div>

        {/* Where My Stars Went: always rendered so the allocation testid is
            always present; content varies by state. */}
        <div data-testid="kid-recap-stars-allocation" className="space-y-2">
          <p className="text-[10px] font-black uppercase tracking-widest text-gray-500">
            Where My Stars Went
          </p>
          {actionsStatus === 'loading' && (
            <p className="text-xs font-bold text-gray-400">Loading...</p>
          )}
          {actionsStatus === 'error' && (
            <p className="text-xs font-bold text-gray-400">
              Couldn&rsquo;t load star details right now.
            </p>
          )}
          {actionsStatus === 'ready' && (saved ?? 0) === 0 && (planted ?? 0) === 0 && (
            <p data-testid="kid-recap-no-activity" className="text-sm font-bold text-gray-500">
              No stars earned this week. There&rsquo;s always next week!
            </p>
          )}
          {actionsStatus === 'ready' && (
            <>
              {(saved ?? 0) > 0 && (
                <div
                  data-testid="kid-recap-saved-stars"
                  className="flex items-center gap-3 rounded-xl border-2 border-cyan-300 bg-cyan-50 px-4 py-2.5"
                >
                  <PiggyBank className="h-5 w-5 flex-shrink-0 text-cyan-600" aria-hidden="true" />
                  <p className="text-sm font-bold text-cyan-800">
                    Saved {saved} star{saved !== 1 ? 's' : ''}
                  </p>
                </div>
              )}
              {(planted ?? 0) > 0 && (
                <div
                  data-testid="kid-recap-planted-stars"
                  className="flex items-center gap-3 rounded-xl border-2 border-emerald-300 bg-emerald-50 px-4 py-2.5"
                >
                  <TrendingUp
                    className="h-5 w-5 flex-shrink-0 text-emerald-600"
                    aria-hidden="true"
                  />
                  <p className="text-sm font-bold text-emerald-800">
                    Planted {planted} star{planted !== 1 ? 's' : ''}
                  </p>
                </div>
              )}
            </>
          )}
        </div>

        {/* Completion line + % badge */}
        <div
          data-testid="kid-recap-completion"
          className="flex items-center justify-between gap-3 rounded-xl border-2 border-purple-200 bg-purple-50 px-4 py-3"
        >
          <p
            data-testid="kid-recap-completion-message"
            className="text-sm font-bold text-purple-700"
          >
            {pct >= 50 ? 'Great job! You finished' : 'Here’s how this week went - you finished'}
          </p>
          <span
            data-testid="kid-recap-completion-pct"
            className="flex-shrink-0 rounded-full border-2 border-black bg-purple-500 px-3 py-1 text-sm font-black text-white shadow-neo-xs"
          >
            {pct}%
          </span>
        </div>
        <p className="text-center font-mono text-[10px] text-gray-400">of your habits that week</p>
      </div>
    </section>
  );
}
