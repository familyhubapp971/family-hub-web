import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import type { Session, User } from '@supabase/supabase-js';
import { supabase } from './supabase';

// Single source of truth for "is this user signed in?" across the app.
// Wraps Supabase's onAuthStateChange so React components can subscribe
// declaratively without each page calling supabase.auth.* directly.

export interface AuthContextValue {
  session: Session | null;
  user: User | null;
  loading: boolean;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  // `loading` starts true and flips false after the initial getSession()
  // resolves. Protected routes use this to avoid a redirect flash on
  // first paint while the session is being restored from localStorage.
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;

    void supabase.auth.getSession().then(({ data }) => {
      if (!active) return;
      setSession(data.session);
      setLoading(false);
    });

    const { data: sub } = supabase.auth.onAuthStateChange((event, nextSession) => {
      // FHS-253: when a parent signs in on a device where a kid was
      // previously using the family iPad, the kid's stale token must
      // come off here. Otherwise the next consumer (FHS-205 kid-only
      // middleware) will see two identities at once.
      if (event === 'SIGNED_IN') {
        clearKidToken();
      }
      setSession(nextSession);
      setLoading(false);
    });

    // FHS-253: multi-tab sync. When Tab A clears fh.kid.token (via
    // signOutAll), Tab B sees a `storage` event with newValue=null.
    // Today no consumer reads the token, so this is forward-defensive
    // for FHS-205: any future kid-only redirect logic can hook this
    // listener and react. We swallow our own writes (storageArea check)
    // so we don't process events we just fired ourselves.
    const onStorage = (e: StorageEvent) => {
      if (e.key === KID_TOKEN_STORAGE_KEY && e.newValue === null) {
        // localStorage in this tab is already in sync (it's shared).
        // Calling clearKidToken is idempotent and gives FHS-205 a
        // single hook point to extend with re-render / redirect logic.
        clearKidToken();
      }
    };
    window.addEventListener('storage', onStorage);

    return () => {
      active = false;
      sub.subscription.unsubscribe();
      window.removeEventListener('storage', onStorage);
    };
  }, []);

  const value: AuthContextValue = {
    session,
    user: session?.user ?? null,
    loading,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error('useAuth must be used inside <AuthProvider>');
  }
  return ctx;
}

// FHS-253: kid JWT helpers. Family iPad is a shared device, so a
// parent sign-out must NOT leave the kid signed in (and an expired
// kid token must drop on read instead of sitting in localStorage
// forever). The kid-tab consumer middleware lands later (FHS-205);
// these helpers give every existing parent flow a single line to
// keep the iPad clean.

export const KID_TOKEN_STORAGE_KEY = 'fh.kid.token';

/**
 * Sign out *both* identities at once. Clears the Supabase parent
 * session AND the kid JWT. Use this from every TopNav "Log out"
 * trigger: calling supabase.auth.signOut() directly leaves
 * fh.kid.token behind on the device.
 *
 * Kid token comes off first so a network blip on the Supabase call
 * still removes the kid identity from the iPad.
 */
export async function signOutAll(): Promise<{ error: Error | null }> {
  clearKidToken();
  const { error } = await supabase.auth.signOut();
  return { error };
}

/**
 * Read the kid JWT from localStorage. Decodes the JWT `exp` claim
 * and returns null (and clears the token) when expired or
 * malformed. Centralising this so a future kid-only middleware
 * doesn't have to re-implement the timing-correct read.
 */
export function getKidToken(now: number = Date.now()): string | null {
  let raw: string | null;
  try {
    raw = localStorage.getItem(KID_TOKEN_STORAGE_KEY);
  } catch {
    return null;
  }
  if (!raw) return null;
  const segments = raw.split('.');
  if (segments.length !== 3) {
    // Not a JWT: drop it.
    clearKidToken();
    return null;
  }
  let claims: { exp?: number };
  try {
    // base64url → base64 + atob. atob is browser-native; the JWT
    // payload is a base64url-encoded JSON string.
    const b64 = segments[1]!.replace(/-/g, '+').replace(/_/g, '/');
    const padded = b64 + '='.repeat((4 - (b64.length % 4)) % 4);
    claims = JSON.parse(atob(padded)) as { exp?: number };
  } catch {
    clearKidToken();
    return null;
  }
  if (typeof claims.exp === 'number' && claims.exp * 1000 <= now) {
    clearKidToken();
    return null;
  }
  return raw;
}

export function clearKidToken(): void {
  try {
    localStorage.removeItem(KID_TOKEN_STORAGE_KEY);
  } catch {
    // Storage quota / privacy mode: best-effort, not fatal.
  }
}
