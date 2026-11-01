export interface BoostButtonProps {
  /** The boost multiplier this button represents, e.g. 2, 3, 5. */
  multiplier: number;
  selected: boolean;
  onClick: () => void;
  testId?: string;
}

/**
 * One boost-preset pill (e.g. "2x", "3x", "5x"): the "Pocket money" screen
 * (FHS-512) renders three of these per habit so a big/important habit can
 * pay out more stickers per completion.
 */
export function BoostButton({ multiplier, selected, onClick, testId }: BoostButtonProps) {
  return (
    <button
      type="button"
      aria-pressed={selected}
      data-testid={testId}
      onClick={onClick}
      className={[
        'min-h-11 flex-1 rounded-xl border-2 border-black px-4 py-2.5 text-sm font-black uppercase tracking-wide transition-all',
        'motion-safe:hover:-translate-y-0.5',
        selected
          ? 'bg-yellow-400 text-black shadow-neo-xs'
          : 'bg-white text-gray-500 hover:bg-gray-50',
      ].join(' ')}
    >
      {multiplier}x
    </button>
  );
}
