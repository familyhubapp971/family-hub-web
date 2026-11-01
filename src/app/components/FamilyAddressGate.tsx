import { useEffect, useState } from 'react';
import { Navigate, Outlet, useLocation, useParams } from 'react-router-dom';
import { useAuth } from '../lib/auth-context';
import { API_BASE } from '../lib/api';
import { isFamilyCode, swapFamilyInPath } from '../lib/family-address';
import { fetchFamilyCodes, knownFamilyCodes } from '../lib/my-families';
import { FamilyNotFound } from './FamilyNotFound';
import { LoadingScreen } from './LoadingScreen';

// FHS-715: every page under /t/:slug passes through here first.
//
// A family's address used to carry its surname (/t/smith/...). It is now the
// family's private code (/t/e29b-41d4/...). An old address still works for the
// people in that family: we ask the server which family used it and, if it is
// theirs, open the same page at the new code.
//
// A kid page with an old surname goes to the step where kids type their
// family code, rather than showing faces for a name anyone could guess.
//
// FHS-718: a signed-in grown-up only gets a family's pages if it is one of
// their families. A wrong code, someone else's code, or an old surname that
// is not theirs shows one plain "We can't find that family." screen, the same
// for all three, instead of a page that half loads and shows a server error.
// Kid pages and kid sign-ins are left exactly as they were.

type Lookup = {
  key: string;
  newSlug: string | null;
  // The check itself failed (no signal, server down), so we know nothing.
  failed: boolean;
  myFamilies: string[] | null;
};

type FamilyCheck = { key: string; myFamilies: string[] | null };

export function FamilyAddressGate() {
  const { slug = '' } = useParams<{ slug: string }>();
  const location = useLocation();
  const { session, loading } = useAuth();
  const [lookup, setLookup] = useState<Lookup | null>(null);
  const [check, setCheck] = useState<FamilyCheck | null>(null);

  const lower = slug.toLowerCase();
  const isCode = isFamilyCode(lower);
  const isKidPage = /^\/t\/[^/]+\/kid-login\/?$/.test(location.pathname);
  const token = session?.access_token;
  const userId = session?.user?.id;
  const canCheck = !loading && !!token && !!userId && !isKidPage;
  // Keyed by person as well as address, so a different sign-in checks again.
  const key = `${userId ?? ''}:${lower}`;
  const known = userId ? knownFamilyCodes(userId) : null;

  const needsCheck =
    canCheck && isCode && slug === lower && !known?.includes(lower) && check?.key !== key;
  const needsLookup = canCheck && !isCode && lookup?.key !== key;

  useEffect(() => {
    if (!needsCheck || !userId || !token) return;
    let cancelled = false;
    void fetchFamilyCodes(userId, token).then((myFamilies) => {
      if (!cancelled) setCheck({ key, myFamilies });
    });
    return () => {
      cancelled = true;
    };
  }, [needsCheck, key, userId, token]);

  useEffect(() => {
    if (!needsLookup || !userId || !token) return;
    let cancelled = false;
    const address = fetch(`${API_BASE}/api/family-address/${encodeURIComponent(lower)}`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then(async (res) => {
        // 404 is the server's answer for "not an old address of yours".
        if (res.status === 404) return { newSlug: null, failed: false };
        if (!res.ok) return { newSlug: null, failed: true };
        const body = (await res.json()) as { slug?: unknown };
        const newSlug =
          typeof body?.slug === 'string' && isFamilyCode(body.slug) ? body.slug : null;
        return { newSlug, failed: false };
      })
      .catch(() => ({ newSlug: null, failed: true }));
    // Asked at the same time, so the "can't find" button knows where home is
    // and the forwarded page opens without a second wait.
    const cached = knownFamilyCodes(userId);
    const myFamilies = cached ? Promise.resolve(cached) : fetchFamilyCodes(userId, token);
    void Promise.all([address, myFamilies]).then(([found, families]) => {
      if (!cancelled) setLookup({ key, ...found, myFamilies: families });
    });
    return () => {
      cancelled = true;
    };
  }, [needsLookup, key, lower, userId, token]);

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
  if (isCode && slug !== lower) return goTo(lower);
  if (isKidPage) return isCode ? <Outlet /> : <Navigate to="/login?role=kid" replace />;
  if (loading) return <LoadingScreen context="protected" />;
  // Not signed in, or a kid: the page's own sign-in or not-found handles it.
  if (!token || !userId) return <Outlet />;

  if (isCode) {
    if (known?.includes(lower)) return <Outlet />;
    if (check?.key !== key) return <LoadingScreen context="protected" />;
    // A failed check never blocks the page: it opens as it always did.
    if (check.myFamilies === null || check.myFamilies.includes(lower)) return <Outlet />;
    return <FamilyNotFound myFamilies={check.myFamilies} />;
  }

  if (lookup?.key !== key) return <LoadingScreen context="redirect" />;
  if (lookup.newSlug) return goTo(lookup.newSlug);
  if (lookup.failed) return <Outlet />;
  return <FamilyNotFound myFamilies={lookup.myFamilies} />;
}
