import { describe, it, expect } from 'vitest';
import { webmailFor } from '../../../../../src/app/lib/webmail';

describe('webmailFor', () => {
  it('maps gmail.com to the Gmail webmail', () => {
    expect(webmailFor('sarah@gmail.com')).toEqual({
      label: 'Open Gmail',
      url: 'https://mail.google.com/',
    });
  });

  it('maps googlemail.com to the Gmail webmail', () => {
    expect(webmailFor('sarah@googlemail.com').url).toBe('https://mail.google.com/');
  });

  it('maps outlook.com to the Outlook webmail (the bug-report case)', () => {
    expect(webmailFor('qualicion@outlook.com')).toEqual({
      label: 'Open Outlook',
      url: 'https://outlook.live.com/mail/',
    });
  });

  it('maps hotmail.com / live.com / msn.com to the Outlook webmail', () => {
    expect(webmailFor('user@hotmail.com').url).toBe('https://outlook.live.com/mail/');
    expect(webmailFor('user@live.com').url).toBe('https://outlook.live.com/mail/');
    expect(webmailFor('user@msn.com').url).toBe('https://outlook.live.com/mail/');
  });

  it('maps Yahoo / iCloud / AOL / Proton to their webmails', () => {
    expect(webmailFor('user@yahoo.com').label).toBe('Open Yahoo Mail');
    expect(webmailFor('user@icloud.com').label).toBe('Open iCloud Mail');
    expect(webmailFor('user@aol.com').label).toBe('Open AOL Mail');
    expect(webmailFor('user@proton.me').label).toBe('Open Proton Mail');
  });

  it('is case-insensitive on the domain', () => {
    expect(webmailFor('Sarah@OUTLOOK.COM').url).toBe('https://outlook.live.com/mail/');
  });

  it('returns generic "Open email" with no URL for unknown / workplace domains', () => {
    expect(webmailFor('sarah@acme-corp.com')).toEqual({ label: 'Open email', url: null });
    expect(webmailFor('sarah@example.com').url).toBeNull();
  });

  it('returns generic for null / empty / malformed inputs', () => {
    expect(webmailFor(null).url).toBeNull();
    expect(webmailFor(undefined).url).toBeNull();
    expect(webmailFor('').url).toBeNull();
    expect(webmailFor('no-at-sign').url).toBeNull();
    expect(webmailFor('trailing-at@').url).toBeNull();
  });
});
