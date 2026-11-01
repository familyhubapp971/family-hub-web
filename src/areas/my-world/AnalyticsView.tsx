import { useEffect, useState } from 'react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { Trophy } from 'lucide-react';
import { Spinner } from '@familyhub/ui';

// FHS-298: My World analytics (faithful port of the legacy AnalyticsView).
// Read-only summary + weekly-trend chart + habit leaderboard for one child.

interface ApiWeekStat {
  weekNumber: number;
  year: number;
  startDate: string;
  totalStickers: number;
  daysCompleted: number;
  completionRate: number;
}
interface ApiHabitStat {
  habitId: string;
  name: string;
  habitIcon: string | null;
  totalDays: number;
  completedDays: number;
  rate: number;
}
interface AnalyticsData {
  stickersPerWeek: ApiWeekStat[];
  habitStats: ApiHabitStat[];
}

interface WeeklyDataPoint {
  week: string;
  stickers: number;
  completion: number;
}
interface HabitStat {
  habitId: string;
  name: string;
  total: number;
  // FHS-482: the possible days across every tracked week, so the leaderboard
  // can show "done of total" instead of a bare completed-days count.
  totalPossible: number;
  avgWeek: number;
  rate: number;
}

type Metric = 'stickers' | 'completion';

function getRateStyle(rate: number): { bar: string; badge: string; label: string } {
  if (rate >= 50)
    return { bar: 'bg-emerald-400', badge: 'bg-emerald-100 text-emerald-700', label: 'Great' };
  if (rate >= 35)
    return { bar: 'bg-amber-400', badge: 'bg-amber-100 text-amber-700', label: 'Good' };
  return { bar: 'bg-rose-400', badge: 'bg-rose-100 text-rose-600', label: 'Keep going' };
}

// FHS-374: the caller supplies the analytics URL + headers, so this view works
// for both the parent (/api/mw/analytics?memberId=) and the kid (/api/kid/analytics).
export function AnalyticsView({
  analyticsUrl,
  headers,
}: {
  analyticsUrl: string;
  headers: Record<string, string> | null;
}) {
  const [metric, setMetric] = useState<Metric>('stickers');
  const [weeklyData, setWeeklyData] = useState<WeeklyDataPoint[]>([]);
  const [habitStats, setHabitStats] = useState<HabitStat[]>([]);
  const [loading, setLoading] = useState(true);

  // Derived summary values
  const totalWeeks = weeklyData.length;
  const activeHabits = habitStats.length;
  const totalStickers = weeklyData.reduce((sum, w) => sum + w.stickers, 0);
  const avgCompletion =
    habitStats.length > 0
      ? Math.round(habitStats.reduce((sum, h) => sum + h.rate, 0) / habitStats.length)
      : 0;

  useEffect(() => {
    if (!headers) return;
    let cancelled = false;
    setLoading(true);
    fetch(analyticsUrl, { headers })
      .then((res) => (res.ok ? (res.json() as Promise<AnalyticsData>) : Promise.reject(res)))
      .then((data) => {
        if (cancelled) return;
        const weeks = data.stickersPerWeek ?? [];
        const habits = data.habitStats ?? [];
        setWeeklyData(
          weeks.map((w) => ({
            week: 'Week ' + w.weekNumber,
            stickers: w.totalStickers,
            completion: w.completionRate ?? 0,
          })),
        );
        const numWeeks = weeks.length || 1;
        setHabitStats(
          habits
            .map((h) => ({
              habitId: h.habitId,
              name: h.name,
              total: h.completedDays,
              totalPossible: h.totalDays,
              avgWeek: Math.round((h.completedDays / numWeeks) * 10) / 10,
              rate: h.rate,
            }))
            .sort((a, b) => b.rate - a.rate),
        );
      })
      .catch((err) => {
        if (!cancelled) console.error('Failed to load analytics:', err);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [analyticsUrl, headers]);

  if (loading) {
    return (
      <div data-testid="analytics-loading" className="flex items-center justify-center py-20">
        <div className="text-center">
          <Spinner size="md" className="mx-auto mb-3 text-purple-600" />
          <p className="text-sm font-bold text-gray-600">Loading analytics…</p>
        </div>
      </div>
    );
  }

  return (
    <div data-testid="analytics-view" className="space-y-5">
      {/* ── 1. Summary Numbers ── */}
      <div className="grid grid-cols-2 gap-3">
        <div
          data-testid="analytics-summary-total-weeks"
          className="bg-white border-2 sm:border-3 border-black rounded-2xl p-3 sm:p-4 shadow-neo"
        >
          <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-1">
            Total Weeks
          </p>
          <p className="text-2xl sm:text-3xl font-black text-purple-600">{totalWeeks}</p>
        </div>
        <div
          data-testid="analytics-summary-active-habits"
          className="bg-white border-2 sm:border-3 border-black rounded-2xl p-3 sm:p-4 shadow-neo"
        >
          <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-1">
            Active Habits
          </p>
          <p className="text-2xl sm:text-3xl font-black text-fuchsia-500">{activeHabits}</p>
        </div>
        <div
          data-testid="analytics-summary-avg-completion"
          className="bg-white border-2 sm:border-3 border-black rounded-2xl p-3 sm:p-4 shadow-neo"
        >
          <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-1">
            Avg Completion
          </p>
          <p className="text-2xl sm:text-3xl font-black text-emerald-500">{avgCompletion}%</p>
          <p className="text-[10px] text-gray-400 font-medium mt-1">days done / total days</p>
        </div>
        <div
          data-testid="analytics-summary-total-stickers"
          className="bg-white border-2 sm:border-3 border-black rounded-2xl p-3 sm:p-4 shadow-neo"
        >
          <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-1">
            Current Value
          </p>
          <p className="text-2xl sm:text-3xl font-black text-amber-500">{totalStickers} ⭐</p>
          <p className="text-[10px] text-gray-400 font-medium mt-1">
            stickers × bonus × investment
          </p>
        </div>
      </div>

      {/* ── 2. Weekly Trend ── */}
      <div
        data-testid="analytics-chart"
        className="bg-white border-2 sm:border-3 border-black rounded-2xl p-4 sm:p-5 shadow-neo"
      >
        <div className="flex items-center justify-between mb-5">
          <h3 className="text-base font-black text-gray-800">Weekly Trend</h3>
          <div className="flex bg-gray-100 rounded-xl p-1 gap-1">
            <button
              data-testid="analytics-metric-stickers"
              onClick={() => setMetric('stickers')}
              className={`min-h-[44px] flex items-center px-3 py-1.5 rounded-lg text-xs font-black transition-all ${metric === 'stickers' ? 'bg-amber-400 text-black shadow-neo-xs' : 'text-gray-500 hover:text-gray-700'}`}
            >
              ⭐ Stickers
            </button>
            <button
              data-testid="analytics-metric-completion"
              onClick={() => setMetric('completion')}
              className={`min-h-[44px] flex items-center px-3 py-1.5 rounded-lg text-xs font-black transition-all ${metric === 'completion' ? 'bg-emerald-400 text-black shadow-neo-xs' : 'text-gray-500 hover:text-gray-700'}`}
            >
              ✅ Completion %
            </button>
          </div>
        </div>

        {weeklyData.length === 0 ? (
          <div
            data-testid="analytics-chart-empty"
            className="text-center text-sm font-bold text-gray-400 py-12"
          >
            No habit history yet. Earn some stickers to see your trend!
          </div>
        ) : (
          <ResponsiveContainer width="100%" height={160}>
            <BarChart
              data={weeklyData}
              maxBarSize={40}
              margin={{ top: 0, right: 8, left: -20, bottom: 0 }}
            >
              <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" vertical={false} />
              <XAxis
                dataKey="week"
                tick={{ fontSize: 11, fill: '#9ca3af', fontWeight: 700 }}
                axisLine={false}
                tickLine={false}
                interval="preserveStartEnd"
                minTickGap={16}
              />
              <YAxis
                tick={{ fontSize: 11, fill: '#9ca3af' }}
                domain={metric === 'completion' ? [0, 100] : [0, 'auto']}
                tickFormatter={(v: number) => (metric === 'completion' ? `${v}%` : String(v))}
                axisLine={false}
                tickLine={false}
              />
              <Tooltip
                cursor={{ fill: '#f9fafb' }}
                contentStyle={{ borderRadius: 12, border: '2px solid #e5e7eb', fontSize: 12 }}
                formatter={(value) =>
                  metric === 'completion'
                    ? [`${value}%`, 'Completion']
                    : [`${value} ⭐`, 'Current Value']
                }
              />
              <Bar dataKey={metric} radius={[8, 8, 0, 0]}>
                {weeklyData.map((_, i) => (
                  <Cell
                    key={i}
                    fill={metric === 'stickers' ? '#fbbf24' : '#34d399'}
                    opacity={i === weeklyData.length - 1 ? 1 : 0.6}
                  />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        )}

        <p className="text-xs text-gray-400 text-center mt-2">
          {metric === 'stickers'
            ? 'Current Value per week (stickers × bonus × investment)'
            : 'Habit consistency per week (days done / total possible days)'}{' '}
          · Latest week is brightest
        </p>
      </div>

      {/* ── 3. Habit Leaderboard ── */}
      <div
        data-testid="analytics-leaderboard"
        className="bg-white border-2 sm:border-3 border-black rounded-2xl p-4 sm:p-5 shadow-neo"
      >
        <div className="flex items-center gap-2 mb-5">
          <Trophy className="w-5 h-5 text-amber-500" />
          <h3 className="text-base font-black text-gray-800">Habit Leaderboard</h3>
          <span className="ml-auto text-xs text-gray-400 font-medium">sorted by success rate</span>
        </div>

        {habitStats.length === 0 ? (
          <div
            data-testid="analytics-leaderboard-empty"
            className="text-center text-sm font-bold text-gray-400 py-8"
          >
            No habits yet.
          </div>
        ) : (
          <div className="space-y-4">
            {habitStats.map((habit, i) => {
              const style = getRateStyle(habit.rate);
              return (
                <div key={habit.habitId}>
                  <div className="flex items-center justify-between mb-1.5">
                    <div className="flex items-center gap-2 flex-1 min-w-0 pr-3">
                      <span className="text-xs font-black text-gray-300 w-4 flex-shrink-0">
                        {i + 1}
                      </span>
                      <span className="text-sm font-bold text-gray-700 truncate">{habit.name}</span>
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      <span
                        className={`text-xs font-black px-2 py-0.5 rounded-full ${style.badge}`}
                      >
                        {habit.rate}%
                      </span>
                      <span className="text-xs text-gray-400 font-medium w-24 text-right whitespace-nowrap">
                        {habit.total} of {habit.totalPossible} days
                      </span>
                    </div>
                  </div>
                  <div className="w-full bg-gray-100 rounded-full h-2.5 overflow-hidden">
                    <div
                      className={`h-full ${style.bar} rounded-full transition-all`}
                      style={{ width: `${habit.rate}%` }}
                    ></div>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Legend */}
        <div className="flex items-center gap-4 mt-5 pt-4 border-t border-gray-100 flex-wrap">
          <div className="flex items-center gap-1.5">
            <div className="w-2.5 h-2.5 rounded-full bg-emerald-400"></div>
            <span className="text-xs text-gray-500">Great (≥50%)</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-2.5 h-2.5 rounded-full bg-amber-400"></div>
            <span className="text-xs text-gray-500">Good (35–49%)</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-2.5 h-2.5 rounded-full bg-rose-400"></div>
            <span className="text-xs text-gray-500">Keep going (&lt;35%)</span>
          </div>
        </div>
      </div>
    </div>
  );
}
