import { supabase } from './supabase';

// Tiny typed fetch wrapper for the Hono api.
//
// - Resolves the base URL from VITE_API_URL (dev: http://localhost:3001;
//   staging/prod: api-...up.railway.app).
// - Pulls the access_token from the live Supabase session and stamps
//   `Authorization: Bearer <token>`. Anonymous calls (logged-out / no
//   session) just omit the header: the api decides whether to 401.
// - Throws ApiError on non-2xx so callers can `.catch(err)` instead of
//   branching on res.ok.

export const API_BASE = import.meta.env.VITE_API_URL ?? 'http://localhost:3001';

export class ApiError extends Error {
  constructor(
    public status: number,
    public path: string,
    public body: unknown,
  ) {
    super(`api ${path} → ${status}`);
    this.name = 'ApiError';
  }
}

export interface ApiFetchOptions extends Omit<RequestInit, 'headers'> {
  headers?: Record<string, string>;
  /** Skip the auth header even if a session exists. Default: false. */
  anonymous?: boolean;
}

export async function apiFetch<T>(path: string, opts: ApiFetchOptions = {}): Promise<T> {
  const { anonymous = false, headers: extraHeaders, ...rest } = opts;

  const headers: Record<string, string> = {
    Accept: 'application/json',
    ...(extraHeaders ?? {}),
  };

  if (!anonymous) {
    const { data } = await supabase.auth.getSession();
    const token = data.session?.access_token;
    if (token && !headers['Authorization']) {
      headers['Authorization'] = `Bearer ${token}`;
    }
  }

  const url = `${API_BASE}${path}`;
  const res = await fetch(url, { ...rest, headers });

  if (!res.ok) {
    let body: unknown;
    try {
      body = await res.json();
    } catch {
      body = await res.text();
    }
    throw new ApiError(res.status, path, body);
  }

  // 204 No Content: return undefined cast to T so callers expecting
  // void don't have to special-case it.
  if (res.status === 204) return undefined as T;
  return (await res.json()) as T;
}
