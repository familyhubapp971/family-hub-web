import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter, Navigate, Route, Routes } from 'react-router-dom';
import { TermsOfServicePage } from '../../../../../src/public-pages/legal/TermsOfServicePage';
import { LEGACY_REDIRECTS } from '../../../../../src/app/legacy-redirects';

// FHR-22: the sign-up page linked to /terms, which never existed, so the
// "Terms" link opened a blank page. App.tsx builds its redirects from
// LEGACY_REDIRECTS, so this test reads the same list the real app uses.

describe('/terms redirect', () => {
  it('is in the list of redirects the app builds', () => {
    expect(LEGACY_REDIRECTS).toContainEqual(['/terms', '/legal/terms']);
  });

  it('forwards a visitor from /terms to the Terms of Service', () => {
    render(
      <MemoryRouter initialEntries={['/terms']}>
        <Routes>
          <Route path="/legal/terms" element={<TermsOfServicePage />} />
          {LEGACY_REDIRECTS.map(([from, to]) => (
            <Route key={from} path={from} element={<Navigate to={to} replace />} />
          ))}
        </Routes>
      </MemoryRouter>,
    );
    expect(screen.getByRole('heading', { name: 'Terms of Service', level: 1 })).toBeInTheDocument();
  });
});
