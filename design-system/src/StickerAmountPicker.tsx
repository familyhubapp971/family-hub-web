import { Minus, Plus } from 'lucide-react';

export interface StickerAmountPickerProps {
  /** Current amount, as a whole count of stickers. Never a float. */
  value: number;
  /** How much each +/- tap changes the value by. Default 1. */
  step?: number;
  /** Floor for the value. Default 0. */
  min?: number;
  /** Ceiling for the value: nothing above this can be picked. */
  max: number;
  /** Called with the new value, always a whole number clamped to [min, max]. */
  onChange: (value: number) => void;
  label?: string;
  /** A plain-words line under the stepper, e.g. "= AED 10.00". */
  preview?: string;
  /**
   * FHS-630: the design's one-tap "Use all N" shortcut. Tailwind background
   * class for it, carrying the action's colour. Omit to hide the button.
   */
  useAllTone?: string;
  /**
   * FHS-631: 'design' lays the control out as the approved design does, minus
   * and plus as their own square buttons either side of the number, with no
   * "stickers" suffix. Defaults to the original, so existing callers are
   * unchanged.
   */
  variant?: 'default' | 'design';
  testId?: string;
}

/**
 * FHS-623: a whole-number stepper for picking a count of stickers (how many
 * to move, cash out, invest, or withdraw), paired with a money preview line
 * underneath so the family always sees both the sticker count and what it's
 * worth before confirming. Sibling to `AmountPicker` (money, minor units):
 * this one is for stickers, an integer count, never money directly.
 */
export function StickerAmountPicker({
  value,
  step = 1,
  min = 0,
  max,
  onChange,
  label,
  preview,
  useAllTone,
  variant = 'default',
  testId,
}: StickerAmountPickerProps) {
  const clamp = (v: number): number => {
    let next = Math.round(v);
    if (next < min) next = min;
    if (next > max) next = max;
    return next;
  };

  const handleTextChange = (raw: string) => {
    const parsed = Number.parseInt(raw, 10);
    if (Number.isNaN(parsed)) return;
    onChange(clamp(parsed));
  };

  const canDecrement = value - step >= min;
  const canIncrement = value + step <= max;

  return (
    <div data-testid={testId} className="w-full">
      {label && (
        <p className="mb-1.5 text-xs font-bold uppercase tracking-wide text-gray-500">{label}</p>
      )}
      <div
        className={
          variant === 'design'
            ? 'flex items-center gap-2'
            : 'flex items-center gap-2 rounded-xl border-2 border-black bg-white p-1.5 shadow-neo-xs'
        }
      >
        <button
          type="button"
          aria-label="Fewer stickers"
          data-testid={testId ? `${testId}-decrement` : undefined}
          disabled={!canDecrement}
          onClick={() => onChange(clamp(value - step))}
          className={`flex shrink-0 items-center justify-center rounded-xl border-2 border-black bg-white font-black transition-all motion-safe:hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-30 disabled:hover:translate-y-0 ${
            variant === 'design' ? 'h-12 w-12 shadow-neo-xs' : 'h-11 w-11 rounded-lg'
          }`}
        >
          <Minus size={18} strokeWidth={3} aria-hidden="true" />
        </button>
        <div
          className={
            variant === 'design'
              ? 'flex min-h-[52px] flex-1 items-center justify-center rounded-xl border-2 border-black bg-white px-2 shadow-neo-xs'
              : 'flex flex-1 items-center justify-center gap-1.5 px-2'
          }
        >
          <input
            type="number"
            inputMode="numeric"
            step={step}
            min={min}
            max={max}
            value={value}
            onChange={(e) => handleTextChange(e.target.value)}
            data-testid={testId ? `${testId}-input` : undefined}
            aria-label={label ?? 'Stickers'}
            className="w-full min-w-0 border-none bg-transparent text-center text-2xl font-black text-gray-900 outline-none [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
          />
          {variant !== 'design' && (
            <span className="text-sm font-black uppercase text-gray-400">stickers</span>
          )}
        </div>
        <button
          type="button"
          aria-label="More stickers"
          data-testid={testId ? `${testId}-increment` : undefined}
          disabled={!canIncrement}
          onClick={() => onChange(clamp(value + step))}
          className={`flex shrink-0 items-center justify-center rounded-xl border-2 border-black font-black transition-all motion-safe:hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-30 disabled:hover:translate-y-0 ${
            variant === 'design'
              ? 'h-12 w-12 bg-white shadow-neo-xs'
              : 'h-11 w-11 rounded-lg bg-yellow-400'
          }`}
        >
          <Plus size={18} strokeWidth={3} aria-hidden="true" />
        </button>
      </div>
      {useAllTone && (
        <button
          type="button"
          onClick={() => onChange(max)}
          disabled={value >= max}
          data-testid={testId ? `${testId}-use-all` : undefined}
          className={`mt-2 min-h-11 rounded-lg border-2 border-black px-3 text-sm font-bold shadow-neo-xs transition-transform motion-safe:hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:translate-y-0 ${useAllTone}`}
        >
          Use all {max}
        </button>
      )}
      {preview && (
        <p
          className="mt-1.5 text-sm font-bold text-gray-600"
          data-testid={testId ? `${testId}-preview` : undefined}
        >
          {preview}
        </p>
      )}
    </div>
  );
}
