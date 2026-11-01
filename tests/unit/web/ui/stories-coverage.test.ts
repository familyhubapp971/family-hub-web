import { readdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

// FHS-643: Storybook is only worth having if it stays complete. Without a
// guard, the catalogue quietly rots: a component ships, nobody writes a story,
// and six months later half the design system is invisible again. This test is
// what keeps "every component has a page" true rather than aspirational.
//
// Adding a component means adding its story, or naming it in AWAITING_STORIES
// below as a deliberate, visible debt.

const SRC = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '../../../../design-system/src',
);

/**
 * Components that do not have a story yet. Covered in a follow-up ticket: most
 * are composites that need providers or fixture data before they can be shown
 * honestly. Shrink this list, never grow it without a reason.
 */
const AWAITING_STORIES = [
  'AmountPicker',
  'AvatarEmojiPicker',
  'AvatarGrid',
  'ChoiceRow',
  'CollapsibleSection',
  'ConfirmDialog',
  'CurrencyPicker',
  'Dropdown',
  'DynamicCalendar',
  'FeatureCard',
  'FloatingDecorations',
  'FormCard',
  'MemberCard',
  'PinInput',
  'PricingCard',
  'SearchableSelect',
  'StepperHeader',
  'StickerAmountPicker',
  'TimezonePicker',
  'Toast',
  'TopNav',
  // Not a component: a helper that maps a habit name to its icon.
  'habitIcon',
];

const files = readdirSync(SRC);
const components = files
  .filter((f) => f.endsWith('.tsx') && !f.endsWith('.stories.tsx'))
  .map((f) => f.replace(/\.tsx$/, ''));
const withStories = new Set(
  files.filter((f) => f.endsWith('.stories.tsx')).map((f) => f.replace(/\.stories\.tsx$/, '')),
);

describe('Storybook coverage', () => {
  it('every component has a story, or is a known gap', () => {
    const missing = components
      .filter((name) => !withStories.has(name))
      .filter((name) => !AWAITING_STORIES.includes(name));

    expect(
      missing,
      `These components have no story. Add <Name>.stories.tsx beside the component, ` +
        `or add the name to AWAITING_STORIES in this test with a reason.`,
    ).toEqual([]);
  });

  it('the known-gap list has no stale entries', () => {
    const alreadyCovered = AWAITING_STORIES.filter((name) => withStories.has(name));

    expect(alreadyCovered, 'These now have stories, so remove them from AWAITING_STORIES.').toEqual(
      [],
    );
  });

  it('the known-gap list only names components that exist', () => {
    const ghosts = AWAITING_STORIES.filter((name) => !components.includes(name));

    expect(ghosts, 'These no longer exist, so remove them from AWAITING_STORIES.').toEqual([]);
  });

  it('a story exists for each of the primitives this ticket covered', () => {
    for (const name of ['Button', 'Card', 'Input', 'Badge', 'Toggle']) {
      expect(withStories.has(name), `${name} should have a story`).toBe(true);
    }
  });
});
