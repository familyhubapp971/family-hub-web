/**
 * InvestFlow: FHS-623
 *
 * Picks a habit, a growth multiplier, and the missed-day rule, then how many
 * stickers to invest, and sends all four to the server: this app has never
 * sent `coefficient` or `deductible` before even though the API has always
 * accepted both (they default to 5 / true server-side when omitted).
 */
import { useEffect, useState } from 'react';
import { AlertTriangle, ShieldCheck } from 'lucide-react';
import {
  Button,
  ChoiceRow,
  habitIcon,
  ResultBanner,
  Spinner,
  StepHeading,
  StickerAmountPicker,
  investmentRule,
} from '@familyhub/ui';
import { formatMoney } from '@familyhub/shared';
import {
  createInvestment,
  fetchHabits,
  fetchInvestments,
  MoneyActionError,
  type InvestCoefficient,
  type InvestableHabit,
} from './moneyActionsApi';
import { friendlyFailureMessage, type MoneyFlowProps } from './types';

// Mirrors family-hub-api/src/areas/my-world/myworld.ts INVEST_MIN_STICKERS: the server
// rejects anything below this, so the picker never lets a family reach it.
const INVEST_MIN_STICKERS = 10;
const COEFFICIENTS: readonly InvestCoefficient[] = [1, 2, 3, 5];
// The action's colour, carried from its button into every step disc.
const TONE = 'bg-yellow-300';

// FHS-631: a habit's icon is stored as a NAME, so it must be mapped to a
// component. Rendering the raw value printed the word "heart" on the row.
function habitIconNode(name: string | null): React.ReactNode {
  const Icon = habitIcon(name);
  return <Icon size={18} strokeWidth={3} />;
}

export function InvestFlow({
  child,
  snapshot,
  weekId,
  headers,
  onSuccess,
  onCancel,
}: MoneyFlowProps) {
  const [loading, setLoading] = useState(true);
  const [loadFailed, setLoadFailed] = useState(false);
  const [habits, setHabits] = useState<InvestableHabit[]>([]);
  const [investedHabitIds, setInvestedHabitIds] = useState<Set<string>>(new Set());
  const [selectedHabitId, setSelectedHabitId] = useState<string | null>(null);
  // FHS-630: the design opens on 2x with no missed-day penalty. Those are the
  // gentler defaults, and they are what a parent sees before touching anything,
  // so they are the ones that must match.
  const [coefficient, setCoefficient] = useState<InvestCoefficient>(2);
  const [deductible, setDeductible] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Conservative ceiling: the page's own snapshot only tracks spendable
  // (available) and saved-as-stickers, not saved-as-cash, so this can be a
  // little lower than what the server would actually allow (which also
  // counts saved cash, converted at the child's rate). That only means this
  // picker occasionally under-offers, never over-offers, and the server
  // stays the final word either way.
  const maxInvestable = snapshot.available + snapshot.saved;

  const [amount, setAmount] = useState(Math.max(INVEST_MIN_STICKERS, 0));

  useEffect(() => {
    if (!weekId) {
      setLoadFailed(true);
      setLoading(false);
      return;
    }
    let cancelled = false;
    Promise.all([fetchHabits(child.id, weekId, headers), fetchInvestments(child.id, headers)])
      .then(([habitsBody, investmentsBody]) => {
        if (cancelled) return;
        setHabits(habitsBody.habits);
        setInvestedHabitIds(new Set(investmentsBody.investments.map((i) => i.habitId)));
      })
      .catch(() => {
        if (!cancelled) setLoadFailed(true);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [child.id, weekId]);

  const availableHabits = habits.filter((h) => !investedHabitIds.has(h.id));
  const selectedHabit = habits.find((h) => h.id === selectedHabitId) ?? null;
  const cash = amount * snapshot.stickerRate;
  const notEnough = maxInvestable < INVEST_MIN_STICKERS;

  const handleConfirm = async () => {
    if (!selectedHabit || amount < INVEST_MIN_STICKERS || amount > maxInvestable) return;
    setSubmitting(true);
    setError(null);
    try {
      await createInvestment(
        {
          memberId: child.id,
          habitId: selectedHabit.id,
          stickerCount: amount,
          coefficient,
          deductible,
        },
        headers,
      );
      onSuccess(
        `Invested ${amount} stickers behind ${selectedHabit.name} at ${coefficient}x. ${investmentRule(deductible)}`,
      );
    } catch (err) {
      setError(friendlyFailureMessage(err instanceof MoneyActionError ? err.detail : undefined));
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center py-8" data-testid="money-invest-loading">
        <Spinner size="md" label="Loading habits" />
      </div>
    );
  }

  if (loadFailed) {
    return (
      <div className="space-y-4">
        <ResultBanner tone="warning" testId="money-invest-load-error">
          Could not load {child.name}&apos;s habits. Nothing has changed.
        </ResultBanner>
        <Button variant="secondary" fullWidth onClick={onCancel} testId="money-invest-cancel">
          Close
        </Button>
      </div>
    );
  }

  if (notEnough) {
    return (
      <div className="space-y-4">
        <ResultBanner testId="money-invest-not-enough">
          You need at least {INVEST_MIN_STICKERS} stickers to invest. {child.name} has{' '}
          {maxInvestable}.
        </ResultBanner>
        <Button variant="secondary" fullWidth onClick={onCancel} testId="money-invest-cancel">
          Close
        </Button>
      </div>
    );
  }

  if (availableHabits.length === 0) {
    return (
      <div className="space-y-4">
        <ResultBanner testId="money-invest-no-habits">
          Every habit already has an investment running, or {child.name} has no habits yet.
        </ResultBanner>
        <Button variant="secondary" fullWidth onClick={onCancel} testId="money-invest-cancel">
          Close
        </Button>
      </div>
    );
  }

  return (
    <div>
      {/* FHS-630: ported from the approved design (MoneyActions.tsx). Numbered
          questions, and the later steps appear once a habit is picked, so the
          sheet asks one thing at a time instead of presenting a long form. */}
      <StepHeading number={1} title="Which habit?" tone={TONE} testId="money-invest-step-1" />
      <div
        className="-mx-1 mt-3 max-h-48 space-y-2 overflow-y-auto px-1 py-1"
        role="radiogroup"
        aria-label="Habit"
      >
        {availableHabits.map((habit) => (
          <ChoiceRow
            key={habit.id}
            selected={selectedHabitId === habit.id}
            onClick={() => setSelectedHabitId(habit.id)}
            icon={habitIconNode(habit.icon)}
            title={habit.name}
            marker="check"
            selectedTone={TONE}
            testId={`money-invest-habit-${habit.id}`}
          />
        ))}
      </div>

      {selectedHabit && (
        <>
          <StepHeading
            number={2}
            title="How much does it pay?"
            tone={TONE}
            testId="money-invest-step-2"
          />
          <div role="radiogroup" aria-label="How much does it pay?" className="mt-3 flex gap-2">
            {COEFFICIENTS.map((n) => (
              <button
                key={n}
                type="button"
                role="radio"
                aria-checked={coefficient === n}
                data-testid={`money-invest-coefficient-${n}`}
                onClick={() => setCoefficient(n)}
                className={[
                  'min-h-11 flex-1 rounded-xl border-2 border-black px-3 py-2.5 font-heading text-lg transition-all',
                  'motion-safe:hover:-translate-y-0.5',
                  coefficient === n
                    ? 'bg-yellow-300 text-black shadow-neo-xs'
                    : 'bg-white text-gray-500 hover:bg-gray-50',
                ].join(' ')}
              >
                {n}x
              </button>
            ))}
          </div>

          <StepHeading
            number={3}
            title="What happens on a skipped day?"
            tone={TONE}
            testId="money-invest-step-3"
          />
          <div
            role="radiogroup"
            aria-label="What happens on a skipped day?"
            className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2"
          >
            <ChoiceRow
              selected={!deductible}
              onClick={() => setDeductible(false)}
              icon={<ShieldCheck size={18} strokeWidth={3} />}
              title="Nothing"
              description="They keep what they have grown."
              marker="check"
              selectedTone="bg-green-300"
              testId="money-invest-deductible-off"
            />
            <ChoiceRow
              selected={deductible}
              onClick={() => setDeductible(true)}
              icon={<AlertTriangle size={18} strokeWidth={3} />}
              title="Some comes off"
              description="A missed day takes value away."
              marker="check"
              selectedTone="bg-red-300"
              testId="money-invest-deductible-on"
            />
          </div>

          <StepHeading
            number={4}
            title="How many stickers?"
            tone={TONE}
            testId="money-invest-step-4"
          />
          <div className="mt-3">
            <StickerAmountPicker
              value={amount}
              min={INVEST_MIN_STICKERS}
              max={maxInvestable}
              onChange={setAmount}
              variant="design"
              preview={`= ${formatMoney(cash, snapshot.currency)} now, and ${INVEST_MIN_STICKERS} is the least you can invest`}
              useAllTone={TONE}
              testId="money-invest-amount"
            />
          </div>

          <div className="mt-5 space-y-3">
            <ResultBanner showIcon={false} testId="money-invest-preview">
              {`Invest ${amount} stickers behind ${selectedHabit.name} at ${coefficient}x. ${investmentRule(deductible)}`}
            </ResultBanner>

            {error && (
              <ResultBanner tone="warning" testId="money-invest-error">
                {error}
              </ResultBanner>
            )}

            <div className="flex gap-3">
              <Button
                variant="secondary"
                fullWidth
                onClick={onCancel}
                disabled={submitting}
                testId="money-invest-cancel"
              >
                Cancel
              </Button>
              <Button
                variant="primary"
                fullWidth
                onClick={handleConfirm}
                disabled={amount < INVEST_MIN_STICKERS || submitting}
                testId="money-invest-confirm"
              >
                {submitting ? 'Investing…' : `Invest ${amount} stickers`}
              </Button>
            </div>
          </div>
        </>
      )}

      {!selectedHabit && (
        <p className="mt-5 text-sm font-bold text-gray-600" data-testid="money-invest-pick-first">
          Pick a habit to choose how much it pays and how many stickers go behind it.
        </p>
      )}
    </div>
  );
}
