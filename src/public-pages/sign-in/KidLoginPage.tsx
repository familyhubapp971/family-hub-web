import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { AuthLayout } from './AuthLayout';
import { KidSignIn } from './KidSignIn';

// FHS-238 / FHS-360: kid-side login at /t/:slug/kid-login. The slug is in the
// URL (no auth context, the kid hasn't logged in yet). The avatar-tiles + PIN
// flow lives in the shared KidSignIn component so this route and the unified
// /login "I'm a Kid" view render identically (Magic Patterns "Welcome Back" card).
export function KidLoginPage() {
  const { slug } = useParams<{ slug: string }>();
  const [familyName, setFamilyName] = useState<string | null>(null);

  // A kid who hit a wrong/broken family link should get back to the kid tab to
  // re-enter the code, not be dropped on the parent form.
  const tryAnotherCode = (
    <p className="mt-3 font-body text-sm text-gray-700">
      Typed the wrong code?{' '}
      <Link
        to="/login?role=kid"
        className="font-semibold underline"
        data-testid="kid-login-try-another"
      >
        Enter a different family code
      </Link>
      .
    </p>
  );

  return (
    <AuthLayout title="Welcome Back!" subtitle={familyName ?? 'Sign in to Family Hub'} centered>
      <KidSignIn slug={slug} onFamilyLoaded={setFamilyName} notFoundFooter={tryAnotherCode} />
      <p className="mt-6 text-center font-body text-sm text-gray-700">
        Are you a grown-up?{' '}
        <Link to="/login" className="font-semibold underline" data-testid="kid-login-to-parent">
          Switch to parent log-in
        </Link>
        .
      </p>
    </AuthLayout>
  );
}
