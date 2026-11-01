import { describe, it, expect, vi } from 'vitest';

// The module builds the real client at import; only the pure config is under test.
vi.mock('@supabase/supabase-js', () => ({ createClient: vi.fn(() => ({})) }));

const { authClientConfig } = await import('../../../../../src/app/lib/supabase');

// FHS-696: VITE_AUTH_URL moves sign-in from Supabase to our own server.
describe('authClientConfig', () => {
  it('uses Supabase when VITE_AUTH_URL is unset', () => {
    expect(
      authClientConfig({
        VITE_SUPABASE_URL: 'https://abc.supabase.co',
        VITE_SUPABASE_ANON_KEY: 'anon',
      }),
    ).toEqual({ url: 'https://abc.supabase.co', key: 'anon' });
  });

  it('uses our own server when VITE_AUTH_URL is set, even with Supabase settings present', () => {
    expect(
      authClientConfig({
        VITE_AUTH_URL: 'https://fh-api-staging.up.railway.app/',
        VITE_SUPABASE_URL: 'https://abc.supabase.co',
        VITE_SUPABASE_ANON_KEY: 'anon',
      }),
    ).toEqual({ url: 'https://fh-api-staging.up.railway.app', key: 'anon' });
  });

  it('needs no Supabase key once our own server is used', () => {
    const cfg = authClientConfig({ VITE_AUTH_URL: 'https://fh-api-staging.up.railway.app' });
    expect(cfg).toEqual({ url: 'https://fh-api-staging.up.railway.app', key: 'gotrue' });
  });

  it('treats a mistyped address as missing instead of crashing the site', () => {
    expect(authClientConfig({ VITE_AUTH_URL: 'not a url' }).url).toBeUndefined();
    expect(authClientConfig({ VITE_SUPABASE_URL: 'fh-api-staging' }).url).toBeUndefined();
  });
});
