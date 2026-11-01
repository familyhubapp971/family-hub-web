import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { AboutPage } from '../../../../../src/public-pages/home/AboutPage';

// FHS-436: a beta reviewer said it wasn't clear WHAT Family Hub is, WHO
// it's for, or its value. This page spells that out; these tests lock
// the headline, the "what you can do" + "who it's for" + kid-safety
// sections, and the Start free / Privacy Policy links a visitor needs.

function renderPage() {
  return render(
    <MemoryRouter>
      <AboutPage />
    </MemoryRouter>,
  );
}

describe('<AboutPage />', () => {
  it('renders the headline and one-line explanation of what Family Hub is', () => {
    renderPage();
    expect(
      screen.getByRole('heading', { name: /one home for your family.s week/i }),
    ).toBeInTheDocument();
    expect(screen.getByTestId('about-page')).toHaveTextContent(
      /Family Hub is the one shared place/i,
    );
  });

  it('lists the main things you can do (calendar, tasks, meals, kids’ rewards)', () => {
    renderPage();
    expect(screen.getByText('A shared calendar')).toBeInTheDocument();
    expect(screen.getByText('Tasks and habits that stick')).toBeInTheDocument();
    expect(screen.getByText('Meal planning')).toBeInTheDocument();
    expect(screen.getByText("Kids' rewards and learning")).toBeInTheDocument();
  });

  it('explains who it is for and the kid experience + safety', () => {
    renderPage();
    expect(screen.getByRole('heading', { name: 'Who it’s for' })).toBeInTheDocument();
    expect(
      screen.getByRole('heading', { name: /kid experience, and how we keep it safe/i }),
    ).toBeInTheDocument();
    expect(screen.getByTestId('about-page')).toHaveTextContent(/school-age kids/i);
    expect(screen.getByTestId('about-page')).toHaveTextContent(/never signs up on their own/i);
  });

  it('has Start free CTAs (header + hero) and working links to the Privacy Policy', () => {
    renderPage();
    const startFreeButtons = screen.getAllByRole('button', { name: /start free/i });
    expect(startFreeButtons.length).toBeGreaterThan(0);
    const privacyLinks = screen.getAllByRole('link', { name: 'Privacy Policy' });
    expect(privacyLinks.length).toBeGreaterThan(0);
    privacyLinks.forEach((link) => expect(link).toHaveAttribute('href', '/privacy'));
  });

  // FHS-546: About now uses the shared SiteHeader + SiteFooter (like the
  // homepage + legal pages): Legal in the header nav, the full legal footer,
  // and the FamilyHub logo linking home.
  it('uses the shared site chrome (home link, Legal in the header, full legal footer)', () => {
    renderPage();
    expect(screen.getByRole('link', { name: 'FamilyHub' })).toHaveAttribute('href', '/');
    // FHS-561 + FHS-572: the header names it "Legal" and the footer renders
    // a phone nav and a desktop nav, so several match. All go to the index.
    const legalLinks = screen.getAllByRole('link', { name: /^legal$/i });
    expect(legalLinks.length).toBeGreaterThan(0);
    for (const link of legalLinks) expect(link).toHaveAttribute('href', '/legal');
    for (const l of screen.getAllByRole('link', { name: /^privacy$/i }))
      expect(l).toHaveAttribute('href', '/legal/privacy');
    for (const l of screen.getAllByRole('link', { name: /children & parents/i }))
      expect(l).toHaveAttribute('href', '/legal/children');
    for (const l of screen.getAllByRole('link', { name: /^terms$/i }))
      expect(l).toHaveAttribute('href', '/legal/terms');
    for (const l of screen.getAllByRole('link', { name: /^cookies$/i }))
      expect(l).toHaveAttribute('href', '/legal/cookies');
    // FHS-561: the footer index link is named "Legal" too, asserted above.
  });
});
