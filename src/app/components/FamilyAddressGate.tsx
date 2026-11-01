import { useEffect, useState } from 'react';
import { Navigate, Outlet, useLocation, useParams } from 'react-router-dom';
import { useAuth } from '../lib/auth-context';
import { API_BASE } from '../lib/api';
import { isFamilyCode, swapFamilyInPath } from '../lib/family-address';
import { LoadingScreen } from './LoadingScreen';

// FHS-715: every page under /t/:slug passes through here first.
//
// A family's address used to carry its surname (/t/smith/...). It is now the
// family's private code (/t/e29b-41d4/...). An old address still works for the
// people in that family: we ask the server which family used it and, if it is
// theirs, open the same page at the new code. Anyone else gets the page's
// usual "not found" or sign-in, so an old surname never reveals a family.
//
// A kid page with an old surname goes to the step where kids type their
// family code, rather than showing faces for a name anyone could guess.

type Lookup = { oldSlug: string; newSlug: string | null };

export function FamilyAddressGate() {
  const { slug = '' } = useParams<{ slug: string }>();
  const location = useLocation();
  const { session, loading } = useAuth();
  const [lookup, setLookup] = useState<Lookup | null>(null);

  const lower = slug.toLowerCase();
  const isOldAddress = !isFamilyCode(lower);
  const isKidPage = /^\/t\/[^/]+\/kid-login\/?$/.test(location.pathname);
  const token = session?.access_token;
  const needsLookup =
    isOldAddress && !isKidPage && !loading && !!token && lookup?.oldSlug !== lower;

  useEffect(() => {
    if (!needsLookup) return;
    let cancelled = false;
    fetch(`${API_BASE}/api/family-address/${encodeURIComponent(lower)}`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then(async (res) => {
        const body = res.ok ? ((await res.json()) as { slug?: unknown }) : null;
        const newSlug =
          typeof body?.slug === 'string' && isFamilyCode(body.slug) ? body.slug : null;
        if (!cancelled) setLookup({ oldSlug: lower, newSlug });
      })
      .catch(() => {
        if (!cancelled) setLookup({ oldSlug: lower, newSlug: null });
      });
    return () => {
      cancelled = true;
    };
  }, [needsLookup, lower, token]);

  const goTo = (code: string) => (
    <Navigate
      to={{
        pathname: swapFamilyInPath(location.pathname, code),
        search: location.search,
        hash: location.hash,
      }}
      replace
    />
  );

  // A code typed in capitals is still the code.
  if (!isOldAddress) return slug === lower ? <Outlet /> : goTo(lower);
  if (isKidPage) return <Navigate to="/login?role=kid" replace />;
  if (loading) return <LoadingScreen context="protected" />;
  // Not signed in (or a kid): the page's own sign-in or not-found handles it.
  if (!token) return <Outlet />;
  if (lookup?.oldSlug !== lower) return <LoadingScreen context="redirect" />;
  return lookup.newSlug ? goTo(lookup.newSlug) : <Outlet />;
}
