/**
 * MoneyActionsSheet: FHS-623
 *
 * Wires the FHS-622 seam (KidsMoneyPage's `onMoneyAction`) to the real
 * endpoints. A bottom sheet on a phone, a centred panel from tablet up
 * (Dialog's `align="bottom-sheet"`), one flow per action, each ending in a
 * "done" screen the family can read before it closes. Nothing here is
 * discarded on close: every confirm is a real POST, and a failure leaves
 * the sheet open with a plain-words error, never a silent no-op.
 *
 * FHS-637: it also opens on the design's "close the week" chooser, from the
 * My World board's Close Week button. FHS-623 left that step out on the
 * grounds that closing a week already existed, which left one old-looking
 * screen between two redesigned ones; the old dialog it deferred to is gone.
 */
import { useEffect, useId, useRef, useState } from 'react';
import { ArrowLeft, Check, X } from 'lucide-react';
import { Button, Dialog } from '@familyhub/ui';
import type { ChildMoneySnapshot, MoneyAction } from './KidsMoneyPage';
import type { MoneyHeaders } from './moneyActionsApi';
import { ClaimRewardFlow } from './ClaimRewardFlow';
import { CashOutFlow } from './CashOutFlow';
import { SaveFlow } from './SaveFlow';
import { InvestFlow } from './InvestFlow';
import { WithdrawFlow } from './WithdrawFlow';
import { CloseWeekChooser } from './CloseWeekChooser';
import { MoneyActionError, finalizeWeek } from './moneyActionsApi';
import { friendlyFailureMessage } from './types';

/** FHS-637: the sheet also opens on the close-week chooser, which the five
 *  Kids money buttons never emit: only the My World board's Close Week does. */
export type MoneySheetAction = MoneyAction | 'chooser';

export interface MoneyActionsSheetProps {
  isOpen: boolean;
  action: MoneySheetAction | null;
  child: { id: string; name: string } | null;
  snapshot: ChildMoneySnapshot | null;
  weekId: string | null;
  headers: MoneyHeaders;
  onClose: () => void;
  /** Fired the instant a mutation saves, so the page can refresh its
   *  figures while the sheet is still showing the "done" screen. */
  onSaved: () => void;
  /** FHS-637: the member whose week is being closed, and what to do once it
   *  is. Only needed when the sheet can open on the chooser. */
  memberId?: string;
  onWeekFinalized?: (nextWeekId: string) => void;
  /** FHS-642: the design's "See their money" button on the done screen. Left
   *  off where the money page is already the screen underneath. */
  onSeeMoney?: (() => void) | undefined;
}

// FHS-631: no icon here any more. The design's sheet header carries the title
// and the child's sticker count, and no icon tile.
const ACTION_META: Record<MoneySheetAction, { title: string; tone: string }> = {
  // The chooser wears the kingdom purple header from the design, so closing
  // the week reads as the bigger moment that contains the other five.
  //
  // FHS-640: the round back/close buttons set their own `text-black`. A lucide
  // icon paints with currentColor, so with `text-white` here they inherited
  // white and disappeared into their own white disc.
  //
  // FHS-639: `bg-kingdom` was the design's own token name and does not exist
  // here, where kingdom is a SCALE. Tailwind produced no background, the white
  // text stayed white, and the title and the close button vanished into the
  // white card. kingdom-900 is #3d1065, the exact purple the design uses.
  chooser: { title: 'Close the week', tone: 'bg-kingdom-900 text-white' },
  claim: { title: 'Claim a reward', tone: 'bg-pink-300' },
  cash: { title: 'Cash out', tone: 'bg-lime-300' },
  save: {
    title: 'Move to savings',
    tone: 'bg-cyan-300',
  },
  invest: {
    title: 'Invest and grow',
    tone: 'bg-yellow-300',
  },
  withdraw: {
    title: 'Take money out of an investment',
    tone: 'bg-orange-300',
  },
};

export function MoneyActionsSheet({
  isOpen,
  action,
  child,
  snapshot,
  weekId,
  headers,
  onClose,
  onSaved,
  memberId,
  onWeekFinalized,
  onSeeMoney,
}: MoneyActionsSheetProps) {
  const titleId = useId();
  const [phase, setPhase] = useState<'form' | 'done'>('form');
  const [doneMessage, setDoneMessage] = useState('');
  // Which step is on screen. Starts at whatever opened the sheet; picking a row
  // in the chooser walks forward, and the back arrow walks home.
  const [step, setStep] = useState<MoneySheetAction | null>(action);
  const [closing, setClosing] = useState(false);
  // A ref, not the state above: two clicks in one tick both read the same
  // stale `closing` and both fire, which is exactly what a double tap is.
  const closingRef = useRef(false);
  const [closeError, setCloseError] = useState<string | null>(null);
  // FHS-642: the week was closed in this sitting. The sheet stays open
  // afterwards, so it has to remember, or "Do something else" walks back to a
  // chooser offering to close the brand new week one tap later.
  const [weekClosed, setWeekClosed] = useState(false);
  const donePanel = useRef<HTMLDivElement>(null);

  const ready = isOpen && action !== null && child !== null && snapshot !== null;

  // A fresh action (even re-opening the same one) always starts on the form.
  useEffect(() => {
    if (!ready) return;
    setPhase('form');
    setDoneMessage('');
    setStep(action);
    setClosing(false);
    setCloseError(null);
    setWeekClosed(false);
  }, [ready, action, child?.id]);

  // FHS-642: the button that was under the finger unmounts when the result
  // appears, which drops focus onto <body> and lets Tab escape the dialog.
  // Dialog only manages focus when it opens, and the sheet never closes here.
  useEffect(() => {
    if (phase === 'done') donePanel.current?.focus();
  }, [phase]);

  if (!ready || step === null) return null;

  const meta = ACTION_META[step];
  // Only a journey that began at the chooser can go back to it, and only
  // while a form is on screen: on the "all done" screen the way back is the
  // "Do something else" button, which also clears the finished message.
  const inFlowFromChooser = action === 'chooser' && step !== 'chooser';
  const cameFromChooser = inFlowFromChooser && phase === 'form';

  const handleCloseWeek = async () => {
    if (!memberId || !weekId || closingRef.current) return;
    closingRef.current = true;
    setClosing(true);
    setCloseError(null);
    try {
      const result = await finalizeWeek(weekId, memberId, headers);
      onSaved();
      setDoneMessage(`The week is closed and a new one has started for ${child.name}.`);
      setWeekClosed(true);
      setPhase('done');
      if (result.nextWeekId) onWeekFinalized?.(result.nextWeekId);
    } catch (err) {
      setCloseError(
        friendlyFailureMessage(err instanceof MoneyActionError ? err.detail : undefined),
      );
    } finally {
      closingRef.current = false;
      setClosing(false);
    }
  };

  const handleSuccess = (message: string) => {
    setDoneMessage(message);
    setPhase('done');
    onSaved();
  };

  return (
    <Dialog
      isOpen
      onClose={onClose}
      align="bottom-sheet"
      ariaLabelledBy={titleId}
      testId="money-actions-sheet"
    >
      {/* FHS-641: a DEFINITE width from `sm` up, not just a maximum.
          Dialog's bottom-sheet wrapper is `sm:w-auto`, so a `w-full max-w-*`
          child sits in a shrink-to-fit parent and ends up as wide as its own
          content: claim rendered at 478px, cash out wider, and the two never
          matched. This pins every action to the same 672px, which is also the
          founder's call (2026-08-10) that the design's 512px reads slim. A
          deliberate departure, recorded in documents/features/kids-money.md.
          Below `sm` the sheet stays full-bleed, as it was. */}
      <div className="relative w-full sm:w-[42rem] sm:max-w-[calc(100vw-2rem)]">
        <div className="absolute inset-0 translate-x-1.5 translate-y-1.5 rounded-t-3xl bg-black sm:rounded-3xl" />
        <div className="relative max-h-[85vh] overflow-y-auto supports-[height:100dvh]:max-h-[85dvh] rounded-t-3xl border-2 border-black bg-white shadow-neo sm:rounded-3xl sm:border-3">
          <div
            data-testid="money-actions-sheet-header"
            className={`flex items-start gap-3 border-b-2 border-black p-5 sm:border-b-3 ${meta.tone}`}
          >
            {cameFromChooser && (
              <button
                type="button"
                onClick={() => {
                  setStep('chooser');
                  setCloseError(null);
                }}
                aria-label="Back to the list"
                data-testid="money-actions-sheet-back"
                className="flex min-h-[44px] min-w-[44px] shrink-0 items-center justify-center rounded-full border-2 border-black bg-white text-black transition-transform motion-safe:hover:-translate-y-0.5"
              >
                <ArrowLeft size={18} strokeWidth={3} aria-hidden="true" />
              </button>
            )}
            <div className="min-w-0 flex-1">
              <h2 id={titleId} className="font-heading text-xl uppercase tracking-wide">
                {meta.title}
              </h2>
              <p
                className={`text-sm font-bold ${
                  step === 'chooser' ? 'text-purple-200' : 'text-black/70'
                }`}
              >
                {child.name} &middot; {snapshot.available} stickers ready to spend
              </p>
            </div>
            <button
              type="button"
              onClick={onClose}
              aria-label="Close"
              data-testid="money-actions-sheet-close"
              className="flex min-h-[44px] min-w-[44px] shrink-0 items-center justify-center rounded-full border-2 border-black bg-white text-black transition-transform motion-safe:hover:-translate-y-0.5"
            >
              <X size={18} strokeWidth={3} aria-hidden="true" />
            </button>
          </div>

          <div className="p-5">
            {phase === 'done' ? (
              // FHS-642: the live region wraps the heading AND the sentence, so
              // what is announced is the whole result and not the words "All
              // done" on their own. tabIndex={-1} is only there to receive
              // focus from the effect above; it is not a tab stop.
              <div
                ref={donePanel}
                role="status"
                tabIndex={-1}
                data-testid="money-actions-done-panel"
                className="space-y-4 text-center focus:outline-none"
              >
                <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-full border-2 border-black bg-lime-300">
                  <Check size={28} strokeWidth={3} aria-hidden="true" />
                </span>
                <h3 className="font-heading text-xl">All done</h3>
                <p className="font-bold text-gray-600" data-testid="money-actions-done-message">
                  {doneMessage}
                </p>
                {/* FHS-642: offered after closing the week too, not only after
                    one of the five actions. The design's Done screen keys off
                    the journey that opened the sheet, not the step it ended on. */}
                {action === 'chooser' && (
                  <Button
                    variant="secondary"
                    fullWidth
                    onClick={() => {
                      setPhase('form');
                      setDoneMessage('');
                      setStep('chooser');
                    }}
                    testId="money-actions-done-more"
                  >
                    Do something else
                  </Button>
                )}
                {onSeeMoney && (
                  <Button
                    variant="primary"
                    fullWidth
                    onClick={onSeeMoney}
                    testId="money-actions-done-see-money"
                  >
                    See their money
                  </Button>
                )}
                {/* The design gives the yellow to "See their money" and leaves
                    Done white. Without that button Done is the only way on, so
                    it keeps the yellow rather than leaving the screen with no
                    obvious action. */}
                <Button
                  variant={onSeeMoney ? 'secondary' : 'primary'}
                  fullWidth
                  onClick={onClose}
                  testId="money-actions-done-close"
                >
                  Done
                </Button>
              </div>
            ) : step === 'chooser' ? (
              <CloseWeekChooser
                child={child}
                snapshot={snapshot}
                busy={closing}
                error={closeError}
                onPick={setStep}
                onCloseWeek={() => void handleCloseWeek()}
                weekClosed={weekClosed}
              />
            ) : step === 'claim' ? (
              <ClaimRewardFlow
                child={child}
                snapshot={snapshot}
                weekId={weekId}
                headers={headers}
                onSuccess={handleSuccess}
                onCancel={inFlowFromChooser ? () => setStep('chooser') : onClose}
              />
            ) : step === 'cash' ? (
              <CashOutFlow
                child={child}
                snapshot={snapshot}
                weekId={weekId}
                headers={headers}
                onSuccess={handleSuccess}
                onCancel={inFlowFromChooser ? () => setStep('chooser') : onClose}
              />
            ) : step === 'save' ? (
              <SaveFlow
                child={child}
                snapshot={snapshot}
                weekId={weekId}
                headers={headers}
                onSuccess={handleSuccess}
                onCancel={inFlowFromChooser ? () => setStep('chooser') : onClose}
              />
            ) : step === 'invest' ? (
              <InvestFlow
                child={child}
                snapshot={snapshot}
                weekId={weekId}
                headers={headers}
                onSuccess={handleSuccess}
                onCancel={inFlowFromChooser ? () => setStep('chooser') : onClose}
              />
            ) : (
              <WithdrawFlow
                child={child}
                snapshot={snapshot}
                weekId={weekId}
                headers={headers}
                onSuccess={handleSuccess}
                onCancel={inFlowFromChooser ? () => setStep('chooser') : onClose}
              />
            )}
          </div>
        </div>
      </div>
    </Dialog>
  );
}
