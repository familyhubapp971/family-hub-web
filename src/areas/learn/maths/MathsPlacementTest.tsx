// FHS-394: Maths Placement Test.
// Ported from the legacy MathsPlacementTest.tsx; adapted for the kid token
// auth pattern (Bearer header, /api/kid/maths/placement endpoint).
//
// 12 questions (one per table 1–12), 4-option multiple choice, per-question
// timing. Phases: 'intro' → 'testing' → 'results'.
// Correct + ≤4 s qualifies a table as mastered (backend cascade handles unlocks).

import { useState, useEffect, useRef } from 'react';
import { ArrowLeft } from 'lucide-react';
import { API_BASE } from '../../../app/lib/api';
import {
  type Operation,
  type TableNumber,
  TABLE_NUMBERS,
  OPERATION_SYMBOLS,
  getTableLabel,
  generateTableProblem,
} from './maths-utils';

interface MathsPlacementTestProps {
  kidToken: string;
  operation: Operation;
  // The parent re-fetches progress on completion, so the unlocked list isn't
  // passed up: the placement POST has already persisted the mastered tables.
  onComplete: () => void;
  onBack: () => void;
}

interface QuestionState {
  tableNumber: TableNumber;
  a: number;
  b: number;
  answer: number;
  choices: number[];
}

type Phase = 'intro' | 'testing' | 'results';

export function MathsPlacementTest({
  kidToken,
  operation,
  onComplete,
  onBack,
}: MathsPlacementTestProps) {
  const [phase, setPhase] = useState<Phase>('intro');
  const [currentIndex, setCurrentIndex] = useState(0);
  const [question, setQuestion] = useState<QuestionState | null>(null);
  const [results, setResults] = useState<
    { tableNumber: number; correct: boolean; timeSeconds: number }[]
  >([]);
  const [selectedAnswer, setSelectedAnswer] = useState<number | null>(null);
  const [isCorrect, setIsCorrect] = useState<boolean | null>(null);
  const [unlockedTables, setUnlockedTables] = useState<number[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const startTimeRef = useRef<number>(0);
  // Guards against a double-tap registering two answers for the same question
  // before React flushes selectedAnswer (a real risk on a slow phone).
  const answeredRef = useRef(false);

  const symbol = OPERATION_SYMBOLS[operation];

  // Generate question for current table
  useEffect(() => {
    if (phase !== 'testing') return;
    const t = TABLE_NUMBERS[currentIndex]!;
    const problem = generateTableProblem(operation, t);
    setQuestion({
      tableNumber: t,
      a: problem.a,
      b: problem.b,
      answer: problem.answer,
      choices: problem.choices,
    });
    setSelectedAnswer(null);
    setIsCorrect(null);
    answeredRef.current = false;
    startTimeRef.current = Date.now();
  }, [phase, currentIndex, operation]);

  const handleAnswer = (choice: number) => {
    if (answeredRef.current || selectedAnswer !== null || !question) return;
    answeredRef.current = true;

    const timeSeconds = (Date.now() - startTimeRef.current) / 1000;
    const correct = choice === question.answer;
    setSelectedAnswer(choice);
    setIsCorrect(correct);

    const newResults = [
      ...results,
      {
        tableNumber: question.tableNumber,
        correct,
        timeSeconds: Math.round(timeSeconds * 10) / 10,
      },
    ];
    setResults(newResults);

    setTimeout(() => {
      if (currentIndex < TABLE_NUMBERS.length - 1) {
        setCurrentIndex((i) => i + 1);
      } else {
        void submitResults(newResults);
      }
    }, 800);
  };

  const submitResults = async (finalResults: typeof results) => {
    setSubmitting(true);
    try {
      const res = await fetch(`${API_BASE}/api/kid/maths/placement`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${kidToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ operation, results: finalResults }),
      });
      if (res.ok) {
        const data = (await res.json()) as { unlocked: number[] };
        setUnlockedTables(data.unlocked ?? []);
      }
    } catch (err) {
      console.error('Failed to submit placement results:', err);
    }
    setPhase('results');
    setSubmitting(false);
  };

  // --- Intro screen ---
  if (phase === 'intro') {
    return (
      <div data-testid="placement-test" className="space-y-4">
        <div className="bg-white border-2 sm:border-[3px] border-black rounded-2xl p-6 shadow-neo text-center space-y-4">
          <div className="text-5xl" aria-hidden="true">
            🧠
          </div>
          <h3 className="font-black text-xl text-gray-800">Quick Placement Test</h3>
          <p className="text-sm text-gray-500 font-medium max-w-sm mx-auto">
            Answer one question for each table (1–12). Get it right quickly and we&apos;ll skip you
            ahead!
          </p>
          <div className="bg-blue-50 border-2 border-blue-200 rounded-xl p-3 max-w-xs mx-auto">
            <p className="text-xs font-bold text-blue-700">
              Answer correctly in under 4 seconds to master a table instantly
            </p>
          </div>
          <div className="flex gap-3 justify-center pt-2">
            <button
              type="button"
              onClick={onBack}
              className="min-h-[44px] text-gray-500 font-bold px-4 py-2 rounded-xl border-2 border-gray-200 hover:bg-gray-50 transition-all text-sm"
            >
              <ArrowLeft className="w-4 h-4 inline mr-1" aria-hidden="true" /> Back
            </button>
            <button
              data-testid="placement-begin"
              type="button"
              onClick={() => setPhase('testing')}
              className="min-h-[44px] bg-gradient-to-r from-blue-500 to-indigo-600 text-white font-black px-6 py-3 rounded-xl border-2 border-black shadow-neo-xs active:translate-y-0.5 transition-all"
            >
              Let&apos;s Go!
            </button>
          </div>
        </div>
      </div>
    );
  }

  // --- Testing screen ---
  if (phase === 'testing' && question) {
    return (
      <div data-testid="placement-test" className="space-y-4">
        {/* Progress bar */}
        <div
          className="bg-white/20 rounded-full h-2 overflow-hidden"
          role="progressbar"
          aria-valuenow={currentIndex + 1}
          aria-valuemin={1}
          aria-valuemax={12}
          aria-label="Placement test progress"
        >
          <div
            className="bg-gradient-to-r from-blue-400 to-indigo-500 h-full rounded-full transition-all duration-300"
            style={{ width: `${((currentIndex + 1) / 12) * 100}%` }}
          />
        </div>
        <p className="text-xs font-black text-white/70 text-center">
          {getTableLabel(operation, question.tableNumber)}: Question {currentIndex + 1} of 12
        </p>

        <div className="bg-white border-2 sm:border-[3px] border-black rounded-2xl p-6 shadow-neo text-center space-y-6">
          {/* Question */}
          <div className="space-y-2">
            <p className="text-4xl sm:text-5xl font-black text-gray-900" aria-live="polite">
              {question.a} {symbol} {question.b}
            </p>
            <p className="text-lg font-bold text-gray-400">= ?</p>
          </div>

          {/* Choices */}
          <div
            className="grid grid-cols-2 gap-3 max-w-xs mx-auto"
            role="group"
            aria-label="Answer choices"
          >
            {question.choices.map((choice) => {
              let btnClass =
                'bg-white border-2 border-gray-300 text-gray-800 hover:border-blue-400 hover:bg-blue-50';
              if (selectedAnswer !== null) {
                if (choice === question.answer) {
                  btnClass = 'bg-green-100 border-2 border-green-500 text-green-800';
                } else if (choice === selectedAnswer) {
                  btnClass = 'bg-red-100 border-2 border-red-500 text-red-800';
                } else {
                  btnClass = 'bg-gray-50 border-2 border-gray-200 text-gray-400';
                }
              }
              return (
                <button
                  key={choice}
                  data-testid={`placement-choice-${choice}`}
                  type="button"
                  onClick={() => handleAnswer(choice)}
                  disabled={selectedAnswer !== null}
                  aria-label={`Answer ${choice}`}
                  className={`min-h-[44px] py-4 rounded-xl font-black text-xl transition-all ${btnClass}`}
                >
                  {choice}
                </button>
              );
            })}
          </div>

          {/* Feedback flash */}
          {selectedAnswer !== null && (
            <p
              role="status"
              aria-live="polite"
              className={`font-black text-lg ${isCorrect ? 'text-green-600' : 'text-red-500'}`}
            >
              {isCorrect ? 'Correct!' : `It was ${question.answer}`}
            </p>
          )}
        </div>
      </div>
    );
  }

  // --- Results screen ---
  if (phase === 'results') {
    const totalCorrect = results.filter((r) => r.correct).length;
    const maxUnlocked = unlockedTables.length > 0 ? Math.max(...unlockedTables) : 0;

    return (
      <div data-testid="placement-test" className="space-y-4">
        <div className="bg-white border-2 sm:border-[3px] border-black rounded-2xl p-6 shadow-neo text-center space-y-4">
          {submitting ? (
            <div className="text-4xl animate-pulse" aria-busy="true">
              🔄
            </div>
          ) : (
            <>
              <div className="text-5xl" aria-hidden="true">
                {maxUnlocked >= 8 ? '🏆' : maxUnlocked >= 4 ? '🌟' : maxUnlocked > 0 ? '👍' : '💪'}
              </div>
              <h3 className="font-black text-xl text-gray-800">
                {maxUnlocked >= 8
                  ? 'Amazing!'
                  : maxUnlocked >= 4
                    ? 'Great job!'
                    : maxUnlocked > 0
                      ? 'Nice start!'
                      : 'Ready to learn!'}
              </h3>
              <p className="text-sm text-gray-500 font-medium">
                You got {totalCorrect}/12 correct
                {maxUnlocked > 0 && ` and mastered tables 1–${maxUnlocked}!`}
              </p>

              {/* Table results grid */}
              <div
                className="grid grid-cols-6 gap-2 max-w-xs mx-auto pt-2"
                aria-label="Results per table"
              >
                {results.map((r) => (
                  <div
                    key={r.tableNumber}
                    aria-label={`Table ${r.tableNumber}: ${r.correct && r.timeSeconds <= 4 ? 'mastered' : r.correct ? 'correct' : 'missed'}`}
                    className={`aspect-square w-full rounded-lg flex items-center justify-center text-xs font-black ${
                      r.correct && r.timeSeconds <= 4
                        ? 'bg-green-100 text-green-700 border-2 border-green-400'
                        : r.correct
                          ? 'bg-yellow-50 text-yellow-700 border-2 border-yellow-300'
                          : 'bg-red-50 text-red-400 border-2 border-red-200'
                    }`}
                  >
                    {r.tableNumber}
                  </div>
                ))}
              </div>
              <div
                className="flex gap-2 justify-center text-[10px] font-bold text-gray-400 pt-1"
                aria-hidden="true"
              >
                <span className="flex items-center gap-1">
                  <span className="w-3 h-3 rounded bg-green-100 border border-green-400" /> Mastered
                </span>
                <span className="flex items-center gap-1">
                  <span className="w-3 h-3 rounded bg-yellow-50 border border-yellow-300" /> Correct
                </span>
                <span className="flex items-center gap-1">
                  <span className="w-3 h-3 rounded bg-red-50 border border-red-200" /> Missed
                </span>
              </div>

              <button
                data-testid="placement-done"
                type="button"
                onClick={() => onComplete()}
                className="min-h-[44px] bg-gradient-to-r from-blue-500 to-indigo-600 text-white font-black px-6 py-3 rounded-xl border-2 border-black shadow-neo-xs active:translate-y-0.5 transition-all mt-4"
              >
                Continue →
              </button>
            </>
          )}
        </div>
      </div>
    );
  }

  return null;
}
