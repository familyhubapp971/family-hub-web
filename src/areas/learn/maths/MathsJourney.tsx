// FHS-394: Maths Journey map.
// Ported from legacy MathsJourney.tsx; adapted for kid token auth.
//
// Derives each table's active stage from the progress fetched via
// GET /api/kid/maths/progress. Table 1 always unlocked; table N unlocks
// when a certificate exists for table N−1 (same operation).
// Milestone badges appear after tables 4, 8, 12.

import { useState, useEffect, useRef, useCallback } from 'react';
import { Lock } from 'lucide-react';
import { API_BASE } from '../../../app/lib/api';
import {
  type Operation,
  type TableNumber,
  TABLE_NUMBERS,
  MASTERY_STAGES,
  MILESTONES,
  OPERATION_LABELS,
  getTableBadge,
  getTableLabel,
} from './maths-utils';

// ─── Types ────────────────────────────────────────────────────────────────────

interface MathsProgress {
  operation: Operation;
  tableNumber: number;
  learnCompleted: boolean;
  practiceCorrect: number;
  proveScore: number;
  proveAvgTime: number;
}

interface MathsCertificate {
  operation: Operation;
  difficulty: string;
}

interface MathsJourneyProps {
  kidToken: string;
  operation: Operation;
  onStartLearn: (tableNumber: TableNumber) => void;
  onStartPractice: (tableNumber: TableNumber) => void;
  onStartProve: (tableNumber: TableNumber) => void;
}

interface TableState {
  tableNumber: TableNumber;
  status: 'mastered' | 'current' | 'locked';
  learnCompleted: boolean;
  practiceCorrect: number;
  proveScore: number;
  proveAvgTime: number;
}

const PRACTICE_THRESHOLD = 10;
const PROVE_SCORE_THRESHOLD = 10;
const PROVE_TIME_THRESHOLD = 5;

function getActiveStage(state: TableState): 'learn' | 'practice' | 'prove' | 'done' {
  if (!state.learnCompleted) return 'learn';
  if (state.practiceCorrect < PRACTICE_THRESHOLD) return 'practice';
  if (state.proveScore < PROVE_SCORE_THRESHOLD || state.proveAvgTime > PROVE_TIME_THRESHOLD)
    return 'prove';
  return 'done';
}

export function MathsJourney({
  kidToken,
  operation,
  onStartLearn,
  onStartPractice,
  onStartProve,
}: MathsJourneyProps) {
  const [progressMap, setProgressMap] = useState<Map<number, MathsProgress>>(new Map());
  const [certificates, setCertificates] = useState<Set<string>>(new Set());
  const [activeTable, setActiveTable] = useState<TableNumber>(1);
  const [loading, setLoading] = useState(true);
  const scrollRef = useRef<HTMLDivElement>(null);

  const headers = { Authorization: `Bearer ${kidToken}` };

  // Load progress and certificates
  useEffect(() => {
    setLoading(true);
    Promise.all([
      fetch(`${API_BASE}/api/kid/maths/progress`, { headers }).then((r) =>
        r.ok ? (r.json() as Promise<{ progress: MathsProgress[] }>) : { progress: [] },
      ),
      fetch(`${API_BASE}/api/kid/maths/certificates`, { headers }).then((r) =>
        r.ok ? (r.json() as Promise<{ certificates: MathsCertificate[] }>) : { certificates: [] },
      ),
    ])
      .then(([progressData, certsData]) => {
        const map = new Map<number, MathsProgress>();
        for (const p of progressData.progress ?? []) {
          if (p.operation === operation) {
            map.set(p.tableNumber, p);
          }
        }
        setProgressMap(map);

        const certSet = new Set<string>();
        for (const c of certsData.certificates ?? []) {
          if (c.operation === operation) {
            certSet.add(c.difficulty);
          }
        }
        setCertificates(certSet);

        // Set active table to the first non-mastered unlocked table
        let firstUnmastered: TableNumber = 1;
        for (const t of TABLE_NUMBERS) {
          if (!certSet.has(String(t))) {
            firstUnmastered = t;
            break;
          }
        }
        setActiveTable(firstUnmastered);
      })
      .catch(() => {
        // Silently fail: show default state
      })
      .finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [kidToken, operation]);

  // Auto-scroll to active table
  useEffect(() => {
    if (scrollRef.current) {
      const circle = scrollRef.current.querySelector(`[data-table="${activeTable}"]`);
      if (
        circle &&
        typeof (circle as Element & { scrollIntoView?: unknown }).scrollIntoView === 'function'
      ) {
        (circle as Element).scrollIntoView({
          behavior: 'smooth',
          block: 'nearest',
          inline: 'center',
        });
      }
    }
  }, [activeTable, loading]);

  const getTableState = useCallback(
    (t: TableNumber): TableState => {
      const progress = progressMap.get(t);
      const hasCert = certificates.has(String(t));

      if (hasCert) {
        return {
          tableNumber: t,
          status: 'mastered',
          learnCompleted: true,
          practiceCorrect: PRACTICE_THRESHOLD,
          proveScore: PROVE_SCORE_THRESHOLD,
          proveAvgTime: progress?.proveAvgTime ?? 3,
        };
      }

      // Table 1 always unlocked; others unlock when previous has a certificate.
      const isUnlocked = t === 1 || certificates.has(String(t - 1));

      if (!isUnlocked) {
        return {
          tableNumber: t,
          status: 'locked',
          learnCompleted: false,
          practiceCorrect: 0,
          proveScore: 0,
          proveAvgTime: 0,
        };
      }

      return {
        tableNumber: t,
        status: 'current',
        learnCompleted: progress?.learnCompleted ?? false,
        practiceCorrect: progress?.practiceCorrect ?? 0,
        proveScore: progress?.proveScore ?? 0,
        proveAvgTime: progress?.proveAvgTime ?? 0,
      };
    },
    [progressMap, certificates],
  );

  if (loading) {
    return (
      <div data-testid="maths-journey" className="flex items-center justify-center py-12">
        <div
          className="text-4xl motion-safe:animate-pulse"
          aria-busy="true"
          aria-label="Loading journey"
        >
          📖
        </div>
      </div>
    );
  }

  const activeState = getTableState(activeTable);
  const activeStage = getActiveStage(activeState);
  const totalMastered = TABLE_NUMBERS.filter((t) => certificates.has(String(t))).length;

  return (
    <div data-testid="maths-journey" className="space-y-4">
      {/* Progress header */}
      <div className="flex items-center justify-between">
        <p className="text-xs font-black text-white/70 uppercase tracking-wider">
          {OPERATION_LABELS[operation]}
        </p>
        <p className="text-xs font-black text-white/70">{totalMastered}/12 mastered</p>
      </div>

      {/* Horizontal journey map: scrollable on mobile */}
      <div
        ref={scrollRef}
        className="overflow-x-auto pb-2 -mx-1 px-1"
        style={{ WebkitOverflowScrolling: 'touch' }}
        role="list"
        aria-label={`${OPERATION_LABELS[operation]} journey`}
      >
        <div className="flex items-center gap-1 sm:gap-0 sm:justify-between min-w-max sm:min-w-0">
          {TABLE_NUMBERS.map((t, i) => {
            const state = getTableState(t);
            const isMilestoneAfter = [4, 8, 12].includes(t);
            const milestoneIndex = t === 4 ? 0 : t === 8 ? 1 : t === 12 ? 2 : -1;

            return (
              <div key={t} className="flex items-center" data-table={t} role="listitem">
                {/* Circle */}
                <button
                  data-testid={`journey-circle-${t}`}
                  type="button"
                  onClick={() => state.status !== 'locked' && setActiveTable(t)}
                  disabled={state.status === 'locked'}
                  aria-label={`Table ${t}: ${state.status === 'mastered' ? 'mastered' : state.status === 'locked' ? 'locked' : 'in progress'}`}
                  aria-pressed={t === activeTable}
                  className={`w-11 h-11 sm:w-12 sm:h-12 rounded-full flex flex-col items-center justify-center flex-shrink-0 transition-all ${
                    state.status === 'mastered'
                      ? 'bg-green-900/60 border-[3px] border-green-500 text-green-400'
                      : state.status === 'current'
                        ? t === activeTable
                          ? 'bg-blue-900/60 border-[3px] border-blue-500 text-blue-400 shadow-[0_0_12px_rgba(59,130,246,0.4)]'
                          : 'bg-blue-900/40 border-[3px] border-blue-400 text-blue-300'
                        : 'bg-slate-800/60 border-2 border-dashed border-slate-600 text-slate-600'
                  }`}
                >
                  {state.status === 'mastered' ? (
                    <span className="text-sm font-bold" aria-hidden="true">
                      ✓
                    </span>
                  ) : state.status === 'locked' ? (
                    <Lock className="w-3.5 h-3.5" aria-hidden="true" />
                  ) : (
                    <>
                      <span className="text-xs font-black leading-none" aria-hidden="true">
                        {getTableBadge(operation, t)}
                      </span>
                      {state.status === 'current' && (
                        <div className="flex gap-[2px] mt-0.5" aria-hidden="true">
                          <div
                            className={`w-[6px] h-[3px] rounded-full ${state.learnCompleted ? 'bg-green-500' : activeStage === 'learn' && t === activeTable ? 'bg-blue-500' : 'bg-slate-600'}`}
                          />
                          <div
                            className={`w-[6px] h-[3px] rounded-full ${state.practiceCorrect >= PRACTICE_THRESHOLD ? 'bg-green-500' : activeStage === 'practice' && t === activeTable ? 'bg-blue-500' : 'bg-slate-600'}`}
                          />
                          <div
                            className={`w-[6px] h-[3px] rounded-full ${activeStage === 'done' ? 'bg-green-500' : activeStage === 'prove' && t === activeTable ? 'bg-blue-500' : 'bg-slate-600'}`}
                          />
                        </div>
                      )}
                    </>
                  )}
                </button>

                {/* Connector + milestone badge */}
                {i < TABLE_NUMBERS.length - 1 && (
                  <div className="flex items-center mx-0.5 sm:mx-1" aria-hidden="true">
                    <div
                      className={`w-2 sm:w-3 h-[3px] rounded-full ${
                        state.status === 'mastered' ? 'bg-green-500' : 'bg-slate-700'
                      }`}
                    />
                    {isMilestoneAfter && milestoneIndex >= 0 && (
                      <>
                        <div
                          className={`w-5 h-5 sm:w-6 sm:h-6 rounded-full flex items-center justify-center text-[10px] sm:text-xs flex-shrink-0 ${
                            totalMastered >= (milestoneIndex + 1) * 4
                              ? 'bg-amber-500 text-white'
                              : 'bg-slate-800 text-slate-600 border border-slate-700'
                          }`}
                        >
                          {MILESTONES[milestoneIndex as 0 | 1 | 2].emoji}
                        </div>
                        <div
                          className={`w-2 sm:w-3 h-[3px] rounded-full ${
                            state.status === 'mastered' ? 'bg-green-500' : 'bg-slate-700'
                          }`}
                        />
                      </>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Detail panel for the selected table */}
      <div
        data-testid="journey-detail-panel"
        className="bg-white border-2 sm:border-[3px] border-black rounded-2xl shadow-neo overflow-hidden"
      >
        {/* Header */}
        <div className="px-4 py-3 sm:px-6 sm:py-4 border-b-2 border-gray-100 flex items-center justify-between">
          <div>
            <h3 className="font-black text-base sm:text-lg text-gray-900">
              {getTableLabel(operation, activeTable)}
            </h3>
            <p className="text-xs font-bold text-gray-400">
              {activeState.status === 'mastered'
                ? '🏆 Mastered!'
                : activeState.status === 'locked'
                  ? `🔒 Complete ${getTableLabel(operation, (activeTable - 1) as TableNumber)} first`
                  : `Stage ${activeStage === 'learn' ? '1' : activeStage === 'practice' ? '2' : '3'} of 3`}
            </p>
          </div>
          {activeState.status === 'current' && activeStage !== 'done' && (
            <button
              data-testid="journey-continue-btn"
              type="button"
              onClick={() => {
                if (activeStage === 'learn') onStartLearn(activeTable);
                else if (activeStage === 'practice') onStartPractice(activeTable);
                else if (activeStage === 'prove') onStartProve(activeTable);
              }}
              className="min-h-[44px] bg-gradient-to-r from-blue-500 to-indigo-500 text-white font-black px-4 py-2 rounded-xl border-2 border-black shadow-neo-xs active:translate-y-0.5 transition-all text-sm"
            >
              Continue →
            </button>
          )}
        </div>

        {/* 3-stage cards */}
        <div className="p-4 sm:p-6">
          <div className="grid grid-cols-3 gap-2 sm:gap-4">
            {MASTERY_STAGES.map((stage) => {
              const isLearnDone = activeState.learnCompleted;
              const isPracticeDone = activeState.practiceCorrect >= PRACTICE_THRESHOLD;
              const isProveDone =
                activeState.proveScore >= PROVE_SCORE_THRESHOLD &&
                activeState.proveAvgTime <= PROVE_TIME_THRESHOLD;

              let isDone = false;
              let isActive = false;
              let isLocked = activeState.status === 'locked';
              let progressText = '';

              if (stage.key === 'learn') {
                isDone = isLearnDone;
                isActive = !isLocked && activeStage === 'learn';
                progressText = isDone ? '✓ Done' : isActive ? 'Ready' : '🔒';
              } else if (stage.key === 'practice') {
                isDone = isPracticeDone;
                isActive = !isLocked && activeStage === 'practice';
                isLocked = isLocked || !isLearnDone;
                progressText = isDone
                  ? '✓ Done'
                  : isActive
                    ? `${activeState.practiceCorrect}/${PRACTICE_THRESHOLD}`
                    : '🔒';
              } else {
                isDone = isProveDone;
                isActive = !isLocked && activeStage === 'prove';
                isLocked = isLocked || !isPracticeDone;
                progressText = isDone ? '✓ Done' : isActive ? 'Ready' : '🔒';
              }

              return (
                <button
                  key={stage.key}
                  data-testid={`stage-${stage.key}`}
                  type="button"
                  disabled={!isActive}
                  onClick={() => {
                    if (stage.key === 'learn') onStartLearn(activeTable);
                    else if (stage.key === 'practice') onStartPractice(activeTable);
                    else onStartProve(activeTable);
                  }}
                  aria-label={`${stage.label}: ${progressText}`}
                  className={`rounded-xl p-3 sm:p-4 text-center transition-all ${
                    isDone
                      ? 'bg-green-50 border-2 border-green-300'
                      : isActive
                        ? 'bg-blue-50 border-2 border-blue-400 shadow-neo-xs cursor-pointer motion-safe:hover:border-blue-500'
                        : 'bg-gray-50 border-2 border-gray-200 opacity-50'
                  }`}
                >
                  <div className="text-2xl sm:text-3xl mb-1" aria-hidden="true">
                    {stage.icon}
                  </div>
                  <p
                    className={`font-black text-xs sm:text-sm ${
                      isDone ? 'text-green-700' : isActive ? 'text-blue-700' : 'text-gray-400'
                    }`}
                  >
                    {stage.label}
                  </p>
                  <p
                    className={`text-[10px] sm:text-xs font-bold mt-0.5 ${
                      isDone ? 'text-green-500' : isActive ? 'text-blue-500' : 'text-gray-400'
                    }`}
                  >
                    {progressText}
                  </p>
                </button>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
