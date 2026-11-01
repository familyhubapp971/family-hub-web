import { useCallback, useEffect, useState } from 'react';
import { Check, Copy } from 'lucide-react';

export interface CopyCodeProps {
  /** The code to show and copy, e.g. a family code like "e29b-41d4". */
  code: string;
  /** Names the code for screen readers, e.g. "Family code". */
  label: string;
  /** Button words before and after copying. */
  copyLabel?: string;
  copiedLabel?: string;
  testId?: string;
}

/**
 * A short code shown in big letters with a Copy button beside it (FHS-715,
 * the family code on the Members page). The code wraps under the button on
 * the narrowest phones rather than squeezing. If copying is blocked the code
 * is still on screen to read out or type.
 */
export function CopyCode({
  code,
  label,
  copyLabel = 'Copy',
  copiedLabel = 'Copied',
  testId,
}: CopyCodeProps) {
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!copied) return;
    const timer = window.setTimeout(() => setCopied(false), 2000);
    return () => window.clearTimeout(timer);
  }, [copied]);

  const onCopy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
    } catch {
      // Copying is blocked or not available: the code stays readable.
    }
  }, [code]);

  return (
    <div className="flex flex-wrap items-center gap-3" data-testid={testId}>
      <span
        aria-label={`${label}: ${code}`}
        className="select-all rounded-xl border-2 border-black bg-purple-100 px-4 py-2 font-heading text-3xl tracking-[0.12em] text-black sm:text-4xl"
        data-testid={testId ? `${testId}-code` : undefined}
      >
        {code}
      </span>
      <button
        type="button"
        onClick={() => void onCopy()}
        data-testid={testId ? `${testId}-copy` : undefined}
        className="flex min-h-[48px] items-center justify-center gap-2 rounded-xl border-2 border-black bg-yellow-300 px-4 text-sm font-bold text-black shadow-neo-xs transition-transform focus:outline-none focus-visible:ring-4 focus-visible:ring-pink-400 motion-safe:hover:-translate-y-0.5"
      >
        {copied ? (
          <Check size={16} strokeWidth={3} aria-hidden="true" />
        ) : (
          <Copy size={16} strokeWidth={3} aria-hidden="true" />
        )}
        {copied ? copiedLabel : copyLabel}
      </button>
      <span role="status" className="sr-only">
        {copied ? copiedLabel : ''}
      </span>
    </div>
  );
}
