// FHS-394: Maths Practice stage.
// Ported from legacy MathsTablePractice.tsx with neo-brutalist Tailwind tokens.
//
// 10 questions for the given operation + tableNumber. 4-option multiple choice
// via generateTableProblem. Immediate feedback (auto-advance ~600ms correct /
// ~1000ms wrong). Tracks totalCorrect + streak.
//
// Completion: when the 10th question resolves, onComplete(totalCorrect) fires
// exactly once via a useEffect on `done` guarded by hasCompletedRef. The parent
// owns the celebration screen (MathsStageComplete): this component never
// renders its own done UI, so the PUT always fires even if the kid dismisses.
//
// Double-tap guard: answeredRef resets each time a new question is generated
// (same pattern as MathsPlacementTest).

import { useState, useCallback, useRef, useEffect } from 'react';
import { ArrowLeft } from 'lucide-react';
import {
  type Operation,
  type TableNumber,
  EMOJI_MAP,
  OPERATION_SYMBOLS,
  generateTableProblem,
  emojiSizeClass,
  getTableLabel,
} from './maths-utils';

const TOTAL_QUESTIONS = 10;

// ─── Props ────────────────────────────────────────────────────────────────────

interface MathsTablePracticeProps {
  operation: Operation;
  tableNumber: TableNumber;
  onComplete: (correct: number) => void;
  onBack: () => void;
}

// ─── Visual cue sub-components ────────────────────────────────────────────────

function EmojiGroup({ count, emoji }: { count: number; emoji: string }) {
  const symbol = EMOJI_MAP[emoji] ?? emoji;
  const sizeClass = emojiSizeClass(count);
  return (
    <div className="flex flex-wrap gap-1 items-center justify-center">
      {Array.from({ length: count }).map((_, i) => (
        <span key={i} className={sizeClass} aria-hidden="true">
          {symbol}
        </span>
      ))}
    </div>
  );
}

function AdditionVisual({ a, b, emoji }: { a: number; b: number; emoji: string }) {
  return (
    <div className="flex items-center justify-center gap-2 sm:gap-4 flex-wrap">
      <div className="bg-blue-50 border-2 border-blue-200 rounded-2xl p-3 sm:p-4 min-w-[80px]">
        <EmojiGroup count={a} emoji={emoji} />
      </div>
      <span className="text-2xl sm:text-3xl font-black text-gray-700" aria-hidden="true">
        +
      </span>
      <div className="bg-green-50 border-2 border-green-200 rounded-2xl p-3 sm:p-4 min-w-[80px]">
        <EmojiGroup count={b} emoji={emoji} />
      </div>
    </div>
  );
}

function SubtractionVisual({ a, b, emoji }: { a: number; b: number; emoji: string }) {
  const symbol = EMOJI_MAP[emoji] ?? emoji;
  const sizeClass = emojiSizeClass(a);
  return (
    <div className="flex flex-col items-center gap-3">
      <div className="bg-orange-50 border-2 border-orange-200 rounded-2xl p-3 sm:p-4">
        <div className="flex flex-wrap gap-1 items-center justify-center">
          {Array.from({ length: a }).map((_, i) => (
            <span key={i} className={`${sizeClass} relative ${i < b ? 'opacity-40' : ''}`}>
              {symbol}
              {i < b && (
                <span
                  className="absolute inset-0 flex items-center justify-center text-red-500 text-2xl font-black"
                  aria-hidden="true"
                >
                  X
                </span>
              )}
            </span>
          ))}
        </div>
      </div>
      <p className="text-sm font-bold text-gray-500">How many are left?</p>
    </div>
  );
}

function MultiplicationVisual({ a, b, emoji }: { a: number; b: number; emoji: string }) {
  return (
    <div className="flex flex-col items-center gap-3">
      <div className="max-h-40 overflow-y-auto flex flex-wrap gap-2 justify-center">
        {Array.from({ length: a }).map((_, i) => (
          <div key={i} className="bg-purple-50 border-2 border-purple-200 rounded-xl p-2 sm:p-3">
            <EmojiGroup count={b} emoji={emoji} />
          </div>
        ))}
      </div>
      <p className="text-sm font-bold text-gray-500">Count all the groups!</p>
    </div>
  );
}

function DivisionVisual({ a, b, emoji }: { a: number; b: number; emoji: string }) {
  const sizeClass = emojiSizeClass(a);
  const symbol = EMOJI_MAP[emoji] ?? emoji;
  const perGroup = b > 0 ? Math.floor(a / b) : 0;
  return (
    <div className="flex flex-col items-center gap-3">
      <div className="bg-indigo-50 border-2 border-indigo-200 rounded-2xl p-3 sm:p-4 mb-2">
        <div className="flex flex-wrap gap-1 items-center justify-center">
          {Array.from({ length: a }).map((_, i) => (
            <span key={i} className={sizeClass} aria-hidden="true">
              {symbol}
            </span>
          ))}
        </div>
        <p className="text-xs font-bold text-gray-500 text-center mt-1">
          {a} total: sharing equally
        </p>
      </div>
      <span className="text-lg font-black text-gray-500" aria-hidden="true">
        ↓ Split into {b} groups ↓
      </span>
      <div className="flex flex-wrap gap-2 justify-center">
        {Array.from({ length: b }).map((_, i) => (
          <div key={i} className="bg-pink-50 border-2 border-pink-200 rounded-xl p-2 sm:p-3">
            <EmojiGroup count={perGroup} emoji={emoji} />
          </div>
        ))}
      </div>
      <p className="text-sm font-bold text-gray-500">How many in each group?</p>
    </div>
  );
}

function VisualCue({
  operation,
  a,
  b,
  emoji,
}: {
  operation: Operation;
  a: number;
  b: number;
  emoji: string;
}) {
  switch (operation) {
    case 'addition':
      return <AdditionVisual a={a} b={b} emoji={emoji} />;
    case 'subtraction':
      return <SubtractionVisual a={a} b={b} emoji={emoji} />;
    case 'multiplication':
      return <MultiplicationVisual a={a} b={b} emoji={emoji} />;
    case 'division':
      return <DivisionVisual a={a} b={b} emoji={emoji} />;
  }
}

// ─── Main Component ───────────────────────────────────────────────────────────

export function MathsTablePractice({
  operation,
  tableNumber,
  onComplete,
  onBack,
}: MathsTablePracticeProps) {
  const [questionIndex, setQuestionIndex] = useState(0);
  const [totalCorrect, setTotalCorrect] = useState(0);
  const [problem, setProblem] = useState(() => generateTableProblem(operation, tableNumber));
  const [selected, setSelected] = useState<number | null>(null);
  const [isCorrect, setIsCorrect] = useState<boolean | null>(null);
  const [streak, setStreak] = useState(0);
  const [done, setDone] = useState(false);
  const [finalCorrect, setFinalCorrect] = useState(0);

  // Double-tap guard: reset when the question changes (via useEffect below).
  const answeredRef = useRef(false);
  // Completion guard: ensures onComplete fires exactly once even if React
  // re-renders while the done flag settles.
  const hasCompletedRef = useRef(false);

  // Reset the double-tap guard whenever a new problem loads.
  useEffect(() => {
    answeredRef.current = false;
  }, [questionIndex]);

  // Fire onComplete exactly once when the run finishes.
  useEffect(() => {
    if (!done || hasCompletedRef.current) return;
    hasCompletedRef.current = true;
    onComplete(finalCorrect);
  }, [done, finalCorrect, onComplete]);

  const symbol = OPERATION_SYMBOLS[operation];
  const label = getTableLabel(operation, tableNumber);

  const nextQuestion = useCallback(
    (currentCorrect: number) => {
      if (questionIndex + 1 >= TOTAL_QUESTIONS) {
        setFinalCorrect(currentCorrect);
        setDone(true);
        return;
      }
      setProblem(generateTableProblem(operation, tableNumber));
      setQuestionIndex((i) => i + 1);
      setSelected(null);
      setIsCorrect(null);
    },
    [questionIndex, operation, tableNumber],
  );

  const handleAnswer = (choice: number) => {
    if (answeredRef.current || selected !== null) return;
    answeredRef.current = true;

    setSelected(choice);
    const correct = choice === problem.answer;
    setIsCorrect(correct);

    let updatedCorrect = totalCorrect;
    if (correct) {
      updatedCorrect = totalCorrect + 1;
      setTotalCorrect(updatedCorrect);
      setStreak((s) => s + 1);
    } else {
      setStreak(0);
    }

    setTimeout(() => nextQuestion(updatedCorrect), correct ? 600 : 1000);
  };

  // ── Question screen (parent renders MathsStageComplete after onComplete) ──

  const writtenProblem = `${problem.a} ${symbol} ${problem.b} = ?`;

  return (
    <div data-testid="maths-table-practice" className="space-y-4">
      {/* Header: back + label */}
      <div className="flex items-center justify-between">
        <button
          data-testid="practice-back-btn"
          type="button"
          onClick={onBack}
          className="min-h-[44px] text-white/70 text-sm font-bold flex items-center gap-1 motion-safe:hover:text-white transition-colors py-2 -my-2"
        >
          <ArrowLeft className="w-4 h-4" aria-hidden="true" /> Back
        </button>
        <p className="text-xs font-black text-white/70">{label}</p>
      </div>

      {/* Progress bar */}
      <div
        className="bg-white/20 rounded-full h-2 overflow-hidden"
        role="progressbar"
        aria-valuenow={questionIndex + 1}
        aria-valuemin={1}
        aria-valuemax={TOTAL_QUESTIONS}
        aria-label="Practice progress"
      >
        <div
          className="bg-gradient-to-r from-blue-400 to-indigo-500 h-full rounded-full transition-all duration-300"
          style={{ width: `${((questionIndex + 1) / TOTAL_QUESTIONS) * 100}%` }}
        />
      </div>
      <p
        data-testid="practice-progress"
        className="text-xs font-black text-white/60 text-center"
        aria-live="polite"
      >
        Question {questionIndex + 1} of {TOTAL_QUESTIONS}
        {streak >= 3 && ` • 🔥 ${streak} streak!`}
      </p>

      {/* Visual cue card */}
      <div
        data-testid="practice-visual-cue"
        className="bg-white border-2 sm:border-[3px] border-black rounded-2xl p-4 sm:p-6 shadow-neo"
      >
        <div className="mb-4">
          <VisualCue operation={operation} a={problem.a} b={problem.b} emoji={problem.emoji} />
        </div>
        <p
          data-testid="practice-written-problem"
          className="text-2xl sm:text-3xl font-black text-gray-900 text-center"
          aria-live="polite"
        >
          {writtenProblem}
        </p>
      </div>

      {/* Answer choices */}
      <div className="grid grid-cols-2 gap-3" role="group" aria-label="Answer choices">
        {problem.choices.map((choice, i) => {
          let btnClass =
            'bg-white border-gray-200 text-gray-900 motion-safe:hover:border-blue-300 motion-safe:hover:bg-blue-50 active:translate-y-1';
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
              data-testid={`practice-choice-${i}`}
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
          data-testid="practice-feedback"
          role="status"
          aria-live="polite"
          className={`text-center font-black text-lg ${isCorrect ? 'text-green-400' : 'text-red-400'}`}
        >
          {isCorrect
            ? streak >= 5
              ? '🔥 On fire!'
              : streak >= 3
                ? '⭐ Amazing!'
                : '✓ Correct!'
            : `✗ It was ${problem.answer}`}
        </p>
      )}
    </div>
  );
}
