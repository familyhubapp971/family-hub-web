import { createClient, type SupabaseClient } from '@supabase/supabase-js';

// Singleton browser client. Initialised once per page load. Picks up env
// from Vite's import.meta.env: only the publishable / anon key is shipped
// to the bundle (NEVER service_role; see ADR 0008 + .env.example notes).
//
// Database type generation lands with FHS-192 (the user-mirror sync); for
// now we use the unparameterised generic so the file compiles before any
// schema exists. When generated types are committed at
// `family-hub-api/shared-rules/src/db-types.ts` (or similar), tighten via:
//   createClient<Database>(...)

// FHS-696: VITE_AUTH_URL switches sign-in from Supabase to our own GoTrue
// server. It is the base address of our API, whose /auth/v1 passes through to
// GoTrue, so the client below works unchanged. GoTrue ignores the key the
// client sends, so a fixed stand-in is used when no Supabase key is set.
export function authClientConfig(env: {
  VITE_AUTH_URL?: string | undefined;
  VITE_SUPABASE_URL?: string | undefined;
  VITE_SUPABASE_ANON_KEY?: string | undefined;
}): { url: string | undefined; key: string | undefined } {
  if (env.VITE_AUTH_URL) {
    return { url: validUrl(env.VITE_AUTH_URL), key: env.VITE_SUPABASE_ANON_KEY || 'gotrue' };
  }
  return { url: validUrl(env.VITE_SUPABASE_URL), key: env.VITE_SUPABASE_ANON_KEY };
}

// A mistyped address would make createClient throw at load and blank every
// page, including the public ones. Treat it as missing instead.
function validUrl(raw: string | undefined): string | undefined {
  if (!raw) return undefined;
  try {
    return new URL(raw).origin === 'null' ? undefined : raw.replace(/\/+$/, '');
  } catch {
    return undefined;
  }
}

// Named one by one: Vite bakes each import.meta.env.VITE_* in at build time.
const { url, key: anonKey } = authClientConfig({
  VITE_AUTH_URL: import.meta.env.VITE_AUTH_URL,
  VITE_SUPABASE_URL: import.meta.env.VITE_SUPABASE_URL,
  VITE_SUPABASE_ANON_KEY: import.meta.env.VITE_SUPABASE_ANON_KEY,
});

// Don't throw at module init when env vars are missing: a hard throw here
// crashes the entire React tree, breaking unrelated pages (landing, /hello)
// in CI environments that build the bundle without auth secrets. Instead,
// log a warning and fall back to placeholder values; the actual auth.* calls
// will fail with a clear network error if invoked, which is the correct
// behaviour for a misconfigured deploy. Real auth flows in CI need
// VITE_SUPABASE_URL + VITE_SUPABASE_ANON_KEY set as GH Actions secrets.
if (!url || !anonKey) {
  console.warn(
    '[supabase] sign-in address or key missing (VITE_AUTH_URL, or VITE_SUPABASE_URL + VITE_SUPABASE_ANON_KEY): ' +
      'auth calls will fail. Set both at build time (Vite reads VITE_* env at build).',
  );
}

export const supabase: SupabaseClient = createClient(
  url || 'https://placeholder.invalid',
  anonKey || 'placeholder-anon-key',
  {
    auth: {
      // detectSessionInUrl is needed so /auth/callback can extract the
      // session from the OAuth fragment Supabase appends to redirectTo.
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
    },
  },
);
