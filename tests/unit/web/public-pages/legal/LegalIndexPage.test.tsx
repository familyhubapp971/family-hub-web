import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { LegalIndexPage } from '../../../../../src/public-pages/legal/LegalIndexPage';

// FHS-509: /legal index. Four cards link to the Privacy, Children &
// Parents, Terms and Cookies pages; this locks the titles and hrefs so
// a future copy edit can't silently break the link target.

function renderPage() {
  return render(
    <MemoryRouter>
      <LegalIndexPage />
    </MemoryRouter>,
  );
}

describe('<LegalIndexPage />', () => {
  it('shows the Legal heading', () => {
    renderPage();
    expect(screen.getByRole('heading', { name: 'Legal', level: 1 })).toBeInTheDocument();
  });

  it('renders the four legal cards with the right titles and hrefs', () => {
    renderPage();
    const cards: Array<[string, string]> = [
      ['Privacy Policy', '/legal/privacy'],
      ['Children & Parents', '/legal/children'],
      ['Terms of Service', '/legal/terms'],
      ['Cookies & Storage', '/legal/cookies'],
    ];
    for (const [title, href] of cards) {
      const heading = screen.getByRole('heading', { name: title, level: 2 });
      const link = heading.closest('a');
      expect(link).not.toBeNull();
      expect(link).toHaveAttribute('href', href);
    }
  });

  it('keeps the founder contact placeholders visible', () => {
    renderPage();
    expect(screen.getByText(/Family Hub is operated by \[Legal entity name\]/)).toBeInTheDocument();
  });
});
