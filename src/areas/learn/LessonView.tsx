import { useCallback, useEffect, useRef, useState } from 'react';
import { Check, X, Trophy, ArrowRight } from 'lucide-react';
import { API_BASE } from '../../app/lib/api';
import { MathsAILesson } from './maths/MathsAILesson';
import { useBodyScrollLock } from '@familyhub/ui';

// FHS-283: interactive Learn lesson. Difficulty pills + a question/answer area
// + a streak/best/score stats bar with progress toward a certificate. Grading
// and all stats are server-authoritative (POST /api/learn/:subject/answer).
//
// FHS-371: Logic sub-topic picker: when subject === 'Logic', a row of 4 sub-
// topic pills appears above the difficulty pills; selecting one refetches
// questions filtered by that sub-topic.
//
// FHS-389: Maths in kid mode: probe the AI endpoint once on mount. When
// { enabled: true }, surface a toggleable AI Lesson panel above the static
// question bank. When { enabled: false } (flag is off), the static bank is
// the full experience: no broken AI button visible.
//
// FHS-397: Design parity: certificate modal, wrong-answer reveal, streak
// celebration overlay, animate-shake on wrong choice, gradient progress bar.

type Difficulty = 'easy' | 'medium' | 'hard';
const DIFFICULTIES: Difficulty[] = ['easy', 'medium', 'hard'];
const DIFFICULTY_LABEL: Record<Difficulty, string> = {
  easy: 'Easy',
  medium: 'Medium',
  hard: 'Hard',
};

// Keep in sync with family-hub-api src/areas/learn/learn-questions.ts LOGIC_SUBTOPICS
const LOGIC_SUBTOPICS = [
  { slug: 'patterns', label: 'Patterns' },
  { slug: 'odd-one-out', label: 'Odd One Out' },
  { slug: 'if-then', label: 'If…Then' },
  { slug: 'sorting', label: 'Sorting' },
] as const;
type LogicSubtopic = (typeof LOGIC_SUBTOPICS)[number]['slug'];

// FHS-397: wrong-answer encouragement phrases (ported from MathsLesson).
const ENCOURAGEMENT = ['Try again!', 'Almost!', 'Keep going!', 'You can do it!', 'Don’t give up!'];

// FHS-397: streak milestone messages. Subject-neutral (no "Maths" leaking to Science).
const STREAK_MESSAGES: Record<number, string> = {
  3: 'On fire! 🔥',
  5: 'Super Star! ⭐',
  10: 'Quiz Wizard! 🧙',
  15: 'Unstoppable! 🚀',
  20: 'Legendary! 🏆',
};
const STREAK_MILESTONES = [3, 5, 10, 15, 20] as const;

// FHS-397: confetti pieces for the certificate modal.
const CONFETTI_EMOJIS = ['🌟', '🎉', '🎊', '✨', '🏆', '🥇', '💫', '🌈'];

function pickRandom<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)] as T;
}

interface Question {
  id: string;
  prompt: string;
  choices: string[];
}
interface Stats {
  progress: number;
  score: number;
  streak: number;
  best: number;
  answered: number;
  certificate: boolean;
}
interface QuestionsResponse {
  subject: string;
  difficulty: Difficulty;
  questions: Question[];
  stats: Stats;
}
interface AnswerResponse {
  correct: boolean;
  answerIndex: number;
  stats: Stats;
}

type Headers = Record<string, string> | null;

// ─── Certificate modal (FHS-397) ─────────────────────────────────────────────

function CertificateModal({ subject, onDismiss }: { subject: string; onDismiss: () => void }) {
  const dismissRef = useRef(onDismiss);
  // Keep ref current so the effect closure never stales, without re-running the timer.
  useEffect(() => {
    dismissRef.current = onDismiss;
  }, [onDismiss]);

  // Timer runs exactly once on mount: stable [] deps, no timer-reset on parent re-render.
  useEffect(() => {
    const t = setTimeout(() => dismissRef.current(), 6000);
    return () => clearTimeout(t);
  }, []);

  // Move focus to the dismiss button when the modal opens (keyboard a11y).
  const dismissBtnRef = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    dismissBtnRef.current?.focus();
  }, []);

  const today = new Date().toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });

  return (
    <>
      {/* Inline keyframes: Tailwind can't express these without a plugin */}
      <style>{`
        @keyframes certPop {
          0% { transform: scale(0) rotate(-8deg); opacity: 0; }
          40% { transform: scale(1.1) rotate(2deg); opacity: 1; }
          60% { transform: scale(0.95) rotate(-1deg); }
          80% { transform: scale(1.03) rotate(0.5deg); }
          100% { transform: scale(1) rotate(0deg); opacity: 1; }
        }
        .cert-pop { animation: certPop 0.7s cubic-bezier(0.34,1.56,0.64,1) forwards; }

        @keyframes certShine {
          0% { background-position: -200% center; }
          100% { background-position: 200% center; }
        }
        .cert-shine { background-size: 200% 100%; animation: certShine 3s linear infinite; }

        @keyframes certWiggle {
          0%,100% { transform: rotate(-3deg) scale(1); }
          25% { transform: rotate(3deg) scale(1.05); }
          50% { transform: rotate(-3deg) scale(1); }
          75% { transform: rotate(3deg) scale(1.05); }
        }
        .cert-wiggle { animation: certWiggle 0.6s ease-in-out 0.7s 3; }

        @keyframes confettiFall {
          0% { transform: translateY(-100vh) rotate(0deg); opacity: 1; }
          100% { transform: translateY(100vh) rotate(720deg); opacity: 0; }
        }
        .cert-confetti { animation: confettiFall 3s ease-in-out infinite; }
      `}</style>

      {/* Outer wrapper: dialog semantics */}
      <div
        data-testid="lesson-certificate-modal"
        role="dialog"
        aria-modal="true"
        aria-label={`${subject} certificate of achievement`}
        className="fixed inset-0 z-50 flex items-center justify-center"
      >
        {/* Dismiss backdrop (native button: a11y compliant) */}
        <button
          type="button"
          aria-label="Close certificate"
          className="absolute inset-0 bg-black/50 backdrop-blur-sm"
          onClick={onDismiss}
        />

        {/* Floating confetti (pointer-events-none so it doesn't block the backdrop button) */}
        <div className="pointer-events-none absolute inset-0 overflow-hidden">
          {CONFETTI_EMOJIS.map((e, i) => (
            <span
              key={i}
              aria-hidden="true"
              className="cert-confetti absolute text-2xl sm:text-3xl"
              style={{ left: `${10 + ((i * 10) % 80)}%`, animationDelay: `${i * 200}ms` }}
            >
              {e}
            </span>
          ))}
        </div>

        {/* Certificate card: sits above the backdrop button via z-index */}
        <div className="cert-pop relative z-10 mx-4 w-full max-w-md overflow-hidden rounded-2xl border-2 border-black bg-gradient-to-br from-yellow-50 via-white to-amber-50 shadow-neo-lg">
          {/* Gold header band */}
          <div className="cert-shine border-b-2 border-black bg-gradient-to-r from-yellow-400 via-amber-400 to-yellow-500 px-6 py-4 text-center">
            <p className="text-xs font-bold uppercase tracking-[0.3em] text-yellow-900">
              Certificate of Achievement
            </p>
          </div>

          {/* Certificate body */}
          <div className="space-y-4 px-6 py-6 text-center">
            {/* Trophy */}
            <div className="cert-wiggle inline-block text-5xl sm:text-6xl" aria-hidden="true">
              🏆
            </div>

            {/* Achievement */}
            <div className="rounded-xl border-2 border-black bg-white p-4 shadow-neo-xs">
              <p className="text-lg font-black text-gray-900">{subject}</p>
              <p className="text-sm font-bold text-amber-600">Certificate Earned!</p>
            </div>

            {/* Date */}
            <p className="text-xs font-bold text-gray-400">{today}</p>

            {/* Stars */}
            <div className="flex justify-center gap-1" aria-hidden="true">
              {Array.from({ length: 5 }).map((_, i) => (
                <span
                  key={i}
                  className="animate-pulse text-xl"
                  style={{ animationDelay: `${i * 150}ms` }}
                >
                  ⭐
                </span>
              ))}
            </div>

            {/* Dismiss: receives focus on modal open */}
            <button
              ref={dismissBtnRef}
              data-testid="lesson-cert-dismiss"
              type="button"
              onClick={onDismiss}
              className="rounded-xl border-2 border-black bg-gradient-to-r from-yellow-400 to-amber-500 px-8 py-3 text-sm font-black shadow-neo-sm transition-all active:translate-y-0.5 motion-safe:hover:shadow-neo-xs sm:text-base"
            >
              Awesome! 🎉
            </button>
          </div>
        </div>
      </div>
    </>
  );
}

// ─── Streak celebration overlay (FHS-397) ────────────────────────────────────

function StreakOverlay({ message }: { message: string }) {
  return (
    <div
      data-testid="lesson-streak-overlay"
      aria-live="assertive"
      className="pointer-events-none fixed inset-0 z-40 flex items-center justify-center"
    >
      {/* motion-safe: required for reduced-motion accessibility */}
      <div className="motion-safe:animate-bounce text-center">
        <p className="bg-gradient-to-r from-yellow-400 via-pink-500 to-purple-500 bg-clip-text text-3xl font-black text-transparent drop-shadow-lg sm:text-5xl md:text-6xl">
          {message}
        </p>
      </div>
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export function LessonView({
  subject,
  memberId,
  kidToken,
  headers,
}: {
  subject: string;
  memberId?: string;
  kidToken?: string;
  headers: Headers;
}) {
  const kid = !!kidToken;
  const isMaths = subject === 'Maths';
  const isLogic = subject === 'Logic';

  // FHS-389: AI Maths lesson availability (kid + Maths only).
  // 'unknown' = not probed yet; 'enabled' = show AI panel toggle;
  // 'disabled' = flag is off, skip AI UI entirely (static bank only).
  const [aiStatus, setAiStatus] = useState<'unknown' | 'enabled' | 'disabled'>('unknown');
  const [showAiLesson, setShowAiLesson] = useState(false);

  useEffect(() => {
    if (!kid || !isMaths || !kidToken || aiStatus !== 'unknown') return;
    let cancelled = false;
    // Cheap GET probe: returns just { enabled } with NO Anthropic call, so
    // checking availability never burns a paid lesson generation.
    fetch(`${API_BASE}/api/kid/learn/maths/ai-lesson/status`, {
      headers: { Authorization: `Bearer ${kidToken}` },
    })
      .then((r) => (r.ok ? r.json() : null))
      .then((data: { enabled: boolean } | null) => {
        if (!cancelled) setAiStatus(data?.enabled ? 'enabled' : 'disabled');
      })
      .catch(() => {
        if (!cancelled) setAiStatus('disabled');
      });
    return () => {
      cancelled = true;
    };
  }, [kid, isMaths, kidToken, aiStatus]);

  const [difficulty, setDifficulty] = useState<Difficulty>('easy');
  const [subtopic, setSubtopic] = useState<LogicSubtopic>('patterns');
  const [questions, setQuestions] = useState<Question[]>([]);
  const [idx, setIdx] = useState(0);
  const [stats, setStats] = useState<Stats | null>(null);
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading');
  const [picked, setPicked] = useState<number | null>(null);
  const [result, setResult] = useState<AnswerResponse | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [pickError, setPickError] = useState(false);
  // FHS-397: shake the wrong-choice button briefly after a wrong answer.
  const [shakingIndex, setShakingIndex] = useState<number | null>(null);
  const shakeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // FHS-397: random encouragement for the current wrong-answer feedback card.
  const [currentEncouragement, setCurrentEncouragement] = useState(() => pickRandom(ENCOURAGEMENT));
  // FHS-397: certificate modal: fires only on the not-certified→certified transition.
  // Seeded to true on first stats load if already certified (pre-existing cert = no modal).
  const certShown = useRef(false);
  const [showCertModal, setShowCertModal] = useState(false);
  // FHS-397: streak overlay: track which milestones have already been celebrated.
  // Seeded from initial stats so re-entering a lesson at streak 10 doesn't re-celebrate.
  const celebratedStreaks = useRef<Set<number>>(new Set());
  // true once the first stats response has been processed (used for seeding guards).
  const firstStatsSeeded = useRef(false);
  const [streakMessage, setStreakMessage] = useState<string | null>(null);
  // Bumped on every (re)load so a slow answer POST from a previous round/
  // difficulty can't overwrite fresh state when it finally resolves.
  const roundId = useRef(0);

  // Lock body scroll while the certificate modal is open (FHS-412).
  useBodyScrollLock(showCertModal);

  // Cleanup shake timer on unmount so no setState-after-unmount.
  useEffect(() => {
    return () => {
      if (shakeTimerRef.current !== null) clearTimeout(shakeTimerRef.current);
    };
  }, []);

  const load = useCallback(() => {
    if (!headers) return;
    let cancelled = false;
    roundId.current += 1;
    setStatus('loading');
    setPicked(null);
    setResult(null);
    setPickError(false);
    setIdx(0);
    const subtopicParam = isLogic ? `&subtopic=${subtopic}` : '';
    const url = kid
      ? `${API_BASE}/api/kid/learn/${encodeURIComponent(subject)}/questions?difficulty=${difficulty}${subtopicParam}`
      : `${API_BASE}/api/learn/${encodeURIComponent(subject)}/questions?memberId=${memberId}&difficulty=${difficulty}${subtopicParam}`;
    fetch(url, { headers })
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error('load failed'))))
      .then((body: QuestionsResponse) => {
        if (cancelled) return;
        setQuestions(body.questions ?? []);
        setStats(body.stats);
        setStatus('ready');
        // FHS-397: seed guards from the first stats load so we only celebrate
        // in-session transitions, not values that were already true on arrival.
        if (!firstStatsSeeded.current) {
          firstStatsSeeded.current = true;
          // If already certified, mark the cert as already shown.
          if (body.stats.certificate) certShown.current = true;
          // Seed every milestone already reached so the overlay doesn't fire for them.
          for (const milestone of STREAK_MILESTONES) {
            if (body.stats.streak >= milestone) celebratedStreaks.current.add(milestone);
          }
        }
      })
      .catch(() => {
        if (!cancelled) setStatus('error');
      });
    return () => {
      cancelled = true;
    };
  }, [headers, kid, subject, memberId, difficulty, isLogic, subtopic]);

  useEffect(() => load(), [load]);

  // FHS-397: fire certificate modal only on the not-certified → certified transition.
  useEffect(() => {
    if (stats?.certificate && !certShown.current) {
      certShown.current = true;
      setShowCertModal(true);
    }
  }, [stats?.certificate]);

  // FHS-397: fire streak overlay only at in-session milestone crossings.
  useEffect(() => {
    if (!stats) return;
    const streak = stats.streak;
    for (const milestone of STREAK_MILESTONES) {
      if (streak >= milestone && !celebratedStreaks.current.has(milestone)) {
        celebratedStreaks.current.add(milestone);
        const msg = STREAK_MESSAGES[milestone] ?? '';
        setStreakMessage(msg);
        // Auto-dismiss overlay after 2 s.
        const t = setTimeout(() => setStreakMessage(null), 2000);
        return () => clearTimeout(t);
      }
    }
  }, [stats?.streak]); // eslint-disable-line react-hooks/exhaustive-deps

  const current = questions[idx] ?? null;

  const onPick = async (choiceIndex: number) => {
    if (!headers || !current || picked !== null || submitting) return;
    const myRound = roundId.current;
    setPicked(choiceIndex);
    setPickError(false);
    setSubmitting(true);
    try {
      const answerUrl = kid
        ? `${API_BASE}/api/kid/learn/${encodeURIComponent(subject)}/answer`
        : `${API_BASE}/api/learn/${encodeURIComponent(subject)}/answer`;
      const res = await fetch(answerUrl, {
        method: 'POST',
        headers: { ...headers, 'Content-Type': 'application/json' },
        body: JSON.stringify(
          kid
            ? { questionId: current.id, choiceIndex }
            : { memberId, questionId: current.id, choiceIndex },
        ),
      });
      if (roundId.current !== myRound) return; // difficulty/round changed: drop it
      if (res.ok) {
        const body = (await res.json()) as AnswerResponse;
        setResult(body);
        setStats(body.stats);
        // FHS-397: shake the wrong button and pick a fresh encouragement phrase.
        if (!body.correct) {
          setShakingIndex(choiceIndex);
          setCurrentEncouragement(pickRandom(ENCOURAGEMENT));
          if (shakeTimerRef.current !== null) clearTimeout(shakeTimerRef.current);
          shakeTimerRef.current = setTimeout(() => setShakingIndex(null), 500);
        }
      } else {
        setPicked(null);
        setPickError(true);
      }
    } catch {
      if (roundId.current === myRound) {
        setPicked(null); // let the child try again instead of freezing
        setPickError(true);
      }
    } finally {
      if (roundId.current === myRound) setSubmitting(false);
    }
  };

  const onNext = () => {
    if (status === 'loading') return; // guard double-clicks
    setPicked(null);
    setResult(null);
    setPickError(false);
    // Clear any in-flight shake timer.
    if (shakeTimerRef.current !== null) {
      clearTimeout(shakeTimerRef.current);
      shakeTimerRef.current = null;
    }
    setShakingIndex(null);
    if (idx + 1 < questions.length) setIdx(idx + 1);
    else load(); // start a fresh round of the same difficulty
  };

  return (
    <div className="flex flex-col gap-4" data-testid="lesson-view">
      {/* FHS-397: certificate modal (full-screen, fires once on earn) */}
      {showCertModal && (
        <CertificateModal subject={subject} onDismiss={() => setShowCertModal(false)} />
      )}

      {/* FHS-397: streak celebration overlay */}
      {streakMessage && <StreakOverlay message={streakMessage} />}

      {/* Inline keyframes for animate-shake (FHS-397) */}
      <style>{`
        @keyframes shake {
          0%,100% { transform: translateX(0); }
          25% { transform: translateX(-6px); }
          75% { transform: translateX(6px); }
        }
        .animate-shake { animation: shake 0.4s ease-in-out; }
      `}</style>

      {/* FHS-389: AI Maths lesson toggle (kid + Maths + flag ON only) */}
      {kid && isMaths && aiStatus === 'enabled' && (
        <div data-testid="ai-lesson-section">
          <button
            data-testid="ai-lesson-toggle"
            type="button"
            aria-expanded={showAiLesson}
            onClick={() => setShowAiLesson((v) => !v)}
            className="w-full flex items-center justify-between gap-3 rounded-xl border-2 border-black bg-gradient-to-r from-blue-50 to-indigo-50 px-4 py-3 font-black text-sm shadow-neo-xs transition-transform motion-safe:hover:-translate-y-0.5 min-h-[44px]"
          >
            <span>✨ Try an AI Maths Lesson</span>
            <span
              className={`text-xs rounded-full border-2 border-black px-2 py-0.5 ${showAiLesson ? 'bg-blue-500 text-white' : 'bg-white text-gray-700'}`}
            >
              {showAiLesson ? 'Hide' : 'Show'}
            </span>
          </button>
          {showAiLesson && (
            <div className="mt-3">
              <MathsAILesson kidToken={kidToken!} onBack={() => setShowAiLesson(false)} />
            </div>
          )}
        </div>
      )}

      {/* Logic sub-topic picker: only shown for the Logic subject */}
      {isLogic && (
        <div className="flex flex-col gap-2">
          <p className="text-xs font-black uppercase tracking-wide text-gray-500">Topic</p>
          <div className="flex flex-wrap gap-2" role="group" aria-label="Logic topic">
            {LOGIC_SUBTOPICS.map(({ slug, label }) => (
              <button
                key={slug}
                type="button"
                data-testid={`lesson-subtopic-${slug}`}
                aria-pressed={subtopic === slug}
                disabled={submitting}
                onClick={() => setSubtopic(slug)}
                className={`min-h-[44px] rounded-full border-2 border-black px-4 py-2 text-sm font-black shadow-neo-xs transition-transform focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-600 disabled:opacity-60 motion-safe:enabled:hover:-translate-y-0.5 ${
                  subtopic === slug ? 'bg-violet-400 text-white' : 'bg-white text-gray-800'
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Difficulty pills */}
      <div className="flex flex-wrap gap-2" role="group" aria-label="Difficulty">
        {DIFFICULTIES.map((d) => (
          <button
            key={d}
            type="button"
            data-testid={`lesson-difficulty-${d}`}
            aria-pressed={difficulty === d}
            disabled={submitting}
            onClick={() => setDifficulty(d)}
            className={`min-h-[44px] rounded-full border-2 border-black px-4 py-2 text-sm font-black shadow-neo-xs transition-transform focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-600 disabled:opacity-60 motion-safe:enabled:hover:-translate-y-0.5 ${
              difficulty === d ? 'bg-violet-400 text-white' : 'bg-white text-gray-800'
            }`}
          >
            {DIFFICULTY_LABEL[d]}
          </button>
        ))}
      </div>

      {/* Stats bar */}
      {stats && (
        <div
          className="grid grid-cols-3 gap-2 rounded-xl border-2 border-black bg-white p-3 shadow-neo-sm"
          data-testid="lesson-stats"
        >
          <Stat label="Streak" value={stats.streak} emoji="🔥" testid="lesson-stat-streak" />
          <Stat label="Best" value={stats.best} emoji="🏅" testid="lesson-stat-best" />
          <Stat label="Score" value={stats.score} emoji="⭐" testid="lesson-stat-score" />
        </div>
      )}

      {/* Progress + certificate (inline banner: kept for persistent visibility) */}
      {stats && (
        <div className="rounded-xl border-2 border-black bg-white p-3 shadow-neo-sm">
          <div className="mb-1 flex items-center justify-between text-xs font-black uppercase tracking-wide">
            <span>Certificate progress</span>
            <span data-testid="lesson-progress-pct">{stats.progress}%</span>
          </div>
          {/* FHS-397: gradient fill (was flat bg-green-400) */}
          <div className="h-3 w-full overflow-hidden rounded-full border-2 border-black bg-gray-100">
            <div
              data-testid="lesson-progress"
              className="h-full bg-gradient-to-r from-green-400 to-emerald-500 transition-all"
              style={{ width: `${stats.progress}%` }}
            />
          </div>
          {/* Inline banner kept as a persistent earned indicator alongside the modal */}
          {stats.certificate && (
            <div
              data-testid="lesson-certificate"
              className="mt-3 flex items-center gap-2 rounded-lg border-2 border-black bg-yellow-200 px-3 py-2 text-sm font-black"
            >
              <Trophy size={18} aria-hidden="true" />
              {subject} certificate earned! 🎉
            </div>
          )}
        </div>
      )}

      {/* Question / answer */}
      {status === 'loading' && (
        <p
          data-testid="lesson-loading"
          aria-busy="true"
          className="text-sm font-bold text-gray-500"
        >
          Loading the lesson&hellip;
        </p>
      )}
      {status === 'error' && (
        <p data-testid="lesson-error" role="alert" className="text-sm font-bold text-red-500">
          Couldn&rsquo;t load the lesson. Try again.
        </p>
      )}
      {status === 'ready' && !current && (
        <p
          data-testid="lesson-empty"
          className="rounded-xl border-2 border-black bg-white p-5 text-sm font-bold text-gray-500 shadow-neo-sm"
        >
          No questions here yet. Try a different difficulty.
        </p>
      )}
      {status === 'ready' && current && (
        <div
          className="rounded-xl border-2 border-black bg-white p-5 shadow-neo-sm"
          data-testid="lesson-question"
        >
          <p className="mb-4 font-heading text-2xl">{current.prompt}</p>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            {current.choices.map((choice, i) => {
              const isPicked = picked === i;
              const isCorrect = result !== null && result.answerIndex === i;
              const showWrong = result !== null && isPicked && !result.correct;
              const isShaking = shakingIndex === i;
              return (
                <button
                  key={i}
                  type="button"
                  data-testid={`lesson-choice-${i}`}
                  disabled={picked !== null}
                  onClick={() => onPick(i)}
                  className={`flex min-h-[48px] items-center justify-between gap-2 rounded-xl border-2 border-black px-4 py-3 text-left font-black shadow-neo-xs transition-transform focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-600 disabled:cursor-default motion-safe:enabled:hover:-translate-y-0.5 ${
                    isCorrect
                      ? 'bg-green-300'
                      : showWrong
                        ? 'bg-red-300'
                        : 'bg-white disabled:opacity-60'
                  } ${isShaking ? 'animate-shake' : ''}`}
                >
                  <span>{choice}</span>
                  {isCorrect && <Check size={18} aria-hidden="true" />}
                  {showWrong && <X size={18} aria-hidden="true" />}
                </button>
              );
            })}
          </div>

          {pickError && (
            <p
              data-testid="lesson-pick-error"
              role="alert"
              className="mt-4 text-sm font-black text-red-600"
            >
              Something went wrong. Tap a choice to try again.
            </p>
          )}

          {result && (
            <div className="mt-4 flex flex-col gap-3">
              {result.correct ? (
                <p
                  data-testid="lesson-feedback"
                  aria-live="polite"
                  className="text-sm font-black text-green-600"
                >
                  Correct! 🎉
                </p>
              ) : (
                /* FHS-397: wrong-answer feedback card with encouragement + correct answer reveal */
                <div
                  data-testid="lesson-feedback"
                  className="rounded-xl border-2 border-black bg-red-50 px-4 py-3 shadow-neo-xs"
                  aria-live="polite"
                >
                  <p className="font-black text-red-600">{currentEncouragement}</p>
                  <p className="mt-1 text-sm font-bold text-red-500">
                    The answer was:{' '}
                    <span data-testid="lesson-correct-answer" className="font-black text-red-700">
                      {current.choices[result.answerIndex]}
                    </span>
                  </p>
                </div>
              )}
              <div className="flex justify-end">
                <button
                  type="button"
                  data-testid="lesson-next"
                  onClick={onNext}
                  disabled={status !== 'ready'}
                  className="flex min-h-[44px] items-center gap-2 rounded-xl border-2 border-black bg-violet-400 px-4 py-2 font-black text-white shadow-neo-xs transition-transform focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-600 disabled:opacity-60 motion-safe:enabled:hover:-translate-y-0.5"
                >
                  Next
                  <ArrowRight size={16} aria-hidden="true" />
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function Stat({
  label,
  value,
  emoji,
  testid,
}: {
  label: string;
  value: number;
  emoji: string;
  testid: string;
}) {
  return (
    <div className="min-w-0 text-center" data-testid={testid}>
      <p className="truncate text-xl font-black sm:text-2xl">
        <span aria-hidden="true">{emoji}</span> {value}
      </p>
      <p className="text-xs font-bold uppercase tracking-wide text-gray-500">{label}</p>
    </div>
  );
}
