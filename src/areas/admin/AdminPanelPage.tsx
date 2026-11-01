/**
 * AdminPanelPage: FHS-308
 *
 * Per-child admin panel reached from /t/:slug/admin.
 * Faithfully ports the legacy AdminPanel look (orange→pink gradient header,
 * pill tab bar, neo-brutalist cards, Quick-Actions grid, Admin Override Active
 * amber banner) and adapts it to the per-child economy: a child selector at
 * the top controls which member's data is shown in Balance / Savings /
 * History. App Info is family-level and not child-scoped.
 *
 * Member management lives entirely on the Manage Members page: FHS-535
 * removed the redundant read-only Users tab that used to duplicate it here.
 */

import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  Calendar,
  CheckCircle,
  Download,
  Gift,
  Info,
  Pencil,
  RotateCcw,
  Settings as SettingsIcon,
  ShieldCheck,
  Sparkles,
  Star,
  Trash2,
  Wrench,
  X,
} from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import { Button, Card, ConfirmDialog, CurrencyPicker, Label } from '@familyhub/ui';
import { signOutAll, useAuth } from '../../app/lib/auth-context';
import { useTenantSlug } from '../../app/lib/tenant-context';
import { API_BASE } from '../../app/lib/api';
import { AppHeader } from '../../app/layout/AppHeader';
import { DEFAULT_TAB } from '../../app/layout/dashboard-tabs';
import { RewardsTab } from './RewardsTab';
import { FALLBACK_CURRENCY, currencySymbol, formatMoney, isKidRole } from '@familyhub/shared';

// ── Types ────────────────────────────────────────────────────────────────────

// FHS-483: 'rewards' is family-level (not child-scoped), like 'settings':
// the reward shop's catalogue is shared across every kid.
type Tab = 'balance' | 'savings' | 'history' | 'rewards' | 'settings';

interface MemberItem {
  id: string;
  displayName: string;
  role: string;
  avatarEmoji: string | null;
  isChild: boolean;
}

// FHS-512: field names match the real GET /mw/weeks/:id/stats response
// (previously `availableStickers`/`availableCash`, which don't exist on
// that response: the sticker count silently read as 0). `cashValue` is
// computed server-side at the child's configured rate, never a hardcoded 0.5.
interface WeekStats {
  weekId: string;
  totalStickers: number;
  unallocatedStickers: number;
  allocatedStickers: number;
  cashValue: number;
}

interface CurrentWeek {
  id: string;
  weekNumber: number;
  year: number;
  isFinalized: boolean;
}

interface SavingsData {
  savedStickers: number;
  savedCash: number;
  cashEquivalent: number;
  // FHS-441: GET /api/mw/financial/savings already returns the family's
  // currency; the Savings tab previously ignored it and hardcoded "AED".
  currency?: string;
  // FHS-512: this child's effective (configurable) sticker rate; never
  // hardcode 0.5 to convert saved stickers into a cash figure.
  stickerRate?: number;
}

interface WeekRow {
  id: string;
  weekNumber: number;
  year: number;
  // Monday of this week, e.g. "2026-07-06": the API already returns it;
  // FHS-444 uses it to show a real date range next to "Week 27" so the
  // number reads as a real week, not a mystery code.
  startDate?: string;
  status: 'Active' | 'Finalized';
  isFinalized?: boolean;
  carriedOverStickers: number;
  carriedOverCash: number;
  retrievedStickers: number;
  retrievedCash: number;
}

interface WeekAction {
  id: number;
  actionType: string;
  stickersUsed: number | null;
  cashAmount: number | null;
  rewardName: string | null;
}

interface AppSettings {
  // FHS-441: the family's currency (AED, GBP, …). Lives on tenants.currency
  // server-side but is surfaced through this same settings map.
  //
  // FHS-455: appName/appSubtitle were dropped from this UI: the header
  // always uses the family name, so those fields were never rendered
  // anywhere. The backend app_settings keys are left alone (harmless):
  // only the UI was removed.
  currency: string;
}

// Sub-dialog types for Balance Quick Actions
type QuickAction = 'claim' | 'cashout' | 'save' | 'invest' | 'withdraw' | null;

// ── Helpers ───────────────────────────────────────────────────────────────────

// FHS-485: same label fix as MembersPage: 'adult' reads "Adult", not
// "Parent" (a real parent/partner is `admin`): see ADR 0019.
const ROLE_STYLE: Record<string, { disc: string; badge: string; label: string }> = {
  admin: { disc: 'bg-pink-300', badge: 'bg-pink-200', label: 'Admin' },
  adult: { disc: 'bg-cyan-300', badge: 'bg-cyan-200', label: 'Adult' },
  teen: { disc: 'bg-yellow-300', badge: 'bg-yellow-200', label: 'Teen' },
  child: { disc: 'bg-purple-300', badge: 'bg-purple-200', label: 'Child' },
  guest: { disc: 'bg-gray-300', badge: 'bg-gray-200', label: 'Guest' },
};

function roleStyle(role: string) {
  return ROLE_STYLE[role] ?? ROLE_STYLE['guest']!;
}

// FHS-444: "Week 27" alone reads like a mystery code. Show the real
// Mon–Sun date range underneath it so it's unmistakable, e.g. "6 Jul – 12 Jul".
// UTC-anchored so the range never shifts a day for users in other timezones
// (matches the pattern already used on the Calendar tab).
function weekDateRange(startDate: string): string | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(startDate)) return null;
  const [y, m, d] = startDate.split('-').map((s) => Number.parseInt(s, 10));
  const start = new Date(Date.UTC(y!, m! - 1, d!));
  const end = new Date(start);
  end.setUTCDate(end.getUTCDate() + 6);
  const fmt = (dt: Date) =>
    dt.toLocaleDateString(undefined, { day: 'numeric', month: 'short', timeZone: 'UTC' });
  return `${fmt(start)} – ${fmt(end)}`;
}

function initial(name: string): string {
  return [...name.trim()][0]?.toUpperCase() ?? '?';
}

// ── Child selector ────────────────────────────────────────────────────────────

function ChildSelector({
  kids,
  selectedId,
  onSelect,
}: {
  kids: MemberItem[];
  selectedId: string | null;
  onSelect: (id: string) => void;
}) {
  if (kids.length === 0) return null;
  return (
    <div
      data-testid="admin-child-selector"
      className="bg-white rounded-2xl border-2 border-black shadow-neo-md p-4"
    >
      <p className="text-xs font-black text-gray-500 uppercase tracking-wide mb-3">
        Select child to manage
      </p>
      <div className="flex flex-wrap gap-2">
        {kids.map((c) => {
          const rs = roleStyle(c.role);
          const selected = c.id === selectedId;
          return (
            <button
              key={c.id}
              type="button"
              data-testid={`admin-child-selector-${c.id}`}
              onClick={() => onSelect(c.id)}
              className={[
                'flex items-center gap-2 px-3 py-2 rounded-xl border-2 text-sm font-bold transition-all',
                'min-h-[44px]',
                selected
                  ? 'border-black bg-yellow-400 shadow-neo-xs -translate-y-0.5'
                  : 'border-gray-200 bg-white hover:border-black hover:shadow-neo-xs',
              ].join(' ')}
            >
              <span
                aria-hidden="true"
                className={`w-7 h-7 rounded-full border-2 border-black flex items-center justify-center text-xs font-heading ${rs.disc}`}
              >
                {c.avatarEmoji ?? initial(c.displayName)}
              </span>
              <span>{c.displayName}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

// ── Quick Action modal shells (inline forms; the panel's own quick actions) ──

/**
 * Inline Claim-reward quick action.
 * Fetches the reward list for the selected child and redeems via
 * POST /api/rewards/:id/redeem { memberId }.
 */
function ClaimQuickAction({
  memberId,
  headers,
  onClose,
}: {
  memberId: string;
  headers: Record<string, string> | null;
  onClose: () => void;
}) {
  const [rewards, setRewards] = useState<
    { id: string; name: string; stickerCost: number; icon: string | null }[]
  >([]);
  const [selected, setSelected] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!headers) return;
    setLoading(true);
    fetch(`${API_BASE}/api/rewards?memberId=${memberId}`, { headers })
      .then((r) => (r.ok ? r.json() : { rewards: [] }))
      .then((b: { rewards: typeof rewards }) => setRewards(b.rewards ?? []))
      .catch(() => setRewards([]))
      .finally(() => setLoading(false));
  }, [memberId, headers]);

  const handleClaim = async () => {
    if (!selected || !headers) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`${API_BASE}/api/rewards/${selected}/redeem`, {
        method: 'POST',
        headers: { ...headers, 'Content-Type': 'application/json' },
        body: JSON.stringify({ memberId }),
      });
      if (!res.ok) throw new Error(`Redeem failed: ${res.status}`);
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to redeem reward');
      setBusy(false);
    }
  };

  return (
    <div data-testid="admin-quick-action-claim" className="space-y-4">
      <h4 className="font-black text-gray-900 uppercase tracking-wide flex items-center gap-2 pr-10">
        🎁 Claim Reward
      </h4>
      {loading && <p className="text-sm text-gray-500">Loading rewards…</p>}
      {!loading && rewards.length === 0 && (
        <p className="text-sm text-gray-500">No rewards available for this child.</p>
      )}
      {!loading && rewards.length > 0 && (
        <div className="space-y-2 max-h-48 overflow-y-auto">
          {rewards.map((r) => (
            <button
              key={r.id}
              onClick={() => setSelected(r.id)}
              className={[
                'w-full flex items-center justify-between px-3 py-2 rounded-xl border-2 transition-all text-left',
                selected === r.id
                  ? 'bg-pink-100 border-black shadow-neo-xs'
                  : 'bg-white border-gray-200 hover:border-black',
              ].join(' ')}
            >
              <span className="font-bold text-sm text-gray-900">
                {r.icon ?? '🎁'} {r.name}
              </span>
              <span className="text-xs font-black bg-yellow-400 border-2 border-black px-2 py-0.5 rounded-lg">
                {r.stickerCost}⭐
              </span>
            </button>
          ))}
        </div>
      )}
      {error && <p className="text-sm text-red-600 font-bold">{error}</p>}
      <div className="flex gap-3 pt-2">
        <Button variant="secondary" size="sm" onClick={onClose}>
          Cancel
        </Button>
        <Button
          variant="primary"
          size="sm"
          disabled={!selected || busy}
          onClick={() => void handleClaim()}
          testId="admin-quick-action-claim-submit"
        >
          {busy ? 'Claiming…' : 'Claim'}
        </Button>
      </div>
    </div>
  );
}

function CashOutQuickAction({
  memberId,
  headers,
  currency,
  onClose,
}: {
  memberId: string;
  headers: Record<string, string> | null;
  currency: string;
  onClose: () => void;
}) {
  const [amount, setAmount] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleCashOut = async () => {
    const num = Number(amount);
    if (!num || num <= 0 || !headers) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`${API_BASE}/api/mw/financial/savings/cashout`, {
        method: 'POST',
        headers: { ...headers, 'Content-Type': 'application/json' },
        body: JSON.stringify({ memberId, amount: num }),
      });
      if (!res.ok) throw new Error(`Cashout failed: ${res.status}`);
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to cash out');
      setBusy(false);
    }
  };

  return (
    <div data-testid="admin-quick-action-cashout" className="space-y-4">
      <h4 className="font-black text-gray-900 uppercase tracking-wide flex items-center gap-2 pr-10">
        💰 Cash Out
      </h4>
      <div>
        <label
          htmlFor="qa-cashout-amount"
          className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-1.5 block"
        >
          Amount ({currencySymbol(currency)})
        </label>
        <input
          id="qa-cashout-amount"
          type="number"
          min={0}
          step={0.5}
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          data-testid="admin-quick-action-cashout-amount"
          className="w-full border-2 border-gray-200 rounded-xl px-4 py-2.5 font-medium text-gray-900 focus:border-orange-400 outline-none"
        />
      </div>
      {error && <p className="text-sm text-red-600 font-bold">{error}</p>}
      <div className="flex gap-3 pt-2">
        <Button variant="secondary" size="sm" onClick={onClose}>
          Cancel
        </Button>
        <Button
          variant="success"
          size="sm"
          disabled={!amount || Number(amount) <= 0 || busy}
          onClick={() => void handleCashOut()}
          testId="admin-quick-action-cashout-submit"
        >
          {busy ? 'Processing…' : 'Confirm'}
        </Button>
      </div>
    </div>
  );
}

function SaveQuickAction({
  memberId,
  headers,
  currency,
  onClose,
}: {
  memberId: string;
  headers: Record<string, string> | null;
  currency: string;
  onClose: () => void;
}) {
  const [type, setType] = useState<'stickers' | 'cash'>('stickers');
  const [amount, setAmount] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSave = async () => {
    const num = Number(amount);
    if (!num || num <= 0 || !headers) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`${API_BASE}/api/mw/financial/savings`, {
        method: 'POST',
        headers: { ...headers, 'Content-Type': 'application/json' },
        body: JSON.stringify({ memberId, type, amount: num }),
      });
      if (!res.ok) throw new Error(`Save failed: ${res.status}`);
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to save');
      setBusy(false);
    }
  };

  return (
    <div data-testid="admin-quick-action-save" className="space-y-4">
      <h4 className="font-black text-gray-900 uppercase tracking-wide flex items-center gap-2 pr-10">
        🐷 Save for Later
      </h4>
      <div className="flex gap-2">
        <button
          onClick={() => setType('stickers')}
          className={[
            'flex-1 px-3 py-2 rounded-xl border-2 text-sm font-bold transition-all',
            type === 'stickers'
              ? 'bg-yellow-400 border-black shadow-neo-xs'
              : 'bg-white border-gray-200 hover:border-black',
          ].join(' ')}
        >
          ⭐ Stickers
        </button>
        <button
          onClick={() => setType('cash')}
          className={[
            'flex-1 px-3 py-2 rounded-xl border-2 text-sm font-bold transition-all',
            type === 'cash'
              ? 'bg-emerald-400 border-black shadow-neo-xs'
              : 'bg-white border-gray-200 hover:border-black',
          ].join(' ')}
        >
          💵 Cash ({currencySymbol(currency)})
        </button>
      </div>
      <div>
        <label
          htmlFor="qa-save-amount"
          className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-1.5 block"
        >
          Amount
        </label>
        <input
          id="qa-save-amount"
          type="number"
          min={0}
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          data-testid="admin-quick-action-save-amount"
          className="w-full border-2 border-gray-200 rounded-xl px-4 py-2.5 font-medium text-gray-900 focus:border-orange-400 outline-none"
        />
      </div>
      {error && <p className="text-sm text-red-600 font-bold">{error}</p>}
      <div className="flex gap-3 pt-2">
        <Button variant="secondary" size="sm" onClick={onClose}>
          Cancel
        </Button>
        <Button
          variant="primary"
          size="sm"
          disabled={!amount || Number(amount) <= 0 || busy}
          onClick={() => void handleSave()}
          testId="admin-quick-action-save-submit"
        >
          {busy ? 'Saving…' : 'Save It!'}
        </Button>
      </div>
    </div>
  );
}

function InvestQuickAction({
  memberId,
  currentWeekId,
  headers,
  onClose,
}: {
  memberId: string;
  currentWeekId: string | null;
  headers: Record<string, string> | null;
  onClose: () => void;
}) {
  const [habits, setHabits] = useState<{ id: string; name: string }[]>([]);
  const [selectedHabitId, setSelectedHabitId] = useState<string | null>(null);
  const [amount, setAmount] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!headers || !currentWeekId) return;
    fetch(`${API_BASE}/api/habits?memberId=${memberId}&weekId=${currentWeekId}`, { headers })
      .then((r) => (r.ok ? r.json() : { habits: [] }))
      .then((b: { habits: typeof habits }) => setHabits(b.habits ?? []))
      .catch(() => {});
  }, [memberId, currentWeekId, headers]);

  const handleInvest = async () => {
    const num = Number(amount);
    if (!num || num < 10 || !selectedHabitId || !headers) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`${API_BASE}/api/mw/financial/investments`, {
        method: 'POST',
        headers: { ...headers, 'Content-Type': 'application/json' },
        body: JSON.stringify({ memberId, habitId: selectedHabitId, stickerCount: num }),
      });
      if (!res.ok) {
        // FHS-416: show WHY, not the raw status. The API returns an errorCode
        // (and how many stickers are actually available) on a 409.
        const body = (await res.json().catch(() => ({}))) as {
          errorCode?: string;
          available?: number;
        };
        if (body.errorCode === 'INSUFFICIENT_STICKERS') {
          throw new Error(
            `Not enough stickers to invest: ${body.available ?? 0} available, but ${num} needed.`,
          );
        }
        if (body.errorCode === 'ACTIVE_INVESTMENT_EXISTS') {
          throw new Error('This habit already has an active investment.');
        }
        throw new Error('Could not invest right now. Please try again.');
      }
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to invest');
      setBusy(false);
    }
  };

  return (
    <div data-testid="admin-quick-action-invest" className="space-y-4">
      <h4 className="font-black text-gray-900 uppercase tracking-wide flex items-center gap-2 pr-10">
        📈 Invest &amp; Grow
      </h4>
      <div>
        <label
          htmlFor="qa-invest-amount"
          className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-1.5 block"
        >
          Sticker Amount (min 10)
        </label>
        <input
          id="qa-invest-amount"
          type="number"
          min={10}
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          data-testid="admin-quick-action-invest-amount"
          className="w-full border-2 border-gray-200 rounded-xl px-4 py-2.5 font-medium text-gray-900 focus:border-orange-400 outline-none"
        />
      </div>
      {habits.length > 0 && (
        <div>
          <p className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-1.5">
            Choose Habit
          </p>
          <div className="space-y-2 max-h-40 overflow-y-auto">
            {habits.map((h) => (
              <button
                key={h.id}
                onClick={() => setSelectedHabitId(h.id)}
                className={[
                  'w-full text-left px-3 py-2 rounded-xl border-2 text-sm font-bold transition-all',
                  selectedHabitId === h.id
                    ? 'bg-yellow-400 border-black shadow-neo-xs'
                    : 'bg-white border-gray-200 hover:border-black',
                ].join(' ')}
              >
                {h.name}
              </button>
            ))}
          </div>
        </div>
      )}
      {error && <p className="text-sm text-red-600 font-bold">{error}</p>}
      <div className="flex gap-3 pt-2">
        <Button variant="secondary" size="sm" onClick={onClose}>
          Cancel
        </Button>
        <Button
          variant="primary"
          size="sm"
          disabled={!amount || Number(amount) < 10 || !selectedHabitId || busy}
          onClick={() => void handleInvest()}
          testId="admin-quick-action-invest-submit"
        >
          {busy ? 'Investing…' : 'Invest'}
        </Button>
      </div>
    </div>
  );
}

function WithdrawQuickAction({
  memberId,
  headers,
  onClose,
}: {
  memberId: string;
  headers: Record<string, string> | null;
  onClose: () => void;
}) {
  const [investments, setInvestments] = useState<
    { id: string; habitName: string | null; currentValueStickers: number }[]
  >([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!headers) return;
    setLoading(true);
    fetch(`${API_BASE}/api/mw/financial/investments?memberId=${memberId}`, { headers })
      .then((r) => (r.ok ? r.json() : { investments: [] }))
      .then((b: { investments: typeof investments }) => setInvestments(b.investments ?? []))
      .catch(() => setInvestments([]))
      .finally(() => setLoading(false));
  }, [memberId, headers]);

  const handleWithdraw = async () => {
    if (!selectedId || !headers) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`${API_BASE}/api/mw/financial/investments/${selectedId}/withdraw`, {
        method: 'POST',
        headers: { ...headers, 'Content-Type': 'application/json' },
        body: JSON.stringify({ memberId }),
      });
      if (!res.ok) throw new Error(`Withdraw failed: ${res.status}`);
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to withdraw');
      setBusy(false);
    }
  };

  return (
    <div data-testid="admin-quick-action-withdraw" className="space-y-4">
      <h4 className="font-black text-gray-900 uppercase tracking-wide flex items-center gap-2 pr-10">
        🏦 Withdraw Investment
      </h4>
      {loading && <p className="text-sm text-gray-500">Loading investments…</p>}
      {!loading && investments.length === 0 && (
        <p className="text-sm text-gray-500">No active investments to withdraw.</p>
      )}
      {!loading && investments.length > 0 && (
        <div className="space-y-2">
          {investments.map((inv) => (
            <button
              key={inv.id}
              onClick={() => setSelectedId(inv.id)}
              className={[
                'w-full flex items-center justify-between px-3 py-2 rounded-xl border-2 transition-all text-left',
                selectedId === inv.id
                  ? 'bg-orange-100 border-black shadow-neo-xs'
                  : 'bg-white border-gray-200 hover:border-black',
              ].join(' ')}
            >
              <span className="font-bold text-sm">{inv.habitName ?? 'Investment'}</span>
              <span className="text-xs font-black bg-orange-200 border border-orange-400 px-2 py-0.5 rounded">
                {inv.currentValueStickers}⭐
              </span>
            </button>
          ))}
        </div>
      )}
      {error && <p className="text-sm text-red-600 font-bold">{error}</p>}
      <div className="flex gap-3 pt-2">
        <Button variant="secondary" size="sm" onClick={onClose}>
          Cancel
        </Button>
        <Button
          variant="danger"
          size="sm"
          disabled={!selectedId || busy || loading}
          onClick={() => void handleWithdraw()}
          testId="admin-quick-action-withdraw-submit"
        >
          {busy ? 'Withdrawing…' : 'Withdraw'}
        </Button>
      </div>
    </div>
  );
}

// ── Quick Action modal container ──────────────────────────────────────────────

function QuickActionModal({
  action,
  memberId,
  currentWeekId,
  headers,
  currency,
  onClose,
}: {
  action: QuickAction;
  memberId: string;
  currentWeekId: string | null;
  headers: Record<string, string> | null;
  currency: string;
  onClose: () => void;
}) {
  if (!action) return null;
  return (
    // eslint-disable-next-line jsx-a11y/no-noninteractive-element-interactions -- backdrop dismiss
    <div
      role="dialog"
      aria-modal="true"
      data-testid={`admin-quick-action-modal-${action}`}
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      onKeyDown={(e) => {
        if (e.key === 'Escape') onClose();
      }}
    >
      <div className="relative w-full max-w-md">
        <div className="absolute inset-0 translate-x-1.5 translate-y-1.5 rounded-2xl bg-black" />
        <div className="relative rounded-2xl border-2 border-black bg-white p-5 shadow-neo sm:border-3 sm:p-6">
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="absolute right-4 top-4 flex h-11 w-11 items-center justify-center text-gray-500 hover:text-black transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
          {action === 'claim' && (
            <ClaimQuickAction memberId={memberId} headers={headers} onClose={onClose} />
          )}
          {action === 'cashout' && (
            <CashOutQuickAction
              memberId={memberId}
              headers={headers}
              currency={currency}
              onClose={onClose}
            />
          )}
          {action === 'save' && (
            <SaveQuickAction
              memberId={memberId}
              headers={headers}
              currency={currency}
              onClose={onClose}
            />
          )}
          {action === 'invest' && (
            <InvestQuickAction
              memberId={memberId}
              currentWeekId={currentWeekId}
              headers={headers}
              onClose={onClose}
            />
          )}
          {action === 'withdraw' && (
            <WithdrawQuickAction memberId={memberId} headers={headers} onClose={onClose} />
          )}
        </div>
      </div>
    </div>
  );
}

// ── Balance tab ───────────────────────────────────────────────────────────────

function BalanceTab({
  memberId,
  currentWeekId,
  headers,
  currency,
}: {
  memberId: string;
  currentWeekId: string | null;
  headers: Record<string, string> | null;
  currency: string;
}) {
  const [stats, setStats] = useState<WeekStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeAction, setActiveAction] = useState<QuickAction>(null);

  const fetchStats = useCallback(async () => {
    if (!headers || !currentWeekId) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(
        `${API_BASE}/api/mw/weeks/${currentWeekId}/stats?memberId=${memberId}`,
        { headers },
      );
      if (!res.ok) throw new Error(`Stats failed: ${res.status}`);
      const data = (await res.json()) as WeekStats;
      setStats(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load stats');
    } finally {
      setLoading(false);
    }
  }, [headers, currentWeekId, memberId]);

  useEffect(() => {
    void fetchStats();
  }, [fetchStats]);

  const handleActionClose = () => {
    setActiveAction(null);
    void fetchStats();
  };

  if (loading)
    return (
      <p data-testid="admin-balance-loading" className="text-sm text-purple-200">
        Loading balance…
      </p>
    );
  if (error)
    return (
      <p data-testid="admin-balance-error" className="text-sm text-red-300">
        {error}
      </p>
    );

  const stickers = stats?.unallocatedStickers ?? 0;
  // FHS-512: cashValue comes straight from the API (rate applied server-side
  // for this child), never recomputed client-side with a hardcoded 0.5.
  const cashValue = formatMoney(stats?.cashValue ?? 0, currency);

  return (
    <div
      data-testid="admin-balance-ready"
      className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500"
    >
      {/* Stat cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Card className="p-5 bg-yellow-50" data-testid="admin-balance-stickers-card">
          <p className="text-xs font-black text-yellow-600 uppercase tracking-wide mb-1">
            Available Stickers
          </p>
          <div className="flex items-baseline gap-2">
            <span
              data-testid="admin-balance-stickers-display"
              className="text-3xl font-black text-yellow-700"
            >
              {stickers}
            </span>
            <Star className="w-6 h-6 text-yellow-500 fill-current" />
          </div>
        </Card>
        <Card className="p-5 bg-green-50" data-testid="admin-balance-cash-card">
          <p className="text-xs font-black text-green-600 uppercase tracking-wide mb-1">
            Cash Value
          </p>
          <span
            data-testid="admin-balance-cash-display"
            className="text-3xl font-black text-green-700"
          >
            {cashValue}
          </span>
        </Card>
      </div>

      {/* Quick Actions grid */}
      <Card className="p-5">
        <h4 className="text-sm font-black text-gray-900 uppercase tracking-wide mb-4 flex items-center gap-2">
          <Sparkles className="w-4 h-4 text-purple-500" /> Quick Actions
        </h4>
        <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {[
            {
              action: 'claim' as const,
              emoji: '🎁',
              label: 'Claim Reward',
              sub: 'Spend',
              bg: 'bg-pink-400',
            },
            {
              action: 'cashout' as const,
              emoji: '💰',
              label: 'Cash Out',
              sub: 'Withdraw',
              bg: 'bg-lime-400',
            },
            {
              action: 'save' as const,
              emoji: '🐷',
              label: 'Save for Later',
              sub: 'Keep',
              bg: 'bg-cyan-400',
            },
            {
              action: 'invest' as const,
              emoji: '📈',
              label: 'Invest & Grow',
              sub: 'Grow',
              bg: 'bg-yellow-400',
            },
          ].map(({ action, emoji, label, sub, bg }) => (
            <button
              key={action}
              data-testid={`admin-balance-action-${action}`}
              onClick={() => setActiveAction(action)}
              className={[
                `group relative h-28 sm:h-32 ${bg} border-2 sm:border-3 border-black rounded-2xl shadow-neo`,
                'motion-safe:hover:translate-y-1 motion-safe:hover:shadow-neo-xs active:translate-y-2 active:shadow-none',
                'transition-all overflow-hidden',
              ].join(' ')}
            >
              <div className="absolute inset-0 bg-black/10 group-hover:bg-transparent transition-colors" />
              <div className="absolute top-2 right-2 text-2xl sm:text-3xl motion-safe:group-hover:scale-125 transition-transform duration-300">
                {emoji}
              </div>
              <div className="absolute bottom-3 left-3 text-left">
                <p className="text-[10px] font-black text-black uppercase tracking-wide bg-white/30 px-2 py-0.5 rounded mb-1 inline-block">
                  {sub}
                </p>
                <p className="text-sm sm:text-lg font-black text-black leading-none">{label}</p>
              </div>
            </button>
          ))}
        </div>

        {/* Withdraw investment spans full width on desktop, half on mobile */}
        <div className="mt-3">
          <button
            data-testid="admin-balance-action-withdraw"
            onClick={() => setActiveAction('withdraw')}
            className={[
              'group relative w-full h-24 sm:h-28 bg-orange-400 border-2 sm:border-3 border-black rounded-2xl shadow-neo',
              'motion-safe:hover:translate-y-1 motion-safe:hover:shadow-neo-xs active:translate-y-2 active:shadow-none',
              'transition-all overflow-hidden',
            ].join(' ')}
          >
            <div className="absolute inset-0 bg-black/10 group-hover:bg-transparent transition-colors" />
            <div className="absolute top-2 right-2 text-2xl sm:text-3xl motion-safe:group-hover:scale-125 transition-transform duration-300">
              🏦
            </div>
            <div className="absolute bottom-3 left-3 text-left">
              <p className="text-[10px] font-black text-black uppercase tracking-wide bg-white/30 px-2 py-0.5 rounded mb-1 inline-block">
                Exit Early
              </p>
              <p className="text-sm sm:text-lg font-black text-black leading-none">
                Withdraw Investment
              </p>
            </div>
          </button>
        </div>

        {/* Admin Override Active banner */}
        <div className="mt-4 bg-amber-50 border-2 border-black rounded-xl p-4 shadow-neo-sm flex gap-3 items-start">
          <ShieldCheck className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-bold text-amber-900">Admin Override Active</p>
            <p className="text-xs text-amber-700 mt-0.5">
              All financial actions are available to you at all times, regardless of the day.
            </p>
          </div>
        </div>
      </Card>

      {/* Quick Action Modal */}
      {activeAction && (
        <QuickActionModal
          action={activeAction}
          memberId={memberId}
          currentWeekId={currentWeekId}
          headers={headers}
          currency={currency}
          onClose={handleActionClose}
        />
      )}
    </div>
  );
}

// ── Savings tab ───────────────────────────────────────────────────────────────

function SavingsTab({
  memberId,
  headers,
  currency,
}: {
  memberId: string;
  headers: Record<string, string> | null;
  currency: string;
}) {
  const [data, setData] = useState<SavingsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);
  const [tempCash, setTempCash] = useState(0);
  const [tempStickers, setTempStickers] = useState(0);
  const [saving, setSaving] = useState(false);

  const fetchSavings = useCallback(async () => {
    if (!headers) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`${API_BASE}/api/mw/financial/savings?memberId=${memberId}`, {
        headers,
      });
      if (!res.ok) throw new Error(`Savings fetch failed: ${res.status}`);
      const body = (await res.json()) as SavingsData;
      setData(body);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load savings');
    } finally {
      setLoading(false);
    }
  }, [headers, memberId]);

  useEffect(() => {
    void fetchSavings();
  }, [fetchSavings]);

  const startEdit = () => {
    setTempCash(data?.savedCash ?? 0);
    setTempStickers(data?.savedStickers ?? 0);
    setEditing(true);
  };

  const handleSave = async () => {
    if (!headers) return;
    setSaving(true);
    try {
      const res = await fetch(`${API_BASE}/api/mw/financial/savings/admin-set`, {
        method: 'PUT',
        headers: { ...headers, 'Content-Type': 'application/json' },
        body: JSON.stringify({ memberId, savedStickers: tempStickers, savedCash: tempCash }),
      });
      if (!res.ok) throw new Error(`Admin-set failed: ${res.status}`);
      await fetchSavings();
      setEditing(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to update savings');
    } finally {
      setSaving(false);
    }
  };

  if (loading)
    return (
      <p data-testid="admin-savings-loading" className="text-sm text-purple-200">
        Loading savings…
      </p>
    );
  if (error)
    return (
      <p data-testid="admin-savings-error" className="text-sm text-red-300">
        {error}
      </p>
    );

  const savedCash = data?.savedCash ?? 0;
  const savedStickers = data?.savedStickers ?? 0;
  // FHS-512: this child's effective rate, never a hardcoded 0.5.
  const stickerRate = data?.stickerRate ?? 0.5;
  // FHS-441 read the currency off this tab's own savings response. FHS-614
  // review: two sources for one answer means two tabs can show different
  // currencies at once (and a currency changed in Settings never reached this
  // one). The page owns it now and passes it in.
  const cashEquiv = formatMoney(savedStickers * stickerRate + savedCash, currency);

  return (
    <div
      data-testid="admin-savings-ready"
      className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500"
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="bg-emerald-500 p-2.5 rounded-xl text-white shadow-sm">
            <Pencil className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-xl font-black text-white">Savings Balance</h3>
            <p className="text-sm text-emerald-400 font-medium">Long-term savings</p>
          </div>
        </div>
        <button
          data-testid="admin-savings-edit-btn"
          onClick={editing ? () => setEditing(false) : startEdit}
          className={[
            'text-xs font-bold px-3 py-1.5 rounded-lg flex items-center gap-1.5 transition-colors border min-h-[44px]',
            editing
              ? 'bg-gray-100 border-gray-200 text-gray-700 hover:bg-gray-200'
              : 'bg-white border-gray-200 text-gray-600 hover:border-gray-300',
          ].join(' ')}
        >
          {editing ? (
            <>
              <X className="w-3 h-3" /> Cancel
            </>
          ) : (
            <>
              <Pencil className="w-3 h-3" /> Edit
            </>
          )}
        </button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Card className="p-5 bg-green-50">
          <p className="text-xs font-black text-green-600 uppercase tracking-wide mb-1">
            Cash Savings
          </p>
          <span
            data-testid="admin-savings-cash-display"
            className="text-3xl font-black text-green-700"
          >
            {formatMoney(savedCash, currency)}
          </span>
          <p className="text-xs text-gray-400 font-medium mt-2">Liquid cash for withdrawal</p>
        </Card>
        <Card className="p-5 bg-purple-50">
          <p className="text-xs font-black text-purple-600 uppercase tracking-wide mb-1">
            Sticker Savings
          </p>
          <div className="flex items-baseline gap-2">
            <span
              data-testid="admin-savings-sticker-display"
              className="text-3xl font-black text-purple-700"
            >
              {savedStickers}
            </span>
            <Star className="w-5 h-5 text-purple-500 fill-current" />
          </div>
          <p className="text-xs text-gray-400 font-medium mt-2">Saved for future rewards</p>
        </Card>
      </div>

      <Card className="p-5 bg-orange-50 text-center">
        <p className="text-xs font-black text-orange-600 uppercase tracking-wide mb-1">
          Cash Equivalent
        </p>
        <span
          className="text-3xl font-black text-orange-700"
          data-testid="admin-savings-cash-equivalent"
        >
          {cashEquiv}
        </span>
      </Card>

      {editing && (
        <Card className="p-5 animate-in zoom-in-95 duration-200">
          <div className="bg-yellow-50 border-2 border-black rounded-xl p-4 shadow-neo-sm flex gap-3 items-start mb-5">
            <AlertTriangle className="w-5 h-5 text-yellow-600 flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-bold text-yellow-800">Manual Adjustment Warning</p>
              <p className="text-xs text-yellow-700 mt-1">
                This directly updates the database. Use only to correct errors or restore lost data.
              </p>
            </div>
          </div>
          <div className="space-y-4">
            <div>
              <label
                htmlFor="savings-cash-input"
                className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-1.5 block"
              >
                Cash Savings ({currencySymbol(currency)})
              </label>
              <input
                id="savings-cash-input"
                type="number"
                min={0}
                step={0.01}
                value={tempCash}
                onChange={(e) => setTempCash(Number(e.target.value))}
                data-testid="admin-savings-cash-input"
                className="w-full border-2 border-gray-200 rounded-xl px-4 py-2.5 font-medium text-gray-900 focus:border-orange-400 outline-none"
              />
            </div>
            <div>
              <label
                htmlFor="savings-sticker-input"
                className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-1.5 block"
              >
                Sticker Savings
              </label>
              <input
                id="savings-sticker-input"
                type="number"
                min={0}
                step={1}
                value={tempStickers}
                onChange={(e) => setTempStickers(Number(e.target.value))}
                data-testid="admin-savings-sticker-input"
                className="w-full border-2 border-gray-200 rounded-xl px-4 py-2.5 font-medium text-gray-900 focus:border-orange-400 outline-none"
              />
            </div>
            <div className="flex gap-3 pt-2">
              <Button
                variant="primary"
                size="md"
                fullWidth
                disabled={saving}
                onClick={() => void handleSave()}
                testId="admin-savings-save-btn"
              >
                {saving ? 'Updating…' : 'Update Savings'}
              </Button>
              <Button variant="secondary" size="md" onClick={() => setEditing(false)}>
                Cancel
              </Button>
            </div>
          </div>
        </Card>
      )}
    </div>
  );
}

// ── History tab ───────────────────────────────────────────────────────────────

function HistoryTab({
  memberId,
  headers,
  currency,
}: {
  memberId: string;
  headers: Record<string, string> | null;
  currency: string;
}) {
  const [weeks, setWeeks] = useState<WeekRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [tempCash, setTempCash] = useState({ carriedOverCash: 0, retrievedCash: 0 });
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [actions, setActions] = useState<WeekAction[]>([]);
  const [actionsLoading, setActionsLoading] = useState(false);
  // Confirm dialogs
  const [reopenTarget, setReopenTarget] = useState<string | null>(null);
  const [repairTarget, setRepairTarget] = useState<string | null>(null);
  const [closeTarget, setCloseTarget] = useState<string | null>(null);
  const [actionBusy, setActionBusy] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  const fetchWeeks = useCallback(async () => {
    if (!headers) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`${API_BASE}/api/mw/weeks?memberId=${memberId}`, { headers });
      if (!res.ok) throw new Error(`Weeks fetch failed: ${res.status}`);
      const body = (await res.json()) as { weeks?: WeekRow[] } | WeekRow[];
      const raw = Array.isArray(body) ? body : (body.weeks ?? []);
      const mapped: WeekRow[] = raw.map(
        (w) =>
          ({
            ...w,
            status:
              w.status === 'Active' || !w.status
                ? (w.isFinalized ?? false)
                  ? 'Finalized'
                  : 'Active'
                : w.status,
          }) as WeekRow,
      );
      mapped.sort((a, b) => {
        if (a.status === 'Active' && b.status !== 'Active') return -1;
        if (b.status === 'Active' && a.status !== 'Active') return 1;
        if (a.year !== b.year) return b.year - a.year;
        return b.weekNumber - a.weekNumber;
      });
      setWeeks(mapped);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load weeks');
    } finally {
      setLoading(false);
    }
  }, [headers, memberId]);

  useEffect(() => {
    void fetchWeeks();
  }, [fetchWeeks]);

  const toggleActions = async (weekId: string) => {
    if (expandedId === weekId) {
      setExpandedId(null);
      return;
    }
    setExpandedId(weekId);
    setActionsLoading(true);
    try {
      const res = await fetch(`${API_BASE}/api/mw/weeks/${weekId}/actions?memberId=${memberId}`, {
        headers: headers ?? {},
      });
      if (!res.ok) {
        setActions([]);
        return;
      }
      const body = (await res.json()) as { actions?: WeekAction[] } | WeekAction[];
      const list = Array.isArray(body) ? body : (body.actions ?? []);
      setActions(list);
    } catch {
      setActions([]);
    } finally {
      setActionsLoading(false);
    }
  };

  const saveWeekCash = async (weekId: string) => {
    if (!headers) return;
    setActionError(null);
    const res = await fetch(`${API_BASE}/api/mw/weeks/${weekId}/cash`, {
      method: 'PUT',
      headers: { ...headers, 'Content-Type': 'application/json' },
      body: JSON.stringify({ memberId, ...tempCash }),
    });
    if (!res.ok) {
      setActionError(`Cash update failed: ${res.status}`);
      return;
    }
    setWeeks((prev) => prev.map((w) => (w.id === weekId ? { ...w, ...tempCash } : w)));
    setEditingId(null);
  };

  const doReopen = async (weekId: string) => {
    if (!headers) return;
    setActionBusy(true);
    setActionError(null);
    try {
      const res = await fetch(`${API_BASE}/api/mw/weeks/${weekId}/reopen`, {
        method: 'POST',
        headers: { ...headers, 'Content-Type': 'application/json' },
        body: JSON.stringify({ memberId }),
      });
      if (!res.ok) {
        setActionError(`Reopen failed: ${res.status}`);
        return;
      }
      setWeeks((prev) =>
        prev.map((w) => (w.id === weekId ? { ...w, status: 'Active' as const } : w)),
      );
    } finally {
      setActionBusy(false);
      setReopenTarget(null);
    }
  };

  const doRepair = async (weekId: string) => {
    if (!headers) return;
    setActionBusy(true);
    setActionError(null);
    try {
      const res = await fetch(`${API_BASE}/api/mw/weeks/${weekId}/repair`, {
        method: 'POST',
        headers: { ...headers, 'Content-Type': 'application/json' },
        body: JSON.stringify({ memberId }),
      });
      if (!res.ok) {
        setActionError(`Repair failed: ${res.status}`);
        return;
      }
      await fetchWeeks();
    } finally {
      setActionBusy(false);
      setRepairTarget(null);
    }
  };

  const doClose = async (weekId: string) => {
    if (!headers) return;
    setActionBusy(true);
    setActionError(null);
    try {
      const res = await fetch(`${API_BASE}/api/mw/weeks/${weekId}/finalize`, {
        method: 'POST',
        headers: { ...headers, 'Content-Type': 'application/json' },
        body: JSON.stringify({ memberId, continueInvestmentIds: [] }),
      });
      if (!res.ok) {
        setActionError(`Close week failed: ${res.status}`);
        return;
      }
      await fetchWeeks();
    } finally {
      setActionBusy(false);
      setCloseTarget(null);
    }
  };

  if (loading)
    return (
      <p data-testid="admin-history-loading" className="text-sm text-purple-200">
        Loading history…
      </p>
    );
  if (error)
    return (
      <p data-testid="admin-history-error" className="text-sm text-red-300">
        {error}
      </p>
    );

  return (
    <div
      data-testid="admin-history-ready"
      className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500"
    >
      <div className="flex items-center gap-3">
        <div className="bg-blue-500 p-2.5 rounded-xl text-white shadow-sm">
          <Calendar className="w-5 h-5" />
        </div>
        <div>
          <h3 className="text-xl font-black text-white">Week History</h3>
          <p className="text-sm text-blue-400 font-medium">Review and edit past week data</p>
        </div>
      </div>

      <div className="space-y-4">
        {weeks.length === 0 && (
          <p className="text-sm text-purple-200">No weeks found for this child.</p>
        )}
        {weeks.map((week) => (
          <div
            key={week.id}
            data-testid={`admin-history-week-${week.id}`}
            className="bg-white rounded-2xl border-2 border-black shadow-neo-md overflow-hidden"
          >
            <div className="p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 border-b-2 border-gray-100">
              <div className="flex items-center gap-3">
                <div className="bg-gray-100 p-2 rounded-lg text-gray-500">
                  <Calendar className="w-4 h-4" />
                </div>
                <div>
                  <h4 className="font-bold text-gray-900">
                    Week {week.weekNumber}, {week.year}
                    {week.startDate && weekDateRange(week.startDate) && (
                      <span
                        className="ml-2 font-mono text-xs font-medium text-gray-500"
                        data-testid={`admin-history-week-${week.id}-range`}
                      >
                        {weekDateRange(week.startDate)}
                      </span>
                    )}
                  </h4>
                  <span
                    className={[
                      'text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wide',
                      week.status === 'Active'
                        ? 'bg-green-100 text-green-700'
                        : 'bg-gray-100 text-gray-600',
                    ].join(' ')}
                  >
                    {week.status}
                  </span>
                </div>
              </div>
              <div className="flex flex-wrap items-center gap-2 min-w-0">
                {week.status === 'Finalized' && (
                  <button
                    data-testid={`admin-history-week-reopen-btn-${week.id}`}
                    onClick={() => setReopenTarget(week.id)}
                    className="min-h-[44px] bg-amber-50 border border-amber-200 text-amber-700 text-xs font-bold px-3 py-1.5 rounded-lg flex items-center gap-1.5 hover:bg-amber-100 transition-colors"
                  >
                    <RotateCcw className="w-3 h-3" /> Reopen
                  </button>
                )}
                {week.status === 'Active' && (
                  <>
                    <button
                      data-testid={`admin-history-week-repair-btn-${week.id}`}
                      onClick={() => setRepairTarget(week.id)}
                      className="min-h-[44px] bg-purple-50 border border-purple-200 text-purple-700 text-xs font-bold px-3 py-1.5 rounded-lg flex items-center gap-1.5 hover:bg-purple-100 transition-colors"
                    >
                      <Wrench className="w-3 h-3" /> Recalculate Week
                    </button>
                    <button
                      data-testid={`admin-history-week-close-btn-${week.id}`}
                      onClick={() => setCloseTarget(week.id)}
                      className="min-h-[44px] bg-green-50 border border-green-200 text-green-700 text-xs font-bold px-3 py-1.5 rounded-lg flex items-center gap-1.5 hover:bg-green-100 transition-colors"
                    >
                      <CheckCircle className="w-3 h-3" /> Close Week
                    </button>
                  </>
                )}
                {editingId !== week.id ? (
                  <button
                    data-testid={`admin-history-week-edit-btn-${week.id}`}
                    onClick={() => {
                      setEditingId(week.id);
                      setTempCash({
                        carriedOverCash: week.carriedOverCash,
                        retrievedCash: week.retrievedCash,
                      });
                    }}
                    className="min-h-[44px] bg-white border border-gray-200 hover:border-gray-300 text-gray-600 text-xs font-bold px-3 py-1.5 rounded-lg flex items-center gap-1.5 transition-colors"
                  >
                    <Pencil className="w-3 h-3" /> Edit
                  </button>
                ) : (
                  <button
                    onClick={() => setEditingId(null)}
                    className="min-h-[44px] bg-gray-100 hover:bg-gray-200 text-gray-600 text-xs font-bold px-3 py-1.5 rounded-lg transition-colors"
                  >
                    Cancel
                  </button>
                )}
              </div>
            </div>

            <div className="p-4 sm:p-5 bg-gray-50/50">
              <div className="grid grid-cols-1 gap-4 text-sm sm:grid-cols-2">
                <div>
                  <p className="text-xs font-bold text-gray-400 uppercase mb-1">Carried Forward</p>
                  <p className="font-medium text-gray-700">
                    {week.carriedOverStickers} stickers
                    <span className="text-gray-400 mx-1">•</span>
                    {formatMoney(week.carriedOverCash ?? 0, currency)}
                  </p>
                </div>
                <div>
                  <p className="text-xs font-bold text-gray-400 uppercase mb-1">Retrieved</p>
                  <p className="font-medium text-gray-700">
                    {week.retrievedStickers} stickers
                    <span className="text-gray-400 mx-1">•</span>
                    {formatMoney(week.retrievedCash ?? 0, currency)}
                  </p>
                </div>
              </div>

              {/* Actions viewer */}
              <div className="mt-3">
                <button
                  data-testid={`admin-history-week-actions-btn-${week.id}`}
                  onClick={() => void toggleActions(week.id)}
                  className="min-h-[44px] inline-flex items-center text-xs font-bold text-purple-600 hover:text-purple-800 transition-colors"
                >
                  {expandedId === week.id ? 'Hide Actions' : 'View Actions'}
                </button>
                {expandedId === week.id && (
                  <div className="mt-2 space-y-1.5">
                    {actionsLoading ? (
                      <p className="text-xs text-gray-400">Loading…</p>
                    ) : actions.length === 0 ? (
                      <p className="text-xs text-gray-400">No actions recorded</p>
                    ) : (
                      actions.map((a) => (
                        <div
                          key={a.id}
                          className="flex items-center justify-between text-xs bg-white border border-gray-100 rounded-lg px-3 py-2"
                        >
                          <span className="font-bold text-gray-700 capitalize">
                            {a.actionType.replace('_', ' ')}
                          </span>
                          <span className="text-gray-500">
                            {a.stickersUsed ? `${a.stickersUsed} stickers` : ''}
                            {a.cashAmount ? ` • ${formatMoney(a.cashAmount, currency)}` : ''}
                            {a.rewardName ? ` • ${a.rewardName}` : ''}
                          </span>
                        </div>
                      ))
                    )}
                  </div>
                )}
              </div>

              {/* Edit form */}
              {editingId === week.id && (
                <div className="mt-4 pt-4 border-t border-gray-200 animate-in slide-in-from-top-2">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
                    <div>
                      <label
                        htmlFor={`hist-carried-cash-${week.id}`}
                        className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-1.5 block"
                      >
                        Carried Cash ({currencySymbol(currency)})
                      </label>
                      <input
                        id={`hist-carried-cash-${week.id}`}
                        type="number"
                        min={0}
                        step={0.01}
                        value={tempCash.carriedOverCash}
                        onChange={(e) =>
                          setTempCash((p) => ({ ...p, carriedOverCash: Number(e.target.value) }))
                        }
                        className="w-full border-2 border-gray-200 rounded-xl px-3 py-2 font-medium text-gray-900 focus:border-orange-400 outline-none text-sm"
                      />
                    </div>
                    <div>
                      <label
                        htmlFor={`hist-retrieved-cash-${week.id}`}
                        className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-1.5 block"
                      >
                        Retrieved Cash ({currencySymbol(currency)})
                      </label>
                      <input
                        id={`hist-retrieved-cash-${week.id}`}
                        type="number"
                        min={0}
                        step={0.01}
                        value={tempCash.retrievedCash}
                        onChange={(e) =>
                          setTempCash((p) => ({ ...p, retrievedCash: Number(e.target.value) }))
                        }
                        className="w-full border-2 border-gray-200 rounded-xl px-3 py-2 font-medium text-gray-900 focus:border-orange-400 outline-none text-sm"
                      />
                    </div>
                  </div>
                  <button
                    data-testid={`admin-history-week-save-btn-${week.id}`}
                    onClick={() => void saveWeekCash(week.id)}
                    className="w-full bg-orange-500 hover:bg-orange-600 text-white font-bold py-2.5 rounded-xl transition-colors"
                  >
                    Update Week Data
                  </button>
                </div>
              )}
            </div>
          </div>
        ))}
      </div>

      <div className="bg-blue-50 border-2 border-black rounded-xl p-4 shadow-neo-sm flex gap-3 items-start">
        <Info className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
        <p className="text-sm text-blue-800 font-medium">
          Week summary data shows what was carried forward and retrieved. Edit cash fields to fix
          week-to-week balances.
        </p>
      </div>

      {/* Action error */}
      {actionError && (
        <p data-testid="admin-history-action-error" className="text-sm text-red-600 font-bold">
          {actionError}
        </p>
      )}

      {/* Confirm dialogs */}
      <ConfirmDialog
        isOpen={reopenTarget !== null}
        title="Reopen this week?"
        message="The week will become active again. Any finalized calculations will be reversed."
        confirmLabel="Reopen"
        busy={actionBusy}
        onConfirm={() => {
          if (reopenTarget) void doReopen(reopenTarget);
        }}
        onCancel={() => setReopenTarget(null)}
        testId="admin-history-reopen-confirm"
      />
      <ConfirmDialog
        isOpen={repairTarget !== null}
        title="Recalculate this week?"
        message="This recalculates the week's totals to fix any mismatches."
        confirmLabel="Recalculate Week"
        busy={actionBusy}
        onConfirm={() => {
          if (repairTarget) void doRepair(repairTarget);
        }}
        onCancel={() => setRepairTarget(null)}
        testId="admin-history-repair-confirm"
      />
      <ConfirmDialog
        isOpen={closeTarget !== null}
        title="Close this week?"
        message="The week will be finalized. Make sure all actions are done first."
        confirmLabel="Close Week"
        busy={actionBusy}
        onConfirm={() => {
          if (closeTarget) void doClose(closeTarget);
        }}
        onCancel={() => setCloseTarget(null)}
        testId="admin-history-close-confirm"
      />
    </div>
  );
}

// ── Settings tab (FHS-455 rename of "App Info"; FHS-435 GDPR data export +
// account deletion) ─────────────────────────────────────────────────────────

function SettingsTab({
  headers,
  slug,
  onCurrencyChange,
}: {
  headers: Record<string, string> | null;
  slug: string;
  onCurrencyChange: (currency: string) => void;
}) {
  const navigate = useNavigate();

  const [settings, setSettings] = useState<AppSettings>({ currency: 'USD' });
  const [familyName, setFamilyName] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);
  const [tempCurrency, setTempCurrency] = useState('USD');
  const [saving, setSaving] = useState(false);

  // FHS-435: Download my data.
  const [exportBusy, setExportBusy] = useState(false);
  const [exportError, setExportError] = useState<string | null>(null);

  // FHS-435: Delete my account (irreversible).
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleteConfirmText, setDeleteConfirmText] = useState('');
  const [deleteBusy, setDeleteBusy] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  useEffect(() => {
    if (!headers) return;
    setLoading(true);
    fetch(`${API_BASE}/api/admin/settings`, { headers })
      .then((r) => (r.ok ? r.json() : {}))
      .then((b: Partial<AppSettings>) => setSettings({ currency: b.currency ?? 'USD' }))
      .catch(() => setError('Failed to load settings'))
      .finally(() => setLoading(false));
  }, [headers]);

  // Family display name: needed for the "type the family name to confirm"
  // delete gate. /api/me already lists every tenant the caller belongs to.
  useEffect(() => {
    if (!headers) return;
    fetch(`${API_BASE}/api/me`, { headers })
      .then((r) => (r.ok ? r.json() : null))
      .then((b: { tenants?: { slug: string; name: string }[] } | null) => {
        const tenant = b?.tenants?.find((t) => t.slug === slug);
        if (tenant) setFamilyName(tenant.name);
      })
      .catch(() => {});
  }, [headers, slug]);

  const startEdit = () => {
    setTempCurrency(settings.currency);
    setEditing(true);
  };

  const handleSave = async () => {
    if (!headers) return;
    setSaving(true);
    setError(null);
    try {
      if (tempCurrency !== settings.currency) {
        const res = await fetch(`${API_BASE}/api/admin/settings/currency`, {
          method: 'PUT',
          headers: { ...headers, 'Content-Type': 'application/json' },
          body: JSON.stringify({ value: tempCurrency }),
        });
        if (!res.ok) throw new Error(`Settings update failed: ${res.status}`);
      }
      setSettings({ currency: tempCurrency });
      // FHS-614 review: tell the page, so Balance, Savings and History show the
      // new currency straight away rather than the old one until a reload.
      onCurrencyChange(tempCurrency);
      setEditing(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to save settings');
    } finally {
      setSaving(false);
    }
  };

  const handleExport = async () => {
    if (!headers) return;
    setExportBusy(true);
    setExportError(null);
    try {
      const res = await fetch(`${API_BASE}/api/admin/export`, { headers });
      if (!res.ok) throw new Error(`Export failed: ${res.status}`);
      const blob = await res.blob();
      const disposition = res.headers.get('Content-Disposition') ?? '';
      const match = /filename="([^"]+)"/.exec(disposition);
      const filename = match?.[1] ?? 'familyhub-export.json';
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch (e) {
      setExportError(e instanceof Error ? e.message : 'Failed to download your data');
    } finally {
      setExportBusy(false);
    }
  };

  const handleDelete = async () => {
    if (!headers) return;
    setDeleteBusy(true);
    setDeleteError(null);
    try {
      const res = await fetch(`${API_BASE}/api/admin/delete-account`, {
        method: 'POST',
        headers: { ...headers, 'Content-Type': 'application/json' },
        body: JSON.stringify({ confirm: deleteConfirmText }),
      });
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { detail?: string };
        throw new Error(body.detail ?? `Delete failed: ${res.status}`);
      }
      // Account is gone: clear the local session (+ any kid PIN token on
      // this device) and leave the app.
      await signOutAll();
      navigate('/', { replace: true });
    } catch (e) {
      setDeleteError(e instanceof Error ? e.message : 'Failed to delete account');
      setDeleteBusy(false);
    }
  };

  if (loading)
    return (
      <p data-testid="admin-settings-loading" className="text-sm text-purple-200">
        Loading settings…
      </p>
    );

  return (
    <div
      data-testid="admin-settings-ready"
      className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500"
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="bg-purple-500 p-2.5 rounded-xl text-white shadow-sm">
            <SettingsIcon className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-xl font-black text-white">Settings</h3>
            <p className="text-sm text-purple-400 font-medium">Family settings</p>
          </div>
        </div>
        <button
          data-testid="admin-settings-edit-btn"
          onClick={editing ? () => setEditing(false) : startEdit}
          className={[
            'text-xs font-bold px-3 py-1.5 rounded-lg flex items-center gap-1.5 transition-colors border min-h-[44px]',
            editing
              ? 'bg-gray-100 border-gray-200 text-gray-700 hover:bg-gray-200'
              : 'bg-white border-gray-200 text-gray-600 hover:border-gray-300',
          ].join(' ')}
        >
          {editing ? (
            <>
              <X className="w-3 h-3" /> Cancel
            </>
          ) : (
            <>
              <Pencil className="w-3 h-3" /> Edit
            </>
          )}
        </button>
      </div>

      {error && <p className="text-sm text-red-300">{error}</p>}

      <Card className="p-5 space-y-4">
        <div>
          <p className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-1">Currency</p>
          <p
            data-testid="admin-settings-currency-display"
            className="text-base font-medium text-gray-700"
          >
            {settings.currency}
          </p>
        </div>
      </Card>

      {editing && (
        <Card className="p-5 animate-in zoom-in-95 duration-200">
          <div className="space-y-4">
            <div>
              <Label htmlFor="settings-currency-trigger">Currency</Label>
              <CurrencyPicker
                id="settings-currency-trigger"
                value={tempCurrency}
                onChange={setTempCurrency}
                testId="admin-settings-currency"
              />
            </div>
            <div className="flex gap-3 pt-2">
              <Button
                variant="primary"
                size="md"
                fullWidth
                disabled={saving}
                onClick={() => void handleSave()}
                testId="admin-settings-save-btn"
              >
                {saving ? 'Saving…' : 'Save Changes'}
              </Button>
              <Button variant="secondary" size="md" onClick={() => setEditing(false)}>
                Cancel
              </Button>
            </div>
          </div>
        </Card>
      )}

      {/* FHS-435: GDPR: Your data */}
      <Card className="p-5 space-y-4">
        <div>
          <h4 className="text-base font-black text-gray-900">Your data</h4>
          <p className="text-xs text-gray-500 mt-1">
            See our{' '}
            <Link
              to="/privacy"
              target="_blank"
              rel="noreferrer"
              className="underline font-bold text-gray-700"
            >
              Privacy Policy
            </Link>{' '}
            for how we handle your family&apos;s information.
          </p>
        </div>

        <Button
          variant="secondary"
          size="md"
          disabled={exportBusy}
          onClick={() => void handleExport()}
          testId="admin-settings-export-btn"
        >
          <Download className="w-4 h-4" />
          <span className="ml-1.5">{exportBusy ? 'Preparing…' : 'Download my data'}</span>
        </Button>
        {exportError && (
          <p data-testid="admin-settings-export-error" className="text-sm text-red-600 font-bold">
            {exportError}
          </p>
        )}

        <div className="border-t border-gray-100 pt-4">
          <p className="text-xs font-bold text-red-600 uppercase tracking-wide mb-2">Danger zone</p>
          <Button
            variant="danger"
            size="md"
            onClick={() => {
              setDeleteConfirmText('');
              setDeleteError(null);
              setDeleteOpen(true);
            }}
            testId="admin-settings-delete-btn"
          >
            <Trash2 className="w-4 h-4" />
            <span className="ml-1.5">Delete my account</span>
          </Button>
          <p className="text-xs text-gray-500 mt-2">
            This permanently deletes your family and everything in it: members, tasks, meals,
            habits, savings, everything. This cannot be undone.
          </p>
        </div>
      </Card>

      <ConfirmDialog
        isOpen={deleteOpen}
        variant="danger"
        title="Delete your family's account?"
        message={
          <>
            This <strong>permanently deletes {familyName || 'your family'}</strong> and every
            member, task, meal, event, habit, and record inside it. This action cannot be undone.
          </>
        }
        confirmLabel="Delete forever"
        busy={deleteBusy}
        confirmDisabled={!familyName || deleteConfirmText.trim() !== familyName.trim()}
        onConfirm={() => void handleDelete()}
        onCancel={() => setDeleteOpen(false)}
        testId="admin-settings-delete-confirm"
      >
        <div className="mt-4">
          <label
            htmlFor="settings-delete-confirm-input"
            className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-1.5 block"
          >
            Type{' '}
            <span
              data-testid="admin-settings-delete-family-name"
              className="font-black text-gray-900"
            >
              {familyName || '…'}
            </span>{' '}
            to confirm
          </label>
          <input
            id="settings-delete-confirm-input"
            type="text"
            value={deleteConfirmText}
            onChange={(e) => setDeleteConfirmText(e.target.value)}
            data-testid="admin-settings-delete-confirm-input"
            className="w-full border-2 border-gray-200 rounded-xl px-4 py-2.5 font-medium text-gray-900 focus:border-red-400 outline-none"
          />
          {deleteError && (
            <p
              data-testid="admin-settings-delete-error"
              className="text-sm text-red-600 font-bold mt-2"
            >
              {deleteError}
            </p>
          )}
        </div>
      </ConfirmDialog>
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────

/**
 * FHS-621: the Admin Panel is being split into pages named after the job they
 * do. This component still holds the work; the `variant` decides which half of
 * it a page shows, so the split can land without moving 2,000 lines in one go.
 *
 *   'money'           what a child has and what happened: balance, savings,
 *                     history, and the reward shop
 *   'family-settings' the rare and the dangerous: currency, export, delete
 *   'all'             the legacy combined panel, kept only for the old route
 *
 * FHS-622 and FHS-624 replace each half with the designed page.
 */
export type AdminPanelVariant = 'all' | 'money' | 'family-settings';

const VARIANT_TABS: Record<AdminPanelVariant, Tab[]> = {
  all: ['balance', 'savings', 'history', 'rewards', 'settings'],
  money: ['balance', 'savings', 'history', 'rewards'],
  'family-settings': ['settings'],
};

export function AdminPanelPage({ variant = 'all' }: { variant?: AdminPanelVariant } = {}) {
  const slug = useTenantSlug();
  const { session } = useAuth();
  const navigate = useNavigate();

  const [activeTab, setActiveTab] = useState<Tab>(VARIANT_TABS[variant][0]!);
  const [children, setChildren] = useState<MemberItem[]>([]);
  const [selectedChildId, setSelectedChildId] = useState<string | null>(null);
  const [currentWeek, setCurrentWeek] = useState<CurrentWeek | null>(null);
  // FHS-614: the family's currency, read once here and passed to every tab.
  // Each tab used to answer this for itself, and the Savings tab fell back to
  // AED while the database and every other screen default to USD.
  const [currency, setCurrency] = useState(FALLBACK_CURRENCY);
  // null = still loading; string = loaded (may be 'admin', 'adult', 'child', 'teen', etc.)
  const [callerRole, setCallerRole] = useState<string | null>(null);

  // Key the headers memo on the access_token string: refocus-safe.
  const token = session?.access_token ?? '';
  const headers = useMemo<Record<string, string> | null>(
    () => (token ? { Authorization: `Bearer ${token}`, 'x-tenant-slug': slug } : null),
    [token, slug],
  );

  // Fetch family members: filter to kids only for the child selector.
  // Also captures callerRole for the route guard below.
  useEffect(() => {
    if (!headers) return;
    fetch(`${API_BASE}/api/members`, { headers })
      .then((r) => {
        if (!r.ok) {
          setCallerRole('__denied__');
          return { members: [], callerRole: '__denied__' } as {
            members: MemberItem[];
            callerRole: string;
          };
        }
        return r.json() as Promise<{ members: MemberItem[]; callerRole: string }>;
      })
      .then((b) => {
        setCallerRole(b.callerRole ?? '__denied__');
        const kids = (b.members ?? []).filter((m) => isKidRole(m.role));
        setChildren(kids);
        if (kids.length > 0 && !selectedChildId) {
          setSelectedChildId(kids[0]!.id);
        }
      })
      .catch(() => setCallerRole('__denied__'));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [headers]);

  useEffect(() => {
    if (!headers) return;
    fetch(`${API_BASE}/api/reward-config`, { headers })
      .then((r) => (r.ok ? r.json() : null))
      .then((b: { currency?: string } | null) => {
        if (b?.currency) setCurrency(b.currency);
      })
      .catch(() => {
        /* keep the fallback: an unreadable currency must not blank the page */
      });
  }, [headers]);

  // FHS-343: the Admin Panel is admin-only; redirect any non-admin (incl. a
  // normal-user adult) to the dashboard once the role is known.
  useEffect(() => {
    if (callerRole === null) return;
    if (callerRole !== 'admin') {
      navigate(`/t/${slug}/dashboard`, { replace: true });
    }
  }, [callerRole, slug, navigate]);

  // Fetch current week for the selected child (needed for Invest quick action).
  useEffect(() => {
    if (!headers || !selectedChildId) return;
    fetch(`${API_BASE}/api/mw/weeks/current?memberId=${selectedChildId}`, { headers })
      .then((r) => (r.ok ? r.json() : null))
      .then((b: { week: CurrentWeek } | null) => setCurrentWeek(b?.week ?? null))
      .catch(() => {});
  }, [headers, selectedChildId]);

  const handleChildSelect = (id: string) => {
    setSelectedChildId(id);
    setCurrentWeek(null);
  };

  const ALL_TABS: { key: Tab; icon: React.ReactNode; label: string }[] = [
    { key: 'balance', icon: <Star className="w-4 h-4" />, label: 'Balance' },
    { key: 'savings', icon: <Pencil className="w-4 h-4" />, label: 'Savings' },
    { key: 'history', icon: <Calendar className="w-4 h-4" />, label: 'History' },
    { key: 'rewards', icon: <Gift className="w-4 h-4" />, label: 'Rewards' },
    { key: 'settings', icon: <SettingsIcon className="w-4 h-4" />, label: 'Settings' },
  ];
  // Only this page's own tabs. A page with one tab shows no tab bar at all:
  // there is nothing to choose between.
  const TABS = ALL_TABS.filter((t) => VARIANT_TABS[variant].includes(t.key));

  const childScopedTab =
    activeTab === 'balance' || activeTab === 'savings' || activeTab === 'history';

  // Must be defined before any early return so hooks count stays stable.
  const onHeaderTabChange = useCallback(
    (tabId: string) => {
      navigate(`/t/${slug}/dashboard${tabId === DEFAULT_TAB ? '' : `?tab=${tabId}`}`);
    },
    [navigate, slug],
  );

  // Still waiting for role from the API: show a minimal loading state.
  if (callerRole === null) {
    return (
      <div
        data-testid="admin-panel-loading"
        className="flex min-h-screen items-center justify-center bg-kingdom-bg"
      >
        <p className="text-sm text-purple-200 font-medium">Loading…</p>
      </div>
    );
  }

  return (
    <div
      data-testid="admin-panel"
      className="flex min-h-screen flex-col bg-kingdom-bg font-body text-gray-900"
    >
      {/* Global app header: same as dashboard; no tab is active on this page */}
      <AppHeader activeTab={null} onTabChange={onHeaderTabChange} />

      <div className="p-4 sm:p-6">
        <div className="mx-auto w-full max-w-5xl space-y-6">
          {/* Breadcrumb */}
          <div className="flex items-center gap-2 text-sm">
            <button
              type="button"
              onClick={() => navigate(`/t/${slug}/members`)}
              className="font-bold text-purple-200 hover:text-yellow-300 transition-colors"
            >
              ← Back to Manage Members
            </button>
          </div>

          {/* Header: orange→pink gradient */}
          <div className="bg-gradient-to-r from-orange-500 to-pink-500 rounded-2xl p-4 sm:p-5 text-white shadow-lg">
            <div className="flex items-center gap-3 sm:gap-4">
              <div className="bg-white/20 p-2 sm:p-3 rounded-xl backdrop-blur-sm">
                <ShieldCheck className="w-6 h-6 sm:w-8 sm:h-8 text-white" />
              </div>
              <div>
                <h1 className="text-xl sm:text-2xl font-black">Admin Panel</h1>
                <p className="text-white/80 font-medium text-sm">
                  Manage settings, balances, and members
                </p>
              </div>
            </div>
          </div>

          {/* Child selector: visible on Balance / Savings / History tabs */}
          {childScopedTab && (
            <ChildSelector
              kids={children}
              selectedId={selectedChildId}
              onSelect={handleChildSelect}
            />
          )}

          {/* Tab bar: scrollable on mobile. Hidden when this page has only one
              tab, since there is nothing to choose between (FHS-621). */}
          {TABS.length > 1 && (
            <div className="bg-gray-100 p-1.5 rounded-2xl flex gap-1 shadow-inner overflow-x-auto">
              {TABS.map((t) => (
                <button
                  key={t.key}
                  type="button"
                  aria-label={t.label}
                  data-testid={`admin-panel-tab-${t.key}`}
                  onClick={() => setActiveTab(t.key)}
                  className={[
                    'flex-1 flex items-center justify-center gap-1.5 px-3 py-2.5 rounded-xl text-xs sm:text-sm font-bold transition-all whitespace-nowrap min-h-[44px]',
                    activeTab === t.key
                      ? 'bg-white text-gray-900 shadow-sm'
                      : 'text-gray-500 hover:text-gray-700 hover:bg-gray-200/50',
                  ].join(' ')}
                >
                  {t.icon}
                  <span className="hidden xs:inline sm:inline">{t.label}</span>
                </button>
              ))}
            </div>
          )}

          {/* Tab content */}
          <div className="min-h-[400px]">
            {childScopedTab && !selectedChildId && children.length === 0 && (
              <p className="text-sm text-purple-200">
                No children in this family. Add one from{' '}
                <Link to={`/t/${slug}/members`} className="underline font-bold text-yellow-300">
                  Manage Members
                </Link>
                .
              </p>
            )}

            {activeTab === 'balance' && selectedChildId && (
              <BalanceTab
                memberId={selectedChildId}
                currentWeekId={currentWeek?.id ?? null}
                headers={headers}
                currency={currency}
              />
            )}

            {activeTab === 'savings' && selectedChildId && (
              <SavingsTab memberId={selectedChildId} headers={headers} currency={currency} />
            )}

            {activeTab === 'history' && selectedChildId && (
              <HistoryTab memberId={selectedChildId} headers={headers} currency={currency} />
            )}

            {activeTab === 'rewards' && <RewardsTab headers={headers} />}

            {activeTab === 'settings' && (
              <SettingsTab headers={headers} slug={slug} onCurrencyChange={setCurrency} />
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
