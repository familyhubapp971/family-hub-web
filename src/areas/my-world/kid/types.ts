// FHS-376: kid My World data shapes (subset of /api/kid/* we consume) +
// the derived view-model the dedicated kid components render. The kid UI is a
// DISTINCT design from the parent's MyWorldTab; it never reuses that screen.

export interface KidApiWeek {
  id: string;
  weekNumber: number;
  year: number;
  startDate: string;
  isFinalized: boolean;
  carriedOverStickers: number;
  carriedOverCash: number;
  retrievedStickers: number;
  retrievedCash: number;
}

export interface KidApiHabit {
  id: string;
  name: string;
  description: string | null;
  color: string;
  icon: string;
  isBonus: boolean;
}

export interface KidApiSticker {
  habitId: string;
  day: number; // 0=Mon … 6=Sun
  sticker: string;
  stickerValue: number;
}

export interface KidApiHabitsResponse {
  habits: KidApiHabit[];
  stickers: KidApiSticker[];
  week: {
    id: string;
    weekNumber: number;
    year: number;
    startDate: string;
    isFinalized: boolean;
  };
  balance: number;
  currency: string;
}

export interface KidSavings {
  savedStickers: number;
  savedCash: number;
  currency: string;
  // FHS-387: the fixed star-to-cash rate from the API; default 0.5 if absent.
  stickerRate?: number;
}

export interface KidInvestment {
  id: string;
  habitId: string;
  habitName: string | null;
  habitIcon: string | null;
  investedStickers: number;
  originalInvestedStickers: number;
  currentValue: number;
  currentValueStickers: number;
  daysCompleted: number;
  daysMissed: number;
}

export type RewardRequestStatus = 'none' | 'pending' | 'approved' | 'declined';

export interface KidReward {
  id: string;
  name: string;
  description: string | null;
  stickerCost: number;
  icon: string | null;
  requestStatus: RewardRequestStatus;
}

export interface KidRewardsResponse {
  rewards: KidReward[];
  stickerBalance: number;
}

export interface KidAnalyticsWeek {
  weekNumber: number;
  year: number;
  startDate: string;
  totalStickers: number;
  daysCompleted: number;
  completionRate: number;
}

export interface KidAnalyticsHabit {
  habitId: string;
  name: string;
  habitIcon: string | null;
  totalDays: number;
  completedDays: number;
  rate: number;
}

export interface KidAnalytics {
  stickersPerWeek: KidAnalyticsWeek[];
  habitStats: KidAnalyticsHabit[];
}

// ── Derived view-model ────────────────────────────────────────────────────────

// A habit with its 7-day "done" booleans worked out from the sticker rows.
export interface KidHabitView {
  id: string;
  name: string;
  color: string; // tailwind bg-* class straight from the API
  icon: string; // raw API icon name; mapped to a lucide icon by the card
  isBonus: boolean;
  days: boolean[]; // length 7, Mon..Sun, true = a sticker exists for that day
  progress: number; // count of done days
  total: number; // always 7
}
