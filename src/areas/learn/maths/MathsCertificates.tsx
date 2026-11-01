// FHS-394: Maths Certificates / Achievements view.
// GET /api/kid/maths/certificates → renders per-operation certificate grid
// (12 tables) + milestone speed challenges (Bronze/Silver/Gold/Grand Master).
//
// Speed challenge best scores are kept in localStorage only.
// Key pattern: maths_speedBest_${operation}_${milestoneName}
// (no memberId: keyed on operation+milestone since kid auth uses kidToken).
//
// Empty state: renders gracefully when no certificates have been earned yet.

import { useState, useEffect, useCallback, useRef } from 'react';
import { Lock, Timer, Trophy, RotateCcw, Award } from 'lucide-react';
import { API_BASE } from '../../../app/lib/api';
import {
  type Operation,
  TABLE_NUMBERS,
  OPERATION_LABELS,
  OPERATION_SYMBOLS,
  generateTableProblem,
  pickRandom,
} from './maths-utils';

// ─── Types ────────────────────────────────────────────────────────────────────

interface MathsCertificate {
  operation: Operation;
  difficulty: string;
  earnedAt: string;
}

interface MathsCertificatesProps {
  kidToken: string;
  operation: Operation;
}

// ─── Speed challenge constants ────────────────────────────────────────────────

const SPEED_CHALLENGE_DURATION = 60;

const SPEED_TIERS = [
  {
    name: 'Gold',
    threshold: 15,
    emoji: '🥇',
    color: 'from-yellow-300 to-amber-500',
    border: 'border-yellow-500',
    bg: 'bg-yellow-50',
  },
  {
    name: 'Silver',
    threshold: 10,
    emoji: '🥈',
    color: 'from-gray-200 to-gray-400',
    border: 'border-gray-400',
    bg: 'bg-gray-50',
  },
  {
    name: 'Bronze',
    threshold: 5,
    emoji: '🥉',
    color: 'from-amber-600 to-orange-500',
    border: 'border-orange-400',
    bg: 'bg-orange-50',
  },
] as const;

const MILESTONE_DEFS = [
  { name: 'Bronze', tables: [1, 2, 3, 4] as number[], emoji: '⭐', range: '1-4' },
  {
    name: 'Silver',
    tables: [5, 6, 7, 8] as number[],
    emoji: '🥈',
    range: '5-8',
    cumulative: [1, 2, 3, 4, 5, 6, 7, 8] as number[],
  },
  {
    name: 'Gold',
    tables: [9, 10, 11, 12] as number[],
    emoji: '🥇',
    range: '9-12',
    cumulative: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12] as number[],
  },
  {
    name: 'Grand Master',
    tables: [...TABLE_NUMBERS] as number[],
    emoji: '👑',
    range: 'All',
    cumulative: [...TABLE_NUMBERS] as number[],
  },
] as const;

// ─── Helpers ──────────────────────────────────────────────────────────────────

function speedBestKey(operation: Operation, milestoneName: string): string {
  return `maths_speedBest_${operation}_${milestoneName.toLowerCase().replace(/\s/g, '_')}`;
}

function readBestScore(key: string): number {
  try {
    const raw = localStorage.getItem(key);
    return raw ? parseInt(raw, 10) : 0;
  } catch {
    return 0;
  }
}

function getSpeedTier(score: number): (typeof SPEED_TIERS)[number] | null {
  for (const tier of SPEED_TIERS) {
    if (score >= tier.threshold) return tier;
  }
  return null;
}

function getNextTierTarget(score: number): (typeof SPEED_TIERS)[number] | null {
  for (let i = SPEED_TIERS.length - 1; i >= 0; i--) {
    const tier = SPEED_TIERS[i];
    if (tier !== undefined && score < tier.threshold) return tier;
  }
  return null;
}

// ─── SpeedChallenge sub-component ────────────────────────────────────────────

interface SpeedChallengeProps {
  operation: Operation;
  tables: number[];
  milestoneName: string;
  onExit: () => void;
}

function SpeedChallenge({ operation, tables, milestoneName, onExit }: SpeedChallengeProps) {
  const bestKey = speedBestKey(operation, milestoneName);
  const [started, setStarted] = useState(false);
  const [timeLeft, setTimeLeft] = useState(SPEED_CHALLENGE_DURATION);
  const [score, setScore] = useState(0);
  const [problem, setProblem] = useState(() => generateTableProblem(operation, pickRandom(tables)));
  const [selected, setSelected] = useState<number | null>(null);
  const [isCorrect, setIsCorrect] = useState<boolean | null>(null);
  const [finished, setFinished] = useState(false);
  const [bestScore, setBestScore] = useState(() => readBestScore(bestKey));

  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const operationSymbol = OPERATION_SYMBOLS[operation];

  const nextProblem = useCallback(() => {
    setProblem(generateTableProblem(operation, pickRandom(tables)));
    setSelected(null);
    setIsCorrect(null);
  }, [operation, tables]);

  const startTimer = useCallback(() => {
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

  const handleStart = () => {
    setProblem(generateTableProblem(operation, pickRandom(tables)));
    setStarted(true);
    startTimer();
  };

  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, []);

  useEffect(() => {
    if (finished && score > bestScore) {
      setBestScore(score);
      try {
        localStorage.setItem(bestKey, String(score));
      } catch {
        /* ignore storage errors */
      }
    }
  }, [finished, score, bestScore, bestKey]);

  const handleAnswer = (choice: number) => {
    if (selected !== null || finished) return;
    setSelected(choice);
    if (choice === problem.answer) {
      setIsCorrect(true);
      setScore((s) => s + 1);
      setTimeout(nextProblem, 400);
    } else {
      setIsCorrect(false);
      setTimeout(nextProblem, 800);
    }
  };

  const restart = () => {
    if (timerRef.current) clearInterval(timerRef.current);
    setTimeLeft(SPEED_CHALLENGE_DURATION);
    setScore(0);
    setFinished(false);
    setSelected(null);
    setIsCorrect(null);
    setStarted(true);
    nextProblem();
    startTimer();
  };

  // Setup screen
  if (!started) {
    return (
      <div data-testid="speed-challenge-setup" className="space-y-4">
        <div className="bg-white border-2 sm:border-[3px] border-black rounded-2xl p-5 sm:p-6 shadow-neo space-y-5">
          <div className="text-center space-y-2">
            <h3 className="font-black text-lg sm:text-xl text-gray-800">
              ⚡ {milestoneName} Speed Test
            </h3>
            <p className="text-sm text-gray-500 font-medium">
              {OPERATION_LABELS[operation]}: Tables {tables[0]}-{tables[tables.length - 1]}
            </p>
            <p className="text-sm text-gray-500 font-medium">
              Answer as many questions as you can in 60 seconds!
            </p>
          </div>

          {bestScore > 0 && (
            <div className="text-center">
              <p className="text-xs font-bold text-gray-400">
                Current best: <span className="text-purple-600 font-black">{bestScore}</span>{' '}
                {getSpeedTier(bestScore)?.emoji ?? ''}
              </p>
            </div>
          )}

          <div className="flex gap-3">
            <button
              data-testid="speed-challenge-go"
              type="button"
              onClick={handleStart}
              className="flex-1 min-h-[44px] py-3 bg-gradient-to-r from-purple-500 to-pink-500 text-white font-black text-base rounded-xl border-2 border-black shadow-neo motion-safe:hover:-translate-y-0.5 active:translate-y-0.5 transition-all"
            >
              ⚡ Start!
            </button>
            <button
              type="button"
              onClick={onExit}
              className="min-h-[44px] py-3 px-4 bg-white text-gray-600 font-bold text-sm rounded-xl border-2 border-gray-300 motion-safe:hover:bg-gray-50 transition-all"
            >
              Back
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Finished screen
  if (finished) {
    const isNewBest = score > bestScore && score > 0;
    const tier = getSpeedTier(score);
    const nextTier = getNextTierTarget(score);
    return (
      <div data-testid="speed-challenge-results" className="space-y-4">
        <div className="bg-white border-2 sm:border-[3px] border-black rounded-2xl p-6 sm:p-8 shadow-neo text-center space-y-4">
          <div className="text-5xl" aria-hidden="true">
            {isNewBest ? '🏆' : '⏰'}
          </div>
          <h3 className="font-black text-xl text-gray-800">
            {isNewBest ? 'New Best Score!' : "Time's Up!"}
          </h3>
          <p className="text-xs font-black text-purple-400 uppercase tracking-wider">
            {milestoneName}: {OPERATION_LABELS[operation]}
          </p>
          <div className="flex justify-center gap-6">
            <div className="text-center">
              <p className="text-3xl font-black text-purple-600">{score}</p>
              <p className="text-xs font-bold text-gray-400 uppercase">Score</p>
            </div>
            <div className="text-center">
              <p className="text-3xl font-black text-amber-500">{bestScore}</p>
              <p className="text-xs font-bold text-gray-400 uppercase">Best</p>
            </div>
          </div>
          {tier && (
            <div
              className={`inline-flex items-center gap-2 px-4 py-2 rounded-full border-2 ${tier.border} ${tier.bg}`}
            >
              <span className="text-lg">{tier.emoji}</span>
              <span className="font-black text-sm">{tier.name} Award!</span>
            </div>
          )}
          {nextTier && (
            <p className="text-xs font-bold text-purple-400">
              {nextTier.threshold - score} more for {nextTier.emoji} {nextTier.name}
            </p>
          )}
          <p className="text-sm font-bold text-gray-500">
            {score >= 15
              ? "Incredible speed! You're a lightning calculator!"
              : score >= 10
                ? 'Amazing! Keep pushing for a higher score!'
                : score >= 5
                  ? 'Great effort! Practice makes perfect!'
                  : "Good try! You'll get faster with practice!"}
          </p>
          <div className="flex flex-col sm:flex-row gap-3 justify-center pt-2">
            <button
              data-testid="speed-challenge-retry"
              type="button"
              onClick={restart}
              className="flex items-center justify-center gap-2 min-h-[44px] bg-gradient-to-r from-purple-500 to-pink-500 text-white font-black px-6 py-2.5 rounded-xl border-2 border-black shadow-neo-xs active:translate-y-0.5 transition-all"
            >
              <RotateCcw className="w-4 h-4" aria-hidden="true" /> Try Again
            </button>
            <button
              data-testid="speed-challenge-exit"
              type="button"
              onClick={onExit}
              className="flex items-center justify-center gap-2 min-h-[44px] bg-white text-gray-700 font-bold px-6 py-2.5 rounded-xl border-2 border-gray-300 motion-safe:hover:bg-gray-50 transition-all"
            >
              Back to Trophies
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Active challenge
  const writtenProblem = `${problem.a} ${operationSymbol} ${problem.b} = ?`;
  return (
    <div data-testid="speed-challenge-active" className="space-y-4">
      <div className="bg-white border-2 sm:border-[3px] border-black rounded-2xl px-4 py-3 flex items-center justify-between shadow-neo">
        <div className="flex items-center gap-2">
          <Timer
            className={`w-5 h-5 ${timeLeft <= 10 ? 'text-red-500 motion-safe:animate-pulse' : 'text-gray-500'}`}
            aria-hidden="true"
          />
          <span
            className={`text-xl font-black ${timeLeft <= 10 ? 'text-red-500' : 'text-gray-900'}`}
            aria-live="polite"
          >
            {timeLeft}s
          </span>
        </div>
        <div className="px-3 py-1 bg-purple-100 rounded-full">
          <span className="text-xs font-black text-purple-600">{milestoneName}</span>
        </div>
        <div className="flex items-center gap-2">
          <Trophy className="w-5 h-5 text-amber-500" aria-hidden="true" />
          <span className="text-xl font-black text-gray-900">{score}</span>
        </div>
        <button
          type="button"
          onClick={onExit}
          className="min-h-[44px] text-xs font-bold text-gray-400 motion-safe:hover:text-gray-600 px-2 transition-colors"
        >
          Exit
        </button>
      </div>
      <div className="bg-white border-2 sm:border-[3px] border-black rounded-2xl p-6 sm:p-8 shadow-neo text-center">
        <p
          data-testid="speed-written-problem"
          className="text-3xl sm:text-4xl font-black text-gray-900"
          aria-live="polite"
        >
          {writtenProblem}
        </p>
      </div>
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
              data-testid={`speed-choice-${i}`}
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
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export function MathsCertificates({ kidToken, operation }: MathsCertificatesProps) {
  const [certificates, setCertificates] = useState<MathsCertificate[]>([]);
  const [loading, setLoading] = useState(true);
  const [showSpeedChallenge, setShowSpeedChallenge] = useState(false);
  const [speedTables, setSpeedTables] = useState<number[]>([]);
  const [speedMilestoneName, setSpeedMilestoneName] = useState('');

  // Stable ref for the fetch so we can cancel on unmount.
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    abortRef.current = new AbortController();
    const { signal } = abortRef.current;

    setLoading(true);
    fetch(`${API_BASE}/api/kid/maths/certificates`, {
      headers: { Authorization: `Bearer ${kidToken}` },
      signal,
    })
      .then((res) => (res.ok ? res.json() : Promise.resolve({ certificates: [] })))
      .then((data: { certificates: MathsCertificate[] }) => {
        setCertificates(data.certificates ?? []);
      })
      .catch(() => {
        /* network error: keep empty state */
      })
      .finally(() => setLoading(false));

    return () => abortRef.current?.abort();
    // operation isn't used in the fetch (all certs returned; filtered client-side),
    // so no need to re-fetch on operation switch.
  }, [kidToken]);

  // Filter certificates for the current operation.
  const opCerts = certificates.filter((c) => c.operation === operation);
  const earnedTables = new Set<string>(opCerts.map((c) => c.difficulty));
  const totalEarned = opCerts.length;
  const progressPct = (totalEarned / 12) * 100;

  const isMilestoneComplete = (tables: number[]) =>
    tables.every((t) => earnedTables.has(String(t)));

  const openSpeedTest = (tables: number[], name: string) => {
    setSpeedTables(tables);
    setSpeedMilestoneName(name);
    setShowSpeedChallenge(true);
  };

  if (loading) {
    return (
      <div data-testid="maths-certificates" className="flex items-center justify-center py-12">
        <div className="text-center">
          <div className="text-4xl motion-safe:animate-pulse" aria-busy="true">
            🏆
          </div>
          <p className="text-white font-bold mt-2">Loading certificates...</p>
        </div>
      </div>
    );
  }

  if (showSpeedChallenge) {
    return (
      <div data-testid="maths-certificates" className="space-y-6">
        <SpeedChallenge
          operation={operation}
          tables={speedTables}
          milestoneName={speedMilestoneName}
          onExit={() => setShowSpeedChallenge(false)}
        />
      </div>
    );
  }

  const anyMilestoneUnlocked = MILESTONE_DEFS.some((m) => isMilestoneComplete(m.tables));

  return (
    <div data-testid="maths-certificates" className="space-y-6">
      {/* Progress Section */}
      <div className="bg-white border-2 sm:border-[3px] border-black rounded-2xl p-4 sm:p-6 shadow-neo">
        <div className="flex items-center gap-3 mb-3">
          <span className="text-3xl" aria-hidden="true">
            🏆
          </span>
          <div className="flex-1">
            <h3 className="text-lg font-black text-gray-900">
              {OPERATION_LABELS[operation]} Certificates
            </h3>
            <p className="text-sm font-bold text-gray-500">{totalEarned} of 12 tables mastered</p>
          </div>
          <div className="bg-gradient-to-r from-yellow-400 to-amber-500 border-2 border-black rounded-xl px-3 py-1.5 shadow-neo-xs">
            <p className="text-sm font-black text-black">{Math.round(progressPct)}%</p>
          </div>
        </div>
        <div
          data-testid="maths-cert-progress-bar"
          className="w-full h-4 bg-gray-200 rounded-full overflow-hidden border-2 border-black"
          role="progressbar"
          aria-valuenow={totalEarned}
          aria-valuemin={0}
          aria-valuemax={12}
          aria-label={`${totalEarned} of 12 tables mastered`}
        >
          <div
            className="h-full rounded-full bg-gradient-to-r from-yellow-400 via-amber-400 to-yellow-500 transition-all duration-700"
            style={{ width: `${progressPct}%` }}
          />
        </div>
      </div>

      {/* 12-Certificate Grid */}
      <div className="grid grid-cols-4 sm:grid-cols-6 gap-2 sm:gap-3">
        {TABLE_NUMBERS.map((t) => {
          const cert = opCerts.find((c) => c.difficulty === String(t));
          if (cert) {
            const earnedDate = new Date(cert.earnedAt).toLocaleDateString('en-GB', {
              day: 'numeric',
              month: 'short',
            });
            return (
              <div
                key={t}
                data-testid={`maths-cert-${t}`}
                className="bg-gradient-to-br from-yellow-50 via-white to-amber-50 border-2 sm:border-[3px] border-yellow-500 rounded-2xl p-2.5 sm:p-3 shadow-neo-sm text-center relative overflow-hidden"
              >
                <div className="absolute top-0.5 right-0.5 text-xs" aria-hidden="true">
                  🏅
                </div>
                <p className="text-lg sm:text-xl font-black text-gray-900">{t}×</p>
                <p className="text-[10px] font-bold text-amber-600">
                  {OPERATION_SYMBOLS[operation]}
                </p>
                <p className="text-[9px] font-bold text-gray-400 mt-0.5">{earnedDate}</p>
                <div className="flex gap-0.5 justify-center mt-1" aria-label="3 stars">
                  {[1, 2, 3].map((i) => (
                    <span key={i} className="text-[10px]" aria-hidden="true">
                      ⭐
                    </span>
                  ))}
                </div>
              </div>
            );
          }

          return (
            <div
              key={t}
              data-testid={`maths-cert-${t}`}
              className="bg-gray-50 border-2 border-dashed border-gray-300 rounded-2xl p-2.5 sm:p-3 opacity-50 text-center"
            >
              <Lock className="w-4 h-4 text-gray-400 mx-auto mb-0.5" aria-hidden="true" />
              <p className="text-lg sm:text-xl font-black text-gray-400">{t}×</p>
              <p className="text-[10px] font-bold text-gray-400">3 stages</p>
            </div>
          );
        })}
      </div>

      {/* Milestone Speed Tests: only unlocked ones */}
      <div className="space-y-3">
        {MILESTONE_DEFS.map((milestone) => {
          const isUnlocked = isMilestoneComplete(milestone.tables);
          if (!isUnlocked) return null;

          const testTables = 'cumulative' in milestone ? milestone.cumulative : milestone.tables;
          const bKey = speedBestKey(operation, milestone.name);
          const bestScore = readBestScore(bKey);
          const tier = getSpeedTier(bestScore);

          return (
            <button
              key={milestone.name}
              data-testid={`speed-milestone-${milestone.name.toLowerCase().replace(/\s/g, '-')}`}
              type="button"
              onClick={() => openSpeedTest(testTables as number[], milestone.name)}
              className="w-full min-h-[44px] bg-gradient-to-r from-purple-50 to-pink-50 border-2 border-purple-200 rounded-xl px-4 py-3 flex items-center justify-between motion-safe:hover:border-purple-400 transition-all group"
            >
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 bg-gradient-to-r from-purple-500 to-pink-500 rounded-lg flex items-center justify-center border-2 border-black shadow-neo-xs">
                  <span className="text-base" aria-hidden="true">
                    {milestone.emoji}
                  </span>
                </div>
                <div className="text-left">
                  <p className="font-black text-sm text-purple-700">
                    ⚡ {milestone.name} Speed Test
                  </p>
                  <p className="text-xs font-bold text-purple-400">
                    {bestScore > 0
                      ? `Best: ${bestScore} ${tier?.emoji ?? ''} • Tables ${milestone.range}`
                      : `Tables ${milestone.range} • 60 seconds`}
                  </p>
                </div>
              </div>
              <span
                className="text-purple-300 group-hover:text-purple-500 font-black text-lg transition-colors"
                aria-hidden="true"
              >
                ▶
              </span>
            </button>
          );
        })}
      </div>

      {/* Speed Test Awards */}
      {anyMilestoneUnlocked && (
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <Award className="w-4 h-4 text-yellow-400" aria-hidden="true" />
            <h4 className="text-sm font-black text-white uppercase tracking-wider">
              Speed Test Awards
            </h4>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {MILESTONE_DEFS.map((milestone) => {
              const isUnlocked = isMilestoneComplete(milestone.tables);
              const bKey = speedBestKey(operation, milestone.name);
              const best = readBestScore(bKey);
              const tier = getSpeedTier(best);
              const nextTier = getNextTierTarget(best);

              if (!isUnlocked) {
                return (
                  <div
                    key={milestone.name}
                    data-testid={`speed-award-${milestone.name.toLowerCase().replace(/\s/g, '-')}`}
                    className="bg-gray-50 border-2 border-dashed border-gray-300 rounded-2xl p-3 sm:p-4 opacity-50 text-center"
                  >
                    <Lock className="w-5 h-5 text-gray-400 mx-auto mb-1" aria-hidden="true" />
                    <p className="font-black text-gray-500 text-xs">
                      {milestone.emoji} {milestone.name}
                    </p>
                    <p className="text-[10px] text-gray-400 font-bold mt-0.5">
                      Tables {milestone.range}
                    </p>
                  </div>
                );
              }

              return (
                <div
                  key={milestone.name}
                  data-testid={`speed-award-${milestone.name.toLowerCase().replace(/\s/g, '-')}`}
                  className={`bg-white border-2 ${tier ? tier.border : 'border-gray-200'} rounded-2xl p-3 sm:p-4 text-center shadow-neo-xs`}
                >
                  <div className="text-2xl mb-1" aria-hidden="true">
                    {tier ? tier.emoji : '⚡'}
                  </div>
                  <p className="font-black text-gray-800 text-xs">
                    {milestone.emoji} {milestone.name}
                  </p>
                  {best > 0 ? (
                    <>
                      <p className="text-lg font-black text-purple-600">{best}</p>
                      <p className="text-[10px] font-bold text-gray-400">
                        {tier?.name ?? 'No tier yet'}
                      </p>
                      {nextTier && (
                        <p className="text-[10px] font-bold text-purple-400 mt-0.5">
                          {nextTier.threshold - best} more for {nextTier.emoji}
                        </p>
                      )}
                    </>
                  ) : (
                    <p className="text-[10px] font-bold text-gray-400 mt-1">Not attempted</p>
                  )}
                  <div className="flex justify-center gap-1 mt-2">
                    {SPEED_TIERS.slice()
                      .reverse()
                      .map((t) => (
                        <span
                          key={t.name}
                          className={`text-xs ${best >= t.threshold ? '' : 'opacity-20 grayscale'}`}
                          aria-hidden="true"
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
