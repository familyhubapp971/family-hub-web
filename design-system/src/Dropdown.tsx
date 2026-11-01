import { useEffect, useId, useRef, useState } from 'react';
import type { KeyboardEvent } from 'react';
import { Check, ChevronDown } from 'lucide-react';

// FHS-359: a small in-app dropdown for short option lists (e.g. switch-child),
// so the app never falls back to the grey OS <select> menu. For long, filterable
// lists use SearchableSelect instead.
//
// Keyboard: Enter/Space/Click toggles; ↑/↓ move the highlight; Enter selects;
// Esc closes; click-outside / blur closes.

export interface DropdownOption {
  value: string;
  label: string;
}

export interface DropdownProps {
  options: DropdownOption[];
  value: string;
  onChange: (value: string) => void;
  /** Tailwind classes for the trigger button, caller controls width/colour. */
  className?: string;
  /** Classes for the popup list (e.g. min width / alignment). */
  menuClassName?: string;
  placeholder?: string;
  ariaLabel?: string;
  testId?: string;
  disabled?: boolean;
}

export function Dropdown({
  options,
  value,
  onChange,
  className,
  menuClassName,
  placeholder = 'Select',
  ariaLabel,
  testId,
  disabled = false,
}: DropdownProps) {
  const [open, setOpen] = useState(false);
  const [highlight, setHighlight] = useState(0);
  const rootRef = useRef<HTMLDivElement>(null);
  const listId = useId();

  const selected = options.find((o) => o.value === value) ?? null;

  useEffect(() => {
    if (!open) return;
    const onDocMouse = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onDocMouse);
    return () => document.removeEventListener('mousedown', onDocMouse);
  }, [open]);

  // When opening, highlight the current selection.
  useEffect(() => {
    if (open) {
      const idx = options.findIndex((o) => o.value === value);
      setHighlight(idx >= 0 ? idx : 0);
    }
  }, [open, options, value]);

  const choose = (v: string) => {
    onChange(v);
    setOpen(false);
  };

  const onKeyDown = (e: KeyboardEvent) => {
    if (disabled) return;
    if (!open) {
      if (e.key === 'Enter' || e.key === ' ' || e.key === 'ArrowDown') {
        e.preventDefault();
        setOpen(true);
      }
      return;
    }
    if (e.key === 'Escape') {
      e.preventDefault();
      setOpen(false);
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      setHighlight((h) => Math.min(h + 1, options.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setHighlight((h) => Math.max(h - 1, 0));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      const opt = options[highlight];
      if (opt) choose(opt.value);
    }
  };

  return (
    <div ref={rootRef} className="relative" data-testid={testId}>
      <button
        type="button"
        disabled={disabled}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label={ariaLabel}
        onClick={() => !disabled && setOpen((o) => !o)}
        onKeyDown={onKeyDown}
        className={
          className ??
          'flex min-h-[44px] items-center gap-2 rounded-md border-2 border-black bg-white px-3 py-2 text-sm font-bold text-purple-900 shadow-neo-sm disabled:opacity-60'
        }
      >
        <span className="truncate">{selected?.label ?? placeholder}</span>
        <ChevronDown size={16} strokeWidth={3} aria-hidden="true" />
      </button>

      {open && (
        <ul
          id={listId}
          role="listbox"
          aria-label={ariaLabel}
          className={`absolute right-0 z-30 mt-1 max-h-64 min-w-full overflow-auto rounded-md border-2 border-black bg-white py-1 text-left shadow-neo-md ${menuClassName ?? ''}`}
        >
          {options.map((o, i) => {
            const isSel = o.value === value;
            return (
              <li key={o.value} role="option" aria-selected={isSel}>
                <button
                  type="button"
                  onClick={() => choose(o.value)}
                  onMouseEnter={() => setHighlight(i)}
                  className={`flex w-full items-center gap-2 px-3 py-2.5 text-left text-sm font-bold ${
                    i === highlight ? 'bg-violet-100' : ''
                  } ${isSel ? 'text-purple-900' : 'text-gray-800'}`}
                >
                  <span className="w-4 shrink-0" aria-hidden="true">
                    {isSel && <Check size={14} strokeWidth={3} />}
                  </span>
                  <span className="truncate">{o.label}</span>
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
