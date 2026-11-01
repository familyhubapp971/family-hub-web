/**
 * moneyActionsApi: FHS-623
 *
 * Typed fetch calls for the five Kids money actions, against the exact
 * endpoints documented in FHS-627 (family-hub-api/api-docs/openapi.json). Every call takes
 * the same `headers` shape KidsMoneyPage already builds (Authorization +
 * x-tenant-slug) rather than the app-wide `apiFetch` helper, which doesn't
 * stamp x-tenant-slug.
 */
import { API_BASE } from '../../app/lib/api';

export type MoneyHeaders = Record<string, string>;

/** Thrown on any non-2xx response, carrying whatever the API said went wrong. */
export class MoneyActionError extends Error {
  constructor(
    public status: number,
    public errorCode: string | undefined,
    public detail: string | undefined,
  ) {
    super(detail ?? errorCode ?? `request failed (${status})`);
    this.name = 'MoneyActionError';
  }
}

async function postJson<T>(path: string, body: unknown, headers: MoneyHeaders): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    method: 'POST',
    headers: { ...headers, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const parsed = (await res.json().catch(() => null)) as {
      errorCode?: string;
      error?: string;
      detail?: string;
    } | null;
    throw new MoneyActionError(res.status, parsed?.errorCode, parsed?.detail ?? parsed?.error);
  }
  return (await res.json()) as T;
}

async function getJson<T>(path: string, headers: MoneyHeaders): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, { headers });
  if (!res.ok) {
    const parsed = (await res.json().catch(() => null)) as {
      errorCode?: string;
      error?: string;
      detail?: string;
    } | null;
    throw new MoneyActionError(res.status, parsed?.errorCode, parsed?.detail ?? parsed?.error);
  }
  return (await res.json()) as T;
}

// ── Claim a reward ──────────────────────────────────────────────────────────

export interface RewardOption {
  id: string;
  name: string;
  description: string | null;
  stickerCost: number;
  icon: string | null;
}

export async function fetchRewards(
  memberId: string,
  headers: MoneyHeaders,
): Promise<{ rewards: RewardOption[]; stickerBalance: number }> {
  return getJson(`/api/rewards?memberId=${memberId}`, headers);
}

export async function redeemReward(
  rewardId: string,
  memberId: string,
  headers: MoneyHeaders,
): Promise<{ stickerBalance: number; redemptionId: string }> {
  return postJson(`/api/rewards/${rewardId}/redeem`, { memberId }, headers);
}

// ── Cash out ─────────────────────────────────────────────────────────────

export async function cashOut(
  memberId: string,
  amount: number,
  headers: MoneyHeaders,
): Promise<{ success: boolean; cashDeducted?: number; stickersDeducted?: number }> {
  return postJson('/api/mw/financial/savings/cashout', { memberId, amount }, headers);
}

// ── Move to savings ──────────────────────────────────────────────────────

export async function moveToSavings(
  memberId: string,
  amount: number,
  headers: MoneyHeaders,
): Promise<{ success: boolean; transactionId?: string }> {
  return postJson('/api/mw/financial/savings', { memberId, type: 'stickers', amount }, headers);
}

// ── Invest and grow ──────────────────────────────────────────────────────

export interface InvestableHabit {
  id: string;
  name: string;
  icon: string | null;
}

export async function fetchHabits(
  memberId: string,
  weekId: string,
  headers: MoneyHeaders,
): Promise<{ habits: InvestableHabit[] }> {
  return getJson(`/api/habits?memberId=${memberId}&weekId=${weekId}`, headers);
}

export type InvestCoefficient = 1 | 2 | 3 | 5;

export async function createInvestment(
  params: {
    memberId: string;
    habitId: string;
    stickerCount: number;
    coefficient: InvestCoefficient;
    deductible: boolean;
  },
  headers: MoneyHeaders,
): Promise<{ id: string; investedStickers: number; coefficient: number; deductible: boolean }> {
  return postJson('/api/mw/financial/investments', params, headers);
}

// ── Take money out of an investment ─────────────────────────────────────

export interface ActiveInvestment {
  id: string;
  habitId: string;
  habitName: string | null;
  habitIcon: string | null;
  investedStickers: number;
  currentValueStickers: number;
  daysCompleted: number;
  daysMissed: number;
  deductible: boolean;
  coefficient?: number;
}

export async function fetchInvestments(
  memberId: string,
  headers: MoneyHeaders,
): Promise<{ investments: ActiveInvestment[] }> {
  return getJson(`/api/mw/financial/investments?memberId=${memberId}`, headers);
}

export async function withdrawInvestment(
  investmentId: string,
  memberId: string,
  stickers: number,
  headers: MoneyHeaders,
): Promise<{ success: boolean; withdrawnStickers?: number; remainingStickers?: number }> {
  return postJson(
    `/api/mw/financial/investments/${investmentId}/withdraw`,
    { memberId, stickers },
    headers,
  );
}

// ── Close the week ──────────────────────────────────────────────────────────

export interface FinalizeWeekResult {
  stickersAutoSaved?: number;
  investmentReturns?: number;
  continuedInvestments?: number;
  nextWeekId?: string;
}

/**
 * FHS-637: finish the week and open the next one.
 *
 * Every investment still running is carried into the new week, which is what
 * the old dialog did and what the design's "anything still here is carried
 * over" line promises. The ids are read fresh rather than from a snapshot the
 * sheet loaded minutes ago, so a withdrawal made in the same sitting is not
 * silently re-continued.
 */
export async function finalizeWeek(
  weekId: string,
  memberId: string,
  headers: MoneyHeaders,
): Promise<FinalizeWeekResult> {
  const running = await fetchInvestments(memberId, headers).catch(() => ({ investments: [] }));
  return postJson<FinalizeWeekResult>(
    `/api/mw/weeks/${weekId}/finalize`,
    { memberId, continueInvestmentIds: running.investments.map((inv) => inv.id) },
    headers,
  );
}
