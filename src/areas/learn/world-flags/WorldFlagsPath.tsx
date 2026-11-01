import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ArrowLeft,
  ArrowRight,
  Lock,
  Check,
  BookOpen,
  MapPin,
  Coins,
  Sparkles,
  Zap,
} from 'lucide-react';
import { useAuth } from '../../../app/lib/auth-context';
import { useTenantSlug } from '../../../app/lib/tenant-context';
import { CONTINENTS, getCountriesByContinent, type Country } from './countries';
import { FlagImage } from './FlagImage';
import {
  CONTINENT_GRADIENT,
  CONTINENT_EMOJI,
  continentId,
  getChunksForContinent,
  generateLearnQuiz,
  CHUNK_SIZE,
  type LearnQuizQuestion,
} from './shared';
import { worldFlagsApi } from './worldFlagsApi';

// World Flags: Learn path sub-tab.
//
// Pick a continent → numbered sets of 5 countries. Study each set (flag +
// capital + currency + fun fact), then take its quiz. 100% correct marks the
// set complete (POST /learn-complete or /api/kid/world-flags/learn-complete)
// and unlocks the next. Completed sets per continent load from GET /learn.

type Phase = 'select' | 'study' | 'quiz' | 'results';
type Status = 'loading' | 'ready' | 'error';

// Exactly one of memberId / kidToken is supplied.
type WorldFlagsPathProps =
  | { memberId: string; kidToken?: undefined }
  | { kidToken: string; memberId?: undefined };

export function WorldFlagsPath({ memberId, kidToken }: WorldFlagsPathProps) {
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
  const [phase, setPhase] = useState<Phase>('select');
  const [selectedContinent, setSelectedContinent] = useState<string | null>(null);
  const [currentChunkIndex, setCurrentChunkIndex] = useState(0);
  const [studyIndex, setStudyIndex] = useState(0);
  const [quizQuestions, setQuizQuestions] = useState<LearnQuizQuestion[]>([]);
  const [quizIndex, setQuizIndex] = useState(0);
  const [quizCorrectCount, setQuizCorrectCount] = useState(0);
  const [quizSelected, setQuizSelected] = useState<string | null>(null);
  const [quizFeedback, setQuizFeedback] = useState<'correct' | 'wrong' | null>(null);
  const [quizResults, setQuizResults] = useState<
    { country: Country; userAnswer: string; correct: boolean }[]
  >([]);
  const [allProgress, setAllProgress] = useState<Record<string, number[]>>({});
  const advanceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Load completed sets per continent.
  useEffect(() => {
    if (!api) return;
    const ac = new AbortController();
    setStatus('loading');
    fetch(api.learnUrl(), { headers: api.headers, signal: ac.signal })
      .then(async (res) => {
        if (!res.ok) {
          setStatus('error');
          return;
        }
        const body = (await res.json()) as { progress: Record<string, number[]> };
        setAllProgress(body.progress ?? {});
        setStatus('ready');
      })
      .catch((err: unknown) => {
        if (err instanceof Error && err.name === 'AbortError') return;
        setStatus('error');
      });
    return () => ac.abort();
  }, [api]);

  useEffect(
    () => () => {
      if (advanceTimer.current) clearTimeout(advanceTimer.current);
    },
    [],
  );

  const chunks = useMemo(
    () => (selectedContinent ? getChunksForContinent(selectedContinent) : []),
    [selectedContinent],
  );
  const continentCountries = useMemo(
    () => (selectedContinent ? getCountriesByContinent(selectedContinent) : []),
    [selectedContinent],
  );
  const currentChunk = useMemo(() => chunks[currentChunkIndex] ?? [], [chunks, currentChunkIndex]);
  const completedChunks = selectedContinent ? (allProgress[selectedContinent] ?? []) : [];
  const gradient = selectedContinent
    ? (CONTINENT_GRADIENT[selectedContinent] ?? 'from-gray-500 to-gray-600')
    : '';

  const isChunkUnlocked = (index: number) => index === 0 || completedChunks.includes(index - 1);
  const isChunkCompleted = (index: number) => completedChunks.includes(index);

  const startStudy = useCallback((chunkIdx: number) => {
    setCurrentChunkIndex(chunkIdx);
    setStudyIndex(0);
    setPhase('study');
  }, []);

  // Leaving the quiz/study mid-flow must cancel any pending answer-advance
  // timer, else it fires later and yanks the child back to the results screen.
  const exitToSelect = useCallback(() => {
    if (advanceTimer.current) clearTimeout(advanceTimer.current);
    setPhase('select');
  }, []);

  const startQuiz = useCallback(() => {
    setQuizQuestions(generateLearnQuiz(currentChunk, continentCountries));
    setQuizIndex(0);
    setQuizCorrectCount(0);
    setQuizSelected(null);
    setQuizFeedback(null);
    setQuizResults([]);
    setPhase('quiz');
  }, [currentChunk, continentCountries]);

  const handleQuizAnswer = useCallback(
    (choice: string) => {
      if (quizSelected !== null) return;
      const question = quizQuestions[quizIndex];
      if (!question) return;
      const correct = choice === question.answer;

      setQuizSelected(choice);
      setQuizFeedback(correct ? 'correct' : 'wrong');
      setQuizResults((prev) => [
        ...prev,
        { country: question.country, userAnswer: choice, correct },
      ]);
      const newCorrectCount = correct ? quizCorrectCount + 1 : quizCorrectCount;
      if (correct) setQuizCorrectCount((c) => c + 1);

      const isLast = quizIndex + 1 >= quizQuestions.length;
      advanceTimer.current = setTimeout(
        () => {
          if (isLast) {
            const passed = newCorrectCount === quizQuestions.length;
            if (passed && selectedContinent) {
              if (api) {
                void fetch(api.learnCompleteUrl(), {
                  method: 'POST',
                  headers: { ...api.headers, 'Content-Type': 'application/json' },
                  body: JSON.stringify(api.learnCompleteBody(selectedContinent, currentChunkIndex)),
                }).catch(() => {
                  /* ignore: progress reconciles on next load */
                });
              }
              setAllProgress((prev) => {
                const existing = prev[selectedContinent] ?? [];
                if (existing.includes(currentChunkIndex)) return prev;
                return { ...prev, [selectedContinent]: [...existing, currentChunkIndex] };
              });
            }
            setPhase('results');
          } else {
            setQuizIndex((i) => i + 1);
            setQuizSelected(null);
            setQuizFeedback(null);
          }
        },
        correct ? 500 : 1000,
      );
    },
    [
      quizSelected,
      quizQuestions,
      quizIndex,
      quizCorrectCount,
      selectedContinent,
      api,
      currentChunkIndex,
    ],
  );

  const passed = quizQuestions.length > 0 && quizCorrectCount === quizQuestions.length;

  // ── Status guards ──────────────────────────────────────────────────────────

  if (status === 'loading') {
    return (
      <p data-testid="wfpath-loading" aria-busy="true" className="text-sm font-bold text-white">
        Loading your learning path…
      </p>
    );
  }
  if (status === 'error') {
    return (
      <p data-testid="wfpath-error" role="alert" className="text-sm font-bold text-red-300">
        Couldn&rsquo;t load. Try again.
      </p>
    );
  }

  // ── Select phase ───────────────────────────────────────────────────────────

  if (phase === 'select') {
    return (
      <div data-testid="wfpath" className="flex flex-col gap-4">
        {/* Continent picker */}
        <div className="flex gap-2 overflow-x-auto pb-1" role="group" aria-label="Pick a continent">
          {CONTINENTS.map((cont) => {
            const isActive = selectedContinent === cont;
            return (
              <button
                key={cont}
                data-testid={`wfpath-continent-${continentId(cont)}`}
                type="button"
                onClick={() => {
                  setSelectedContinent(cont);
                  setCurrentChunkIndex(0);
                }}
                className={`min-h-[44px] shrink-0 rounded-xl border-2 border-black px-3 py-2 text-xs font-black whitespace-nowrap transition-transform motion-safe:hover:-translate-y-0.5 ${
                  isActive
                    ? `bg-gradient-to-r ${CONTINENT_GRADIENT[cont]} text-white shadow-neo-xs`
                    : 'bg-white text-gray-600'
                }`}
              >
                <span aria-hidden="true">{CONTINENT_EMOJI[cont]}</span> {cont}
              </button>
            );
          })}
        </div>

        {selectedContinent && chunks.length > 0 ? (
          <>
            {/* Sets-completed progress */}
            <div
              data-testid="wfpath-progress"
              className="rounded-xl border-2 border-black bg-white p-4 shadow-neo-xs"
            >
              <div className="mb-2 flex items-center justify-between text-xs font-bold">
                <span className="flex items-center gap-1">
                  <BookOpen size={14} aria-hidden="true" /> Sets completed
                </span>
                <span>
                  {completedChunks.length} / {chunks.length}
                </span>
              </div>
              <div className="h-3 w-full overflow-hidden rounded-full border-2 border-black bg-gray-100">
                <div
                  className={`h-full rounded-full bg-gradient-to-r ${gradient} transition-all duration-500`}
                  style={{ width: `${(completedChunks.length / chunks.length) * 100}%` }}
                />
              </div>
            </div>

            {/* Set grid */}
            <div className="rounded-xl border-2 border-black bg-white p-4 shadow-neo-xs">
              <p className="mb-3 text-xs font-black uppercase tracking-wider text-gray-400">
                Choose a set to learn ({CHUNK_SIZE} countries each)
              </p>
              <div className="grid grid-cols-4 gap-2 sm:grid-cols-6">
                {chunks.map((chunk, idx) => {
                  const completed = isChunkCompleted(idx);
                  const unlocked = isChunkUnlocked(idx);
                  return (
                    <button
                      key={idx}
                      data-testid={`wfpath-set-${idx}`}
                      type="button"
                      onClick={() => unlocked && startStudy(idx)}
                      disabled={!unlocked}
                      aria-label={`Set ${idx + 1}${completed ? ' (completed)' : unlocked ? '' : ' (locked)'}`}
                      className={`flex aspect-square w-full flex-col items-center justify-center gap-0.5 rounded-xl border-2 text-sm font-black transition-transform ${
                        completed
                          ? `border-black bg-gradient-to-r ${gradient} text-white shadow-neo-xs`
                          : unlocked
                            ? 'border-black bg-white text-gray-900 shadow-neo-xs motion-safe:hover:-translate-y-0.5'
                            : 'cursor-not-allowed border-dashed border-gray-300 bg-gray-100 text-gray-300'
                      }`}
                    >
                      {completed ? (
                        <Check size={16} aria-hidden="true" />
                      ) : unlocked ? (
                        <span className="text-lg">{idx + 1}</span>
                      ) : (
                        <Lock size={14} aria-hidden="true" />
                      )}
                      <span className="text-[8px] font-bold">{chunk.length} flags</span>
                    </button>
                  );
                })}
              </div>
            </div>

            {completedChunks.length === chunks.length && (
              <div className="rounded-xl border-2 border-amber-300 bg-amber-50 p-4 text-center shadow-neo-xs">
                <p className="text-2xl">🏆</p>
                <p className="font-heading text-sm font-black text-amber-700">
                  {selectedContinent} Complete!
                </p>
                <p className="text-xs font-bold text-amber-500">
                  You&rsquo;ve learned all the flags!
                </p>
              </div>
            )}
          </>
        ) : (
          <div className="rounded-xl border-2 border-black bg-white p-8 text-center shadow-neo-xs">
            <p className="text-4xl">📚</p>
            <p className="mt-2 font-heading text-lg font-black">Pick a Continent</p>
            <p className="text-sm text-gray-500">Choose a continent to start learning its flags!</p>
          </div>
        )}
      </div>
    );
  }

  // ── Study phase ────────────────────────────────────────────────────────────

  if (phase === 'study') {
    const country = currentChunk[studyIndex];
    if (!country) return null;
    const isLast = studyIndex === currentChunk.length - 1;
    const isFirst = studyIndex === 0;

    return (
      <div data-testid="wfpath-study" className="flex flex-col gap-4">
        <div className="flex items-center justify-between">
          <button
            data-testid="wfpath-study-back"
            type="button"
            onClick={exitToSelect}
            className="flex min-h-[44px] items-center gap-1 py-2 text-sm font-bold text-white/80 transition-colors hover:text-white"
          >
            <ArrowLeft size={16} aria-hidden="true" /> Back
          </button>
          <p className="text-xs font-black text-white/80">
            Set {currentChunkIndex + 1}: {selectedContinent}
          </p>
        </div>

        {/* Step dots */}
        <div className="flex justify-center gap-2">
          {currentChunk.map((_, i) => (
            <div
              key={i}
              className={`h-3 w-3 rounded-full border-2 transition-all ${
                i === studyIndex
                  ? 'scale-125 border-white bg-white shadow-lg'
                  : i < studyIndex
                    ? 'border-white/40 bg-white/60'
                    : 'border-white/20 bg-white/20'
              }`}
            />
          ))}
        </div>

        {/* Country card */}
        <div className="overflow-hidden rounded-xl border-2 border-black bg-white shadow-neo-sm">
          <div
            className={`flex items-center justify-center border-b-2 border-black bg-gradient-to-br ${gradient} p-8`}
          >
            <FlagImage
              country={country}
              size="w320"
              className="h-auto w-44 rounded-lg border-2 border-white/40 shadow-md sm:w-56"
              emojiClassName="text-8xl leading-none"
            />
          </div>
          <div className="flex flex-col gap-3 p-5">
            <h3
              data-testid="wfpath-study-name"
              className="text-center font-heading text-2xl font-black text-gray-900"
            >
              {country.name}
            </h3>
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              <div className="flex items-center gap-2 rounded-lg border-2 border-blue-200 bg-blue-50 px-3 py-2">
                <MapPin className="h-4 w-4 shrink-0 text-blue-500" aria-hidden="true" />
                <div className="min-w-0">
                  <p className="text-[9px] font-bold uppercase text-blue-400">Capital</p>
                  <p className="truncate text-sm font-black text-gray-900">{country.capital}</p>
                </div>
              </div>
              <div className="flex items-center gap-2 rounded-lg border-2 border-green-200 bg-green-50 px-3 py-2">
                <Coins className="h-4 w-4 shrink-0 text-green-500" aria-hidden="true" />
                <div className="min-w-0">
                  <p className="text-[9px] font-bold uppercase text-green-400">Currency</p>
                  <p className="truncate text-sm font-black text-gray-900">
                    {country.currencySymbol} {country.currency}
                  </p>
                </div>
              </div>
            </div>
            <div className="flex items-start gap-2 rounded-lg border-2 border-amber-200 bg-amber-50 px-3 py-2">
              <Sparkles className="mt-0.5 h-4 w-4 shrink-0 text-amber-500" aria-hidden="true" />
              <p className="text-xs font-bold leading-snug text-gray-800">{country.funFact}</p>
            </div>
          </div>
        </div>

        {/* Nav */}
        <div className="flex gap-3">
          <button
            data-testid="wfpath-study-prev"
            type="button"
            onClick={() => setStudyIndex((i) => i - 1)}
            disabled={isFirst}
            className={`flex flex-1 items-center justify-center gap-2 rounded-xl border-2 py-3 text-sm font-black transition-transform ${
              isFirst
                ? 'cursor-not-allowed border-gray-200 bg-gray-100 text-gray-300'
                : 'border-black bg-white text-gray-900 shadow-neo-sm motion-safe:hover:-translate-y-0.5'
            }`}
          >
            <ArrowLeft size={16} aria-hidden="true" /> Previous
          </button>
          <button
            data-testid="wfpath-study-next"
            type="button"
            onClick={() => (isLast ? startQuiz() : setStudyIndex((i) => i + 1))}
            className={`flex flex-1 items-center justify-center gap-2 rounded-xl border-2 border-black py-3 text-sm font-black text-white shadow-neo-sm transition-transform motion-safe:hover:-translate-y-0.5 ${
              isLast ? 'bg-gradient-to-r from-emerald-500 to-teal-500' : 'bg-black'
            }`}
          >
            {isLast ? (
              <>
                <Zap size={16} aria-hidden="true" /> Start Quiz!
              </>
            ) : (
              <>
                Next <ArrowRight size={16} aria-hidden="true" />
              </>
            )}
          </button>
        </div>
      </div>
    );
  }

  // ── Quiz phase ─────────────────────────────────────────────────────────────

  if (phase === 'quiz') {
    const question = quizQuestions[quizIndex];
    if (!question) return null;

    return (
      <div data-testid="wfpath-quiz" className="flex flex-col gap-4">
        <div className="flex items-center justify-between">
          <button
            type="button"
            onClick={exitToSelect}
            className="flex min-h-[44px] items-center gap-1 py-2 text-sm font-bold text-white/80 transition-colors hover:text-white"
          >
            <ArrowLeft size={16} aria-hidden="true" /> Exit
          </button>
          <p data-testid="wfpath-quiz-progress" className="text-xs font-black text-white/80">
            Question {quizIndex + 1} of {quizQuestions.length}
          </p>
        </div>

        <div className="flex justify-center gap-2">
          {quizQuestions.map((_, i) => {
            const result = quizResults[i];
            return (
              <div
                key={i}
                className={`h-3 w-3 rounded-full border-2 transition-all ${
                  i === quizIndex
                    ? 'scale-125 border-white bg-white shadow-lg'
                    : result
                      ? result.correct
                        ? 'border-green-500 bg-green-400'
                        : 'border-red-500 bg-red-400'
                      : 'border-white/20 bg-white/20'
                }`}
              />
            );
          })}
        </div>

        <div className="overflow-hidden rounded-xl border-2 border-black bg-white shadow-neo-sm">
          <div
            className={`flex items-center justify-center border-b-2 border-black bg-gradient-to-br ${gradient} p-8`}
          >
            <FlagImage
              country={question.country}
              size="w320"
              className="h-auto w-44 rounded-lg border-2 border-white/40 shadow-md sm:w-56"
              emojiClassName="text-8xl leading-none"
            />
          </div>
          <p className="p-4 text-center font-heading text-base font-black text-gray-900">
            Which country is this?
          </p>
        </div>

        <div className="flex flex-col gap-2">
          {question.choices.map((choice, i) => {
            let btnClass =
              'border-gray-200 bg-white text-gray-900 motion-safe:hover:-translate-y-0.5';
            if (quizSelected !== null) {
              if (choice === question.answer) btnClass = 'border-green-600 bg-green-400 text-white';
              else if (quizSelected === choice && quizFeedback === 'wrong')
                btnClass = 'border-red-600 bg-red-400 text-white';
              else btnClass = 'border-gray-200 bg-gray-100 text-gray-400';
            }
            return (
              <button
                key={i}
                data-testid={`wfpath-quiz-choice-${i}`}
                type="button"
                onClick={() => handleQuizAnswer(choice)}
                disabled={quizSelected !== null}
                className={`min-h-[48px] rounded-xl border-2 px-4 py-3 text-sm font-black shadow-neo-xs transition-transform ${btnClass}`}
              >
                {choice}
              </button>
            );
          })}
        </div>

        {quizFeedback && (
          <p
            className={`text-center font-black ${quizFeedback === 'correct' ? 'text-green-400' : 'text-red-400'}`}
          >
            {quizFeedback === 'correct' ? '✓ Correct!' : `✗ It was ${question.answer}`}
          </p>
        )}
      </div>
    );
  }

  // ── Results phase ──────────────────────────────────────────────────────────

  const hasNextChunk = currentChunkIndex + 1 < chunks.length;
  const wrong = quizResults.filter((r) => !r.correct);

  return (
    <div data-testid="wfpath-results" className="flex flex-col gap-4">
      <div className="flex flex-col items-center gap-4 rounded-xl border-2 border-black bg-white p-6 text-center shadow-neo-sm">
        <div className="text-5xl">{passed ? '🎉' : '💪'}</div>
        <h3 className="font-heading text-xl font-black text-gray-800">
          {passed ? 'Amazing! All Correct!' : 'Keep Going!'}
        </h3>

        <div
          className={`w-full max-w-xs rounded-xl border-2 p-4 ${passed ? 'border-green-200 bg-green-50' : 'border-amber-200 bg-amber-50'}`}
        >
          <p className={`text-3xl font-black ${passed ? 'text-green-700' : 'text-amber-700'}`}>
            {quizCorrectCount}/{quizQuestions.length}
          </p>
          <p className={`mt-1 text-sm font-bold ${passed ? 'text-green-500' : 'text-amber-500'}`}>
            {passed
              ? `You mastered Set ${currentChunkIndex + 1}!`
              : `You need all ${quizQuestions.length} correct to continue.`}
          </p>
        </div>

        {!passed && wrong.length > 0 && (
          <div className="flex w-full max-w-xs flex-col gap-2">
            <p className="text-xs font-black uppercase tracking-wider text-gray-400">Review:</p>
            {wrong.map((r, i) => (
              <div
                key={i}
                className="flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2"
              >
                <FlagImage
                  country={r.country}
                  size="w40"
                  className="h-auto w-8 rounded border border-gray-200"
                  emojiClassName="text-xl"
                />
                <div className="min-w-0 text-left">
                  <p className="text-xs font-black text-gray-900">{r.country.name}</p>
                  <p className="text-[10px] font-bold text-red-400">You said: {r.userAnswer}</p>
                </div>
              </div>
            ))}
          </div>
        )}

        {passed && (
          <div className="flex flex-wrap justify-center gap-2 pt-1">
            {currentChunk.map((c) => (
              <FlagImage
                key={c.code}
                country={c}
                size="w80"
                className="h-auto w-12 rounded border-2 border-black shadow-neo-xs"
                emojiClassName="text-2xl"
              />
            ))}
          </div>
        )}

        <div className="flex w-full max-w-xs flex-col gap-3 pt-1">
          {passed ? (
            hasNextChunk ? (
              <button
                data-testid="wfpath-continue"
                type="button"
                onClick={() => startStudy(currentChunkIndex + 1)}
                className={`rounded-xl border-2 border-black bg-gradient-to-r ${gradient} px-6 py-3 font-black text-white shadow-neo-xs transition-transform motion-safe:hover:-translate-y-0.5`}
              >
                ✨ Continue to Set {currentChunkIndex + 2} →
              </button>
            ) : (
              <button
                data-testid="wfpath-continue"
                type="button"
                onClick={exitToSelect}
                className="rounded-xl border-2 border-black bg-gradient-to-r from-amber-400 to-yellow-500 px-6 py-3 font-black text-black shadow-neo-xs transition-transform motion-safe:hover:-translate-y-0.5"
              >
                🏆 Continent Complete!
              </button>
            )
          ) : (
            <>
              <button
                data-testid="wfpath-study-again"
                type="button"
                onClick={() => {
                  setStudyIndex(0);
                  setPhase('study');
                }}
                className={`rounded-xl border-2 border-black bg-gradient-to-r ${gradient} px-6 py-3 font-black text-white shadow-neo-xs transition-transform motion-safe:hover:-translate-y-0.5`}
              >
                📚 Study Again
              </button>
              <button
                data-testid="wfpath-retry"
                type="button"
                onClick={startQuiz}
                className="rounded-xl border-2 border-black bg-white px-6 py-3 font-black text-gray-700 shadow-neo-xs transition-transform motion-safe:hover:-translate-y-0.5"
              >
                ⚡ Try Quiz Again
              </button>
            </>
          )}
          <button
            data-testid="wfpath-back"
            type="button"
            onClick={exitToSelect}
            className="min-h-[44px] rounded-xl border-2 border-gray-200 px-4 py-2.5 text-sm font-bold text-gray-500 transition-colors hover:bg-gray-50"
          >
            Back to Sets
          </button>
        </div>
      </div>
    </div>
  );
}
