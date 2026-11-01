import { useCallback, useEffect, useMemo, useState } from 'react';
import { BookOpen, Book, Check, X, ArrowLeft } from 'lucide-react';
import { useAuth } from '../../app/lib/auth-context';
import { useTenantSlug } from '../../app/lib/tenant-context';
import { API_BASE } from '../../app/lib/api';
import { COUNTRIES } from './world-flags/countries';
import { WorldFlags } from './world-flags/WorldFlags';
import { LessonView } from './LessonView';
import { ArtDrawingCanvas } from './art/ArtDrawingCanvas';
import { MathsSubject } from './maths/MathsSubject';
import { LogicSubject } from './logic/LogicSubject';

// Subjects with an interactive lesson (FHS-283). Must match the API's
// LESSON_SUBJECTS. World Flags + Reading have their own experiences.
const LESSON_SUBJECTS = ['Maths', 'Science', 'Logic'];

// Learn Phase 1: ChildWorld Learn tab.
//
// Left: a 2-col grid of subject cards with progress bars (GET /api/learn).
// Right: a Reading Log panel: add books, mark finished, delete
//        (GET/POST/PATCH/DELETE /api/reading-log).
//
// Learn Phase 2a: World Flags Explore (subject routing):
// Clicking a subject card drills into its detail view. World Flags shows the
// Explore experience (WorldFlagsLearn). Other subjects show "Coming soon."

// ─── Types ────────────────────────────────────────────────────────────────────

interface Subject {
  subject: string;
  progress: number;
  // FHS-387: false for subjects with no server-side tracking (Art).
  hasProgress?: boolean;
}

interface Book {
  id: string;
  title: string;
  author: string | null;
  finished: boolean;
  createdAt: string;
}

type Status = 'loading' | 'ready' | 'error';
type SelectedSubject = string | null;

// ─── Subject catalogue ────────────────────────────────────────────────────────

const SUBJECT_STYLE: Record<string, { emoji: string; bg: string }> = {
  Maths: { emoji: '🔢', bg: 'bg-sky-300' },
  'World Flags': { emoji: '🚩', bg: 'bg-amber-300' },
  Logic: { emoji: '🧩', bg: 'bg-violet-300' },
  Science: { emoji: '🔬', bg: 'bg-emerald-300' },
  Art: { emoji: '🎨', bg: 'bg-pink-300' },
};
const FALLBACK_STYLE = { emoji: '⭐', bg: 'bg-gray-300' };

// Art is a free-play canvas with no server-side progress tracking.
// FHS-387: hasProgress=false suppresses the progress bar for Art.
const ART_SUBJECT = { subject: 'Art', progress: 0, hasProgress: false };
// World Flags is injected for kid mode with a real explored progress (FHS-387).
// In parent mode it also comes from the API subjects list as normal.
const WORLD_FLAGS_SUBJECT = { subject: 'World Flags', progress: 0, hasProgress: true };

// Total number of countries in the World Flags dataset (FHS-387).
const TOTAL_COUNTRIES = COUNTRIES.length;

// ─── Component ────────────────────────────────────────────────────────────────

// FHS-270 / FHS-367: used by the parent ChildWorld (pass `memberId`, Supabase
// session) and the kid dashboard (pass `kidToken`, token-scoped /api/kid/learn +
// /api/kid/reading-log). In kid mode the subjects list comes back lessons-only
// (World Flags is kid-scoped separately in FHS-373), so its card never renders.
// Exactly one of memberId / kidToken is supplied (enforced by the union type).
type LearnTabProps =
  | { memberId: string; kidToken?: undefined }
  | { kidToken: string; memberId?: undefined };
export function LearnTab({ memberId, kidToken }: LearnTabProps) {
  const slug = useTenantSlug();
  const { session } = useAuth();
  const kid = !!kidToken;

  // Subject routing state: null = overview, string = subject detail
  const [selectedSubject, setSelectedSubject] = useState<SelectedSubject>(null);

  // Learn subjects state
  const [learnStatus, setLearnStatus] = useState<Status>('loading');
  const [subjects, setSubjects] = useState<Subject[]>([]);

  // FHS-387: kid mode: real World Flags explored count → progress %.
  const [kidWorldFlagsProgress, setKidWorldFlagsProgress] = useState<number>(0);

  // Reading log state
  const [books, setBooks] = useState<Book[]>([]);
  const [booksStatus, setBooksStatus] = useState<Status>('loading');
  const [addTitle, setAddTitle] = useState('');
  const [addAuthor, setAddAuthor] = useState('');
  const [addPending, setAddPending] = useState(false);

  const headers = useMemo(
    () =>
      kid
        ? { Authorization: `Bearer ${kidToken}` }
        : session
          ? { Authorization: `Bearer ${session.access_token}`, 'x-tenant-slug': slug }
          : null,
    [kid, kidToken, session, slug],
  );

  // ── Load subjects ──────────────────────────────────────────────────────────

  const loadSubjects = useCallback(
    async (signal?: AbortSignal) => {
      if (!headers) return;
      try {
        const url = kid
          ? `${API_BASE}/api/kid/learn`
          : `${API_BASE}/api/learn?memberId=${memberId}`;
        const res = await fetch(url, { headers, signal: signal ?? null });
        if (!res.ok) {
          setLearnStatus('error');
          return;
        }
        const body = (await res.json()) as { subjects: Subject[] };
        setSubjects(body.subjects ?? []);
        setLearnStatus('ready');
      } catch (err) {
        if (err instanceof Error && err.name === 'AbortError') return;
        setLearnStatus('error');
      }
    },
    [headers, kid, memberId],
  );

  useEffect(() => {
    const ac = new AbortController();
    void loadSubjects(ac.signal);
    return () => ac.abort();
  }, [loadSubjects]);

  // ── FHS-387: Kid mode: fetch real World Flags explored progress ───────────

  useEffect(() => {
    if (!kid || !headers) return;
    const ac = new AbortController();
    (async () => {
      try {
        const res = await fetch(`${API_BASE}/api/kid/world-flags`, {
          headers,
          signal: ac.signal,
        });
        if (!res.ok) return;
        const body = (await res.json()) as { explored: string[] };
        const explored = body.explored ?? [];
        setKidWorldFlagsProgress(
          TOTAL_COUNTRIES > 0 ? Math.round((explored.length / TOTAL_COUNTRIES) * 100) : 0,
        );
      } catch (err) {
        if (err instanceof Error && err.name === 'AbortError') return;
        // Non-fatal: leave progress at 0 if the fetch fails.
      }
    })();
    return () => ac.abort();
  }, [kid, headers]);

  // ── Load books ─────────────────────────────────────────────────────────────

  const loadBooks = useCallback(
    async (signal?: AbortSignal) => {
      if (!headers) return;
      try {
        const url = kid
          ? `${API_BASE}/api/kid/reading-log`
          : `${API_BASE}/api/reading-log?memberId=${memberId}`;
        const res = await fetch(url, { headers, signal: signal ?? null });
        if (!res.ok) {
          setBooksStatus('error');
          return;
        }
        const body = (await res.json()) as { books: Book[] };
        setBooks(body.books ?? []);
        setBooksStatus('ready');
      } catch (err) {
        if (err instanceof Error && err.name === 'AbortError') return;
        setBooksStatus('error');
      }
    },
    [headers, kid, memberId],
  );

  useEffect(() => {
    const ac = new AbortController();
    void loadBooks(ac.signal);
    return () => ac.abort();
  }, [loadBooks]);

  // ── Add book ───────────────────────────────────────────────────────────────

  const handleAddBook = useCallback(async () => {
    if (!headers || !addTitle.trim()) return;
    setAddPending(true);
    try {
      const res = await fetch(
        kid ? `${API_BASE}/api/kid/reading-log` : `${API_BASE}/api/reading-log`,
        {
          method: 'POST',
          headers: { ...headers, 'Content-Type': 'application/json' },
          body: JSON.stringify({
            // Parent route needs memberId; the kid route scopes from the token.
            ...(kid ? {} : { memberId }),
            title: addTitle.trim(),
            // exactOptionalPropertyTypes: only include author if non-empty
            ...(addAuthor.trim() ? { author: addAuthor.trim() } : {}),
          }),
        },
      );
      if (res.ok) {
        const book = (await res.json()) as Book;
        setBooks((prev) => [book, ...prev]);
        setAddTitle('');
        setAddAuthor('');
      }
    } finally {
      setAddPending(false);
    }
  }, [headers, kid, memberId, addTitle, addAuthor]);

  // ── Toggle finished ────────────────────────────────────────────────────────

  const handleToggle = useCallback(
    async (book: Book) => {
      if (!headers) return;
      const url = kid
        ? `${API_BASE}/api/kid/reading-log/${book.id}`
        : `${API_BASE}/api/reading-log/${book.id}`;
      const res = await fetch(url, {
        method: 'PATCH',
        headers: { ...headers, 'Content-Type': 'application/json' },
        body: JSON.stringify(
          kid ? { finished: !book.finished } : { memberId, finished: !book.finished },
        ),
      });
      if (res.ok) {
        const updated = (await res.json()) as Book;
        setBooks((prev) => prev.map((b) => (b.id === updated.id ? updated : b)));
      }
    },
    [headers, kid, memberId],
  );

  // ── Delete book ────────────────────────────────────────────────────────────

  const handleDelete = useCallback(
    async (bookId: string) => {
      if (!headers) return;
      const url = kid
        ? `${API_BASE}/api/kid/reading-log/${bookId}`
        : `${API_BASE}/api/reading-log/${bookId}?memberId=${memberId}`;
      const res = await fetch(url, { method: 'DELETE', headers });
      if (res.ok || res.status === 204) {
        setBooks((prev) => prev.filter((b) => b.id !== bookId));
      }
    },
    [headers, kid, memberId],
  );

  // ── Subject detail views ───────────────────────────────────────────────────

  if (selectedSubject !== null) {
    return (
      <div className="flex flex-col gap-4" data-testid="learn-subject-detail">
        {/* Back button */}
        <button
          data-testid="learn-back"
          type="button"
          onClick={() => setSelectedSubject(null)}
          className="flex min-h-[44px] w-fit items-center gap-2 rounded-xl border-2 border-black bg-white px-4 py-2 text-sm font-black shadow-neo-xs transition-transform motion-safe:hover:-translate-y-0.5"
        >
          <ArrowLeft size={16} aria-hidden="true" />
          Back to subjects
        </button>

        {selectedSubject === 'Art' ? (
          <ArtDrawingCanvas />
        ) : selectedSubject === 'World Flags' ? (
          kid ? (
            <WorldFlags kidToken={kidToken!} />
          ) : (
            <WorldFlags memberId={memberId!} />
          )
        ) : kid && selectedSubject === 'Maths' ? (
          // FHS-394: kid Maths uses the progressive placement+journey flow.
          <MathsSubject kidToken={kidToken!} />
        ) : kid && selectedSubject === 'Logic' ? (
          // FHS-395: kid Logic uses the game-type + trophy-wall flow.
          // Logic is kid-only: ChildWorldPage (parent mode) has no Learn tab,
          // so the LESSON_SUBJECTS Logic fallthrough below is unreachable in kid mode.
          <LogicSubject kidToken={kidToken!} />
        ) : LESSON_SUBJECTS.includes(selectedSubject) ? (
          <LessonView
            subject={selectedSubject}
            headers={headers}
            {...(memberId ? { memberId } : {})}
            {...(kidToken ? { kidToken } : {})}
          />
        ) : (
          /* Coming soon card for subjects not yet built */
          <div className="rounded-xl border-2 border-black bg-white p-8 text-center shadow-neo-sm">
            <p className="text-4xl">{SUBJECT_STYLE[selectedSubject]?.emoji ?? '⭐'}</p>
            <h3 className="mt-3 font-heading text-2xl uppercase">{selectedSubject}</h3>
            <p className="mt-2 text-sm text-gray-500">
              This subject is coming soon. Check back later!
            </p>
          </div>
        )}
      </div>
    );
  }

  // ── Loading / error (whole-tab) ────────────────────────────────────────────

  if (learnStatus === 'loading' && booksStatus === 'loading') {
    return (
      <p
        data-testid="learn-loading"
        aria-live="polite"
        aria-busy="true"
        className="text-sm font-bold text-white"
      >
        Loading your learning…
      </p>
    );
  }
  if (learnStatus === 'error' && booksStatus === 'error') {
    return (
      <p data-testid="learn-error" role="alert" className="text-sm font-bold text-red-300">
        Couldn&rsquo;t load. Try again.
      </p>
    );
  }

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-3" data-testid="learn-tab">
      {/* ── LEFT: My Learning ── */}
      <div className="lg:col-span-2">
        <div className="rounded-xl border-2 border-black bg-white p-6 shadow-neo-sm">
          <h2 className="mb-6 flex items-center gap-3 font-heading text-2xl uppercase tracking-wide">
            <BookOpen className="text-green-500" aria-hidden="true" />
            My Learning 🧠
          </h2>

          {learnStatus === 'loading' && (
            <p className="text-sm font-bold text-gray-500">Loading subjects…</p>
          )}
          {learnStatus === 'error' && (
            <p className="text-sm font-bold text-red-500">Couldn&rsquo;t load subjects.</p>
          )}
          {learnStatus === 'ready' && (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              {[
                // FHS-387: in kid mode inject World Flags with real explored progress.
                ...(kid ? [{ ...WORLD_FLAGS_SUBJECT, progress: kidWorldFlagsProgress }] : []),
                ...subjects,
                ART_SUBJECT,
              ].map((s) => {
                const style = SUBJECT_STYLE[s.subject] ?? FALLBACK_STYLE;
                const pct = Math.max(0, Math.min(100, s.progress));
                // FHS-387: hasProgress defaults to true; Art has it set to false.
                const showProgress = s.hasProgress !== false;
                // Slug for testid: lowercase, spaces → hyphens
                const slug = s.subject.toLowerCase().replace(/\s+/g, '-');
                // FHS-403: Science isn't built yet; FHS-414: Art is being
                // redesigned. Show these cards but disabled (dimmed + unclickable)
                // so kids can't drill into an empty/old experience.
                const isComingSoon = s.subject === 'Science' || s.subject === 'Art';
                return (
                  <button
                    key={s.subject}
                    type="button"
                    data-testid={`learn-subject-${slug}`}
                    onClick={isComingSoon ? undefined : () => setSelectedSubject(s.subject)}
                    disabled={isComingSoon}
                    aria-disabled={isComingSoon}
                    className={`flex flex-col gap-4 rounded-xl border-2 border-black p-5 text-left shadow-neo-xs ${style.bg} transition-transform ${
                      isComingSoon
                        ? 'cursor-not-allowed opacity-50 grayscale'
                        : 'motion-safe:hover:-translate-y-0.5'
                    }`}
                  >
                    {/* Icon + progress pill (or "Free play" badge for Art) */}
                    <div className="flex items-center justify-between">
                      <div className="flex h-12 w-12 items-center justify-center rounded-full border-2 border-black bg-white text-2xl">
                        <span aria-hidden="true">{style.emoji}</span>
                      </div>
                      {isComingSoon ? (
                        <span
                          data-testid="learn-coming-soon"
                          className="rounded-full border-2 border-black bg-white px-2 py-1 text-xs font-bold"
                        >
                          Coming soon
                        </span>
                      ) : showProgress ? (
                        <span className="rounded-full border-2 border-black bg-white px-2 py-1 text-xs font-bold">
                          {pct}%
                        </span>
                      ) : (
                        <span
                          data-testid="learn-art-freeplay"
                          aria-label={`${s.subject}: free play, no progress to track`}
                          className="rounded-full border-2 border-black bg-white px-2 py-1 text-xs font-bold"
                        >
                          Free play
                        </span>
                      )}
                    </div>
                    {/* Subject name */}
                    <h3 className="mb-2 font-heading text-xl">{s.subject}</h3>
                    {/* Progress bar: omitted for Art (no progress) + disabled Science */}
                    {!isComingSoon && showProgress && (
                      <div
                        role="progressbar"
                        aria-valuenow={pct}
                        aria-valuemin={0}
                        aria-valuemax={100}
                        aria-label={`${s.subject} progress`}
                        data-testid={`learn-progress-${s.subject}`}
                        className="h-3 w-full overflow-hidden rounded-full border-2 border-black bg-white/50"
                      >
                        {/* FHS-397: white/dark fill is readable on any coloured card bg */}
                        <div className="h-full bg-gray-800" style={{ width: `${pct}%` }} />
                      </div>
                    )}
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* ── RIGHT: Reading Log ── */}
      <div className="lg:col-span-1">
        <div
          data-testid="reading-log"
          className="rounded-xl border-2 border-black bg-white p-6 shadow-neo-sm"
        >
          <h3 className="mb-4 flex items-center gap-2 font-heading text-xl uppercase tracking-wide">
            <Book size={20} className="text-blue-500" aria-hidden="true" />
            Reading Log 📚
          </h3>

          {/* Add-book form */}
          <div className="mb-4 flex flex-col gap-2">
            <input
              data-testid="reading-log-add-title"
              type="text"
              placeholder="Book title"
              maxLength={200}
              aria-label="Book title"
              value={addTitle}
              onChange={(e) => setAddTitle(e.target.value)}
              className="min-h-[44px] rounded-lg border-2 border-black px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
              onKeyDown={(e) => {
                if (e.key === 'Enter' && addTitle.trim()) void handleAddBook();
              }}
            />
            <input
              type="text"
              placeholder="Author (optional)"
              aria-label="Author (optional)"
              maxLength={120}
              value={addAuthor}
              onChange={(e) => setAddAuthor(e.target.value)}
              className="min-h-[44px] rounded-lg border-2 border-black px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
            />
            <button
              data-testid="reading-log-add-submit"
              type="button"
              disabled={!addTitle.trim() || addPending}
              onClick={() => void handleAddBook()}
              className="min-h-[44px] rounded-lg border-2 border-black bg-blue-400 px-4 py-2 text-sm font-bold shadow-neo-xs transition-transform motion-safe:hover:-translate-y-0.5 disabled:opacity-50"
            >
              {addPending ? 'Adding…' : '+ Add book'}
            </button>
          </div>

          {/* Book list */}
          {booksStatus === 'loading' && <p className="text-sm text-gray-500">Loading books…</p>}
          {booksStatus === 'error' && (
            <p className="text-sm text-red-500">Couldn&rsquo;t load books.</p>
          )}
          {booksStatus === 'ready' && books.length === 0 && (
            <p data-testid="reading-log-empty" className="text-sm text-gray-500">
              No books yet. Add one above!
            </p>
          )}
          {booksStatus === 'ready' && books.length > 0 && (
            <ul className="flex flex-col gap-2">
              {books.map((book) => (
                <li
                  key={book.id}
                  data-testid={`reading-log-item-${book.id}`}
                  className="flex items-center gap-3 rounded-lg border-2 border-black bg-blue-50 p-3"
                >
                  {/* Book icon disc */}
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border-2 border-black bg-blue-200">
                    <Book size={14} aria-hidden="true" />
                  </div>
                  {/* Title + author */}
                  <div className="flex min-w-0 flex-1 flex-col">
                    <span
                      className={`truncate text-sm font-bold ${book.finished ? 'line-through text-gray-400' : ''}`}
                    >
                      {book.title}
                    </span>
                    {book.author && (
                      <span className="truncate text-xs text-gray-500">{book.author}</span>
                    )}
                  </div>
                  {/* Finished toggle */}
                  <button
                    data-testid={`reading-log-toggle-${book.id}`}
                    type="button"
                    onClick={() => void handleToggle(book)}
                    aria-label={
                      book.finished ? `Unmark ${book.title}` : `Mark ${book.title} as read`
                    }
                    className={`flex h-8 w-8 min-h-[44px] min-w-[44px] shrink-0 items-center justify-center rounded-full border-2 border-black transition-colors ${
                      book.finished ? 'bg-green-400' : 'bg-white hover:bg-green-100'
                    }`}
                  >
                    <Check size={14} aria-hidden="true" />
                  </button>
                  {/* Delete */}
                  <button
                    data-testid={`reading-log-delete-${book.id}`}
                    type="button"
                    onClick={() => void handleDelete(book.id)}
                    aria-label={`Remove ${book.title}`}
                    className="flex h-8 w-8 min-h-[44px] min-w-[44px] shrink-0 items-center justify-center rounded-full border-2 border-black bg-white transition-colors hover:bg-red-100"
                  >
                    <X size={14} />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}
