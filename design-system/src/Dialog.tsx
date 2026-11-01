import React, { useEffect, useRef } from 'react';
import { useBodyScrollLock } from './useBodyScrollLock';

interface DialogProps {
  isOpen: boolean;
  onClose: () => void;
  children: React.ReactNode;
  closeOnBackdrop?: boolean;
  testId?: string;
  /** Accessible label or labelled-by id, required by WCAG 2.4.6. */
  ariaLabel?: string;
  ariaLabelledBy?: string;
  /**
   * 'center' (default): the classic centred card, unchanged.
   * 'bottom-sheet' (FHS-623): pinned to the bottom edge with no side gap on
   * a phone, becoming a centred panel from the `sm:` breakpoint up. The
   * child content still owns its own rounded corners / max-width.
   *
   * Either way the content box is a flex column no taller than the screen.
   * A child with `min-h-0` shrinks to fit it, so a long form can put its
   * header in a `shrink-0` row and scroll only its body (FHS-678).
   */
  align?: 'center' | 'bottom-sheet';
}

// Accessible dialog shell: role=dialog + aria-modal, Escape-to-close,
// scroll-lock (useBodyScrollLock), and a focus trap (FHS-623): opening
// moves focus into the dialog, Tab/Shift+Tab cycle within it instead of
// escaping to the page behind, and closing returns focus to whatever
// element opened it (the triggering button, in practice).
const FOCUSABLE_SELECTOR =
  'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])';

export function Dialog({
  isOpen,
  onClose,
  children,
  closeOnBackdrop = true,
  testId,
  ariaLabel,
  ariaLabelledBy,
  align = 'center',
}: DialogProps) {
  useBodyScrollLock(isOpen);
  const contentRef = useRef<HTMLDivElement>(null);
  const previouslyFocused = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (!isOpen) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [isOpen, onClose]);

  useEffect(() => {
    if (!isOpen) return;
    previouslyFocused.current = document.activeElement as HTMLElement | null;
    const container = contentRef.current;
    const focusables = () =>
      container ? Array.from(container.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR)) : [];
    (focusables()[0] ?? container)?.focus();

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key !== 'Tab' || !container) return;
      const items = focusables();
      if (items.length === 0) {
        e.preventDefault();
        return;
      }
      const firstEl = items[0]!;
      const lastEl = items[items.length - 1]!;
      if (e.shiftKey && document.activeElement === firstEl) {
        e.preventDefault();
        lastEl.focus();
      } else if (!e.shiftKey && document.activeElement === lastEl) {
        e.preventDefault();
        firstEl.focus();
      }
    };
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('keydown', onKeyDown);
      previouslyFocused.current?.focus?.();
    };
  }, [isOpen]);

  if (!isOpen) return null;

  // Backdrop click-to-close is one route; Escape (wired in the useEffect
  // above) is the keyboard equivalent. Escape lives at document level so
  // it works regardless of focus location, which the jsx-a11y rules can't
  // see, disable the two click-handler-without-key-handler rules
  // explicitly with that justification. role=dialog + aria-modal already
  // mark this region for assistive tech.
  /* eslint-disable jsx-a11y/click-events-have-key-events, jsx-a11y/no-noninteractive-element-interactions, jsx-a11y/no-static-element-interactions */
  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={ariaLabelledBy ? undefined : ariaLabel}
      aria-labelledby={ariaLabelledBy}
      // Tailwind utilities for backdrop so strict CSP (no 'unsafe-inline'
      // style-src) still works (FHS-170 will add CSP).
      // FHS-678: the overlay is exactly the visible screen, so the content box
      // is capped at its height (max-h-full). A tall dialog can then never be
      // centred past the top edge, and the overlay itself scrolls as a backstop.
      className={
        align === 'bottom-sheet'
          ? 'fixed inset-0 z-50 flex items-end justify-center overflow-y-auto overscroll-contain bg-black/80 backdrop-blur-sm sm:items-center sm:p-4'
          : 'fixed inset-0 z-50 flex items-center justify-center overflow-y-auto overscroll-contain p-4 bg-black/80 backdrop-blur-sm'
      }
      onClick={closeOnBackdrop ? onClose : undefined}
      data-testid={testId}
    >
      <div
        ref={contentRef}
        tabIndex={-1}
        onClick={(e) => e.stopPropagation()}
        data-testid={testId ? `${testId}-content` : undefined}
        className={
          align === 'bottom-sheet'
            ? 'flex max-h-full w-full flex-col outline-none sm:w-auto'
            : 'flex max-h-full min-w-0 max-w-full flex-col outline-none'
        }
      >
        {children}
      </div>
    </div>
  );
  /* eslint-enable jsx-a11y/click-events-have-key-events, jsx-a11y/no-noninteractive-element-interactions, jsx-a11y/no-static-element-interactions */
}
