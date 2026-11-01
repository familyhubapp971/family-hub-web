import { useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Check } from 'lucide-react';
import { z } from 'zod';
import { Button, Input } from '@familyhub/ui';
import { supabase } from '../../app/lib/supabase';
import { friendlyAuthErrorMessage } from '../../app/lib/auth-errors';
import { rememberAuthEmail, authCallbackUrl } from '../../app/lib/auth-email';

// SignupPage: auth-first onboarding. The signup form collects only
// the email address (or kicks off Google OAuth); family name + slug
// are captured post-auth on the `CreateFamilyPanel` rendered by
// `LegacyDashboardRedirect` when a freshly-authenticated user has no
// tenant yet. Single source of truth for family details, no
// sessionStorage intent dance, and the magic-link click survives
// being opened in a different tab/browser/device.

// Brand-faithful Google "G" mark. Inlined SVG so we don't pull a
// brand-icon dependency for one logo.
function GoogleLogo() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true">
      <path
        fill="#4285F4"
        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
      />
      <path
        fill="#34A853"
        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
      />
      <path
        fill="#FBBC05"
        d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
      />
      <path
        fill="#EA4335"
        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
      />
    </svg>
  );
}

const signupSchema = z.object({
  email: z.string().email('enter a valid email'),
});

type Status =
  | { kind: 'idle' }
  | { kind: 'error'; message: string }
  | { kind: 'submitting' }
  | { kind: 'submitting-google' };

export function SignupPage() {
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [status, setStatus] = useState<Status>({ kind: 'idle' });

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const parsed = signupSchema.safeParse({ email });
    if (!parsed.success) {
      setStatus({ kind: 'error', message: parsed.error.issues[0]?.message ?? 'invalid input' });
      return;
    }
    setStatus({ kind: 'submitting' });
    const { error } = await supabase.auth.signInWithOtp({
      email: parsed.data.email,
      options: { emailRedirectTo: authCallbackUrl(parsed.data.email) },
    });
    if (error) {
      setStatus({ kind: 'error', message: friendlyAuthErrorMessage(error.message) });
      return;
    }
    // Stash the email so /verify-email can render "Check your inbox at <email>".
    sessionStorage.setItem('fh.signup.email', parsed.data.email);
    rememberAuthEmail(parsed.data.email);
    sessionStorage.setItem('fh.auth.origin', '/signup');
    navigate('/verify-email');
  }

  async function onGoogle() {
    setStatus({ kind: 'submitting-google' });
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: `${window.location.origin}/auth/callback` },
    });
    if (error) {
      setStatus({ kind: 'error', message: friendlyAuthErrorMessage(error.message) });
    }
    // signInWithOAuth navigates the browser away on success: no
    // post-call handling needed.
  }

  const submitting = status.kind === 'submitting' || status.kind === 'submitting-google';

  return (
    <div className="flex min-h-screen flex-col bg-kingdom-bg font-body md:flex-row md:bg-white">
      {/* Left panel: social proof. Hidden on mobile to save vertical space. */}
      <aside className="relative hidden flex-col justify-center bg-kingdom-bg p-12 text-white md:flex md:w-1/2 lg:p-16">
        <Link
          to="/"
          className="absolute left-12 top-8 font-heading text-2xl text-white transition-opacity hover:opacity-90 lg:left-16"
        >
          FamilyHub
        </Link>
        <h1 className="mb-10 font-heading text-4xl leading-tight text-yellow-300 lg:text-5xl">
          Join 2,400+ families already coordinated.
        </h1>
        <blockquote className="mb-10 text-xl font-bold text-purple-100 lg:text-2xl">
          &ldquo;I cancelled four subscriptions on day three.&rdquo;
          <footer className="mt-3 text-base font-normal text-purple-300">(Fatima A., Dubai)</footer>
        </blockquote>
        <ul className="space-y-4 text-lg font-bold">
          <li className="flex items-center gap-3">
            <Check className="text-green-400" size={24} aria-hidden="true" /> 14-day free trial
          </li>
          <li className="flex items-center gap-3">
            <Check className="text-green-400" size={24} aria-hidden="true" /> No credit card needed
          </li>
          <li className="flex items-center gap-3">
            <Check className="text-green-400" size={24} aria-hidden="true" /> Cancel any time
          </li>
        </ul>
      </aside>

      {/* Right panel: form. Full-width on mobile, half on md+. */}
      <main className="flex w-full flex-col justify-center bg-white p-6 text-black md:w-1/2 md:p-12 lg:p-16">
        <div className="mx-auto w-full max-w-md">
          <Link
            to="/"
            className="mb-6 inline-block font-heading text-2xl text-kingdom-bg transition-opacity hover:opacity-90 md:hidden"
          >
            FamilyHub
          </Link>
          <h2 className="mb-2 font-heading text-3xl">Get started</h2>
          <p className="mb-6 font-bold text-gray-600">
            We&rsquo;ll email you a one-time link to sign in. No password to remember. You&rsquo;ll
            name your family hub in the next step.
          </p>

          <form onSubmit={onSubmit} className="space-y-5" data-testid="signup-form" noValidate>
            <div>
              <label
                htmlFor="email"
                className="mb-2 block text-xs font-bold uppercase tracking-wider"
              >
                Email
              </label>
              <Input
                id="email"
                name="email"
                type="email"
                autoComplete="email"
                variant="dark"
                required
                value={email}
                onChange={(e) => {
                  setEmail(e.target.value);
                  // FHS-258 lineage: clear inline error as the user keeps typing.
                  setStatus((s) => (s.kind === 'error' ? { kind: 'idle' } : s));
                }}
                placeholder="sarah@example.com"
                testId="signup-email"
              />
            </div>

            {status.kind === 'error' && (
              <p className="text-sm font-bold text-red-600" data-testid="signup-error" role="alert">
                {status.message}
              </p>
            )}

            <Button
              type="submit"
              variant="primary"
              size="lg"
              fullWidth
              disabled={submitting}
              testId="signup-submit"
            >
              {status.kind === 'submitting' ? 'Sending…' : 'Continue with email →'}
            </Button>

            <div className="relative my-4 flex items-center">
              <div className="flex-grow border-t-2 border-gray-200" />
              <span className="mx-3 text-xs font-bold uppercase tracking-wider text-gray-400">
                or
              </span>
              <div className="flex-grow border-t-2 border-gray-200" />
            </div>

            <Button
              type="button"
              variant="secondary"
              size="lg"
              fullWidth
              disabled={submitting}
              onClick={onGoogle}
              testId="signup-google"
            >
              <span className="flex items-center justify-center gap-2.5">
                <GoogleLogo />
                {status.kind === 'submitting-google' ? 'Redirecting…' : 'Continue with Google'}
              </span>
            </Button>

            <p className="text-center text-sm font-bold text-gray-500">
              By continuing you agree to our{' '}
              <Link to="/legal/terms" className="inline-block py-1.5 underline">
                Terms
              </Link>{' '}
              and{' '}
              <Link to="/legal/privacy" className="inline-block py-1.5 underline">
                Privacy Policy
              </Link>
              .
            </p>

            <p className="text-center text-sm font-bold text-gray-700">
              Already have an account?{' '}
              <Link to="/login" className="inline-block py-1.5 font-semibold underline">
                Log in
              </Link>
            </p>
          </form>
        </div>
      </main>
    </div>
  );
}
