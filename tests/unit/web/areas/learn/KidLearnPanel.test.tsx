import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor, fireEvent, act } from '@testing-library/react';

// FHS-367 / FHS-373: kid Learn reuses LearnTab in kid mode: lesson subjects +
// World Flags + reading log via the token-scoped kid endpoints (no memberId).
vi.mock('../../../../../src/app/lib/auth-context', () => ({
  useAuth: () => ({ session: null }),
}));
vi.mock('../../../../../src/app/lib/tenant-context', () => ({
  useTenantSlug: () => 'khan',
  TenantProvider: ({ children }: { children: React.ReactNode }) => children,
}));
vi.mock('react-leaflet', () => ({
  MapContainer: ({ children }: { children?: unknown }) => children ?? null,
  TileLayer: () => null,
  Marker: ({ children }: { children?: unknown }) => children ?? null,
  Popup: ({ children }: { children?: unknown }) => children ?? null,
}));
vi.mock('leaflet', () => ({ default: { icon: () => ({}) }, icon: () => ({}) }));

import { KidLearnPanel } from '../../../../../src/areas/learn/KidLearnPanel';

const fetchMock = vi.fn();

function installFetch() {
  fetchMock.mockImplementation((url: string, opts?: RequestInit) => {
    const u = String(url);
    if (u.includes('/api/kid/learn')) {
      return Promise.resolve({
        ok: true,
        status: 200,
        json: async () => ({
          subjects: [
            { subject: 'Maths', progress: 20 },
            { subject: 'Science', progress: 0 },
            { subject: 'Logic', progress: 0 },
          ],
        }),
      });
    }
    if (u.includes('/api/kid/world-flags')) {
      if (opts?.method === 'POST') {
        return Promise.resolve({ ok: true, status: 200, json: async () => ({ explored: true }) });
      }
      // GET /api/kid/world-flags and /api/kid/world-flags/learn
      if (u.includes('/learn')) {
        return Promise.resolve({ ok: true, status: 200, json: async () => ({ progress: {} }) });
      }
      return Promise.resolve({ ok: true, status: 200, json: async () => ({ explored: [] }) });
    }
    if (u.includes('/api/kid/reading-log')) {
      if (opts?.method === 'POST') {
        return Promise.resolve({
          ok: true,
          status: 201,
          json: async () => ({
            id: 'b1',
            title: 'Matilda',
            author: null,
            finished: false,
            createdAt: '2026-06-22T00:00:00.000Z',
          }),
        });
      }
      return Promise.resolve({ ok: true, status: 200, json: async () => ({ books: [] }) });
    }
    return Promise.resolve({ ok: true, status: 200, json: async () => ({}) });
  });
}

beforeEach(() => {
  fetchMock.mockReset();
  installFetch();
  vi.stubGlobal('fetch', fetchMock);
  localStorage.clear();
});
afterEach(() => vi.unstubAllGlobals());

describe('<KidLearnPanel />', () => {
  it('renders the kid lesson subjects from the kid endpoint (no memberId)', async () => {
    render(<KidLearnPanel kidToken="kid.jwt" />);
    await waitFor(() => expect(screen.getByTestId('learn-tab')).toBeInTheDocument());
    expect(screen.getByText('Maths')).toBeInTheDocument();
    const learnCall = fetchMock.mock.calls.find(([u]) => /\/api\/kid\/learn(\?|$)/.test(String(u)));
    expect(learnCall).toBeTruthy();
    expect(String(learnCall![0])).not.toContain('memberId');
  });

  it('adds a book via POST /api/kid/reading-log with no memberId', async () => {
    render(<KidLearnPanel kidToken="kid.jwt" />);
    await waitFor(() => expect(screen.getByTestId('reading-log')).toBeInTheDocument());
    fireEvent.change(screen.getByTestId('reading-log-add-title'), { target: { value: 'Matilda' } });
    await act(async () => {
      fireEvent.click(screen.getByTestId('reading-log-add-submit'));
    });
    await waitFor(() => {
      const post = fetchMock.mock.calls.find(
        ([u, o]) =>
          String(u).includes('/api/kid/reading-log') && (o as RequestInit)?.method === 'POST',
      );
      expect(post).toBeTruthy();
      const body = JSON.parse((post![1] as RequestInit).body as string) as Record<string, unknown>;
      expect(body.title).toBe('Matilda');
      expect(body.memberId).toBeUndefined();
    });
  });

  // FHS-373: World Flags card present + hits /api/kid/world-flags in kid mode.
  it('shows the World Flags subject card in kid mode', async () => {
    render(<KidLearnPanel kidToken="kid.jwt" />);
    await waitFor(() => expect(screen.getByTestId('learn-tab')).toBeInTheDocument());
    expect(screen.getByTestId('learn-subject-world-flags')).toBeInTheDocument();
  });

  it('opening World Flags in kid mode fetches /api/kid/world-flags with kid Bearer token', async () => {
    render(<KidLearnPanel kidToken="kid.jwt" />);
    await waitFor(() => expect(screen.getByTestId('learn-tab')).toBeInTheDocument());
    await act(async () => {
      fireEvent.click(screen.getByTestId('learn-subject-world-flags'));
    });
    // Default tab is Learn: click Explore to trigger the explore fetch.
    await waitFor(() => expect(screen.getByTestId('world-subtab-explore')).toBeInTheDocument());
    await act(async () => {
      fireEvent.click(screen.getByTestId('world-subtab-explore'));
    });
    await waitFor(() => expect(screen.getByTestId('world-flashcard')).toBeInTheDocument());

    // Verify the GET went to /api/kid/world-flags, not /api/world-flags.
    const kidCall = (fetchMock.mock.calls as [string, RequestInit | undefined][]).find(
      ([url, init]) =>
        String(url).includes('/api/kid/world-flags') && (init?.method ?? 'GET') === 'GET',
    );
    expect(kidCall).toBeTruthy();
    expect(String(kidCall![0])).not.toContain('memberId');
    const headers = kidCall![1]?.headers as Record<string, string> | undefined;
    expect(headers?.Authorization).toBe('Bearer kid.jwt');
    expect(headers?.['x-tenant-slug']).toBeUndefined();
  });
});
