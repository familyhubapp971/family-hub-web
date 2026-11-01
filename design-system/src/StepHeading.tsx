export interface StepHeadingProps {
  /** 1-based position, shown in the disc. */
  number: number;
  /** The step's question, e.g. "Which habit?". */
  title: string;
  /** Tailwind background class for the disc, carrying the action's colour. */
  tone?: string;
  testId?: string;
}

/**
 * FHS-630: a numbered step heading, ported from the approved Magic Patterns
 * design (`components/MoneyActions.tsx`).
 *
 * A money sheet asks several things in a row. Numbering them, and phrasing each
 * as a question, is what stops the sheet reading as one long form: a parent can
 * see how many answers are wanted and which one they are on. The plain grey
 * labels this replaces gave neither.
 *
 * `first:mt-0` so the first step sits tight to the top of the sheet while the
 * rest keep their spacing.
 */
export function StepHeading({ number, title, tone = 'bg-yellow-300', testId }: StepHeadingProps) {
  return (
    <h3
      data-testid={testId}
      className="mt-5 flex items-center gap-2 font-heading text-lg first:mt-0"
    >
      <span
        aria-hidden="true"
        className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full border-2 border-black text-sm ${tone}`}
      >
        {number}
      </span>
      {title}
    </h3>
  );
}
