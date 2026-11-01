// FHS-715: every family's code is made by the server: 8 letters and digits in
// two groups of four, like e29b-41d4. The code is also the family's web
// address (/t/e29b-41d4/...), so a surname never shows up in a link.
export const FAMILY_CODE_RE = /^[0-9a-f]{4}-[0-9a-f]{4}$/;

export function isFamilyCode(value: string): boolean {
  return FAMILY_CODE_RE.test(value);
}

// Pages that sit straight after the code. A family name that turned into one
// of these would open that page instead of the family's home.
const PAGE_NAMES = new Set([
  'admin',
  'dashboard',
  'family-settings',
  'kid-login',
  'me',
  'members',
  'money',
  'onboarding',
  'reward-settings',
]);

/**
 * The family name as the last part of the family's address: "The Smith
 * Family" becomes "the-smith-family". Small letters, accents dropped, and
 * anything that is not a letter or digit becomes a hyphen.
 */
export function familyNameForAddress(name: string): string {
  const part = name
    .toLowerCase()
    // "Müller" becomes "muller", not "m-ller".
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  return PAGE_NAMES.has(part) ? `${part}-family` : part;
}

/**
 * The family's address with its name at the end, e.g.
 * /t/e29b-41d4/the-smith-family. A name with no letters we can use (a family
 * called 李) leaves just the code, which opens the same page.
 */
export function familyAddressPath(code: string, familyName: string | null): string {
  const end = familyName ? familyNameForAddress(familyName) : '';
  return end ? `/t/${code}/${end}` : `/t/${code}`;
}

/**
 * Tidies a family code typed on a phone or tablet. Phones capitalise the
 * first letter, iPhones turn a typed hyphen into a long dash, and kids leave
 * the hyphen out or type a space instead (FHS-714).
 */
export function tidyFamilyCode(raw: string): string {
  const tidied = raw
    .trim()
    .toLowerCase()
    .replace(/[\s‐-―]+/g, '-')
    .replace(/-{2,}/g, '-')
    .replace(/^-+|-+$/g, '');
  return /^[0-9a-f]{8}$/.test(tidied) ? `${tidied.slice(0, 4)}-${tidied.slice(4)}` : tidied;
}

/** The same page at a different family code: /t/smith/members becomes /t/e29b-41d4/members. */
export function swapFamilyInPath(pathname: string, code: string): string {
  return pathname.replace(/^\/t\/[^/]+/, `/t/${code}`);
}

// The family this device remembers for kid sign-in, so kids only tap their
// face next time. The kid sign-in screens read it (FHS-353 / FHS-437).
export const KID_FAMILY_STORAGE_KEY = 'fh.kid.lastFamily';

export function rememberFamilyForKids(slug: string, name: string): void {
  try {
    localStorage.setItem(KID_FAMILY_STORAGE_KEY, JSON.stringify({ slug, name }));
  } catch {
    // Private mode or full storage: kids type the code once more instead.
  }
}
