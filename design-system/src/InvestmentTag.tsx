import { AlertTriangle, BarChart2, ShieldCheck } from 'lucide-react';

// FHS-607: the tag that marks a habit as invested and says which kind it is.
//
// Two pills: the kind, then the multiplier. Colour is never the only signal,
// each pill carries an icon and a word, so the two kinds stay tellable apart
// in greyscale. Ported from the Magic Patterns design
// (kudjspxd3xxroueg5jw11o, components/InvestmentTag.tsx); the design's unused
// `base` field is dropped, since the component never rendered a money figure.

export interface InvestmentTagProps {
  /** Stickers the investment pays per completed day, e.g. 3 renders "3x". */
  multiplier: number;
  /** True when a missed day takes value off the investment. */
  deductible: boolean;
  className?: string;
  testId?: string;
}

/** One line of plain words explaining the kind, for use under a tag. */
export function investmentRule(deductible: boolean): string {
  return deductible
    ? 'A missed day takes value off this investment.'
    : 'A missed day costs nothing. It just stops growing that day.';
}

/** Two pills: what kind of investment this is, and what it pays. */
export function InvestmentTag({
  multiplier,
  deductible,
  className = '',
  testId,
}: InvestmentTagProps) {
  return (
    <span
      data-testid={testId}
      className={`inline-flex flex-wrap items-center gap-1.5 ${className}`.trim()}
      aria-label={
        deductible
          ? `Invested at ${multiplier} times. Deductible, so a missed day takes value away.`
          : `Invested at ${multiplier} times. No penalty, so a missed day costs nothing.`
      }
    >
      <span
        className={`inline-flex items-center gap-1 rounded-full border-2 border-black px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-black ${
          deductible ? 'bg-red-300' : 'bg-green-300'
        }`}
      >
        {deductible ? (
          <AlertTriangle size={11} strokeWidth={3} aria-hidden="true" />
        ) : (
          <ShieldCheck size={11} strokeWidth={3} aria-hidden="true" />
        )}
        {deductible ? 'Deductible' : 'No penalty'}
      </span>
      <span className="inline-flex items-center gap-1 rounded-full border-2 border-black bg-yellow-300 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-black">
        <BarChart2 size={11} strokeWidth={3} aria-hidden="true" />
        Invested · {multiplier}x
      </span>
    </span>
  );
}
