import { useCallback, useEffect, useMemo, useState } from 'react';
import { Coffee, Cookie, Moon, Sun, Utensils } from 'lucide-react';
import { API_BASE } from '../../app/lib/api';

// FHS-365: kid Meals tab (read-only). Reads GET /api/kid/meals, which the
// server already scopes to this kid + family-wide entries (no client filter).

interface Meal {
  id: string;
  dayOfWeek: string;
  slot: string;
  name: string;
  memberId: string | null;
  recurring: boolean;
}

const DAYS: Array<{ key: string; label: string }> = [
  { key: 'mon', label: 'Monday' },
  { key: 'tue', label: 'Tuesday' },
  { key: 'wed', label: 'Wednesday' },
  { key: 'thu', label: 'Thursday' },
  { key: 'fri', label: 'Friday' },
  { key: 'sat', label: 'Saturday' },
  { key: 'sun', label: 'Sunday' },
];
const SLOT_ORDER = ['breakfast', 'lunch', 'dinner', 'snack'];
const SLOT_ICON: Record<string, typeof Coffee> = {
  breakfast: Coffee,
  lunch: Sun,
  dinner: Moon,
  snack: Cookie,
};
const DAY_TINT = [
  'bg-yellow-50',
  'bg-pink-50',
  'bg-cyan-50',
  'bg-violet-50',
  'bg-emerald-50',
  'bg-orange-50',
  'bg-sky-50',
];

type Status = 'loading' | 'ready' | 'error';

export function KidMealsPanel({ kidToken }: { kidToken: string | null }) {
  const [status, setStatus] = useState<Status>('loading');
  const [meals, setMeals] = useState<Meal[]>([]);

  const load = useCallback(
    async (signal?: AbortSignal) => {
      if (!kidToken) {
        setStatus('error');
        return;
      }
      try {
        const res = await fetch(`${API_BASE}/api/kid/meals`, {
          headers: { Authorization: `Bearer ${kidToken}` },
          signal: signal ?? null,
        });
        if (!res.ok) {
          setStatus('error');
          return;
        }
        const body = (await res.json()) as { meals?: Meal[] };
        setMeals((body.meals ?? []).filter((m) => (m.name ?? '').trim() !== ''));
        setStatus('ready');
      } catch (err) {
        if (err instanceof Error && err.name === 'AbortError') return;
        setStatus('error');
      }
    },
    [kidToken],
  );

  useEffect(() => {
    const ac = new AbortController();
    void load(ac.signal);
    return () => ac.abort();
  }, [load]);

  const byDay = useMemo(() => {
    const map = new Map<string, Meal[]>();
    for (const m of meals) {
      const arr = map.get(m.dayOfWeek);
      if (arr) arr.push(m);
      else map.set(m.dayOfWeek, [m]);
    }
    for (const arr of map.values()) {
      arr.sort((a, b) => SLOT_ORDER.indexOf(a.slot) - SLOT_ORDER.indexOf(b.slot));
    }
    return map;
  }, [meals]);

  if (status === 'loading') {
    return (
      <p data-testid="kid-meals-loading" aria-busy="true" className="text-sm font-bold text-white">
        Loading your meals…
      </p>
    );
  }
  if (status === 'error') {
    return (
      <p data-testid="kid-meals-error" role="alert" className="text-sm font-bold text-red-300">
        Couldn&rsquo;t load your meals. Try again.
      </p>
    );
  }
  if (meals.length === 0) {
    return (
      <div
        data-testid="kid-meals-empty"
        className="rounded-xl border-2 border-black bg-white p-8 text-center shadow-neo-sm"
      >
        <p aria-hidden="true" className="text-5xl">
          🍽️
        </p>
        <p className="mt-3 text-sm font-bold text-gray-600">No meals planned for you this week.</p>
      </div>
    );
  }

  return (
    <div className="rounded-xl border-2 border-black bg-white p-4 shadow-neo-sm md:p-6">
      <h2 className="mb-5 flex items-center gap-3 font-heading text-2xl uppercase tracking-wide text-black">
        <Utensils size={24} className="text-pink-500" aria-hidden="true" /> My Yummy Meals 😋
      </h2>
      <div
        className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5"
        data-testid="kid-meals-tab"
      >
        {DAYS.filter((d) => (byDay.get(d.key) ?? []).length > 0).map((d, di) => (
          <section
            key={d.key}
            data-testid={`kid-meal-day-${d.key}`}
            aria-labelledby={`kid-meal-day-h-${d.key}`}
            className={`rounded-xl border-2 border-black p-4 shadow-neo-sm ${DAY_TINT[di % DAY_TINT.length]}`}
          >
            <h3
              id={`kid-meal-day-h-${d.key}`}
              className="mb-2 border-b-2 border-black pb-2 font-heading text-lg text-black"
            >
              {d.label}
            </h3>
            <ul className="space-y-2">
              {(byDay.get(d.key) ?? []).map((m) => {
                const Icon = SLOT_ICON[m.slot] ?? Utensils;
                return (
                  <li
                    key={m.id}
                    data-testid={`kid-meal-item-${m.id}`}
                    className="flex items-center gap-2 rounded-lg border-2 border-black bg-white p-2"
                  >
                    <Icon size={18} className="shrink-0 text-gray-700" aria-hidden="true" />
                    <span className="min-w-0">
                      <span className="block text-[10px] font-bold uppercase tracking-wider text-gray-500">
                        {m.slot}
                      </span>
                      <span className="block truncate text-sm font-bold text-black">{m.name}</span>
                    </span>
                  </li>
                );
              })}
            </ul>
          </section>
        ))}
      </div>
    </div>
  );
}
