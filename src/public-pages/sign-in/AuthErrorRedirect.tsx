import { useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';

// FHS-712: when our sign-in server no longer knows where someone came from
// (a Google sign-in left open over 5 minutes), it sends them to the website's
// home page with the error in the address. The home page ignores it, so the
// person is lost. Any page that arrives with a sign-in error goes to the
// sign-in return page instead, which explains what happened.

/** True when the address carries an error from the sign-in server. */
export function hasSignInError(search: string, hash: string): boolean {
  return [new URLSearchParams(search), new URLSearchParams(hash.replace(/^#/, ''))].some(
    (params) =>
      params.has('error_description') && (params.has('error') || params.has('error_code')),
  );
}

export function AuthErrorRedirect() {
  const { pathname, search, hash } = useLocation();
  const navigate = useNavigate();
  useEffect(() => {
    if (pathname === '/auth/callback' || !hasSignInError(search, hash)) return;
    navigate(`/auth/callback${search}${hash}`, { replace: true });
  }, [pathname, search, hash, navigate]);
  return null;
}
