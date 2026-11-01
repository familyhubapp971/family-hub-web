interface StepperHeaderProps {
  /** Total number of steps (≥ 1). */
  steps: number;
  /** 1-indexed current step. Steps below = done; equal = active; above = future. */
  current: number;
  /** Optional labels (length must equal `steps`); rendered under each circle on sm+ screens. */
  labels?: string[];
  /** Hide the connecting progress bar. Default false. */
  hideBar?: boolean;
  testId?: string;
}

/**
 * Numbered step indicator used by the Onboarding wizard (FHS-36), and
 * any other multi-step flow we add later (e.g. invite acceptance,
 * tenant transfer).
 *
 * Visual states:
 *   - done (idx < current): green-400 fill, white check, neo-shadow
 *   - active (idx === current): yellow-300 fill, bold number
 *   - future (idx > current): kingdom-800 fill, muted number
 *
 * The connecting line behind the circles fills proportionally to
 * `current / steps`, animated via a CSS width transition (no JS
 * animation library needed, keeps the primitive bundle-cheap).
 *
 * Respects prefers-reduced-motion: the width transition is skipped
 * when reduce-motion is on (CSS-level via the global utility).
 */
export function StepperHeader({
  steps,
  current,
  labels,
  hideBar = false,
  testId,
}: StepperHeaderProps) {
  const safeCurrent = Math.max(1, Math.min(current, steps));
  const progressPct = ((safeCurrent - 1) / Math.max(1, steps - 1)) * 100;

  return (
    <div data-testid={testId} className="w-full" aria-label={`Step ${safeCurrent} of ${steps}`}>
      <div className="relative flex items-center justify-between">
        {/* Background bar, anchored to the circle's vertical centre
            (top-5 = 20px = h-10 / 2) so it doesn't drift when labels
            grow the parent flex row's height. Using top-1/2 here
            would centre the bar on the row-with-labels, which sits
            below the circles' centre. */}
        {!hideBar && (
          <div
            className="absolute left-0 right-0 top-5 -translate-y-1/2"
            data-testid="stepper-bar"
            aria-hidden="true"
          >
            <div className="relative mx-5 h-1 rounded-full bg-kingdom-800">
              <div
                className="absolute left-0 top-0 h-full rounded-full bg-green-400 transition-[width] duration-500 ease-out motion-reduce:transition-none"
                style={{ width: `${progressPct}%` }}
                aria-hidden="true"
              />
            </div>
          </div>
        )}

        {Array.from({ length: steps }).map((_, idx) => {
          const stepNum = idx + 1;
          const done = stepNum < safeCurrent;
          const active = stepNum === safeCurrent;
          const future = stepNum > safeCurrent;

          const circleColor = done
            ? 'bg-green-400 text-black'
            : active
              ? 'bg-yellow-300 text-black'
              : 'bg-kingdom-800 text-white/60';

          return (
            <div
              key={stepNum}
              className="relative z-10 flex flex-col items-center"
              aria-current={active ? 'step' : undefined}
            >
              <div
                className={[
                  'flex h-10 w-10 items-center justify-center rounded-full border-2 border-black font-heading text-base shadow-neo',
                  circleColor,
                ].join(' ')}
              >
                {done ? '✓' : stepNum}
              </div>
              {labels?.[idx] && (
                <span
                  className={[
                    'mt-2 hidden text-xs font-bold sm:block',
                    future ? 'text-white/50' : 'text-white',
                  ].join(' ')}
                >
                  {labels[idx]}
                </span>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
