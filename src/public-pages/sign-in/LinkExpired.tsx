import { useRef, useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { z } from 'zod';
import { Button, Card } from '@familyhub/ui';
import { supabase } from '../../app/lib/supabase';
import { friendlyAuthErrorMessage } from '../../app/lib/auth-errors';
import { rememberAuthEmail, authCallbackUrl } from '../../app/lib/auth-email';

// FHS-575: the screen for a sign-in link that no longer works.
//
// Forensic port of the Magic Patterns design (kudjspxd3xxroueg5jw11o,
// components/LinkExpired.tsx).
//
// It replaces borrowing the loading screen's stalled state, which told people
// "This is taking longer than usual." with a progress bar still creeping along
// while nothing was loading at all. The link is dead; the job is getting a new
// one, so the form to do that is on this screen rather than a bounce back to
// sign-in.
//
// A genuinely slow sign-in is NOT this screen. That stays on LoadingScreen,
// because it really is still waiting.

export type LinkReason = 'expired' | 'used' | 'invalid';

const REASONS: Record<LinkReason, { emoji: string; title: string; line: string }> = {
  expired: {
    emoji: '⏳',
    title: 'That link has expired',
    line: 'Sign-in links only last an hour, so this one has run out. Here is a fresh one.',
  },
  used: {
    emoji: '✅',
    title: 'That link has already been used',
    line: 'Links work once. Sometimes an email scanner opens it before you do. Grab a new one below.',
  },
  invalid: {
    emoji: '🧩',
    title: "That link didn't come through properly",
    line: 'Part of it got lost on the way, which email apps sometimes do. A new one will work.',
  },
};

/** Picks the wording from whatever Supabase said, defaulting to expired. */
export function reasonFromError(message: string | undefined): LinkReason {
  const m = (message ?? '').toLowerCase();
  if (/already been used|already used/.test(m)) return 'used';
  if (/invalid|malformed|bad_/.test(m)) return 'invalid';
  return 'expired';
}

const emailSchema = z.string().email('Enter a valid email address.');

type SendState =
  | { kind: 'idle' }
  | { kind: 'sending' }
  | { kind: 'sent' }
  | { kind: 'error'; message: string };

export function LinkExpired({
  reason = 'expired',
  email: initialEmail = '',
}: {
  reason?: LinkReason;
  /** Prefilled when we already know the address, empty when we do not. */
  email?: string;
}) {
  const [email, setEmail] = useState(initialEmail);
  const [state, setState] = useState<SendState>({ kind: 'idle' });
  // When we already know the address we say it once rather than asking
  // someone to retype what we can see. "Use a different email" opens the
  // field for the case where we have the wrong one.
  const [knowsAddress, setKnowsAddress] = useState(Boolean(initialEmail));
  const emailInputRef = useRef<HTMLInputElement>(null);
  const copy = REASONS[reason];

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const parsed = emailSchema.safeParse(email.trim());
    if (!parsed.success) {
      setState({ kind: 'error', message: parsed.error.issues[0]?.message ?? 'Invalid email.' });
      return;
    }
    setState({ kind: 'sending' });
    const { error } = await supabase.auth.signInWithOtp({
      email: parsed.data,
      options: {
        emailRedirectTo: authCallbackUrl(parsed.data),
        shouldCreateUser: false,
      },
    });
    if (error) {
      setState({ kind: 'error', message: friendlyAuthErrorMessage(error.message) });
      return;
    }
    sessionStorage.setItem('fh.signup.email', parsed.data);
    rememberAuthEmail(parsed.data);
    sessionStorage.setItem('fh.auth.origin', '/login');
    setState({ kind: 'sent' });
  }

  return (
    <div
      className="flex min-h-screen w-full items-center justify-center bg-kingdom-bg px-5 py-10"
      data-testid="link-expired"
    >
      <Card className="w-full max-w-md p-6 sm:p-8">
        {state.kind === 'sent' ? (
          <Confirmation email={email} onAgain={() => setState({ kind: 'idle' })} />
        ) : (
          <>
            <div className="text-center">
              <span
                aria-hidden="true"
                className="mx-auto flex h-16 w-16 items-center justify-center rounded-full border-2 border-black bg-pastel-yellow text-3xl shadow-neo-sm"
              >
                {copy.emoji}
              </span>

              <h1
                className="mt-5 font-heading text-2xl leading-tight text-kingdom-bg sm:text-3xl"
                data-testid="link-expired-title"
              >
                {copy.title}
              </h1>

              <p className="mt-3 font-body font-bold text-gray-600">{copy.line}</p>
            </div>

            {/* The job is getting a new link, so it happens here rather than
                after a bounce back to sign-in. */}
            <form onSubmit={onSubmit} className="mt-6" noValidate>
              {/* FHS-609: the founder's revised design. When we already know
                  where the dead link went we state it once in the panel,
                  nothing to type and nothing to check. The labelled box only
                  appears when we genuinely do not know. This supersedes the
                  FHS-602 read-only box; the address itself still arrives via
                  the link (FHS-605) or device memory (FHS-604). */}
              {knowsAddress ? (
                <div
                  className="rounded-xl border-2 border-black bg-pastel-cyan p-4 text-center shadow-neo-xs"
                  data-testid="link-expired-known-address"
                >
                  <p className="font-body text-sm font-bold text-gray-600">We will send it to</p>
                  <p className="mt-1 break-words font-heading text-lg text-black">{email}</p>
                </div>
              ) : (
                <>
                  <label
                    htmlFor="relink-email"
                    className="block font-body text-xs font-bold uppercase tracking-widest text-gray-500"
                  >
                    Email <span className="text-red-500">*</span>
                  </label>
                  <input
                    ref={emailInputRef}
                    id="relink-email"
                    type="email"
                    required
                    autoComplete="email"
                    placeholder="sarah@example.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    data-testid="link-expired-email"
                    className="mt-1.5 min-h-[48px] w-full overflow-hidden text-ellipsis rounded-xl border-2 border-black p-3 font-body font-bold shadow-neo-xs placeholder:font-bold placeholder:text-gray-400 focus:outline-none focus:ring-4 focus:ring-pastel-cyan"
                  />
                </>
              )}

              {/* FHS-578: the slot reserves one line so the button never moves
                  when a send fails, but it used to reserve a 20px band on top
                  of the button's own margin, which pushed the button 32px
                  below the address panel where the design has 16px. One tight
                  line plus a 4px margin lands at 24px. */}
              <div
                className="mt-1 min-h-[1rem]"
                aria-live="polite"
                data-testid="link-expired-error-slot"
              >
                {state.kind === 'error' && (
                  <p className="font-body text-xs leading-4 text-red-600" role="alert">
                    {state.message}
                  </p>
                )}
              </div>

              <Button
                type="submit"
                variant="primary"
                size="lg"
                fullWidth
                disabled={state.kind === 'sending'}
                testId="link-expired-send"
                className="mt-1 min-h-[48px]"
              >
                {state.kind === 'sending' ? 'Sending…' : 'Send me a new link →'}
              </Button>
            </form>

            {knowsAddress ? (
              <p className="mt-3 text-center">
                <button
                  type="button"
                  onClick={() => {
                    // Clear it for them and put the cursor in the box, so
                    // nobody has to delete the old address by hand.
                    setKnowsAddress(false);
                    setEmail('');
                    setState({ kind: 'idle' });
                    requestAnimationFrame(() => emailInputRef.current?.focus());
                  }}
                  data-testid="link-expired-different-email"
                  className="inline-flex min-h-[44px] items-center font-body text-sm font-bold text-purple-600 underline decoration-2 underline-offset-2 hover:text-purple-800 focus:outline-none focus-visible:ring-4 focus-visible:ring-pastel-cyan"
                >
                  Use a different email
                </button>
              </p>
            ) : null}

            <p className="mt-2 text-center">
              <Link
                to="/login"
                data-testid="link-expired-back"
                className="inline-flex min-h-[44px] items-center font-body text-sm font-bold text-purple-600 underline decoration-2 underline-offset-2 hover:text-purple-800 focus:outline-none focus-visible:ring-4 focus-visible:ring-pastel-cyan"
              >
                Back to sign in
              </Link>
            </p>
          </>
        )}
      </Card>
    </div>
  );
}

/** After asking for a new link, so nobody wonders whether it sent. */
function Confirmation({ email, onAgain }: { email: string; onAgain: () => void }) {
  return (
    <div className="text-center" data-testid="link-expired-sent">
      <span
        aria-hidden="true"
        className="mx-auto flex h-16 w-16 items-center justify-center rounded-full border-2 border-black bg-pastel-lime text-3xl shadow-neo-sm"
      >
        📬
      </span>

      <h1
        role="status"
        aria-live="polite"
        className="mt-5 font-heading text-2xl leading-tight text-kingdom-bg sm:text-3xl"
      >
        Check your inbox
      </h1>

      <p className="mt-3 font-body font-bold text-gray-600">
        A new sign-in link is on its way to{' '}
        <span className="break-all text-black">{email || 'your email'}</span>. It works for one
        hour.
      </p>

      <div className="mt-6 rounded-xl border-2 border-black bg-pastel-cyan p-4 text-left">
        <p className="font-body text-sm font-bold text-black">
          Not there in a minute or two? Have a look in spam, or send it again.
        </p>
      </div>

      <Button
        variant="secondary"
        size="lg"
        fullWidth
        onClick={onAgain}
        testId="link-expired-again"
        className="mt-4 min-h-[48px]"
      >
        Send it again
      </Button>

      <p className="mt-5">
        <Link
          to="/login"
          data-testid="link-expired-back"
          className="inline-flex min-h-[44px] items-center font-body text-sm font-bold text-purple-600 underline decoration-2 underline-offset-2 hover:text-purple-800 focus:outline-none focus-visible:ring-4 focus-visible:ring-pastel-cyan"
        >
          Back to sign in
        </Link>
      </p>
    </div>
  );
}
