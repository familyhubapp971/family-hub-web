import { Heart, Lock } from 'lucide-react';
import { habitIcon } from './icons';
import type { KidHabitView } from './types';

const DAY_LABELS = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];
// Full names for screen readers: the visible M/T/W/T/F/S/S are ambiguous
// (two T's, two S's), so AT announces the full day instead.
const FULL_DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

// FHS-376: a single read-only kid habit card. Left = identity (coloured icon
// disc, name, thin progress bar, "PROGRESS THIS WEEK x/7"). Right = 7 day cells
// (done = pink heart; the live week's first not-yet-done day is an open white
// cell; earlier missed days show a small lock; future weeks just look empty).
//
// `isCurrentWeek` lets us draw the "today is open / earlier is locked" look only
// on the live week. A finalized past week shows plain done/not-done with no lock
// theatre and no open cell.
export function KidHabitCard({
  habit,
  isCurrentWeek,
}: {
  habit: KidHabitView;
  isCurrentWeek: boolean;
}) {
  const Icon = habitIcon(habit.icon);
  // On the live week, the first not-done day is the "open" cell to encourage;
  // everything before it that is not done reads as a missed (locked) day.
  const firstOpenDay = isCurrentWeek ? habit.days.findIndex((d) => !d) : -1;

  return (
    <div
      data-testid={`kid-habit-card-${habit.id}`}
      className="flex flex-col gap-4 rounded-xl border-2 border-black bg-white p-4 shadow-neo-sm transition-transform motion-safe:hover:-translate-y-0.5 md:flex-row md:items-center md:justify-between"
    >
      {/* LEFT: identity */}
      <div className="flex items-center gap-4 md:w-1/2">
        <div
          className={`grid h-16 w-16 shrink-0 place-items-center rounded-xl border-2 border-black text-black shadow-neo-xs ${habit.color}`}
        >
          <Icon size={28} aria-hidden="true" />
        </div>
        <div className="min-w-0 flex-1">
          <h3 className="truncate font-heading text-lg text-black">{habit.name}</h3>
          <div className="mt-2 h-2 w-full overflow-hidden rounded-full border-2 border-black bg-gray-100">
            <div
              className={`h-full ${habit.color}`}
              style={{ width: `${(habit.progress / habit.total) * 100}%` }}
            />
          </div>
          <p className="mt-1 text-[10px] font-bold uppercase tracking-wider text-gray-500">
            Progress this week{' '}
            <span className="text-gray-800">
              {habit.progress}/{habit.total}
            </span>
          </p>
        </div>
      </div>

      {/* RIGHT: 7 day cells */}
      <div className="grid grid-cols-7 gap-1">
        {DAY_LABELS.map((label, i) => {
          const done = habit.days[i];
          const isOpen = i === firstOpenDay;
          const isPastMissed = isCurrentWeek && !done && firstOpenDay >= 0 && i < firstOpenDay;
          return (
            <div key={i} className="flex flex-col items-center gap-1">
              <span className="text-[10px] font-bold text-gray-400" aria-hidden="true">
                {label}
              </span>
              <div
                data-testid={`kid-habit-day-${habit.id}-${i}`}
                role="img"
                aria-label={`${habit.name}, ${FULL_DAYS[i]}: ${
                  done ? 'done' : isPastMissed ? 'missed' : 'not done'
                }`}
                className={
                  done
                    ? 'grid min-h-[40px] w-9 place-items-center rounded-lg border-2 sm:min-h-[44px] sm:w-10 border-pink-200 bg-pink-100'
                    : isOpen
                      ? 'grid min-h-[40px] w-9 place-items-center rounded-lg border-2 sm:min-h-[44px] sm:w-10 border-black bg-white'
                      : isPastMissed
                        ? 'grid min-h-[40px] w-9 place-items-center rounded-lg border-2 sm:min-h-[44px] sm:w-10 border-gray-100 bg-gray-50'
                        : 'grid min-h-[40px] w-9 place-items-center rounded-lg border-2 sm:min-h-[44px] sm:w-10 border-gray-100 bg-gray-50'
                }
              >
                {done ? (
                  <Heart size={16} className="fill-pink-200 text-pink-300" aria-hidden="true" />
                ) : isPastMissed ? (
                  <Lock size={12} className="text-gray-300" aria-hidden="true" />
                ) : null}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
