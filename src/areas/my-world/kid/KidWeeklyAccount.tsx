import { Wallet } from 'lucide-react';
import { habitIcon } from './icons';
import type { KidHabitView } from './types';
import { formatMoney } from '@familyhub/shared';

// FHS-376: "My Account" sidebar card: what the kid earned THIS WEEK. Big star
// count, the cash it's worth, then a per-habit breakdown of where the stars
// came from. Pure presentation off the viewed week's habits.
// FHS-387: stickerRate is now supplied by the caller (no hardcoded 0.5).
export function KidWeeklyAccount({
  habits,
  earnedThisWeek,
  weeklyValue,
  currency,
  stickerRate = 0.5,
}: {
  habits: KidHabitView[];
  earnedThisWeek: number;
  weeklyValue: string;
  currency: string;
  stickerRate?: number;
}) {
  const earnedHabits = habits.filter((h) => h.progress > 0);

  return (
    <section
      data-testid="kid-my-account"
      className="overflow-hidden rounded-xl border-2 border-black shadow-neo-sm"
    >
      {/* Header strip */}
      <div className="flex items-center gap-3 bg-[#2a0b46] p-4 text-white">
        <span className="grid h-10 w-10 place-items-center rounded-full border-2 border-black bg-green-300 text-black shadow-neo-xs">
          <Wallet size={20} aria-hidden="true" />
        </span>
        <div>
          <h2 className="font-heading text-lg uppercase tracking-wide">My Account</h2>
          <p className="text-[10px] font-bold uppercase tracking-wider text-green-200">
            What you earned this week
          </p>
        </div>
      </div>

      {/* Balance section */}
      <div className="bg-green-50 p-5 text-center">
        <p className="text-[10px] font-bold uppercase tracking-widest text-green-700">
          In your account right now
        </p>
        <p className="mt-1 font-heading text-3xl text-green-700">
          {earnedThisWeek} <span aria-hidden="true">⭐</span>
        </p>
        <span
          data-testid="kid-account-cash"
          className="mt-2 inline-flex items-center gap-1.5 rounded-full border-2 border-black bg-white px-3 py-1 font-heading text-base text-green-700 shadow-neo-xs"
        >
          {weeklyValue}
        </span>
        <p className="mt-2 text-[10px] font-bold uppercase tracking-wider text-gray-400">
          Each star is worth {formatMoney(stickerRate, currency)}
        </p>
      </div>

      {/* Per-habit earned list */}
      <div className="bg-white p-5">
        {earnedHabits.length > 0 ? (
          <>
            <p className="text-sm font-bold text-gray-700">
              🎉 You earned this by being consistent with your habits this week:
            </p>
            <ul className="mt-3 space-y-2">
              {earnedHabits.map((h) => {
                const Icon = habitIcon(h.icon);
                return (
                  <li key={h.id} className="flex items-center justify-between gap-2">
                    <span className="flex min-w-0 items-center gap-2">
                      <span
                        className={`grid h-7 w-7 shrink-0 place-items-center rounded-lg border-2 border-black ${h.color}`}
                      >
                        <Icon size={14} aria-hidden="true" />
                      </span>
                      <span className="truncate text-sm font-bold text-black">{h.name}</span>
                    </span>
                    <span className="shrink-0 font-heading text-sm text-yellow-600">
                      +{h.progress} ⭐
                    </span>
                  </li>
                );
              })}
            </ul>
          </>
        ) : (
          <p className="text-sm font-bold text-gray-600">Do a habit today to start earning! 🚀</p>
        )}
      </div>

      {/* Footer encouragement */}
      <div className="bg-white px-5 pb-5">
        <div className="rounded-xl border-2 border-black bg-yellow-100 p-4">
          <h3 className="font-heading text-sm uppercase tracking-wide text-black">
            Grow your stars 💪
          </h3>
          <p className="mt-1 text-xs font-bold text-gray-700">
            {earnedThisWeek > 0
              ? 'Great job! Do your habits every day to grow your account even more. 🌟'
              : 'Start a habit today and watch your account grow! 🌟'}
          </p>
        </div>
      </div>
    </section>
  );
}
