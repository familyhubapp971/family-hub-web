import { useMemo, useRef, useState, type KeyboardEvent } from 'react';
import { motion } from 'framer-motion';
import { BarChart2, Check, ChevronLeft, ChevronRight, Lock, Sparkles, Star } from 'lucide-react';
import { useKidMyWorld } from './useKidMyWorld';
import { weekRangeLabel } from './icons';
import { KidHabitCard } from './KidHabitCard';
import { KidMoneySkills } from './KidMoneySkills';
import { KidRewardShop } from './KidRewardShop';
import { KidWeeklyAccount } from './KidWeeklyAccount';
import { KidStats } from './KidStats';
import { KidFinishedWeekRecap } from './KidFinishedWeekRecap';
import { formatMoney } from '@familyhub/shared';

// FHS-376: the dedicated kid "My World". A DISTINCT design from the parent's
// MyWorldTab (which this no longer reuses): a Weekly Habits / Analytics toggle,
// the kid's own week banner + read-only habit cards, a Money Skills explainer,
// and a Reward Goals + My Account sidebar: all pixel-matched to the Magic
// Patterns kid mock and fed by the self-scoped /api/kid/* endpoints.

type View = 'habits' | 'analytics';

// FIX 2 (BLOCKER): a rate <= 0 must never be divided by (Infinity/NaN
// stickers). Mirrors the api's cashAsStickers guard (family-hub-api/src/areas/my-world/myworld.ts).
function stickersFromCash(cash: number, rate: number): number {
  return rate <= 0 ? 0 : cash / rate;
}

export function KidMyWorld({
  kidToken,
  displayName,
}: {
  kidToken: string | null;
  displayName: string;
}) {
  const [view, setView] = useState<View>('habits');
  // Only the first successful load plays the slide-in; a retry/remount (e.g.
  // after the error state) should not re-animate (FHS-377).
  const animatedOnce = useRef(false);
  // Refs for the roving-tabindex keyboard pattern on the Habits/Analytics tabs.
  const habitsTabRef = useRef<HTMLButtonElement>(null);
  const analyticsTabRef = useRef<HTMLButtonElement>(null);
  const data = useKidMyWorld(kidToken);

  // FHS-399: stable auth headers for the KidFinishedWeekRecap fetch.
  // Declared here (before any early return) so hook order is always stable.
  const recapHeaders = useMemo(
    () => (kidToken ? { Authorization: `Bearer ${kidToken}` } : {}),
    [kidToken],
  );

  // APG tabs pattern: Left/Right (and Home/End) move between tabs + activate.
  const onTabKeyDown = (e: KeyboardEvent<HTMLButtonElement>) => {
    let next: View | null = null;
    if (e.key === 'ArrowRight' || e.key === 'End') next = 'analytics';
    else if (e.key === 'ArrowLeft' || e.key === 'Home') next = 'habits';
    if (!next) return;
    e.preventDefault();
    setView(next);
    (next === 'habits' ? habitsTabRef : analyticsTabRef).current?.focus();
  };

  if (data.status === 'loading') {
    return (
      <div
        data-testid="kid-myworld-loading"
        role="status"
        aria-busy="true"
        className="rounded-xl border-2 border-black bg-white p-8 text-center shadow-neo-sm"
      >
        <Sparkles
          size={36}
          className="mx-auto text-pink-400 motion-safe:animate-pulse"
          aria-hidden="true"
        />
        <p className="mt-3 font-heading uppercase tracking-wide text-gray-700">
          Loading your world…
        </p>
      </div>
    );
  }

  if (data.status === 'error') {
    return (
      <div
        data-testid="kid-myworld-error"
        role="alert"
        className="rounded-xl border-2 border-black bg-white p-8 text-center shadow-neo-sm"
      >
        <p className="text-5xl" aria-hidden="true">
          😕
        </p>
        <p className="mt-3 font-heading uppercase tracking-wide text-gray-700">
          We couldn&rsquo;t load your world
        </p>
        <button
          type="button"
          onClick={data.reload}
          className="mt-4 rounded-lg border-2 border-black bg-pink-400 px-5 py-2.5 font-heading text-sm uppercase text-black shadow-neo-xs transition-transform motion-safe:hover:-translate-y-0.5"
        >
          Try again
        </button>
      </div>
    );
  }

  const week = data.weeks[data.weekIndex];
  const doneThisView = data.habits.reduce((sum, h) => sum + h.progress, 0);
  const totalThisView = data.habits.length * 7;

  // ── economy-derived numbers ──────────────────────────────────────────────
  const savedStickers = data.savings?.savedStickers ?? 0;
  const savedCash = data.savings?.savedCash ?? 0;
  const currency = data.savings?.currency ?? data.currency;
  // FHS-387: use the API-supplied rate; fall back to 0.5 if the server is old.
  const stickerRate = data.savings?.stickerRate ?? 0.5;
  // FHS-376: a reward request is paid from SAVINGS on approval, so Reward Goals
  // affordability + "more to go" are measured against savings (banked stars +
  // banked cash at stickerRate/star), not the spendable week balance.
  const savingsStars = savedStickers + Math.floor(stickersFromCash(savedCash, stickerRate));
  const planted = data.investments.reduce((s, inv) => s + inv.originalInvestedStickers, 0);
  const bonus = Math.max(
    0,
    data.investments.reduce(
      (s, inv) => s + (inv.currentValueStickers - inv.originalInvestedStickers),
      0,
    ),
  );

  // My Account "earned this week" = sum of the live week's habit progress.
  const earnedThisWeek = doneThisView;
  const weeklyValue = formatMoney(earnedThisWeek * stickerRate, currency);

  const playEnter = !animatedOnce.current;
  animatedOnce.current = true;
  const panelLabelId = view === 'habits' ? 'kid-myworld-tab-habits' : 'kid-myworld-tab-analytics';

  // FHS-399: on a finalized week the page is single-column: navigator + banner
  // + habit rows + "What I Did That Week" recap. The live (current) week keeps
  // the existing two-column layout (habits + right sidebar).
  const isFinalized = !data.isCurrentWeek;

  return (
    <motion.div
      data-testid="kid-myworld"
      className={`grid grid-cols-1 gap-6 ${isFinalized ? '' : 'lg:grid-cols-12'}`}
      initial={playEnter ? { opacity: 0, y: 12 } : false}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
    >
      {/* LEFT column (full-width on finalized; 8/12 on live) */}
      <div className={`flex flex-col gap-4 ${isFinalized ? '' : 'lg:col-span-8'}`}>
        {/* Toggle */}
        <div
          role="tablist"
          aria-label="My World view"
          className="flex gap-1 rounded-xl border-2 border-black bg-white p-1.5 shadow-neo-sm"
        >
          <button
            type="button"
            role="tab"
            ref={habitsTabRef}
            id="kid-myworld-tab-habits"
            aria-controls="kid-myworld-panel"
            aria-selected={view === 'habits'}
            tabIndex={view === 'habits' ? 0 : -1}
            data-testid="kid-myworld-habits-tab"
            onKeyDown={onTabKeyDown}
            onClick={() => setView('habits')}
            className={`flex flex-1 items-center justify-center gap-2 rounded-lg px-4 py-2.5 font-heading text-sm uppercase tracking-wide transition-colors ${
              view === 'habits'
                ? 'border-2 border-black bg-gradient-to-r from-purple-500 to-pink-500 text-white'
                : 'border-2 border-transparent text-gray-500'
            }`}
          >
            <Check size={16} aria-hidden="true" /> Weekly Habits
          </button>
          <button
            type="button"
            role="tab"
            ref={analyticsTabRef}
            id="kid-myworld-tab-analytics"
            aria-controls="kid-myworld-panel"
            aria-selected={view === 'analytics'}
            tabIndex={view === 'analytics' ? 0 : -1}
            data-testid="kid-myworld-stats-tab"
            onKeyDown={onTabKeyDown}
            onClick={() => setView('analytics')}
            className={`flex flex-1 items-center justify-center gap-2 rounded-lg px-4 py-2.5 font-heading text-sm uppercase tracking-wide transition-colors ${
              view === 'analytics'
                ? 'border-2 border-black bg-gradient-to-r from-purple-500 to-pink-500 text-white'
                : 'border-2 border-transparent text-gray-500'
            }`}
          >
            <BarChart2 size={16} aria-hidden="true" /> Analytics
          </button>
        </div>

        <div
          role="tabpanel"
          id="kid-myworld-panel"
          aria-labelledby={panelLabelId}
          // No tabIndex: the panel has focusable children (week nav, retry), so
          // per the APG tabs pattern it isn't itself a tab stop: Tab moves from
          // the active tab straight into the panel's controls.
          className="flex flex-col gap-4"
        >
          {view === 'habits' ? (
            <>
              {/* Week banner */}
              {week && (
                <div className="flex items-center gap-3 rounded-xl border-2 border-black bg-gradient-to-br from-[#6b21a8] to-[#7e22ce] p-6 text-white shadow-neo-sm">
                  <button
                    type="button"
                    aria-label="Previous week"
                    data-testid="kid-week-prev"
                    onClick={data.goPrevWeek}
                    disabled={data.weekIndex === 0}
                    className="grid h-11 w-11 shrink-0 place-items-center rounded-full border-2 border-black bg-white text-black transition-transform disabled:opacity-30 motion-safe:hover:-translate-y-0.5"
                  >
                    <ChevronLeft size={20} strokeWidth={3} aria-hidden="true" />
                  </button>

                  <div className="flex-1 text-center">
                    <div className="flex items-center justify-center gap-2">
                      <h2 className="font-heading text-xl uppercase tracking-wide">
                        Week {week.weekNumber}, {week.year}
                      </h2>
                      <span
                        className={`rounded-full border-2 border-black px-2 py-0.5 text-[10px] font-bold uppercase ${
                          week.isFinalized
                            ? 'bg-green-300 text-black'
                            : data.isFutureWeek
                              ? 'bg-gray-200 text-black'
                              : 'bg-yellow-300 text-black'
                        }`}
                      >
                        {week.isFinalized
                          ? '✓ Finalized'
                          : data.isFutureWeek
                            ? '🔒 Not Started'
                            : 'Current'}
                      </span>
                    </div>
                    <p className="mt-1 text-xs font-bold uppercase tracking-wider text-purple-200">
                      {weekRangeLabel(week.startDate)}
                    </p>
                    <p className="mt-1 font-heading text-sm text-yellow-300">
                      {doneThisView}/{totalThisView} DONE ✨
                    </p>
                  </div>

                  <button
                    type="button"
                    aria-label="Next week"
                    data-testid="kid-week-next"
                    onClick={data.goNextWeek}
                    disabled={data.isCurrentWeek}
                    className="grid h-11 w-11 shrink-0 place-items-center rounded-full border-2 border-black bg-white text-black transition-transform disabled:opacity-30 motion-safe:hover:-translate-y-0.5"
                  >
                    <ChevronRight size={20} strokeWidth={3} aria-hidden="true" />
                  </button>
                </div>
              )}

              {/* My Habits label row */}
              <div className="flex items-center gap-3">
                <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full border-2 border-black bg-pink-300 shadow-neo-xs">
                  <Star size={16} strokeWidth={3} aria-hidden="true" />
                </span>
                <span className="font-heading text-sm uppercase tracking-widest text-pink-300">
                  My Habits
                </span>
                <span className="h-0.5 flex-1 rounded-full bg-pink-200" aria-hidden="true" />
              </div>

              {/* Progress banner: locked for a future week, live for current
                  week, recap for finalized (FHS-484). */}
              {week && data.isFutureWeek ? (
                <div
                  data-testid="kid-future-week-banner"
                  className="flex items-center gap-4 rounded-xl border-2 border-black bg-white p-5 shadow-neo-sm"
                >
                  <span className="grid h-16 w-16 shrink-0 place-items-center rounded-full border-2 border-black bg-gray-100 text-3xl">
                    <span aria-hidden="true">🔒</span>
                  </span>
                  <div className="min-w-0 flex-1">
                    <h3 className="font-heading text-base text-black">
                      This week hasn&rsquo;t started yet
                    </h3>
                    <p className="mt-1 text-sm font-bold text-gray-700">
                      Come back on{' '}
                      {new Date(`${week.startDate}T00:00:00`).toLocaleDateString('en-US', {
                        month: 'short',
                        day: 'numeric',
                      })}{' '}
                      to start logging habits. 🕒
                    </p>
                  </div>
                </div>
              ) : week && !data.isCurrentWeek ? (
                <div
                  data-testid="kid-finished-week-banner"
                  className="flex items-center gap-4 rounded-xl border-2 border-black bg-white p-5 shadow-neo-sm"
                >
                  <span className="grid h-16 w-16 shrink-0 place-items-center rounded-full border-2 border-black bg-green-100 text-3xl">
                    <span aria-hidden="true">🎉</span>
                  </span>
                  <div className="min-w-0 flex-1">
                    <h3 className="font-heading text-base text-black">
                      You&rsquo;re looking at a finished week!
                    </h3>
                    <p className="mt-1 text-sm font-bold text-gray-700">
                      {(() => {
                        const pct =
                          totalThisView > 0
                            ? Math.min(100, Math.round((doneThisView / totalThisView) * 100))
                            : 0;
                        return (
                          <>
                            You finished{' '}
                            <span className="font-heading text-green-700">
                              {doneThisView} out of {totalThisView}
                            </span>{' '}
                            habit days ({pct}%)!{' '}
                            {pct >= 50
                              ? 'Amazing work, you crushed it! 🌟'
                              : 'Every habit you did was a win. Keep going next week! 💪'}
                          </>
                        );
                      })()}
                    </p>
                    <div
                      role="progressbar"
                      aria-valuenow={doneThisView}
                      aria-valuemin={0}
                      aria-valuemax={totalThisView}
                      aria-label="Habit days completed that week"
                      className="mt-2 h-3 w-full overflow-hidden rounded-full border-2 border-black bg-gray-100"
                    >
                      <div
                        className="h-full bg-green-400"
                        style={{
                          width: `${totalThisView > 0 ? (doneThisView / totalThisView) * 100 : 0}%`,
                        }}
                      />
                    </div>
                  </div>
                </div>
              ) : (
                <div className="flex items-center gap-4 rounded-xl border-2 border-black bg-white p-5 shadow-neo-sm">
                  <span className="grid h-16 w-16 shrink-0 place-items-center rounded-full border-2 border-black bg-yellow-100 text-3xl">
                    <span aria-hidden="true">🎯</span>
                  </span>
                  <div className="min-w-0 flex-1">
                    <h3 className="font-heading text-base text-black">
                      How are you doing this week?
                    </h3>
                    <p className="mt-1 text-sm font-bold text-gray-700">
                      You&rsquo;ve completed {doneThisView} out of {totalThisView} habit days! Keep
                      it up!
                    </p>
                    <div
                      role="progressbar"
                      aria-valuenow={doneThisView}
                      aria-valuemin={0}
                      aria-valuemax={totalThisView}
                      aria-label="Habit days completed this week"
                      className="mt-2 h-3 w-full overflow-hidden rounded-full border-2 border-black bg-gray-100"
                    >
                      <div
                        className="h-full bg-green-400"
                        style={{
                          width: `${totalThisView > 0 ? (doneThisView / totalThisView) * 100 : 0}%`,
                        }}
                      />
                    </div>
                  </div>
                </div>
              )}

              {/* Habit cards: spinner while a navigated week loads, retry on
                failure, then the real empty/cards state (FHS-377). A future
                week (not yet started) blurs the cards under a lock overlay
                instead: nothing to log or view yet (FHS-484). */}
              <div className="relative">
                {data.isFutureWeek && data.habits.length > 0 && (
                  <div
                    data-testid="kid-future-week-lock"
                    className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-2 rounded-xl border-2 border-black bg-white/70 p-6 text-center backdrop-blur-sm"
                  >
                    <span className="grid h-12 w-12 place-items-center rounded-full border-2 border-black bg-gray-200 shadow-neo-xs">
                      <Lock size={20} className="text-black" aria-hidden="true" />
                    </span>
                    <p className="font-heading text-sm uppercase tracking-wide text-black">
                      Locked until this week starts
                    </p>
                  </div>
                )}
                <div
                  className={data.isFutureWeek ? 'pointer-events-none select-none blur-[2px]' : ''}
                  aria-hidden={data.isFutureWeek || undefined}
                >
                  {data.viewWeekStatus === 'loading' ? (
                    <div
                      data-testid="kid-week-loading"
                      role="status"
                      aria-busy="true"
                      className="rounded-xl border-2 border-black bg-white p-8 text-center shadow-neo-sm"
                    >
                      <Sparkles
                        size={32}
                        className="mx-auto text-pink-400 motion-safe:animate-pulse"
                        aria-hidden="true"
                      />
                      <p className="mt-3 text-sm font-bold text-gray-600">Loading this week…</p>
                    </div>
                  ) : data.viewWeekStatus === 'error' ? (
                    <div
                      data-testid="kid-week-error"
                      role="alert"
                      className="rounded-xl border-2 border-black bg-white p-8 text-center shadow-neo-sm"
                    >
                      <p className="text-4xl" aria-hidden="true">
                        😕
                      </p>
                      <p className="mt-3 text-sm font-bold text-gray-600">
                        We couldn&rsquo;t load this week.
                      </p>
                      <button
                        type="button"
                        data-testid="kid-week-retry"
                        onClick={data.retryWeek}
                        className="mt-4 rounded-lg border-2 border-black bg-pink-400 px-5 py-2.5 font-heading text-sm uppercase text-black shadow-neo-xs transition-transform motion-safe:hover:-translate-y-0.5"
                      >
                        Try again
                      </button>
                    </div>
                  ) : data.habits.length === 0 ? (
                    <div className="rounded-xl border-2 border-black bg-white p-8 text-center shadow-neo-sm">
                      <p className="text-5xl" aria-hidden="true">
                        🌱
                      </p>
                      <p className="mt-3 text-sm font-bold text-gray-600">
                        No habits yet. Ask a grown-up to add some!
                      </p>
                    </div>
                  ) : (
                    <div className="flex flex-col gap-4">
                      {data.habits.map((h) => (
                        <KidHabitCard
                          key={h.id}
                          habit={h}
                          isCurrentWeek={data.isCurrentWeek && !data.isFutureWeek}
                        />
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {/* FHS-399: finalized week: show the recap card.
                  Live week: show Money Skills. */}
              {isFinalized ? (
                week && (
                  <KidFinishedWeekRecap
                    weekId={week.id}
                    headers={recapHeaders}
                    earnedThisWeek={earnedThisWeek}
                    stickerRate={stickerRate}
                    currency={currency}
                    doneThisView={doneThisView}
                    totalThisView={totalThisView}
                  />
                )
              ) : (
                <KidMoneySkills
                  stickerBalance={data.balance}
                  savedStickers={savedStickers}
                  savedCash={savedCash}
                  currency={currency}
                  stickerRate={stickerRate}
                  planted={planted}
                  bonus={bonus}
                  hasInvestments={data.investments.length > 0}
                  isFinalized={false}
                />
              )}
            </>
          ) : (
            <KidStats
              name={displayName}
              analytics={data.analytics}
              habits={data.habits}
              savedCash={savedCash}
              currency={currency}
            />
          )}
        </div>
      </div>

      {/* RIGHT column: live weeks only. Hidden on finalized weeks (single-column). */}
      {!isFinalized && (
        <div className="flex flex-col gap-6 lg:col-span-4">
          <KidRewardShop
            rewards={data.rewards}
            savingsStars={savingsStars}
            onRequest={data.requestReward}
          />
          <KidWeeklyAccount
            habits={data.habits}
            earnedThisWeek={earnedThisWeek}
            weeklyValue={weeklyValue}
            currency={currency}
            stickerRate={stickerRate}
          />
        </div>
      )}
    </motion.div>
  );
}
