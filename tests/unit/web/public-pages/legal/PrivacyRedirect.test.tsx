import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter, Navigate, Route, Routes } from 'react-router-dom';
import { PrivacyPolicyPage } from '../../../../../src/public-pages/legal/PrivacyPolicyPage';

// FHS-509: the old FHS-435 draft-policy route (/privacy) now redirects
// to /legal/privacy, so the 5 existing <Link to="/privacy"> sites
// (AdminPanelPage, SignupPage, AboutPage x2, PricingPage, WelcomePage)
// keep working unchanged. Mirrors the /privacy + /legal/privacy subset
// of the real route table from App.tsx.

function renderAtPrivacy() {
  return render(
    <MemoryRouter initialEntries={['/privacy']}>
      <Routes>
        <Route path="/legal/privacy" element={<PrivacyPolicyPage />} />
        <Route path="/privacy" element={<Navigate to="/legal/privacy" replace />} />
      </Routes>
    </MemoryRouter>,
  );
}

describe('/privacy redirect', () => {
  it('forwards a visitor from /privacy to /legal/privacy', () => {
    renderAtPrivacy();
    expect(screen.getByRole('heading', { name: 'Privacy Policy', level: 1 })).toBeInTheDocument();
  });
});
