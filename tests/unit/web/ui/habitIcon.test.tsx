import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { habitIcon, HABIT_ICON_NAMES } from '../../../../design-system/src/habitIcon';

// FHS-631: a habit's icon is stored as a NAME ("heart", "star"), never an emoji
// and never a component. Anything that renders the stored value directly prints
// the literal word on screen. That shipped twice: once before FHS-374, and
// again in the money sheets built by FHS-630.
//
// These tests exist so it cannot ship a third time. The rule they encode is
// simple: whatever the server sends, a component comes back, never a string.

describe('habitIcon', () => {
  it('never returns a string, whatever it is given', () => {
    for (const value of [...HABIT_ICON_NAMES, 'HEART', 'Star', '', 'not-a-real-icon', null]) {
      expect(typeof habitIcon(value)).not.toBe('string');
    }
    expect(typeof habitIcon(undefined)).not.toBe('string');
  });

  it.each(HABIT_ICON_NAMES)('draws an icon for the stored name %s, not the word', (name) => {
    const Icon = habitIcon(name);
    const { container } = render(<Icon data-testid="icon" />);
    // An svg is on screen, and the stored name appears nowhere as text.
    expect(container.querySelector('svg')).toBeInTheDocument();
    expect(container.textContent ?? '').not.toContain(name);
  });

  it('falls back to an icon for a name the server has not taught us yet', () => {
    const Icon = habitIcon('some-future-icon-nobody-mapped');
    const { container } = render(<Icon />);
    expect(container.querySelector('svg')).toBeInTheDocument();
    expect(container.textContent ?? '').toBe('');
  });

  it('is case-insensitive, so a stored "Heart" is not treated as unknown', () => {
    expect(habitIcon('Heart')).toBe(habitIcon('heart'));
    expect(habitIcon('TROPHY')).toBe(habitIcon('trophy'));
  });

  it('renders nothing readable as text, which is the actual bug', () => {
    // The exact shape of the regression: "heart" reaching the screen as words.
    const Icon = habitIcon('heart');
    render(
      <div data-testid="row">
        <Icon />
        <span>I was polite</span>
      </div>,
    );
    expect(screen.getByTestId('row').textContent).toBe('I was polite');
  });
});
