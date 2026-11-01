import { useCallback, useEffect, useMemo, useState } from 'react';
import { Calendar, Clock, MapPin, Shirt } from 'lucide-react';
import { API_BASE } from '../../app/lib/api';

// FHS-365: kid Calendar tab (read-only). Reads GET /api/kid/events, which the
// server scopes to this kid + family-wide events for the current week.

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

// Current week's Monday (YYYY-MM-DD), computed in UTC to match the server's
// week anchoring: a local-time version would pick the wrong week near midnight
// in a +hours timezone and show an empty/next week.
function mondayOf(d: Date): string {
  const offset = (d.getUTCDay() + 6) % 7; // 0 = Monday
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate() - offset))
    .toISOString()
    .slice(0, 10);
}

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
  if (!y || !m || !d) return iso;
  return new Date(Date.UTC(y, m - 1, d)).toLocaleDateString(undefined, {
    weekday: 'long',
    month: 'short',
    day: 'numeric',
    timeZone: 'UTC',
  });
}

export function KidCalendarPanel({ kidToken }: { kidToken: string | null }) {
  const [status, setStatus] = useState<Status>('loading');
  const [events, setEvents] = useState<CalEvent[]>([]);

  const load = useCallback(
    async (signal?: AbortSignal) => {
      if (!kidToken) {
        setStatus('error');
        return;
      }
      try {
        const weekStart = mondayOf(new Date());
        const res = await fetch(`${API_BASE}/api/kid/events?weekStart=${weekStart}`, {
          headers: { Authorization: `Bearer ${kidToken}` },
          signal: signal ?? null,
        });
        if (!res.ok) {
          setStatus('error');
          return;
        }
        const body = (await res.json()) as { events?: CalEvent[] };
        setEvents(
          (body.events ?? [])
            .slice()
            .sort((a, b) =>
              a.date < b.date
                ? -1
                : a.date > b.date
                  ? 1
                  : (a.startTime ?? '').localeCompare(b.startTime ?? ''),
            ),
        );
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
        data-testid="kid-calendar-loading"
        aria-busy="true"
        className="text-sm font-bold text-white"
      >
        Loading your calendar…
      </p>
    );
  }
  if (status === 'error') {
    return (
      <p data-testid="kid-calendar-error" role="alert" className="text-sm font-bold text-red-300">
        Couldn&rsquo;t load your calendar. Try again.
      </p>
    );
  }
  if (events.length === 0) {
    return (
      <div
        data-testid="kid-calendar-empty"
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
        data-testid="kid-calendar-tab"
      >
        {byDay.map((group, gi) => (
          <section
            key={group.date}
            data-testid={`kid-cal-day-${group.date}`}
            aria-labelledby={`kid-cal-day-h-${group.date}`}
            className="overflow-hidden rounded-xl border-2 border-black bg-white shadow-neo-sm"
          >
            <h3
              id={`kid-cal-day-h-${group.date}`}
              className={`border-b-2 border-black px-3 py-2 font-heading text-base text-black ${DAY_TINT[gi % DAY_TINT.length]}`}
            >
              {formatDay(group.date)}
            </h3>
            <ul className="space-y-2 p-3">
              {group.items.map((e) => (
                <li
                  key={e.id}
                  data-testid={`kid-cal-event-${e.id}`}
                  className="rounded-lg border-2 border-black bg-cyan-50 p-3"
                >
                  <p className="break-words text-sm font-bold text-black">{e.title}</p>
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
