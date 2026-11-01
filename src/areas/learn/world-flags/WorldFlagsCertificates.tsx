import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Lock, Timer, Trophy, RotateCcw, Award } from 'lucide-react';
import { useAuth } from '../../../app/lib/auth-context';
import { useTenantSlug } from '../../../app/lib/tenant-context';
import { COUNTRIES, CONTINENTS } from './countries';
import { FlagImage } from './FlagImage';
import {
  CONTINENT_GRADIENT,
  CONTINENT_EMOJI,
  continentId,
  generateTimedQuestion,
  redactCountryName,
  WORLD_QUIZ_DURATION,
  QUIZ_TIERS,
  getQuizTier,
  getNextQuizTier,
  bestScoreKey,
  readBestScore,
  writeBestScore,
  type TimedQuizQuestion,
} from './shared';
import { worldFlagsApi } from './worldFlagsApi';

// World Flags: Certificates + timed-quiz sub-tab.
//
// Shows a per-continent explorer certificate (earned when all that
// continent's flags are explored) and a 60-second timed flag quiz per earned
// continent, plus an all-continents quiz once every continent is done. Best
// scores + award tiers (Bronze/Silver/Gold) are kept per-device in
// localStorage.

type Status = 'loading' | 'ready' | 'error';

interface ContinentCert {
  continent: string;
  explored: number;
  total: number;
  completed: boolean;
}

// ─── Timed quiz (60s) ────────────────────────────────────────────────────────

function WorldExplorerQuiz({
  userKey,
  continent,
  onExit,
}: {
  userKey: string;
  continent: string;
  onExit: () => void;
}) {
  const key = bestScoreKey(userKey, continent);
  const [timeLeft, setTimeLeft] = useState(WORLD_QUIZ_DURATION);
  const [score, setScore] = useState(0);
  const [question, setQuestion] = useState<TimedQuizQuestion>(() =>
    generateTimedQuestion(continent),
  );
  const [selected, setSelected] = useState<string | null>(null);
  const [isCorrect, setIsCorrect] = useState<boolean | null>(null);
  const [finished, setFinished] = useState(false);
  const [bestScore, setBestScore] = useState(() => readBestScore(key));
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const advanceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const feedbackRef = useRef('');

  const emoji = CONTINENT_EMOJI[continent] ?? '🌍';

  const startTimer = useCallback(() => {
    if (timerRef.current) clearInterval(timerRef.current);
    timerRef.current = setInterval(() => {
      setTimeLeft((t) => {
        if (t <= 1) {
          if (timerRef.current) clearInterval(timerRef.current);
          setFinished(true);
          return 0;
        }
        return t - 1;
      });
    }, 1000);
  }, []);

  useEffect(() => {
    startTimer();
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      if (advanceRef.current) clearTimeout(advanceRef.current);
    };
  }, [startTimer]);

  // Persist a new best when the round ends.
  useEffect(() => {
    if (finished && score > bestScore) {
      setBestScore(score);
      writeBestScore(key, score);
    }
  }, [finished, score, bestScore, key]);

  const nextQuestion = useCallback(() => {
    setQuestion(generateTimedQuestion(continent));
    setSelected(null);
    setIsCorrect(null);
  }, [continent]);

  const CORRECT_MSGS = ['✅ Correct!', '🌟 Well done!', '🏆 Amazing!', '⭐ Super!'];

  const handleAnswer = (choice: string) => {
    if (selected !== null || finished) return;
    setSelected(choice);
    if (choice === question.answer) {
      setIsCorrect(true);
      setScore((s) => s + 1);
      feedbackRef.current = CORRECT_MSGS[Math.floor(Math.random() * CORRECT_MSGS.length)]!;
      advanceRef.current = setTimeout(nextQuestion, 500);
    } else {
      setIsCorrect(false);
      feedbackRef.current = `❌ It was ${question.answer}`;
      advanceRef.current = setTimeout(nextQuestion, 1000);
    }
  };

  const restart = () => {
    // Cancel any pending advance from the previous round's last answer so it
    // can't skip the first question of the new round.
    if (advanceRef.current) clearTimeout(advanceRef.current);
    setTimeLeft(WORLD_QUIZ_DURATION);
    setScore(0);
    setFinished(false);
    setSelected(null);
    setIsCorrect(null);
    nextQuestion();
    startTimer();
  };

  if (finished) {
    const isNewBest = score > bestScore;
    const tier = getQuizTier(score);
    const nextTier = getNextQuizTier(score);
    return (
      <div data-testid="wfquiz-results" className="flex flex-col gap-4">
        <div className="flex flex-col items-center gap-4 rounded-xl border-2 border-black bg-white p-6 text-center shadow-neo-sm">
          <div className="text-5xl">{isNewBest ? '🏆' : '⏰'}</div>
          <h3 className="font-heading text-xl font-black text-gray-800">
            {isNewBest ? 'New Best Score!' : "Time's Up!"}
          </h3>
          <p className="text-xs font-black uppercase tracking-wider text-indigo-400">
            {emoji} {continent === 'All' ? 'All Continents' : continent}
          </p>
          <div className="flex justify-center gap-6">
            <div>
              <p className="text-3xl font-black text-indigo-600">{score}</p>
              <p className="text-xs font-bold uppercase text-gray-400">Score</p>
            </div>
            <div>
              <p className="text-3xl font-black text-amber-500">{bestScore}</p>
              <p className="text-xs font-bold uppercase text-gray-400">Best</p>
            </div>
          </div>
          {tier && (
            <div
              className={`inline-flex items-center gap-2 rounded-full border-2 px-4 py-2 ${tier.border} ${tier.bg}`}
            >
              <span className="text-lg">{tier.emoji}</span>
              <span className="text-sm font-black">{tier.name} Award!</span>
            </div>
          )}
          {nextTier && (
            <p className="text-xs font-bold text-indigo-400">
              {nextTier.threshold - score} more for {nextTier.emoji} {nextTier.name}
            </p>
          )}
          <div className="flex flex-col gap-3 pt-1 sm:flex-row">
            <button
              data-testid="wfquiz-retry"
              type="button"
              onClick={restart}
              className="flex items-center justify-center gap-2 rounded-xl border-2 border-black bg-gradient-to-r from-blue-500 to-indigo-500 px-6 py-2.5 font-black text-white shadow-neo-xs transition-transform motion-safe:hover:-translate-y-0.5"
            >
              <RotateCcw size={16} aria-hidden="true" /> Try Again
            </button>
            <button
              data-testid="wfquiz-exit"
              type="button"
              onClick={onExit}
              className="rounded-xl border-2 border-gray-300 bg-white px-6 py-2.5 font-bold text-gray-700 transition-colors hover:bg-gray-50"
            >
              Back to Certificates
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div data-testid="wfquiz-active" className="flex flex-col gap-4">
      {/* Timer + score bar */}
      <div className="flex items-center justify-between rounded-xl border-2 border-black bg-white px-4 py-3 shadow-neo-sm">
        <div className="flex items-center gap-2">
          <Timer
            className={`h-5 w-5 ${timeLeft <= 10 ? 'text-red-500 motion-safe:animate-pulse' : 'text-gray-500'}`}
            aria-hidden="true"
          />
          <span
            data-testid="wfquiz-time"
            className={`text-xl font-black ${timeLeft <= 10 ? 'text-red-500' : 'text-gray-900'}`}
          >
            {timeLeft}s
          </span>
        </div>
        <span className="rounded-full bg-indigo-100 px-3 py-1 text-xs font-black text-indigo-600">
          {emoji} {continent === 'All' ? 'All' : continent}
        </span>
        <div className="flex items-center gap-2">
          <Trophy className="h-5 w-5 text-amber-500" aria-hidden="true" />
          <span data-testid="wfquiz-score" className="text-xl font-black text-gray-900">
            {score}
          </span>
        </div>
        <button
          type="button"
          onClick={onExit}
          className="min-h-[44px] px-2 text-xs font-bold text-gray-400 transition-colors hover:text-gray-600"
        >
          Exit
        </button>
      </div>

      {/* Question */}
      <div
        data-testid="wfquiz-question"
        className="flex flex-col items-center gap-3 rounded-xl border-2 border-black bg-white p-5 text-center shadow-neo-sm"
      >
        {question.type === 'flag-to-name' && (
          <>
            <FlagImage
              country={question.country}
              size="w320"
              className="h-auto w-44 rounded-lg border-2 border-gray-200 shadow-sm"
              emojiClassName="text-7xl"
            />
            <p className="text-sm font-bold text-gray-500">Which country is this?</p>
          </>
        )}
        {question.type === 'name-to-capital' && (
          <>
            <FlagImage
              country={question.country}
              size="w80"
              className="h-auto w-16 rounded border border-gray-200"
              emojiClassName="text-3xl"
            />
            <p className="font-heading text-xl font-black text-gray-900">{question.country.name}</p>
            <p className="text-sm font-bold text-gray-500">What is the capital city?</p>
          </>
        )}
        {question.type === 'funfact-to-name' && (
          <>
            <div className="max-h-28 overflow-y-auto rounded-lg border-2 border-amber-200 bg-amber-50 p-3">
              <p className="text-sm font-bold text-amber-800">
                {redactCountryName(question.country.funFact, question.country.name)}
              </p>
            </div>
            <p className="text-sm font-bold text-gray-500">Which country is this about?</p>
          </>
        )}
      </div>

      {/* Feedback */}
      {selected !== null && (
        <div
          className={`rounded-xl border-2 border-black p-3 text-center shadow-neo-xs ${isCorrect ? 'bg-green-100' : 'bg-red-50'}`}
        >
          <p className="font-black">{feedbackRef.current}</p>
        </div>
      )}

      {/* Answers */}
      <div className="grid grid-cols-2 gap-3">
        {question.choices.map((choice, i) => {
          let btnClass =
            'border-gray-200 bg-white text-gray-900 motion-safe:hover:-translate-y-0.5';
          if (selected !== null) {
            if (choice === question.answer) btnClass = 'border-green-600 bg-green-400 text-white';
            else if (selected === choice && !isCorrect)
              btnClass = 'border-red-600 bg-red-400 text-white';
            else btnClass = 'border-gray-200 bg-gray-100 text-gray-400';
          }
          return (
            <button
              key={i}
              data-testid={`wfquiz-choice-${i}`}
              type="button"
              onClick={() => handleAnswer(choice)}
              disabled={selected !== null}
              className={`min-h-[56px] rounded-xl border-2 px-3 py-4 text-sm font-black shadow-neo-xs transition-transform ${btnClass}`}
            >
              {choice}
            </button>
          );
        })}
      </div>
    </div>
  );
}

// ─── Main certificates view ──────────────────────────────────────────────────

// Exactly one of memberId / kidToken is supplied.
type WorldFlagsCertificatesProps =
  | { memberId: string; kidToken?: undefined }
  | { kidToken: string; memberId?: undefined };

export function WorldFlagsCertificates({ memberId, kidToken }: WorldFlagsCertificatesProps) {
  const slug = useTenantSlug();
  const { session } = useAuth();

  const api = useMemo(() => {
    if (kidToken) return worldFlagsApi({ kidToken });
    if (session) {
      return worldFlagsApi({
        memberId: memberId!,
        parentHeaders: { Authorization: `Bearer ${session.access_token}`, 'x-tenant-slug': slug },
      });
    }
    return null;
  }, [kidToken, memberId, session, slug]);

  const [status, setStatus] = useState<Status>('loading');
  const [explored, setExplored] = useState<Set<string>>(new Set());
  const [showQuiz, setShowQuiz] = useState(false);
  const [quizContinent, setQuizContinent] = useState<string>('All');

  useEffect(() => {
    if (!api) return;
    const ac = new AbortController();
    setStatus('loading');
    fetch(api.exploreUrl(), { headers: api.headers, signal: ac.signal })
      .then(async (res) => {
        if (!res.ok) {
          setStatus('error');
          return;
        }
        const body = (await res.json()) as { explored: string[] };
        setExplored(new Set(body.explored ?? []));
        setStatus('ready');
      })
      .catch((err: unknown) => {
        if (err instanceof Error && err.name === 'AbortError') return;
        setStatus('error');
      });
    return () => ac.abort();
  }, [api]);

  const certs = useMemo<ContinentCert[]>(
    () =>
      CONTINENTS.map((continent) => {
        const total = COUNTRIES.filter((c) => c.continent === continent).length;
        const cnt = COUNTRIES.filter(
          (c) => c.continent === continent && explored.has(c.code),
        ).length;
        return { continent, explored: cnt, total, completed: total > 0 && cnt >= total };
      }),
    [explored],
  );

  const totalCompleted = certs.filter((c) => c.completed).length;
  const allEarned = totalCompleted === certs.length && certs.length > 0;
  const anyComplete = totalCompleted > 0;
  const progressPct = certs.length > 0 ? (totalCompleted / certs.length) * 100 : 0;

  if (status === 'loading') {
    return (
      <p data-testid="wfcert-loading" aria-busy="true" className="text-sm font-bold text-white">
        Loading certificates…
      </p>
    );
  }
  if (status === 'error') {
    return (
      <p data-testid="wfcert-error" role="alert" className="text-sm font-bold text-red-300">
        Couldn&rsquo;t load. Try again.
      </p>
    );
  }

  const userKey = api?.userKey ?? '';

  if (showQuiz) {
    return (
      <div data-testid="wfcert" className="flex flex-col gap-6">
        <WorldExplorerQuiz
          userKey={userKey}
          continent={quizContinent}
          onExit={() => setShowQuiz(false)}
        />
      </div>
    );
  }

  const startQuiz = (continent: string) => {
    setQuizContinent(continent);
    setShowQuiz(true);
  };

  return (
    <div data-testid="wfcert" className="flex flex-col gap-6">
      {/* Progress header */}
      <div className="rounded-xl border-2 border-black bg-white p-5 shadow-neo-sm">
        <div className="mb-3 flex items-center gap-3">
          <span className="text-3xl">🌍</span>
          <div className="flex-1">
            <h3 className="font-heading text-lg font-black text-gray-900">Explorer Certificates</h3>
            <p className="text-sm font-bold text-gray-500">
              {totalCompleted} of {certs.length} continents explored
            </p>
          </div>
          <div className="rounded-xl border-2 border-black bg-gradient-to-r from-blue-400 to-indigo-500 px-3 py-1.5 shadow-neo-xs">
            <p className="text-sm font-black text-white">{Math.round(progressPct)}%</p>
          </div>
        </div>
        <div
          data-testid="wfcert-progress-bar"
          role="progressbar"
          aria-valuenow={Math.round(progressPct)}
          aria-valuemin={0}
          aria-valuemax={100}
          className="h-4 w-full overflow-hidden rounded-full border-2 border-black bg-gray-200"
        >
          <div
            className="h-full rounded-full bg-gradient-to-r from-blue-400 via-indigo-400 to-blue-500 transition-all duration-700"
            style={{ width: `${progressPct}%` }}
          />
        </div>

        {allEarned && (
          <div className="mt-4 flex flex-col items-center gap-3 rounded-xl border-2 border-indigo-200 bg-indigo-50 p-4 text-center">
            <p className="font-heading text-lg font-black text-indigo-700">
              🌍 You&rsquo;re a World Explorer! 🌍
            </p>
            <p className="text-sm font-bold text-indigo-500">
              All {certs.length} certificates earned! Take the ultimate all-continents quiz!
            </p>
            <div
              data-testid="wfquiz-continent-selector"
              className="flex flex-wrap justify-center gap-2"
            >
              {(['All', ...CONTINENTS] as const).map((c) => {
                const isSelected = quizContinent === c;
                const grad = c === 'All' ? 'from-blue-500 to-indigo-500' : CONTINENT_GRADIENT[c];
                return (
                  <button
                    key={c}
                    data-testid={`wfquiz-continent-${continentId(c)}`}
                    type="button"
                    onClick={() => setQuizContinent(c)}
                    className={`flex min-h-[44px] items-center gap-1 rounded-full border-2 px-3 py-1.5 text-xs font-black transition-all ${
                      isSelected
                        ? `border-black bg-gradient-to-r ${grad} text-white shadow-neo-xs`
                        : 'border-gray-200 bg-white text-gray-400 hover:border-gray-400'
                    }`}
                  >
                    <span aria-hidden="true">{CONTINENT_EMOJI[c]}</span> {c}
                  </button>
                );
              })}
            </div>
            <button
              data-testid="wfquiz-start"
              type="button"
              onClick={() => setShowQuiz(true)}
              className="flex items-center justify-center gap-2 rounded-xl border-2 border-black bg-gradient-to-r from-blue-500 to-indigo-500 px-6 py-3 font-black text-white shadow-neo-sm transition-transform motion-safe:hover:-translate-y-0.5"
            >
              <Timer size={18} aria-hidden="true" /> Flag Quiz (60s)
            </button>
          </div>
        )}
      </div>

      {/* Certificate cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        {certs.map((cert) => {
          const emoji = CONTINENT_EMOJI[cert.continent] ?? '🌍';
          const grad = CONTINENT_GRADIENT[cert.continent] ?? 'from-gray-500 to-gray-600';
          const best = readBestScore(bestScoreKey(userKey, cert.continent));
          const tier = getQuizTier(best);

          if (cert.completed) {
            return (
              <div
                key={cert.continent}
                data-testid={`wfcert-card-${continentId(cert.continent)}`}
                className="rounded-xl border-2 border-yellow-500 bg-yellow-50 p-4 shadow-neo-xs"
              >
                <div className="flex items-center gap-3">
                  <div
                    className={`flex h-12 w-12 items-center justify-center rounded-xl border-2 border-black bg-gradient-to-br ${grad} text-xl shadow-neo-xs`}
                  >
                    <span aria-hidden="true">{emoji}</span>
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-black text-gray-900">{cert.continent}</p>
                    <p className="text-xs font-bold text-amber-600">Explorer Certificate</p>
                    <p className="text-[10px] font-bold text-gray-400">
                      {cert.explored}/{cert.total} flags
                    </p>
                  </div>
                  <Trophy className="h-6 w-6 text-yellow-600" aria-label="Certificate earned" />
                </div>
                <button
                  data-testid={`wfcert-quiz-${continentId(cert.continent)}`}
                  type="button"
                  onClick={() => startQuiz(cert.continent)}
                  className="mt-3 flex min-h-[44px] w-full items-center justify-between rounded-lg border-2 border-indigo-200 bg-indigo-50 px-3 py-2 transition-colors hover:border-indigo-400"
                >
                  <span className="flex items-center gap-2 text-xs font-black text-indigo-600">
                    <Timer size={14} aria-hidden="true" /> {cert.continent} Quiz
                  </span>
                  {best > 0 && (
                    <span className="text-[10px] font-bold text-indigo-400">
                      Best: {best} {tier?.emoji ?? ''}
                    </span>
                  )}
                </button>
              </div>
            );
          }

          const inProgress = cert.explored > 0;
          const pct = cert.total > 0 ? (cert.explored / cert.total) * 100 : 0;
          return (
            <div
              key={cert.continent}
              data-testid={`wfcert-card-${continentId(cert.continent)}`}
              className={`rounded-xl border-2 border-dashed border-gray-300 bg-gray-50 p-4 ${inProgress ? 'opacity-80' : 'opacity-60'}`}
            >
              <div className="flex items-center gap-3">
                <div className="flex h-12 w-12 items-center justify-center rounded-xl border-2 border-gray-300 bg-gray-200">
                  {inProgress ? (
                    <span className="text-xl" aria-hidden="true">
                      {emoji}
                    </span>
                  ) : (
                    <Lock className="h-5 w-5 text-gray-400" aria-hidden="true" />
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-black text-gray-500">{cert.continent}</p>
                  <p className="text-xs font-bold text-gray-400">Explorer Certificate</p>
                  <p className="text-[10px] font-bold text-gray-400">
                    {inProgress
                      ? `${cert.explored}/${cert.total} explored · ${cert.total - cert.explored} to go`
                      : `${cert.total} flags to explore`}
                  </p>
                </div>
              </div>
              {inProgress && (
                <div className="mt-2 h-2 w-full overflow-hidden rounded-full border border-gray-300 bg-gray-200">
                  <div
                    className={`h-full rounded-full bg-gradient-to-r ${grad}`}
                    style={{ width: `${pct}%` }}
                  />
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Quiz awards */}
      {anyComplete && (
        <div className="flex flex-col gap-3">
          <div className="flex items-center gap-2">
            <Award className="h-4 w-4 text-yellow-400" aria-hidden="true" />
            <h4 className="font-heading text-sm font-black uppercase tracking-wider text-white">
              Quiz Awards
            </h4>
          </div>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {([...CONTINENTS, 'All'] as const).map((c) => {
              const isAll = c === 'All';
              const unlocked = isAll
                ? allEarned
                : certs.some((x) => x.continent === c && x.completed);
              const best = readBestScore(bestScoreKey(userKey, c));
              const tier = getQuizTier(best);
              const nextTier = getNextQuizTier(best);
              const label = isAll ? 'All Continents' : c;
              const emoji = CONTINENT_EMOJI[c] ?? '🌍';

              if (!unlocked) {
                return (
                  <div
                    key={c}
                    data-testid={`wfaward-${continentId(c)}`}
                    className="rounded-xl border-2 border-dashed border-gray-300 bg-gray-50 p-3 text-center opacity-60"
                  >
                    <Lock className="mx-auto mb-1 h-5 w-5 text-gray-400" aria-hidden="true" />
                    <p className="text-[10px] font-black text-gray-500">{label}</p>
                    <p className="text-[10px] font-bold text-gray-400">Complete to unlock</p>
                  </div>
                );
              }
              return (
                <div
                  key={c}
                  data-testid={`wfaward-${continentId(c)}`}
                  className={`rounded-xl border-2 ${tier ? tier.border : 'border-gray-200'} bg-white p-3 text-center shadow-neo-xs`}
                >
                  <div className="text-2xl">{tier ? tier.emoji : emoji}</div>
                  <p className="text-[10px] font-black text-gray-800">{label}</p>
                  {best > 0 ? (
                    <>
                      <p className="text-lg font-black text-indigo-600">{best}</p>
                      <p className="text-[10px] font-bold text-gray-400">
                        {tier?.name ?? 'No tier yet'}
                      </p>
                      {nextTier ? (
                        <p className="text-[10px] font-bold text-indigo-400">
                          {nextTier.threshold - best} more for {nextTier.emoji}
                        </p>
                      ) : (
                        tier && <p className="text-[10px] font-bold text-amber-500">Max tier!</p>
                      )}
                    </>
                  ) : (
                    <p className="text-[10px] font-bold text-gray-400">Not attempted</p>
                  )}
                  <div className="mt-2 flex justify-center gap-1">
                    {[...QUIZ_TIERS].reverse().map((t) => (
                      <span
                        key={t.name}
                        className={`text-xs ${best >= t.threshold ? '' : 'opacity-20 grayscale'}`}
                      >
                        {t.emoji}
                      </span>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
