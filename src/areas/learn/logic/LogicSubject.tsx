// FHS-395: Logic Subject orchestrator.
// 5 game-type pills + Trophy toggle. Selecting a game renders LogicLesson
// for that type; Trophy shows LogicCertificates.
// Auth: Bearer kidToken on all /api/kid/logic/* calls.

import { useState } from 'react';
import { Trophy } from 'lucide-react';
import { LogicLesson } from './LogicLesson';
import { LogicCertificates } from './LogicCertificates';

// ─── Types ────────────────────────────────────────────────────────────────────

export type GameType = 'truefalse' | 'patterns' | 'oddoneout' | 'ifthen' | 'sorting';
export type Difficulty = 'easy' | 'medium' | 'hard';

interface LogicSubjectProps {
  kidToken: string;
}

type ActiveView = 'practice' | 'certificates';

// ─── Constants ────────────────────────────────────────────────────────────────

const GAME_TYPES: GameType[] = ['truefalse', 'patterns', 'oddoneout', 'ifthen', 'sorting'];

export const GAME_TYPE_META: Record<GameType, { emoji: string; label: string }> = {
  truefalse: { emoji: '✅', label: 'True/False' },
  patterns: { emoji: '🔢', label: 'Patterns' },
  oddoneout: { emoji: '🔍', label: 'Odd One Out' },
  ifthen: { emoji: '🔗', label: 'If…Then' },
  sorting: { emoji: '📦', label: 'Sorting' },
};

export const DIFFICULTY_META: Record<Difficulty, { label: string; color: string }> = {
  easy: { label: 'Easy', color: 'from-green-400 to-emerald-500' },
  medium: { label: 'Medium', color: 'from-yellow-400 to-amber-400' },
  hard: { label: 'Hard', color: 'from-red-400 to-rose-500' },
};

// ─── Component ────────────────────────────────────────────────────────────────

export function LogicSubject({ kidToken }: LogicSubjectProps) {
  const [activeView, setActiveView] = useState<ActiveView>('practice');
  const [gameType, setGameType] = useState<GameType>('truefalse');

  const isAchievements = activeView === 'certificates';

  const handleGameTypeChange = (gt: GameType) => {
    setGameType(gt);
    if (isAchievements) setActiveView('practice');
  };

  return (
    <div data-testid="logic-subject" className="space-y-4 sm:space-y-6">
      {/* Game type selector + Trophy toggle */}
      <div className="flex items-center gap-2">
        <div
          data-testid="logic-game-selector"
          className="flex-1 bg-white border-2 sm:border-[3px] border-black rounded-2xl p-1.5 sm:p-2 grid grid-cols-2 sm:flex gap-1.5 sm:gap-2 shadow-neo"
          role="group"
          aria-label="Select game type"
        >
          {GAME_TYPES.map((gt) => {
            const meta = GAME_TYPE_META[gt];
            return (
              <button
                key={gt}
                data-testid={`logic-game-${gt}`}
                type="button"
                aria-pressed={!isAchievements && gameType === gt}
                onClick={() => handleGameTypeChange(gt)}
                className={`flex-1 min-h-[44px] py-2.5 sm:py-3 px-2 sm:px-4 rounded-xl font-black text-xs sm:text-sm transition-all ${
                  !isAchievements && gameType === gt
                    ? 'bg-gradient-to-r from-violet-500 to-purple-500 text-white shadow-neo-xs'
                    : 'text-gray-500 motion-safe:hover:bg-gray-50'
                }`}
              >
                {meta.emoji} {meta.label}
              </button>
            );
          })}
        </div>
        <button
          data-testid="logic-trophy-toggle"
          type="button"
          aria-label={isAchievements ? 'Back to practice' : 'View certificates'}
          aria-pressed={isAchievements}
          onClick={() => {
            setActiveView(isAchievements ? 'practice' : 'certificates');
          }}
          className={`flex-shrink-0 min-h-[44px] p-3 sm:p-4 rounded-2xl border-2 sm:border-[3px] border-black transition-all ${
            isAchievements
              ? 'bg-gradient-to-r from-yellow-400 to-amber-500 text-black shadow-neo'
              : 'bg-white text-gray-400 motion-safe:hover:text-amber-500 motion-safe:hover:border-amber-400 shadow-neo'
          }`}
        >
          <Trophy className="w-5 h-5" aria-hidden="true" />
        </button>
      </div>

      {activeView === 'practice' && <LogicLesson kidToken={kidToken} gameType={gameType} />}
      {activeView === 'certificates' && <LogicCertificates kidToken={kidToken} />}
    </div>
  );
}
