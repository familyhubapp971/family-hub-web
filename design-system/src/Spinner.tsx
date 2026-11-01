import { Loader2 } from 'lucide-react';

// FHS-550: the one inline spinner.
//
// The full-screen waits (magic-link callback, protected routes, the dashboard
// redirect, the kid load) use the web site's LoadingScreen. This is for the small
// waits that live *inside* a panel, a dialog or a button, where taking over
// the whole viewport would be wrong. Four screens each rolled their own
// `animate-spin` with a different size and colour before this existed.
//
// Motion is gated behind motion-safe: under prefers-reduced-motion the icon
// holds still, which still reads as "busy" next to its label.

type SpinnerSize = 'sm' | 'md' | 'lg';

const SIZES: Record<SpinnerSize, { box: string; px: number }> = {
  sm: { box: 'h-5 w-5', px: 20 },
  md: { box: 'h-6 w-6', px: 24 },
  lg: { box: 'h-10 w-10', px: 40 },
};

export function Spinner({
  size = 'md',
  className = '',
  label,
  testId,
}: {
  size?: SpinnerSize;
  /** Tailwind text-* colour class; defaults to inheriting the parent. */
  className?: string;
  /**
   * Announced to screen readers. Omit only when a visible label sits next to
   * the spinner and already says what is happening.
   */
  label?: string;
  testId?: string;
}) {
  const { box, px } = SIZES[size];
  return (
    <Loader2
      className={`${box} motion-safe:animate-spin ${className}`}
      size={px}
      role={label ? 'status' : undefined}
      aria-label={label}
      aria-hidden={label ? undefined : true}
      data-testid={testId}
    />
  );
}
