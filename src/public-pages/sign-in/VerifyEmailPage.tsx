import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { Mail } from 'lucide-react';
import { z } from 'zod';
import { Button, Card } from '@familyhub/ui';
import { supabase } from '../../app/lib/supabase';
import { authCallbackUrl } from '../../app/lib/auth-email';
import { webmailFor } from '../../app/lib/webmail';

// Validate the email source BEFORE we render it or hand it to Supabase.
// Without this, a crafted /verify-email?email=<garbage> request would
// trigger an OTP send to an arbitrary recipient and let an attacker
// burn our sender reputation. Same Zod check the Signup form uses.
const emailSchema = z.string().email();

// sessionStorage key for the resend cooldown deadline (epoch ms). Must
// outlive component unmount so a user can't defeat the 60s rate-limit
// by navigating away and back.
const RESEND_DEADLINE_KEY = 'fh.signup.resendDeadline';

// FHS-223: Post-signup confirmation page. Replaces the inline success
// state SignupPage used to render. Visual ports MP design at
// kudjspxd3xxroueg5jw11o pages/VerifyEmail.tsx: yellow icon disc +
// neo-brutalist white card on kingdom-purple background.
//
// Pending email comes from one of two sources, in priority order:
//   1. ?email=<addr> query param (so support / re-sent links work)
//   2. sessionStorage `fh.signup.email` (set by SignupPage at submit time)
// If neither is present we render the generic copy and disable Resend.

const RESEND_COOLDOWN_S = 60;

type ResendState =
  | { kind: 'idle' }
  | { kind: 'sending' }
  | { kind: 'cooldown'; secondsLeft: number }
  | { kind: 'error'; message: string };

export function VerifyEmailPage() {
  const [params] = useSearchParams();
  const [email, setEmail] = useState<string | null>(null);
  const [resend, setResend] = useState<ResendState>({ kind: 'idle' });

  // FHS-563: this page is reached from both the login and the signup flow.
  // "Or go back" used to always point at /signup, so a parent who came from
  // the login page was sent to create-a-family instead of back to log in.
  // Whichever flow sent them here records it; a direct visit falls back to
  // signup, which is where a stranger most likely wants to go.
  const [backTo] = useState<string>(() => {
    const origin =
      typeof sessionStorage !== 'undefined' && sessionStorage.getItem('fh.auth.origin');
    return origin === '/login' ? '/login' : '/signup';
  });

  useEffect(() => {
    const candidate = params.get('email') ?? sessionStorage.getItem('fh.signup.email');
    if (!candidate) {
      setEmail(null);
      return;
    }
    // Reject anything that doesn't parse as a valid email: render
    // generic copy and disable Resend rather than displaying garbage
    // or triggering an OTP send to a malformed address.
    setEmail(emailSchema.safeParse(candidate).success ? candidate : null);
  }, [params]);

  // Rehydrate the cooldown from sessionStorage on mount so it survives
  // navigation. Without this a user could defeat the rate-limit by
  // clicking Resend → back → forward and re-clicking.
  useEffect(() => {
    const raw = sessionStorage.getItem(RESEND_DEADLINE_KEY);
    if (!raw) return;
    const deadline = Number(raw);
    if (!Number.isFinite(deadline)) return;
    const secondsLeft = Math.ceil((deadline - Date.now()) / 1000);
    if (secondsLeft > 0) setResend({ kind: 'cooldown', secondsLeft });
    else sessionStorage.removeItem(RESEND_DEADLINE_KEY);
  }, []);

  // Drive the cooldown timer. Decrement once per second; flip back to
  // idle when it hits zero so the button re-enables.
  useEffect(() => {
    if (resend.kind !== 'cooldown') return;
    if (resend.secondsLeft <= 0) {
      sessionStorage.removeItem(RESEND_DEADLINE_KEY);
      setResend({ kind: 'idle' });
      return;
    }
    const t = window.setTimeout(
      () => setResend({ kind: 'cooldown', secondsLeft: resend.secondsLeft - 1 }),
      1000,
    );
    return () => window.clearTimeout(t);
  }, [resend]);

  async function onResend() {
    if (!email) return;
    setResend({ kind: 'sending' });
    // Magic-link "resend" = re-issue a fresh OTP via signInWithOtp.
    // Supabase has a `auth.resend()` helper but it's wired for the
    // password-confirmation flow: for our magic-link-only setup
    // (ADR 0011) signInWithOtp is the correct path.
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: { emailRedirectTo: authCallbackUrl(email) },
    });
    if (error) {
      setResend({ kind: 'error', message: error.message });
      return;
    }
    sessionStorage.setItem(RESEND_DEADLINE_KEY, String(Date.now() + RESEND_COOLDOWN_S * 1000));
    setResend({ kind: 'cooldown', secondsLeft: RESEND_COOLDOWN_S });
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-kingdom-bg p-6 font-body">
      <Card className="flex w-full max-w-md flex-col items-center bg-white p-8 text-center md:p-12">
        <div
          className="mb-6 flex h-16 w-16 items-center justify-center rounded-full border-2 border-black bg-yellow-100 shadow-neo-sm"
          aria-hidden="true"
        >
          <Mail className="text-black" size={32} />
        </div>

        <h1 className="mb-4 font-heading text-3xl">Check your email!</h1>

        <p className="mb-8 font-bold text-gray-600">
          {email ? (
            <>
              We sent a magic link to{' '}
              <span className="break-all text-black" data-testid="verify-email-address">
                {email}
              </span>
              . Click the link to sign in. No password needed.
            </>
          ) : (
            <>
              We&rsquo;ve sent you a magic link. Open the email and click the link to sign in. No
              password needed.
            </>
          )}
        </p>

        {(() => {
          // Pick the webmail label + URL from the email's domain. Unknown
          // / workplace domains return url=null → we hide the button
          // entirely rather than ship a wrong link (the original "Open
          // Gmail" hard-coded URL was the bug an Outlook user hit).
          const mailbox = webmailFor(email);
          if (!mailbox.url) return null;
          return (
            <a
              href={mailbox.url}
              target="_blank"
              rel="noopener noreferrer"
              className="mb-6 w-full"
              data-testid="verify-email-open-mailbox"
            >
              <Button variant="primary" size="lg" fullWidth>
                {mailbox.label}
              </Button>
            </a>
          );
        })()}

        <div className="flex flex-col items-center gap-3 text-sm font-bold">
          <button
            type="button"
            onClick={onResend}
            disabled={!email || resend.kind === 'sending' || resend.kind === 'cooldown'}
            className="inline-block py-3 px-3 text-gray-500 transition-colors hover:text-black disabled:cursor-not-allowed disabled:opacity-60"
            data-testid="verify-email-resend"
          >
            {resend.kind === 'sending'
              ? 'Resending…'
              : resend.kind === 'cooldown'
                ? `Resend in ${resend.secondsLeft}s`
                : "Didn't get it? Resend"}
          </button>

          {resend.kind === 'error' && (
            <p className="text-red-600" role="alert" data-testid="verify-email-resend-error">
              {resend.message}
            </p>
          )}

          <Link
            to={backTo}
            className="inline-block py-3 px-3 text-purple-600 transition-colors hover:text-purple-800"
            data-testid="verify-email-back"
          >
            Or go back
          </Link>
        </div>
      </Card>
    </div>
  );
}
