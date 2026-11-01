import { API_BASE } from '../../app/lib/api';

// FHS-374: My World data source. The same My World screen serves two callers:
//   • parent/admin viewing a child  → /api/* endpoints, ?memberId=, Supabase auth
//   • the logged-in kid (read-only) → /api/kid/* endpoints, kid-token auth
// This adapter is the ONLY place that knows the difference: it builds the right
// URL + headers per mode so the component code stays mode-agnostic. The kid mode
// is read-only: the component hides every write control when `readOnly` is true.

export interface MyWorldDataApi {
  readonly readOnly: boolean;
  readonly headers: Record<string, string>;
  habits(weekId: string): string;
  weeks(): string;
  weekStats(weekId: string): string;
  weekActions(weekId: string): string;
  savings(): string;
  investments(): string;
  rewards(): string;
  analytics(): string;
  // FHS-376: kid only: POST a "please can I have this reward" request. Parent
  // mode omits it (parents redeem directly; kids ask).
  rewardRequest?(rewardId: string): string;
}

export function parentDataApi(memberId: string, headers: Record<string, string>): MyWorldDataApi {
  const q = `memberId=${memberId}`;
  return {
    readOnly: false,
    headers,
    habits: (w) => `${API_BASE}/api/habits?${q}&weekId=${w}`,
    weeks: () => `${API_BASE}/api/mw/weeks?${q}`,
    weekStats: (w) => `${API_BASE}/api/mw/weeks/${w}/stats?${q}`,
    weekActions: (w) => `${API_BASE}/api/mw/weeks/${w}/actions?${q}`,
    savings: () => `${API_BASE}/api/mw/financial/savings?${q}`,
    investments: () => `${API_BASE}/api/mw/financial/investments?${q}`,
    rewards: () => `${API_BASE}/api/rewards?${q}`,
    analytics: () => `${API_BASE}/api/mw/analytics?${q}`,
  };
}

export function kidDataApi(kidToken: string): MyWorldDataApi {
  return {
    readOnly: true,
    headers: { Authorization: `Bearer ${kidToken}` },
    habits: (w) => `${API_BASE}/api/kid/habits?weekId=${w}`,
    weeks: () => `${API_BASE}/api/kid/weeks`,
    weekStats: (w) => `${API_BASE}/api/kid/weeks/${w}/stats`,
    weekActions: (w) => `${API_BASE}/api/kid/weeks/${w}/actions`,
    savings: () => `${API_BASE}/api/kid/financial/savings`,
    investments: () => `${API_BASE}/api/kid/financial/investments`,
    rewards: () => `${API_BASE}/api/kid/rewards`,
    analytics: () => `${API_BASE}/api/kid/analytics`,
    rewardRequest: (id) => `${API_BASE}/api/kid/rewards/${id}/request`,
  };
}
