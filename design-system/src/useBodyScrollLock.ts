import { useEffect } from 'react';

// Module-level ref-count so multiple simultaneous modals don't unlock early.
// The original overflow value is captured once when the count goes 0 → 1 and
// restored only when the count returns to 0.
let lockCount = 0;
let originalBodyOverflow = '';
let originalHtmlOverflow = '';

// Lock BOTH <html> and <body>: in this app the scrolling element is <html>
// (the document/viewport), so locking body alone left the page scrollable
// behind modals. Locking documentElement is what actually stops the scroll.
function lock(): void {
  if (typeof document === 'undefined') return;
  if (lockCount === 0) {
    originalBodyOverflow = document.body.style.overflow;
    originalHtmlOverflow = document.documentElement.style.overflow;
    document.body.style.overflow = 'hidden';
    document.documentElement.style.overflow = 'hidden';
  }
  lockCount += 1;
}

function unlock(): void {
  if (typeof document === 'undefined') return;
  if (lockCount <= 0) return;
  lockCount -= 1;
  if (lockCount === 0) {
    document.body.style.overflow = originalBodyOverflow;
    document.documentElement.style.overflow = originalHtmlOverflow;
  }
}

/**
 * Prevents the page from scrolling behind a modal or lightbox.
 *
 * Usage:
 *   useBodyScrollLock(isOpen);
 *
 * - When `active` is true, `document.body.style.overflow` is set to 'hidden'.
 * - The previous value is restored when `active` becomes false or the component unmounts.
 * - A module-level ref-count ensures multiple simultaneous locks don't release
 *   each other early: the overflow is only restored once every active lock is gone.
 * - SSR-safe: guards `typeof document !== 'undefined'`.
 * - The hook is always called unconditionally (hooks rules); `active` is the gate.
 */
export function useBodyScrollLock(active: boolean): void {
  useEffect(() => {
    if (!active) return;
    lock();
    return () => {
      unlock();
    };
  }, [active]);
}
