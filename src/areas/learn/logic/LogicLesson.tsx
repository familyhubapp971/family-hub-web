// FHS-395: Logic Lesson: fetches questions from /api/kid/logic/questions,
// renders the appropriate game UI per question type, submits answers to
// /api/kid/logic/answer, tracks combo progress, and shows a certificate
// overlay when certificateEarned is true.
//
// Auth: Bearer kidToken on all calls.
// Double-tap guard: useRef answerFiredRef, reset per question.
// Unmount guard: isMountedRef gates every setState after async POST.
// Logic subject is kid-only: ChildWorldPage (parent mode) has no Learn tab.

import { useState, useEffect, useCallback, useRef } from 'react';
import { API_BASE } from '../../../app/lib/api';
import { type GameType, type Difficulty, GAME_TYPE_META, DIFFICULTY_META } from './LogicSubject';
import { useBodyScrollLock } from '@familyhub/ui';

// ─── Types ────────────────────────────────────────────────────────────────────

interface LogicLessonProps {
  kidToken: string;
  gameType: GameType;
}

// Client-side question shapes (answer stripped by the server)
interface BaseFetchedQuestion {
  id: string;
  type: GameType;
}
interface TrueFalseFetched extends BaseFetchedQuestion {
  type: 'truefalse';
  statement: string;
}
interface PatternFetched extends BaseFetchedQuestion {
  type: 'patterns';
  sequence: string[];
  choices: string[];
}
interface OddOneOutFetched extends BaseFetchedQuestion {
  type: 'oddoneout';
  items: string[];
}
interface IfThenFetched extends BaseFetchedQuestion {
  type: 'ifthen';
  premise: string;
  hint: string;
  choices: string[];
}
interface SortingFetched extends BaseFetchedQuestion {
  type: 'sorting';
  item: string;
  groups: string[];
}

type FetchedQuestion =
  | TrueFalseFetched
  | PatternFetched
  | OddOneOutFetched
  | IfThenFetched
  | SortingFetched;

interface AnswerResponse {
  correct: boolean;
  correctAnswer: string | boolean;
  explanation: string;
  comboCorrect: number;
  certificateEarned: boolean;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const DIFFICULTIES: Difficulty[] = ['easy', 'medium', 'hard'];
const CERTIFICATE_THRESHOLD = 10;

const STREAK_MESSAGES: Record<number, string> = {
  3: 'On fire!',
  5: 'Super Star!',
  10: 'Logic Wizard!',
  15: 'Unstoppable!',
  20: 'Legendary!',
};

const CELEBRATION_EMOJIS = ['🌟', '🎉', '🎊', '✨', '💫', '🌈', '🤩'];
const ENCOURAGEMENT = ['Try again!', 'Almost!', 'Keep going!', "Don't give up!"];
const CONFETTI_EMOJIS = ['🌟', '🎉', '🎊', '✨', '🏆', '🥇', '🎖️', '💫', '🌈'];

// ─── Helpers ──────────────────────────────────────────────────────────────────

function pickRandom<T>(arr: T[]): T {
  return (arr[Math.floor(Math.random() * arr.length)] as T | undefined) ?? arr[0]!;
}

function nextDifficulty(d: Difficulty): Difficulty | null {
  const idx = DIFFICULTIES.indexOf(d);
  if (idx < DIFFICULTIES.length - 1) {
    return (DIFFICULTIES[idx + 1] as Difficulty | undefined) ?? null;
  }
  return null;
}

// ─── Celebration overlay ──────────────────────────────────────────────────────

function CelebrationOverlay({ message }: { message: string }) {
  return (
    <div
      className="fixed inset-0 z-50 pointer-events-none flex items-center justify-center"
      aria-live="assertive"
    >
      <div className="motion-safe:animate-bounce text-center">
        <div className="text-4xl sm:text-6xl font-black text-transparent bg-clip-text bg-gradient-to-r from-violet-400 via-pink-500 to-purple-500 drop-shadow-lg">
          {message}
        </div>
        <div className="flex justify-center gap-2 mt-2">
          {CELEBRATION_EMOJIS.map((e, i) => (
            <span
              key={i}
              className="text-2xl sm:text-3xl motion-safe:animate-pulse"
              style={{ animationDelay: `${i * 100}ms` }}
              aria-hidden="true"
            >
              {e}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}

// ─── Certificate overlay ──────────────────────────────────────────────────────
// Fix #1b: autoFocus on dismiss button so Escape → onKeyDown on dialog fires.
// Fix #5: onDismiss runs at most once; manual dismiss cancels the 6s auto-timer.

function CertificateOverlay({
  gameType,
  difficulty,
  onDismiss,
}: {
  gameType: GameType;
  difficulty: Difficulty;
  onDismiss: () => void;
}) {
  const dismissedRef = useRef(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const dismissBtnRef = useRef<HTMLButtonElement>(null);

  const safeOnDismiss = useCallback(() => {
    if (dismissedRef.current) return;
    dismissedRef.current = true;
    if (timerRef.current !== null) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    onDismiss();
  }, [onDismiss]);

  // Auto-dismiss after 6s; cancel on manual dismiss.
  useEffect(() => {
    timerRef.current = setTimeout(safeOnDismiss, 6000);
    return () => {
      if (timerRef.current !== null) clearTimeout(timerRef.current);
    };
  }, [safeOnDismiss]);

  // Focus the dismiss button when the overlay opens (Fix #1b).
  useEffect(() => {
    dismissBtnRef.current?.focus();
  }, []);

  const meta = GAME_TYPE_META[gameType];
  const diffLabel = DIFFICULTY_META[difficulty].label;
  const today = new Date().toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });

  return (
    // Fix #1b: Escape on the dialog container closes the overlay.
    <div
      data-testid="logic-certificate-overlay"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-label="Certificate earned"
    >
      {/* Backdrop button: click outside to dismiss */}
      <button
        type="button"
        aria-label="Close certificate"
        onClick={safeOnDismiss}
        className="absolute inset-0 w-full h-full cursor-default"
        tabIndex={-1}
      />

      {/* Confetti */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        {CONFETTI_EMOJIS.map((e, i) => (
          <span
            key={i}
            className="absolute text-2xl sm:text-3xl cert-confetti"
            style={{ left: `${10 + ((i * 10) % 80)}%`, animationDelay: `${i * 200}ms` }}
            aria-hidden="true"
          >
            {e}
          </span>
        ))}
      </div>

      <div className="relative z-10 cert-pop mx-4 max-w-md w-full bg-gradient-to-br from-violet-50 via-white to-purple-50 border-[3px] border-black rounded-2xl shadow-neo-lg overflow-hidden">
        <div className="bg-gradient-to-r from-violet-400 via-purple-400 to-violet-500 px-6 py-4 border-b-[3px] border-black text-center cert-shine">
          <p className="text-xs font-bold text-purple-100 uppercase tracking-[0.3em]">
            Certificate of Achievement
          </p>
        </div>

        <div className="px-6 py-6 text-center space-y-4">
          <div className="text-5xl sm:text-6xl cert-wiggle inline-block" aria-hidden="true">
            🧠
          </div>

          <div className="bg-white border-2 border-black rounded-xl p-4 shadow-neo-xs">
            <div className="flex items-center justify-center gap-3">
              <span className="text-3xl" aria-hidden="true">
                {meta.emoji}
              </span>
              <div className="text-left">
                <p className="text-lg font-black text-gray-900">{meta.label}</p>
                <p className="text-sm font-bold text-purple-600">{diffLabel} Level</p>
              </div>
            </div>
          </div>

          <p className="text-sm font-bold text-gray-500">
            Answered {CERTIFICATE_THRESHOLD} questions correctly!
          </p>
          <p className="text-xs font-bold text-gray-400">{today}</p>

          <div className="flex justify-center gap-1" aria-hidden="true">
            {Array.from({ length: 5 }).map((_, i) => (
              <span
                key={i}
                className="text-xl motion-safe:animate-pulse"
                style={{ animationDelay: `${i * 150}ms` }}
              >
                ⭐
              </span>
            ))}
          </div>

          <button
            ref={dismissBtnRef}
            data-testid="logic-cert-dismiss"
            type="button"
            onClick={safeOnDismiss}
            onKeyDown={(e) => e.key === 'Escape' && safeOnDismiss()}
            className="bg-gradient-to-r from-violet-400 to-purple-500 text-white font-black px-8 py-3 rounded-xl border-2 border-black shadow-neo-sm motion-safe:hover:shadow-neo-xs active:translate-y-0.5 transition-all text-sm sm:text-base min-h-[44px]"
          >
            Awesome! 🎉
          </button>
        </div>
      </div>

      <style>{`
        @keyframes certPop {
          0% { transform: scale(0) rotate(-8deg); opacity: 0; }
          40% { transform: scale(1.1) rotate(2deg); opacity: 1; }
          60% { transform: scale(0.95) rotate(-1deg); }
          80% { transform: scale(1.03) rotate(0.5deg); }
          100% { transform: scale(1) rotate(0deg); opacity: 1; }
        }
        .cert-pop { animation: certPop 0.7s cubic-bezier(0.34, 1.56, 0.64, 1) forwards; }
        @keyframes certShine {
          0% { background-position: -200% center; }
          100% { background-position: 200% center; }
        }
        .cert-shine { background-size: 200% 100%; animation: certShine 3s linear infinite; }
        @keyframes certWiggle {
          0%, 100% { transform: rotate(-3deg) scale(1); }
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
        @keyframes shake {
          0%, 100% { transform: translateX(0); }
          25% { transform: translateX(-6px); }
          75% { transform: translateX(6px); }
        }
        .animate-shake { animation: shake 0.4s ease-in-out; }
      `}</style>
    </div>
  );
}

// ─── Game-type specific renderers ─────────────────────────────────────────────

function TrueFalseGame({
  question,
  onAnswer,
  answered,
  correctAnswer,
  isCorrect,
  explanation,
}: {
  question: TrueFalseFetched;
  onAnswer: (answer: boolean) => void;
  answered: boolean;
  correctAnswer: boolean | null;
  isCorrect: boolean | null;
  explanation: string | null;
}) {
  return (
    <div className="space-y-4">
      <div className="bg-white border-2 sm:border-[3px] border-black rounded-2xl p-4 sm:p-6 shadow-neo">
        <p className="text-center text-base sm:text-lg font-black text-gray-900">
          {question.statement}
        </p>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:gap-4">
        <button
          data-testid="logic-choice-true"
          type="button"
          onClick={() => onAnswer(true)}
          disabled={answered}
          className={`min-h-[44px] py-5 sm:py-6 rounded-2xl border-2 sm:border-[3px] font-black text-xl sm:text-2xl transition-all shadow-neo-xs ${
            answered
              ? correctAnswer === true
                ? 'bg-green-400 border-green-600 text-white scale-105'
                : 'bg-gray-100 border-gray-200 text-gray-400'
              : 'bg-green-50 border-green-300 text-green-700 motion-safe:hover:bg-green-100 active:translate-y-1'
          }`}
        >
          ✅ True
        </button>
        <button
          data-testid="logic-choice-false"
          type="button"
          onClick={() => onAnswer(false)}
          disabled={answered}
          className={`min-h-[44px] py-5 sm:py-6 rounded-2xl border-2 sm:border-[3px] font-black text-xl sm:text-2xl transition-all shadow-neo-xs ${
            answered
              ? correctAnswer === false
                ? 'bg-green-400 border-green-600 text-white scale-105'
                : 'bg-gray-100 border-gray-200 text-gray-400'
              : 'bg-red-50 border-red-300 text-red-700 motion-safe:hover:bg-red-100 active:translate-y-1'
          }`}
        >
          ❌ False
        </button>
      </div>

      {answered && explanation && (
        <div
          className={`border-2 border-black rounded-2xl p-4 text-center shadow-neo-xs ${
            isCorrect ? 'bg-green-100' : 'bg-orange-50'
          }`}
        >
          <p className="text-sm font-bold text-gray-700">{explanation}</p>
        </div>
      )}
    </div>
  );
}

function PatternGame({
  question,
  onAnswer,
  answered,
  selected,
  correctAnswer,
  isCorrect,
  explanation,
}: {
  question: PatternFetched;
  onAnswer: (choice: string) => void;
  answered: boolean;
  selected: string | null;
  correctAnswer: string | null;
  isCorrect: boolean | null;
  explanation: string | null;
}) {
  return (
    <div className="space-y-4">
      {/* Sequence */}
      <div className="bg-white border-2 sm:border-[3px] border-black rounded-2xl p-4 sm:p-6 shadow-neo">
        <div className="flex items-center justify-center gap-2 sm:gap-3 flex-wrap">
          {question.sequence.map((item, i) => (
            <div
              key={i}
              className={`w-12 h-12 sm:w-16 sm:h-16 rounded-xl border-2 flex items-center justify-center font-black text-lg sm:text-2xl ${
                item === '?'
                  ? 'border-dashed border-purple-400 bg-purple-50 text-purple-500 motion-safe:animate-pulse'
                  : 'border-gray-300 bg-gray-50 text-gray-800'
              }`}
            >
              {item}
            </div>
          ))}
        </div>
      </div>

      {/* Choices */}
      <div className="grid grid-cols-2 gap-3 sm:gap-4">
        {question.choices.map((choice, i) => {
          const isSelected = selected === choice;
          const isAnswer = answered && choice === correctAnswer;
          let btnClass =
            'bg-white border-gray-200 text-gray-900 motion-safe:hover:border-purple-300 motion-safe:hover:bg-purple-50 active:translate-y-1';
          if (answered) {
            if (isAnswer) btnClass = 'bg-green-400 border-green-600 text-white scale-105';
            else if (isSelected && !isCorrect)
              btnClass = 'bg-red-400 border-red-600 text-white animate-shake';
            else btnClass = 'bg-gray-100 border-gray-200 text-gray-400';
          }
          return (
            <button
              key={i}
              data-testid={`logic-choice-${i}`}
              type="button"
              onClick={() => onAnswer(choice)}
              disabled={answered}
              className={`min-h-[44px] py-5 sm:py-6 rounded-2xl border-2 sm:border-[3px] font-black text-xl sm:text-2xl transition-all shadow-neo-xs ${btnClass}`}
            >
              {choice}
            </button>
          );
        })}
      </div>

      {answered && explanation && (
        <div
          className={`border-2 border-black rounded-2xl p-4 text-center shadow-neo-xs ${
            isCorrect ? 'bg-green-100' : 'bg-orange-50'
          }`}
        >
          <p className="text-sm font-bold text-gray-700">{explanation}</p>
        </div>
      )}
    </div>
  );
}

function OddOneOutGame({
  question,
  onAnswer,
  answered,
  selected,
  correctAnswer,
  isCorrect,
  explanation,
}: {
  question: OddOneOutFetched;
  onAnswer: (item: string) => void;
  answered: boolean;
  selected: string | null;
  correctAnswer: string | null;
  isCorrect: boolean | null;
  explanation: string | null;
}) {
  return (
    <div className="space-y-4">
      <div className="bg-white border-2 sm:border-[3px] border-black rounded-2xl p-4 sm:p-6 shadow-neo">
        <p className="text-center text-sm sm:text-base font-bold text-gray-600 mb-4">
          Tap the one that doesn&apos;t belong!
        </p>
        <div className="grid grid-cols-2 gap-3 sm:gap-4">
          {question.items.map((item, i) => {
            const isSelected = selected === item;
            const isAnswer = answered && item === correctAnswer;
            let btnClass =
              'bg-gray-50 border-gray-200 text-gray-900 motion-safe:hover:border-purple-300 motion-safe:hover:bg-purple-50 active:translate-y-1';
            if (answered) {
              if (isAnswer) btnClass = 'bg-green-400 border-green-600 text-white scale-105';
              else if (isSelected && !isCorrect)
                btnClass = 'bg-red-400 border-red-600 text-white animate-shake';
              else btnClass = 'bg-gray-100 border-gray-200 text-gray-400';
            }
            return (
              <button
                key={i}
                data-testid={`logic-choice-${i}`}
                type="button"
                onClick={() => onAnswer(item)}
                disabled={answered}
                className={`min-h-[44px] py-6 sm:py-8 rounded-2xl border-2 sm:border-[3px] font-black text-2xl sm:text-3xl transition-all shadow-neo-xs ${btnClass}`}
              >
                {item}
              </button>
            );
          })}
        </div>
      </div>

      {answered && explanation && (
        <div
          className={`border-2 border-black rounded-2xl p-4 text-center shadow-neo-xs ${
            isCorrect ? 'bg-green-100' : 'bg-orange-50'
          }`}
        >
          <p className="text-sm font-bold text-gray-700">{explanation}</p>
        </div>
      )}
    </div>
  );
}

// Fix #1: Escape on the dialog container closes the lightbox.
// The close button receives autoFocus so keyboard users can tab/Escape.
function IfThenGame({
  question,
  onAnswer,
  answered,
  selected,
  correctAnswer,
  isCorrect,
  explanation,
}: {
  question: IfThenFetched;
  onAnswer: (choice: string) => void;
  answered: boolean;
  selected: string | null;
  correctAnswer: string | null;
  isCorrect: boolean | null;
  explanation: string | null;
}) {
  const [showHint, setShowHint] = useState(false);
  // Lock body scroll while the hint lightbox is open (FHS-412).
  useBodyScrollLock(showHint);

  return (
    <div className="space-y-4">
      {/* Hint lightbox: Fix #1: Escape on role="dialog" div + autoFocus close btn */}
      {showHint && (
        <div
          data-testid="logic-clue-lightbox"
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ background: 'rgba(0,0,0,0.82)', backdropFilter: 'blur(6px)' }}
          role="dialog"
          aria-modal="true"
          aria-label="Hint"
        >
          {/* Backdrop: click outside to dismiss */}
          <button
            type="button"
            aria-label="Close hint"
            onClick={() => setShowHint(false)}
            className="absolute inset-0 w-full h-full cursor-default"
            tabIndex={-1}
          />
          <div className="relative z-10 bg-white border-2 sm:border-[3px] border-black rounded-2xl shadow-neo-lg max-w-md w-full">
            <div className="flex items-center justify-between px-6 py-4 border-b-2 border-gray-100">
              <div className="flex items-center gap-2">
                <span className="text-xl" aria-hidden="true">
                  🔗
                </span>
                <h2 className="text-lg font-black uppercase text-purple-600">Clue</h2>
              </div>
              <button
                // autoFocus so Escape works when keyboard focus lands on this button
                // eslint-disable-next-line jsx-a11y/no-autofocus
                autoFocus
                data-testid="logic-clue-lightbox-close"
                type="button"
                onClick={() => setShowHint(false)}
                onKeyDown={(e) => e.key === 'Escape' && setShowHint(false)}
                aria-label="Close hint"
                className="w-11 h-11 flex items-center justify-center bg-gray-100 motion-safe:hover:bg-red-100 motion-safe:hover:text-red-600 rounded-xl transition-colors text-gray-500"
              >
                ✕
              </button>
            </div>
            <div className="p-6">
              <p className="text-center text-lg sm:text-xl font-black text-gray-900 leading-relaxed">
                {question.hint}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Premise */}
      <div className="bg-gradient-to-br from-purple-50 to-pink-50 border-2 sm:border-[3px] border-black rounded-2xl p-4 sm:p-6 shadow-neo">
        <p className="text-center text-base sm:text-lg font-black text-gray-900 leading-relaxed">
          {question.premise}
        </p>
      </div>

      {/* Hint button */}
      <button
        data-testid="logic-clue-btn"
        type="button"
        onClick={() => setShowHint(true)}
        className="w-full min-h-[44px] text-center py-2 px-4 rounded-xl bg-purple-100 motion-safe:hover:bg-purple-200 border border-purple-300 transition-all"
      >
        <span className="text-xs font-bold text-purple-600 uppercase tracking-wider flex items-center gap-1 justify-center">
          💡 Hint <span className="text-[10px] text-purple-400">(tap for help)</span>
        </span>
      </button>

      {/* Choices */}
      <div className="grid grid-cols-1 gap-2 sm:gap-3">
        {question.choices.map((choice, i) => {
          const isSelected = selected === choice;
          const isAnswer = answered && choice === correctAnswer;
          let btnClass =
            'bg-white border-gray-200 text-gray-900 motion-safe:hover:border-purple-300 motion-safe:hover:bg-purple-50 active:translate-y-1';
          if (answered) {
            if (isAnswer) btnClass = 'bg-green-400 border-green-600 text-white scale-[1.02]';
            else if (isSelected && !isCorrect)
              btnClass = 'bg-red-400 border-red-600 text-white animate-shake';
            else btnClass = 'bg-gray-100 border-gray-200 text-gray-400';
          }
          return (
            <button
              key={i}
              data-testid={`logic-choice-${i}`}
              type="button"
              onClick={() => onAnswer(choice)}
              disabled={answered}
              className={`min-h-[44px] py-3.5 sm:py-4 rounded-2xl border-2 sm:border-[3px] font-bold text-sm sm:text-base transition-all shadow-neo-xs px-4 ${btnClass}`}
            >
              {choice}
            </button>
          );
        })}
      </div>

      {answered && explanation && (
        <div
          className={`border-2 border-black rounded-2xl p-4 text-center shadow-neo-xs ${
            isCorrect ? 'bg-green-100' : 'bg-orange-50'
          }`}
        >
          <p className="text-sm font-bold text-gray-700">{explanation}</p>
        </div>
      )}
    </div>
  );
}

// Fix #4: track selected group so only the tapped wrong group goes red;
// all other non-correct groups stay neutral (bg-gray-100), mirroring PatternGame.
function SortingGame({
  question,
  onAnswer,
  answered,
  selected,
  correctAnswer,
  isCorrect,
  explanation,
}: {
  question: SortingFetched;
  onAnswer: (group: string) => void;
  answered: boolean;
  selected: string | null;
  correctAnswer: string | null;
  isCorrect: boolean | null;
  explanation: string | null;
}) {
  return (
    <div className="space-y-4">
      {/* Item card */}
      <div className="bg-white border-2 sm:border-[3px] border-black rounded-2xl p-4 sm:p-6 shadow-neo text-center">
        <p className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">
          📦 Sort this item
        </p>
        <p className="text-3xl sm:text-4xl font-black text-gray-900">{question.item}</p>
      </div>

      {/* Group buttons */}
      <div className="grid grid-cols-2 gap-3 sm:gap-4">
        {question.groups.map((group, i) => {
          const isSelected = selected === group;
          const isAnswer = answered && group === correctAnswer;
          let btnClass =
            'bg-white border-gray-200 text-gray-900 motion-safe:hover:border-purple-300 motion-safe:hover:bg-purple-50 active:translate-y-1';
          if (answered) {
            if (isAnswer) btnClass = 'bg-green-400 border-green-600 text-white scale-105';
            else if (isSelected && !isCorrect)
              btnClass = 'bg-red-400 border-red-600 text-white animate-shake';
            else btnClass = 'bg-gray-100 border-gray-200 text-gray-400';
          }
          return (
            <button
              key={i}
              data-testid={`logic-choice-${i}`}
              type="button"
              onClick={() => onAnswer(group)}
              disabled={answered}
              className={`min-h-[44px] py-5 sm:py-6 rounded-2xl border-2 sm:border-[3px] font-black text-sm sm:text-base transition-all shadow-neo-xs px-3 ${btnClass}`}
            >
              {group}
            </button>
          );
        })}
      </div>

      {answered && explanation && (
        <div
          className={`border-2 border-black rounded-2xl p-4 text-center shadow-neo-xs ${
            isCorrect ? 'bg-green-100' : 'bg-orange-50'
          }`}
        >
          <p className="text-sm font-bold text-gray-700">{explanation}</p>
        </div>
      )}
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export function LogicLesson({ kidToken, gameType }: LogicLessonProps) {
  const [difficulty, setDifficulty] = useState<Difficulty>('easy');
  const [questions, setQuestions] = useState<FetchedQuestion[]>([]);
  const [questionIndex, setQuestionIndex] = useState(0);
  const [loading, setLoading] = useState(true);
  // Fix #3: error state for failed fetches
  const [fetchError, setFetchError] = useState(false);

  // Answer state
  const [answered, setAnswered] = useState(false);
  const [selected, setSelected] = useState<string | null>(null);
  const [isCorrect, setIsCorrect] = useState<boolean | null>(null);
  const [correctAnswer, setCorrectAnswer] = useState<string | boolean | null>(null);
  const [explanation, setExplanation] = useState<string | null>(null);
  const [comboCorrect, setComboCorrect] = useState(0);
  const [showCertificate, setShowCertificate] = useState(false);

  // Score tracking
  const [streak, setStreak] = useState(0);
  const [bestStreak, setBestStreak] = useState(0);
  const [totalCorrect, setTotalCorrect] = useState(0);
  const [totalAttempted, setTotalAttempted] = useState(0);
  const [celebrationMsg, setCelebrationMsg] = useState<string | null>(null);

  // Double-tap guard: reset each time a new question is shown
  const answerFiredRef = useRef(false);
  // Fire-once: certificate overlay shown once per award
  const certShownRef = useRef<Set<string>>(new Set());
  // Fix #2: unmount guard: gates every setState after async POST
  const isMountedRef = useRef(true);

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  // ── Fetch questions ──────────────────────────────────────────────────────────

  const fetchQuestions = useCallback(
    async (gt: GameType, diff: Difficulty, signal?: AbortSignal) => {
      setLoading(true);
      setFetchError(false);
      try {
        const res = await fetch(
          `${API_BASE}/api/kid/logic/questions?gameType=${gt}&difficulty=${diff}`,
          { headers: { Authorization: `Bearer ${kidToken}` }, signal: signal ?? null },
        );
        // Fix #3: on non-ok response, surface the error state
        if (!res.ok) {
          if (isMountedRef.current) setFetchError(true);
          return;
        }
        const data = (await res.json()) as { questions: FetchedQuestion[] };
        const qs = data.questions ?? [];
        const shuffled = [...qs].sort(() => Math.random() - 0.5);
        if (isMountedRef.current) {
          setQuestions(shuffled);
          setQuestionIndex(0);
          answerFiredRef.current = false;
          setAnswered(false);
          setSelected(null);
          setIsCorrect(null);
          setCorrectAnswer(null);
          setExplanation(null);
        }
      } catch (err) {
        if (err instanceof Error && err.name === 'AbortError') return;
        // Fix #3: non-abort throw → error state
        if (isMountedRef.current) setFetchError(true);
      } finally {
        if (isMountedRef.current) setLoading(false);
      }
    },
    [kidToken],
  );

  useEffect(() => {
    const ac = new AbortController();
    void fetchQuestions(gameType, difficulty, ac.signal);
    return () => ac.abort();
  }, [gameType, difficulty, fetchQuestions]);

  // ── Submit answer ──────────────────────────────────────────────────────────
  // Fix #2: isMountedRef gates all setState calls after the await.
  // Fix #6: functional setStreak/setBestStreak; drop streak/bestStreak from deps.

  const handleAnswer = useCallback(
    async (answerValue: string | boolean) => {
      if (answerFiredRef.current || answered) return;
      answerFiredRef.current = true;

      const currentQ = questions[questionIndex];
      if (!currentQ) return;

      if (typeof answerValue === 'string' && isMountedRef.current) setSelected(answerValue);
      if (isMountedRef.current) setTotalAttempted((n) => n + 1);

      try {
        const res = await fetch(`${API_BASE}/api/kid/logic/answer`, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${kidToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            gameType,
            difficulty,
            questionId: currentQ.id,
            answer: answerValue,
          }),
        });

        if (!isMountedRef.current) return;

        if (!res.ok) {
          setAnswered(true);
          return;
        }

        const data = (await res.json()) as AnswerResponse;

        if (!isMountedRef.current) return;

        setAnswered(true);
        setIsCorrect(data.correct);
        setCorrectAnswer(data.correctAnswer);
        setExplanation(data.explanation);
        setComboCorrect(data.comboCorrect);

        if (data.correct) {
          setTotalCorrect((n) => n + 1);
          // Fix #6: functional updates: no stale closure on streak/bestStreak
          setStreak((s) => {
            const next = s + 1;
            setBestStreak((b) => Math.max(b, next));
            const msg = STREAK_MESSAGES[next];
            if (msg && isMountedRef.current) setCelebrationMsg(msg);
            return next;
          });
        } else {
          setStreak(0);
        }

        if (data.certificateEarned) {
          const certKey = `${gameType}-${difficulty}`;
          if (!certShownRef.current.has(certKey)) {
            certShownRef.current.add(certKey);
            setShowCertificate(true);
          }
        }
      } catch {
        if (isMountedRef.current) setAnswered(true);
      }
    },
    // Fix #6: streak and bestStreak removed from deps: functional updates only
    [answered, questions, questionIndex, gameType, difficulty, kidToken],
  );

  // ── Next question ──────────────────────────────────────────────────────────

  const handleNext = useCallback(() => {
    setCelebrationMsg(null);
    answerFiredRef.current = false;
    setAnswered(false);
    setSelected(null);
    setIsCorrect(null);
    setCorrectAnswer(null);
    setExplanation(null);
    setQuestionIndex((i) => {
      const next = i + 1;
      return next < questions.length ? next : 0;
    });
  }, [questions.length]);

  // ── Difficulty change ──────────────────────────────────────────────────────

  const changeDifficulty = useCallback((diff: Difficulty) => {
    setDifficulty(diff);
    setComboCorrect(0);
  }, []);

  // Lock body scroll while the certificate overlay is open (FHS-412).
  useBodyScrollLock(showCertificate);

  // ── Clear celebration after 2s ─────────────────────────────────────────────

  useEffect(() => {
    if (!celebrationMsg) return;
    const t = setTimeout(() => setCelebrationMsg(null), 2000);
    return () => clearTimeout(t);
  }, [celebrationMsg]);

  // ─── Render ───────────────────────────────────────────────────────────────

  const question = questions[questionIndex];
  const hasCert = certShownRef.current.has(`${gameType}-${difficulty}`);
  const progressPct = Math.min((comboCorrect / CERTIFICATE_THRESHOLD) * 100, 100);

  return (
    <div data-testid="logic-lesson" className="space-y-4 sm:space-y-6">
      {celebrationMsg && <CelebrationOverlay message={celebrationMsg} />}
      {showCertificate && (
        <CertificateOverlay
          gameType={gameType}
          difficulty={difficulty}
          onDismiss={() => {
            setShowCertificate(false);
            const next = nextDifficulty(difficulty);
            if (next) {
              setDifficulty(next);
              setComboCorrect(0);
            }
          }}
        />
      )}

      {/* Difficulty selector */}
      <div
        data-testid="logic-difficulty-selector"
        className="flex gap-2 sm:gap-3 justify-center"
        role="group"
        aria-label="Select difficulty"
      >
        {DIFFICULTIES.map((d) => {
          const meta = DIFFICULTY_META[d];
          return (
            <button
              key={d}
              data-testid={`logic-diff-${d}`}
              type="button"
              aria-pressed={difficulty === d}
              onClick={() => changeDifficulty(d)}
              className={`min-h-[44px] px-4 sm:px-5 py-2 sm:py-2.5 rounded-xl border-2 font-black text-xs sm:text-sm transition-all ${
                difficulty === d
                  ? `bg-gradient-to-r ${meta.color} ${d === 'medium' ? 'text-black' : 'text-white'} border-black shadow-neo-xs`
                  : 'bg-white border-gray-200 text-gray-500 motion-safe:hover:border-gray-300'
              }`}
            >
              {meta.label}
            </button>
          );
        })}
      </div>

      {/* Score bar */}
      <div
        data-testid="logic-score-bar"
        className="bg-white/80 backdrop-blur-sm border-2 border-black rounded-2xl px-4 sm:px-6 py-3 sm:py-4 flex items-center justify-between shadow-neo"
      >
        <div className="flex items-center gap-1.5">
          <span className="text-lg sm:text-xl" aria-hidden="true">
            {streak >= 3 ? '🔥' : '⭐'}
          </span>
          <div>
            <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Streak</p>
            <p data-testid="logic-streak" className="text-lg sm:text-xl font-black text-gray-900">
              {streak}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="text-lg sm:text-xl" aria-hidden="true">
            🏆
          </span>
          <div>
            <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Best</p>
            <p
              data-testid="logic-best-streak"
              className="text-lg sm:text-xl font-black text-gray-900"
            >
              {bestStreak}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="text-lg sm:text-xl" aria-hidden="true">
            ✅
          </span>
          <div>
            <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Score</p>
            <p data-testid="logic-score" className="text-lg sm:text-xl font-black text-gray-900">
              {totalCorrect}/{totalAttempted}
            </p>
          </div>
        </div>
      </div>

      {/* Certificate progress bar */}
      <div
        data-testid="logic-cert-progress"
        className="bg-white/80 backdrop-blur-sm border-2 border-black rounded-2xl px-4 sm:px-6 py-3 shadow-neo-xs"
      >
        <div className="flex items-center justify-between mb-1.5">
          <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">
            {hasCert
              ? '🏅 Certificate Earned!'
              : `🏅 Certificate: ${comboCorrect}/${CERTIFICATE_THRESHOLD}`}
          </p>
          <p className="text-[10px] font-bold text-gray-400">
            {GAME_TYPE_META[gameType].label} {DIFFICULTY_META[difficulty].label}
          </p>
        </div>
        <div className="w-full h-2.5 bg-gray-200 rounded-full overflow-hidden border border-gray-300">
          <div
            className={`h-full rounded-full transition-all duration-500 ${
              hasCert
                ? 'bg-gradient-to-r from-yellow-400 to-amber-500'
                : 'bg-gradient-to-r from-violet-400 to-purple-500'
            }`}
            style={{ width: `${progressPct}%` }}
          />
        </div>
      </div>

      {/* Loading state */}
      {loading && (
        <div className="flex items-center justify-center py-12">
          <div
            className="text-4xl motion-safe:animate-pulse"
            aria-busy="true"
            aria-label="Loading questions"
          >
            🧠
          </div>
        </div>
      )}

      {/* Fix #3: Error / retry card */}
      {!loading && fetchError && (
        <div
          data-testid="logic-error-retry"
          className="bg-white border-2 border-black rounded-2xl p-6 text-center shadow-neo-sm space-y-4"
        >
          <p className="text-2xl" aria-hidden="true">
            😬
          </p>
          <p className="font-black text-gray-900 text-sm sm:text-base">
            Couldn&apos;t load questions
          </p>
          <button
            data-testid="logic-retry-btn"
            type="button"
            onClick={() => void fetchQuestions(gameType, difficulty)}
            className="min-h-[44px] bg-violet-500 text-white font-black px-6 py-2.5 rounded-xl border-2 border-black shadow-neo-xs active:translate-y-0.5 transition-all text-sm"
          >
            Try again
          </button>
        </div>
      )}

      {/* Game content */}
      {!loading && !fetchError && question && (
        <>
          {question.type === 'truefalse' && (
            <TrueFalseGame
              question={question}
              onAnswer={(v) => void handleAnswer(v)}
              answered={answered}
              correctAnswer={correctAnswer as boolean | null}
              isCorrect={isCorrect}
              explanation={explanation}
            />
          )}
          {question.type === 'patterns' && (
            <PatternGame
              question={question}
              onAnswer={(choice) => void handleAnswer(choice)}
              answered={answered}
              selected={selected}
              correctAnswer={correctAnswer as string | null}
              isCorrect={isCorrect}
              explanation={explanation}
            />
          )}
          {question.type === 'oddoneout' && (
            <OddOneOutGame
              question={question}
              onAnswer={(item) => void handleAnswer(item)}
              answered={answered}
              selected={selected}
              correctAnswer={correctAnswer as string | null}
              isCorrect={isCorrect}
              explanation={explanation}
            />
          )}
          {question.type === 'ifthen' && (
            <IfThenGame
              question={question}
              onAnswer={(choice) => void handleAnswer(choice)}
              answered={answered}
              selected={selected}
              correctAnswer={correctAnswer as string | null}
              isCorrect={isCorrect}
              explanation={explanation}
            />
          )}
          {question.type === 'sorting' && (
            <SortingGame
              question={question}
              onAnswer={(group) => void handleAnswer(group)}
              answered={answered}
              selected={selected}
              correctAnswer={correctAnswer as string | null}
              isCorrect={isCorrect}
              explanation={explanation}
            />
          )}

          {/* Fallback feedback banner when no explanation returned */}
          {answered && !explanation && (
            <div
              className={`border-2 border-black rounded-2xl p-4 text-center shadow-neo-xs ${
                isCorrect ? 'bg-green-100' : 'bg-orange-50'
              }`}
            >
              <p className="text-sm font-bold text-gray-700">
                {isCorrect ? '🎉 Correct!' : pickRandom(ENCOURAGEMENT)}
              </p>
            </div>
          )}
        </>
      )}

      {/* Next button */}
      {!loading && !fetchError && answered && (
        <div className="flex justify-center">
          <button
            data-testid="logic-next-btn"
            type="button"
            onClick={handleNext}
            className="min-h-[44px] bg-black text-purple-400 font-black px-8 py-3 rounded-xl border-2 border-black motion-safe:hover:bg-gray-900 active:translate-y-0.5 transition-all text-sm sm:text-base"
          >
            Next Question →
          </button>
        </div>
      )}
    </div>
  );
}
