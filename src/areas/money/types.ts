import type { ChildMoneySnapshot } from './KidsMoneyPage';
import type { MoneyHeaders } from './moneyActionsApi';

/** Common props every one of the five action flows takes. */
export interface MoneyFlowProps {
  child: { id: string; name: string };
  snapshot: ChildMoneySnapshot;
  weekId: string | null;
  headers: MoneyHeaders;
  /** Call once the mutation has actually saved, with a plain-words summary
   *  of what happened. The sheet shows this on its "done" screen. */
  onSuccess: (message: string) => void;
  /** Back out without saving (Cancel, or the sheet's own close). */
  onCancel: () => void;
}

/** A friendly, plain-words explanation for a failed save. Never technical. */
export function friendlyFailureMessage(reason: string | undefined): string {
  return reason
    ? `That didn't save: ${reason}. Nothing changed, try again.`
    : "That didn't save. Nothing changed, try again.";
}
