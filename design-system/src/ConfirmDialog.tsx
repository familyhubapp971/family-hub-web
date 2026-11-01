import React, { useId } from 'react';
import { Dialog } from './Dialog';
import { Button } from './Button';

interface ConfirmDialogProps {
  isOpen: boolean;
  title: string;
  /** Optional body text under the title. */
  message?: React.ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  /** `danger` paints the confirm button red: use for destructive actions. */
  variant?: 'danger' | 'primary';
  /** Disables the buttons + shows the busy label while an async action runs. */
  busy?: boolean;
  /** Extra disable condition for the confirm button only (e.g. a "type the
   *  name to confirm" gate on a destructive action). Cancel stays enabled. */
  confirmDisabled?: boolean;
  /** Extra content rendered below the message, e.g. a confirmation input. */
  children?: React.ReactNode;
  onConfirm: () => void;
  onCancel: () => void;
  testId?: string;
}

// App-styled replacement for window.confirm. Built on the accessible Dialog
// shell (role=dialog, aria-modal, Escape + backdrop to cancel) with the
// neo-brutalist card look the rest of the app uses.
export function ConfirmDialog({
  isOpen,
  title,
  message,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  variant = 'primary',
  busy = false,
  confirmDisabled = false,
  children,
  onConfirm,
  onCancel,
  testId = 'confirm-dialog',
}: ConfirmDialogProps) {
  const titleId = useId();
  return (
    <Dialog
      isOpen={isOpen}
      onClose={busy ? () => {} : onCancel}
      ariaLabelledBy={titleId}
      testId={testId}
      closeOnBackdrop={!busy}
    >
      <div className="relative w-full max-w-md">
        <div className="absolute inset-0 translate-x-1.5 translate-y-1.5 rounded-2xl bg-black" />
        <div className="relative rounded-2xl border-2 border-black bg-white p-5 shadow-neo sm:border-3 sm:p-6">
          <h2 id={titleId} className="text-lg font-black text-gray-900 sm:text-xl">
            {title}
          </h2>
          {message !== undefined && message !== null && (
            <p className="mt-2 text-sm font-medium text-gray-600" data-testid={`${testId}-message`}>
              {message}
            </p>
          )}
          {children}
          <div className="mt-6 flex justify-end gap-3">
            <Button
              variant="secondary"
              onClick={onCancel}
              disabled={busy}
              testId={`${testId}-cancel`}
            >
              {cancelLabel}
            </Button>
            <Button
              variant={variant === 'danger' ? 'danger' : 'primary'}
              onClick={onConfirm}
              disabled={busy || confirmDisabled}
              testId={`${testId}-confirm`}
            >
              {busy ? 'Working…' : confirmLabel}
            </Button>
          </div>
        </div>
      </div>
    </Dialog>
  );
}
