import React from 'react';

export interface TopNavTab {
  id: string;
  label: string;
  icon?: React.ReactNode;
  /**
   * Optional numeric badge rendered as a red pill next to the label.
   * Hidden when 0 or undefined so callers can pass the count straight
   * through without conditional logic.
   */
  badge?: number;
}

interface TopNavProps {
  /** Brand area on the top-left: logo + product name. */
  brand?: React.ReactNode;
  /** Ordered tab list. Renders as the second row, under the brand. */
  tabs: TopNavTab[];
  /** Currently active tab id. */
  activeTab: string;
  /** Fires with the clicked tab's id. */
  onTabChange: (tabId: string) => void;
  /** Optional content rendered top-right (profile pill, logout, etc.). */
  rightSlot?: React.ReactNode;
  /** Optional className override on the outer <nav>. */
  className?: string;
  testId?: string;
}

/**
 * Top navigation for authenticated surfaces (Parent Dashboard,
 * ChildWorld), matching the Magic Patterns design: a darker-purple
 * banner with TWO rows: branding + right slot on top, the tab strip
 * underneath. Active tab is a pink pill with black text; inactive tabs
 * are borderless grey text that lighten on hover. Badges are small red
 * pills.
 *
 * Keyboard a11y: tab buttons are real <button>s; arrow keys are NOT
 * intercepted (browser default Tab key navigation is sufficient and
 * predictable).
 */
export function TopNav({
  brand,
  tabs,
  activeTab,
  onTabChange,
  rightSlot,
  className = '',
  testId,
}: TopNavProps) {
  return (
    <nav
      data-testid={testId}
      className={['w-full border-b-2 border-black bg-[#2a0b46] pt-4 text-white', className]
        .filter(Boolean)
        .join(' ')}
      role="navigation"
    >
      <div className="mx-auto w-full max-w-[1400px] px-4 md:px-6">
        {/* Row 1: branding left, profile/logout right. */}
        <div className="mb-6 flex flex-col items-start justify-between gap-4 md:flex-row md:items-center">
          {/* min-w-0 + max-w-full let a long brand (e.g. a long child name)
              shrink and truncate instead of widening the page sideways. */}
          {brand && <div className="min-w-0 max-w-full">{brand}</div>}
          {rightSlot && (
            <div className="flex max-w-full flex-wrap items-center gap-3 self-end md:self-auto">
              {rightSlot}
            </div>
          )}
        </div>

        {/* Row 2: tab strip. Scrollbar hidden visually; on small screens (where the
            tabs overflow) a right-edge fade signals more tabs. No fade at lg+ where
            the tabs fit, so the last tab isn't dimmed on desktop. */}
        <div
          className="relative flex gap-2 overflow-x-auto pb-0 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden max-lg:[mask-image:linear-gradient(to_right,black_85%,transparent)]"
          role="tablist"
          aria-label="Primary"
        >
          {tabs.map((tab) => {
            const active = tab.id === activeTab;
            return (
              <button
                key={tab.id}
                id={`tab-${tab.id}`}
                role="tab"
                aria-selected={active}
                aria-controls={`panel-${tab.id}`}
                onClick={() => onTabChange(tab.id)}
                className={[
                  'flex min-h-[44px] shrink-0 items-center gap-2 whitespace-nowrap rounded-lg px-3 py-2.5 text-sm font-bold transition-colors sm:px-5',
                  'focus:outline-none focus-visible:ring-4 focus-visible:ring-yellow-400',
                  active
                    ? 'border-2 border-black bg-pink-400 text-black shadow-neo-xs'
                    : 'bg-transparent text-gray-300 hover:bg-white/10 hover:text-white',
                ].join(' ')}
              >
                {tab.icon && <span className="shrink-0">{tab.icon}</span>}
                <span>{tab.label}</span>
                {tab.badge !== undefined && tab.badge > 0 && (
                  <span
                    aria-label={`${tab.badge} unread`}
                    data-testid={`tab-${tab.id}-badge`}
                    className="ml-1 rounded-full border border-black bg-red-500 px-1.5 py-0.5 text-[10px] font-black leading-none text-white"
                  >
                    {tab.badge}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>
    </nav>
  );
}
