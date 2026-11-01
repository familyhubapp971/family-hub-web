import { habitIcon } from './icons';
import type { KidAnalytics, KidHabitView } from './types';
import { formatMoney } from '@familyhub/shared';

const DAY_LABELS = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];
const FULL_DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

// FHS-376: the kid "Analytics" view: a celebration, not a chart. Hero greeting,
// three "treasure" tiles, a one-line summary banner, then a per-habit "what I did
// this week" row of day cells. Everything reads encouraging: no negative framing.
export function KidStats({
  name,
  analytics,
  habits,
  savedCash,
  currency,
}: {
  name: string;
  analytics: KidAnalytics | null;
  habits: KidHabitView[];
  savedCash: number;
  currency: string;
}) {
  // "Stickers Earned" = the real all-time sticker count (per-week totals account
  // for sticker values + bonus habits), not a sum of completed-day counts.
  const stickersEarned = (analytics?.stickersPerWeek ?? []).reduce(
    (sum, w) => sum + w.totalStickers,
    0,
  );
  const thisWeekDone = habits.reduce((sum, h) => sum + h.progress, 0);
  const possibleThisWeek = habits.length * 7;

  const rowBadge = (progress: number, total: number) => {
    if (total > 0 && progress === total) return 'Perfect Week! 🎉';
    if (progress > 0) return 'Keep going! 💪';
    return "Let's start! 🚀";
  };

  return (
    <div data-testid="kid-stats" className="flex flex-col gap-4">
      {/* Hero */}
      <div className="rounded-xl border-2 border-black bg-yellow-300 p-6 text-center shadow-neo-sm">
        <p className="text-5xl motion-safe:animate-bounce" aria-hidden="true">
          🌟
        </p>
        <h2 className="mt-2 font-heading text-2xl uppercase tracking-wide text-black">
          Wow, {name}!
        </h2>
        <p className="mt-1 text-sm font-bold text-gray-800">
          Here is everything you have earned so far!
        </p>
      </div>

      {/* Treasure tiles */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div className="rounded-xl border-2 border-black bg-yellow-100 p-5 text-center shadow-neo-sm">
          <p className="font-heading text-3xl text-black">{stickersEarned}</p>
          <p className="mt-1 text-xs font-bold uppercase tracking-wider text-gray-600">
            Stickers Earned
          </p>
        </div>
        <div className="rounded-xl border-2 border-black bg-green-100 p-5 text-center shadow-neo-sm">
          <p className="font-heading text-3xl text-black">{formatMoney(savedCash, currency)}</p>
          <p className="mt-1 text-xs font-bold uppercase tracking-wider text-gray-600">
            My Savings
          </p>
        </div>
        <div className="rounded-xl border-2 border-black bg-blue-100 p-5 text-center shadow-neo-sm">
          <p className="font-heading text-3xl text-black">{thisWeekDone}</p>
          <p className="mt-1 text-xs font-bold uppercase tracking-wider text-gray-600">
            Days Done This Week
          </p>
        </div>
      </div>

      {/* Summary banner */}
      <div className="rounded-xl border-2 border-black bg-purple-100 p-4 text-center font-bold text-black shadow-neo-sm">
        🎯 You finished {thisWeekDone}/{possibleThisWeek} habit days this week
      </div>

      {/* What I did this week */}
      <div className="rounded-xl border-2 border-black bg-white p-5 shadow-neo-sm">
        <h3 className="font-heading text-lg uppercase tracking-wide text-black">
          What I Did This Week
        </h3>
        {habits.length === 0 ? (
          <p className="mt-3 text-sm font-bold text-gray-600">
            No habits yet. Ask a grown-up to add some! 🌱
          </p>
        ) : (
          <ul className="mt-3 flex flex-col gap-4">
            {habits.map((h) => {
              const Icon = habitIcon(h.icon);
              return (
                <li key={h.id} className="flex flex-col gap-2">
                  <div className="flex items-center justify-between gap-2">
                    <span className="flex min-w-0 items-center gap-2">
                      <span
                        className={`grid h-7 w-7 shrink-0 place-items-center rounded-lg border-2 border-black ${h.color}`}
                      >
                        <Icon size={14} aria-hidden="true" />
                      </span>
                      <span className="truncate text-sm font-bold text-black">{h.name}</span>
                    </span>
                    <span className="shrink-0 text-xs font-bold text-gray-600">
                      {h.progress}/{h.total} days
                    </span>
                  </div>
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="grid grid-cols-7 gap-1 sm:gap-1.5">
                      {DAY_LABELS.map((label, i) => (
                        <div key={i} className="flex flex-col items-center gap-1">
                          <span className="text-[10px] font-bold text-gray-400" aria-hidden="true">
                            {label}
                          </span>
                          <div
                            role="img"
                            aria-label={`${h.name}, ${FULL_DAYS[i]}: ${
                              h.days[i] ? 'done' : 'not done'
                            }`}
                            className={`grid h-7 w-7 place-items-center rounded-lg border-2 border-black sm:h-8 sm:w-8 ${
                              h.days[i] ? h.color : 'bg-gray-100'
                            }`}
                          >
                            {h.days[i] ? (
                              <span className="text-xs" aria-hidden="true">
                                ⭐
                              </span>
                            ) : null}
                          </div>
                        </div>
                      ))}
                    </div>
                    <span className="shrink-0 text-xs font-bold text-gray-700">
                      {rowBadge(h.progress, h.total)}
                    </span>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}
