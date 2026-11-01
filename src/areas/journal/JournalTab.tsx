import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { BookOpen, ChevronLeft, ChevronRight, PenLine, Send } from 'lucide-react';
import { JOURNAL_CREATIVITY_QUESTIONS, JOURNAL_MOODS, JOURNAL_QUOTES } from '@familyhub/shared';
import { useAuth } from '../../app/lib/auth-context';
import { useTenantSlug } from '../../app/lib/tenant-context';
import { API_BASE } from '../../app/lib/api';

// FHS-270: ChildWorld Journal tab (Magic Patterns design, new per-day API).
//
// Sub-tabs: "My Journal" (per-day form) + "Past Entries" (read list).
// Date navigator drives which day is being viewed/edited.
// All data is scoped to the memberId passed by ChildWorldPage.

// ── Types ────────────────────────────────────────────────────────────────────

interface Entry {
  id: string;
  entryDate: string;
  mood: string | null;
  gratitude1: string | null;
  gratitude2: string | null;
  gratitude3: string | null;
  body: string | null;
  creativity: Record<string, string> | null;
  createdAt: string;
  updatedAt: string;
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function toIsoDate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function todayIso(): string {
  return toIsoDate(new Date());
}

function formatDateLabel(iso: string): string {
  // "MONDAY 15 JUNE 2026"
  const d = new Date(iso + 'T12:00:00');
  return d
    .toLocaleDateString('en-GB', {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    })
    .toUpperCase();
}

function formatPastDate(iso: string): string {
  const d = new Date(iso + 'T12:00:00');
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
}

function moodEmojiFor(value: string | null): string {
  if (!value) return '';
  return JOURNAL_MOODS.find((m) => m.value === value)?.emoji ?? '';
}

function prevDay(iso: string): string {
  const d = new Date(iso + 'T12:00:00');
  d.setDate(d.getDate() - 1);
  return toIsoDate(d);
}

function nextDay(iso: string): string {
  const d = new Date(iso + 'T12:00:00');
  d.setDate(d.getDate() + 1);
  return toIsoDate(d);
}

// ── Sub-tab type ──────────────────────────────────────────────────────────────

type SubTab = 'write' | 'past';
type SaveState = 'idle' | 'saving' | 'saved';

// ── Abort ref type ────────────────────────────────────────────────────────────
// Holds the controller for the in-flight day-fetch so rapid nav cancels stale GETs.
type NavAbortRef = { current: AbortController | null };

// ── Component ────────────────────────────────────────────────────────────────

// FHS-270 / FHS-366: used by both the parent ChildWorld (pass `memberId`, uses
// the Supabase session) and the kid dashboard (pass `kidToken`, uses the
// token-scoped /api/kid/journal endpoints). Exactly one of memberId/kidToken is
// given; the request builders below branch on which.
export function JournalTab({ memberId, kidToken }: { memberId?: string; kidToken?: string }) {
  const slug = useTenantSlug();
  const { session } = useAuth();
  const kid = !!kidToken;

  const headers = useMemo(
    () =>
      kid
        ? { Authorization: `Bearer ${kidToken}` }
        : session
          ? { Authorization: `Bearer ${session.access_token}`, 'x-tenant-slug': slug }
          : null,
    [kid, kidToken, session, slug],
  );

  // ── global loading / error ────────────────────────────────────────────────
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  // ── content (static lists from API) ──────────────────────────────────────
  // We use the shared package constants directly (same data, no extra fetch).
  const quotes = JOURNAL_QUOTES;
  const creativityQuestions = JOURNAL_CREATIVITY_QUESTIONS;
  const moods = JOURNAL_MOODS;

  // ── sub-tab ───────────────────────────────────────────────────────────────
  // FHS-376: kids get a read-only Journal: Past Entries only, no "My Journal"
  // write form. Parents author entries from the parent portal.
  const [subTab, setSubTab] = useState<SubTab>(kid ? 'past' : 'write');

  // ── date navigator ────────────────────────────────────────────────────────
  const [currentDate, setCurrentDate] = useState<string>(todayIso);
  const [earliestDate, setEarliestDate] = useState<string | null>(null);

  // ── current day entry ─────────────────────────────────────────────────────
  const [quoteIndex, setQuoteIndex] = useState(0);
  const [entry, setEntry] = useState<Entry | null>(null);

  // ── form state ────────────────────────────────────────────────────────────
  const [mood, setMood] = useState<string | null>(null);
  const [gratitude1, setGratitude1] = useState('');
  const [gratitude2, setGratitude2] = useState('');
  const [gratitude3, setGratitude3] = useState('');
  const [body, setBody] = useState('');
  const [creativity, setCreativity] = useState<Record<string, string>>({});

  // ── past entries ──────────────────────────────────────────────────────────
  const [pastEntries, setPastEntries] = useState<Entry[]>([]);
  const [pastLoading, setPastLoading] = useState(false);

  // ── save state ────────────────────────────────────────────────────────────
  const [saveState, setSaveState] = useState<SaveState>('idle');
  const [saveError, setSaveError] = useState<string | null>(null);

  // ── nav abort ref (FIX 1) ────────────────────────────────────────────────
  // Cancels the previous in-flight day-fetch before firing a new one.
  const navAbortRef = useRef<AbortController | null>(null) as NavAbortRef;

  // ── fetch helpers ─────────────────────────────────────────────────────────

  const fetchDay = useCallback(
    async (date: string, signal?: AbortSignal) => {
      if (!headers) return;
      setLoading(true);
      setError(false);
      try {
        const url = kid
          ? `${API_BASE}/api/kid/journal?date=${date}`
          : `${API_BASE}/api/journal?memberId=${memberId}&date=${date}`;
        const res = await fetch(url, { headers, signal: signal ?? null });
        if (!res.ok) {
          setError(true);
          setLoading(false);
          return;
        }
        const data = (await res.json()) as { entry: Entry | null; quoteIndex: number };
        setQuoteIndex(data.quoteIndex);
        setEntry(data.entry);
        // Populate form from saved entry (or reset)
        setMood(data.entry?.mood ?? null);
        setGratitude1(data.entry?.gratitude1 ?? '');
        setGratitude2(data.entry?.gratitude2 ?? '');
        setGratitude3(data.entry?.gratitude3 ?? '');
        setBody(data.entry?.body ?? '');
        setCreativity(data.entry?.creativity ?? {});
        setSaveState('idle');
      } catch (err) {
        if (err instanceof Error && err.name === 'AbortError') return;
        setError(true);
      } finally {
        setLoading(false);
      }
    },
    [headers, kid, memberId],
  );

  const fetchEarliest = useCallback(
    async (signal?: AbortSignal) => {
      if (!headers) return;
      try {
        const url = kid
          ? `${API_BASE}/api/kid/journal/earliest`
          : `${API_BASE}/api/journal/earliest?memberId=${memberId}`;
        const res = await fetch(url, { headers, signal: signal ?? null });
        if (!res.ok) return;
        const data = (await res.json()) as { earliestDate: string | null };
        setEarliestDate(data.earliestDate);
      } catch {
        // non-fatal: back-nav will just be unrestricted
      }
    },
    [headers, kid, memberId],
  );

  const fetchPastEntries = useCallback(
    async (signal?: AbortSignal) => {
      if (!headers) return;
      setPastLoading(true);
      try {
        const url = kid
          ? `${API_BASE}/api/kid/journal/entries`
          : `${API_BASE}/api/journal/entries?memberId=${memberId}`;
        const res = await fetch(url, { headers, signal: signal ?? null });
        if (!res.ok) return;
        const data = (await res.json()) as { entries: Entry[] };
        setPastEntries(data.entries);
      } catch (err) {
        if (err instanceof Error && err.name === 'AbortError') return;
      } finally {
        setPastLoading(false);
      }
    },
    [headers, kid, memberId],
  );

  // ── initial load ──────────────────────────────────────────────────────────

  useEffect(() => {
    const ac = new AbortController();
    void fetchDay(currentDate, ac.signal);
    void fetchEarliest(ac.signal);
    return () => {
      ac.abort();
      // Also cancel any pending nav fetch (FIX 1: unmount cleanup).
      navAbortRef.current?.abort();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── date navigation ───────────────────────────────────────────────────────

  const goToDate = useCallback(
    (date: string) => {
      // Cancel any in-flight day GET before firing a new one (FIX 1).
      navAbortRef.current?.abort();
      const ac = new AbortController();
      navAbortRef.current = ac;
      setCurrentDate(date);
      void fetchDay(date, ac.signal);
    },
    [fetchDay],
  );

  const canGoPrev = !loading && (earliestDate === null || currentDate > earliestDate);
  const canGoNext = !loading && currentDate < todayIso();

  const today = todayIso();
  const dateRelLabel =
    currentDate === today ? 'Today' : currentDate === prevDay(today) ? 'Yesterday' : '';

  // ── past-entries: load when switching to that tab ─────────────────────────

  useEffect(() => {
    if (subTab !== 'past') return;
    const ac = new AbortController();
    void fetchPastEntries(ac.signal);
    return () => ac.abort();
  }, [subTab, fetchPastEntries]);

  // ── save ──────────────────────────────────────────────────────────────────

  const handleSave = useCallback(async () => {
    if (!headers || saveState === 'saving') return;
    setSaveState('saving');
    setSaveError(null); // clear previous error on new attempt (FIX 2)
    try {
      const payload: Record<string, unknown> = {
        entryDate: currentDate,
        mood: mood ?? null,
        gratitude1: gratitude1 || null,
        gratitude2: gratitude2 || null,
        gratitude3: gratitude3 || null,
        body: body || null,
        creativity: Object.keys(creativity).length > 0 ? creativity : null,
      };
      // Parent route takes memberId in the body; the kid route scopes from the token.
      if (!kid) payload.memberId = memberId;
      const res = await fetch(kid ? `${API_BASE}/api/kid/journal` : `${API_BASE}/api/journal`, {
        method: 'PUT',
        headers: { ...headers, 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        // Try to surface server detail, fall back to generic message (FIX 2).
        let msg = "Couldn't save. Try again.";
        try {
          const errBody = (await res.json()) as { message?: string; error?: string };
          if (errBody.message ?? errBody.error) {
            msg = String(errBody.message ?? errBody.error);
          }
        } catch {
          /* swallow: body unreadable */
        }
        setSaveState('idle');
        setSaveError(msg);
        return;
      }
      const saved = (await res.json()) as Entry;
      setEntry(saved);
      setSaveState('saved');
      setSaveError(null);
      // Refresh earliest so back-nav bound is correct after first save
      void fetchEarliest();
      // Brief "Saved ✓" feedback then reset
      setTimeout(() => setSaveState('idle'), 2000);
    } catch {
      setSaveState('idle');
      setSaveError("Couldn't save. Try again.");
    }
  }, [
    headers,
    kid,
    saveState,
    memberId,
    currentDate,
    mood,
    gratitude1,
    gratitude2,
    gratitude3,
    body,
    creativity,
    fetchEarliest,
  ]);

  // ── render: loading / error ───────────────────────────────────────────────

  if (loading && entry === null && !error) {
    return (
      <p
        data-testid="journal-loading"
        aria-live="polite"
        aria-busy="true"
        className="text-sm font-bold text-white"
      >
        Loading your journal…
      </p>
    );
  }

  if (error) {
    return (
      <p data-testid="journal-error" role="alert" className="text-sm font-bold text-red-300">
        Couldn&rsquo;t load your journal. Try again.
      </p>
    );
  }

  const quote = quotes[quoteIndex] ?? quotes[0]!;

  // ── render ────────────────────────────────────────────────────────────────

  return (
    <motion.div
      data-testid="journal-tab"
      className="flex flex-col gap-5"
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
    >
      {/* Sub-tab switcher: hidden for kids (read-only, Past Entries only). */}
      {!kid && (
        <div className="flex gap-1 rounded-xl border-2 border-black bg-white p-1.5 shadow-neo-sm">
          <button
            data-testid="journal-subtab-write"
            onClick={() => setSubTab('write')}
            className={`flex flex-1 items-center justify-center gap-2 rounded-lg border-2 py-3 text-sm font-bold transition-all ${
              subTab === 'write'
                ? 'border-black bg-gradient-to-r from-purple-500 to-pink-400 text-white shadow-neo-xs'
                : 'border-transparent bg-transparent text-gray-500 hover:bg-gray-100'
            }`}
          >
            <PenLine size={16} aria-hidden="true" />
            My Journal
          </button>
          <button
            data-testid="journal-subtab-past"
            onClick={() => setSubTab('past')}
            className={`flex flex-1 items-center justify-center gap-2 rounded-lg border-2 py-3 text-sm font-bold transition-all ${
              subTab === 'past'
                ? 'border-black bg-gradient-to-r from-purple-500 to-pink-400 text-white shadow-neo-xs'
                : 'border-transparent bg-transparent text-gray-500 hover:bg-gray-100'
            }`}
          >
            <BookOpen size={16} aria-hidden="true" />
            Past Entries
          </button>
        </div>
      )}

      <AnimatePresence mode="wait">
        {subTab === 'write' && !kid ? (
          <motion.div
            key="write"
            className="flex flex-col gap-5"
            initial={{ opacity: 0, x: -16 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 16 }}
            transition={{ duration: 0.2 }}
          >
            {/* ① Date navigator */}
            <div className="rounded-xl border-2 border-black bg-white p-5 text-center shadow-neo-sm">
              <div className="flex items-center justify-center gap-3">
                <button
                  data-testid="journal-prev-day"
                  onClick={() => goToDate(prevDay(currentDate))}
                  disabled={!canGoPrev}
                  aria-label="Previous day"
                  className="flex h-10 w-10 min-h-[44px] min-w-[44px] items-center justify-center rounded-full border-2 border-black bg-white disabled:opacity-30 motion-safe:hover:-translate-y-0.5 transition-transform"
                >
                  <ChevronLeft size={18} aria-hidden="true" />
                </button>
                <div className="flex-1">
                  <h2
                    data-testid="journal-date-label"
                    className="font-heading text-2xl tracking-wide text-black"
                  >
                    {formatDateLabel(currentDate)}
                  </h2>
                  {dateRelLabel && (
                    <p className="mt-0.5 text-xs font-bold text-pink-500">{dateRelLabel}</p>
                  )}
                </div>
                <button
                  data-testid="journal-next-day"
                  onClick={() => goToDate(nextDay(currentDate))}
                  disabled={!canGoNext}
                  aria-label="Next day"
                  className="flex h-10 w-10 min-h-[44px] min-w-[44px] items-center justify-center rounded-full border-2 border-black bg-white disabled:opacity-30 motion-safe:hover:-translate-y-0.5 transition-transform"
                >
                  <ChevronRight size={18} aria-hidden="true" />
                </button>
              </div>
            </div>

            {/* ② Quote banner */}
            <div
              data-testid="journal-quote"
              className="flex items-center gap-4 rounded-xl border-2 border-black bg-cyan-100 p-4 shadow-neo-sm"
            >
              <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full bg-cyan-300 text-xl font-bold">
                ❝
              </div>
              <div>
                <p className="text-sm font-bold text-black">&ldquo;{quote.text}&rdquo;</p>
                <p className="mt-0.5 text-xs text-gray-600">({quote.author})</p>
              </div>
            </div>

            {/* ③ Mood picker */}
            <div className="rounded-xl border-2 border-black bg-white p-6 shadow-neo-sm">
              <h3 className="mb-4 font-heading text-lg font-bold text-black">
                How are you feeling today?
              </h3>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                {moods.map((m) => (
                  <motion.button
                    key={m.value}
                    data-testid={`journal-mood-${m.value}`}
                    onClick={() => setMood(mood === m.value ? null : m.value)}
                    whileTap={{ scale: 0.95 }}
                    className={`flex min-h-[44px] flex-col items-center gap-1 rounded-xl border-2 border-black p-3 text-sm font-bold transition-colors ${
                      mood === m.value
                        ? 'bg-purple-300 shadow-neo-xs'
                        : 'bg-gray-50 hover:bg-gray-100'
                    }`}
                    aria-pressed={mood === m.value}
                  >
                    <span className="text-3xl" aria-hidden="true">
                      {m.emoji}
                    </span>
                    <span className="text-xs">{m.label}</span>
                  </motion.button>
                ))}
              </div>
            </div>

            {/* ④ Gratitude */}
            <div className="rounded-xl border-2 border-black bg-yellow-100 p-6 shadow-neo-sm">
              <h3 className="mb-4 font-heading text-lg font-bold text-black">
                3 Things I&rsquo;m Grateful For
              </h3>
              <div className="flex flex-col gap-3">
                {(
                  [
                    {
                      num: 1,
                      color: 'bg-green-300',
                      val: gratitude1,
                      set: setGratitude1,
                      testId: 'journal-gratitude-1',
                    },
                    {
                      num: 2,
                      color: 'bg-orange-300',
                      val: gratitude2,
                      set: setGratitude2,
                      testId: 'journal-gratitude-2',
                    },
                    {
                      num: 3,
                      color: 'bg-pink-300',
                      val: gratitude3,
                      set: setGratitude3,
                      testId: 'journal-gratitude-3',
                    },
                  ] as const
                ).map(({ num, color, val, set, testId }) => (
                  <div key={num} className="flex items-center gap-3">
                    <div
                      className={`flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full border-2 border-black ${color} text-sm font-bold`}
                    >
                      {num}
                    </div>
                    <input
                      data-testid={testId}
                      type="text"
                      value={val}
                      onChange={(e) => set(e.target.value)}
                      placeholder="I'm grateful for..."
                      maxLength={500}
                      aria-label={`Grateful for (${num})`}
                      className="min-h-[44px] flex-1 rounded-xl border-2 border-black bg-white px-3 py-2 text-sm text-black focus:outline-none focus:ring-2 focus:ring-yellow-400"
                    />
                  </div>
                ))}
              </div>
            </div>

            {/* ⑤ Day body */}
            <div className="rounded-xl border-2 border-black bg-white p-6 shadow-neo-sm">
              <h3 className="mb-4 flex items-center gap-2 font-heading text-lg font-bold text-black">
                <div className="flex h-8 w-8 items-center justify-center rounded-full bg-purple-200">
                  <PenLine size={16} className="text-purple-700" aria-hidden="true" />
                </div>
                What happened today?
              </h3>
              <textarea
                data-testid="journal-body"
                value={body}
                onChange={(e) => setBody(e.target.value)}
                placeholder="Write about your day here..."
                maxLength={5000}
                aria-label="What happened today?"
                className="h-28 w-full rounded-xl border-2 border-black bg-gray-50 p-4 text-sm text-black focus:outline-none focus:ring-2 focus:ring-purple-400"
              />
            </div>

            {/* ⑥ Creativity questions */}
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              {creativityQuestions.map((q, i) => (
                <div
                  key={i}
                  className={`rounded-xl border-2 border-black p-5 shadow-neo-sm ${q.color}`}
                >
                  <h3 className="mb-3 flex items-center gap-2 font-heading text-sm font-bold text-black">
                    <div className="flex h-8 w-8 items-center justify-center rounded-full border-2 border-black bg-white text-base">
                      {q.emoji}
                    </div>
                    {q.label}
                  </h3>
                  <textarea
                    data-testid={`journal-creativity-${i}`}
                    value={creativity[String(i)] ?? ''}
                    onChange={(e) => {
                      const val = e.target.value;
                      setCreativity((prev) => ({ ...prev, [String(i)]: val }));
                    }}
                    placeholder={q.placeholder}
                    aria-label={q.label}
                    className="h-20 w-full rounded-xl border-2 border-black bg-white p-3 text-sm text-black focus:outline-none focus:ring-2 focus:ring-purple-400"
                  />
                </div>
              ))}
            </div>

            {/* ⑦ Save button + error (FIX 2) */}
            {saveError && (
              <p
                data-testid="journal-save-error"
                role="alert"
                className="rounded-xl border-2 border-red-400 bg-red-50 px-4 py-2 text-sm font-bold text-red-600"
              >
                {saveError}
              </p>
            )}
            <motion.button
              data-testid={saveState === 'saved' ? 'journal-saved' : 'journal-save'}
              onClick={() => {
                void handleSave();
              }}
              disabled={saveState === 'saving'}
              whileTap={{ scale: 0.97 }}
              className="flex min-h-[52px] w-full items-center justify-center gap-2 rounded-xl border-2 border-black bg-purple-300 font-heading text-xl uppercase shadow-neo-sm transition-opacity disabled:opacity-60 motion-safe:hover:-translate-y-0.5"
            >
              {saveState === 'saving' ? (
                'Saving…'
              ) : saveState === 'saved' ? (
                'Saved ✓'
              ) : (
                <>
                  <Send size={20} aria-hidden="true" />
                  Save Journal Entry ✨
                </>
              )}
            </motion.button>
          </motion.div>
        ) : (
          /* ── Past Entries ── */
          <motion.div
            key="past"
            initial={{ opacity: 0, x: 16 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -16 }}
            transition={{ duration: 0.2 }}
          >
            <div className="rounded-xl border-2 border-black bg-[#6b21a8] p-6 shadow-neo-sm">
              <h2 className="mb-4 flex items-center gap-2 font-heading text-xl font-bold text-white">
                <BookOpen size={22} aria-hidden="true" />
                Past Journal Entries
              </h2>

              {pastLoading ? (
                <p className="text-sm font-bold text-purple-200">Loading entries…</p>
              ) : pastEntries.length === 0 ? (
                <div
                  data-testid="journal-past-empty"
                  className="rounded-xl border-2 border-black bg-white p-8 text-center"
                >
                  <p className="text-4xl" aria-hidden="true">
                    📝
                  </p>
                  <p className="mt-3 text-sm font-bold text-gray-800">No entries yet!</p>
                  <p className="mt-1 text-xs text-gray-500">
                    Start writing in your journal to see your entries here.
                  </p>
                </div>
              ) : (
                <div data-testid="journal-past-list" className="flex flex-col gap-3">
                  {pastEntries.map((e) => {
                    const gratitudes = [e.gratitude1, e.gratitude2, e.gratitude3].filter(Boolean);
                    return (
                      <div
                        key={e.id}
                        data-testid={`journal-entry-${e.id}`}
                        className="rounded-xl border-2 border-black bg-white p-5 shadow-neo-xs"
                      >
                        <div className="mb-2 flex items-center justify-between">
                          <span className="text-xs font-bold uppercase tracking-wider text-gray-500">
                            {formatPastDate(e.entryDate)}
                          </span>
                          {e.mood && (
                            <span className="text-2xl" aria-label={e.mood}>
                              {moodEmojiFor(e.mood)}
                            </span>
                          )}
                        </div>
                        {e.body && (
                          <p className="mb-3 whitespace-pre-wrap break-words text-sm text-black">
                            {e.body}
                          </p>
                        )}
                        {gratitudes.length > 0 && (
                          <div className="rounded-lg bg-pink-50 px-3 py-2">
                            <p className="text-xs font-bold text-pink-700">Grateful for:</p>
                            <p className="mt-0.5 text-xs text-gray-700">{gratitudes.join(' • ')}</p>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
