/**
 * RewardSettingsPage: "Pocket money" (FHS-512, FHS-514).
 *
 * /t/:slug/reward-settings. Lets an admin set:
 *   1. the family's default sticker rate,
 *   2. a per-child rate override ("Different amount for {name}"),
 *   3. per-habit boost (2x/3x/5x) + an optional skip-penalty for a
 *      selected child's habits.
 *
 * MONEY RULE: every rate/penalty is handled as an INTEGER MINOR CURRENCY
 * UNIT (e.g. 50 = 0.50) end-to-end: the AmountPicker never emits a float,
 * and the PUT payloads to /api/reward-config and /api/habits/:id send
 * integers only. Decimal strings only ever exist for display.
 */

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { AlertTriangle, ArrowLeft, Ban, Coins } from 'lucide-react';
import {
  AmountPicker,
  BoostButton,
  Button,
  Card,
  ChoiceRow,
  ResultBanner,
  Select,
  Toggle,
} from '@familyhub/ui';
import { useAuth } from '../../app/lib/auth-context';
import { useTenantSlug } from '../../app/lib/tenant-context';
import { API_BASE } from '../../app/lib/api';
import { AppHeader } from '../../app/layout/AppHeader';
import { DEFAULT_TAB } from '../../app/layout/dashboard-tabs';
import { formatMoneyMinor as formatMinor, isFamilyAdminRole } from '@familyhub/shared';

const BOOST_PRESETS = [2, 3, 5] as const;
// FIX 3 (BLOCKER): matches the API's cap on rateMinor / skipPenaltyMinor
// (family-hub-api/src/areas/my-world/reward-config.ts, family-hub-api/src/areas/tasks/habits.ts) so
// the UI can't even try to submit a value the server will 400 on.
const RATE_MINOR_MAX = 100_000; // 1000.00 in the tenant's currency

interface KidRate {
  memberId: string;
  displayName: string;
  avatarEmoji: string | null;
  rateMinor: number | null;
  effectiveRateMinor: number;
}

interface RewardConfigResponse {
  currency: string;
  familyRateMinor: number;
  members: KidRate[];
}

interface MemberItem {
  id: string;
  displayName: string;
  role: string;
  avatarEmoji: string | null;
  isChild: boolean;
}

interface HabitItem {
  id: string;
  name: string;
  description: string | null;
  color: string;
  icon: string | null;
  isBonus: boolean;
  boost: number;
  skipPenaltyMinor: number;
}

function initial(name: string): string {
  return [...name.trim()][0]?.toUpperCase() ?? '?';
}

type Status = 'loading' | 'ready' | 'error';

export function RewardSettingsPage() {
  const slug = useTenantSlug();
  const { session } = useAuth();
  const navigate = useNavigate();

  const onHeaderTabChange = useCallback(
    (tabId: string) => {
      navigate(`/t/${slug}/dashboard${tabId === DEFAULT_TAB ? '' : `?tab=${tabId}`}`);
    },
    [navigate, slug],
  );

  const headers = useMemo(
    () =>
      session ? { Authorization: `Bearer ${session.access_token}`, 'x-tenant-slug': slug } : null,
    [session, slug],
  );

  const [status, setStatus] = useState<Status>('loading');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [currency, setCurrency] = useState('USD');
  const [familyRateMinor, setFamilyRateMinor] = useState(50);
  const [kids, setKids] = useState<KidRate[]>([]);
  // memberId -> whether the "different amount" toggle is on + the rate to use.
  const [overrides, setOverrides] = useState<
    Record<string, { enabled: boolean; rateMinor: number }>
  >({});

  // ── Step 3: per-habit boost + skip penalty ──────────────────────────────
  const [allKids, setAllKids] = useState<MemberItem[]>([]);
  const [selectedKidId, setSelectedKidId] = useState<string | null>(null);
  const [habits, setHabits] = useState<HabitItem[]>([]);
  const [selectedHabitId, setSelectedHabitId] = useState<string | null>(null);
  const [habitBoost, setHabitBoost] = useState(1);
  const [skipChoice, setSkipChoice] = useState<'none' | 'penalty'>('none');
  const [penaltyMinor, setPenaltyMinor] = useState(50);

  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [savedAt, setSavedAt] = useState<number | null>(null);

  const loadConfig = useCallback(async () => {
    if (!headers) return;
    setStatus('loading');
    setErrorMessage(null);
    try {
      const [configRes, membersRes] = await Promise.all([
        fetch(`${API_BASE}/api/reward-config`, { headers }),
        fetch(`${API_BASE}/api/members`, { headers }),
      ]);
      if (!configRes.ok) throw new Error(`Couldn't load reward settings (${configRes.status})`);
      const config = (await configRes.json()) as RewardConfigResponse;
      setCurrency(config.currency);
      setFamilyRateMinor(config.familyRateMinor);
      setKids(config.members);
      const nextOverrides: Record<string, { enabled: boolean; rateMinor: number }> = {};
      for (const kid of config.members) {
        nextOverrides[kid.memberId] = {
          enabled: kid.rateMinor !== null,
          rateMinor: kid.rateMinor ?? config.familyRateMinor,
        };
      }
      setOverrides(nextOverrides);

      if (membersRes.ok) {
        const body = (await membersRes.json()) as { members: MemberItem[]; callerRole: string };
        setIsAdmin(isFamilyAdminRole(body.callerRole));
        const kidMembers = (body.members ?? []).filter((m) => m.isChild);
        setAllKids(kidMembers);
        setSelectedKidId((prev) => prev ?? kidMembers[0]?.id ?? null);
      }
      setStatus('ready');
    } catch (err) {
      setStatus('error');
      setErrorMessage(err instanceof Error ? err.message : 'Network error. Try again.');
    }
  }, [headers]);

  useEffect(() => {
    void loadConfig();
  }, [loadConfig]);

  const loadHabits = useCallback(async () => {
    if (!headers || !selectedKidId) {
      setHabits([]);
      setSelectedHabitId(null);
      return;
    }
    try {
      const res = await fetch(`${API_BASE}/api/habits?memberId=${selectedKidId}`, { headers });
      if (!res.ok) return;
      const body = (await res.json()) as { habits: HabitItem[] };
      const nextHabits = body.habits ?? [];
      setHabits(nextHabits);
      // Pre-select the first habit so its config (boost + skip penalty) is
      // visible immediately, matching the mock's "one sample habit already
      // shown" presentation instead of requiring an extra tap to reveal it.
      const first = nextHabits[0];
      if (first) {
        setSelectedHabitId(first.id);
        setHabitBoost(first.boost);
        setSkipChoice(first.skipPenaltyMinor > 0 ? 'penalty' : 'none');
        setPenaltyMinor(first.skipPenaltyMinor > 0 ? first.skipPenaltyMinor : 50);
      } else {
        setSelectedHabitId(null);
      }
    } catch {
      setHabits([]);
    }
  }, [headers, selectedKidId]);

  useEffect(() => {
    void loadHabits();
  }, [loadHabits]);

  const selectedHabit = habits.find((h) => h.id === selectedHabitId) ?? null;

  const selectHabit = (habit: HabitItem) => {
    setSelectedHabitId(habit.id);
    setHabitBoost(habit.boost);
    setSkipChoice(habit.skipPenaltyMinor > 0 ? 'penalty' : 'none');
    setPenaltyMinor(habit.skipPenaltyMinor > 0 ? habit.skipPenaltyMinor : 50);
  };

  const handleSave = async () => {
    if (!headers || !isAdmin) return;
    setSaving(true);
    setSaveError(null);
    try {
      const memberOverrides = kids.map((kid) => {
        const o = overrides[kid.memberId];
        return { memberId: kid.memberId, rateMinor: o?.enabled ? o.rateMinor : null };
      });
      const configRes = await fetch(`${API_BASE}/api/reward-config`, {
        method: 'PUT',
        headers: { ...headers, 'Content-Type': 'application/json' },
        body: JSON.stringify({ familyRateMinor, memberOverrides }),
      });
      if (!configRes.ok) {
        const body = (await configRes.json().catch(() => ({}))) as { detail?: string };
        throw new Error(body.detail ?? `Couldn't save (${configRes.status})`);
      }

      if (selectedHabit && selectedKidId) {
        const habitRes = await fetch(`${API_BASE}/api/habits/${selectedHabit.id}`, {
          method: 'PUT',
          headers: { ...headers, 'Content-Type': 'application/json' },
          body: JSON.stringify({
            memberId: selectedKidId,
            boost: habitBoost,
            skipPenaltyMinor: skipChoice === 'penalty' ? penaltyMinor : 0,
          }),
        });
        if (!habitRes.ok) {
          const body = (await habitRes.json().catch(() => ({}))) as { detail?: string };
          throw new Error(body.detail ?? `Couldn't save the habit (${habitRes.status})`);
        }
      }

      await loadConfig();
      await loadHabits();
      setSavedAt(Date.now());
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : 'Network error. Try again.');
    } finally {
      setSaving(false);
    }
  };

  const habitResultLine =
    selectedHabit &&
    `This habit pays ${formatMinor(
      (overrides[selectedKidId ?? '']?.enabled
        ? overrides[selectedKidId ?? '']!.rateMinor
        : familyRateMinor) * habitBoost,
      currency,
    )} each time.`;

  return (
    <div
      className="flex min-h-screen flex-col bg-kingdom-bg font-body text-gray-900"
      data-testid="reward-settings-page"
    >
      <AppHeader activeTab={null} onTabChange={onHeaderTabChange} />
      <div className="mx-auto w-full max-w-5xl flex-1 p-4 pb-40 sm:p-6 sm:pb-36">
        <div className="mb-4">
          <Link
            to={`/t/${slug}/dashboard`}
            className="inline-flex items-center gap-1.5 text-sm font-bold text-purple-200 hover:text-white"
            data-testid="reward-settings-back-link"
          >
            <ArrowLeft size={16} aria-hidden="true" /> Back to dashboard
          </Link>
        </div>

        <div className="mb-6 flex items-center gap-3">
          <span
            aria-hidden="true"
            className="flex h-12 w-12 items-center justify-center rounded-full border-2 border-black bg-yellow-300 shadow-neo-sm"
          >
            <Coins size={22} aria-hidden="true" />
          </span>
          <div>
            <h1 className="font-heading text-2xl uppercase tracking-wide text-white sm:text-3xl">
              Reward settings
            </h1>
            <p className="text-sm font-medium text-purple-200">
              Set how much your kids earn for their habits.
            </p>
          </div>
        </div>

        {status === 'loading' && (
          <p data-testid="reward-settings-loading" className="text-sm text-gray-500">
            Loading…
          </p>
        )}
        {status === 'error' && (
          <Card testId="reward-settings-error" className="border-red-400 bg-red-50">
            <p className="text-sm font-bold text-red-700">{errorMessage}</p>
          </Card>
        )}

        {status === 'ready' && !isAdmin && (
          <Card
            testId="reward-settings-readonly-notice"
            className="mb-4 flex items-start gap-3 border-amber-400 bg-amber-50"
          >
            <Ban size={18} className="mt-0.5 shrink-0 text-amber-600" aria-hidden="true" />
            <p className="text-sm font-bold text-amber-800">
              Only an admin can change pocket money settings. You can still see the current setup
              below.
            </p>
          </Card>
        )}

        {status === 'ready' && (
          <>
            <div className="grid grid-cols-1 items-start gap-5 lg:grid-cols-2">
              {/* ── Left column: steps 1 + 2 ── */}
              <div className="space-y-5">
                {/* ── Step 1: family default rate ── */}
                <Card testId="reward-settings-step-1">
                  <StepHeading number={1} title="How much is one sticker worth?" />
                  <AmountPicker
                    valueMinor={familyRateMinor}
                    currency={currency}
                    maxMinor={RATE_MINOR_MAX}
                    onChange={setFamilyRateMinor}
                    label="Every family member starts with this rate"
                    testId="reward-settings-family-rate"
                  />
                </Card>

                {/* ── Step 2: per-child overrides ── */}
                <Card testId="reward-settings-step-2">
                  <StepHeading number={2} title="Does one child earn a different amount?" />
                  {kids.length === 0 && (
                    <p className="text-sm text-gray-500">No kids in this family yet.</p>
                  )}
                  <div className="space-y-3">
                    {kids.map((kid) => {
                      const o = overrides[kid.memberId] ?? {
                        enabled: false,
                        rateMinor: familyRateMinor,
                      };
                      return (
                        <div
                          key={kid.memberId}
                          data-testid={`reward-settings-kid-${kid.memberId}`}
                          className="rounded-xl border-2 border-gray-200 p-3.5"
                        >
                          <div className="flex items-center justify-between gap-3">
                            <div className="flex items-center gap-2.5">
                              <span
                                aria-hidden="true"
                                className="flex h-8 w-8 items-center justify-center rounded-full border-2 border-black bg-purple-200 font-heading text-sm"
                              >
                                {kid.avatarEmoji ?? initial(kid.displayName)}
                              </span>
                              <span className="text-sm font-bold text-gray-900">
                                Different amount for {kid.displayName}
                              </span>
                            </div>
                            <Toggle
                              checked={o.enabled}
                              onChange={(checked) =>
                                setOverrides((prev) => ({
                                  ...prev,
                                  [kid.memberId]: { ...o, enabled: checked },
                                }))
                              }
                              label={`Different amount for ${kid.displayName}`}
                              testId={`reward-settings-kid-${kid.memberId}-toggle`}
                            />
                          </div>
                          {o.enabled && (
                            <div className="mt-3">
                              <AmountPicker
                                valueMinor={o.rateMinor}
                                currency={currency}
                                maxMinor={RATE_MINOR_MAX}
                                onChange={(rateMinor) =>
                                  setOverrides((prev) => ({
                                    ...prev,
                                    [kid.memberId]: { ...o, rateMinor },
                                  }))
                                }
                                testId={`reward-settings-kid-${kid.memberId}-rate`}
                              />
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </Card>
              </div>

              {/* ── Right column: step 3: boost a habit or set a skip penalty ── */}
              <Card testId="reward-settings-step-3">
                <StepHeading number={3} title="Should big habits pay more?" />

                {allKids.length > 1 && (
                  <div
                    className="mb-4 flex flex-wrap gap-2"
                    data-testid="reward-settings-kid-picker"
                  >
                    {allKids.map((kid) => (
                      <button
                        key={kid.id}
                        type="button"
                        data-testid={`reward-settings-kid-picker-${kid.id}`}
                        onClick={() => setSelectedKidId(kid.id)}
                        className={[
                          'min-h-11 rounded-xl border-2 border-black px-3 py-2 text-sm font-bold transition-all',
                          kid.id === selectedKidId
                            ? 'bg-yellow-400 shadow-neo-xs'
                            : 'bg-white hover:bg-gray-50',
                        ].join(' ')}
                      >
                        {kid.displayName}
                      </button>
                    ))}
                  </div>
                )}

                {habits.length === 0 && (
                  <p className="text-sm text-gray-500">No habits for this child yet.</p>
                )}

                {habits.length > 1 && (
                  <div className="mb-4">
                    <label
                      htmlFor="reward-settings-habit-select"
                      className="mb-1.5 block text-xs font-bold uppercase tracking-wide text-gray-500"
                    >
                      Which habit?
                    </label>
                    <Select
                      id="reward-settings-habit-select"
                      testId="reward-settings-habit-select"
                      value={selectedHabitId ?? ''}
                      onChange={(e) => {
                        const habit = habits.find((h) => h.id === e.target.value);
                        if (habit) selectHabit(habit);
                      }}
                    >
                      {habits.map((habit) => (
                        <option key={habit.id} value={habit.id}>
                          {habit.name}
                        </option>
                      ))}
                    </Select>
                  </div>
                )}

                {selectedHabit && (
                  <div className="space-y-5">
                    {habits.length === 1 && (
                      <p
                        data-testid="reward-settings-habit-name"
                        className="font-heading text-base uppercase tracking-wide text-gray-900"
                      >
                        {selectedHabit.name}
                      </p>
                    )}

                    <div>
                      <p className="mb-2 text-xs font-bold uppercase tracking-wide text-gray-500">
                        Boost
                      </p>
                      <div className="flex gap-2">
                        <BoostButton
                          multiplier={1}
                          selected={habitBoost === 1}
                          onClick={() => setHabitBoost(1)}
                          testId="reward-settings-boost-1"
                        />
                        {BOOST_PRESETS.map((n) => (
                          <BoostButton
                            key={n}
                            multiplier={n}
                            selected={habitBoost === n}
                            onClick={() => setHabitBoost(n)}
                            testId={`reward-settings-boost-${n}`}
                          />
                        ))}
                      </div>
                      {habitResultLine && (
                        <div className="mt-3">
                          <ResultBanner testId="reward-settings-boost-result">
                            {habitResultLine}
                          </ResultBanner>
                        </div>
                      )}
                    </div>

                    <div className="border-t-2 border-dashed border-gray-200 pt-5">
                      <p className="mb-2 text-xs font-bold uppercase tracking-wide text-gray-500">
                        What happens on a day they skip it?
                      </p>
                      <div role="radiogroup" className="space-y-2">
                        <ChoiceRow
                          selected={skipChoice === 'none'}
                          onClick={() => setSkipChoice('none')}
                          title="Nothing happens"
                          description="Missing a day just means no sticker that day."
                          icon="🙂"
                          testId="reward-settings-skip-none"
                        />
                        <ChoiceRow
                          selected={skipChoice === 'penalty'}
                          onClick={() => setSkipChoice('penalty')}
                          title="They lose some money"
                          description="A missed day deducts from their savings when the week closes."
                          icon="⚠️"
                          testId="reward-settings-skip-penalty"
                        />
                      </div>
                      {skipChoice === 'penalty' && (
                        <div className="mt-3">
                          <AmountPicker
                            valueMinor={penaltyMinor}
                            currency={currency}
                            maxMinor={RATE_MINOR_MAX}
                            onChange={setPenaltyMinor}
                            label="Amount lost per missed day"
                            testId="reward-settings-penalty-amount"
                          />
                          <div className="mt-3">
                            <ResultBanner tone="warning" testId="reward-settings-penalty-result">
                              Missing a day docks {formatMinor(penaltyMinor, currency)} from savings
                              when the week closes.
                            </ResultBanner>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </Card>
            </div>

            {saveError && (
              <div
                data-testid="reward-settings-save-error"
                className="mt-5 flex items-start gap-2 rounded-xl border-2 border-red-400 bg-red-50 p-3.5"
              >
                <AlertTriangle
                  size={16}
                  className="mt-0.5 shrink-0 text-red-600"
                  aria-hidden="true"
                />
                <p className="text-sm font-bold text-red-700">{saveError}</p>
              </div>
            )}
            {savedAt && !saveError && (
              <p
                data-testid="reward-settings-saved-notice"
                className="mt-5 text-sm font-bold text-green-700"
              >
                Saved!
              </p>
            )}
          </>
        )}
      </div>

      {/* ── Fixed bottom Save bar ── */}
      {status === 'ready' && isAdmin && (
        <div className="fixed inset-x-0 bottom-0 z-30 border-t-2 border-black bg-kingdom-950 p-3 shadow-neo-lg">
          <div className="mx-auto flex w-full max-w-5xl items-center justify-end gap-3">
            <Button
              variant="pink"
              size="lg"
              disabled={saving}
              onClick={() => void handleSave()}
              testId="reward-settings-save-btn"
            >
              {saving ? 'Saving…' : 'Save'}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

function StepHeading({ number, title }: { number: number; title: string }) {
  return (
    <div className="mb-3 flex items-center gap-2.5">
      <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full border-2 border-black bg-yellow-400 text-xs font-black text-gray-900">
        {number}
      </span>
      <h2 className="font-heading text-sm uppercase tracking-wide text-gray-900 sm:text-base">
        {title}
      </h2>
    </div>
  );
}
