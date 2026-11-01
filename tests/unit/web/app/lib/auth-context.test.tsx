import { describe, it, expect, vi, beforeEach } from 'vitest';
import { act, render, screen, waitFor } from '@testing-library/react';
import type { Session } from '@supabase/supabase-js';

// vi.mock factories are hoisted above import statements; vi.hoisted()
// is the only safe way to share mutable refs (the captured
// onAuthStateChange callback, the getSession mock) between the factory
// and the test bodies.
const mocks = vi.hoisted(() => {
  return {
    authCallback: null as ((event: string, session: Session | null) => void) | null,
    getSessionMock: vi.fn(),
    signOutMock: vi.fn(),
    unsubscribeMock: vi.fn(),
  };
});

vi.mock('../../../../../src/app/lib/supabase', () => ({
  supabase: {
    auth: {
      getSession: mocks.getSessionMock,
      signOut: mocks.signOutMock,
      onAuthStateChange: (cb: (event: string, session: Session | null) => void) => {
        mocks.authCallback = cb;
        return { data: { subscription: { unsubscribe: mocks.unsubscribeMock } } };
      },
    },
  },
}));

// Imported AFTER vi.mock so the provider sees the mocked module.
import {
  AuthProvider,
  KID_TOKEN_STORAGE_KEY,
  clearKidToken,
  getKidToken,
  signOutAll,
  useAuth,
} from '../../../../../src/app/lib/auth-context';

function Probe() {
  const { session, user, loading } = useAuth();
  return (
    <div>
      <span data-testid="loading">{String(loading)}</span>
      <span data-testid="user-email">{user?.email ?? 'none'}</span>
      <span data-testid="session-id">{session?.access_token ?? 'none'}</span>
    </div>
  );
}

const fakeSession = (email: string): Session =>
  ({
    access_token: `token-${email}`,
    refresh_token: 'rt',
    token_type: 'bearer',
    expires_in: 3600,
    expires_at: 0,
    user: {
      id: 'user-id',
      email,
      app_metadata: {},
      user_metadata: {},
      aud: 'authenticated',
      created_at: '2026-01-01T00:00:00Z',
    },
  }) as unknown as Session;

describe('AuthProvider + useAuth', () => {
  beforeEach(() => {
    mocks.authCallback = null;
    mocks.getSessionMock.mockReset();
    mocks.unsubscribeMock.mockReset();
  });

  it('starts in loading state and clears once getSession resolves with no session', async () => {
    mocks.getSessionMock.mockResolvedValue({ data: { session: null } });

    render(
      <AuthProvider>
        <Probe />
      </AuthProvider>,
    );

    // Initial paint: loading=true.
    expect(screen.getByTestId('loading').textContent).toBe('true');

    await waitFor(() => {
      expect(screen.getByTestId('loading').textContent).toBe('false');
    });
    expect(screen.getByTestId('user-email').textContent).toBe('none');
  });

  it('exposes the session when SIGNED_IN fires', async () => {
    mocks.getSessionMock.mockResolvedValue({ data: { session: null } });

    render(
      <AuthProvider>
        <Probe />
      </AuthProvider>,
    );

    await waitFor(() => {
      expect(screen.getByTestId('loading').textContent).toBe('false');
    });

    await act(async () => {
      mocks.authCallback?.('SIGNED_IN', fakeSession('user@example.com'));
    });

    expect(screen.getByTestId('user-email').textContent).toBe('user@example.com');
    expect(screen.getByTestId('session-id').textContent).toBe('token-user@example.com');
  });

  it('clears the session when SIGNED_OUT fires', async () => {
    mocks.getSessionMock.mockResolvedValue({ data: { session: fakeSession('user@example.com') } });

    render(
      <AuthProvider>
        <Probe />
      </AuthProvider>,
    );

    await waitFor(() => {
      expect(screen.getByTestId('user-email').textContent).toBe('user@example.com');
    });

    await act(async () => {
      mocks.authCallback?.('SIGNED_OUT', null);
    });

    expect(screen.getByTestId('user-email').textContent).toBe('none');
    expect(screen.getByTestId('session-id').textContent).toBe('none');
  });

  it('unsubscribes on unmount to avoid setState on an unmounted component', async () => {
    mocks.getSessionMock.mockResolvedValue({ data: { session: null } });

    const { unmount } = render(
      <AuthProvider>
        <Probe />
      </AuthProvider>,
    );
    await waitFor(() => {
      expect(screen.getByTestId('loading').textContent).toBe('false');
    });

    unmount();

    expect(mocks.unsubscribeMock).toHaveBeenCalledTimes(1);
  });

  // FHS-253 (qa-expert blocker #8): when a parent signs in on a
  // device the kid was using, the kid's stale token must come off.
  it('clears fh.kid.token when SIGNED_IN fires (stale kid identity on parent log-in)', async () => {
    mocks.getSessionMock.mockResolvedValue({ data: { session: null } });
    localStorage.setItem(KID_TOKEN_STORAGE_KEY, 'kid-was-here-before-parent');

    render(
      <AuthProvider>
        <Probe />
      </AuthProvider>,
    );
    await waitFor(() => {
      expect(screen.getByTestId('loading').textContent).toBe('false');
    });

    await act(async () => {
      mocks.authCallback?.('SIGNED_IN', fakeSession('sarah@example.com'));
    });

    expect(localStorage.getItem(KID_TOKEN_STORAGE_KEY)).toBeNull();
  });

  // FHS-253 (qa-expert blocker #3): multi-tab: Tab A clears the
  // kid token, Tab B receives a storage event and stays consistent.
  it('listens for cross-tab storage events on fh.kid.token (forward-defensive for FHS-205)', async () => {
    mocks.getSessionMock.mockResolvedValue({ data: { session: null } });

    const { unmount } = render(
      <AuthProvider>
        <Probe />
      </AuthProvider>,
    );
    await waitFor(() => {
      expect(screen.getByTestId('loading').textContent).toBe('false');
    });

    // Simulate Tab A's signOutAll writing-then-removing fh.kid.token.
    // Tab B receives the storage event with newValue=null.
    localStorage.setItem(KID_TOKEN_STORAGE_KEY, 'leftover-from-this-tab');
    await act(async () => {
      window.dispatchEvent(
        new StorageEvent('storage', {
          key: KID_TOKEN_STORAGE_KEY,
          newValue: null,
          oldValue: 'leftover-from-this-tab',
          storageArea: localStorage,
        }),
      );
    });

    // Idempotent: clearKidToken ensures the local copy is gone too.
    expect(localStorage.getItem(KID_TOKEN_STORAGE_KEY)).toBeNull();

    unmount();
  });
});

// FHS-253: kid JWT helpers. The kid token lives in localStorage under
// fh.kid.token. Parent sign-out used to leave it behind; expired
// tokens used to sit forever. Both fixed in auth-context.tsx.

// Build a JWT-shaped string with a forged exp claim: we never
// verify the signature on the client, so any base64url payload works.
function fakeKidJwt(expSeconds: number): string {
  const header = btoa(JSON.stringify({ alg: 'HS256', typ: 'JWT' }))
    .replace(/=+$/, '')
    .replace(/\+/g, '-')
    .replace(/\//g, '_');
  const payload = btoa(JSON.stringify({ scope: 'child', exp: expSeconds }))
    .replace(/=+$/, '')
    .replace(/\+/g, '-')
    .replace(/\//g, '_');
  return `${header}.${payload}.signature-doesnt-matter-here`;
}

describe('signOutAll() (FHS-253)', () => {
  beforeEach(() => {
    mocks.signOutMock.mockReset();
    localStorage.clear();
  });

  it('clears fh.kid.token AND calls supabase signOut', async () => {
    localStorage.setItem(KID_TOKEN_STORAGE_KEY, 'parent-walked-away-token');
    mocks.signOutMock.mockResolvedValue({ error: null });

    const result = await signOutAll();

    expect(localStorage.getItem(KID_TOKEN_STORAGE_KEY)).toBeNull();
    expect(mocks.signOutMock).toHaveBeenCalledTimes(1);
    expect(result.error).toBeNull();
  });

  it('still clears the kid token even when supabase signOut errors', async () => {
    localStorage.setItem(KID_TOKEN_STORAGE_KEY, 'token-must-still-go');
    mocks.signOutMock.mockResolvedValue({ error: new Error('network blip') });

    const result = await signOutAll();

    // Most important assertion: a Supabase failure must NOT leave the
    // kid logged in on the iPad.
    expect(localStorage.getItem(KID_TOKEN_STORAGE_KEY)).toBeNull();
    expect(result.error?.message).toBe('network blip');
  });
});

describe('getKidToken() (FHS-253)', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('returns the token when the exp claim is in the future', () => {
    const future = Math.floor(Date.now() / 1000) + 600;
    const token = fakeKidJwt(future);
    localStorage.setItem(KID_TOKEN_STORAGE_KEY, token);

    expect(getKidToken()).toBe(token);
    // Read does not mutate when the token is valid.
    expect(localStorage.getItem(KID_TOKEN_STORAGE_KEY)).toBe(token);
  });

  it('returns null and clears the token when exp is in the past', () => {
    const past = Math.floor(Date.now() / 1000) - 60;
    localStorage.setItem(KID_TOKEN_STORAGE_KEY, fakeKidJwt(past));

    expect(getKidToken()).toBeNull();
    expect(localStorage.getItem(KID_TOKEN_STORAGE_KEY)).toBeNull();
  });

  it('returns null and clears when the token is malformed (not a JWT)', () => {
    localStorage.setItem(KID_TOKEN_STORAGE_KEY, 'not-a-jwt-at-all');

    expect(getKidToken()).toBeNull();
    expect(localStorage.getItem(KID_TOKEN_STORAGE_KEY)).toBeNull();
  });

  it('returns null when no kid token is stored', () => {
    expect(getKidToken()).toBeNull();
  });

  it('clearKidToken() drops the entry without touching anything else', () => {
    localStorage.setItem(KID_TOKEN_STORAGE_KEY, 'whatever');
    localStorage.setItem('unrelated.key', 'kept');
    clearKidToken();
    expect(localStorage.getItem(KID_TOKEN_STORAGE_KEY)).toBeNull();
    expect(localStorage.getItem('unrelated.key')).toBe('kept');
  });
});
