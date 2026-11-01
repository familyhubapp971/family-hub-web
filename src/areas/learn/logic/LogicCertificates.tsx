// FHS-395: Logic trophy wall.
// GET /api/kid/logic/certificates → 15-slot grid (5 games × 3 difficulties).
// Earned: date + difficulty stars. Locked: padlock + "10 correct to unlock".
// Auth: Bearer kidToken.

import { useState, useEffect, useRef } from 'react';
import { Lock } from 'lucide-react';
import { API_BASE } from '../../../app/lib/api';
import { type GameType, type Difficulty, GAME_TYPE_META, DIFFICULTY_META } from './LogicSubject';

// ─── Types ────────────────────────────────────────────────────────────────────

interface LogicCertificate {
  gameType: string;
  difficulty: string;
  totalCorrect: number;
  earnedAt: string;
}

interface LogicCertificatesProps {
  kidToken: string;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const GAME_TYPES: GameType[] = ['truefalse', 'patterns', 'oddoneout', 'ifthen', 'sorting'];
const DIFFICULTIES: Difficulty[] = ['easy', 'medium', 'hard'];
const CERTIFICATE_THRESHOLD = 10;

const GAME_TYPE_COLORS: Record<GameType, { bg: string; border: string }> = {
  truefalse: { bg: 'from-green-500 to-emerald-500', border: 'border-green-300' },
  patterns: { bg: 'from-blue-500 to-cyan-500', border: 'border-blue-300' },
  oddoneout: { bg: 'from-orange-500 to-amber-500', border: 'border-orange-300' },
  ifthen: { bg: 'from-purple-500 to-pink-500', border: 'border-purple-300' },
  sorting: { bg: 'from-red-500 to-rose-500', border: 'border-red-300' },
};

const DIFFICULTY_STARS: Record<Difficulty, number> = {
  easy: 1,
  medium: 2,
  hard: 3,
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function comboKey(gt: GameType, diff: Difficulty): string {
  return `${gt}-${diff}`;
}

// ─── Component ────────────────────────────────────────────────────────────────

export function LogicCertificates({ kidToken }: LogicCertificatesProps) {
  const [certificates, setCertificates] = useState<LogicCertificate[]>([]);
  const [loading, setLoading] = useState(true);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    abortRef.current = new AbortController();
    const { signal } = abortRef.current;

    setLoading(true);
    fetch(`${API_BASE}/api/kid/logic/certificates`, {
      headers: { Authorization: `Bearer ${kidToken}` },
      signal,
    })
      .then((res) => (res.ok ? res.json() : Promise.resolve({ certificates: [] })))
      .then((data: { certificates: LogicCertificate[] }) => {
        setCertificates(data.certificates ?? []);
      })
      .catch(() => {
        /* network error: graceful empty state */
      })
      .finally(() => setLoading(false));

    return () => abortRef.current?.abort();
  }, [kidToken]);

  const earnedMap = new Map<string, LogicCertificate>();
  for (const cert of certificates) {
    earnedMap.set(comboKey(cert.gameType as GameType, cert.difficulty as Difficulty), cert);
  }

  const totalEarned = certificates.length;
  const totalPossible = GAME_TYPES.length * DIFFICULTIES.length;
  const progressPct = totalPossible > 0 ? (totalEarned / totalPossible) * 100 : 0;

  if (loading) {
    return (
      <div data-testid="logic-certificates" className="flex items-center justify-center py-12">
        <div className="text-center">
          <div
            className="text-4xl motion-safe:animate-pulse"
            aria-busy="true"
            aria-label="Loading certificates"
          >
            🧠
          </div>
          <p className="text-white font-bold mt-2">Loading certificates...</p>
        </div>
      </div>
    );
  }

  return (
    <div data-testid="logic-certificates" className="space-y-6">
      {/* Progress section */}
      <div className="bg-white border-2 sm:border-[3px] border-black rounded-2xl p-4 sm:p-6 shadow-neo">
        <div className="flex items-center gap-3 mb-3">
          <span className="text-3xl" aria-hidden="true">
            🧠
          </span>
          <div className="flex-1">
            <h3 className="text-lg font-black text-gray-900">Logic Certificates</h3>
            <p className="text-sm font-bold text-gray-500">
              {totalEarned} of {totalPossible} earned
            </p>
          </div>
          <div className="bg-gradient-to-r from-violet-400 to-purple-500 border-2 border-black rounded-xl px-3 py-1.5 shadow-neo-xs">
            <p className="text-sm font-black text-white">{Math.round(progressPct)}%</p>
          </div>
        </div>

        <div
          data-testid="logic-cert-progress-bar"
          className="w-full h-4 bg-gray-200 rounded-full overflow-hidden border-2 border-black"
          role="progressbar"
          aria-valuenow={totalEarned}
          aria-valuemin={0}
          aria-valuemax={totalPossible}
          aria-label={`${totalEarned} of ${totalPossible} certificates earned`}
        >
          <div
            className="h-full rounded-full bg-gradient-to-r from-violet-400 via-purple-400 to-violet-500 transition-all duration-700"
            style={{ width: `${progressPct}%` }}
          />
        </div>

        {totalEarned === totalPossible && totalPossible > 0 && (
          <p className="text-center text-sm font-black text-purple-600 mt-2">
            🌟 All certificates earned! You&apos;re a Logic Master! 🌟
          </p>
        )}
      </div>

      {/* Certificate grid: grouped by game type */}
      {GAME_TYPES.map((gt) => {
        const meta = GAME_TYPE_META[gt];
        const colors = GAME_TYPE_COLORS[gt];

        return (
          <div key={gt} className="space-y-2">
            <div className="flex items-center gap-2">
              <span className="text-lg" aria-hidden="true">
                {meta.emoji}
              </span>
              <h4 className="text-sm font-black text-white uppercase tracking-wider">
                {meta.label}
              </h4>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {DIFFICULTIES.map((diff) => {
                const key = comboKey(gt, diff);
                const cert = earnedMap.get(key);
                const diffMeta = DIFFICULTY_META[diff];

                if (cert) {
                  const earnedDate = new Date(cert.earnedAt).toLocaleDateString('en-GB', {
                    day: 'numeric',
                    month: 'short',
                    year: 'numeric',
                  });

                  return (
                    <div
                      key={key}
                      data-testid={`logic-cert-${gt}-${diff}`}
                      className="bg-gradient-to-br from-yellow-50 via-white to-amber-50 border-2 sm:border-[3px] border-yellow-500 rounded-2xl p-4 shadow-neo-sm relative overflow-hidden"
                    >
                      {/* Gold corner badge */}
                      <div className="absolute top-1 right-1 text-lg" aria-hidden="true">
                        🏅
                      </div>

                      <div className="flex items-center gap-3">
                        <div
                          className={`w-12 h-12 rounded-xl bg-gradient-to-br ${colors.bg} flex items-center justify-center border-2 border-black shadow-neo-xs flex-shrink-0`}
                          aria-hidden="true"
                        >
                          <span className="text-xl">{meta.emoji}</span>
                        </div>

                        <div className="flex-1 min-w-0">
                          <p className="font-black text-gray-900 text-sm">{meta.label}</p>
                          <p className="text-xs font-bold text-amber-600">{diffMeta.label} Level</p>
                          <p className="text-[10px] font-bold text-gray-400 mt-0.5">{earnedDate}</p>
                        </div>
                      </div>

                      {/* Stars */}
                      <div
                        className="flex gap-0.5 mt-2"
                        aria-label={`${DIFFICULTY_STARS[diff]} star${DIFFICULTY_STARS[diff] > 1 ? 's' : ''}`}
                      >
                        {Array.from({ length: DIFFICULTY_STARS[diff] }).map((_, i) => (
                          <span key={i} className="text-sm" aria-hidden="true">
                            ⭐
                          </span>
                        ))}
                      </div>
                    </div>
                  );
                }

                // Locked certificate card
                return (
                  <div
                    key={key}
                    data-testid={`logic-cert-${gt}-${diff}`}
                    className={`bg-gray-50 border-2 border-dashed ${colors.border} rounded-2xl p-4 opacity-50`}
                    aria-label={`${meta.label} ${diffMeta.label}: locked, ${CERTIFICATE_THRESHOLD} correct to unlock`}
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-12 h-12 rounded-xl bg-gray-200 flex items-center justify-center border-2 border-gray-300 flex-shrink-0">
                        <Lock className="w-5 h-5 text-gray-400" aria-hidden="true" />
                      </div>

                      <div className="flex-1 min-w-0">
                        <p className="font-black text-gray-500 text-sm">{meta.label}</p>
                        <p className="text-xs font-bold text-gray-400">{diffMeta.label} Level</p>
                        <p className="text-[10px] font-bold text-gray-400 mt-0.5">
                          {CERTIFICATE_THRESHOLD} correct to unlock
                        </p>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}
