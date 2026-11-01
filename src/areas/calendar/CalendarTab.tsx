import { useCallback, useEffect, useMemo, useState } from 'react';
import { Calendar, Clock, MapPin, Shirt } from 'lucide-react';
import { useAuth } from '../../app/lib/auth-context';
import { useTenantSlug } from '../../app/lib/tenant-context';
import { API_BASE } from '../../app/lib/api';

// FHS-269: ChildWorld Calendar tab (read-only).
//
// Reuses GET /api/events and shows just this child's events: tagged for
// them plus whole-family events (memberId === null), grouped by day. No
// create / edit / delete affordances.

interface CalEvent {
  id: string;
  date: string;
  startTime: string | null;
  endTime: string | null;
  title: string;
  notes: string | null;
  memberId: string | null;
  type: string;
  location: string | null;
  wear: string | null;
}

type Status = 'loading' | 'ready' | 'error';

// Current week's Monday as YYYY-MM-DD. GET /api/events requires a weekStart.
function mondayOf(d: Date): string {
  const copy = new Date(d);
  const offset = (copy.getDay() + 6) % 7; // 0 = Monday
  copy.setDate(copy.getDate() - offset);
  const y = copy.getFullYear();
  const m = String(copy.getMonth() + 1).padStart(2, '0');
  const day = String(copy.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

// Rotating pastel header band per day column.
const DAY_TINT = [
  'bg-yellow-300',
  'bg-pink-300',
  'bg-cyan-300',
  'bg-violet-300',
  'bg-emerald-300',
  'bg-orange-300',
  'bg-sky-300',
];

function formatDay(iso: string): string {
  const [y, m, d] = iso.split('-').map((s) => Number.parseInt(s, 10));
  // y/m/d are 1-based for a real date, so a falsy value means a missing
  // or malformed part: fall back to the raw string. (This also narrows
  // the `number | undefined` from the indexed access.)
  if (!y || !m || !d) return iso;
  return new Date(Date.UTC(y, m - 1, d)).toLocaleDateString(undefined, {
    weekday: 'long',
    month: 'short',
    day: 'numeric',
    timeZone: 'UTC',
  });
}

export function CalendarTab({ memberId }: { memberId: string }) {
  const slug = useTenantSlug();
  const { session } = useAuth();
  const [status, setStatus] = useState<Status>('loading');
  const [events, setEvents] = useState<CalEvent[]>([]);

  // Key on the token string so a Supabase refocus event (new session object,
  // same token) doesn't re-run the load.
  const accessToken = session?.access_token ?? null;
  const headers = useMemo(
    () => (accessToken ? { Authorization: `Bearer ${accessToken}`, 'x-tenant-slug': slug } : null),
    [accessToken, slug],
  );

  const load = useCallback(
    async (signal?: AbortSignal) => {
      if (!headers) return;
      try {
        const weekStart = mondayOf(new Date());
        const res = await fetch(`${API_BASE}/api/events?weekStart=${weekStart}`, {
          headers,
          signal: signal ?? null,
        });
        if (!res.ok) {
          setStatus('error');
          return;
        }
        const body = (await res.json()) as { events: CalEvent[] };
        const mine = (body.events ?? [])
          .filter((e) => e.memberId === null || e.memberId === memberId)
          .sort((a, b) =>
            a.date < b.date
              ? -1
              : a.date > b.date
                ? 1
                : (a.startTime ?? '').localeCompare(b.startTime ?? ''),
          );
        setEvents(mine);
        setStatus('ready');
      } catch (err) {
        if (err instanceof Error && err.name === 'AbortError') return;
        setStatus('error');
      }
    },
    [headers, memberId],
  );

  useEffect(() => {
    const ac = new AbortController();
    void load(ac.signal);
    return () => ac.abort();
  }, [load]);

  const byDay = useMemo(() => {
    const groups: Array<{ date: string; items: CalEvent[] }> = [];
    for (const e of events) {
      const last = groups[groups.length - 1];
      if (last && last.date === e.date) last.items.push(e);
      else groups.push({ date: e.date, items: [e] });
    }
    return groups;
  }, [events]);

  if (status === 'loading') {
    return (
      <p
        data-testid="calendar-loading"
        aria-live="polite"
        aria-busy="true"
        className="text-sm font-bold text-white"
      >
        Loading your calendar…
      </p>
    );
  }
  if (status === 'error') {
    return (
      <p data-testid="calendar-error" role="alert" className="text-sm font-bold text-red-300">
        Couldn&rsquo;t load your calendar. Try again.
      </p>
    );
  }

  if (events.length === 0) {
    return (
      <div
        data-testid="calendar-empty"
        className="rounded-xl border-2 border-black bg-white p-8 text-center shadow-neo-sm"
      >
        <p aria-hidden="true" className="text-5xl">
          📅
        </p>
        <p className="mt-3 text-sm font-bold text-gray-600">Nothing on your calendar yet.</p>
      </div>
    );
  }

  return (
    <div className="rounded-xl border-2 border-black bg-white p-4 shadow-neo-sm md:p-6">
      <h2 className="mb-5 flex items-center gap-3 font-heading text-2xl uppercase tracking-wide text-black">
        <Calendar size={24} className="text-blue-500" aria-hidden="true" /> My Schedule 📅
      </h2>
      <div
        className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5"
        data-testid="calendar-tab"
      >
        {byDay.map((group, gi) => (
          <section
            key={group.date}
            data-testid={`cal-day-${group.date}`}
            aria-labelledby={`cal-day-h-${group.date}`}
            className="overflow-hidden rounded-xl border-2 border-black bg-white shadow-neo-sm"
          >
            <h3
              id={`cal-day-h-${group.date}`}
              className={`border-b-2 border-black px-3 py-2 font-heading text-base text-black ${DAY_TINT[gi % DAY_TINT.length]}`}
            >
              {formatDay(group.date)}
            </h3>
            <ul className="space-y-2 p-3">
              {group.items.map((e) => (
                <li
                  key={e.id}
                  data-testid={`cal-event-${e.id}`}
                  className="rounded-lg border-2 border-black bg-cyan-50 p-3"
                >
                  <p className="text-sm font-bold text-black">{e.title}</p>
                  <div className="mt-1 flex flex-wrap gap-x-3 gap-y-1 text-xs font-bold text-gray-600">
                    {e.startTime && (
                      <span className="flex items-center gap-1">
                        <Clock size={12} aria-hidden="true" /> {e.startTime}
                        {e.endTime ? `–${e.endTime}` : ''}
                      </span>
                    )}
                    {e.location && (
                      <span className="flex items-center gap-1">
                        <MapPin size={12} aria-hidden="true" /> {e.location}
                      </span>
                    )}
                    {e.wear && (
                      <span className="flex items-center gap-1">
                        <Shirt size={12} aria-hidden="true" /> {e.wear}
                      </span>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          </section>
        ))}
      </div>
    </div>
  );
}
