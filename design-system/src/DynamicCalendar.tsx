import { useEffect, useState } from 'react';

// Tear-off calendar that mimics the look of the 📅 emoji glyph but
// shows the user's actual current date. Built because the OS-rendered
// 📅 emoji is hard-coded to "JUL 17" on Apple platforms and varies
// arbitrarily on other platforms, an obvious tell when used as a
// "today's plan" visual cue.
//
// The component picks up the date on mount and refreshes itself once
// per minute, so a user who keeps the page open past midnight still
// sees the right day without a hard reload.

export interface DynamicCalendarProps {
  /** Override "today" for tests / Storybook. Defaults to the live clock. */
  now?: Date;
  /**
   * BCP-47 locale for the month abbreviation. Defaults to the browser's
   * detected locale; falls back to "en-US" when unavailable (SSR / jsdom).
   */
  locale?: string;
  /**
   * Tailwind sizing: defaults to a square `h-12 w-12`. Width controls
   * the card; height is required so the two halves can split 50/50.
   */
  className?: string;
  testId?: string;
}

function detectLocale(): string {
  if (typeof navigator !== 'undefined' && navigator.language) return navigator.language;
  return 'en-US';
}

export function DynamicCalendar({
  now,
  locale,
  className = 'h-14 w-14',
  testId,
}: DynamicCalendarProps) {
  // When `now` is passed (tests), don't run the clock effect at all so
  // the rendered date is fully deterministic.
  const [today, setToday] = useState<Date>(() => now ?? new Date());

  useEffect(() => {
    if (now) return;
    // Tick once a minute, cheap, and resilient to a tab kept open
    // across midnight without needing a precise sleep-to-midnight
    // calculation.
    const id = window.setInterval(() => setToday(new Date()), 60_000);
    return () => window.clearInterval(id);
  }, [now]);

  const resolvedLocale = locale ?? detectLocale();
  // Force exactly 3 uppercase characters: en-US's `short` already gives
  // JUL/DEC/etc., but other locales return the full word ("desember" no,
  // "Dezember" yes). slice(0,3) keeps the header from overflowing the
  // red strip in any locale.
  const month = new Intl.DateTimeFormat(resolvedLocale, { month: 'short' })
    .format(today)
    .toUpperCase()
    .slice(0, 3);
  const day = today.getDate();

  // a11y: render a hidden long-form date for screen readers; the visual
  // tear-off is purely decorative.
  const longDate = new Intl.DateTimeFormat(resolvedLocale, {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  }).format(today);

  return (
    <div
      role="img"
      aria-label={longDate}
      data-testid={testId}
      className={`inline-flex flex-col overflow-hidden rounded-md border-2 border-black bg-white shadow-neo-sm ${className}`}
    >
      {/* Equal-height split: each half takes 50% of the card height
          via flex-1. Day number uses leading-none + a smaller text-lg
          so the digit fits inside the half-card height (28px on the
          h-14 default) without clipping descenders or ascenders. */}
      <div className="flex flex-1 items-center justify-center bg-red-700 px-1 text-[11px] font-bold uppercase leading-none tracking-wider text-white">
        {month}
      </div>
      <div className="flex flex-1 items-center justify-center px-1 font-heading text-lg leading-none text-black">
        {day}
      </div>
    </div>
  );
}
