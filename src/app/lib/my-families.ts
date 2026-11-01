import { API_BASE } from './api';

// FHS-718: the families the signed-in person belongs to, by code.
//
// Every family page checks that its code is one of these before it opens, so
// a wrong or old link gets a plain "can't find" screen instead of a broken
// page. The list is asked for once and kept in memory for the visit, so
// moving between pages of your own family never waits on the server again.
// A code that is not in the list is asked about once more before anyone is
// turned away: the person may have just made a family or joined one.

let known: { userId: string; codes: string[] } | null = null;
let asking: { userId: string; answer: Promise<string[] | null> } | null = null;

/** The codes already known for this person, or null if not asked yet. */
export function knownFamilyCodes(userId: string): string[] | null {
  return known?.userId === userId ? known.codes : null;
}

/**
 * Asks the server for this person's family codes, first family first (the
 * same order the app uses to pick where to go after sign-in). Answers null
 * when the server could not be asked, so a page is never blocked by a failed
 * check. Two pages asking at once share one request.
 */
export function fetchFamilyCodes(userId: string, token: string): Promise<string[] | null> {
  if (asking?.userId === userId) return asking.answer;
  const answer = fetch(`${API_BASE}/api/me`, { headers: { Authorization: `Bearer ${token}` } })
    .then(async (res) => {
      if (!res.ok) return null;
      const body = (await res.json()) as { tenants?: unknown };
      if (!Array.isArray(body.tenants)) return null;
      const codes = body.tenants
        .map((t: { slug?: unknown }) => t?.slug)
        .filter((slug): slug is string => typeof slug === 'string');
      known = { userId, codes };
      return codes;
    })
    .catch(() => null)
    .finally(() => {
      if (asking?.answer === answer) asking = null;
    });
  asking = { userId, answer };
  return answer;
}

/** Forgets the list, so the next family page asks again. Used by tests. */
export function forgetFamilyCodes(): void {
  known = null;
  asking = null;
}
