import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter, Routes, Route, useLocation } from 'react-router-dom';
import {
  AuthErrorRedirect,
  hasSignInError,
} from '../../../../../src/public-pages/sign-in/AuthErrorRedirect';

function Where() {
  const { pathname, search } = useLocation();
  return <div data-testid="where">{`${pathname}${search}`}</div>;
}

function renderAt(initial: string) {
  return render(
    <MemoryRouter initialEntries={[initial]}>
      <AuthErrorRedirect />
      <Routes>
        <Route path="*" element={<Where />} />
      </Routes>
    </MemoryRouter>,
  );
}

const timeout =
  'error=invalid_request&error_code=bad_oauth_state&error_description=OAuth+state+has+expired';

describe('FHS-712: a sign-in error that lands on any page', () => {
  it('goes to the sign-in return page, which explains it, instead of the home page', async () => {
    renderAt(`/?${timeout}`);
    expect(await screen.findByTestId('where')).toHaveTextContent(`/auth/callback?${timeout}`);
  });

  it('leaves ordinary pages alone', () => {
    renderAt('/pricing?plan=family');
    expect(screen.getByTestId('where')).toHaveTextContent('/pricing?plan=family');
  });

  it('reads the error from after the # too', () => {
    expect(hasSignInError('', `#${timeout}`)).toBe(true);
    expect(hasSignInError('?error=oops', '')).toBe(false);
  });
});
