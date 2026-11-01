// FHS-394: Between-stage celebration / transition screen.
// Ported from legacy MathsStageComplete.tsx.

import { type Operation, type TableNumber, getTableLabel } from './maths-utils';

interface MathsStageCompleteProps {
  operation: Operation;
  tableNumber: TableNumber;
  completedStage: 'learn' | 'practice' | 'prove';
  /** For practice stage: how many correct */
  practiceCorrect?: number;
  /** For prove stage: score and avg time */
  proveScore?: number;
  proveAvgTime?: number;
  /** Whether prove was passed (score >= 10 && avgTime <= 5) */
  provePassed?: boolean;
  onContinue: () => void;
  onBackToJourney: () => void;
}

const STAGE_CONFIG = {
  learn: {
    emoji: '📖',
    title: 'Lesson Complete!',
    nextStage: 'Practice',
    nextEmoji: '🎯',
    color: 'from-blue-500 to-cyan-500',
    bgColor: 'bg-blue-50',
    borderColor: 'border-blue-200',
  },
  practice: {
    emoji: '🎯',
    title: 'Practice Complete!',
    nextStage: 'Prove It',
    nextEmoji: '⚡',
    color: 'from-green-500 to-emerald-500',
    bgColor: 'bg-green-50',
    borderColor: 'border-green-200',
  },
  prove: {
    emoji: '⚡',
    title: 'Challenge Complete!',
    nextStage: null,
    nextEmoji: '🏆',
    color: 'from-purple-500 to-pink-500',
    bgColor: 'bg-purple-50',
    borderColor: 'border-purple-200',
  },
} as const;

export function MathsStageComplete({
  operation,
  tableNumber,
  completedStage,
  practiceCorrect,
  proveScore,
  proveAvgTime,
  provePassed,
  onContinue,
  onBackToJourney,
}: MathsStageCompleteProps) {
  const config = STAGE_CONFIG[completedStage];
  const tableLabel = getTableLabel(operation, tableNumber);

  return (
    <div data-testid="stage-complete" className="space-y-4">
      <div className="bg-white border-2 sm:border-[3px] border-black rounded-2xl p-6 sm:p-8 shadow-neo text-center space-y-5">
        {/* Celebration emoji */}
        <div className="text-6xl motion-safe:animate-bounce" aria-hidden="true">
          {completedStage === 'prove' && provePassed ? '🏆' : config.emoji}
        </div>

        {/* Title */}
        <div>
          <h3 className="font-black text-xl sm:text-2xl text-gray-900">{config.title}</h3>
          <p className="text-sm font-bold text-gray-400 mt-1">{tableLabel}</p>
        </div>

        {/* Stage-specific details */}
        {completedStage === 'learn' && (
          <div
            className={`${config.bgColor} border-2 ${config.borderColor} rounded-xl p-4 max-w-xs mx-auto`}
          >
            <p className="text-sm font-bold text-blue-700">
              Great job learning! Now it&apos;s time to practice what you&apos;ve learned.
            </p>
          </div>
        )}

        {completedStage === 'practice' && practiceCorrect !== undefined && (
          <div
            className={`${config.bgColor} border-2 ${config.borderColor} rounded-xl p-4 max-w-xs mx-auto`}
          >
            <p className="text-2xl font-black text-green-700">{practiceCorrect}/10</p>
            <p className="text-sm font-bold text-green-600 mt-1">
              {practiceCorrect >= 10
                ? 'Perfect score! Ready for the challenge!'
                : 'Keep practicing to improve!'}
            </p>
          </div>
        )}

        {completedStage === 'prove' && proveScore !== undefined && (
          <div
            className={`${config.bgColor} border-2 ${config.borderColor} rounded-xl p-4 max-w-xs mx-auto space-y-2`}
          >
            <p className="text-2xl font-black text-purple-700">{proveScore}/10</p>
            {proveAvgTime !== undefined && (
              <p className="text-xs font-bold text-purple-500">
                Avg time: {proveAvgTime.toFixed(1)}s per question
              </p>
            )}
            <p className="text-sm font-bold text-purple-600 mt-1">
              {provePassed
                ? `You mastered ${tableLabel}!`
                : 'Almost there! Try again to prove mastery.'}
            </p>
          </div>
        )}

        {/* Action buttons */}
        <div className="flex flex-col gap-3 max-w-xs mx-auto pt-2">
          {completedStage !== 'prove' && (
            <button
              data-testid="stage-complete-continue"
              type="button"
              onClick={onContinue}
              className={`min-h-[44px] bg-gradient-to-r ${config.color} text-white font-black px-6 py-3 rounded-xl border-2 border-black shadow-neo-xs active:translate-y-0.5 transition-all text-base`}
            >
              {config.nextEmoji} Continue to {config.nextStage} →
            </button>
          )}

          {completedStage === 'prove' && !provePassed && (
            <button
              data-testid="stage-complete-retry"
              type="button"
              onClick={onContinue}
              className={`min-h-[44px] bg-gradient-to-r ${config.color} text-white font-black px-6 py-3 rounded-xl border-2 border-black shadow-neo-xs active:translate-y-0.5 transition-all text-base`}
            >
              ⚡ Try Again
            </button>
          )}

          {completedStage === 'prove' && provePassed && (
            <button
              data-testid="stage-complete-next-table"
              type="button"
              onClick={onBackToJourney}
              className="min-h-[44px] bg-gradient-to-r from-amber-400 to-yellow-500 text-black font-black px-6 py-3 rounded-xl border-2 border-black shadow-neo-xs active:translate-y-0.5 transition-all text-base"
            >
              🏆 Continue to Next Table →
            </button>
          )}

          {(completedStage !== 'prove' || !provePassed) && (
            <button
              data-testid="stage-complete-journey"
              type="button"
              onClick={onBackToJourney}
              className="min-h-[44px] text-gray-500 font-bold px-4 py-2 rounded-xl border-2 border-gray-200 hover:bg-gray-50 transition-all text-sm"
            >
              Back to Journey
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
