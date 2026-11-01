/**
 * CloseWeekChooser: FHS-637
 *
 * The step the design puts in front of the five money actions when a parent
 * closes the week: what is on the table, one row per choice, then the button
 * that finishes the week.
 *
 * FHS-623 built the five flows but left this chooser out ("Closing a week
 * already exists"), so the My World board kept opening the old dialog and the
 * one screen between two redesigned ones stayed on the old look.
 *
 * Ported from `components/MoneyActions.tsx` in the Magic Patterns editor
 * (kudjspxd3xxroueg5jw11o). Deliberate deviations from that file:
 *   - money comes from the family's own currency via the shared formatter
 *     (FHS-614), not the mock's fixed helper;
 *   - the withdraw row hides when nothing is invested, which the design does
 *     too, but here it reads the live snapshot;
 *   - the old dialog's "Admin Mode Active" banner and its running "actions
 *     taken this session" list are gone. Founder decision, 2026-08-09: follow
 *     the design exactly. The banner unlocked nothing, and the design ends
 *     each action on its own "all done" screen instead of a running log.
 */
import { Gift, PiggyBank, TrendingDown, TrendingUp, Wallet } from 'lucide-react';
import { formatMoney } from '@familyhub/shared';
import type { ChildMoneySnapshot, MoneyAction } from './KidsMoneyPage';

export interface CloseWeekChooserProps {
  child: { id: string; name: string };
  snapshot: ChildMoneySnapshot;
  /** Disabled while the finalize request is in flight. */
  busy: boolean;
  error: string | null;
  onPick: (action: MoneyAction) => void;
  onCloseWeek: () => void;
  /** FHS-642: the week was already closed in this sitting, and the list is
   *  now describing the new one. The five choices still apply to it; closing
   *  it as well, one tap after closing the last one, does not. */
  weekClosed?: boolean;
}

const ROWS: Array<{
  id: MoneyAction;
  label: string;
  note: string;
  tone: string;
  icon: React.ReactNode;
}> = [
  {
    id: 'claim',
    label: 'Claim a reward',
    note: 'Swap stickers for something from the shop.',
    tone: 'bg-pink-300',
    icon: <Gift size={20} strokeWidth={3} aria-hidden="true" />,
  },
  {
    id: 'cash',
    label: 'Cash out',
    note: 'Hand over real money and take the stickers off.',
    tone: 'bg-lime-300',
    icon: <Wallet size={20} strokeWidth={3} aria-hidden="true" />,
  },
  {
    id: 'save',
    label: 'Move to savings',
    note: 'Keep stickers safe in savings for later.',
    tone: 'bg-cyan-300',
    icon: <PiggyBank size={20} strokeWidth={3} aria-hidden="true" />,
  },
  {
    id: 'invest',
    label: 'Invest and grow',
    note: 'Pick a habit and let its stickers grow.',
    tone: 'bg-yellow-300',
    icon: <TrendingUp size={20} strokeWidth={3} aria-hidden="true" />,
  },
  {
    id: 'withdraw',
    label: 'Take money out of an investment',
    note: 'Stop one early and put it back in savings.',
    tone: 'bg-orange-300',
    icon: <TrendingDown size={20} strokeWidth={3} aria-hidden="true" />,
  },
];

export function CloseWeekChooser({
  child,
  snapshot,
  busy,
  error,
  onPick,
  onCloseWeek,
  weekClosed = false,
}: CloseWeekChooserProps) {
  const worth = formatMoney(snapshot.available * snapshot.stickerRate, snapshot.currency);
  // Nothing invested means nothing to take out, so the row would lead to an
  // empty screen. The design hides it for the same reason.
  const rows = ROWS.filter((row) => row.id !== 'withdraw' || snapshot.invested > 0);

  return (
    <div data-testid="close-week-chooser">
      <p className="font-bold text-gray-600">
        {child.name} has {snapshot.available} stickers ready to spend, worth {worth}. Decide what
        happens to them, then finish the week.
      </p>

      <ul className="mt-4 flex flex-col gap-2">
        {rows.map((row) => (
          <li key={row.id}>
            <button
              type="button"
              onClick={() => onPick(row.id)}
              data-testid={`close-week-chooser-${row.id}`}
              className={`flex min-h-[64px] w-full items-center gap-3 rounded-xl border-2 border-black ${row.tone} p-3 text-left shadow-neo-xs transition-transform motion-safe:hover:-translate-y-0.5`}
            >
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border-2 border-black bg-white">
                {row.icon}
              </span>
              <span className="min-w-0">
                <span className="block font-heading text-base leading-tight">{row.label}</span>
                <span className="text-xs font-bold text-black/70">{row.note}</span>
              </span>
              <span aria-hidden="true" className="ml-auto shrink-0 font-heading">
                →
              </span>
            </button>
          </li>
        ))}
      </ul>

      <div className="mt-5 border-t-2 border-gray-100 pt-5">
        {error && (
          <p
            role="alert"
            data-testid="close-week-chooser-error"
            className="mb-3 rounded-xl border-2 border-black bg-red-100 p-3 text-sm font-bold text-red-900"
          >
            {error}
          </p>
        )}
        {weekClosed ? (
          <p data-testid="close-week-chooser-closed" className="text-sm font-bold text-gray-600">
            The week is closed. Anything you do now counts towards the new one.
          </p>
        ) : (
          <>
            <button
              type="button"
              onClick={onCloseWeek}
              disabled={busy}
              data-testid="close-week-chooser-finish"
              className="min-h-[52px] w-full rounded-xl border-2 border-black bg-lime-400 font-heading text-lg shadow-neo-sm transition-transform disabled:opacity-50 motion-safe:enabled:hover:-translate-y-0.5"
            >
              {busy ? 'Closing the week…' : 'Close the week and start the new one'}
            </button>
            <p className="mt-2 text-sm font-bold text-gray-600">
              Anything still here is carried over. You can look back at this week any time.
            </p>
          </>
        )}
      </div>
    </div>
  );
}
