import type { ReactNode } from 'react';
import { Check } from 'lucide-react';

export interface ChoiceRowProps {
  selected: boolean;
  onClick: () => void;
  title: string;
  description?: string;
  icon?: ReactNode;
  /** FHS-623: greys the row out and blocks the click, e.g. a reward that
   *  costs more than the child has. */
  disabled?: boolean;
  /**
   * FHS-631: how the chosen row is marked. The design's money sheets use a
   * tick; every other screen already uses the radio dot, so that stays the
   * default and nothing else changes look.
   */
  marker?: 'radio' | 'check';
  /**
   * FHS-631: the background of the chosen row. The design uses a solid colour
   * that carries the action's meaning (yellow for a pick, green for "nothing
   * happens", red for "some comes off"). Defaults to the pale yellow every
   * other screen already uses.
   */
  selectedTone?: string;
  testId?: string;
}

/**
 * One row in a single-choice list, e.g. the "Pocket money" screen's
 * (FHS-512) "What happens on a day they skip it?" Nothing / They-lose-
 * some-money choice. Generic enough for any radio-style choice list.
 */
export function ChoiceRow({
  selected,
  onClick,
  title,
  description,
  icon,
  disabled = false,
  marker = 'radio',
  selectedTone = 'bg-yellow-50',
  testId,
}: ChoiceRowProps) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={selected}
      disabled={disabled}
      data-testid={testId}
      onClick={onClick}
      className={[
        'flex w-full items-start gap-3 rounded-xl border-2 border-black p-3.5 text-left transition-all',
        disabled ? 'cursor-not-allowed opacity-40' : 'motion-safe:hover:-translate-y-0.5',
        selected ? `${selectedTone} shadow-neo-xs` : 'bg-white hover:bg-gray-50',
      ].join(' ')}
    >
      {icon && (
        <span
          aria-hidden="true"
          className={[
            'flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border-2 border-black text-lg',
            selected ? 'bg-yellow-300' : 'bg-gray-100',
          ].join(' ')}
        >
          {icon}
        </span>
      )}
      <span className="min-w-0 flex-1">
        <span className="block text-sm font-black text-gray-900">{title}</span>
        {description && (
          <span className="mt-0.5 block text-xs font-medium text-gray-500">{description}</span>
        )}
      </span>
      {marker === 'check' ? (
        <span
          aria-hidden="true"
          className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center"
        >
          {selected && <Check size={18} strokeWidth={3} />}
        </span>
      ) : (
        <span
          aria-hidden="true"
          className={[
            'mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-2 border-black',
            selected ? 'bg-black' : 'bg-white',
          ].join(' ')}
        >
          {selected && <span className="h-2 w-2 rounded-full bg-white" />}
        </span>
      )}
    </button>
  );
}
