/**
 * ClaimRewardFlow: FHS-623
 *
 * The family's own reward shop (GET /api/rewards?memberId=), never the
 * design's hardcoded six. A reward costing more than the child's real
 * balance (the server's own `stickerBalance`, not a client guess) can't be
 * picked at all, so nothing here can be confirmed into a 409.
 */
import { useEffect, useState } from 'react';
import { Button, ChoiceRow, ResultBanner, Spinner, StepHeading } from '@familyhub/ui';
import { formatMoney } from '@familyhub/shared';
import { fetchRewards, redeemReward, MoneyActionError, type RewardOption } from './moneyActionsApi';
import { friendlyFailureMessage, type MoneyFlowProps } from './types';

// The action's colour, carried from its button into the step disc.
const TONE = 'bg-pink-300';

export function ClaimRewardFlow({ child, snapshot, headers, onSuccess, onCancel }: MoneyFlowProps) {
  const [loading, setLoading] = useState(true);
  const [loadFailed, setLoadFailed] = useState(false);
  const [rewards, setRewards] = useState<RewardOption[]>([]);
  const [stickerBalance, setStickerBalance] = useState(0);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetchRewards(child.id, headers)
      .then((body) => {
        if (cancelled) return;
        setRewards(body.rewards);
        setStickerBalance(body.stickerBalance);
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

  const selected = rewards.find((r) => r.id === selectedId) ?? null;

  const handleConfirm = async () => {
    if (!selected) return;
    setSubmitting(true);
    setError(null);
    try {
      const result = await redeemReward(selected.id, child.id, headers);
      onSuccess(`Claimed ${selected.name}. ${result.stickerBalance} stickers left to spend.`);
    } catch (err) {
      setError(friendlyFailureMessage(err instanceof MoneyActionError ? err.detail : undefined));
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center py-8" data-testid="money-claim-loading">
        <Spinner size="md" label="Loading the reward shop" />
      </div>
    );
  }

  if (loadFailed) {
    return (
      <div className="space-y-4">
        <ResultBanner tone="warning" testId="money-claim-load-error">
          Could not load the reward shop. Nothing has changed.
        </ResultBanner>
        <Button variant="secondary" fullWidth onClick={onCancel} testId="money-claim-cancel">
          Close
        </Button>
      </div>
    );
  }

  if (rewards.length === 0) {
    return (
      <div className="space-y-4">
        <ResultBanner showIcon={false} testId="money-claim-empty">
          No rewards in the shop yet. Add some from Earning rules first.
        </ResultBanner>
        <Button variant="secondary" fullWidth onClick={onCancel} testId="money-claim-cancel">
          Close
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* FHS-630: numbered question, matching the approved design. */}
      <StepHeading
        number={1}
        title="What are they claiming?"
        tone={TONE}
        testId="money-claim-step-1"
      />
      <div
        className="-mx-1 max-h-72 space-y-2 overflow-y-auto px-1 py-1"
        role="radiogroup"
        aria-label="Rewards"
      >
        {rewards.map((reward) => {
          const affordable = reward.stickerCost <= stickerBalance;
          return (
            <ChoiceRow
              key={reward.id}
              selected={selected?.id === reward.id}
              disabled={!affordable}
              onClick={() => setSelectedId(reward.id)}
              icon={reward.icon ?? '🎁'}
              title={reward.name}
              description={
                affordable
                  ? `${reward.stickerCost} stickers`
                  : `${reward.stickerCost} stickers, needs ${reward.stickerCost - stickerBalance} more`
              }
              testId={`money-claim-reward-${reward.id}`}
            />
          );
        })}
      </div>

      <ResultBanner showIcon={false} testId="money-claim-preview">
        {selected
          ? `${child.name} will get ${selected.name}, and spends ${selected.stickerCost} stickers (${formatMoney(
              selected.stickerCost * snapshot.stickerRate,
              snapshot.currency,
            )}). ${stickerBalance - selected.stickerCost} left after.`
          : `Pick a reward. ${child.name} has ${stickerBalance} stickers to spend.`}
      </ResultBanner>

      {error && (
        <ResultBanner tone="warning" testId="money-claim-error">
          {error}
        </ResultBanner>
      )}

      <div className="flex gap-3">
        <Button
          variant="secondary"
          fullWidth
          onClick={onCancel}
          disabled={submitting}
          testId="money-claim-cancel"
        >
          Cancel
        </Button>
        <Button
          variant="primary"
          fullWidth
          onClick={handleConfirm}
          disabled={!selected || submitting}
          testId="money-claim-confirm"
        >
          {submitting ? 'Claiming…' : 'Claim it'}
        </Button>
      </div>
    </div>
  );
}
