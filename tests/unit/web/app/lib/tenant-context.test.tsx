import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import {
  TenantProvider,
  useTenantSlug,
  useOptionalTenantSlug,
} from '../../../../../src/app/lib/tenant-context';

// FHS-249: TenantProvider reads :slug from the URL and exposes it via
// useTenantSlug() to descendants. Throws when consumed outside the
// provider so the "I forgot to wrap my route" mistake is loud.

function ShowSlug() {
  return <div data-testid="slug-readout">{useTenantSlug()}</div>;
}

function ShowOptional() {
  const slug = useOptionalTenantSlug();
  return <div data-testid="opt-slug">{slug ?? '<none>'}</div>;
}

describe('FHS-249: tenant context', () => {
  it('useTenantSlug returns the :slug param from /t/:slug/* routes', () => {
    render(
      <MemoryRouter initialEntries={['/t/khans/dashboard']}>
        <Routes>
          <Route
            path="/t/:slug/dashboard"
            element={
              <TenantProvider>
                <ShowSlug />
              </TenantProvider>
            }
          />
        </Routes>
      </MemoryRouter>,
    );
    expect(screen.getByTestId('slug-readout').textContent).toBe('khans');
  });

  it('useTenantSlug throws when used outside a TenantProvider', () => {
    // Suppress the React error-boundary console noise during this assertion.
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    expect(() =>
      render(
        <MemoryRouter>
          <ShowSlug />
        </MemoryRouter>,
      ),
    ).toThrow(/useTenantSlug\(\) called outside <TenantProvider>/);
    spy.mockRestore();
  });

  it('useOptionalTenantSlug returns undefined outside a provider', () => {
    render(
      <MemoryRouter>
        <ShowOptional />
      </MemoryRouter>,
    );
    expect(screen.getByTestId('opt-slug').textContent).toBe('<none>');
  });
});
