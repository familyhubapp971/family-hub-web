/**
 * FounderFeedbackPage: FHS-672, at /admin.
 *
 * The founder enters the passcode and reads every family's feedback: a
 * per-screen summary, then each person's answers grouped by visit, with
 * filters and a spreadsheet download. The passcode is checked on the server
 * (FOUNDER_PASSCODE); the page only keeps the 8-hour token it gets back, in
 * this browser tab.
 */

import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react';
import { Button, CollapsibleSection, Input, Select } from '@familyhub/ui';
import { API_BASE } from '../../app/lib/api';
import {
  SOURCE_LABEL,
  groupByPersonAndVisit,
  overview,
  quotes,
  screenLabel,
  summariseByScreen,
  toCsv,
  type FeedbackRow,
  type Overview,
  type PersonGroup,
  type Quote,
  type QuoteKind,
  type RatingSummary,
  type ScreenSummary,
} from '../../app/lib/founder-feedback';

const TOKEN_KEY = 'fh-founder-token';

function readToken(): string | null {
  try {
    return sessionStorage.getItem(TOKEN_KEY);
  } catch {
    return null;
  }
}

function writeToken(token: string | null): void {
  try {
    if (token) sessionStorage.setItem(TOKEN_KEY, token);
    else sessionStorage.removeItem(TOKEN_KEY);
  } catch {
    // Private browsing: the page still works until it is reloaded.
  }
}

function formatWhen(iso: string): string {
  return new Date(iso).toLocaleString(undefined, {
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function FounderFeedbackPage() {
  const [token, setToken] = useState<string | null>(readToken);
  const [rows, setRows] = useState<FeedbackRow[] | null>(null);
  const [loadError, setLoadError] = useState('');

  const signOut = useCallback(() => {
    writeToken(null);
    setToken(null);
    setRows(null);
  }, []);

  useEffect(() => {
    if (!token) return;
    let cancelled = false;
    setLoadError('');
    fetch(`${API_BASE}/api/founder/feedback`, { headers: { 'x-founder-token': token } })
      .then(async (res) => {
        if (cancelled) return;
        if (res.status === 401) return signOut();
        if (!res.ok) throw new Error(String(res.status));
        const body = (await res.json()) as { rows: FeedbackRow[] };
        if (!cancelled) setRows(body.rows);
      })
      .catch(() => {
        if (!cancelled) setLoadError('Could not load feedback. Check your connection and refresh.');
      });
    return () => {
      cancelled = true;
    };
  }, [token, signOut]);

  return (
    <div className="flex min-h-screen flex-col bg-kingdom-bg px-4 py-6 text-white sm:px-6">
      <div className="mx-auto flex w-full max-w-5xl flex-1 flex-col">
        <header className="mb-6 flex flex-wrap items-center justify-between gap-3">
          <h1 className="font-heading text-2xl uppercase tracking-wide sm:text-3xl">
            Family Hub feedback
          </h1>
          {token && (
            <Button variant="secondary" onClick={signOut} testId="founder-sign-out">
              Lock
            </Button>
          )}
        </header>

        {!token ? (
          // FHS-674: the passcode box sits in the middle of the space below the title.
          <div className="flex flex-1 items-center justify-center pb-16" data-testid="founder-lock">
            <PasscodeForm
              onUnlocked={(t) => {
                writeToken(t);
                setToken(t);
              }}
            />
          </div>
        ) : loadError ? (
          <p role="alert" className="rounded-xl border-2 border-black bg-red-50 p-4 text-red-700">
            {loadError}
          </p>
        ) : rows === null ? (
          <p className="text-purple-200" data-testid="founder-loading">
            Loading feedback…
          </p>
        ) : (
          <FeedbackView rows={rows} />
        )}
      </div>
    </div>
  );
}

function PasscodeForm({ onUnlocked }: { onUnlocked: (token: string) => void }) {
  const [passcode, setPasscode] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const submit = useCallback(
    async (e: FormEvent) => {
      e.preventDefault();
      if (busy || !passcode) return;
      setBusy(true);
      setError('');
      try {
        const res = await fetch(`${API_BASE}/api/founder/session`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ passcode }),
        });
        if (res.ok) {
          const body = (await res.json()) as { token: string };
          onUnlocked(body.token);
          return;
        }
        if (res.status === 429) {
          const body = (await res.json().catch(() => ({}))) as { retryAfter?: number };
          const minutes = Math.max(1, Math.ceil((body.retryAfter ?? 900) / 60));
          setError(`Too many tries. Try again in ${minutes} minute${minutes === 1 ? '' : 's'}.`);
        } else if (res.status === 404) {
          setError('This page is switched off on this server.');
        } else {
          setError('That passcode is wrong.');
        }
        setPasscode('');
      } catch {
        setError('Could not reach the server. Check your connection and try again.');
      } finally {
        setBusy(false);
      }
    },
    [busy, passcode, onUnlocked],
  );

  return (
    <form
      onSubmit={submit}
      className="mx-auto w-full max-w-sm rounded-2xl border-2 border-black bg-white p-5 text-black shadow-neo sm:p-6"
    >
      <label htmlFor="founder-passcode" className="mb-3 block font-heading text-xl">
        Enter the passcode
      </label>
      <Input
        id="founder-passcode"
        type="password"
        inputMode="numeric"
        autoComplete="current-password"
        maxLength={12}
        value={passcode}
        onChange={(e) => setPasscode(e.target.value.replace(/\D/g, ''))}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? 'founder-error' : undefined}
        testId="founder-passcode"
      />
      {error && (
        <p
          id="founder-error"
          role="alert"
          className="mt-3 text-sm font-bold text-red-600"
          data-testid="founder-error"
        >
          {error}
        </p>
      )}
      <Button
        type="submit"
        variant="primary"
        disabled={busy || passcode.length === 0}
        testId="founder-open"
        fullWidth
        className="mt-4"
      >
        {busy ? 'Opening…' : 'Open'}
      </Button>
    </form>
  );
}

function FeedbackView({ rows }: { rows: FeedbackRow[] }) {
  const [source, setSource] = useState<'all' | FeedbackRow['source']>('all');
  const [family, setFamily] = useState('all');
  const [screen, setScreen] = useState('all');

  const families = useMemo(
    () =>
      [
        ...new Set(rows.map((r) => r.familyName ?? r.familySlug).filter(Boolean) as string[]),
      ].sort(),
    [rows],
  );
  const screens = useMemo(
    () => [...new Set(rows.map((r) => r.screen).filter(Boolean) as string[])].sort(),
    [rows],
  );

  const shown = useMemo(
    () =>
      rows.filter(
        (r) =>
          (source === 'all' || r.source === source) &&
          (family === 'all' || (r.familyName ?? r.familySlug) === family) &&
          (screen === 'all' || r.screen === screen),
      ),
    [rows, source, family, screen],
  );
  const summary = useMemo(
    () => ({ overview: overview(shown), screens: summariseByScreen(shown), quotes: quotes(shown) }),
    [shown],
  );
  const people = useMemo(() => groupByPersonAndVisit(shown), [shown]);

  const download = useCallback(() => {
    const blob = new Blob([toCsv(shown)], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `family-hub-feedback-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }, [shown]);

  return (
    <div className="space-y-8">
      <div className="grid gap-3 rounded-2xl border-2 border-black bg-white p-4 text-black shadow-neo sm:grid-cols-2 lg:grid-cols-4">
        <label className="text-sm font-bold">
          Where from
          <Select
            value={source}
            onChange={(e) => setSource(e.target.value as typeof source)}
            testId="founder-filter-source"
          >
            <option value="all">Everywhere</option>
            {(Object.keys(SOURCE_LABEL) as Array<FeedbackRow['source']>).map((s) => (
              <option key={s} value={s}>
                {SOURCE_LABEL[s]}
              </option>
            ))}
          </Select>
        </label>
        <label className="text-sm font-bold">
          Family
          <Select
            value={family}
            onChange={(e) => setFamily(e.target.value)}
            testId="founder-filter-family"
          >
            <option value="all">Every family</option>
            {families.map((f) => (
              <option key={f} value={f}>
                {f}
              </option>
            ))}
          </Select>
        </label>
        <label className="text-sm font-bold">
          Screen
          <Select
            value={screen}
            onChange={(e) => setScreen(e.target.value)}
            testId="founder-filter-screen"
          >
            <option value="all">Every screen</option>
            {screens.map((s) => (
              <option key={s} value={s}>
                {screenLabel(s)}
              </option>
            ))}
          </Select>
        </label>
        <div className="flex items-end">
          <Button variant="primary" onClick={download} testId="founder-download">
            Download spreadsheet
          </Button>
        </div>
      </div>

      <p className="text-sm text-purple-200" data-testid="founder-count">
        {shown.length} answer{shown.length === 1 ? '' : 's'} from {people.length}{' '}
        {people.length === 1 ? 'person' : 'people'}
      </p>

      <AtAGlance o={summary.overview} />
      <HowItsGoing o={summary.overview} />
      <ByScreen screens={summary.screens} />
      <InTheirWords quotes={summary.quotes} />
      <People people={people} />
    </div>
  );
}

// ─── FHS-675: the visual pieces ───────────────────────────────────────────────

function SectionTitle({ emoji, children }: { emoji: string; children: React.ReactNode }) {
  return (
    <h2 className="mb-3 flex items-center gap-2 font-heading text-xl">
      <span aria-hidden="true">{emoji}</span>
      {children}
    </h2>
  );
}

function StatTile({
  label,
  value,
  note,
  tone,
  testId,
}: {
  label: string;
  value: string;
  note?: string;
  tone: string;
  testId: string;
}) {
  return (
    <div
      className={`rounded-2xl border-2 border-black p-4 text-black shadow-neo ${tone}`}
      data-testid={testId}
    >
      <p className="text-xs font-black uppercase tracking-wide">{label}</p>
      <p className="mt-1 font-heading text-3xl sm:text-4xl">{value}</p>
      {note && <p className="mt-1 text-xs font-bold text-black/70">{note}</p>}
    </div>
  );
}

function AtAGlance({ o }: { o: Overview }) {
  return (
    <section>
      <SectionTitle emoji="✨">At a glance</SectionTitle>
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatTile
          label="Answers"
          value={String(o.answers)}
          tone="bg-yellow-300"
          testId="founder-tile-answers"
        />
        <StatTile
          label="People"
          value={String(o.people)}
          tone="bg-pink-300"
          testId="founder-tile-people"
        />
        <StatTile
          label="Families"
          value={String(o.families)}
          tone="bg-cyan-300"
          testId="founder-tile-families"
        />
        <StatTile
          label="Would recommend"
          value={o.recommend.average === null ? '-' : `${o.recommend.average}/10`}
          note={
            o.recommend.count
              ? `from ${o.recommend.count} answer${o.recommend.count === 1 ? '' : 's'}`
              : 'no scores yet'
          }
          tone="bg-green-300"
          testId="founder-tile-recommend"
        />
      </div>
    </section>
  );
}

/** A 0 to 5 bar with the number beside it. */
function MeterBar({
  label,
  r,
  compact = false,
}: {
  label: string;
  r: RatingSummary;
  compact?: boolean;
}) {
  const pct = r.average === null ? 0 : (r.average / 5) * 100;
  const tone =
    r.average === null
      ? 'bg-gray-300'
      : r.average >= 4
        ? 'bg-green-400'
        : r.average >= 3
          ? 'bg-yellow-400'
          : 'bg-red-400';
  return (
    <div>
      <div
        className={`flex items-baseline justify-between gap-2 ${compact ? 'text-xs' : 'text-sm'} font-bold`}
      >
        <span>{label}</span>
        <span className="tabular-nums">
          {r.average === null ? 'no ratings' : `${r.average} / 5`}
          {!compact && r.count > 0 && (
            <span className="ml-1 font-normal text-gray-500">({r.count})</span>
          )}
        </span>
      </div>
      <div
        className={`mt-1 overflow-hidden rounded-full border-2 border-black bg-white ${compact ? 'h-2.5' : 'h-4'}`}
        role="img"
        aria-label={`${label}: ${r.average === null ? 'no ratings' : `${r.average} out of 5`}`}
      >
        <div className={`h-full ${tone}`} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

function HowItsGoing({ o }: { o: Overview }) {
  const total = o.missIt.very + o.missIt.somewhat + o.missIt.not;
  const parts = [
    { key: 'very', label: 'Very disappointed', n: o.missIt.very, tone: 'bg-green-400' },
    { key: 'somewhat', label: 'Somewhat', n: o.missIt.somewhat, tone: 'bg-yellow-300' },
    { key: 'not', label: 'Not disappointed', n: o.missIt.not, tone: 'bg-red-300' },
  ];
  return (
    <section>
      <SectionTitle emoji="📊">How it is going</SectionTitle>
      <div className="grid gap-4 rounded-2xl border-2 border-black bg-white p-4 text-black shadow-neo sm:p-5 md:grid-cols-2">
        <div className="space-y-4">
          <MeterBar label="Solves a real problem" r={o.solvesProblem} />
          <MeterBar label="Easy to use" r={o.easeOfUse} />
          <MeterBar label="Will keep using it" r={o.keepUsing} />
        </div>
        <div data-testid="founder-miss-it">
          <p className="text-sm font-bold">How they would feel without Family Hub</p>
          {total === 0 ? (
            <p className="mt-2 text-sm text-gray-500">No answers yet.</p>
          ) : (
            <>
              <div
                className="mt-2 flex h-6 overflow-hidden rounded-full border-2 border-black"
                role="img"
                aria-label={parts
                  .map((pt) => `${pt.label} ${Math.round((pt.n / total) * 100)}%`)
                  .join(', ')}
              >
                {parts
                  .filter((pt) => pt.n > 0)
                  .map((pt) => (
                    <div
                      key={pt.key}
                      className={pt.tone}
                      style={{ width: `${(pt.n / total) * 100}%` }}
                    />
                  ))}
              </div>
              <ul className="mt-3 space-y-1.5 text-sm">
                {parts.map((pt) => (
                  <li key={pt.key} className="flex items-center gap-2">
                    <span
                      aria-hidden="true"
                      className={`h-3 w-3 rounded-full border border-black ${pt.tone}`}
                    />
                    <span className="flex-1">{pt.label}</span>
                    <span className="font-bold tabular-nums">
                      {Math.round((pt.n / total) * 100)}% ({pt.n})
                    </span>
                  </li>
                ))}
              </ul>
              <p className="mt-2 text-xs text-gray-500">
                40% or more “very disappointed” is the usual sign a product is a must-have.
              </p>
            </>
          )}
        </div>
      </div>
    </section>
  );
}

function ByScreen({ screens }: { screens: ScreenSummary[] }) {
  return (
    <section>
      <SectionTitle emoji="🧭">By screen</SectionTitle>
      {screens.length === 0 ? (
        <p className="text-purple-200">No per-screen answers yet.</p>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3" data-testid="founder-summary">
          {screens.map((sc) => (
            <article
              key={sc.screen}
              className="rounded-2xl border-2 border-black bg-white p-4 text-black shadow-neo"
              data-testid="founder-screen-card"
            >
              <h3 className="font-heading text-lg">{screenLabel(sc.screen)}</h3>
              <p className="text-xs font-bold text-gray-500">
                {sc.answers} answer{sc.answers === 1 ? '' : 's'} · {sc.people}{' '}
                {sc.people === 1 ? 'person' : 'people'}
              </p>
              <div className="mt-3 space-y-2">
                <MeterBar
                  compact
                  label="Solves a problem"
                  r={{ average: sc.solvesProblem, count: 0 }}
                />
                <MeterBar compact label="Easy to use" r={{ average: sc.easeOfUse, count: 0 }} />
                <MeterBar compact label="Keep using" r={{ average: sc.keepUsing, count: 0 }} />
              </div>
              {sc.features.length > 0 && (
                <div className="mt-3 flex flex-wrap gap-1.5">
                  {sc.features.map((f) => (
                    <span
                      key={f.name}
                      className="rounded-full border-2 border-black bg-pink-200 px-2.5 py-0.5 text-xs font-bold"
                    >
                      {f.name} · {f.count}
                    </span>
                  ))}
                </div>
              )}
            </article>
          ))}
        </div>
      )}
    </section>
  );
}

const QUOTE_GROUPS: Array<{ kind: QuoteKind; emoji: string; title: string; tone: string }> = [
  { kind: 'wish', emoji: '💡', title: 'Wishes', tone: 'bg-yellow-100' },
  { kind: 'pain', emoji: '😣', title: 'What is hard', tone: 'bg-red-100' },
  { kind: 'other', emoji: '💬', title: 'Other comments', tone: 'bg-cyan-100' },
];

function InTheirWords({ quotes }: { quotes: Quote[] }) {
  return (
    <section>
      <SectionTitle emoji="🗣️">In their words</SectionTitle>
      <div className="grid gap-4 lg:grid-cols-3">
        {QUOTE_GROUPS.map((g) => {
          const list = quotes.filter((q) => q.kind === g.kind);
          return (
            <div key={g.kind} data-testid={`founder-quotes-${g.kind}`}>
              <h3 className="mb-2 flex items-center gap-2 font-heading text-lg">
                <span aria-hidden="true">{g.emoji}</span>
                {g.title}
                <span className="rounded-full bg-white/20 px-2 text-sm">{list.length}</span>
              </h3>
              {list.length === 0 ? (
                <p className="text-sm text-purple-200">Nothing yet.</p>
              ) : (
                <ul className="space-y-3">
                  {list.map((q, i) => (
                    <li
                      key={`${q.createdAt}-${i}`}
                      className={`rounded-2xl border-2 border-black p-3 text-black shadow-neo-sm ${g.tone}`}
                    >
                      <p className="whitespace-pre-wrap break-words text-sm font-medium">
                        “{q.text}”
                      </p>
                      <p className="mt-2 text-xs font-bold text-black/60">
                        {q.who} · {q.where} · {formatWhen(q.createdAt)}
                      </p>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          );
        })}
      </div>
    </section>
  );
}

/** Five dots, filled up to the score. */
function Dots({ label, value }: { label: string; value: number | null }) {
  if (value === null) return null;
  return (
    <span
      className="flex items-center gap-1.5 text-xs font-bold"
      aria-label={`${label} ${value} out of 5`}
    >
      <span className="w-24 shrink-0 text-gray-600">{label}</span>
      <span aria-hidden="true" className="flex gap-1">
        {[1, 2, 3, 4, 5].map((n) => (
          <span
            key={n}
            className={`h-3 w-3 rounded-full border border-black ${n <= value ? 'bg-pink-400' : 'bg-white'}`}
          />
        ))}
      </span>
    </span>
  );
}

const MISS_IT_LABEL: Record<string, string> = {
  very: 'Would be very disappointed without it',
  somewhat: 'Would be somewhat disappointed without it',
  not: 'Would not be disappointed without it',
};

function People({ people }: { people: PersonGroup[] }) {
  return (
    <section>
      <SectionTitle emoji="👪">Each person</SectionTitle>
      {people.length === 0 ? (
        <p className="text-purple-200">No feedback matches these filters.</p>
      ) : (
        <div className="space-y-3">
          {people.map((p, i) => {
            const count = p.visits.reduce((n, v) => n + v.rows.length, 0);
            return (
              <div key={p.key} data-testid="founder-person">
                <CollapsibleSection
                  emoji={
                    <span className="font-heading text-lg text-black">
                      {[...p.person][0]?.toUpperCase() ?? '?'}
                    </span>
                  }
                  title={p.person}
                  {...(p.family ? { subtitle: p.family } : {})}
                  count={count}
                  defaultOpen={i < 3}
                >
                  <div className="space-y-3 text-black">
                    {p.visits.map((v, vi) => (
                      <div
                        key={v.visitId ?? `${p.key}-${vi}`}
                        className="rounded-xl border-2 border-dashed border-gray-300 p-3"
                        data-testid="founder-visit"
                      >
                        <p className="mb-2 text-xs font-black uppercase tracking-wide text-gray-500">
                          {v.visitId
                            ? `One visit · ${v.rows.length} answer${v.rows.length === 1 ? '' : 's'}`
                            : SOURCE_LABEL[v.rows[0]!.source]}
                        </p>
                        <ul className="space-y-4">
                          {v.rows.map((r, j) => (
                            <li key={`${r.createdAt}-${j}`} className="space-y-2">
                              <p className="text-sm font-bold">
                                {r.screen ? screenLabel(r.screen) : SOURCE_LABEL[r.source]}
                                <span className="ml-2 font-normal text-gray-500">
                                  {formatWhen(r.createdAt)}
                                </span>
                              </p>
                              {r.features.length > 0 && (
                                <p className="flex flex-wrap gap-1.5">
                                  {r.features.map((f) => (
                                    <span
                                      key={f}
                                      className="rounded-full border-2 border-black bg-pink-200 px-2.5 py-0.5 text-xs font-bold"
                                    >
                                      {f}
                                    </span>
                                  ))}
                                </p>
                              )}
                              <div className="space-y-1">
                                <Dots label="Solves" value={r.solvesProblem} />
                                <Dots label="Easy to use" value={r.easeOfUse} />
                                <Dots label="Keep using" value={r.keepUsing} />
                              </div>
                              {(r.recommendScore !== null || r.pmfDisappointment) && (
                                <p className="flex flex-wrap gap-1.5">
                                  {r.recommendScore !== null && (
                                    <span className="rounded-full border-2 border-black bg-cyan-100 px-2.5 py-0.5 text-xs font-bold">
                                      Recommend {r.recommendScore}/10
                                    </span>
                                  )}
                                  {r.pmfDisappointment && (
                                    <span className="rounded-full border-2 border-black bg-green-100 px-2.5 py-0.5 text-xs font-bold">
                                      {MISS_IT_LABEL[r.pmfDisappointment] ?? r.pmfDisappointment}
                                    </span>
                                  )}
                                </p>
                              )}
                              {(
                                [
                                  ['💡 Wish', r.featureRequest, 'bg-yellow-100'],
                                  ['😣 Hard', r.painPoint, 'bg-red-100'],
                                  ['💬 Other', r.otherFeedback, 'bg-cyan-100'],
                                ] as const
                              )
                                .filter(([, t]) => Boolean(t?.trim()))
                                .map(([label, t, tone]) => (
                                  <div
                                    key={label}
                                    className={`rounded-xl border-2 border-black p-2.5 ${tone}`}
                                  >
                                    <p className="text-xs font-black uppercase tracking-wide">
                                      {label}
                                    </p>
                                    <p className="mt-0.5 whitespace-pre-wrap break-words text-sm">
                                      “{t}”
                                    </p>
                                  </div>
                                ))}
                            </li>
                          ))}
                        </ul>
                      </div>
                    ))}
                  </div>
                </CollapsibleSection>
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}
