import { useState } from 'react';
import { ShoppingBag, Star } from 'lucide-react';
import type { KidReward } from './types';

// FHS-376: the kid's "Reward Goals" shop. A kid never spends directly; they ASK
// a grown-up, who approves. Each row is a little state machine:
//   none + affordable      → "Ask for this 🎁"  → confirm → POST → pending
//   none + not affordable  → disabled "Keep saving" + a progress bar to the goal
//   pending                → "⏳ Requested! Waiting for a grown-up"
//   approved               → "🎉 Yay! Approved!"
//   declined               → "Not this time. Keep saving!"

function RewardRow({
  reward,
  savingsStars,
  onRequest,
}: {
  reward: KidReward;
  savingsStars: number;
  onRequest: (id: string) => void;
}) {
  const [confirming, setConfirming] = useState(false);
  const affordable = savingsStars >= reward.stickerCost;

  const priceTag = (
    <span className="flex shrink-0 items-center gap-1 font-heading text-sm text-black">
      <span className="grid h-6 w-6 place-items-center rounded-full border-2 border-black bg-yellow-300">
        <Star size={12} strokeWidth={3} aria-hidden="true" />
      </span>
      {reward.stickerCost}
    </span>
  );

  // Pick the row background per state.
  const tone =
    reward.requestStatus === 'pending'
      ? 'border-purple-400 bg-purple-50'
      : reward.requestStatus === 'approved'
        ? 'border-green-500 bg-green-50'
        : reward.requestStatus === 'declined'
          ? 'border-black bg-gray-50'
          : 'border-black bg-white';

  return (
    <div data-testid={`kid-reward-${reward.id}`} className={`rounded-xl border-2 p-4 ${tone}`}>
      <div className="flex items-start justify-between gap-3">
        <h3 className="flex items-center gap-2 font-heading text-base text-black">
          <span aria-hidden="true">{reward.icon ?? '🎁'}</span>
          {reward.name}
        </h3>
        {priceTag}
      </div>

      <div className="mt-3">
        {reward.requestStatus === 'pending' ? (
          <p
            data-testid={`reward-pending-${reward.id}`}
            role="status"
            className="animate-pulse text-sm font-bold text-purple-700"
          >
            ⏳ Requested! Waiting for a grown-up
          </p>
        ) : reward.requestStatus === 'approved' ? (
          <p
            data-testid={`reward-approved-${reward.id}`}
            role="status"
            className="text-sm font-bold text-green-700"
          >
            🎉 Yay! Approved!
          </p>
        ) : reward.requestStatus === 'declined' ? (
          <p
            data-testid={`reward-declined-${reward.id}`}
            role="status"
            className="text-sm font-bold text-gray-600"
          >
            Not this time. Keep saving!
          </p>
        ) : affordable ? (
          confirming ? (
            <div className="rounded-lg border-2 border-black bg-white p-3">
              <p className="text-sm font-bold text-black">Ask a grown-up for {reward.name}?</p>
              <div className="mt-3 flex gap-2">
                <button
                  type="button"
                  data-testid={`reward-cancel-${reward.id}`}
                  onClick={() => setConfirming(false)}
                  className="flex-1 rounded-lg border-2 border-black bg-gray-100 px-3 py-2 font-heading text-sm uppercase text-gray-700 transition-transform motion-safe:hover:-translate-y-0.5"
                >
                  Not yet
                </button>
                <button
                  type="button"
                  data-testid={`reward-confirm-${reward.id}`}
                  onClick={() => {
                    onRequest(reward.id);
                    setConfirming(false);
                  }}
                  className="flex-1 rounded-lg border-2 border-black bg-green-400 px-3 py-2 font-heading text-sm uppercase text-black shadow-neo-xs transition-transform motion-safe:hover:-translate-y-0.5"
                >
                  Yes, ask!
                </button>
              </div>
            </div>
          ) : (
            <button
              type="button"
              data-testid={`reward-ask-${reward.id}`}
              onClick={() => setConfirming(true)}
              className="w-full rounded-lg border-2 border-black bg-pink-400 px-4 py-2.5 font-heading text-sm uppercase text-black shadow-neo-xs transition-transform motion-safe:hover:-translate-y-0.5"
            >
              Ask for this 🎁
            </button>
          )
        ) : (
          <div data-testid={`reward-keepsaving-${reward.id}`}>
            <button
              type="button"
              disabled
              className="w-full cursor-not-allowed rounded-lg border-2 border-gray-300 bg-gray-100 px-4 py-2.5 font-heading text-sm uppercase text-gray-400"
            >
              Keep saving
            </button>
            <p className="mt-2 text-xs font-bold text-gray-600">
              {reward.stickerCost - savingsStars} more stars to go!
            </p>
            <div className="mt-1 h-2 w-full overflow-hidden rounded-full border-2 border-black bg-white">
              <div
                className="h-full bg-yellow-300"
                style={{
                  width: `${Math.min(100, (savingsStars / reward.stickerCost) * 100)}%`,
                }}
              />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export function KidRewardShop({
  rewards,
  savingsStars,
  onRequest,
}: {
  rewards: KidReward[];
  savingsStars: number;
  onRequest: (id: string) => void;
}) {
  return (
    <section
      data-testid="kid-reward-goals"
      className="rounded-xl border-2 border-black bg-white p-5 shadow-neo-sm"
    >
      <div className="flex items-center justify-between gap-3">
        <h2 className="flex items-center gap-3 font-heading text-lg uppercase tracking-wide text-black">
          <span className="grid h-10 w-10 place-items-center rounded-full border-2 border-black bg-pink-200 shadow-neo-xs">
            <ShoppingBag size={20} aria-hidden="true" />
          </span>
          Reward Goals
        </h2>
        <span className="flex items-center gap-1 rounded-full border-2 border-black bg-black px-3 py-1 text-xs font-bold text-white">
          {savingsStars} Stars
        </span>
      </div>

      <div className="mt-4 flex flex-col gap-3">
        {rewards.length === 0 ? (
          <p className="rounded-xl border-2 border-dashed border-gray-300 bg-gray-50 p-4 text-center text-sm font-bold text-gray-500">
            No reward goals yet. Ask a grown-up to add some! 🎯
          </p>
        ) : (
          rewards.map((r) => (
            <RewardRow key={r.id} reward={r} savingsStars={savingsStars} onRequest={onRequest} />
          ))
        )}

        {/* Decorative locked mystery box: purely cosmetic, no action. */}
        <div className="flex items-center justify-between gap-3 rounded-xl border-2 border-black bg-purple-50 p-4 opacity-80">
          <div>
            <h3 className="font-heading text-base text-black">🔒 Mystery Box ✨</h3>
            <p className="mt-1 text-xs font-bold text-gray-600">Keep saving to unlock!</p>
          </div>
          <span className="flex shrink-0 items-center gap-1 font-heading text-sm text-black">
            <span className="grid h-6 w-6 place-items-center rounded-full border-2 border-black bg-yellow-300">
              <Star size={12} strokeWidth={3} aria-hidden="true" />
            </span>
            50
          </span>
        </div>
      </div>
    </section>
  );
}
