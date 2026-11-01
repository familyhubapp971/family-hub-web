import { Minus, Plus } from 'lucide-react';
import { currencySymbol } from '@familyhub/shared';

export interface AmountPickerProps {
  /** Current amount in INTEGER MINOR CURRENCY UNITS (e.g. 50 = 0.50). Never a float. */
  valueMinor: number;
  /**
   * ISO 4217 currency code. Rendered as its symbol beside the input ("£", not
   * "GBP"): FHS-614. The number stays editable, so this is the one money
   * control that cannot use `formatMoney` for the whole string.
   */
  currency: string;
  /** How much each ± tap changes the value by, in minor units. Default 25 (a quarter unit). */
  stepMinor?: number;
  /** Floor for the value, in minor units. Default 0: money never goes negative here. */
  minMinor?: number;
  /** Optional ceiling, in minor units. */
  maxMinor?: number;
  /** Called with the new value in INTEGER minor units, never a float. */
  onChange: (minor: number) => void;
  label?: string;
  testId?: string;
}

/**
 * FHS-512: the ± stepper + editable number used by the "Pocket money"
 * settings screen (family rate, per-child overrides). Internally everything
 * is an integer minor-unit amount; the decimal string is ONLY for display
 * and for parsing what the family typed, `onChange` always receives a
 * money-safe integer.
 */
export function AmountPicker({
  valueMinor,
  currency,
  stepMinor = 25,
  minMinor = 0,
  maxMinor,
  onChange,
  label,
  testId,
}: AmountPickerProps) {
  const clamp = (v: number): number => {
    let next = Math.round(v); // never let a float leak through
    if (next < minMinor) next = minMinor;
    if (typeof maxMinor === 'number' && next > maxMinor) next = maxMinor;
    return next;
  };

  const displayValue = (valueMinor / 100).toFixed(2);

  const handleTextChange = (raw: string) => {
    const parsed = Number.parseFloat(raw);
    if (Number.isNaN(parsed)) return;
    onChange(clamp(Math.round(parsed * 100)));
  };

  const canDecrement = valueMinor - stepMinor >= minMinor;
  const canIncrement = typeof maxMinor !== 'number' || valueMinor + stepMinor <= maxMinor;

  return (
    <div data-testid={testId} className="w-full">
      {label && (
        <p className="mb-1.5 text-xs font-bold uppercase tracking-wide text-gray-500">{label}</p>
      )}
      <div className="flex items-center gap-2 rounded-xl border-2 border-black bg-white p-1.5 shadow-neo-xs">
        <button
          type="button"
          aria-label="Decrease amount"
          data-testid={testId ? `${testId}-decrement` : undefined}
          disabled={!canDecrement}
          onClick={() => onChange(clamp(valueMinor - stepMinor))}
          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg border-2 border-black bg-white font-black transition-all motion-safe:hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-30 disabled:hover:translate-y-0"
        >
          <Minus size={18} strokeWidth={3} aria-hidden="true" />
        </button>
        <div className="flex flex-1 items-center justify-center gap-1.5 px-2">
          <span className="text-sm font-black text-gray-400">{currencySymbol(currency)}</span>
          <input
            type="number"
            inputMode="decimal"
            step={stepMinor / 100}
            min={minMinor / 100}
            value={displayValue}
            onChange={(e) => handleTextChange(e.target.value)}
            data-testid={testId ? `${testId}-input` : undefined}
            aria-label={label ?? 'Amount'}
            className="w-full min-w-0 border-none bg-transparent text-center text-2xl font-black text-gray-900 outline-none [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
          />
        </div>
        <button
          type="button"
          aria-label="Increase amount"
          data-testid={testId ? `${testId}-increment` : undefined}
          disabled={!canIncrement}
          onClick={() => onChange(clamp(valueMinor + stepMinor))}
          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg border-2 border-black bg-yellow-400 font-black transition-all motion-safe:hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-30 disabled:hover:translate-y-0"
        >
          <Plus size={18} strokeWidth={3} aria-hidden="true" />
        </button>
      </div>
    </div>
  );
}
