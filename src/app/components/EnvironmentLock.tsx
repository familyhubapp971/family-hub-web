import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { PinInput } from '@familyhub/ui';
import {
  clearLastSeen,
  isLockArmed,
  isPasscodeCorrect,
  isStillUnlocked,
  readLastSeen,
  writeLastSeen,
} from '../lib/environment-lock';

// The things that count as somebody being here. Deliberately coarse: any one of
// them resets the clock, so reading a long page without clicking still counts.
const ACTIVITY_EVENTS = ['pointerdown', 'keydown', 'wheel', 'touchstart', 'scroll'] as const;

// How often the idle clock is compared against the limit.
const SWEEP_MS = 15_000;

// Activity fires on every keystroke and scroll tick. Writing to localStorage
// that often is pointless when the window it feeds is half an hour wide.
const WRITE_EVERY_MS = 30_000;

/**
 * FHS-644: one passcode screen, in front of everything.
 *
 * Mounted above the router in main.tsx rather than inside it, so there is a
 * single entry point to guard. While locked the app tree is not rendered at
 * all: no route resolves, no lazy chunk downloads, no request is sent.
 *
 * Read app/lib/environment-lock.ts before trusting this with anything. It hides
 * screens from a casual visitor; it does not secure them.
 */
export function EnvironmentLock({ children }: { children: ReactNode }) {
  // Whether the gate is armed is a property of the build, not of anything that
  // can change while the page is open.
  const armed = isLockArmed();
  const [unlocked, setUnlocked] = useState(
    () => !armed || isStillUnlocked(readLastSeen(), Date.now()),
  );
  const [wrong, setWrong] = useState(false);
  // Bumping this remounts PinInput, which is how its cells get cleared after a
  // failed try: the component owns its own values.
  const [attempt, setAttempt] = useState(0);

  const lastSeenRef = useRef(Date.now());
  const lastWriteRef = useRef(0);

  useEffect(() => {
    if (!armed || !unlocked) return;

    const touch = () => {
      const now = Date.now();
      lastSeenRef.current = now;
      if (now - lastWriteRef.current >= WRITE_EVERY_MS) {
        lastWriteRef.current = now;
        writeLastSeen(now);
      }
    };

    const check = () => {
      if (isStillUnlocked(lastSeenRef.current, Date.now())) return;
      clearLastSeen();
      setUnlocked(false);
    };

    // Arriving on the page is itself activity, and it is what keeps a second
    // tab or a refresh from asking again.
    lastSeenRef.current = Date.now();
    lastWriteRef.current = lastSeenRef.current;
    writeLastSeen(lastSeenRef.current);

    // A background tab has its timers throttled, and a sleeping laptop runs no
    // timers at all, so the sweep below cannot be trusted to have fired while
    // the tab was away. Comparing the clock on the way back is what actually
    // catches the machine that was shut for two hours.
    const onVisible = () => {
      if (document.visibilityState === 'visible') check();
    };

    for (const event of ACTIVITY_EVENTS) {
      window.addEventListener(event, touch, { passive: true });
    }
    document.addEventListener('visibilitychange', onVisible);
    const sweep = window.setInterval(check, SWEEP_MS);

    return () => {
      for (const event of ACTIVITY_EVENTS) window.removeEventListener(event, touch);
      document.removeEventListener('visibilitychange', onVisible);
      window.clearInterval(sweep);
    };
  }, [armed, unlocked]);

  const handleComplete = useCallback((value: string) => {
    if (!isPasscodeCorrect(value)) {
      setWrong(true);
      setAttempt((n) => n + 1);
      return;
    }
    const now = Date.now();
    lastSeenRef.current = now;
    lastWriteRef.current = now;
    writeLastSeen(now);
    setWrong(false);
    setUnlocked(true);
  }, []);

  if (!armed || unlocked) return <>{children}</>;

  return (
    <div
      role="main"
      aria-label="Locked"
      data-testid="environment-lock"
      className="space-bg flex min-h-screen w-full items-center justify-center bg-kingdom-bg px-5 py-12"
    >
      <section className="flex w-full max-w-sm flex-col items-center text-center">
        <span
          aria-hidden="true"
          className="flex h-20 w-20 items-center justify-center rounded-full border-2 border-black bg-pastel-yellow text-3xl shadow-neo-lg"
        >
          🔒
        </span>

        <h1 className="mt-6 font-heading text-3xl leading-none text-white sm:text-4xl">
          FamilyHub
        </h1>

        <p className="mt-3 font-body text-base font-extrabold text-white sm:text-lg">
          Enter the passcode to continue.
        </p>

        {/* The shake is the fastest read on a wrong code, so it is worth having,
            but it is the kind of motion that makes some people ill. */}
        <div className={`mt-8 ${wrong ? 'motion-safe:animate-shake' : ''}`}>
          <PinInput
            key={attempt}
            length={4}
            mode="alphanumeric"
            mask={false}
            error={wrong}
            label="Passcode"
            testId="environment-lock-input"
            onChange={() => {
              if (wrong) setWrong(false);
            }}
            onComplete={handleComplete}
          />
        </div>

        {/* Held in the tree at a fixed height so the message does not shove the
            boxes up the screen the moment it appears. Yellow, not red: red on
            this purple is unreadable. */}
        <p
          role="alert"
          data-testid="environment-lock-error"
          className="mt-4 min-h-[1.5rem] font-body text-sm font-bold text-pastel-yellow"
        >
          {wrong ? 'That passcode is not right. Try again.' : ''}
        </p>
      </section>
    </div>
  );
}
