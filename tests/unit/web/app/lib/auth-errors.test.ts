import { describe, it, expect } from 'vitest';
import { friendlyAuthErrorMessage } from '../../../../../src/app/lib/auth-errors';

describe('friendlyAuthErrorMessage', () => {
  it('rewrites the email rate-limit error to a helpful next-step message', () => {
    const out = friendlyAuthErrorMessage('email rate limit exceeded');
    expect(out).toMatch(/too many sign-in links/i);
    expect(out).toMatch(/google/i);
  });

  it('matches case variants Supabase returns', () => {
    expect(friendlyAuthErrorMessage('Email rate limit exceeded for project')).toMatch(
      /too many sign-in links/i,
    );
  });

  it("rewrites our own server's sign-in email cap the same way (FHS-696)", () => {
    const out = friendlyAuthErrorMessage(
      'Too many sign-in emails to this address. Please wait 60 minutes and try again.',
    );
    expect(out).toMatch(/too many sign-in links/i);
    expect(out).toMatch(/google/i);
  });

  it("shows our own server's sign-in attempts lockout as written: it is already plain", () => {
    const msg = 'Too many sign-in attempts. Please wait 15 minutes and try again.';
    expect(friendlyAuthErrorMessage(msg)).toBe(msg);
  });

  it('rewrites a generic rate-limit error without the word "email"', () => {
    expect(friendlyAuthErrorMessage('Too many requests')).toMatch(/wait a moment/i);
  });

  it('rewrites an expired-link error', () => {
    expect(friendlyAuthErrorMessage('one-time use, already been used')).toMatch(/expired/i);
  });

  it('rewrites an invalid-email error', () => {
    expect(friendlyAuthErrorMessage('invalid email format')).toMatch(/valid email/i);
  });

  it('passes through an unknown message unchanged so we never silently swallow new failures', () => {
    expect(friendlyAuthErrorMessage('Some new Supabase failure')).toBe('Some new Supabase failure');
  });

  it('falls back to a sensible default for empty / undefined input', () => {
    expect(friendlyAuthErrorMessage('')).toMatch(/something went wrong/i);
    expect(friendlyAuthErrorMessage(undefined)).toMatch(/something went wrong/i);
  });

  it("FHS-279: unknown email on login maps 'Signups not allowed' to plain copy", () => {
    expect(friendlyAuthErrorMessage('Signups not allowed for otp')).toBe(
      'No account found for this email - create an account first, then log in.',
    );
  });
  // FHS-564: the short per-address throttle says neither "rate limit" nor
  // "too many requests", so it used to reach the screen verbatim.
  it('FHS-564: maps the Supabase throttle message and keeps the wait in seconds', () => {
    expect(
      friendlyAuthErrorMessage(
        'For security purposes, you can only request this after 30 seconds.',
      ),
    ).toBe('Please wait 30 seconds before asking for another link, or use Continue with Google.');
  });

  it('FHS-564: handles the throttle message when it carries no number', () => {
    expect(friendlyAuthErrorMessage('For security purposes, please try again later.')).toMatch(
      /wait a moment before asking for another link/i,
    );
  });
});
