import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { StepHeading } from '../../../../design-system/src/StepHeading';

// FHS-630: the numbered step heading from the approved Magic Patterns design.
// It exists so the money sheets stop reading as one long form: a parent can
// see how many answers are wanted and which one they are on.

describe('StepHeading', () => {
  it('shows the number and the question', () => {
    render(<StepHeading number={2} title="How much does it pay?" testId="step" />);
    const heading = screen.getByTestId('step');
    expect(heading).toHaveTextContent('2');
    expect(heading).toHaveTextContent('How much does it pay?');
  });

  it('is a real heading, so the sheet has a structure a screen reader can walk', () => {
    render(<StepHeading number={1} title="Which habit?" />);
    expect(screen.getByRole('heading', { name: /Which habit\?/ })).toBeInTheDocument();
  });

  it('hides the number disc from screen readers, since the title carries the meaning', () => {
    render(<StepHeading number={3} title="What happens on a skipped day?" testId="step" />);
    const disc = screen.getByTestId('step').querySelector('span');
    expect(disc).toHaveAttribute('aria-hidden', 'true');
  });

  it('carries the action colour on the disc, and defaults to the invest yellow', () => {
    const { rerender } = render(<StepHeading number={1} title="Which one?" testId="step" />);
    expect(screen.getByTestId('step').querySelector('span')?.className).toContain('bg-yellow-300');

    rerender(<StepHeading number={1} title="Which one?" tone="bg-orange-300" testId="step" />);
    expect(screen.getByTestId('step').querySelector('span')?.className).toContain('bg-orange-300');
  });

  it('sits tight to the top when it is the first step, and spaced when it is not', () => {
    render(<StepHeading number={1} title="Which habit?" testId="step" />);
    // `first:mt-0` cancels the margin for the opening step only.
    expect(screen.getByTestId('step').className).toContain('first:mt-0');
    expect(screen.getByTestId('step').className).toContain('mt-5');
  });
});
