import type { ReactNode } from 'react';
import { motion, useReducedMotion } from 'framer-motion';

export interface FloatingDecoration {
  /**
   * Emoji, short string, or any React node. Use a string for static
   * emojis; pass a component (e.g. <DynamicCalendar />) for visuals
   * that need live state.
   */
  icon: ReactNode;
  /** CSS top position (e.g. "15%", "120px"). */
  top: string;
  /** CSS left position (mutually exclusive with right). */
  left?: string;
  /** CSS right position (mutually exclusive with left). */
  right?: string;
  /** Animation delay in seconds; staggers the float across multiple items. */
  delay?: number;
}

interface FloatingDecorationsProps {
  /** List of decorative elements with positions + delays. */
  elements: FloatingDecoration[];
  /**
   * Hide on small screens. Default true: decorations are noise on
   * narrow viewports.
   */
  hideOnMobile?: boolean;
  /** Tailwind size for the emoji text, default "text-4xl". */
  size?: string;
  /** Opacity 0–100. Default 50 so decorations sit behind content. */
  opacityClass?: string;
  testId?: string;
}

/**
 * Decorative floating emojis used on the Welcome page (FHS-221) hero
 * to add depth without distracting from copy. Each element drifts up
 * 20px and rotates ±5° on a 4-second loop.
 *
 * Respects prefers-reduced-motion: the elements still render in place
 * but the framer-motion animation is suppressed entirely (vestibular
 * a11y).
 *
 * Pointer-events disabled: these never block clicks on content
 * underneath.
 */
export function FloatingDecorations({
  elements,
  hideOnMobile = true,
  size = 'text-4xl',
  opacityClass = 'opacity-50',
  testId,
}: FloatingDecorationsProps) {
  const reduceMotion = useReducedMotion();

  return (
    <div data-testid={testId} aria-hidden="true">
      {elements.map((el, idx) => {
        const baseClass = [
          'pointer-events-none absolute',
          hideOnMobile ? 'hidden md:block' : '',
          size,
          opacityClass,
        ]
          .filter(Boolean)
          .join(' ');

        // Inline style object, keys conditionally added (vs left:undefined)
        // because framer-motion's MotionStyle rejects optional-undefined under
        // exactOptionalPropertyTypes.
        const style: Record<string, string> = { top: el.top };
        if (el.left) style.left = el.left;
        if (el.right) style.right = el.right;

        if (reduceMotion) {
          // Static, no transform, no infinite loop.
          return (
            <div key={idx} className={baseClass} style={style}>
              {el.icon}
            </div>
          );
        }

        return (
          <motion.div
            key={idx}
            className={baseClass}
            style={style}
            animate={{ y: [0, -20, 0], rotate: [0, 5, -5, 0] }}
            transition={{
              duration: 4,
              repeat: Infinity,
              ease: 'easeInOut',
              delay: el.delay ?? 0,
            }}
          >
            {el.icon}
          </motion.div>
        );
      })}
    </div>
  );
}
