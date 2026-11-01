import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { motion, useReducedMotion } from 'framer-motion';
import { Button } from '@familyhub/ui';

// FHS-550: ONE branded full-screen wait, used everywhere.
//
// Forensic port of the Magic Patterns design (kudjspxd3xxroueg5jw11o,
// components/LoadingScreen.tsx), which replaced the washed-out grey interim
// screens ("Sign in to Family Hub", "Finding your family hub…") and the
// per-screen spinners. Every full-screen wait uses this: the magic-link
// callback, protected routes, the route-level Suspense fallback, the legacy
// dashboard redirect and the kid load.
//
// Deviations from the MP file, all deliberate:
//  1. MP built a separate `LoadingWithTimeout` wrapper. This repo already had
//     the 15s stall inside LoadingScreen with an `error` prop that callers
//     pass, so the timeout stays here and the existing API is kept. Porting
//     MP's wrapper verbatim would have meant rewriting every caller for no
//     user-visible gain.
//  2. MP dropped the rotating reassurance copy this repo shipped in FHS-419.
//     Kept: a wait that changes its line reads as progress, and a line frozen
//     for 15 seconds reads as a hang. It rotates only when motion is allowed.
//  3. MP's mark uses emoji. Kept: this product already uses emoji as brand
//     furniture (FloatingDecorations), so it is in keeping rather than a
//     one-off.
//  4. `role="main"` and the brand link are kept from the old screen, so the
//     loader still exposes a landmark and a way out.

type LoadingContext = 'callback' | 'protected' | 'redirect' | 'kid';

const MESSAGES: Record<LoadingContext, string[]> = {
  callback: [
    "Getting your family's space ready…",
    'Checking in with the hub…',
    'Almost there, just a moment!',
    "Pulling up your family's world…",
  ],
  protected: [
    'Picking up where you left off…',
    'Checking in with the hub…',
    'Almost there, just a moment!',
    'Loading your dashboard…',
  ],
  redirect: [
    'Finding your family hub…',
    'Checking in with the hub…',
    'Almost there, just a moment!',
  ],
  kid: [
    'Loading your world…',
    'Checking your streaks…',
    'Getting your tasks ready…',
    'Almost there!',
  ],
};

const ARIA_LABEL: Record<LoadingContext, string> = {
  callback: 'Signing in to FamilyHub',
  protected: 'Loading FamilyHub',
  redirect: 'Finding your family hub',
  kid: 'Loading your world',
};

// If neither a session nor an error arrives within this window, surface the
// recovery state so the user is never stranded on an infinite loader.
const TIMEOUT_MS = 15_000;

export function LoadingScreen({
  context = 'callback',
  error = null,
  onRetry,
}: {
  context?: LoadingContext;
  error?: { message: string } | null;
  onRetry?: () => void;
}) {
  const reduceMotion = useReducedMotion();
  const still = Boolean(reduceMotion);
  const messages = MESSAGES[context];
  const [index, setIndex] = useState(0);
  const [timedOut, setTimedOut] = useState(false);
  const isKid = context === 'kid';

  // Rotate the reassurance line (never under reduced motion, never on error).
  useEffect(() => {
    if (still || error) return;
    const id = setInterval(() => setIndex((i) => (i + 1) % messages.length), 2800);
    return () => clearInterval(id);
  }, [still, error, messages.length]);

  // Safety timeout so the loader cannot spin forever.
  useEffect(() => {
    if (error) return;
    const id = setTimeout(() => setTimedOut(true), TIMEOUT_MS);
    return () => clearTimeout(id);
  }, [error]);

  const isError = Boolean(error) || timedOut;
  const errorMessage = error?.message ?? 'We are still trying. Nothing has been lost.';
  const copy = isError ? 'This is taking longer than usual.' : (messages[index] ?? messages[0]!);

  return (
    <div
      role="main"
      aria-label={ARIA_LABEL[context]}
      className="space-bg relative flex min-h-screen w-full items-center justify-center overflow-hidden bg-kingdom-bg px-5 py-10"
      data-testid="loading-screen"
    >
      <Link
        to="/"
        className="absolute left-6 top-6 rounded-lg font-heading text-2xl text-white transition-opacity hover:opacity-90 focus:outline-none focus-visible:ring-4 focus-visible:ring-yellow-300 sm:left-10 sm:top-8"
      >
        FamilyHub
      </Link>

      <section
        aria-busy={!isError}
        className="relative flex w-full max-w-sm flex-col items-center text-center"
      >
        <Mark still={still || isError} big={isKid} tone={isKid ? 'kid' : 'default'} />

        <p className="mt-6 font-heading text-2xl leading-none text-white sm:text-3xl">FamilyHub</p>

        {/* The reassurance line is the live region, so it is announced as it
            changes. White, never grey: faint grey on purple is the exact bug
            this screen exists to kill. min-h holds two lines so a longer
            message never nudges the bar. */}
        <p
          role="status"
          aria-live="polite"
          data-testid="loading-copy"
          className="mt-4 min-h-[3.5rem] font-body text-lg font-extrabold leading-snug text-white sm:text-xl"
        >
          {copy}
        </p>

        {isError ? (
          <p className="font-body text-sm font-bold text-pastel-cyan" role="alert">
            {errorMessage}
          </p>
        ) : null}

        <ProgressTrack still={still} tone={isKid ? 'kid' : 'default'} label={copy} />

        {isError ? (
          <div className="mt-7 flex w-full flex-col gap-3 sm:flex-row sm:justify-center">
            {onRetry ? (
              <Button
                variant="primary"
                size="md"
                onClick={onRetry}
                testId="loading-retry"
                className="min-h-[44px]"
              >
                Try again
              </Button>
            ) : null}
            <Link to="/login">
              <Button
                variant="secondary"
                size="md"
                testId="loading-back-to-login"
                className="min-h-[44px] w-full"
              >
                Back to sign in
              </Button>
            </Link>
          </div>
        ) : null}
      </section>
    </div>
  );
}

/**
 * The brand mark: a star disc flanked by two smaller family discs. It breathes
 * while waiting and holds still when it must not move.
 */
function Mark({ still, big, tone }: { still: boolean; big?: boolean; tone: 'default' | 'kid' }) {
  const size = big ? 'h-24 w-24 text-4xl' : 'h-20 w-20 text-3xl';
  const satellite = big ? 'h-9 w-9 text-lg' : 'h-8 w-8 text-base';
  const fill = tone === 'kid' ? 'bg-pastel-lime' : 'bg-pastel-yellow';
  const breathe = { duration: 1.8, repeat: Infinity, ease: 'easeInOut' as const };
  // Spread rather than pass `transition={undefined}`: framer-motion's prop
  // type does not accept undefined.
  const bob = still ? {} : { animate: { y: [0, -5, 0] }, transition: breathe };
  const pulse = still ? {} : { animate: { scale: [1, 1.06, 1] }, transition: breathe };
  const bobLate = still
    ? {}
    : { animate: { y: [0, -5, 0] }, transition: { ...breathe, delay: 0.9 } };

  return (
    <div aria-hidden="true" className="flex items-end gap-2">
      <motion.span
        className={`${satellite} flex items-center justify-center rounded-full border-2 border-black bg-pastel-cyan shadow-neo-sm`}
        {...bob}
      >
        🧒
      </motion.span>

      <motion.span
        className={`${size} flex items-center justify-center rounded-full border-2 border-black ${fill} font-heading text-black shadow-neo-lg`}
        {...pulse}
      >
        ⭐
      </motion.span>

      <motion.span
        className={`${satellite} flex items-center justify-center rounded-full border-2 border-black bg-pastel-pink shadow-neo-sm`}
        {...bobLate}
      >
        🧑
      </motion.span>
    </div>
  );
}

/**
 * A travelling bar on a bordered track rather than a spinning circle: it reads
 * as progress on the dark purple, and it has a sensible still state.
 */
function ProgressTrack({
  still,
  tone,
  label,
}: {
  still: boolean;
  tone: 'default' | 'kid';
  label: string;
}) {
  const fill = tone === 'kid' ? 'bg-pastel-lime' : 'bg-yellow-300';

  return (
    <div
      role="progressbar"
      aria-label={label}
      aria-valuetext="Loading"
      data-testid="loading-progress"
      className="mt-7 h-4 w-full overflow-hidden rounded-md border-2 border-black bg-white shadow-neo-sm"
    >
      {still ? (
        // Still: a partial fill, so it reads as deliberate rather than frozen.
        <div className={`h-full w-3/5 ${fill}`} data-testid="loading-progress-still" />
      ) : (
        <motion.div
          className={`h-full w-2/5 ${fill}`}
          animate={{ x: ['-105%', '255%'] }}
          transition={{ duration: 1.6, repeat: Infinity, ease: 'easeInOut' }}
        />
      )}
    </div>
  );
}
