import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';

// FHS-366: kid Journal reuses JournalTab in kid mode: it talks to the
// token-scoped /api/kid/journal endpoints (no memberId param) using the kid
// token, not the parent Supabase session.
vi.mock('../../../../../src/app/lib/auth-context', () => ({
  useAuth: () => ({ session: null }),
}));
vi.mock('../../../../../src/app/lib/tenant-context', () => ({
  useTenantSlug: () => 'khan',
}));

import { KidJournalPanel } from '../../../../../src/areas/journal/KidJournalPanel';

const fetchMock = vi.fn();

beforeEach(() => {
  fetchMock.mockReset();
  fetchMock.mockImplementation((url: string, opts?: RequestInit) => {
    const u = String(url);
    if (u.includes('/api/kid/journal/earliest')) {
      return Promise.resolve({ ok: true, status: 200, json: async () => ({ earliestDate: null }) });
    }
    if (u.includes('/api/kid/journal/entries')) {
      return Promise.resolve({ ok: true, status: 200, json: async () => ({ entries: [] }) });
    }
    if (u.includes('/api/kid/journal')) {
      if (opts?.method === 'PUT') {
        return Promise.resolve({
          ok: true,
          status: 200,
          json: async () => ({
            id: 'j1',
            entryDate: '2026-06-22',
            mood: null,
            gratitude1: null,
            gratitude2: null,
            gratitude3: null,
            quoteIndex: 0,
            creativity: null,
            body: 'Fun day',
            createdAt: '2026-06-22T00:00:00.000Z',
            updatedAt: '2026-06-22T00:00:00.000Z',
          }),
        });
      }
      return Promise.resolve({
        ok: true,
        status: 200,
        json: async () => ({ entry: null, quoteIndex: 0 }),
      });
    }
    return Promise.resolve({ ok: true, status: 200, json: async () => ({}) });
  });
  vi.stubGlobal('fetch', fetchMock);
});
afterEach(() => vi.unstubAllGlobals());

describe('<KidJournalPanel />', () => {
  it('loads the day from the kid endpoint (token-scoped, no memberId)', async () => {
    render(<KidJournalPanel kidToken="kid.jwt" />);
    await waitFor(() => expect(screen.getByTestId('journal-tab')).toBeInTheDocument());
    const dayCall = fetchMock.mock.calls.find(([u]) =>
      /\/api\/kid\/journal\?date=/.test(String(u)),
    );
    expect(dayCall).toBeTruthy();
    expect(String(dayCall![0])).not.toContain('memberId');
  });

  // FHS-376: the kid Journal is read-only: Past Entries only, no "My Journal"
  // write form and no write/sub-tab toggle. Parents author entries.
  it('shows past entries only: no write form or sub-tab toggle', async () => {
    render(<KidJournalPanel kidToken="kid.jwt" />);
    await waitFor(() => expect(screen.getByTestId('journal-tab')).toBeInTheDocument());
    expect(screen.queryByTestId('journal-subtab-write')).not.toBeInTheDocument();
    expect(screen.queryByTestId('journal-subtab-past')).not.toBeInTheDocument();
    expect(screen.queryByTestId('journal-body')).not.toBeInTheDocument();
    expect(screen.getByTestId('journal-past-empty')).toBeInTheDocument();
  });
});
