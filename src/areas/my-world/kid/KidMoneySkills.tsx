import { Wallet } from 'lucide-react';
import { formatMoney } from '@familyhub/shared';

// FHS-376: "Money Skills" explainer card for the kid. Pure presentation: tells
// the kid what their stars are worth and the three things they can do with them
// (spend / save / grow). The savings + invested numbers come from the parent.
// FHS-399: accepts `isFinalized` to switch to past-tense framing on closed weeks.
// FHS-480: accepts `stickerRate` so the "worth" line states the real figure
// instead of the vague "a little bit of real money".
export function KidMoneySkills({
  stickerBalance,
  savedStickers,
  savedCash,
  currency,
  stickerRate = 0.5,
  planted,
  bonus,
  hasInvestments,
  isFinalized = false,
}: {
  stickerBalance: number;
  savedStickers: number;
  savedCash: number;
  currency: string;
  stickerRate?: number;
  planted: number;
  bonus: number;
  hasInvestments: boolean;
  isFinalized?: boolean;
}) {
  return (
    <section
      data-testid="kid-moneyskills"
      className="rounded-xl border-2 border-black bg-white p-6 shadow-neo-sm"
    >
      <h2 className="flex items-center gap-3 font-heading text-xl uppercase tracking-wide text-black">
        <span className="grid h-10 w-10 place-items-center rounded-full border-2 border-black bg-green-200 shadow-neo-xs">
          <Wallet size={20} aria-hidden="true" />
        </span>
        Money Skills <span aria-hidden="true">🧠</span>
      </h2>

      <p className="mt-3 text-sm font-bold text-gray-700">
        You have{' '}
        <span className="font-heading text-lg text-yellow-500">{stickerBalance} stars</span>! Every
        star is worth{' '}
        <span className="font-heading text-yellow-600">{formatMoney(stickerRate, currency)}</span>{' '}
        of real money.{' '}
        {isFinalized
          ? 'Here’s what you did with your stars this week.'
          : 'What will you do with them?'}
      </p>

      {/* Savings now + growing stars */}
      <div className="mt-5 grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="rounded-xl border-2 border-black bg-green-50 p-4">
          <h3 className="font-heading text-lg uppercase tracking-wide text-black">
            My Savings Now
          </h3>
          <dl className="mt-2 space-y-2 font-bold text-gray-700">
            <div className="flex items-center justify-between">
              <dt className="text-sm">Saved Stars</dt>
              <dd className="font-heading text-3xl text-yellow-600">{savedStickers} ⭐</dd>
            </div>
            <div className="flex items-center justify-between border-t-2 border-green-200 pt-2">
              <dt className="text-sm">Worth</dt>
              <dd className="font-heading text-2xl text-green-700">
                {formatMoney(savedCash, currency)}
              </dd>
            </div>
          </dl>
        </div>

        <div className="rounded-xl border-2 border-black bg-purple-50 p-4">
          <h3 className="font-heading text-lg uppercase tracking-wide text-black">
            My Growing Stars <span aria-hidden="true">🌱</span>
          </h3>
          {hasInvestments ? (
            <dl className="mt-2 space-y-2 font-bold text-gray-700">
              <div className="flex items-center justify-between">
                <dt className="text-sm">Planted</dt>
                <dd className="font-heading text-2xl text-purple-700">{planted} ⭐</dd>
              </div>
              <div className="flex items-center justify-between border-t-2 border-purple-100 pt-2">
                <dt className="text-xs">✨ Bonus stars it made for you</dt>
                <dd className="font-heading text-lg text-green-600">+{bonus}</dd>
              </div>
            </dl>
          ) : (
            <p className="mt-2 text-sm font-bold text-gray-600">
              Plant some stars and watch them grow into more! 🌱
            </p>
          )}
        </div>
      </div>

      {/* Three things you can do */}
      <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-3">
        <div className="rounded-xl border-2 border-black bg-pink-50 p-4">
          <p className="text-2xl" aria-hidden="true">
            🛍️
          </p>
          <h4 className="mt-2 font-heading text-sm uppercase tracking-wide text-black">
            {isFinalized ? 'Spent' : 'Spend Now'}
          </h4>
          <p className="mt-1 text-xs font-bold text-gray-600">
            {isFinalized
              ? 'Stars used for treats in the Rewards Shop.'
              : 'Use your stars for small treats in the Rewards Shop today!'}
          </p>
        </div>
        <div className="rounded-xl border-2 border-black bg-blue-50 p-4">
          <p className="text-2xl" aria-hidden="true">
            🐷
          </p>
          <h4 className="mt-2 font-heading text-sm uppercase tracking-wide text-black">
            {isFinalized ? 'Saved' : 'Save Up'}
          </h4>
          <p className="mt-1 text-xs font-bold text-gray-600">
            {isFinalized
              ? 'Stars kept safe in your piggy bank for bigger rewards.'
              : 'Keep your stars safe. The more you save, the bigger rewards you can get later!'}
          </p>
        </div>
        <div className="rounded-xl border-2 border-black bg-green-50 p-4">
          <p className="text-2xl" aria-hidden="true">
            🌱
          </p>
          <h4 className="mt-2 font-heading text-sm uppercase tracking-wide text-black">
            {isFinalized ? 'Grew (Invested)' : 'Grow (Invest)'}
          </h4>
          <p className="mt-1 text-xs font-bold text-gray-600">
            {isFinalized
              ? 'Stars planted like seeds 🌱 and growing into more!'
              : 'Save your stars like seeds 🌱. Wait and they grow into more!'}
          </p>
        </div>
      </div>
    </section>
  );
}
