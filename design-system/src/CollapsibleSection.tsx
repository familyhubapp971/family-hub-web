import React, { useState } from 'react';
import { ChevronDown } from 'lucide-react';

// FHS-513: reusable collapsible group card: an emoji tile + title +
// optional subtitle/count in a header bar, a chevron that flips on
// toggle, and a body that only renders while open.
//
// FHS-520 (design-fidelity pass): two visual variants, matching the
// Magic Patterns "Manage Family" mock exactly:
//   'card'  (default): a white rounded card, a round white icon tile,
//           a plain chevron. Used for helper cards like "How your kids
//           sign in".
//   'group': the member-group wrapper: a DARK translucent card
//           (bg-black/25) with a full-width coloured accent header bar,
//           square white icon + chevron tiles. Used for the "Grown-ups"
//           / "Kids" member groups on Manage Family, never white.

export interface CollapsibleSectionProps {
  /** Emoji (or any short glyph) shown in the tile on the left. */
  emoji: React.ReactNode;
  title: string;
  subtitle?: string;
  /** Shown as "(N)" next to the title when set. */
  count?: number;
  /** Tailwind classes for the header bar background + text colour. */
  headerClassName?: string;
  /** Tailwind background class for the emoji tile. Defaults to white. */
  tileClassName?: string;
  /** 'card' = white helper card (default). 'group' = dark member-group wrapper. */
  variant?: 'card' | 'group';
  defaultOpen?: boolean;
  children: React.ReactNode;
  testId?: string;
}

export function CollapsibleSection({
  emoji,
  title,
  subtitle,
  count,
  headerClassName = '',
  tileClassName = 'bg-white',
  variant = 'card',
  defaultOpen = true,
  children,
  testId,
}: CollapsibleSectionProps) {
  const [open, setOpen] = useState(defaultOpen);
  const isGroup = variant === 'group';

  return (
    <div
      data-testid={testId}
      className={
        isGroup
          ? 'overflow-hidden rounded-2xl border-2 border-black bg-black/25'
          : 'overflow-hidden rounded-xl border-2 border-black bg-white shadow-neo-sm'
      }
    >
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        data-testid={testId ? `${testId}-toggle` : undefined}
        className={
          isGroup
            ? `group flex w-full items-center gap-3 border-b-2 border-black p-4 text-left transition-colors ${headerClassName}`
            : `flex w-full items-center gap-3 p-5 text-left transition-colors ${headerClassName}`
        }
      >
        <span
          aria-hidden="true"
          className={
            isGroup
              ? `flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border-2 border-black text-xl shadow-neo-xs ${tileClassName}`
              : `flex h-12 w-12 shrink-0 items-center justify-center rounded-xl border-2 border-black text-2xl ${tileClassName}`
          }
        >
          {emoji}
        </span>
        <span className="min-w-0 flex-1">
          <span
            className={`block font-heading leading-none ${isGroup ? 'text-2xl' : 'text-xl text-black'}`}
          >
            {title}
            {typeof count === 'number' && (
              <span
                className={`ml-2 ${isGroup ? 'text-lg opacity-60' : 'text-sm font-bold text-gray-700'}`}
              >
                ({count})
              </span>
            )}
          </span>
          {subtitle && (
            <span className={`block text-sm font-bold ${isGroup ? 'opacity-70' : 'text-gray-500'}`}>
              {subtitle}
            </span>
          )}
        </span>
        {isGroup ? (
          <span
            aria-hidden="true"
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border-2 border-black bg-white shadow-neo-xs transition-transform motion-safe:group-hover:-translate-y-0.5"
          >
            <ChevronDown size={20} strokeWidth={3} className={open ? 'rotate-180' : ''} />
          </span>
        ) : (
          <ChevronDown
            size={20}
            strokeWidth={3}
            aria-hidden="true"
            className={`shrink-0 transition-transform ${open ? 'rotate-180' : ''}`}
          />
        )}
      </button>
      {open && (
        <div
          className={isGroup ? 'p-4' : 'p-5'}
          data-testid={testId ? `${testId}-body` : undefined}
        >
          {children}
        </div>
      )}
    </div>
  );
}
