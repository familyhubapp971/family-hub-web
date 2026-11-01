// FHS-394: Maths Prove Challenge.
// 60-second timed sprint: unlimited questions via generateTableProblem,
// 4-option MC, tracks score + per-answer time.
//
// Pass = score >= 10 && avgTime <= 5 seconds.
// onComplete(score, avgTime) fires EXACTLY ONCE when the timer hits 0
// (useEffect + hasCompletedRef guard). The parent (MathsSubject) owns
// the celebration screen (MathsStageComplete): this component never
// renders its own post-challenge UI.
//
// Double-tap guard on answers: `selected !== null` and `finished` checks.

import { useState, useEffect, useRef, useCallback } from 'react';
import { Timer, Trophy } from 'lucide-react';
import {
  type Operation,
  type TableNumber,
  OPERATION_SYMBOLS,
  generateTableProblem,
  getTableLabel,
} from './maths-utils';

// ─── Props ────────────────────────────────────────────────────────────────────

interface MathsProveChallengeProps {
  operation: Operation;
  tableNumber: TableNumber;
  // FHS-401: totalAnswered added so parent can pass it to the PUT for accuracy tracking.
  onComplete: (score: number, avgTime: number, totalAnswered: number) => void;
  onBack: () => void;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const CHALLENGE_DURATION = 60;
const PASS_SCORE = 10;
const PASS_AVG_TIME = 5;

// ─── Main Component ───────────────────────────────────────────────────────────

export function MathsProveChallenge({
  operation,
  tableNumber,
  onComplete,
  onBack,
}: MathsProveChallengeProps) {
  const [started, setStarted] = useState(false);
  const [timeLeft, setTimeLeft] = useState(CHALLENGE_DURATION);
  const [score, setScore] = useState(0);
  const [problem, setProblem] = useState(() => generateTableProblem(operation, tableNumber));
  const [selected, setSelected] = useState<number | null>(null);
  const [isCorrect, setIsCorrect] = useState<boolean | null>(null);
  const [finished, setFinished] = useState(false);
  // Capture final values in state so the completion effect deps are honest.
  const [finalScore, setFinalScore] = useState(0);
  const [finalAvgTime, setFinalAvgTime] = useState(999);

  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  // Guard: onComplete fires exactly once.
  const hasCompletedRef = useRef(false);
  // Refs to track accumulated time stats without stale closure reads in the interval.
  const totalAnsweredRef = useRef(0);
  const totalTimeRef = useRef(0);
  const scoreRef = useRef(0);
  const questionStartTimeRef = useRef(0);

  const operationSymbol = OPERATION_SYMBOLS[operation];
  const tableLabel = getTableLabel(operation, tableNumber);

  const nextProblem = useCallback(() => {
    setProblem(generateTableProblem(operation, tableNumber));
    setSelected(null);
    setIsCorrect(null);
    questionStartTimeRef.current = Date.now();
  }, [operation, tableNumber]);

  const startChallenge = () => {
    setStarted(true);
    questionStartTimeRef.current = Date.now();
    timerRef.current = setInterval(() => {
      setTimeLeft((t) => {
        if (t <= 1) {
          if (timerRef.current) clearInterval(timerRef.current);
          // Compute final result from refs (always current, no stale closure).
          const answered = totalAnsweredRef.current;
          const avgTime = answered > 0 ? totalTimeRef.current / answered / 1000 : 999;
          setFinalScore(scoreRef.current);
          setFinalAvgTime(avgTime);
          setFinished(true);
          return 0;
        }
        return t - 1;
      });
    }, 1000);
  };

  // Cleanup on unmount.
  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, []);

  // Fire onComplete exactly once when the timer hits 0.
  // finalScore and finalAvgTime are set synchronously before finished=true.
  // FHS-401: also pass totalAnswered so the parent can accumulate attempt counts.
  useEffect(() => {
    if (!finished || hasCompletedRef.current) return;
    hasCompletedRef.current = true;
    onComplete(finalScore, finalAvgTime, totalAnsweredRef.current);
  }, [finished, finalScore, finalAvgTime, onComplete]);

  const handleAnswer = (choice: number) => {
    if (selected !== null || finished) return;
    const elapsed = Date.now() - questionStartTimeRef.current;
    setSelected(choice);
    totalAnsweredRef.current += 1;
    totalTimeRef.current += elapsed;

    if (choice === problem.answer) {
      setIsCorrect(true);
      scoreRef.current += 1;
      setScore(scoreRef.current);
      setTimeout(nextProblem, 400);
    } else {
      setIsCorrect(false);
      setTimeout(nextProblem, 800);
    }
  };

  // ── Setup screen ──────────────────────────────────────────────────────────

  if (!started) {
    return (
      <div data-testid="prove-challenge-setup" className="space-y-4">
        <div className="bg-white border-2 sm:border-[3px] border-black rounded-2xl p-5 sm:p-6 shadow-neo text-center space-y-4">
          <div className="text-4xl" aria-hidden="true">
            ⚡
          </div>
          <h3 className="font-black text-lg text-gray-800">Prove: {tableLabel}</h3>
          <p className="text-sm text-gray-500 font-medium max-w-xs mx-auto">
            Answer {PASS_SCORE}+ questions in 60 seconds with an average of {PASS_AVG_TIME}s or less
            per answer!
          </p>
          <div className="flex gap-3 justify-center">
            <button
              data-testid="prove-start"
              type="button"
              onClick={startChallenge}
              className="min-h-[44px] bg-gradient-to-r from-purple-500 to-pink-500 text-white font-black px-6 py-3 rounded-xl border-2 border-black shadow-neo-xs motion-safe:hover:-translate-y-0.5 active:translate-y-0.5 transition-all"
            >
              ⚡ Start!
            </button>
            <button
              type="button"
              onClick={onBack}
              className="min-h-[44px] bg-white text-gray-600 font-bold px-4 py-3 rounded-xl border-2 border-gray-300 motion-safe:hover:bg-gray-50 transition-all"
            >
              Back
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ── Active challenge ──────────────────────────────────────────────────────

  const writtenProblem = `${problem.a} ${operationSymbol} ${problem.b} = ?`;

  return (
    <div data-testid="prove-challenge-active" className="space-y-4">
      {/* Timer + Score bar */}
      <div className="bg-white border-2 sm:border-[3px] border-black rounded-2xl px-4 py-3 flex items-center justify-between shadow-neo">
        <div className="flex items-center gap-2">
          <Timer
            className={`w-5 h-5 ${timeLeft <= 10 ? 'text-red-500 motion-safe:animate-pulse' : 'text-gray-500'}`}
            aria-hidden="true"
          />
          <span
            className={`text-xl font-black ${timeLeft <= 10 ? 'text-red-500' : 'text-gray-900'}`}
            aria-live="polite"
            aria-label={`${timeLeft} seconds remaining`}
          >
            {timeLeft}s
          </span>
        </div>
        <div className="px-3 py-1 bg-purple-100 rounded-full">
          <span className="text-xs font-black text-purple-600">{tableLabel}</span>
        </div>
        <div className="flex items-center gap-2">
          <Trophy className="w-5 h-5 text-amber-500" aria-hidden="true" />
          <span className="text-xl font-black text-gray-900" aria-label={`Score: ${score}`}>
            {score}
          </span>
        </div>
        <button
          type="button"
          onClick={onBack}
          className="min-h-[44px] text-xs font-bold text-gray-400 motion-safe:hover:text-gray-600 px-2 transition-colors"
        >
          Exit
        </button>
      </div>

      {/* Problem */}
      <div className="bg-white border-2 sm:border-[3px] border-black rounded-2xl p-6 sm:p-8 shadow-neo text-center">
        <p
          data-testid="prove-written-problem"
          className="text-3xl sm:text-4xl font-black text-gray-900"
          aria-live="polite"
        >
          {writtenProblem}
        </p>
      </div>

      {/* Answer grid */}
      <div className="grid grid-cols-2 gap-3" role="group" aria-label="Answer choices">
        {problem.choices.map((choice, i) => {
          let btnClass =
            'bg-white border-gray-200 text-gray-900 motion-safe:hover:border-purple-300 motion-safe:hover:bg-purple-50 active:translate-y-1';
          if (selected !== null) {
            if (choice === problem.answer) {
              btnClass = 'bg-green-400 border-green-600 text-white scale-105';
            } else if (selected === choice && !isCorrect) {
              btnClass = 'bg-red-400 border-red-600 text-white';
            } else {
              btnClass = 'bg-gray-100 border-gray-200 text-gray-400';
            }
          }
          return (
            <button
              key={i}
              data-testid={`prove-choice-${i}`}
              type="button"
              aria-label={`Answer ${choice}`}
              onClick={() => handleAnswer(choice)}
              disabled={selected !== null}
              className={`min-h-[44px] py-5 rounded-2xl border-2 sm:border-[3px] font-black text-2xl transition-all shadow-neo-xs ${btnClass}`}
            >
              {choice}
            </button>
          );
        })}
      </div>

      {/* Feedback */}
      {selected !== null && (
        <p
          data-testid="prove-feedback"
          role="status"
          aria-live="polite"
          className={`text-center font-black text-lg ${isCorrect ? 'text-green-400' : 'text-red-400'}`}
        >
          {isCorrect ? '✓ Correct!' : `✗ It was ${problem.answer}`}
        </p>
      )}
    </div>
  );
}

// Export constants so tests can reference them without reimporting internals.
export { CHALLENGE_DURATION, PASS_SCORE, PASS_AVG_TIME };
