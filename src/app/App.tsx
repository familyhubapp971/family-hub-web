import { Suspense, lazy } from 'react';
import { LEGACY_REDIRECTS } from './legacy-redirects';
import { BrowserRouter, Navigate, Routes, Route, useParams } from 'react-router-dom';
import { AuthProvider } from './lib/auth-context';
import { TenantProvider } from './lib/tenant-context';
import { ProtectedRoute } from './components/ProtectedRoute';
import { LoadingScreen } from './components/LoadingScreen';
import { LandingPage } from '../public-pages/home/LandingPage';
import { WelcomePage } from '../public-pages/home/WelcomePage';
import { PricingPage } from '../public-pages/home/PricingPage';
import { AboutPage } from '../public-pages/home/AboutPage';
import { LoginPage } from '../public-pages/sign-in/LoginPage';
import { SignupPage } from '../public-pages/sign-in/SignupPage';
import { VerifyEmailPage } from '../public-pages/sign-in/VerifyEmailPage';
import { AuthCallbackPage } from '../public-pages/sign-in/AuthCallbackPage';

// FHS-560: the whole app used to ship as one ~1.9MB bundle, so a first-time
// visitor downloaded and parsed every signed-in screen (Recharts, Leaflet,
// D3, the Learn modules) just to read the landing page. Marketing and the
// entry auth pages stay eager because they ARE the first paint; everything
// behind them loads on demand.
const LegalIndexPage = lazy(() =>
  import('../public-pages/legal/LegalIndexPage').then((m) => ({ default: m.LegalIndexPage })),
);
const PrivacyPolicyPage = lazy(() =>
  import('../public-pages/legal/PrivacyPolicyPage').then((m) => ({ default: m.PrivacyPolicyPage })),
);
const ChildrenPrivacyPage = lazy(() =>
  import('../public-pages/legal/ChildrenPrivacyPage').then((m) => ({
    default: m.ChildrenPrivacyPage,
  })),
);
const TermsOfServicePage = lazy(() =>
  import('../public-pages/legal/TermsOfServicePage').then((m) => ({
    default: m.TermsOfServicePage,
  })),
);
const CookiesPage = lazy(() =>
  import('../public-pages/legal/CookiesPage').then((m) => ({ default: m.CookiesPage })),
);
// FHS-672: the founder's feedback page, behind a passcode.
const FounderFeedbackPage = lazy(() =>
  import('../areas/founder/FounderFeedbackPage').then((m) => ({ default: m.FounderFeedbackPage })),
);
const DashboardPage = lazy(() =>
  import('./layout/DashboardPage').then((m) => ({ default: m.DashboardPage })),
);
const ChildWorldPage = lazy(() =>
  import('../areas/kids/ChildWorldPage').then((m) => ({ default: m.ChildWorldPage })),
);
// FHS-621: the Admin Panel's two halves, each its own page.
const KidsMoneyPage = lazy(() =>
  import('../areas/money/KidsMoneyPage').then((m) => ({ default: m.KidsMoneyPage })),
);
const FamilySettingsPage = lazy(() =>
  import('../areas/settings/FamilySettingsPage').then((m) => ({ default: m.FamilySettingsPage })),
);
const MembersPage = lazy(() =>
  import('../areas/members/MembersPage').then((m) => ({ default: m.MembersPage })),
);
const MePage = lazy(() => import('../areas/members/MePage').then((m) => ({ default: m.MePage })));
const OnboardingPage = lazy(() =>
  import('../areas/onboarding/OnboardingPage').then((m) => ({ default: m.OnboardingPage })),
);
const RewardSettingsPage = lazy(() =>
  import('../areas/settings/RewardSettingsPage').then((m) => ({ default: m.RewardSettingsPage })),
);
const LegacyDashboardRedirect = lazy(() =>
  import('./redirects/LegacyDashboardRedirect').then((m) => ({
    default: m.LegacyDashboardRedirect,
  })),
);
const KidLoginPage = lazy(() =>
  import('../public-pages/sign-in/KidLoginPage').then((m) => ({ default: m.KidLoginPage })),
);
const ConfirmEmailPage = lazy(() =>
  import('../public-pages/sign-in/ConfirmEmailPage').then((m) => ({ default: m.ConfirmEmailPage })),
);

// Top-level routing. AuthProvider wraps every route so useAuth() is
// available everywhere, including the OAuth callback page that needs
// to react to the session flip mid-render.
//
// FHS-249: tenant-scoped pages live under `/t/:slug/*` (per ADR 0012).
// Marketing + auth routes stay at the root. Legacy `/dashboard` and
// `/me` redirect into the tenant-scoped tree once the user's tenant is
// known (the AuthCallbackPage figures it out post-login).
// FHS-621: an old /admin link lands on the money page rather than nothing.
function AdminRedirect() {
  const { slug } = useParams();
  return <Navigate to={`/t/${slug}/money`} replace />;
}

export function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Suspense fallback={<LoadingScreen />}>
          <Routes>
            {/* Marketing + auth: no tenant context. */}
            <Route path="/" element={<WelcomePage />} />
            <Route path="/pricing" element={<PricingPage />} />
            {/* FHS-672: founder feedback page; the passcode is checked by the api. */}
            <Route path="/admin" element={<FounderFeedbackPage />} />
            {/* FHS-436: public "what is Family Hub" page for beta reviewers
              and first-time visitors. */}
            <Route path="/about" element={<AboutPage />} />
            {/* FHS-509: Legal pages (Privacy, Children & Parents, Terms,
              Cookies) + an index. */}
            <Route path="/legal" element={<LegalIndexPage />} />
            <Route path="/legal/privacy" element={<PrivacyPolicyPage />} />
            <Route path="/legal/children" element={<ChildrenPrivacyPage />} />
            <Route path="/legal/terms" element={<TermsOfServicePage />} />
            <Route path="/legal/cookies" element={<CookiesPage />} />
            {/* FHS-435's public draft privacy policy page moved under /legal
              (FHS-509). Redirect so the signup consent link + the other
              pages still linking to /privacy (AdminPanelPage, SignupPage,
              AboutPage, PricingPage, WelcomePage) keep working. */}
            {LEGACY_REDIRECTS.map(([from, to]) => (
              <Route key={from} path={from} element={<Navigate to={to} replace />} />
            ))}
            {/* Legacy /api/hello debug card preserved at /_health so the
              FHS-198 staging-deploy spec keeps validating end-to-end. */}
            <Route path="/_health" element={<LandingPage />} />
            <Route path="/login" element={<LoginPage />} />
            <Route path="/signup" element={<SignupPage />} />
            {/* FHS-224 / ADR 0011: passwords retired. The old reset-password
              entry point now redirects into the magic-link flow so any
              bookmarked link still works. */}
            <Route path="/auth/reset-request" element={<Navigate to="/login" replace />} />
            <Route path="/auth/callback" element={<AuthCallbackPage />} />
            <Route path="/verify-email" element={<VerifyEmailPage />} />
            {/* FHS-510: admin-initiated email-change confirm link. Root-level
              and outside ProtectedRoute: the recipient may not be signed in
              at all, the one-time token in the query string is the
              credential, verified server-side. */}
            <Route path="/confirm-email/:memberId" element={<ConfirmEmailPage />} />

            {/* FHS-238: kid login. Tenant-scoped (slug in URL) but NOT
              behind ProtectedRoute: the kid hasn't authenticated yet,
              that's the whole point. The page reads :slug via useParams
              directly so it can resolve the family + show the avatar
              grid. After successful PIN entry the kid lands on
              /t/:slug/dashboard like any other authenticated user. */}
            <Route path="/t/:slug/kid-login" element={<KidLoginPage />} />

            {/* Tenant-scoped pages. The TenantProvider reads :slug from
              the URL and exposes it to descendants via useTenantSlug(). */}
            <Route
              path="/t/:slug/onboarding"
              element={
                <ProtectedRoute>
                  <TenantProvider>
                    <OnboardingPage />
                  </TenantProvider>
                </ProtectedRoute>
              }
            />
            <Route
              path="/t/:slug/dashboard"
              element={
                <ProtectedRoute allowKid>
                  <TenantProvider>
                    <DashboardPage />
                  </TenantProvider>
                </ProtectedRoute>
              }
            />
            <Route
              path="/t/:slug/members"
              element={
                <ProtectedRoute>
                  <TenantProvider>
                    <MembersPage />
                  </TenantProvider>
                </ProtectedRoute>
              }
            />
            <Route
              path="/t/:slug/me"
              element={
                <ProtectedRoute>
                  <TenantProvider>
                    <MePage />
                  </TenantProvider>
                </ProtectedRoute>
              }
            />
            {/* FHS-621: the Admin Panel split into pages named after the job
                they do. One door each, no tab to guess at. */}
            <Route
              path="/t/:slug/money"
              element={
                <ProtectedRoute>
                  <TenantProvider>
                    <KidsMoneyPage />
                  </TenantProvider>
                </ProtectedRoute>
              }
            />
            <Route
              path="/t/:slug/family-settings"
              element={
                <ProtectedRoute>
                  <TenantProvider>
                    <FamilySettingsPage />
                  </TenantProvider>
                </ProtectedRoute>
              }
            />
            {/* The old combined panel. Kept as a redirect so saved links and
                bookmarks still land somewhere sensible (FHS-621). */}
            <Route path="/t/:slug/admin" element={<AdminRedirect />} />
            {/* FHS-512: "Pocket money" reward-config settings screen. */}
            <Route
              path="/t/:slug/reward-settings"
              element={
                <ProtectedRoute>
                  <TenantProvider>
                    <RewardSettingsPage />
                  </TenantProvider>
                </ProtectedRoute>
              }
            />
            {/* FHS-268: ChildWorld: a parent views a child's world. */}
            <Route
              path="/t/:slug/child/:memberId"
              element={
                <ProtectedRoute>
                  <TenantProvider>
                    <ChildWorldPage />
                  </TenantProvider>
                </ProtectedRoute>
              }
            />

            {/* Legacy un-prefixed routes: kept as-is for now so existing
              deep links don't 404. Cleanup tracked under FHS-205.
              `/dashboard` resolves the user's first tenant via /api/me
              and forwards to /t/<slug>/dashboard so the new tenant-
              scoped DashboardPage (which requires TenantProvider) keeps
              working from older bookmarks + the OAuth callback. */}
            <Route
              path="/dashboard"
              element={
                <ProtectedRoute>
                  <LegacyDashboardRedirect />
                </ProtectedRoute>
              }
            />
            <Route
              path="/me"
              element={
                <ProtectedRoute>
                  <MePage />
                </ProtectedRoute>
              }
            />
          </Routes>
        </Suspense>
      </AuthProvider>
    </BrowserRouter>
  );
}
