import React from 'react';

interface FeatureCardProps {
  /** Lucide (or any) icon node rendered in the white box on the header band. */
  icon: React.ReactNode;
  /** Heading text rendered in font-heading. */
  title: string;
  /** Body copy rendered below the title. */
  body: string;
  /**
   * Tailwind background class for the colored header band, e.g.
   * "bg-yellow-200", "bg-lime-200", "bg-cyan-200".
   */
  headerBg: string;
  /**
   * Tailwind background class for the card body, e.g. "bg-yellow-50".
   * Pairs with headerBg for cohesive colour blocking.
   */
  cardBg: string;
  /** Tailwind text-color class for the icon, e.g. "text-pink-500". */
  iconColor: string;
  /**
   * Tailwind border-l-* class for the accent stripe on the left edge,
   * e.g. "border-l-pink-400". Renders as a 6px coloured bar.
   */
  accentBar: string;
  /** Optional className passthrough for layout overrides. */
  className?: string;
  /**
   * Heading level for the card title (FHS-558). Defaults to h3, which is
   * correct under a section h2. Set it when the surrounding outline needs
   * a different level: skipping a level breaks the document outline
   * screen readers build (WCAG 1.3.1).
   */
  headingLevel?: 2 | 3 | 4;
  testId?: string;
}

/**
 * Marketing feature card used on the Welcome page (FHS-221): colored
 * header band over a white card body with an icon, heading, and body
 * copy. Six-pixel accent stripe on the left edge ties it to a category
 * (calendar / tasks / learn / journal).
 *
 * Built directly with Tailwind primitives rather than wrapping `Card`
 * because the header-band layout (split bg colour) doesn't fit the
 * single-bg Card prop API. Visual style still matches the design system
 * (2px black border, neo-shadow-lg, hover lift via the consumer).
 */
export function FeatureCard({
  icon,
  title,
  body,
  headerBg,
  cardBg,
  iconColor,
  accentBar,
  className = '',
  headingLevel = 3,
  testId,
}: FeatureCardProps) {
  const Heading = `h${headingLevel}` as const;
  return (
    <div
      data-testid={testId}
      className={[
        'flex h-full flex-col overflow-hidden rounded-xl border-2 border-black shadow-neo-lg',
        'border-l-[6px]',
        accentBar,
        cardBg,
        'text-black',
        className,
      ]
        .filter(Boolean)
        .join(' ')}
    >
      <div className={['flex items-center justify-center p-3', headerBg].join(' ')}>
        <div className="flex h-12 w-12 items-center justify-center rounded-md border-2 border-black bg-white shadow-neo">
          <span className={iconColor} aria-hidden="true">
            {icon}
          </span>
        </div>
      </div>
      <div className="p-4">
        <Heading className="mb-1 font-heading text-base md:text-lg">{title}</Heading>
        <p className="text-xs font-bold text-gray-600 md:text-sm">{body}</p>
      </div>
    </div>
  );
}
