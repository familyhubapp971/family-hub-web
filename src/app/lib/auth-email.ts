// FHS-604: the address a sign-in link was requested for.
//
// sessionStorage lives and dies with one tab, and an email link always opens
// a NEW tab, so the expired-link screen came up empty exactly when it mattered.
// localStorage survives across tabs and restarts, so the new tab can say
// "We will send it to sarah@khan.family" instead of asking who you are.
//
// Deliberate trade-off: the address persists on the device. It is the same
// address the sign-in screens already display, not a secret, and it is
// overwritten by the next request rather than accumulating.

const KEY = 'fh.auth.email';

/** Remember the address a magic link was just requested for. */
export function rememberAuthEmail(email: string): void {
  try {
    localStorage.setItem(KEY, email);
  } catch {
    /* private mode or storage denied: the same-tab flow still works */
  }
}

/** The last address a magic link was requested for on this device. */
export function recallAuthEmail(): string {
  try {
    return localStorage.getItem(KEY) ?? '';
  } catch {
    return '';
  }
}

// FHS-605: device memory cannot follow you to another device, and a link
// requested before it existed saved nothing. Putting the address inside the
// link's return URL works everywhere, always: request on the laptop, open on
// the phone, and the phone still knows who the link was for. The email the
// link sits in was sent to that address anyway, so the link reveals nothing
// its own envelope does not.

/** The return URL a magic-link request hands Supabase, carrying the address. */
export function authCallbackUrl(email: string): string {
  return `${window.location.origin}/auth/callback?email=${encodeURIComponent(email)}`;
}

/**
 * The address the link itself carries, or '' when absent or not an address.
 * Anyone can type a URL, so junk that does not look like an email is ignored
 * rather than displayed.
 */
export function emailFromLink(params: URLSearchParams): string {
  const raw = params.get('email')?.trim() ?? '';
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(raw) ? raw : '';
}
