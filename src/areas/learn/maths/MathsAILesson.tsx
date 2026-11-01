// FHS-389: AI-generated Maths lesson for the kid Learn tab.
// Ported from the legacy frontend/components/MathsAILesson.tsx.
//
// When the endpoint reports { enabled: false } the component renders nothing:
// the caller (LessonView / Maths flow) keeps the static question bank as the
// full experience. This is the flag-off path: no broken button, no AI UI.
//
// When enabled, the lesson walks through 5 steps:
//   concept → visual → stickyPhrase → gapCheck → practice (3 questions).
//
// No child PII is sent to the API. All auth uses the kidToken bearer header.

import { useState, useCallback, useEffect, useRef } from 'react';
import {
  BookOpen,
  ChevronRight,
  ChevronLeft,
  Sparkles,
  Brain,
  HelpCircle,
  Pencil,
  RotateCcw,
} from 'lucide-react';
import { API_BASE } from '../../../app/lib/api';
import { Spinner } from '@familyhub/ui';

// ─── Types ───────────────────────────────────────────────────────────────────

type Operation = 'addition' | 'subtraction' | 'multiplication' | 'division';
type Difficulty = 'easy' | 'medium' | 'hard';
type LessonStep = 'concept' | 'visual' | 'sticky' | 'gapCheck' | 'practice';

interface LessonVisual {
  description: string;
  emoji: string;
  groups: number;
  perGroup: number;
  total: number;
  equation: string;
}

interface LessonPractice {
  emoji: string;
  groups: number;
  perGroup: number;
  question: string;
  answer: number;
  choices: number[];
}

interface MathLesson {
  concept: string;
  visual: LessonVisual;
  stickyPhrase: string;
  gapCheck: string;
  practice: LessonPractice[];
}

export interface MathsAILessonProps {
  kidToken: string;
  operation?: Operation;
  difficulty?: Difficulty;
  tableNumber?: number;
  onComplete?: () => void;
  onBack?: () => void;
}

// ─── Constants ───────────────────────────────────────────────────────────────

const OPERATIONS: { key: Operation; label: string; emoji: string; symbol: string }[] = [
  { key: 'addition', label: 'Addition', emoji: '➕', symbol: '+' },
  { key: 'subtraction', label: 'Subtraction', emoji: '➖', symbol: '−' },
  { key: 'multiplication', label: 'Multiplication', emoji: '✖️', symbol: '×' },
  { key: 'division', label: 'Division', emoji: '➗', symbol: '÷' },
];

const DIFFICULTIES: { key: Difficulty; label: string; color: string }[] = [
  { key: 'easy', label: 'Easy', color: 'from-green-400 to-emerald-500' },
  { key: 'medium', label: 'Medium', color: 'from-amber-400 to-orange-500' },
  { key: 'hard', label: 'Hard', color: 'from-red-400 to-rose-500' },
];

const STEP_ORDER: LessonStep[] = ['concept', 'visual', 'sticky', 'gapCheck', 'practice'];

const STEP_INFO: Record<LessonStep, { icon: typeof BookOpen; title: string; color: string }> = {
  concept: { icon: BookOpen, title: "Let's Learn!", color: 'from-blue-500 to-cyan-500' },
  visual: { icon: Sparkles, title: 'See It!', color: 'from-purple-500 to-pink-500' },
  sticky: { icon: Brain, title: 'Remember This!', color: 'from-amber-500 to-orange-500' },
  gapCheck: { icon: HelpCircle, title: 'Good Question!', color: 'from-teal-500 to-emerald-500' },
  practice: { icon: Pencil, title: 'Your Turn!', color: 'from-rose-500 to-red-500' },
};

// ─── Visual helpers ───────────────────────────────────────────────────────────

function parseEquation(equation: string): { first: number; second: number } | null {
  // Accept ASCII hyphen and the Unicode minus (U+2212) the AI sometimes emits.
  const match = equation.match(/(\d+)\s*[+\-−×÷]\s*(\d+)/);
  if (!match) return null;
  return { first: parseInt(match[1]!), second: parseInt(match[2]!) };
}

function toNum(val: number | number[]): number {
  return Array.isArray(val) ? (val[0] ?? 0) : val;
}

function aiEmojiSize(count: number): string {
  if (count <= 12) return 'text-xl sm:text-2xl';
  if (count <= 25) return 'text-base sm:text-lg';
  return 'text-sm';
}

function EmojiGrid({ emoji, count }: { emoji: string; count: number }) {
  const n = toNum(count);
  const sizeClass = aiEmojiSize(n);
  return (
    <div className="flex flex-wrap gap-1 items-center justify-center">
      {Array.from({ length: n }).map((_, i) => (
        <span key={i} className={sizeClass} aria-hidden="true">
          {emoji}
        </span>
      ))}
    </div>
  );
}

function AdditionVisual({ emoji, equation }: { emoji: string; equation: string }) {
  const parsed = parseEquation(equation);
  const first = parsed?.first ?? 0;
  const second = parsed?.second ?? 0;
  return (
    <div className="flex items-center justify-center gap-2 sm:gap-4 flex-wrap">
      <div className="bg-blue-50 border-2 border-blue-200 rounded-2xl p-3 sm:p-4 min-w-[70px]">
        <EmojiGrid emoji={emoji} count={first} />
      </div>
      <span className="text-2xl sm:text-3xl font-black text-gray-700" aria-hidden="true">
        +
      </span>
      <div className="bg-green-50 border-2 border-green-200 rounded-2xl p-3 sm:p-4 min-w-[70px]">
        <EmojiGrid emoji={emoji} count={second} />
      </div>
      <span className="text-2xl sm:text-3xl font-black text-gray-700" aria-hidden="true">
        =
      </span>
      <span className="text-3xl sm:text-4xl font-black text-purple-500" aria-hidden="true">
        ?
      </span>
    </div>
  );
}

function SubtractionVisual({ emoji, equation }: { emoji: string; equation: string }) {
  const parsed = parseEquation(equation);
  const totalCount = parsed?.first ?? 0;
  const crossedCount = Math.min(parsed?.second ?? 0, totalCount);
  const sizeClass = aiEmojiSize(totalCount);
  return (
    <div className="flex flex-col items-center gap-3">
      <div className="bg-orange-50 border-2 border-orange-200 rounded-2xl p-3 sm:p-4">
        <div className="flex flex-wrap gap-1 items-center justify-center">
          {Array.from({ length: totalCount }).map((_, i) => (
            <span
              key={i}
              className={`${sizeClass} relative ${i >= totalCount - crossedCount ? 'opacity-40' : ''}`}
              aria-hidden="true"
            >
              {emoji}
              {i >= totalCount - crossedCount && (
                <span className="absolute inset-0 flex items-center justify-center text-red-500 text-2xl font-black">
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

function MultiplicationVisual({
  emoji,
  groups,
  perGroup,
}: {
  emoji: string;
  groups: number;
  perGroup: number;
}) {
  return (
    <div className="flex flex-col items-center gap-3">
      <div className="flex flex-wrap gap-2 justify-center">
        {Array.from({ length: groups }).map((_, i) => (
          <div key={i} className="bg-purple-50 border-2 border-purple-200 rounded-xl p-2 sm:p-3">
            <EmojiGrid emoji={emoji} count={perGroup} />
          </div>
        ))}
      </div>
      <p className="text-sm font-bold text-gray-500">Count all the groups!</p>
    </div>
  );
}

function DivisionVisual({
  emoji,
  groups,
  perGroup,
  total,
}: {
  emoji: string;
  groups: number;
  perGroup: number;
  total: number;
}) {
  return (
    <div className="flex flex-col items-center gap-3">
      <div className="bg-indigo-50 border-2 border-indigo-200 rounded-2xl p-3 sm:p-4 mb-2">
        <EmojiGrid emoji={emoji} count={total} />
        <p className="text-xs font-bold text-gray-500 text-center mt-1">
          {total} total: sharing equally
        </p>
      </div>
      <span className="text-lg font-black text-gray-500">
        {'↓'} Split into {groups} groups {'↓'}
      </span>
      <div className="flex flex-wrap gap-2 justify-center">
        {Array.from({ length: groups }).map((_, i) => (
          <div key={i} className="bg-pink-50 border-2 border-pink-200 rounded-xl p-2 sm:p-3">
            <EmojiGrid emoji={emoji} count={perGroup} />
          </div>
        ))}
      </div>
      <p className="text-sm font-bold text-gray-500">How many in each group?</p>
    </div>
  );
}

function OperationVisual({
  operation,
  emoji,
  groups,
  perGroup,
  total,
  equation,
}: {
  operation: Operation;
  emoji: string;
  groups: number;
  perGroup: number;
  total: number;
  equation: string;
}) {
  switch (operation) {
    case 'addition':
      return <AdditionVisual emoji={emoji} equation={equation} />;
    case 'subtraction':
      return <SubtractionVisual emoji={emoji} equation={equation} />;
    case 'multiplication':
      return (
        <MultiplicationVisual emoji={emoji} groups={toNum(groups)} perGroup={toNum(perGroup)} />
      );
    case 'division':
      return (
        <DivisionVisual
          emoji={emoji}
          groups={toNum(groups)}
          perGroup={toNum(perGroup)}
          total={toNum(total)}
        />
      );
  }
}

// ─── Practice question ────────────────────────────────────────────────────────

function PracticeQuestion({
  practice,
  operation,
  index,
  total,
  onNext,
}: {
  practice: LessonPractice;
  operation: Operation;
  index: number;
  total: number;
  onNext: () => void;
}) {
  const [selected, setSelected] = useState<number | null>(null);
  const isCorrect = selected === practice.answer;
  const hasAnswered = selected !== null;

  return (
    <div className="space-y-4">
      <p className="text-sm font-bold text-gray-500 text-center" aria-live="polite">
        Question {index + 1} of {total}
      </p>

      <div className="flex justify-center">
        <OperationVisual
          operation={operation}
          emoji={practice.emoji}
          groups={practice.groups}
          perGroup={practice.perGroup}
          total={practice.groups * toNum(practice.perGroup)}
          equation={practice.question}
        />
      </div>

      <p
        data-testid="ai-lesson-question"
        className="text-center text-xl sm:text-2xl font-black text-gray-800"
      >
        {practice.question}
      </p>

      <div
        data-testid="ai-lesson-choices"
        className="grid grid-cols-2 gap-3 max-w-xs mx-auto"
        role="group"
        aria-label="Answer choices"
      >
        {practice.choices.map((choice, i) => {
          let btnClass = 'bg-white border-2 border-gray-300 hover:border-blue-400 hover:bg-blue-50';
          if (hasAnswered) {
            if (choice === practice.answer) {
              btnClass = 'bg-green-100 border-2 border-green-500 text-green-800';
            } else if (choice === selected) {
              btnClass = 'bg-red-100 border-2 border-red-400 text-red-700';
            } else {
              btnClass = 'bg-gray-50 border-2 border-gray-200 text-gray-400';
            }
          }
          return (
            <button
              key={i}
              data-testid={`ai-lesson-choice-${i}`}
              type="button"
              onClick={() => !hasAnswered && setSelected(choice)}
              disabled={hasAnswered}
              aria-pressed={selected === choice}
              aria-label={`Answer ${choice}`}
              className={`py-3 rounded-xl font-black text-lg transition-all min-h-[44px] ${btnClass} ${!hasAnswered ? 'active:scale-95' : ''}`}
            >
              {choice}
            </button>
          );
        })}
      </div>

      {hasAnswered && (
        <div
          role="status"
          aria-live="polite"
          className={`text-center rounded-xl py-3 px-4 font-bold ${
            isCorrect
              ? 'bg-green-50 text-green-700 border border-green-200'
              : 'bg-amber-50 text-amber-700 border border-amber-200'
          }`}
        >
          {isCorrect
            ? '🎉 Amazing! You got it right!'
            : `Good try! The answer is ${practice.answer}. Let's keep going!`}
        </div>
      )}

      {hasAnswered && (
        <div className="flex justify-center">
          <button
            data-testid="ai-lesson-practice-next"
            type="button"
            onClick={onNext}
            className="flex items-center gap-2 bg-gradient-to-r from-blue-500 to-indigo-500 text-white font-black px-6 py-2.5 rounded-xl border-2 border-black shadow-neo-xs active:translate-y-0.5 transition-all min-h-[44px]"
          >
            {index < total - 1 ? 'Next Question' : 'Finish Lesson'}
            <ChevronRight className="w-4 h-4" aria-hidden="true" />
          </button>
        </div>
      )}
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

/**
 * AI Maths lesson panel for the kid Learn tab.
 *
 * Pass `operation` + `tableNumber` from a progressive tables flow to auto-start.
 * Without those props the component renders a selection screen first.
 *
 * When the server reports { enabled: false } this component renders nothing:
 * the caller should keep the static Maths bank visible.
 */
export function MathsAILesson({
  kidToken,
  operation: initialOperation,
  difficulty: initialDifficulty,
  tableNumber,
  onComplete,
  onBack,
}: MathsAILessonProps) {
  const [operation, setOperation] = useState<Operation>(initialOperation ?? 'addition');
  const [difficulty, setDifficulty] = useState<Difficulty>(initialDifficulty ?? 'easy');
  const [lesson, setLesson] = useState<MathLesson | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [disabled, setDisabled] = useState(false);
  const [currentStep, setCurrentStep] = useState(0);
  const [practiceIndex, setPracticeIndex] = useState(0);
  const [completed, setCompleted] = useState(false);

  const inFlight = useRef(false);
  const generateLesson = useCallback(async () => {
    // Guard against double-clicks / concurrent calls: each is a paid AI call.
    if (inFlight.current) return;
    inFlight.current = true;
    setLoading(true);
    setError(null);
    setLesson(null);
    setCurrentStep(0);
    setPracticeIndex(0);
    setCompleted(false);

    try {
      const body = tableNumber ? { operation, tableNumber } : { operation, difficulty };

      const res = await fetch(`${API_BASE}/api/kid/learn/maths/ai-lesson`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${kidToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        setError('Could not generate lesson. Please try again.');
        return;
      }

      const data = (await res.json()) as
        | { enabled: false }
        | { enabled: true; lesson: MathLesson }
        | { enabled: true; lesson: null; error: string };

      if (!data.enabled) {
        setDisabled(true);
        return;
      }

      if (!data.lesson) {
        setError(
          (data as { enabled: true; lesson: null; error: string }).error ??
            'Could not generate lesson. Please try again.',
        );
        return;
      }

      setLesson(data.lesson);
    } catch {
      setError('Something went wrong. Please try again.');
    } finally {
      setLoading(false);
      inFlight.current = false;
    }
  }, [kidToken, operation, difficulty, tableNumber]);

  const resetLesson = () => {
    setLesson(null);
    setCurrentStep(0);
    setPracticeIndex(0);
    setCompleted(false);
    setError(null);
  };

  // Auto-generate in progressive table mode (tableNumber provided).
  useEffect(() => {
    if (!lesson && !loading && tableNumber && !error) {
      void generateLesson();
    }
  }, [tableNumber]); // eslint-disable-line react-hooks/exhaustive-deps

  // Feature flag is off: render nothing; the caller keeps the static bank.
  if (disabled) return null;

  const step = STEP_ORDER[currentStep]!;
  const stepInfo = STEP_INFO[step];
  const StepIcon = stepInfo.icon;

  // ── Selection screen ──────────────────────────────────────────────────────

  if (!lesson && !loading && !tableNumber) {
    return (
      <div data-testid="ai-lesson" className="space-y-6">
        <div className="bg-white border-2 sm:border-3 border-black rounded-2xl p-5 sm:p-6 shadow-neo space-y-5">
          <div className="text-center space-y-2">
            <h3 className="font-black text-lg sm:text-xl text-gray-800">📖 AI Maths Lessons</h3>
            <p className="text-sm text-gray-500 font-medium">
              Learn maths step-by-step with fun explanations and pictures!
            </p>
          </div>

          <div className="space-y-2">
            <p className="font-black text-sm text-gray-700" id="op-selector-label">
              Choose an operation:
            </p>
            <div
              data-testid="ai-lesson-op-selector"
              className="grid grid-cols-2 gap-2"
              role="group"
              aria-labelledby="op-selector-label"
            >
              {OPERATIONS.map((op) => (
                <button
                  key={op.key}
                  data-testid={`ai-lesson-op-${op.key}`}
                  type="button"
                  aria-pressed={operation === op.key}
                  onClick={() => setOperation(op.key)}
                  className={`py-3 px-2 rounded-xl font-black text-sm border-2 transition-all min-h-[44px] ${
                    operation === op.key
                      ? 'bg-blue-500 text-white border-black shadow-neo-xs'
                      : 'bg-white text-gray-700 border-gray-200 hover:border-blue-300'
                  }`}
                >
                  <span aria-hidden="true">{op.emoji}</span> {op.label}
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-2">
            <p className="font-black text-sm text-gray-700" id="diff-selector-label">
              Pick difficulty:
            </p>
            <div
              data-testid="ai-lesson-diff-selector"
              className="flex gap-2"
              role="group"
              aria-labelledby="diff-selector-label"
            >
              {DIFFICULTIES.map((diff) => (
                <button
                  key={diff.key}
                  data-testid={`ai-lesson-diff-${diff.key}`}
                  type="button"
                  aria-pressed={difficulty === diff.key}
                  onClick={() => setDifficulty(diff.key)}
                  className={`flex-1 py-2.5 rounded-xl font-black text-sm border-2 transition-all min-h-[44px] ${
                    difficulty === diff.key
                      ? `bg-gradient-to-r ${diff.color} text-white border-black shadow-neo-xs`
                      : 'bg-white text-gray-700 border-gray-200 hover:border-gray-400'
                  }`}
                >
                  {diff.label}
                </button>
              ))}
            </div>
          </div>

          {error && (
            <div
              role="alert"
              className="text-sm font-bold text-red-600 bg-red-50 rounded-xl px-3 py-2 border border-red-200"
            >
              {error}
            </div>
          )}

          <button
            data-testid="ai-lesson-start"
            type="button"
            onClick={() => void generateLesson()}
            className="w-full py-3 bg-gradient-to-r from-blue-500 to-indigo-600 text-white font-black text-base rounded-xl border-2 border-black shadow-neo active:translate-y-0.5 transition-all min-h-[44px]"
          >
            🚀 Start Lesson
          </button>
        </div>
      </div>
    );
  }

  // ── Loading ───────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <div data-testid="ai-lesson-loading" className="space-y-6">
        <div className="bg-white border-2 sm:border-3 border-black rounded-2xl p-8 sm:p-10 shadow-neo text-center space-y-4">
          <div className="flex justify-center">
            <Spinner size="lg" className="text-blue-500" />
          </div>
          <h3 className="font-black text-lg text-gray-800" aria-live="polite" aria-busy="true">
            Creating your lesson…
          </h3>
          <p className="text-sm text-gray-500 font-medium animate-pulse">
            Our AI teacher is preparing something fun just for you! ✨
          </p>
          <div className="space-y-2 max-w-xs mx-auto" aria-hidden="true">
            <div className="h-4 bg-gray-100 rounded-full animate-pulse" />
            <div className="h-4 bg-gray-100 rounded-full animate-pulse w-3/4" />
            <div className="h-4 bg-gray-100 rounded-full animate-pulse w-1/2" />
          </div>
        </div>
      </div>
    );
  }

  // ── Completed ─────────────────────────────────────────────────────────────

  if (completed && lesson) {
    return (
      <div data-testid="ai-lesson-complete" className="space-y-6">
        <div className="bg-white border-2 sm:border-3 border-black rounded-2xl p-6 sm:p-8 shadow-neo text-center space-y-4">
          <div className="text-5xl" aria-hidden="true">
            🎉
          </div>
          <h3 className="font-black text-xl text-gray-800">Lesson Complete!</h3>
          <p className="text-sm text-gray-600 font-medium">Great job! You finished the lesson!</p>
          <div className="bg-gradient-to-r from-purple-50 to-pink-50 rounded-xl p-4 border border-purple-200">
            <p className="font-black text-purple-700 text-sm">Remember:</p>
            <p className="text-purple-600 font-bold text-lg mt-1">
              &ldquo;{lesson.stickyPhrase}&rdquo;
            </p>
          </div>
          <div className="flex flex-col sm:flex-row gap-3 justify-center pt-2">
            {onComplete ? (
              <button
                data-testid="ai-lesson-continue"
                type="button"
                onClick={onComplete}
                className="flex items-center justify-center gap-2 bg-gradient-to-r from-blue-500 to-indigo-500 text-white font-black px-6 py-2.5 rounded-xl border-2 border-black shadow-neo-xs active:translate-y-0.5 transition-all min-h-[44px]"
              >
                Continue to Practice →
              </button>
            ) : (
              <>
                <button
                  data-testid="ai-lesson-new"
                  type="button"
                  onClick={() => void generateLesson()}
                  className="flex items-center justify-center gap-2 bg-gradient-to-r from-blue-500 to-indigo-500 text-white font-black px-6 py-2.5 rounded-xl border-2 border-black shadow-neo-xs active:translate-y-0.5 transition-all min-h-[44px]"
                >
                  <RotateCcw className="w-4 h-4" aria-hidden="true" /> New Lesson
                </button>
                <button
                  data-testid="ai-lesson-back"
                  type="button"
                  onClick={resetLesson}
                  className="flex items-center justify-center gap-2 bg-white text-gray-700 font-bold px-6 py-2.5 rounded-xl border-2 border-gray-300 hover:bg-gray-50 transition-all min-h-[44px]"
                >
                  Change Topic
                </button>
              </>
            )}
          </div>
        </div>
      </div>
    );
  }

  if (!lesson) return null;

  // ── Lesson steps ──────────────────────────────────────────────────────────

  return (
    <div data-testid="ai-lesson-active" className="space-y-4">
      {/* Progress bar */}
      <div
        className="flex items-center justify-between bg-white border-2 border-black rounded-2xl p-3 shadow-neo-xs"
        role="navigation"
        aria-label="Lesson progress"
      >
        <button
          data-testid="ai-lesson-back-to-menu"
          type="button"
          onClick={onBack || resetLesson}
          className="text-xs font-bold text-gray-500 hover:text-gray-700 transition-all min-h-[44px] px-2"
        >
          ← Back
        </button>
        <div className="flex gap-1.5" aria-hidden="true">
          {STEP_ORDER.map((s, i) => (
            <div
              key={s}
              className={`w-2.5 h-2.5 rounded-full transition-all ${
                i === currentStep
                  ? 'bg-blue-500 scale-125'
                  : i < currentStep
                    ? 'bg-blue-300'
                    : 'bg-gray-200'
              }`}
            />
          ))}
        </div>
        <span className="text-xs font-bold text-gray-400" aria-live="polite">
          {currentStep + 1}/{STEP_ORDER.length}
        </span>
      </div>

      {/* Step card */}
      <div className="bg-white border-2 sm:border-3 border-black rounded-2xl shadow-neo overflow-hidden">
        <div
          className={`bg-gradient-to-r ${stepInfo.color} px-4 py-3 flex items-center gap-2`}
          aria-hidden="true"
        >
          <StepIcon className="w-5 h-5 text-white" />
          <h3 className="font-black text-white text-base">{stepInfo.title}</h3>
        </div>

        <div className="p-4 sm:p-6 space-y-4">
          {/* Step 1: Concept */}
          {step === 'concept' && (
            <div data-testid="ai-lesson-concept" className="space-y-5">
              <div className="text-center space-y-2">
                <span className="text-5xl sm:text-6xl" aria-hidden="true">
                  {lesson.visual.emoji}
                </span>
                <p className="text-xl sm:text-2xl font-black text-indigo-700">
                  {lesson.visual.equation}
                </p>
              </div>
              <div className="flex justify-center">
                <OperationVisual
                  operation={operation}
                  emoji={lesson.visual.emoji}
                  groups={lesson.visual.groups}
                  perGroup={lesson.visual.perGroup}
                  total={lesson.visual.total}
                  equation={lesson.visual.equation}
                />
              </div>
              <p className="text-base sm:text-lg font-medium text-gray-700 leading-relaxed text-center">
                {lesson.concept}
              </p>
            </div>
          )}

          {/* Step 2: Visual */}
          {step === 'visual' && (
            <div data-testid="ai-lesson-visual" className="space-y-4">
              <p className="text-sm font-medium text-gray-600 text-center">
                {lesson.visual.description}
              </p>
              <OperationVisual
                operation={operation}
                emoji={lesson.visual.emoji}
                groups={lesson.visual.groups}
                perGroup={lesson.visual.perGroup}
                total={lesson.visual.total}
                equation={lesson.visual.equation}
              />
              <p className="text-center text-lg sm:text-xl font-black text-gray-800">
                {lesson.visual.equation}
              </p>
            </div>
          )}

          {/* Step 3: Sticky phrase */}
          {step === 'sticky' && (
            <div data-testid="ai-lesson-sticky" className="space-y-4 text-center">
              <div className="bg-gradient-to-r from-amber-50 to-yellow-50 rounded-2xl p-5 sm:p-6 border-2 border-amber-200">
                <Brain className="w-8 h-8 text-amber-500 mx-auto mb-3" aria-hidden="true" />
                <p className="text-lg sm:text-xl font-black text-amber-800 leading-relaxed">
                  &ldquo;{lesson.stickyPhrase}&rdquo;
                </p>
              </div>
              <p className="text-sm font-bold text-gray-500">🗣️ Say it out loud!</p>
            </div>
          )}

          {/* Step 4: Gap check */}
          {step === 'gapCheck' && (
            <div data-testid="ai-lesson-gapcheck" className="space-y-4">
              <div className="text-center">
                <span className="text-4xl sm:text-5xl" aria-hidden="true">
                  {lesson.visual.emoji}
                </span>
              </div>
              <div className="bg-teal-50 rounded-xl p-4 border border-teal-200 text-center">
                <p className="text-base sm:text-lg font-medium text-teal-800 leading-relaxed">
                  {lesson.gapCheck}
                </p>
              </div>
            </div>
          )}

          {/* Step 5: Practice */}
          {step === 'practice' && lesson.practice[practiceIndex] && (
            <div data-testid="ai-lesson-practice">
              <PracticeQuestion
                key={practiceIndex}
                practice={lesson.practice[practiceIndex]!}
                operation={operation}
                index={practiceIndex}
                total={lesson.practice.length}
                onNext={() => {
                  if (practiceIndex < lesson.practice.length - 1) {
                    setPracticeIndex(practiceIndex + 1);
                  } else {
                    setCompleted(true);
                  }
                }}
              />
            </div>
          )}
        </div>
      </div>

      {/* Nav buttons (practice has its own) */}
      {step !== 'practice' && (
        <div className="flex justify-between gap-3">
          <button
            data-testid="ai-lesson-prev"
            type="button"
            onClick={() => setCurrentStep(Math.max(0, currentStep - 1))}
            disabled={currentStep === 0}
            aria-label="Previous step"
            className={`flex items-center gap-1.5 px-4 py-2.5 rounded-xl font-black text-sm border-2 transition-all min-h-[44px] ${
              currentStep === 0
                ? 'bg-gray-100 text-gray-300 border-gray-200'
                : 'bg-white text-gray-700 border-gray-300 hover:border-gray-500 active:translate-y-0.5'
            }`}
          >
            <ChevronLeft className="w-4 h-4" aria-hidden="true" /> Previous
          </button>
          <button
            data-testid="ai-lesson-next"
            type="button"
            onClick={() => setCurrentStep(Math.min(STEP_ORDER.length - 1, currentStep + 1))}
            aria-label="Next step"
            className="flex items-center gap-1.5 px-5 py-2.5 bg-gradient-to-r from-blue-500 to-indigo-500 text-white font-black text-sm rounded-xl border-2 border-black shadow-neo-xs active:translate-y-0.5 transition-all min-h-[44px]"
          >
            Next <ChevronRight className="w-4 h-4" aria-hidden="true" />
          </button>
        </div>
      )}
    </div>
  );
}
