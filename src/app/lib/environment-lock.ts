/**
 * FHS-644: the passcode gate in front of the deployed site.
 *
 * This is a curtain, not a lock. The code it guards has already been sent to
 * the visitor's browser and the passcode ships inside that code, so anyone who
 * opens developer tools can walk straight past it. It exists so a link shared
 * with a tester is not browsable by whoever the link gets forwarded to, and so
 * a laptop left open in a cafe does not sit on the product all afternoon.
 *
 * Nothing that matters may ever be defended by it. The api authenticates every
 * request on its own and must keep doing so: this file cannot protect data,
 * only hide the screens from a casual visitor.
 */

/** How long the site may sit untouched before the passcode is asked for again. */
export const IDLE_LIMIT_MS = 30 * 60 * 1000;

/** The passcode itself. Case is folded, so `2fh3` is accepted too. */
export const PASSCODE = '2FH3';

/**
 * Where the "still in" stamp lives. localStorage rather than sessionStorage so
 * a refresh, or a link opened in a second tab, does not ask again.
 */
export const STORAGE_KEY = 'fh.env-lock.last-seen';

export function isPasscodeCorrect(input: string): boolean {
  return input.trim().toUpperCase() === PASSCODE;
}

/**
 * Armed on deployed builds only. `pnpm dev` and the test suites run unbuilt, so
 * development and CI are never asked for a passcode. `VITE_ENV_LOCK=off` is the
 * escape hatch: it takes the gate down from the Railway dashboard, with no code
 * change, whether that is for launch or because something here went wrong.
 */
export function isLockArmed(): boolean {
  if (import.meta.env.VITE_ENV_LOCK === 'off') return false;
  return import.meta.env.PROD === true;
}

/**
 * Whether a stored stamp still counts as unlocked.
 *
 * Elapsed time is floored at zero on purpose. A stamp from the future means the
 * clock moved (a machine waking with a corrected time, a manual change), and
 * treating that as "unlocked forever" would be worse than treating it as now.
 */
export function isStillUnlocked(lastSeen: number | null, now: number): boolean {
  if (lastSeen === null || !Number.isFinite(lastSeen)) return false;
  return Math.max(0, now - lastSeen) < IDLE_LIMIT_MS;
}

/**
 * Storage can throw outright, not just come back empty: Safari private mode and
 * a browser set to block site data both do. A read that fails reads as locked,
 * which is the safe way to fail.
 */
export function readLastSeen(): number | null {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (raw === null) return null;
    const parsed = Number(raw);
    return Number.isFinite(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

export function writeLastSeen(at: number): void {
  try {
    window.localStorage.setItem(STORAGE_KEY, String(at));
  } catch {
    // Nothing to do: the visitor stays unlocked for this page load only.
  }
}

export function clearLastSeen(): void {
  try {
    window.localStorage.removeItem(STORAGE_KEY);
  } catch {
    // Already unreadable, so already locked.
  }
}
