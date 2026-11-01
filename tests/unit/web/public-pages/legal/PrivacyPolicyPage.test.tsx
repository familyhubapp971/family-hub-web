import { describe, it, expect } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { PrivacyPolicyPage } from '../../../../../src/public-pages/legal/PrivacyPolicyPage';

// FHS-509: /legal/privacy. Every legal page shares the same
// LegalLayout shell: a pill nav between the four legal pages, a sticky
// "On this page" table of contents, and a highlighted plain-English
// summary above the legal detail of each section. This locks that
// shell rendering correctly for the Privacy page, plus the [placeholder]
// markers staying visible (this is pending-legal-review copy).

function renderPage() {
  return render(
    <MemoryRouter initialEntries={['/legal/privacy']}>
      <PrivacyPolicyPage />
    </MemoryRouter>,
  );
}

describe('<PrivacyPolicyPage />', () => {
  it('renders the pill nav linking to the other three legal pages', () => {
    renderPage();
    const nav = screen.getByRole('navigation', { name: 'Legal pages' });
    expect(within(nav).getByRole('link', { name: 'Privacy Policy' })).toHaveAttribute(
      'href',
      '/legal/privacy',
    );
    expect(within(nav).getByRole('link', { name: 'Children & Parents' })).toHaveAttribute(
      'href',
      '/legal/children',
    );
    expect(within(nav).getByRole('link', { name: 'Terms of Service' })).toHaveAttribute(
      'href',
      '/legal/terms',
    );
    expect(within(nav).getByRole('link', { name: 'Cookies & Storage' })).toHaveAttribute(
      'href',
      '/legal/cookies',
    );
  });

  it('shows the "On this page" table of contents', () => {
    renderPage();
    expect(screen.getByText('On this page')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Who we are/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /What we collect/ })).toBeInTheDocument();
  });

  it('shows a plain-English summary callout above the legal detail of every section', () => {
    renderPage();
    const summaries = screen.getAllByTestId('legal-section-summary');
    expect(summaries.length).toBeGreaterThan(0);
    expect(summaries[0]).toHaveTextContent(
      'Family Hub is a private organiser for one family at a time, run by [Legal entity name].',
    );
  });

  it('keeps the [placeholder] markers visible: this is draft copy pending legal review', () => {
    renderPage();
    expect(screen.getAllByText('[Legal entity name]').length).toBeGreaterThan(0);
    expect(screen.getAllByText('[Privacy contact]').length).toBeGreaterThan(0);
  });

  // FHS-561: every link to /legal carries the same name, so the back link
  // reads "Legal" rather than a third variant of the same destination.
  it('has a working "Legal" link back to the index', () => {
    renderPage();
    const backLinks = screen
      .getAllByRole('link', { name: /^Legal$/ })
      .filter((a) => a.getAttribute('href') === '/legal');
    expect(backLinks.length).toBeGreaterThan(0);
  });
});
