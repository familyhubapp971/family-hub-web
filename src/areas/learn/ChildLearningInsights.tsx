// FHS-401: Learning Insights for a single child, embedded as the 5th tab
// in ChildWorldPage. Parent/admin-only view (not visible to kids themselves).
//
// Differences from the parent-dashboard LearningInsightsTabPanel (FHS-385):
//   - No child-switcher: the child is fixed by the ChildWorldPage's :memberId param.
//   - Fetches GET /api/learn/insights?memberId=<prop> with the parent Bearer token.
//   - Layout matches the Magic Patterns neo-brutalist mock for this surface.
//   - Exposes World Flags continent progress panel (FHS-401 API extension).

import { useCallback, useEffect, useMemo, useState } from 'react';
import { RefreshCw, Trophy } from 'lucide-react';
import { useAuth } from '../../app/lib/auth-context';
import { useTenantSlug } from '../../app/lib/tenant-context';
import { API_BASE } from '../../app/lib/api';

// ─── API shapes ───────────────────────────────────────────────────────────────

type Subject = 'Maths' | 'Logic' | 'Science' | 'World Flags';

interface SubjectProgress {
  subject: Subject;
  progressPct: number;
  certificatesEarned: number;
  certificatesTotal: number;
  lastActive: string | null;
  needsHelp: boolean;
  accuracyPct: number | null;
  continentsExplored: number;
  continentsTotal: number;
  exploredContinents: string[];
}

interface WeakestArea {
  subject: string;
  detail: string;
  tip: string;
}

interface InsightsResponse {
  memberId: string;
  displayName: string;
  subjects: SubjectProgress[];
  weakest: WeakestArea | null;
  hasActivity: boolean;
}

// ─── Subject themes ───────────────────────────────────────────────────────────

const SUBJECT_THEME: Record<Subject, { bg: string; iconBg: string; emoji: string; label: string }> =
  {
    Maths: {
      bg: 'bg-yellow-50',
      iconBg: 'bg-yellow-300',
      emoji: '🔢',
      label: 'Maths',
    },
    Logic: {
      bg: 'bg-cyan-50',
      iconBg: 'bg-cyan-300',
      emoji: '🧩',
      label: 'Logic',
    },
    Science: {
      bg: 'bg-green-50',
      iconBg: 'bg-green-300',
      emoji: '🔬',
      label: 'Science',
    },
    'World Flags': {
      bg: 'bg-pink-50',
      iconBg: 'bg-pink-300',
      emoji: '🌍',
      label: 'World Flags',
    },
  };

function subjectTheme(subject: string) {
  return (
    SUBJECT_THEME[subject as Subject] ?? {
      bg: 'bg-purple-50',
      iconBg: 'bg-purple-300',
      emoji: '📚',
      label: subject,
    }
  );
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function relativeDate(iso: string | null): string {
  if (!iso) return 'Never';
  const diff = Date.now() - new Date(iso).getTime();
  const days = Math.floor(diff / 86_400_000);
  if (days === 0) return 'Today';
  if (days === 1) return 'Yesterday';
  return `${days} days ago`;
}

// ─── SVG accuracy ring (used per-subject card) ────────────────────────────────

function AccuracyRing({
  pct,
  size = 56,
  stroke = 5,
  label,
}: {
  pct: number | null;
  size?: number;
  stroke?: number;
  label: string;
}) {
  if (pct === null) {
    // No data yet: render a grey dashed ring placeholder.
    const r = (size - stroke) / 2;
    const cx = size / 2;
    return (
      <svg
        width={size}
        height={size}
        viewBox={`0 0 ${size} ${size}`}
        aria-label={label}
        role="img"
        data-testid="accuracy-ring"
      >
        <circle
          cx={cx}
          cy={cx}
          r={r}
          fill="none"
          stroke="#d1d5db"
          strokeWidth={stroke}
          strokeDasharray="4 3"
        />
        <text
          x={cx}
          y={cx + 1}
          textAnchor="middle"
          dominantBaseline="middle"
          fontSize={size / 5}
          fontWeight="bold"
          fill="#9ca3af"
          aria-hidden="true"
        >
          -
        </text>
      </svg>
    );
  }
  const clamped = Math.min(100, Math.max(0, pct));
  const r = (size - stroke) / 2;
  const circ = 2 * Math.PI * r;
  const offset = circ - (clamped / 100) * circ;
  const cx = size / 2;
  return (
    <svg
      width={size}
      height={size}
      viewBox={`0 0 ${size} ${size}`}
      aria-label={label}
      role="img"
      data-testid="accuracy-ring"
    >
      <circle cx={cx} cy={cx} r={r} fill="none" stroke="#e5e7eb" strokeWidth={stroke} />
      <circle
        cx={cx}
        cy={cx}
        r={r}
        fill="none"
        stroke="#7c3aed"
        strokeWidth={stroke}
        strokeDasharray={circ}
        strokeDashoffset={offset}
        strokeLinecap="round"
        transform={`rotate(-90 ${cx} ${cx})`}
      />
      <text
        x={cx}
        y={cx + 1}
        textAnchor="middle"
        dominantBaseline="middle"
        fontSize={size / 5}
        fontWeight="bold"
        fill="#1f2937"
        aria-hidden="true"
      >
        {clamped}%
      </text>
    </svg>
  );
}

// ─── Per-subject card ─────────────────────────────────────────────────────────

function SubjectCard({ sub }: { sub: SubjectProgress }) {
  const theme = subjectTheme(sub.subject);
  const slug = sub.subject.toLowerCase().replace(/\s+/g, '-');

  return (
    <article
      data-testid={`subject-card-${slug}`}
      className={`flex flex-col gap-3 rounded-xl border-2 border-black p-4 shadow-neo-sm ${theme.bg}`}
    >
      {/* Icon tile + trophy badge */}
      <div className="flex items-start justify-between">
        <div
          className={`grid h-12 w-12 place-items-center rounded-xl border-2 border-black text-2xl shadow-neo-xs ${theme.iconBg}`}
          aria-hidden="true"
        >
          {theme.emoji}
        </div>
        {sub.certificatesEarned > 0 && (
          <span
            data-testid={`trophy-badge-${slug}`}
            aria-label={`${sub.certificatesEarned} certificate${sub.certificatesEarned !== 1 ? 's' : ''}`}
            className="flex items-center gap-1 rounded-full border-2 border-yellow-400 bg-yellow-100 px-2 py-0.5 text-xs font-bold text-yellow-700"
          >
            <Trophy size={10} aria-hidden="true" />
            {sub.certificatesEarned}
          </span>
        )}
      </div>

      {/* Subject name */}
      <h3 className="font-heading text-base uppercase tracking-wide">{theme.label}</h3>

      {/* Accuracy ring + accuracy label */}
      <div className="flex items-center gap-3">
        <AccuracyRing
          pct={sub.accuracyPct}
          label={`${sub.subject} accuracy: ${sub.accuracyPct !== null ? `${sub.accuracyPct}%` : 'no data'}`}
        />
        <div>
          <p
            data-testid={`accuracy-label-${slug}`}
            className="font-heading text-lg font-bold text-gray-900"
          >
            ACCURACY{' '}
            <span className="text-purple-700">
              {sub.accuracyPct !== null ? `${sub.accuracyPct}%` : '-'}
            </span>
          </p>
          <p data-testid={`last-active-${slug}`} className="mt-0.5 text-xs font-bold text-gray-500">
            Last active {relativeDate(sub.lastActive)}
          </p>
        </div>
      </div>

      {/* Needs-help chip */}
      {sub.needsHelp && (
        <span
          data-testid={`needs-help-chip-${slug}`}
          role="status"
          aria-label={`${sub.subject}: needs a little help`}
          className="self-start rounded-full border-2 border-red-400 bg-red-100 px-2.5 py-1 text-[11px] font-bold text-red-700"
        >
          Needs a little help here
        </span>
      )}
    </article>
  );
}

// ─── "Where they're stuck" panel ──────────────────────────────────────────────

function StuckPanel({ weakest }: { weakest: WeakestArea }) {
  return (
    <section
      data-testid="stuck-panel"
      aria-labelledby="stuck-panel-heading"
      className="rounded-xl border-2 border-black bg-[#3d1065] p-5 text-white shadow-neo-sm"
    >
      <h3 id="stuck-panel-heading" className="mb-3 font-heading text-xl text-yellow-300">
        💡 WHERE THEY&apos;RE STUCK
      </h3>
      <p className="mb-1 font-heading text-lg" data-testid="stuck-subject">
        {weakest.subject}
      </p>
      <p className="mb-3 text-sm font-bold text-purple-200" data-testid="stuck-detail">
        {weakest.detail}
      </p>
      <div className="rounded-lg border border-purple-700 bg-purple-900/50 p-3">
        <p className="text-xs font-bold uppercase tracking-wider text-purple-300">Parent tip</p>
        <p className="mt-1 text-sm text-white" data-testid="stuck-tip">
          {weakest.tip}
        </p>
      </div>
    </section>
  );
}

// ─── World Flags continent panel ──────────────────────────────────────────────

function WorldFlagsPanel({ wf }: { wf: SubjectProgress }) {
  const pct =
    wf.continentsTotal > 0 ? Math.round((wf.continentsExplored / wf.continentsTotal) * 100) : 0;

  return (
    <section
      data-testid="world-flags-panel"
      aria-labelledby="wf-panel-heading"
      className="rounded-xl border-2 border-black bg-pink-50 p-5 shadow-neo-sm"
    >
      <h3 id="wf-panel-heading" className="mb-4 font-heading text-xl uppercase tracking-wide">
        🌍 WORLD FLAGS
      </h3>
      <div className="mb-3 flex items-center justify-between text-sm font-bold text-gray-700">
        <span>
          Continents explored:{' '}
          <span data-testid="wf-continents-explored" className="text-purple-700">
            {wf.continentsExplored}/{wf.continentsTotal}
          </span>
        </span>
        {wf.certificatesEarned > 0 && (
          <span
            data-testid="wf-cert-badge"
            className="flex items-center gap-1 rounded-full border-2 border-yellow-400 bg-yellow-100 px-2 py-0.5 text-xs font-bold text-yellow-700"
          >
            <Trophy size={10} aria-hidden="true" />
            {wf.certificatesEarned} cert{wf.certificatesEarned !== 1 ? 's' : ''}
          </span>
        )}
      </div>

      {/* Progress bar */}
      <div
        role="progressbar"
        aria-valuenow={pct}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label={`World Flags continent progress: ${pct}%`}
        className="mb-4 h-3 overflow-hidden rounded-full border-2 border-black bg-gray-200"
      >
        <div
          className="h-full rounded-full bg-pink-400 transition-all"
          style={{ width: `${pct}%` }}
          data-testid="wf-progress-bar"
        />
      </div>

      {/* Explored continent pills */}
      {wf.exploredContinents.length > 0 && (
        <div
          className="flex flex-wrap gap-2"
          aria-label="Explored continents"
          data-testid="wf-continent-pills"
        >
          {wf.exploredContinents.map((c) => (
            <span
              key={c}
              className="rounded-full border-2 border-black bg-pink-200 px-3 py-1 text-xs font-bold text-pink-900"
            >
              {c}
            </span>
          ))}
        </div>
      )}
    </section>
  );
}

// ─── Fetch state ──────────────────────────────────────────────────────────────

type FetchStatus =
  | { kind: 'loading' }
  | { kind: 'ready'; data: InsightsResponse }
  | { kind: 'error'; message: string };

// ─── Main component ───────────────────────────────────────────────────────────

interface ChildLearningInsightsProps {
  /** The child member whose insights to display (from ChildWorldPage's :memberId param). */
  memberId: string;
}

export function ChildLearningInsights({ memberId }: ChildLearningInsightsProps) {
  const { session } = useAuth();
  const slug = useTenantSlug();

  const headers = useMemo(
    () =>
      session?.access_token && slug
        ? {
            Authorization: `Bearer ${session.access_token}`,
            'x-tenant-slug': slug,
          }
        : null,
    [session, slug],
  );

  const [status, setStatus] = useState<FetchStatus>({ kind: 'loading' });
  const [retryCount, setRetryCount] = useState(0);

  const retry = useCallback(() => {
    setStatus({ kind: 'loading' });
    setRetryCount((n) => n + 1);
  }, []);

  // Guard: if the auth context has resolved but we still have no token/slug,
  // surface an error instead of staying in perpetual loading.
  useEffect(() => {
    // session===null means "auth resolved but no user" (distinct from "still loading").
    if (headers === null && session === null) {
      setStatus({ kind: 'error', message: 'Session expired. Please log in again.' });
    }
  }, [headers, session]);

  useEffect(() => {
    if (!headers || !memberId) return;
    setStatus({ kind: 'loading' });
    const ac = new AbortController();
    const qs = new URLSearchParams({ memberId }).toString();
    fetch(`${API_BASE}/api/learn/insights?${qs}`, { headers, signal: ac.signal })
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(`insights ${r.status}`))))
      .then((data: InsightsResponse) => {
        if (ac.signal.aborted) return;
        setStatus({ kind: 'ready', data });
      })
      .catch((err: Error) => {
        if (ac.signal.aborted) return;
        setStatus({ kind: 'error', message: err.message ?? 'Could not load insights.' });
      });
    return () => ac.abort();
    // retryCount included so the retry button re-triggers the fetch.
  }, [headers, memberId, retryCount]);

  if (status.kind === 'loading') {
    return (
      <p
        data-testid="child-insights-loading"
        className="font-bold text-purple-200"
        aria-busy="true"
      >
        Loading learning data…
      </p>
    );
  }

  if (status.kind === 'error') {
    return (
      <div
        data-testid="child-insights-error"
        role="alert"
        className="flex flex-col items-start gap-3 rounded-xl border-2 border-red-400 bg-red-50 p-5 shadow-neo-sm"
      >
        <p className="font-bold text-red-700">{status.message}</p>
        <button
          type="button"
          data-testid="child-insights-retry"
          onClick={retry}
          className="flex min-h-[44px] items-center gap-2 rounded-lg border-2 border-black bg-white px-4 py-2 text-sm font-bold text-black shadow-neo-xs motion-safe:hover:-translate-y-0.5"
        >
          <RefreshCw size={14} aria-hidden="true" />
          Try again
        </button>
      </div>
    );
  }

  const { data } = status;
  const childName = data.displayName;
  const needsHelpCount = data.subjects.filter((s) => s.needsHelp).length;
  const avgProgress =
    data.subjects.length > 0
      ? Math.round(data.subjects.reduce((a, s) => a + s.progressPct, 0) / data.subjects.length)
      : 0;
  const totalCerts = data.subjects.reduce((a, s) => a + s.certificatesEarned, 0);
  const wf = data.subjects.find((s) => s.subject === 'World Flags');

  return (
    <div className="space-y-6" data-testid="child-insights-panel">
      {/* Header */}
      <div className="flex items-center gap-3">
        <h2 className="font-heading text-2xl uppercase tracking-wide text-white">
          📖 LEARNING INSIGHTS
        </h2>
      </div>

      {/* Empty state */}
      {!data.hasActivity ? (
        <div
          data-testid="child-insights-empty"
          className="flex flex-col items-center justify-center rounded-xl border-2 border-black bg-white p-12 text-center shadow-neo-sm"
        >
          <div
            className="mb-4 flex h-20 w-20 items-center justify-center rounded-full border-2 border-black bg-purple-100 text-4xl shadow-neo-xs"
            aria-hidden="true"
          >
            📚
          </div>
          <h3 className="mb-2 font-heading text-2xl text-gray-900">No learning activity yet</h3>
          <p className="font-bold text-gray-500">
            {childName} hasn&apos;t started any lessons yet. Check back once they&apos;ve explored
            the Learn section.
          </p>
        </div>
      ) : (
        <div className="space-y-6">
          {/* Summary card */}
          <div
            data-testid="child-insights-summary"
            className="rounded-xl border-2 border-black bg-white p-5 shadow-neo-sm"
          >
            <p className="mb-4 font-bold text-gray-700" data-testid="child-insights-summary-text">
              {childName} is doing well
              {needsHelpCount > 0 && (
                <>
                  , but could use a hand in{' '}
                  <span className="text-red-600">
                    {needsHelpCount} subject{needsHelpCount !== 1 ? 's' : ''}
                  </span>
                </>
              )}
              .
            </p>

            {/* 3 stat tiles */}
            <div className="grid grid-cols-1 xs:grid-cols-3 gap-2 sm:gap-4">
              <div
                data-testid="stat-avg-progress"
                className="flex min-w-0 flex-col items-center rounded-xl border-2 border-black bg-purple-100 p-3 text-center shadow-neo-xs"
              >
                <span className="font-heading text-xl text-purple-700 sm:text-2xl md:text-3xl">
                  {avgProgress}%
                </span>
                <span className="mt-1 text-[10px] font-bold uppercase tracking-wider text-gray-600 sm:text-xs">
                  Avg Progress
                </span>
              </div>
              <div
                data-testid="stat-need-help"
                className="flex min-w-0 flex-col items-center rounded-xl border-2 border-black bg-red-100 p-3 text-center shadow-neo-xs"
              >
                <span className="font-heading text-xl text-red-600 sm:text-2xl md:text-3xl">
                  {needsHelpCount}
                </span>
                <span className="mt-1 text-[10px] font-bold uppercase tracking-wider text-gray-600 sm:text-xs">
                  Need Help
                </span>
              </div>
              <div
                data-testid="stat-certificates"
                className="flex min-w-0 flex-col items-center rounded-xl border-2 border-black bg-yellow-100 p-3 text-center shadow-neo-xs"
              >
                <span className="font-heading text-xl text-yellow-600 sm:text-2xl md:text-3xl">
                  {totalCerts}
                </span>
                <span className="mt-1 text-[10px] font-bold uppercase tracking-wider text-gray-600 sm:text-xs">
                  Certificates
                </span>
              </div>
            </div>
          </div>

          {/* Subject cards grid: mobile 1-col → sm 2-col → lg 4-col */}
          <section aria-labelledby="subjects-heading">
            <h3
              id="subjects-heading"
              className="mb-3 font-heading text-lg uppercase tracking-wide text-white"
            >
              Progress by subject
            </h3>
            <div
              data-testid="child-subject-cards-grid"
              className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4"
            >
              {data.subjects.map((sub) => (
                <SubjectCard key={sub.subject} sub={sub} />
              ))}
            </div>
          </section>

          {/* Where they're stuck */}
          {data.weakest !== null && <StuckPanel weakest={data.weakest} />}

          {/* World Flags continent panel */}
          {wf && wf.continentsTotal > 0 && <WorldFlagsPanel wf={wf} />}
        </div>
      )}
    </div>
  );
}
