// FHS-644: the rules the passcode gate runs on, tested away from the screen.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  IDLE_LIMIT_MS,
  PASSCODE,
  STORAGE_KEY,
  clearLastSeen,
  isLockArmed,
  isPasscodeCorrect,
  isStillUnlocked,
  readLastSeen,
  writeLastSeen,
} from '../../../../../src/app/lib/environment-lock';

describe('isPasscodeCorrect', () => {
  it('accepts the passcode', () => {
    expect(isPasscodeCorrect('2FH3')).toBe(true);
  });

  it('accepts it in any case, so a phone keyboard is not a trap', () => {
    expect(isPasscodeCorrect('2fh3')).toBe(true);
    expect(isPasscodeCorrect('2Fh3')).toBe(true);
  });

  it('ignores surrounding whitespace from a paste', () => {
    expect(isPasscodeCorrect('  2FH3 ')).toBe(true);
  });

  it('rejects anything else', () => {
    for (const wrong of ['', '2FH', '2FH33', '3HF2', 'ABCD', '2F H3']) {
      expect(isPasscodeCorrect(wrong)).toBe(false);
    }
  });
});

describe('isStillUnlocked', () => {
  const now = 1_700_000_000_000;

  it('is unlocked when the last activity is inside the window', () => {
    expect(isStillUnlocked(now - 1, now)).toBe(true);
    expect(isStillUnlocked(now - (IDLE_LIMIT_MS - 1_000), now)).toBe(true);
  });

  it('locks once the window has passed', () => {
    expect(isStillUnlocked(now - IDLE_LIMIT_MS, now)).toBe(false);
    expect(isStillUnlocked(now - IDLE_LIMIT_MS * 4, now)).toBe(false);
  });

  it('locks the window at exactly thirty minutes', () => {
    expect(IDLE_LIMIT_MS).toBe(30 * 60 * 1000);
  });

  it('locks when there is no stamp at all', () => {
    expect(isStillUnlocked(null, now)).toBe(false);
    expect(isStillUnlocked(Number.NaN, now)).toBe(false);
  });

  it('does not hand out an endless pass when the clock moves backwards', () => {
    // A stamp in the future would be a negative elapsed time. Treated as now,
    // it grants one window, not forever.
    expect(isStillUnlocked(now + IDLE_LIMIT_MS * 10, now)).toBe(true);
    expect(isStillUnlocked(now + 5_000, now + IDLE_LIMIT_MS * 2)).toBe(false);
  });
});

describe('the stored stamp', () => {
  beforeEach(() => window.localStorage.clear());

  it('round-trips', () => {
    writeLastSeen(1234);
    expect(readLastSeen()).toBe(1234);
  });

  it('reads as absent when nothing is stored', () => {
    expect(readLastSeen()).toBeNull();
  });

  it('reads as absent when the stored value is not a number', () => {
    window.localStorage.setItem(STORAGE_KEY, 'unlocked-forever');
    expect(readLastSeen()).toBeNull();
  });

  it('clears', () => {
    writeLastSeen(1234);
    clearLastSeen();
    expect(readLastSeen()).toBeNull();
  });

  it('reads as locked, rather than throwing, when storage is blocked', () => {
    const boom = vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('SecurityError');
    });
    expect(readLastSeen()).toBeNull();
    boom.mockRestore();
  });

  it('does not throw on write when storage is blocked', () => {
    const boom = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('SecurityError');
    });
    expect(() => writeLastSeen(1)).not.toThrow();
    boom.mockRestore();
  });
});

describe('isLockArmed', () => {
  afterEach(() => vi.unstubAllEnvs());

  it('is off in development and under test, so dev and CI are never gated', () => {
    vi.stubEnv('PROD', false);
    expect(isLockArmed()).toBe(false);
  });

  it('is on for a deployed build with no configuration at all', () => {
    vi.stubEnv('PROD', true);
    expect(isLockArmed()).toBe(true);
  });

  it('comes down when VITE_ENV_LOCK is set to off', () => {
    vi.stubEnv('PROD', true);
    vi.stubEnv('VITE_ENV_LOCK', 'off');
    expect(isLockArmed()).toBe(false);
  });

  it('stays up for any other value of VITE_ENV_LOCK, including a typo', () => {
    vi.stubEnv('PROD', true);
    vi.stubEnv('VITE_ENV_LOCK', 'OFF');
    expect(isLockArmed()).toBe(true);
  });
});

describe('the passcode', () => {
  it('is the one that was shared', () => {
    expect(PASSCODE).toBe('2FH3');
  });
});
