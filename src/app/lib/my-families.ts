import { API_BASE } from './api';

// FHS-718: the families the signed-in person belongs to, by code.
//
// Every family page checks that its code is one of these before it opens, so
// a wrong or old link gets a plain "can't find" screen instead of a broken
// page. The list is asked for once and kept in memory for the visit, so
// moving between pages of your own family never waits on the server again.
// A code that is not in the list is asked about once more before anyone is
// turned away: the person may have just made a family or joined one.
// Signing out forgets the list, so the next person on the device starts fresh.

/** How long a family check may take before the page opens anyway. */
export const FAMILY_CHECK_TIME_LIMIT_MS = 8000;

let known: { userId: string; codes: string[] } | null = null;
let asking: { userId: string; answer: Promise<string[] | null> } | null = null;

/** The codes already known for this person, or null if not asked yet. */
export function knownFamilyCodes(userId: string): string[] | null {
  return known?.userId === userId ? known.codes : null;
}

/**
 * Keeps the family list from a "who am I" answer the app already has, so the
 * first family page does not ask again. Answers the codes it kept, or null
 * when the answer did not hold a list.
 */
export function rememberFamilyCodes(userId: string, tenants: unknown): string[] | null {
  if (!Array.isArray(tenants)) return null;
  const codes = tenants
    .map((t: { slug?: unknown } | null) => t?.slug)
    .filter((slug): slug is string => typeof slug === 'string');
  known = { userId, codes };
  return codes;
}

/**
 * Gives a check at most FAMILY_CHECK_TIME_LIMIT_MS. When it takes longer, the
 * fallback answer is used, so a slow server never leaves someone waiting.
 */
export function withinTimeLimit<T>(work: Promise<T>, fallback: T): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const late = new Promise<T>((resolve) => {
    timer = setTimeout(() => resolve(fallback), FAMILY_CHECK_TIME_LIMIT_MS);
  });
  return Promise.race([work, late]).finally(() => clearTimeout(timer));
}

/**
 * Asks the server for this person's family codes, first family first (the
 * same order the app uses to pick where to go after sign-in). Answers null
 * when the server could not be asked or took too long, so a page is never
 * blocked by a failed check. Two pages asking at once share one request.
 */
export function fetchFamilyCodes(userId: string, token: string): Promise<string[] | null> {
  if (asking?.userId === userId) return asking.answer;
  const request = fetch(`${API_BASE}/api/me`, { headers: { Authorization: `Bearer ${token}` } })
    .then(async (res) => {
      if (!res.ok) return null;
      const body = (await res.json()) as { tenants?: unknown };
      // Signed out while waiting: keep nothing for the next person.
      if (asking?.answer !== answer) return null;
      return rememberFamilyCodes(userId, body.tenants);
    })
    .catch(() => null);
  const answer: Promise<string[] | null> = withinTimeLimit(request, null).finally(() => {
    if (asking?.answer === answer) asking = null;
  });
  asking = { userId, answer };
  return answer;
}

/** Forgets the list, so the next family page asks again. Called on sign-out. */
export function forgetFamilyCodes(): void {
  known = null;
  asking = null;
}
