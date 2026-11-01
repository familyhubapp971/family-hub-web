import { API_BASE } from '../../../app/lib/api';

// FHS-373: World Flags data-source adapter.
// One of `kidToken` or `memberId` is always supplied; never both.
// Kid mode:    hits /api/kid/world-flags*, sends only Bearer token, omits memberId from POSTs.
// Parent mode: hits /api/world-flags*,     sends Bearer + x-tenant-slug, includes memberId.

export type WorldFlagsMode =
  | { kidToken: string; memberId?: undefined; parentHeaders?: undefined }
  | { memberId: string; parentHeaders: Record<string, string>; kidToken?: undefined };

export interface WorldFlagsApi {
  /** Request headers (already includes Content-Type where needed for GETs). */
  readonly headers: Record<string, string>;
  /** GET explored flags URL. */
  exploreUrl(): string;
  /** POST explore (mark a flag as seen) URL. */
  explorePostUrl(): string;
  /** POST explore body. */
  explorePostBody(countryCode: string): Record<string, string>;
  /** GET learn progress URL. */
  learnUrl(): string;
  /** POST learn-complete URL. */
  learnCompleteUrl(): string;
  /** POST learn-complete body. */
  learnCompleteBody(continent: string, chunkIndex: number): Record<string, unknown>;
  /**
   * Stable per-user key for client-side state (e.g. localStorage best-score
   * key). The member id in both modes: derived from the kid token's `sub`
   * claim in kid mode, the memberId prop in parent mode: so it survives a
   * kid-token rotation (re-login / expiry).
   */
  readonly userKey: string;
}

// Pull the stable member id (the `sub` claim) out of a kid HS256 JWT so a
// per-kid client key (e.g. localStorage best-scores) survives token rotation.
// The token was already verified server-side; we only read its payload. Falls
// back to the raw token if it isn't a decodable JWT.
function memberIdFromKidToken(tok: string): string {
  try {
    const payload = tok.split('.')[1];
    if (!payload) return tok;
    const b64 = payload.replace(/-/g, '+').replace(/_/g, '/');
    const pad = b64.length % 4 ? '='.repeat(4 - (b64.length % 4)) : '';
    const sub = (JSON.parse(atob(b64 + pad)) as { sub?: unknown }).sub;
    return typeof sub === 'string' && sub ? sub : tok;
  } catch {
    return tok;
  }
}

export function worldFlagsApi(mode: WorldFlagsMode): WorldFlagsApi {
  if (mode.kidToken) {
    const tok = mode.kidToken;
    const h = { Authorization: `Bearer ${tok}` };
    return {
      headers: h,
      userKey: memberIdFromKidToken(tok),
      exploreUrl: () => `${API_BASE}/api/kid/world-flags`,
      explorePostUrl: () => `${API_BASE}/api/kid/world-flags/explore`,
      explorePostBody: (countryCode) => ({ countryCode }),
      learnUrl: () => `${API_BASE}/api/kid/world-flags/learn`,
      learnCompleteUrl: () => `${API_BASE}/api/kid/world-flags/learn-complete`,
      learnCompleteBody: (continent, chunkIndex) => ({ continent, chunkIndex }),
    };
  }

  // Union guarantees both are present when kidToken is absent.
  const mid = mode.memberId as string;
  const ph = mode.parentHeaders as Record<string, string>;
  return {
    headers: ph,
    userKey: mid,
    exploreUrl: () => `${API_BASE}/api/world-flags?memberId=${mid}`,
    explorePostUrl: () => `${API_BASE}/api/world-flags/explore`,
    explorePostBody: (countryCode) => ({ memberId: mid, countryCode }),
    learnUrl: () => `${API_BASE}/api/world-flags/learn?memberId=${mid}`,
    learnCompleteUrl: () => `${API_BASE}/api/world-flags/learn-complete`,
    learnCompleteBody: (continent, chunkIndex) => ({ memberId: mid, continent, chunkIndex }),
  };
}
