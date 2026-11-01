/**
 * KidsMoneyPage: FHS-622
 *
 * Replaces the FHS-621 wrapper (which rendered the legacy AdminPanelPage's
 * Balance/Savings/History tabs) with the designed page: one child at a time,
 * what they have, what a parent can do with it, and week by week what
 * happened. Every figure below comes from the endpoints FHS-627 documented
 * (GET /api/mw/weeks*, /api/mw/financial/*, /api/members): nothing here is
 * invented client-side.
 *
 * Ported from the Magic Patterns design (editor kudjspxd3xxroueg5jw11o,
 * pages/KidsMoney.tsx). Deviations from the mock are called out inline and
 * in documents/features/kids-money.md.
 */

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
  AlertTriangle,
  ArrowLeft,
  Check,
  ChevronDown,
  Gift,
  PiggyBank,
  RefreshCw,
  ShieldCheck,
  Sliders,
  TrendingDown,
  TrendingUp,
  Wallet,
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { Button } from '@familyhub/ui';
import {
  formatMoney,
  isGrownUpRole,
  isKidRole,
  summariseWeekActions,
  type WeekActionLike,
} from '@familyhub/shared';
import { useAuth } from '../../app/lib/auth-context';
import { useTenantSlug } from '../../app/lib/tenant-context';
import { API_BASE } from '../../app/lib/api';
import { AppHeader } from '../../app/layout/AppHeader';
import { DEFAULT_TAB } from '../../app/layout/dashboard-tabs';
import { MoneyActionsSheet } from './MoneyActionsSheet';

// ── Types ────────────────────────────────────────────────────────────────────

interface KidRow {
  id: string;
  displayName: string;
  role: string;
  avatarEmoji: string | null;
}

/** What one child has right now, all in stickers plus the money they're worth. */
export interface ChildMoneySnapshot {
  available: number;
  saved: number;
  invested: number;
  currency: string;
  stickerRate: number;
}

interface WeekListItem {
  id: string;
  weekNumber: number;
  year: number;
  startDate: string;
  isFinalized: boolean;
  /** null until its own /stats fetch resolves (loaded eagerly for the
   * visible slice, lazily for older weeks once "show older" is used). */
  earned: number | null;
}

interface WeekBreakdown {
  saved: number;
  invested: number;
  spent: number;
  cashedOut: number;
}

/** Kept as `MoneyAction` (not `MoneyActionId`) to match the design's own
 * type name 1:1, so FHS-623 can port `components/MoneyActions.tsx` and its
 * `action` prop straight onto this page's `onMoneyAction` callback. */
export type MoneyAction = 'claim' | 'cash' | 'save' | 'invest' | 'withdraw';

export interface KidsMoneyPageProps {
  /**
   * FHS-622/623 seam: called when a parent taps a money action button.
   * Left undefined here on purpose: this ticket renders the buttons, FHS-623
   * builds the sheet they open. Until that lands, tapping a button is a
   * documented no-op (see documents/features/kids-money.md).
   */
  onMoneyAction?: (action: MoneyAction, child: { id: string; name: string }) => void;
}

type LoadState = 'loading' | 'ready' | 'error';

const WEEKS_SHOWN = 6;

// ── Fetch helpers ────────────────────────────────────────────────────────────

async function fetchJson<T>(url: string, headers: Record<string, string>): Promise<T> {
  const res = await fetch(url, { headers });
  if (!res.ok) throw new Error(`request failed: ${url} (${res.status})`);
  return (await res.json()) as T;
}

async function fetchWeekEarned(
  weekId: string,
  memberId: string,
  headers: Record<string, string>,
): Promise<number> {
  const body = await fetchJson<{ totalStickers: number }>(
    `${API_BASE}/api/mw/weeks/${weekId}/stats?memberId=${memberId}`,
    headers,
  );
  return body.totalStickers;
}

async function fetchWeekBreakdown(
  weekId: string,
  memberId: string,
  headers: Record<string, string>,
): Promise<WeekBreakdown> {
  const body = await fetchJson<{ actions: WeekActionLike[] }>(
    `${API_BASE}/api/mw/weeks/${weekId}/actions?memberId=${memberId}`,
    headers,
  );
  const outcome = summariseWeekActions(body.actions);
  return {
    saved: outcome.saved,
    invested: outcome.invested,
    spent: outcome.spent,
    cashedOut: outcome.cashedOut,
  };
}

async function fetchChildMoney(
  memberId: string,
  headers: Record<string, string>,
): Promise<{ snapshot: ChildMoneySnapshot; weeks: WeekListItem[]; currentWeekId: string }> {
  const [currentWeekBody, savings, investmentsBody, weeksBody] = await Promise.all([
    fetchJson<{ week: { id: string } }>(
      `${API_BASE}/api/mw/weeks/current?memberId=${memberId}`,
      headers,
    ),
    fetchJson<{ savedStickers: number; currency: string; stickerRate: number }>(
      `${API_BASE}/api/mw/financial/savings?memberId=${memberId}`,
      headers,
    ),
    fetchJson<{ investments: Array<{ currentValueStickers: number }> }>(
      `${API_BASE}/api/mw/financial/investments?memberId=${memberId}`,
      headers,
    ),
    fetchJson<{
      weeks: Array<{
        id: string;
        weekNumber: number;
        year: number;
        startDate: string;
        isFinalized: boolean;
      }>;
    }>(`${API_BASE}/api/mw/weeks?memberId=${memberId}`, headers),
  ]);

  const stats = await fetchJson<{ unallocatedStickers: number; totalStickers: number }>(
    `${API_BASE}/api/mw/weeks/${currentWeekBody.week.id}/stats?memberId=${memberId}`,
    headers,
  );

  const invested = investmentsBody.investments.reduce(
    (sum, inv) => sum + inv.currentValueStickers,
    0,
  );

  // The API lists oldest first; the page reads newest first.
  const ordered = [...weeksBody.weeks].reverse();
  const visible = ordered.slice(0, WEEKS_SHOWN);
  const rest = ordered.slice(WEEKS_SHOWN);

  // The current week's stats were already fetched above for "ready to
  // spend" (unallocatedStickers), and the same response's totalStickers is
  // that week's own "earned" figure, so it never needs a second /stats call.
  const visibleWithEarned = await Promise.all(
    visible.map(async (w) => ({
      ...w,
      earned:
        w.id === currentWeekBody.week.id
          ? stats.totalStickers
          : await fetchWeekEarned(w.id, memberId, headers),
    })),
  );

  return {
    snapshot: {
      available: stats.unallocatedStickers,
      saved: savings.savedStickers,
      invested,
      currency: savings.currency,
      stickerRate: savings.stickerRate,
    },
    weeks: [...visibleWithEarned, ...rest.map((w) => ({ ...w, earned: null }))],
    currentWeekId: currentWeekBody.week.id,
  };
}

// ── Small helpers ────────────────────────────────────────────────────────────

function initial(name: string): string {
  return [...name.trim()][0]?.toUpperCase() ?? '?';
}

// Deterministic per-child colour: the design's mock invented a `color` field
// the API doesn't have. Hashing the id keeps a child's tile colour stable
// across sessions without adding a field nothing else needs.
const AVATAR_TONES = [
  'bg-yellow-300',
  'bg-purple-300',
  'bg-cyan-300',
  'bg-pink-300',
  'bg-lime-300',
];
function avatarTone(id: string): string {
  let hash = 0;
  for (let i = 0; i < id.length; i += 1) hash = (hash * 31 + id.charCodeAt(i)) >>> 0;
  return AVATAR_TONES[hash % AVATAR_TONES.length]!;
}

function stickerMoney(stickers: number, snapshot: ChildMoneySnapshot): string {
  return formatMoney(stickers * snapshot.stickerRate, snapshot.currency);
}

function weekDateRange(startDate: string): string | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(startDate)) return null;
  const [y, m, d] = startDate.split('-').map((s) => Number.parseInt(s, 10));
  const start = new Date(Date.UTC(y!, m! - 1, d!));
  const end = new Date(start);
  end.setUTCDate(end.getUTCDate() + 6);
  const fmt = (dt: Date) =>
    dt.toLocaleDateString(undefined, { day: 'numeric', month: 'short', timeZone: 'UTC' });
  return `${fmt(start)} to ${fmt(end)}`;
}

// ── Child picker ─────────────────────────────────────────────────────────────

function ChildPicker({
  kids,
  activeId,
  onPick,
}: {
  kids: KidRow[];
  activeId: string;
  onPick: (id: string) => void;
}) {
  if (kids.length <= 1) {
    const child = kids[0];
    if (!child) return null;
    return (
      <div
        data-testid="kids-money-child-single"
        className="flex items-center gap-3 rounded-xl border-2 border-black bg-white p-3 shadow-neo-sm"
      >
        <span
          aria-hidden="true"
          className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-full border-2 border-black font-heading text-lg ${avatarTone(child.id)}`}
        >
          {child.avatarEmoji ?? initial(child.displayName)}
        </span>
        <span>
          <span className="block font-heading text-lg leading-none">{child.displayName}</span>
          <span className="text-xs font-bold text-gray-500">Your only child in the family</span>
        </span>
      </div>
    );
  }

  return (
    <div data-testid="kids-money-child-picker">
      <p className="mb-2 text-xs font-bold uppercase tracking-widest text-purple-200">
        Whose money?
      </p>
      <div className="flex flex-wrap gap-2" role="tablist">
        {kids.map((child) => {
          const active = child.id === activeId;
          return (
            <button
              key={child.id}
              type="button"
              role="tab"
              aria-selected={active}
              data-testid={`kids-money-child-${child.id}`}
              onClick={() => onPick(child.id)}
              className={`flex min-h-[48px] items-center gap-2.5 rounded-full border-2 border-black py-1.5 pl-1.5 pr-4 font-bold shadow-neo-xs transition-transform hover:-translate-y-0.5 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-yellow-300 ${
                active ? 'bg-pastel-yellow text-black' : 'bg-white text-black'
              }`}
            >
              <span
                aria-hidden="true"
                className={`flex h-9 w-9 items-center justify-center rounded-full border-2 border-black font-heading ${avatarTone(child.id)}`}
              >
                {child.avatarEmoji ?? initial(child.displayName)}
              </span>
              {child.displayName}
              {active && <Check size={16} strokeWidth={3} aria-hidden className="ml-1" />}
            </button>
          );
        })}
      </div>
    </div>
  );
}

// ── What they have ───────────────────────────────────────────────────────────

function Figure({
  label,
  stickers,
  snapshot,
  tone,
  testId,
}: {
  label: string;
  stickers: number;
  snapshot: ChildMoneySnapshot;
  tone: string;
  testId: string;
}) {
  return (
    <div className={`rounded-xl border-2 border-black ${tone} p-3`} data-testid={testId}>
      <p className="text-xs font-bold uppercase tracking-widest text-black/70">{label}</p>
      <p className="mt-1 font-heading text-2xl">{stickers} stickers</p>
      <p className="text-sm font-bold text-black/70">{stickerMoney(stickers, snapshot)}</p>
    </div>
  );
}

function MoneyNow({ name, snapshot }: { name: string; snapshot: ChildMoneySnapshot }) {
  const total = snapshot.available + snapshot.saved + snapshot.invested;
  const nothingYet = total === 0;

  return (
    <section className="rounded-xl border-2 border-black bg-white p-5 shadow-neo-sm">
      <h2 className="font-heading text-xl uppercase tracking-wide">What {name} has</h2>

      {nothingYet ? (
        <p className="mt-3 font-bold text-gray-600" data-testid="kids-money-nothing-yet">
          Once {name} finishes a habit, their stickers will show up here.
        </p>
      ) : (
        <>
          <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-3">
            <Figure
              label="Ready to spend"
              stickers={snapshot.available}
              snapshot={snapshot}
              tone="bg-pastel-cyan"
              testId="kids-money-figure-available"
            />
            <Figure
              label="In savings"
              stickers={snapshot.saved}
              snapshot={snapshot}
              tone="bg-pastel-lime"
              testId="kids-money-figure-saved"
            />
            <Figure
              label="Growing"
              stickers={snapshot.invested}
              snapshot={snapshot}
              tone="bg-pastel-yellow"
              testId="kids-money-figure-invested"
            />
          </div>

          <div className="mt-4 flex items-center justify-between gap-3 border-t-2 border-gray-100 pt-4">
            <span className="font-bold">Everything together</span>
            <span
              className="whitespace-nowrap font-heading text-2xl"
              data-testid="kids-money-total"
            >
              {total} stickers
              <span className="ml-2 text-base text-green-700">{stickerMoney(total, snapshot)}</span>
            </span>
          </div>
        </>
      )}
    </section>
  );
}

// ── Do something with it ─────────────────────────────────────────────────────

const ACTIONS: Array<{
  id: MoneyAction;
  icon: React.ReactNode;
  tone: string;
  label: string;
  note: string;
}> = [
  {
    id: 'claim',
    icon: <Gift size={20} strokeWidth={3} />,
    tone: 'bg-pink-300',
    label: 'Claim a reward',
    note: 'Swap stickers for something from the shop.',
  },
  {
    id: 'cash',
    icon: <Wallet size={20} strokeWidth={3} />,
    tone: 'bg-lime-300',
    label: 'Cash out',
    note: 'Hand over real money and take the stickers off.',
  },
  {
    id: 'save',
    icon: <PiggyBank size={20} strokeWidth={3} />,
    tone: 'bg-cyan-300',
    label: 'Move to savings',
    note: 'Keep stickers safe in savings for later.',
  },
  {
    id: 'invest',
    icon: <TrendingUp size={20} strokeWidth={3} />,
    tone: 'bg-yellow-300',
    label: 'Invest and grow',
    note: 'Let stickers grow week by week.',
  },
];

function Actions({
  name,
  childId,
  snapshot,
  onMoneyAction,
}: {
  name: string;
  childId: string;
  snapshot: ChildMoneySnapshot;
  onMoneyAction?: ((action: MoneyAction, child: { id: string; name: string }) => void) | undefined;
}) {
  const empty = snapshot.available === 0;
  const fire = (action: MoneyAction) => onMoneyAction?.(action, { id: childId, name });

  return (
    <section className="rounded-xl border-2 border-black bg-white p-5 shadow-neo-sm">
      <h2 className="font-heading text-xl uppercase tracking-wide">Do something with it</h2>

      {empty ? (
        <p className="mt-3 font-bold text-gray-600" data-testid="kids-money-actions-empty">
          There is nothing to move yet. These become available once {name} has stickers ready to
          spend.
        </p>
      ) : (
        <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
          {ACTIONS.map((action) => (
            <button
              key={action.id}
              type="button"
              data-testid={`kids-money-action-${action.id}`}
              onClick={() => fire(action.id)}
              className={`flex min-h-[64px] items-start gap-3 rounded-xl border-2 border-black ${action.tone} p-3 text-left shadow-neo-xs transition-transform hover:-translate-y-0.5 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-kingdom-500`}
            >
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border-2 border-black bg-white">
                {action.icon}
              </span>
              <span className="min-w-0">
                <span className="block font-heading text-base leading-tight">{action.label}</span>
                <span className="text-xs font-bold text-black/70">{action.note}</span>
              </span>
            </button>
          ))}
        </div>
      )}

      {snapshot.invested > 0 && (
        <button
          type="button"
          data-testid="kids-money-action-withdraw"
          onClick={() => fire('withdraw')}
          className="mt-3 flex min-h-[56px] w-full items-center gap-3 rounded-xl border-2 border-black bg-orange-300 p-3 text-left shadow-neo-xs transition-transform hover:-translate-y-0.5 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-kingdom-500"
        >
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border-2 border-black bg-white">
            <TrendingDown size={20} strokeWidth={3} />
          </span>
          <span className="min-w-0">
            <span className="block font-heading text-base leading-tight">
              Take money out of an investment
            </span>
            <span className="text-xs font-bold text-gray-600">
              Stop one early and put it back in savings.
            </span>
          </span>
        </button>
      )}

      {/* FHS-625: this used to read "As an admin you can do these", which was
          true while the page was admin-only. Any grown-up can open it now, so
          an adult was being told they were an admin while using it. */}
      <p className="mt-4 flex items-start gap-2 border-t-2 border-gray-100 pt-4 text-sm font-bold text-gray-600">
        <ShieldCheck size={16} strokeWidth={3} className="mt-0.5 shrink-0" />
        Any grown-up in the family can do these on any day. Kids cannot.
      </p>
    </section>
  );
}

// ── Week by week ──────────────────────────────────────────────────────────────

function WeekRow({
  week,
  memberId,
  headers,
}: {
  week: WeekListItem;
  memberId: string;
  headers: Record<string, string>;
}) {
  const [open, setOpen] = useState(false);
  const [breakdown, setBreakdown] = useState<WeekBreakdown | 'loading' | null>(null);

  const toggle = () => {
    const next = !open;
    setOpen(next);
    if (next && week.isFinalized && breakdown === null) {
      setBreakdown('loading');
      fetchWeekBreakdown(week.id, memberId, headers)
        .then((b) => setBreakdown(b))
        .catch(() => setBreakdown({ saved: 0, invested: 0, spent: 0, cashedOut: 0 }));
    }
  };

  const range = weekDateRange(week.startDate);
  const status = week.isFinalized ? 'Closed' : 'Open';

  return (
    <li>
      <button
        type="button"
        data-testid={`kids-money-week-${week.id}`}
        onClick={toggle}
        aria-expanded={open}
        className="flex min-h-[56px] w-full items-center gap-2 px-4 py-3 text-left hover:bg-gray-50 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-pastel-cyan"
      >
        <span
          aria-hidden="true"
          title={status === 'Open' ? 'Still open' : 'Closed'}
          className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full border-2 border-black ${
            status === 'Open' ? 'bg-pastel-yellow' : 'bg-pastel-lime'
          }`}
        >
          {status === 'Open' ? (
            <RefreshCw size={12} strokeWidth={4} aria-hidden />
          ) : (
            <Check size={12} strokeWidth={4} aria-hidden />
          )}
        </span>
        <span className="min-w-0 flex-1">
          <span className="block font-heading text-base leading-tight">Week {week.weekNumber}</span>
          <span className="text-xs font-bold text-gray-500">
            {range ?? week.startDate}
            {status === 'Open' ? ' - still open' : ''}
          </span>
        </span>
        <span className="shrink-0 whitespace-nowrap text-sm font-bold">
          {week.earned === null ? '…' : `${week.earned} earned`}
        </span>
        <ChevronDown
          size={16}
          strokeWidth={3}
          aria-hidden
          className={`shrink-0 text-gray-400 transition-transform ${open ? 'rotate-180' : ''}`}
        />
      </button>

      {open && (
        <dl
          className="flex flex-col gap-1 px-4 pb-4 pl-[52px]"
          data-testid={`kids-money-week-${week.id}-detail`}
        >
          <Row label="Earned" value={week.earned === null ? '…' : `${week.earned} stickers`} />
          {!week.isFinalized ? (
            <p className="text-sm font-bold text-gray-500" data-testid="kids-money-week-open-note">
              Still open, so nothing has moved to savings yet.
            </p>
          ) : breakdown === 'loading' || breakdown === null ? (
            <p className="text-sm font-bold text-gray-500">Loading...</p>
          ) : (
            <>
              <Row label="Moved to savings" value={`${breakdown.saved} stickers`} />
              <Row label="Spent on rewards" value={`${breakdown.spent} stickers`} />
              {breakdown.invested > 0 && (
                <Row label="Invested" value={`${breakdown.invested} stickers`} />
              )}
              {breakdown.cashedOut > 0 && (
                <Row label="Cashed out" value={`${breakdown.cashedOut} stickers`} />
              )}
            </>
          )}
        </dl>
      )}
    </li>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <dt className="text-sm font-bold text-gray-600">{label}</dt>
      <dd className="whitespace-nowrap text-sm font-bold">{value}</dd>
    </div>
  );
}

function WeekHistory({
  weeks,
  memberId,
  headers,
  onRevealOlder,
}: {
  weeks: WeekListItem[];
  memberId: string;
  headers: Record<string, string>;
  onRevealOlder: () => void;
}) {
  const [showAll, setShowAll] = useState(false);
  const visible = showAll ? weeks : weeks.slice(0, WEEKS_SHOWN);
  const hidden = weeks.length - visible.length;

  const handleShowMore = () => {
    setShowAll(true);
    onRevealOlder();
  };

  return (
    <section className="overflow-hidden rounded-xl border-2 border-black bg-white shadow-neo-sm lg:sticky lg:top-4">
      <header className="border-b-2 border-black bg-gray-100 px-5 py-3">
        <h2 className="font-heading text-xl uppercase tracking-wide">Week by week</h2>
        {weeks.length > 0 && (
          <p className="mt-0.5 text-xs font-bold text-gray-600">
            {weeks.length} {weeks.length === 1 ? 'week' : 'weeks'} so far
          </p>
        )}
      </header>

      {weeks.length === 0 ? (
        <p className="p-5 font-bold text-gray-600">
          No weeks finished yet. The first one shows up here after you close it.
        </p>
      ) : (
        <>
          <ul className="divide-y-2 divide-gray-100">
            {visible.map((week) => (
              <WeekRow key={week.id} week={week} memberId={memberId} headers={headers} />
            ))}
          </ul>

          {hidden > 0 && (
            <button
              type="button"
              data-testid="kids-money-show-older-weeks"
              onClick={handleShowMore}
              className="min-h-[48px] w-full border-t-2 border-black bg-gray-50 text-sm font-bold hover:bg-gray-100 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-pastel-cyan"
            >
              Show {hidden} older {hidden === 1 ? 'week' : 'weeks'}
            </button>
          )}
          {showAll && weeks.length > WEEKS_SHOWN && (
            <button
              type="button"
              onClick={() => setShowAll(false)}
              className="min-h-[48px] w-full border-t-2 border-black bg-gray-50 text-sm font-bold hover:bg-gray-100 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-pastel-cyan"
            >
              Show fewer weeks
            </button>
          )}
        </>
      )}
    </section>
  );
}

// ── Loading / error ───────────────────────────────────────────────────────────

function LoadingBlock() {
  return (
    <div
      aria-busy="true"
      data-testid="kids-money-loading"
      className="grid grid-cols-1 items-start gap-5 lg:grid-cols-3"
    >
      <div className="flex flex-col gap-5 lg:col-span-2">
        <div className="rounded-xl border-2 border-black bg-white p-5 shadow-neo-sm">
          <p role="status" className="font-heading text-lg">
            Getting the numbers...
          </p>
          <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-3">
            {[0, 1, 2].map((i) => (
              <div key={i} className="h-24 rounded-xl border-2 border-black bg-gray-100" />
            ))}
          </div>
        </div>
        <div className="h-40 rounded-xl border-2 border-black bg-white shadow-neo-sm" />
      </div>
      <div className="h-56 rounded-xl border-2 border-black bg-white shadow-neo-sm" />
    </div>
  );
}

function ErrorBlock({ onRetry, name }: { onRetry: () => void; name: string }) {
  return (
    <section
      className="rounded-xl border-2 border-black bg-white p-5 shadow-neo-sm"
      data-testid="kids-money-error"
    >
      <div className="flex items-start gap-3">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border-2 border-black bg-pastel-yellow">
          <AlertTriangle size={18} strokeWidth={3} />
        </span>
        <div>
          <h2 role="status" className="font-heading text-xl">
            We could not load {name}&apos;s money
          </h2>
          <p className="mt-1 font-bold text-gray-600">
            Nothing is shown, rather than something wrong. Nothing has changed.
          </p>
        </div>
      </div>
      <Button
        variant="primary"
        onClick={onRetry}
        className="mt-4 w-full sm:w-auto sm:px-6"
        testId="kids-money-retry"
      >
        Try again
      </Button>
    </section>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────

export function KidsMoneyPage({ onMoneyAction }: KidsMoneyPageProps = {}) {
  const slug = useTenantSlug();
  const { session } = useAuth();
  const navigate = useNavigate();
  const [params] = useSearchParams();

  const [kids, setKids] = useState<KidRow[]>([]);
  const [callerRole, setCallerRole] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const [state, setState] = useState<LoadState>('loading');
  const [snapshot, setSnapshot] = useState<ChildMoneySnapshot | null>(null);
  const [weeks, setWeeks] = useState<WeekListItem[]>([]);
  const [currentWeekId, setCurrentWeekId] = useState<string | null>(null);

  // FHS-623: which action sheet is open, if any. `onMoneyAction` stays an
  // overridable prop (the FHS-622 seam + this page's own tests still pass a
  // stub); when the caller doesn't supply one, tapping a button opens this
  // page's own sheet instead of doing nothing.
  const [sheetTarget, setSheetTarget] = useState<{
    action: MoneyAction;
    child: { id: string; name: string };
  } | null>(null);

  const token = session?.access_token ?? '';
  const headers = useMemo<Record<string, string> | null>(
    () => (token ? { Authorization: `Bearer ${token}`, 'x-tenant-slug': slug } : null),
    [token, slug],
  );

  // Family roster: who counts as a kid, and whether the caller may be here.
  useEffect(() => {
    if (!headers) return;
    let cancelled = false;
    fetchJson<{ members: KidRow[]; callerRole: string }>(`${API_BASE}/api/members`, headers)
      .then((body) => {
        if (cancelled) return;
        setCallerRole(body.callerRole);
        const kidMembers = body.members.filter((m) => isKidRole(m.role));
        setKids(kidMembers);
        const requested = params.get('child');
        const initialId =
          requested && kidMembers.some((k) => k.id === requested)
            ? requested
            : (kidMembers[0]?.id ?? null);
        setSelectedId(initialId);
      })
      .catch(() => {
        if (!cancelled) setCallerRole('__denied__');
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [headers]);

  // FHS-625: any grown-up, not admins only. The server has always let an adult
  // move a child's money (canManage, ADR 0015); this page inherited a blanket
  // admin gate from the Admin Panel it replaced, which locked adults out of
  // something they were allowed to do. The admin-only actions are week close /
  // reopen / repair and setting a balance by hand, none of which live here.
  useEffect(() => {
    if (callerRole === null) return;
    if (!isGrownUpRole(callerRole)) navigate(`/t/${slug}/dashboard`, { replace: true });
  }, [callerRole, slug, navigate]);

  const load = useCallback(() => {
    if (!headers || !selectedId) return;
    setState('loading');
    fetchChildMoney(selectedId, headers)
      .then(({ snapshot: s, weeks: w, currentWeekId: wk }) => {
        setSnapshot(s);
        setWeeks(w);
        setCurrentWeekId(wk);
        setState('ready');
      })
      .catch(() => setState('error'));
  }, [headers, selectedId]);

  useEffect(() => {
    load();
  }, [load]);

  // FHS-623: re-fetch the figures after a money action saves, without
  // flashing the full-page skeleton over an open (now-closing) sheet.
  const refreshAfterAction = useCallback(() => {
    if (!headers || !selectedId) return;
    fetchChildMoney(selectedId, headers)
      .then(({ snapshot: s, weeks: w, currentWeekId: wk }) => {
        setSnapshot(s);
        setWeeks(w);
        setCurrentWeekId(wk);
      })
      .catch(() => {
        // A save already reached the server and succeeded; a failed refresh
        // just means these figures go stale until the next reload/retry,
        // not that the action itself failed. Nothing to show the user here.
      });
  }, [headers, selectedId]);

  const openMoneySheet = useCallback((action: MoneyAction, child: { id: string; name: string }) => {
    setSheetTarget({ action, child });
  }, []);
  const effectiveOnMoneyAction = onMoneyAction ?? openMoneySheet;

  const revealOlderWeeks = useCallback(() => {
    if (!headers || !selectedId) return;
    const toLoad = weeks.filter((w) => w.earned === null);
    if (toLoad.length === 0) return;
    void Promise.all(
      toLoad.map(async (w) => ({
        id: w.id,
        earned: await fetchWeekEarned(w.id, selectedId, headers),
      })),
    ).then((updates) => {
      setWeeks((prev) =>
        prev.map((w) => {
          const found = updates.find((u) => u.id === w.id);
          return found ? { ...w, earned: found.earned } : w;
        }),
      );
    });
  }, [headers, selectedId, weeks]);

  const onHeaderTabChange = useCallback(
    (tabId: string) => {
      navigate(`/t/${slug}/dashboard${tabId === DEFAULT_TAB ? '' : `?tab=${tabId}`}`);
    },
    [navigate, slug],
  );

  const child = kids.find((k) => k.id === selectedId) ?? null;

  // FHS-625: hold the page back until we know the caller is a grown-up, not
  // just until we know their role. The redirect above runs in an effect, one
  // render AFTER the role lands, so gating on `=== null` alone showed a child's
  // balances and the money buttons to a teen or guest for a frame.
  if (!isGrownUpRole(callerRole)) {
    return (
      <div
        data-testid="kids-money-role-loading"
        className="flex min-h-screen items-center justify-center bg-kingdom-bg"
      >
        <p className="text-sm font-medium text-purple-200">Loading...</p>
      </div>
    );
  }

  return (
    <div
      data-testid="kids-money-page"
      className="flex min-h-screen flex-col bg-kingdom-bg font-body text-black"
    >
      <AppHeader activeTab={null} onTabChange={onHeaderTabChange} />

      <div className="mx-auto w-full max-w-5xl flex-1 px-4 py-5 sm:px-6">
        <button
          type="button"
          onClick={() => navigate(`/t/${slug}/dashboard`)}
          className="mb-1 inline-flex min-h-[44px] items-center gap-2 rounded-lg px-1 text-sm font-bold text-purple-200 hover:text-white focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-yellow-300"
        >
          <ArrowLeft size={16} strokeWidth={3} />
          Back
        </button>
        <h1 className="font-heading text-3xl text-white sm:text-4xl">Kids money</h1>
        <p className="mt-1 font-bold text-purple-200">
          Where each child&apos;s money stands, and what happened each week.
        </p>

        <div className="mt-5 flex flex-col gap-5">
          {kids.length === 0 ? (
            <p className="text-sm font-bold text-purple-200" data-testid="kids-money-no-kids">
              No children in this family yet. Add one from{' '}
              <Link to={`/t/${slug}/members`} className="font-bold text-yellow-300 underline">
                Manage Members
              </Link>
              .
            </p>
          ) : (
            <>
              <ChildPicker kids={kids} activeId={selectedId ?? ''} onPick={setSelectedId} />

              {state === 'loading' && <LoadingBlock />}
              {state === 'error' && child && <ErrorBlock name={child.displayName} onRetry={load} />}

              {state === 'ready' && child && snapshot && (
                <div className="grid grid-cols-1 items-start gap-5 lg:grid-cols-3">
                  <div className="flex flex-col gap-5 lg:col-span-2">
                    <MoneyNow name={child.displayName} snapshot={snapshot} />
                    <Actions
                      name={child.displayName}
                      childId={child.id}
                      snapshot={snapshot}
                      onMoneyAction={effectiveOnMoneyAction}
                    />
                  </div>
                  {headers && (
                    <WeekHistory
                      weeks={weeks}
                      memberId={child.id}
                      headers={headers}
                      onRevealOlder={revealOlderWeeks}
                    />
                  )}
                </div>
              )}
            </>
          )}

          <button
            type="button"
            onClick={() => navigate(`/t/${slug}/reward-settings`)}
            className="flex min-h-[56px] w-full items-center gap-3 rounded-xl border-2 border-black bg-white px-4 py-3 text-left shadow-neo-sm transition-transform hover:-translate-y-0.5 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-yellow-300"
          >
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border-2 border-black bg-pastel-yellow">
              <Sliders size={18} strokeWidth={3} />
            </span>
            <span className="min-w-0">
              <span className="block font-heading text-base uppercase tracking-wide">
                Earning rules
              </span>
              <span className="text-sm font-bold text-gray-600">
                What a sticker is worth, and what happens on a skipped day.
              </span>
            </span>
            <span className="ml-auto shrink-0 font-heading text-lg">→</span>
          </button>
        </div>
      </div>

      {headers && (
        <MoneyActionsSheet
          isOpen={sheetTarget !== null}
          action={sheetTarget?.action ?? null}
          child={sheetTarget?.child ?? null}
          snapshot={snapshot}
          weekId={currentWeekId}
          headers={headers}
          onClose={() => setSheetTarget(null)}
          onSaved={refreshAfterAction}
        />
      )}
    </div>
  );
}
