import { describe, it, expect } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import { Card } from '../../../../design-system/src/Card';
import { AvatarGrid } from '../../../../design-system/src/AvatarGrid';
import { AvatarEmojiPicker } from '../../../../design-system/src/AvatarEmojiPicker';
import { SearchableSelect } from '../../../../design-system/src/SearchableSelect';

// FHS-548: responsive sweep regression tests.
//
// Locks the design-system fixes from the FHS-547 audit: hover-lift
// transforms must be gated behind motion-safe:, and tap targets must
// meet the 44×44px floor. A bare hover:-translate-* (no motion-safe:
// prefix) or an undersized swatch is exactly the bug being fixed.

const BARE_TRANSLATE = /(^|\s)(group-)?hover:-translate-y/;

describe('hover lift respects prefers-reduced-motion', () => {
  it('card hover lift is gated behind motion-safe', () => {
    render(
      <Card hover testId="sweep-card">
        content
      </Card>,
    );
    const card = screen.getByTestId('sweep-card');
    expect(card.className).toContain('motion-safe:hover:-translate-y-1');
    expect(card.className).not.toMatch(BARE_TRANSLATE);
  });

  it('avatar tile hover lift is gated behind motion-safe', () => {
    render(
      <AvatarGrid
        avatars={[{ id: 'k1', name: 'Zia', color: 'bg-pink-200' }]}
        testId="sweep-grid"
      />,
    );
    const tile = within(screen.getByTestId('sweep-grid')).getByRole('button', { name: 'Zia' });
    expect(tile.className).toContain('motion-safe:hover:-translate-y-0.5');
    expect(tile.className).not.toMatch(BARE_TRANSLATE);
  });

  it('searchable select trigger hover lift is gated behind motion-safe', () => {
    render(
      <SearchableSelect
        options={[{ value: 'AED', label: 'AED' }]}
        value="AED"
        onChange={() => {}}
        ariaLabel="Currency"
      />,
    );
    const trigger = screen.getByRole('button', { name: 'Currency' });
    expect(trigger.className).toContain('motion-safe:hover:-translate-y-0.5');
    expect(trigger.className).not.toMatch(BARE_TRANSLATE);
  });
});

describe('tap targets meet the 44px floor', () => {
  it('skin-tone swatches meet the 44px tap floor', () => {
    render(<AvatarEmojiPicker value="" onSelect={() => {}} />);
    const swatches = within(screen.getByRole('group', { name: 'Skin tone' })).getAllByRole(
      'button',
    );
    expect(swatches.length).toBeGreaterThan(0);
    for (const swatch of swatches) {
      expect(swatch.className).toContain('min-h-[44px]');
      expect(swatch.className).toContain('min-w-[44px]');
    }
  });
});
