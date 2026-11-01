// FHS-558: FeatureCard hard-coded an h3, so the landing page outline went
// h1 then h3 with nothing in between (WCAG 1.3.1). The level is now a prop.
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { FeatureCard } from '../../../../design-system/src/FeatureCard';

const base = {
  icon: <span data-testid="icon" />,
  title: 'One calendar, every child',
  body: 'School runs, swim class, dentist.',
  headerBg: 'bg-yellow-200',
  cardBg: 'bg-yellow-50',
  iconColor: 'text-pink-500',
  accentBar: 'border-l-pink-400',
};

describe('FeatureCard heading level', () => {
  it('renders the title as an h3 by default', () => {
    render(<FeatureCard {...base} />);
    expect(screen.getByRole('heading', { level: 3, name: base.title })).toBeInTheDocument();
  });

  it('renders at the requested level when the outline needs a different one', () => {
    render(<FeatureCard {...base} headingLevel={2} />);
    expect(screen.getByRole('heading', { level: 2, name: base.title })).toBeInTheDocument();
    expect(screen.queryByRole('heading', { level: 3 })).not.toBeInTheDocument();
  });
});
