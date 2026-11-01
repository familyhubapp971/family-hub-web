import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Repeat, ChevronLeft, ChevronRight } from 'lucide-react';
import { Dropdown } from '@familyhub/ui';
import { useAuth } from '../../app/lib/auth-context';
import { useTenantSlug } from '../../app/lib/tenant-context';
import { API_BASE } from '../../app/lib/api';

// FHS-304 / FHS-229 / FHS-264: MealsTabPanel (Magic Patterns WeeklyMeals restyle).
//
// Visual-only restyle: neo-brutalist day cards with today/weekend variants,
// meal-type accent colours (🌅/☀️/🌙/🍪), week navigator header, member
// filter chips, and a snack section. All data fetching, handlers, and
// data-testids are preserved unchanged.

const DAYS = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'] as const;
const SLOTS = ['breakfast', 'lunch', 'dinner', 'snack'] as const;
type Day = (typeof DAYS)[number];
type Slot = (typeof SLOTS)[number];

const DAY_LABELS: Record<Day, string> = {
  mon: 'Monday',
  tue: 'Tuesday',
  wed: 'Wednesday',
  thu: 'Thursday',
  fri: 'Friday',
  sat: 'Saturday',
  sun: 'Sunday',
};

// Short labels for the day header bar (mobile-friendly).
const DAY_SHORT: Record<Day, string> = {
  mon: 'Mon',
  tue: 'Tue',
  wed: 'Wed',
  thu: 'Thu',
  fri: 'Fri',
  sat: 'Sat',
  sun: 'Sun',
};

// Weekend days (not used for today check, only for styling non-today headers).
const WEEKEND_DAYS: Day[] = ['sat', 'sun'];

const SLOT_META: Record<
  Slot,
  { label: string; emoji: string; color: string; tint: string; border: string }
> = {
  breakfast: {
    label: 'Breakfast',
    emoji: '🌅',
    color: 'text-amber-700',
    tint: 'bg-amber-50',
    border: 'border-amber-200',
  },
  lunch: {
    label: 'Lunch',
    emoji: '☀️',
    color: 'text-emerald-700',
    tint: 'bg-emerald-50',
    border: 'border-emerald-200',
  },
  dinner: {
    label: 'Dinner',
    emoji: '🌙',
    color: 'text-purple-700',
    tint: 'bg-purple-50',
    border: 'border-purple-200',
  },
  snack: {
    label: 'Snack',
    emoji: '🍪',
    color: 'text-pink-600',
    tint: 'bg-pink-50',
    border: 'border-pink-200',
  },
};

// Whole-family meals are green; each member cycles a distinct colour.
const FAMILY_COLOR = {
  card: 'bg-green-50 border-green-500',
  badge: 'bg-green-300',
  dot: 'bg-green-400',
};
// Neutral grey for a meal whose member didn't load.
const NEUTRAL_COLOR = {
  card: 'bg-gray-50 border-gray-400',
  badge: 'bg-gray-200',
  dot: 'bg-gray-300',
};
const MEMBER_COLORS = [
  { card: 'bg-amber-50 border-amber-400', badge: 'bg-amber-300', dot: 'bg-amber-300' },
  { card: 'bg-violet-50 border-violet-400', badge: 'bg-violet-300', dot: 'bg-violet-300' },
  { card: 'bg-pink-50 border-pink-400', badge: 'bg-pink-300', dot: 'bg-pink-300' },
  { card: 'bg-cyan-50 border-cyan-400', badge: 'bg-cyan-300', dot: 'bg-cyan-300' },
  { card: 'bg-rose-50 border-rose-400', badge: 'bg-rose-300', dot: 'bg-rose-300' },
  { card: 'bg-sky-50 border-sky-400', badge: 'bg-sky-300', dot: 'bg-sky-300' },
  { card: 'bg-lime-50 border-lime-400', badge: 'bg-lime-300', dot: 'bg-lime-300' },
  { card: 'bg-orange-50 border-orange-400', badge: 'bg-orange-300', dot: 'bg-orange-300' },
  { card: 'bg-teal-50 border-teal-400', badge: 'bg-teal-300', dot: 'bg-teal-300' },
  { card: 'bg-fuchsia-50 border-fuchsia-400', badge: 'bg-fuchsia-300', dot: 'bg-fuchsia-300' },
];

interface MealCell {
  id: string;
  dayOfWeek: Day;
  slot: Slot;
  name: string;
  memberId: string | null;
  recurring: boolean;
}

interface MemberLite {
  id: string;
  displayName: string;
  avatarEmoji: string | null;
}

type Status =
  | { kind: 'loading' }
  | { kind: 'ready'; meals: MealCell[]; members: MemberLite[] }
  | { kind: 'error'; message: string };

interface Editor {
  day: Day;
  mealId: string | null; // null = adding a new meal
  slot: Slot;
  name: string;
  memberId: string | null;
  recurring: boolean;
}

function colorFor(memberId: string | null, members: MemberLite[]) {
  if (memberId === null) return FAMILY_COLOR;
  const idx = members.findIndex((m) => m.id === memberId);
  if (idx < 0) return NEUTRAL_COLOR;
  return MEMBER_COLORS[idx % MEMBER_COLORS.length]!;
}

function badgeLetter(memberId: string | null, members: MemberLite[]): string {
  if (memberId === null) return 'F';
  const m = members.find((x) => x.id === memberId);
  return (m?.displayName.trim()[0] ?? '?').toUpperCase();
}

function labelFor(memberId: string | null, members: MemberLite[]): string {
  if (memberId === null) return 'Family';
  return members.find((m) => m.id === memberId)?.displayName ?? 'Family member';
}

// FHS-477: shared by the day-grid filter and the just-saved-meal check
// below, so both agree on what "matches the active filter" means.
function matchesFilter(memberId: string | null, filter: string): boolean {
  // FHS-525: "all" means everyone (assigned + family-wide); the separate
  // "Family" chip is gone, so any other value is a specific member id.
  if (filter === 'all') return true;
  return memberId === filter;
}

// Returns the ISO week number for a given date.
function isoWeekNumber(d: Date): number {
  const date = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  date.setUTCDate(date.getUTCDate() + 4 - (date.getUTCDay() || 7));
  const yearStart = new Date(Date.UTC(date.getUTCFullYear(), 0, 1));
  return Math.ceil(((date.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
}

// Monday of the week that is `offsetWeeks` away from today's week.
function mondayOfWeek(offsetWeeks: number, now: Date = new Date()): Date {
  const dayOffset = (now.getDay() + 6) % 7; // 0 = Monday
  const mon = new Date(now);
  mon.setDate(now.getDate() - dayOffset + offsetWeeks * 7);
  mon.setHours(0, 0, 0, 0);
  return mon;
}

// "Feb 23 - Mar 1, 2026" style range for the given Monday.
function weekRangeFromMonday(mon: Date): string {
  const sun = new Date(mon);
  sun.setDate(mon.getDate() + 6);
  const left = mon.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
  const right = sun.toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
  return `${left} - ${right}`;
}

// Which Day key corresponds to today (if the current week offset is 0).
function todayDayKey(now: Date = new Date()): Day | null {
  const map: Record<number, Day> = {
    1: 'mon',
    2: 'tue',
    3: 'wed',
    4: 'thu',
    5: 'fri',
    6: 'sat',
    0: 'sun',
  };
  return map[now.getDay()] ?? null;
}

// FHS-442: the Add Meal default should match the time of day it's added,
// not always "dinner". Breakfast before ~11:00, lunch until ~15:00, dinner
// until ~21:00, snack after that. The user can still pick any slot.
function defaultMealSlot(now: Date = new Date()): Slot {
  const hour = now.getHours();
  if (hour < 11) return 'breakfast';
  if (hour < 15) return 'lunch';
  if (hour < 21) return 'dinner';
  return 'snack';
}

export function MealsTabPanel() {
  const slug = useTenantSlug();
  const { session } = useAuth();
  const [status, setStatus] = useState<Status>({ kind: 'loading' });
  const [filter, setFilter] = useState<string>('all'); // 'all' | memberId (FHS-525)
  const [editor, setEditor] = useState<Editor | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [announcement, setAnnouncement] = useState('');
  // Week navigation offset (0 = current week, -1 = last week, +1 = next week).
  // Chevrons are wired to this state; the API always returns the same data
  // (no server-side week filtering), so this is display-only navigation.
  const [weekOffset, setWeekOffset] = useState(0);
  const mountedRef = useRef(true);
  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  const now = useMemo(() => new Date(), []);
  const displayMonday = useMemo(() => mondayOfWeek(weekOffset, now), [weekOffset, now]);
  const weekRange = useMemo(() => weekRangeFromMonday(displayMonday), [displayMonday]);
  const weekNum = useMemo(() => isoWeekNumber(displayMonday), [displayMonday]);
  // Only highlight today if we're viewing the current week.
  const todayKey = useMemo(() => (weekOffset === 0 ? todayDayKey(now) : null), [weekOffset, now]);

  const headers = useMemo(
    () =>
      session ? { Authorization: `Bearer ${session.access_token}`, 'x-tenant-slug': slug } : null,
    [session, slug],
  );

  const load = useCallback(
    async (signal?: AbortSignal) => {
      if (!headers) return;
      try {
        const [mealsRes, membersRes] = await Promise.all([
          fetch(`${API_BASE}/api/meals`, { headers, signal: signal ?? null }),
          fetch(`${API_BASE}/api/members`, { headers, signal: signal ?? null }),
        ]);
        if (!mountedRef.current) return;
        if (!mealsRes.ok) {
          setStatus({
            kind: 'error',
            message: `Couldn't load meals (server returned ${mealsRes.status})`,
          });
          return;
        }
        const mealsBody = (await mealsRes.json()) as { meals: MealCell[] };
        let members: MemberLite[] = [];
        if (membersRes.ok) {
          const mb = (await membersRes.json()) as { members: MemberLite[] };
          members = mb.members ?? [];
        }
        setStatus({ kind: 'ready', meals: mealsBody.meals ?? [], members });
      } catch (err) {
        if (err instanceof Error && err.name === 'AbortError') return;
        if (!mountedRef.current) return;
        setStatus({
          kind: 'error',
          message: err instanceof Error ? err.message : 'Network error. Try again.',
        });
      }
    },
    [headers],
  );

  useEffect(() => {
    if (!headers) return;
    setStatus({ kind: 'loading' });
    const ac = new AbortController();
    void load(ac.signal);
    return () => ac.abort();
  }, [headers, load]);

  const onSave = useCallback(
    async (override?: Partial<Editor>) => {
      if (!editor || !headers || saving) return;
      const ed = { ...editor, ...override };
      const trimmedName = ed.name.trim();
      setSaving(true);
      setSaveError(null);
      try {
        const res = await fetch(`${API_BASE}/api/meals`, {
          method: 'POST',
          headers: { ...headers, 'Content-Type': 'application/json' },
          body: JSON.stringify({
            dayOfWeek: ed.day,
            slot: ed.slot,
            name: trimmedName,
            memberId: ed.memberId,
            recurring: ed.recurring,
          }),
        });
        if (!res.ok) {
          setSaveError(`Couldn't save (server returned ${res.status})`);
          return;
        }
        setEditor(null);
        // FHS-477: a save whose owner doesn't match the active filter
        // used to just vanish with no explanation (it saved fine, but the
        // filtered view never showed it). Widen to "All" so a just-saved
        // meal is never silently hidden; skip this for a delete (empty
        // name) since there's nothing new to surface.
        if (trimmedName !== '' && !matchesFilter(ed.memberId, filter)) {
          setFilter('all');
          setAnnouncement(`${trimmedName} saved: showing All meals so you can see it`);
        } else if (trimmedName !== '') {
          setAnnouncement(`${trimmedName} saved`);
        }
        await load();
      } catch (err) {
        setSaveError(err instanceof Error ? err.message : 'Network error. Try again.');
      } finally {
        setSaving(false);
      }
    },
    [editor, headers, saving, load, filter],
  );

  if (status.kind === 'loading') {
    return (
      <p
        data-testid="meals-loading"
        className="text-sm font-bold text-gray-600"
        aria-live="polite"
        aria-busy="true"
      >
        Loading meals…
      </p>
    );
  }

  if (status.kind === 'error') {
    return (
      <p data-testid="meals-error" role="alert" className="text-sm font-bold text-red-600">
        {status.message}
      </p>
    );
  }

  const { meals, members } = status;

  const isVisible = (m: MealCell) => matchesFilter(m.memberId, filter);

  // Separate main slots (breakfast/lunch/dinner) from snack for layout purposes.
  const MAIN_SLOTS: Slot[] = ['breakfast', 'lunch', 'dinner'];

  return (
    <div className="space-y-5" data-testid="meals-ready">
      <p aria-live="polite" className="sr-only" data-testid="meals-announcement">
        {announcement}
      </p>
      {/* ── Header: title + week navigator ── */}
      <header className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h2 className="text-2xl font-black text-white">Weekly Meals 🍽️</h2>
          <p className="mt-0.5 font-mono text-sm text-pink-300" data-testid="meals-week-range">
            {weekRange}
          </p>
        </div>

        {/* Week navigator: ‹ Week N › */}
        <div className="flex items-center gap-2">
          <button
            type="button"
            aria-label="Previous week"
            onClick={() => setWeekOffset((n) => n - 1)}
            className="flex min-h-[44px] min-w-[44px] items-center justify-center rounded-xl border-2 border-white/20 bg-white/10 p-2 text-white transition-all hover:bg-white/20 motion-safe:transition-colors"
          >
            <ChevronLeft className="h-4 w-4" aria-hidden="true" />
          </button>

          {/* FHS-444: the number alone reads like a mystery code; the title
              tooltip spells out the real date range on hover/focus, and the
              range is also shown as the page subtitle above (meals-week-range). */}
          <span
            className="rounded-xl border-2 border-black bg-pink-400 px-3 py-1.5 text-sm font-black text-white"
            title={`Week ${weekNum}: ${weekRange}`}
            data-testid="meals-week-number"
          >
            Week {weekNum}
          </span>

          <button
            type="button"
            aria-label="Next week"
            onClick={() => setWeekOffset((n) => n + 1)}
            className="flex min-h-[44px] min-w-[44px] items-center justify-center rounded-xl border-2 border-white/20 bg-white/10 p-2 text-white transition-all hover:bg-white/20 motion-safe:transition-colors"
          >
            <ChevronRight className="h-4 w-4" aria-hidden="true" />
          </button>
        </div>
      </header>

      {/* ── Slot-type legend ── */}
      <div className="flex flex-wrap items-center gap-x-5 gap-y-1 text-xs font-bold text-white/70">
        {SLOTS.map((s) => (
          <span key={s}>
            {SLOT_META[s].emoji} {SLOT_META[s].label}
          </span>
        ))}
      </div>

      {/* ── Member legend + filter pills ── */}
      <div
        className="flex flex-col gap-3 rounded-xl border-2 border-black bg-white p-3 shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] sm:flex-row sm:items-center sm:justify-between"
        data-testid="meals-legend"
      >
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs font-bold">
          <span className="uppercase tracking-wide text-gray-500">Legend:</span>
          <LegendDot label="Family" color={FAMILY_COLOR.dot} />
          {members.map((m, i) => (
            <LegendDot
              key={m.id}
              label={m.displayName}
              color={MEMBER_COLORS[i % MEMBER_COLORS.length]!.dot}
            />
          ))}
        </div>
        <div className="flex flex-wrap gap-2" role="group" aria-label="Filter meals">
          <FilterPill
            testId="meals-filter-all"
            active={filter === 'all'}
            onClick={() => setFilter('all')}
            label="All"
          />
          {members.map((m) => (
            <FilterPill
              key={m.id}
              testId={`meals-filter-${m.id}`}
              active={filter === m.id}
              onClick={() => setFilter(m.id)}
              label={m.displayName}
            />
          ))}
        </div>
      </div>

      {/* ── Day cards ── */}
      <div className="space-y-4">
        {DAYS.map((day) => {
          const isToday = day === todayKey;
          const isWeekend = WEEKEND_DAYS.includes(day);
          const dayMeals = meals.filter((m) => m.dayOfWeek === day && isVisible(m));
          const editorOpen = editor?.day === day;

          // Day card border + shadow
          const cardBorder = isToday
            ? 'border-pink-400 shadow-[4px_4px_0px_0px_rgba(244,114,182,0.5)]'
            : 'border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]';

          // Day header bar bg
          const headerBg = isToday ? 'bg-pink-400' : isWeekend ? 'bg-purple-100' : 'bg-white';
          const dayNameColor = isToday ? 'text-black' : 'text-gray-800';

          return (
            <section
              key={day}
              data-testid={`meals-day-${day}`}
              className={`relative overflow-hidden rounded-2xl border-4 ${cardBorder}`}
              aria-labelledby={`meals-day-${day}-h`}
            >
              {/* Day header bar */}
              <div className={`flex items-center gap-3 px-4 py-3 ${headerBg}`}>
                <h4 id={`meals-day-${day}-h`} className={`font-black text-base ${dayNameColor}`}>
                  {DAY_LABELS[day]}
                  <span className="ml-1 font-normal text-sm opacity-60">({DAY_SHORT[day]})</span>
                </h4>
                {isToday && (
                  <span className="rounded-full bg-black px-2 py-0.5 text-xs font-black text-white">
                    TODAY
                  </span>
                )}
                {!isToday && isWeekend && (
                  <span className="text-xs font-bold text-purple-400">Weekend</span>
                )}
              </div>

              {/* Meal slots grid: Breakfast / Lunch / Dinner */}
              <div className="grid grid-cols-1 divide-y-2 divide-gray-100 bg-white sm:grid-cols-3 sm:divide-x-2 sm:divide-y-0">
                {MAIN_SLOTS.map((slot) => {
                  const meta = SLOT_META[slot];
                  const cells = dayMeals.filter((m) => m.slot === slot);
                  return (
                    <div
                      key={slot}
                      className="space-y-2 p-3"
                      data-testid={`meals-cell-${day}-${slot}`}
                    >
                      <p className={`text-[11px] font-bold uppercase tracking-wider ${meta.color}`}>
                        {meta.emoji} {meta.label}
                      </p>
                      {cells.map((meal) => (
                        <MealChip
                          key={meal.id}
                          meal={meal}
                          members={members}
                          onEdit={() => {
                            setSaveError(null);
                            setEditor({
                              day: meal.dayOfWeek,
                              mealId: meal.id,
                              slot: meal.slot,
                              name: meal.name,
                              memberId: meal.memberId,
                              recurring: meal.recurring,
                            });
                          }}
                        />
                      ))}
                    </div>
                  );
                })}
              </div>

              {/* Snack slot: full-width row below the main 3 */}
              <div
                className="border-t-2 border-gray-100 bg-white"
                data-testid={`meals-cell-${day}-snack`}
              >
                <div className="px-3 pb-2 pt-2">
                  <p
                    className={`text-[11px] font-bold uppercase tracking-wider ${SLOT_META.snack.color}`}
                  >
                    {SLOT_META.snack.emoji} {SLOT_META.snack.label}
                  </p>
                  <div className="mt-2 flex flex-wrap items-center gap-2">
                    {dayMeals
                      .filter((m) => m.slot === 'snack')
                      .map((meal) => (
                        <MealChip
                          key={meal.id}
                          meal={meal}
                          members={members}
                          onEdit={() => {
                            setSaveError(null);
                            setEditor({
                              day: meal.dayOfWeek,
                              mealId: meal.id,
                              slot: meal.slot,
                              name: meal.name,
                              memberId: meal.memberId,
                              recurring: meal.recurring,
                            });
                          }}
                        />
                      ))}
                    {/* Dedicated snack add: pre-sets slot='snack' so a snack
                        saved from here lands in the snack row, not dinner (FHS-317). */}
                    <button
                      type="button"
                      data-testid={`meals-add-snack-${day}`}
                      onClick={() => {
                        setSaveError(null);
                        setEditor({
                          day,
                          mealId: null,
                          slot: 'snack',
                          name: '',
                          memberId: filter === 'all' ? null : filter,
                          recurring: false,
                        });
                      }}
                      className="flex min-h-[44px] items-center gap-1 rounded-lg border-2 border-dashed border-gray-300 px-3 py-1 text-xs font-bold text-gray-500 hover:border-black hover:text-black motion-safe:transition-colors"
                    >
                      + Add snack
                    </button>
                  </div>
                </div>
              </div>

              {/* Add meal / Editor footer */}
              <div className="border-t-2 border-gray-100 bg-white p-2">
                {editorOpen ? (
                  <MealEditor
                    editor={editor}
                    members={members}
                    saving={saving}
                    saveError={saveError}
                    onChange={setEditor}
                    onSave={() => void onSave()}
                    onCancel={() => {
                      setEditor(null);
                      setSaveError(null);
                    }}
                    onDelete={() => void onSave({ name: '' })}
                  />
                ) : (
                  <button
                    type="button"
                    data-testid={`meals-add-${day}`}
                    onClick={() => {
                      setSaveError(null);
                      setEditor({
                        day,
                        mealId: null,
                        slot: defaultMealSlot(),
                        name: '',
                        memberId: filter === 'all' ? null : filter,
                        recurring: false,
                      });
                    }}
                    className="flex w-full items-center justify-center gap-1 rounded-xl border-2 border-dashed border-gray-300 py-2 text-sm font-bold text-gray-500 hover:border-black hover:text-black motion-safe:transition-colors"
                  >
                    + Add Meal
                  </button>
                )}
              </div>
            </section>
          );
        })}
      </div>
    </div>
  );
}

function LegendDot({ label, color }: { label: string; color: string }) {
  return (
    <span className="inline-flex items-center gap-1.5 text-gray-700">
      <span className={`h-3 w-3 rounded-full border-2 border-black ${color}`} aria-hidden="true" />
      {label}
    </span>
  );
}

function MealChip({
  meal,
  members,
  onEdit,
}: {
  meal: MealCell;
  members: MemberLite[];
  onEdit: () => void;
}) {
  const color = colorFor(meal.memberId, members);
  const who = labelFor(meal.memberId, members);
  return (
    <button
      type="button"
      data-testid={`meals-meal-${meal.id}`}
      onClick={onEdit}
      className={`block w-full rounded-xl border-2 border-black p-2 text-left shadow-neo-xs hover:shadow-neo-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-black motion-safe:transition-shadow ${color.card}`}
    >
      <div className="flex items-center gap-2">
        <span
          data-testid={`meals-meal-${meal.id}-avatar`}
          aria-label={who}
          title={who}
          className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full border-2 border-black text-[10px] font-bold ${color.badge}`}
        >
          {badgeLetter(meal.memberId, members)}
        </span>
        <span
          data-testid={`meals-meal-${meal.id}-name`}
          className="min-w-0 flex-1 truncate text-sm font-bold text-black"
        >
          {meal.name}
        </span>
      </div>
      {meal.recurring && (
        <span
          data-testid={`meals-meal-${meal.id}-recurring`}
          className="mt-1.5 inline-flex items-center gap-1 rounded-full border-2 border-black bg-white px-2 py-0.5 text-[10px] font-bold text-black"
        >
          <Repeat size={10} aria-hidden="true" />
          Weekly
        </span>
      )}
    </button>
  );
}

function FilterPill({
  testId,
  active,
  onClick,
  label,
}: {
  testId: string;
  active: boolean;
  onClick: () => void;
  label: string;
}) {
  return (
    <button
      type="button"
      data-testid={testId}
      onClick={onClick}
      aria-pressed={active}
      className={`min-h-[44px] rounded-full border-2 border-black px-3 py-1 text-xs font-bold motion-safe:transition-colors ${
        active ? 'bg-pink-400 text-black shadow-neo-xs' : 'bg-white text-black hover:bg-yellow-50'
      }`}
    >
      {label}
    </button>
  );
}

function MealEditor({
  editor,
  members,
  saving,
  saveError,
  onChange,
  onSave,
  onCancel,
  onDelete,
}: {
  editor: Editor;
  members: MemberLite[];
  saving: boolean;
  saveError: string | null;
  onChange: (e: Editor) => void;
  onSave: () => void;
  onCancel: () => void;
  onDelete: () => void;
}) {
  return (
    <div
      className="space-y-2 rounded-xl border-2 border-black bg-white p-2"
      data-testid="meals-editor"
      id={`meals-editor-${editor.day}`}
      role="group"
      aria-label={editor.mealId !== null ? 'Edit meal' : 'Add meal'}
    >
      <div className="flex flex-wrap gap-2">
        <div className="flex-1 text-xs font-bold text-gray-700">
          Slot
          <Dropdown
            testId="meals-editor-slot"
            ariaLabel="Slot"
            value={editor.slot}
            onChange={(v) => onChange({ ...editor, slot: v as Slot })}
            className="mt-0.5 flex min-h-[36px] w-full items-center justify-between gap-2 rounded-lg border-2 border-black bg-white px-2 py-1 text-sm font-bold text-black"
            options={SLOTS.map((s) => ({ value: s, label: SLOT_META[s].label }))}
          />
        </div>
        <div className="flex-1 text-xs font-bold text-gray-700">
          For
          <Dropdown
            testId="meals-editor-member"
            ariaLabel="For"
            value={editor.memberId ?? ''}
            onChange={(v) => onChange({ ...editor, memberId: v || null })}
            className="mt-0.5 flex min-h-[36px] w-full items-center justify-between gap-2 rounded-lg border-2 border-black bg-white px-2 py-1 text-sm font-bold text-black"
            options={[
              { value: '', label: 'Everyone (family)' },
              ...members.map((m) => ({ value: m.id, label: m.displayName })),
            ]}
          />
        </div>
      </div>

      <label className="block text-xs font-bold text-gray-700">
        Meal
        <input
          type="text"
          data-testid="meals-editor-name"
          value={editor.name}
          maxLength={120}
          // eslint-disable-next-line jsx-a11y/no-autofocus -- editor only mounts on an explicit add/edit click
          autoFocus
          onChange={(e) => onChange({ ...editor, name: e.target.value })}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              onSave();
            } else if (e.key === 'Escape') {
              e.preventDefault();
              onCancel();
            }
          }}
          placeholder="e.g. Spaghetti bolognese"
          className="mt-0.5 block w-full rounded-lg border-2 border-black px-2 py-1 text-sm text-black focus:outline-none focus:ring-2 focus:ring-yellow-400"
        />
      </label>

      <label className="flex items-center gap-2 text-xs font-bold text-gray-700">
        <input
          type="checkbox"
          data-testid="meals-editor-recurring"
          checked={editor.recurring}
          onChange={(e) => onChange({ ...editor, recurring: e.target.checked })}
          className="h-4 w-4 rounded border-2 border-black"
        />
        Repeats weekly
      </label>

      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          data-testid="meals-editor-save"
          onClick={onSave}
          disabled={saving || editor.name.trim().length === 0}
          className="min-h-[44px] rounded-lg border-2 border-black bg-yellow-300 px-3 py-1 text-sm font-bold text-black disabled:opacity-50"
        >
          {saving ? 'Saving…' : 'Save'}
        </button>
        <button
          type="button"
          data-testid="meals-editor-cancel"
          onClick={onCancel}
          disabled={saving}
          className="min-h-[44px] rounded-lg border-2 border-black bg-white px-3 py-1 text-sm font-bold text-black disabled:opacity-50"
        >
          Cancel
        </button>
        {editor.mealId !== null && (
          <button
            type="button"
            data-testid="meals-editor-delete"
            onClick={onDelete}
            disabled={saving}
            className="min-h-[44px] rounded-lg border-2 border-black bg-red-100 px-3 py-1 text-sm font-bold text-red-700 disabled:opacity-50"
          >
            Remove
          </button>
        )}
      </div>

      {saveError && (
        <p role="alert" data-testid="meals-save-error" className="text-xs font-bold text-red-600">
          {saveError}
        </p>
      )}
    </div>
  );
}
