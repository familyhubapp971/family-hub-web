import { useEffect, useId, useMemo, useRef, useState } from 'react';
import type { KeyboardEvent } from 'react';
import { Check, ChevronDown, Search } from 'lucide-react';

// Lightweight searchable dropdown shared by TimezonePicker (FHS-38) and
// CurrencyPicker (FHS-39). Pure React + Tailwind, no headlessui dep.
//
// Keyboard model:
//   - Enter / Space / Click on the trigger toggles open
//   - When open, typing focuses the search input
//   - ↑ / ↓ moves the highlight inside the visible list
//   - Enter selects the highlighted item, closes the menu
//   - Esc closes without selecting
//   - Tab / blur closes
//
// Filter: case-insensitive substring match on `searchKeys` (defaults
// to the item label + value). Empty query renders the full list.

export interface SearchableOption {
  value: string;
  /** Primary label rendered in the trigger when selected. */
  label: string;
  /** Optional secondary line under the label inside the dropdown row. */
  secondary?: string;
}

export interface SearchableSelectProps {
  options: SearchableOption[];
  value: string;
  onChange: (value: string) => void;
  /** Placeholder text shown in the trigger when nothing is selected. */
  placeholder?: string;
  /** Placeholder for the search input. Default: "Search…" */
  searchPlaceholder?: string;
  /** Override the search predicate. Default: case-insensitive match on label + value + secondary. */
  filter?: (option: SearchableOption, query: string) => boolean;
  /** Tailwind class added to the trigger button, caller controls width. */
  className?: string;
  testId?: string;
  disabled?: boolean;
  /** Optional aria-label when there's no visible <label> nearby. */
  ariaLabel?: string;
  /**
   * `id` for the trigger button, pair with a sibling `<label htmlFor>`
   * for proper screen-reader association. Without this, only `ariaLabel`
   * conveys the field name.
   */
  id?: string;
}

function defaultFilter(opt: SearchableOption, q: string): boolean {
  if (!q) return true;
  const needle = q.toLowerCase();
  return (
    opt.label.toLowerCase().includes(needle) ||
    opt.value.toLowerCase().includes(needle) ||
    (opt.secondary?.toLowerCase().includes(needle) ?? false)
  );
}

export function SearchableSelect({
  options,
  value,
  onChange,
  placeholder = 'Select…',
  searchPlaceholder = 'Search…',
  filter = defaultFilter,
  className = 'w-full',
  testId,
  disabled,
  ariaLabel,
  id,
}: SearchableSelectProps) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [highlight, setHighlight] = useState(0);
  const wrapperRef = useRef<HTMLDivElement | null>(null);
  const searchRef = useRef<HTMLInputElement | null>(null);
  const listboxId = useId();

  const filtered = useMemo(() => options.filter((o) => filter(o, query)), [options, query, filter]);
  const selected = useMemo(() => options.find((o) => o.value === value), [options, value]);

  // Reset highlight when the filtered set changes so we never point past
  // the end of the list (would feel like Enter does nothing).
  useEffect(() => {
    setHighlight((prev) => (filtered.length === 0 ? 0 : Math.min(prev, filtered.length - 1)));
  }, [filtered.length]);

  // Focus the search input the moment the menu opens.
  useEffect(() => {
    if (open) searchRef.current?.focus();
  }, [open]);

  // Close on outside-click. Listening on `mousedown` so the menu
  // dismisses BEFORE the click hits some other interactive control.
  useEffect(() => {
    if (!open) return;
    function onDoc(e: MouseEvent) {
      if (!wrapperRef.current?.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, [open]);

  function commit(opt: SearchableOption) {
    onChange(opt.value);
    setOpen(false);
    setQuery('');
  }

  function onSearchKey(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Escape') {
      e.preventDefault();
      setOpen(false);
      return;
    }
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setHighlight((h) => Math.min(h + 1, Math.max(0, filtered.length - 1)));
      return;
    }
    if (e.key === 'ArrowUp') {
      e.preventDefault();
      setHighlight((h) => Math.max(0, h - 1));
      return;
    }
    if (e.key === 'Enter') {
      e.preventDefault();
      const opt = filtered[highlight];
      if (opt) commit(opt);
      return;
    }
    if (e.key === 'Tab') {
      // Don't preventDefault, let the browser move focus naturally.
      // Just dismiss the popover so a stray Enter on the next focused
      // element can't re-trigger the highlight commit on tab-back.
      setOpen(false);
    }
  }

  // Stable id for the highlighted option, paired with the search
  // input's aria-activedescendant so screen readers announce moves
  // through the list while focus stays in the input.
  const activeDescendantId =
    open && filtered[highlight] ? `${listboxId}-opt-${highlight}` : undefined;

  return (
    <div ref={wrapperRef} className={`relative ${className}`} data-testid={testId}>
      <button
        type="button"
        id={id}
        disabled={disabled}
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center justify-between rounded-md border-2 border-black bg-white px-3 py-2 text-left font-bold text-black shadow-neo-sm transition-all motion-safe:hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-50"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={open ? listboxId : undefined}
        aria-label={ariaLabel}
        data-testid={testId ? `${testId}-trigger` : undefined}
      >
        <span className={selected ? '' : 'text-gray-400'}>
          {selected ? selected.label : placeholder}
        </span>
        <ChevronDown size={16} aria-hidden="true" />
      </button>

      {open && (
        <div
          className="absolute left-0 right-0 top-full z-20 mt-1 max-h-72 overflow-hidden rounded-md border-2 border-black bg-white shadow-neo-md"
          data-testid={testId ? `${testId}-popover` : undefined}
        >
          <div className="flex items-center gap-2 border-b-2 border-black bg-yellow-50 px-3 py-2">
            <Search size={14} className="text-gray-500" aria-hidden="true" />
            <input
              ref={searchRef}
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={onSearchKey}
              placeholder={searchPlaceholder}
              className="w-full bg-transparent text-sm font-bold text-black placeholder:text-gray-400 focus:outline-none"
              aria-label={searchPlaceholder}
              aria-controls={listboxId}
              aria-activedescendant={activeDescendantId}
              role="combobox"
              aria-expanded={open}
              data-testid={testId ? `${testId}-search` : undefined}
            />
          </div>
          <ul
            id={listboxId}
            role="listbox"
            className="max-h-56 overflow-y-auto"
            data-testid={testId ? `${testId}-listbox` : undefined}
          >
            {filtered.length === 0 && (
              <li className="px-3 py-2 text-sm italic text-gray-500">No matches.</li>
            )}
            {filtered.map((opt, idx) => {
              const isHighlighted = idx === highlight;
              const isSelected = opt.value === value;
              return (
                /* eslint-disable-next-line jsx-a11y/click-events-have-key-events --
                   Keyboard interaction happens on the search input via
                   aria-activedescendant (↑/↓/Enter), not on the option
                   itself, focus never leaves the input. The click
                   handler exists for mouse + touch only. */
                <li
                  key={opt.value}
                  id={`${listboxId}-opt-${idx}`}
                  role="option"
                  aria-selected={isSelected}
                  onMouseEnter={() => setHighlight(idx)}
                  onClick={() => commit(opt)}
                  className={[
                    'flex cursor-pointer items-center justify-between px-3 py-2 text-sm',
                    isHighlighted ? 'bg-yellow-100' : 'bg-white',
                    'hover:bg-yellow-100',
                  ].join(' ')}
                  data-testid={testId ? `${testId}-option-${opt.value}` : undefined}
                >
                  <div className="flex flex-col">
                    <span className="font-bold text-black">{opt.label}</span>
                    {opt.secondary && (
                      <span className="text-xs text-gray-500">{opt.secondary}</span>
                    )}
                  </div>
                  {isSelected && <Check size={14} className="text-green-600" aria-hidden="true" />}
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </div>
  );
}
