import type { ReactElement } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { getKidToken, useAuth } from '../lib/auth-context';
import { LoadingScreen } from './LoadingScreen';

// Gate around an authenticated subtree. Renders a small loading state
// while the AuthProvider rehydrates the session from localStorage so
// signed-in users don't see a redirect-to-login flash on hard reload.
//
// FHS-257: `allowKid` lets the dashboard route admit a child who is
// signed in with a kid JWT (no Supabase parent session). Without it a
// kid would be bounced to /login the moment they finish kid-login.
export function ProtectedRoute({
  children,
  allowKid = false,
}: {
  children: ReactElement;
  allowKid?: boolean;
}) {
  const { session, loading } = useAuth();
  const location = useLocation();

  if (loading) {
    return <LoadingScreen context="protected" />;
  }

  if (!session && !(allowKid && getKidToken())) {
    return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  }

  // FHS-434: the feedback widget lives on the public homepage only; it was
  // obscuring content on every in-app screen, so it's no longer mounted here.
  return children;
}
