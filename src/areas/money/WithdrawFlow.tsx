/**
 * WithdrawFlow: FHS-623
 *
 * Picks a running investment, then how many stickers to take out, not the
 * whole thing. Always sends an explicit `stickers` amount (the API's
 * "omit to take the lot" shortcut is never used from this UI), so a
 * deliberate partial withdrawal is always possible.
 */
import { useEffect, useState } from 'react';
import {
  Button,
  ChoiceRow,
  habitIcon,
  ResultBanner,
  Spinner,
  StepHeading,
  StickerAmountPicker,
} from '@familyhub/ui';
import { formatMoney } from '@familyhub/shared';
import {
  fetchInvestments,
  withdrawInvestment,
  MoneyActionError,
  type ActiveInvestment,
} from './moneyActionsApi';
import { friendlyFailureMessage, type MoneyFlowProps } from './types';

// The action's colour, carried from its button into every step disc.
const TONE = 'bg-orange-300';

// FHS-631: the stored value is an icon NAME, not an icon. See design-system.
function habitIconNode(name: string | null): React.ReactNode {
  const Icon = habitIcon(name);
  return <Icon size={18} strokeWidth={3} />;
}

export function WithdrawFlow({ child, snapshot, headers, onSuccess, onCancel }: MoneyFlowProps) {
  const [loading, setLoading] = useState(true);
  const [loadFailed, setLoadFailed] = useState(false);
  const [investments, setInvestments] = useState<ActiveInvestment[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [amount, setAmount] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetchInvestments(child.id, headers)
      .then((body) => {
        if (cancelled) return;
        setInvestments(body.investments);
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
  }, [child.id]);

  const selected = investments.find((i) => i.id === selectedId) ?? null;
  const max = selected?.currentValueStickers ?? 0;
  const cash = amount * snapshot.stickerRate;

  // FHS-630: picking an investment does not pre-fill the amount. The design
  // starts at zero and makes the parent say how much, so "Take out" can never
  // empty an investment they only meant to look at.
  const handlePick = (inv: ActiveInvestment) => {
    setSelectedId(inv.id);
    setAmount(0);
  };

  const handleConfirm = async () => {
    if (!selected || amount <= 0 || amount > max) return;
    setSubmitting(true);
    setError(null);
    try {
      await withdrawInvestment(selected.id, child.id, amount, headers);
      const remaining = max - amount;
      onSuccess(
        remaining > 0
          ? `Took ${amount} stickers out of ${selected.habitName ?? 'that investment'} (${formatMoney(cash, snapshot.currency)}) into savings. ${remaining} stickers keep growing.`
          : `Took the whole ${amount} stickers out of ${selected.habitName ?? 'that investment'} (${formatMoney(cash, snapshot.currency)}) into savings. Nothing left invested there.`,
      );
    } catch (err) {
      setError(friendlyFailureMessage(err instanceof MoneyActionError ? err.detail : undefined));
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center py-8" data-testid="money-withdraw-loading">
        <Spinner size="md" label="Loading investments" />
      </div>
    );
  }

  if (loadFailed) {
    return (
      <div className="space-y-4">
        <ResultBanner tone="warning" testId="money-withdraw-load-error">
          Could not load {child.name}&apos;s investments. Nothing has changed.
        </ResultBanner>
        <Button variant="secondary" fullWidth onClick={onCancel} testId="money-withdraw-cancel">
          Close
        </Button>
      </div>
    );
  }

  if (investments.length === 0) {
    return (
      <div className="space-y-4">
        <ResultBanner testId="money-withdraw-empty">
          {child.name} has nothing invested right now.
        </ResultBanner>
        <Button variant="secondary" fullWidth onClick={onCancel} testId="money-withdraw-cancel">
          Close
        </Button>
      </div>
    );
  }

  return (
    <div>
      {/* FHS-630: ported from the approved design (MoneyActions.tsx). The
          amount step appears once an investment is picked, because how many
          stickers you can take out depends on which one you chose. */}
      <StepHeading
        number={1}
        title="Which investment?"
        tone={TONE}
        testId="money-withdraw-step-1"
      />
      <div
        className="-mx-1 mt-3 max-h-48 space-y-2 overflow-y-auto px-1 py-1"
        role="radiogroup"
        aria-label="Investment"
      >
        {investments.map((inv) => (
          <ChoiceRow
            key={inv.id}
            selected={selectedId === inv.id}
            onClick={() => handlePick(inv)}
            icon={habitIconNode(inv.habitIcon)}
            marker="check"
            selectedTone={TONE}
            title={inv.habitName ?? 'Investment'}
            description={`${inv.currentValueStickers} stickers · ${formatMoney(
              inv.currentValueStickers * snapshot.stickerRate,
              snapshot.currency,
            )} · ${inv.coefficient ?? 5}x · ${
              inv.deductible ? 'a missed day takes value off' : 'no penalty for a missed day'
            }`}
            testId={`money-withdraw-investment-${inv.id}`}
          />
        ))}
      </div>

      {selected && (
        <>
          <StepHeading
            number={2}
            title="How many stickers are you taking out?"
            tone={TONE}
            testId="money-withdraw-step-2"
          />
          <p className="mt-1 text-sm font-bold text-gray-600">
            {`"${selected.habitName ?? 'This investment'}" holds ${max} stickers, worth ${formatMoney(
              max * snapshot.stickerRate,
              snapshot.currency,
            )}.`}
          </p>
          <div className="mt-3">
            <StickerAmountPicker
              value={amount}
              min={0}
              max={max}
              onChange={setAmount}
              variant="design"
              preview={`= ${formatMoney(cash, snapshot.currency)}`}
              useAllTone={TONE}
              testId="money-withdraw-amount"
            />
          </div>

          <div className="mt-5 space-y-3">
            <ResultBanner showIcon={false} testId="money-withdraw-preview">
              {amount > 0
                ? `${amount} stickers move to savings (${formatMoney(cash, snapshot.currency)}). ${
                    max - amount
                  } stay invested and keep growing.`
                : 'Pick how many stickers to take out.'}
            </ResultBanner>

            {error && (
              <ResultBanner tone="warning" testId="money-withdraw-error">
                {error}
              </ResultBanner>
            )}

            <div className="flex gap-3">
              <Button
                variant="secondary"
                fullWidth
                onClick={onCancel}
                disabled={submitting}
                testId="money-withdraw-cancel"
              >
                Cancel
              </Button>
              <Button
                variant="primary"
                fullWidth
                onClick={handleConfirm}
                disabled={amount <= 0 || submitting}
                testId="money-withdraw-confirm"
              >
                {submitting ? 'Withdrawing…' : `Take out ${amount} stickers`}
              </Button>
            </div>
          </div>
        </>
      )}

      {!selected && (
        <p className="mt-5 text-sm font-bold text-gray-600" data-testid="money-withdraw-pick-first">
          Pick an investment to choose how much comes out of it.
        </p>
      )}
    </div>
  );
}
