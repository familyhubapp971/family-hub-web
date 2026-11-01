import '@testing-library/jest-dom/vitest';
import { afterEach, vi } from 'vitest';
import { cleanup } from '@testing-library/react';

// Provide stub Vite env vars so modules that read import.meta.env at
// load time (src/app/lib/supabase.ts) don't throw during unit
// tests. Real values are injected by Vite at build time in dev/prod.
vi.stubEnv('VITE_SUPABASE_URL', 'http://localhost:54321');
vi.stubEnv('VITE_SUPABASE_ANON_KEY', 'test-anon-key');

afterEach(() => {
  cleanup();
});
