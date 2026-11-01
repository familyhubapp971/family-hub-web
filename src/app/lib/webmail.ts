// Maps the most common consumer mail providers to their webmail URL +
// human-friendly label. Workplace and unknown domains fall through to a
// generic label with no URL: we can't reliably guess the right webmail
// for them, and a wrong link is worse than no link.

export interface WebmailTarget {
  label: string;
  url: string | null;
}

const GENERIC: WebmailTarget = { label: 'Open email', url: null };

const PROVIDERS: Record<string, WebmailTarget> = {
  'gmail.com': { label: 'Open Gmail', url: 'https://mail.google.com/' },
  'googlemail.com': { label: 'Open Gmail', url: 'https://mail.google.com/' },
  'outlook.com': { label: 'Open Outlook', url: 'https://outlook.live.com/mail/' },
  'hotmail.com': { label: 'Open Outlook', url: 'https://outlook.live.com/mail/' },
  'hotmail.co.uk': { label: 'Open Outlook', url: 'https://outlook.live.com/mail/' },
  'live.com': { label: 'Open Outlook', url: 'https://outlook.live.com/mail/' },
  'msn.com': { label: 'Open Outlook', url: 'https://outlook.live.com/mail/' },
  'yahoo.com': { label: 'Open Yahoo Mail', url: 'https://mail.yahoo.com/' },
  'yahoo.co.uk': { label: 'Open Yahoo Mail', url: 'https://mail.yahoo.com/' },
  'ymail.com': { label: 'Open Yahoo Mail', url: 'https://mail.yahoo.com/' },
  'icloud.com': { label: 'Open iCloud Mail', url: 'https://www.icloud.com/mail/' },
  'me.com': { label: 'Open iCloud Mail', url: 'https://www.icloud.com/mail/' },
  'mac.com': { label: 'Open iCloud Mail', url: 'https://www.icloud.com/mail/' },
  'aol.com': { label: 'Open AOL Mail', url: 'https://mail.aol.com/' },
  'proton.me': { label: 'Open Proton Mail', url: 'https://mail.proton.me/' },
  'protonmail.com': { label: 'Open Proton Mail', url: 'https://mail.proton.me/' },
  'pm.me': { label: 'Open Proton Mail', url: 'https://mail.proton.me/' },
};

export function webmailFor(email: string | null | undefined): WebmailTarget {
  if (!email) return GENERIC;
  const at = email.lastIndexOf('@');
  if (at < 0 || at === email.length - 1) return GENERIC;
  const domain = email
    .slice(at + 1)
    .toLowerCase()
    .trim();
  return PROVIDERS[domain] ?? GENERIC;
}
