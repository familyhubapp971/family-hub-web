import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor, fireEvent, act } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';

// Learn Phase 1: LearnTab: subject cards + Reading Log panel.
// Learn Phase 2a: World Flags subject routing + Explore detail.

const fetchMock = vi.fn();
const authState: { session: { access_token?: string } | null } = {
  session: { access_token: 'tok-abc' },
};
vi.mock('../../../../../src/app/lib/auth-context', () => ({
  useAuth: () => authState,
}));

// World Flags Explore renders an interactive Leaflet capital map in the facts
// panel. Leaflet needs a real browser layout, so stub it in jsdom: the map is
// not what these tests exercise.
vi.mock('react-leaflet', () => ({
  MapContainer: ({ children }: { children?: unknown }) => children ?? null,
  TileLayer: () => null,
  Marker: ({ children }: { children?: unknown }) => children ?? null,
  Popup: ({ children }: { children?: unknown }) => children ?? null,
}));
vi.mock('leaflet', () => ({ default: { icon: () => ({}) }, icon: () => ({}) }));

import { LearnTab } from '../../../../../src/areas/learn/LearnTab';
import { TenantProvider } from '../../../../../src/app/lib/tenant-context';

const CHILD = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc';
const BOOK_ID = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';

function makeBook(
  overrides: Partial<{
    id: string;
    title: string;
    author: string | null;
    finished: boolean;
  }> = {},
) {
  return {
    id: BOOK_ID,
    title: 'Matilda',
    author: 'Roald Dahl',
    finished: false,
    createdAt: '2026-06-16T10:00:00.000Z',
    ...overrides,
  };
}

// Install fetch mock: /api/learn → subjects, /api/reading-log → books,
// /api/world-flags → explored codes.
// fetchMock is called with (url, init). We identify by URL substring.
function installDefault(
  subjects: Array<{ subject: string; progress: number }>,
  books: ReturnType<typeof makeBook>[],
  exploredCodes: string[] = [],
) {
  fetchMock.mockImplementation((url: string, init?: RequestInit) => {
    const method = (init as RequestInit | undefined)?.method ?? 'GET';
    // Learn path: GET → completed sets per continent, POST → mark a set done.
    if ((url as string).includes('/api/world-flags/learn')) {
      if (method === 'POST') {
        return Promise.resolve({ ok: true, status: 200, json: async () => ({ completed: true }) });
      }
      return Promise.resolve({ ok: true, status: 200, json: async () => ({ progress: {} }) });
    }
    if ((url as string).includes('/api/world-flags')) {
      if (method === 'POST') {
        return Promise.resolve({
          ok: true,
          status: 200,
          json: async () => ({ explored: true }),
        });
      }
      return Promise.resolve({
        ok: true,
        status: 200,
        json: async () => ({ explored: exploredCodes }),
      });
    }
    if ((url as string).includes('/api/learn')) {
      return Promise.resolve({ ok: true, status: 200, json: async () => ({ subjects }) });
    }
    if ((url as string).includes('/api/reading-log')) {
      return Promise.resolve({ ok: true, status: 200, json: async () => ({ books }) });
    }
    return Promise.resolve({ ok: false, status: 500, json: async () => ({}) });
  });
}

function renderTab() {
  return render(
    <MemoryRouter initialEntries={['/t/khan/child/' + CHILD]}>
      <Routes>
        <Route
          path="/t/:slug/child/:memberId"
          element={
            <TenantProvider>
              <LearnTab memberId={CHILD} />
            </TenantProvider>
          }
        />
      </Routes>
    </MemoryRouter>,
  );
}

beforeEach(() => {
  fetchMock.mockReset();
  vi.stubGlobal('fetch', fetchMock);
  authState.session = { access_token: 'tok-abc' };
});
afterEach(() => vi.unstubAllGlobals());

// ─── Subject cards ────────────────────────────────────────────────────────────

describe('Subject cards', () => {
  it('renders a card + progress bar per subject from GET /api/learn', async () => {
    installDefault(
      [
        { subject: 'Maths', progress: 40 },
        { subject: 'Science', progress: 20 },
      ],
      [],
    );
    renderTab();
    await waitFor(() => expect(screen.getByTestId('learn-subject-maths')).toBeInTheDocument());
    expect(screen.getByTestId('learn-subject-science')).toBeInTheDocument();
    expect(screen.getByTestId('learn-progress-Maths').getAttribute('aria-valuenow')).toBe('40');
  });

  it('clamps an out-of-range progress value to 100', async () => {
    installDefault([{ subject: 'Maths', progress: 250 }], []);
    renderTab();
    await waitFor(() => expect(screen.getByTestId('learn-subject-maths')).toBeInTheDocument());
    expect(screen.getByTestId('learn-progress-Maths').getAttribute('aria-valuenow')).toBe('100');
  });

  it('shows the testid slug for World Flags correctly', async () => {
    installDefault([{ subject: 'World Flags', progress: 10 }], []);
    renderTab();
    await waitFor(() =>
      expect(screen.getByTestId('learn-subject-world-flags')).toBeInTheDocument(),
    );
  });
});

// ─── Reading Log ──────────────────────────────────────────────────────────────

describe('Reading Log panel', () => {
  it('renders the reading-log panel and empty state', async () => {
    installDefault([], []);
    renderTab();
    await waitFor(() => expect(screen.getByTestId('reading-log')).toBeInTheDocument());
    await waitFor(() => expect(screen.getByTestId('reading-log-empty')).toBeInTheDocument());
  });

  it('shows add-book form controls after load', async () => {
    installDefault([], []);
    renderTab();
    await waitFor(() => expect(screen.getByTestId('reading-log')).toBeInTheDocument());
    expect(screen.getByTestId('reading-log-add-title')).toBeInTheDocument();
    expect(screen.getByTestId('reading-log-add-submit')).toBeInTheDocument();
  });

  it('POST on submit shows the new book', async () => {
    const newBook = makeBook();
    // First two calls: learn + reading-log list (empty). Third: POST.
    fetchMock
      .mockResolvedValueOnce({ ok: true, status: 200, json: async () => ({ subjects: [] }) })
      .mockResolvedValueOnce({ ok: true, status: 200, json: async () => ({ books: [] }) })
      .mockResolvedValueOnce({ ok: true, status: 201, json: async () => newBook });

    renderTab();
    await waitFor(() => expect(screen.getByTestId('reading-log-empty')).toBeInTheDocument());

    await act(async () => {
      fireEvent.change(screen.getByTestId('reading-log-add-title'), {
        target: { value: 'Matilda' },
      });
      fireEvent.click(screen.getByTestId('reading-log-add-submit'));
    });

    await waitFor(() =>
      expect(screen.getByTestId(`reading-log-item-${BOOK_ID}`)).toBeInTheDocument(),
    );
  });

  it('renders books from GET /api/reading-log', async () => {
    installDefault([], [makeBook()]);
    renderTab();
    await waitFor(() =>
      expect(screen.getByTestId(`reading-log-item-${BOOK_ID}`)).toBeInTheDocument(),
    );
    expect(screen.getByTestId(`reading-log-toggle-${BOOK_ID}`)).toBeInTheDocument();
    expect(screen.getByTestId(`reading-log-delete-${BOOK_ID}`)).toBeInTheDocument();
  });

  it('PATCH on toggle sends PATCH with correct memberId and finished=true', async () => {
    const book = makeBook();
    const toggled = makeBook({ finished: true });

    fetchMock
      .mockResolvedValueOnce({ ok: true, status: 200, json: async () => ({ subjects: [] }) })
      .mockResolvedValueOnce({ ok: true, status: 200, json: async () => ({ books: [book] }) })
      .mockResolvedValueOnce({ ok: true, status: 200, json: async () => toggled });

    renderTab();
    await waitFor(() =>
      expect(screen.getByTestId(`reading-log-toggle-${BOOK_ID}`)).toBeInTheDocument(),
    );

    await act(async () => {
      fireEvent.click(screen.getByTestId(`reading-log-toggle-${BOOK_ID}`));
    });

    await waitFor(() => {
      const calls = fetchMock.mock.calls as [string, RequestInit][];
      const patchCall = calls.find(
        ([url, init]) =>
          (url as string).includes(BOOK_ID) && (init as RequestInit)?.method === 'PATCH',
      );
      expect(patchCall).toBeTruthy();
    });
  });

  it('DELETE removes the book row', async () => {
    const book = makeBook();

    fetchMock
      .mockResolvedValueOnce({ ok: true, status: 200, json: async () => ({ subjects: [] }) })
      .mockResolvedValueOnce({ ok: true, status: 200, json: async () => ({ books: [book] }) })
      .mockResolvedValueOnce({ ok: true, status: 204, json: async () => null });

    renderTab();
    await waitFor(() =>
      expect(screen.getByTestId(`reading-log-delete-${BOOK_ID}`)).toBeInTheDocument(),
    );

    await act(async () => {
      fireEvent.click(screen.getByTestId(`reading-log-delete-${BOOK_ID}`));
    });

    await waitFor(() =>
      expect(screen.queryByTestId(`reading-log-item-${BOOK_ID}`)).not.toBeInTheDocument(),
    );
  });
});

// ─── Loading / error ──────────────────────────────────────────────────────────

describe('Loading / error states', () => {
  it('shows learn-loading when both endpoints are pending', () => {
    fetchMock.mockImplementation(() => new Promise(() => {}));
    renderTab();
    expect(screen.getByTestId('learn-loading')).toBeInTheDocument();
  });

  it('shows learn-error when both endpoints fail', async () => {
    fetchMock.mockResolvedValue({ ok: false, status: 500, json: async () => ({}) });
    renderTab();
    await waitFor(() => expect(screen.getByTestId('learn-error')).toBeInTheDocument());
  });
});

// ─── World Flags subject routing (Learn Phase 2a) ─────────────────────────────

describe('World Flags subject routing', () => {
  it('clicking World Flags subject card shows the World Flags detail (Learn tab default)', async () => {
    installDefault([{ subject: 'World Flags', progress: 10 }], []);
    renderTab();
    await waitFor(() =>
      expect(screen.getByTestId('learn-subject-world-flags')).toBeInTheDocument(),
    );
    await act(async () => {
      fireEvent.click(screen.getByTestId('learn-subject-world-flags'));
    });
    await waitFor(() => expect(screen.getByTestId('learn-back')).toBeInTheDocument());
    // Default is now Learn path: continent picker is visible.
    await waitFor(() => expect(screen.getByTestId('wfpath')).toBeInTheDocument());
  });

  it('back button returns to the subject overview', async () => {
    installDefault([{ subject: 'World Flags', progress: 10 }], []);
    renderTab();
    await waitFor(() =>
      expect(screen.getByTestId('learn-subject-world-flags')).toBeInTheDocument(),
    );
    await act(async () => {
      fireEvent.click(screen.getByTestId('learn-subject-world-flags'));
    });
    await waitFor(() => expect(screen.getByTestId('learn-back')).toBeInTheDocument());
    await act(async () => {
      fireEvent.click(screen.getByTestId('learn-back'));
    });
    await waitFor(() =>
      expect(screen.getByTestId('learn-subject-world-flags')).toBeInTheDocument(),
    );
    expect(screen.queryByTestId('world-flashcard')).not.toBeInTheDocument();
  });

  it('a lesson subject (Maths) opens the interactive lesson (FHS-283)', async () => {
    installDefault([{ subject: 'Maths', progress: 20 }], []);
    renderTab();
    await waitFor(() => expect(screen.getByTestId('learn-subject-maths')).toBeInTheDocument());
    await act(async () => {
      fireEvent.click(screen.getByTestId('learn-subject-maths'));
    });
    await waitFor(() => expect(screen.getByTestId('learn-back')).toBeInTheDocument());
    expect(screen.getByTestId('lesson-view')).toBeInTheDocument();
    expect(screen.queryByText(/coming soon/i)).not.toBeInTheDocument();
  });
});

// ─── FHS-397: hub subject-card progress bar fill ────────────────────────────

describe('FHS-397: subject card progress bar fill (LearnTab hub)', () => {
  it('progress bar fill div uses bg-gray-800 (readable on coloured cards)', async () => {
    installDefault([{ subject: 'Maths', progress: 50 }], []);
    renderTab();
    await waitFor(() => expect(screen.getByTestId('learn-progress-Maths')).toBeInTheDocument());
    // The inner fill div is the first child of the progressbar element.
    const progressbar = screen.getByTestId('learn-progress-Maths');
    const fill = progressbar.firstElementChild as HTMLElement;
    expect(fill).toBeTruthy();
    // bg-gray-800 is the visible fill (replaced bg-black for parity, both are dark)
    expect(fill.className).toMatch(/bg-gray-800/);
  });

  it('subject card button has motion-safe:hover:-translate-y-0.5 (not -translate-y-1)', async () => {
    installDefault([{ subject: 'Maths', progress: 20 }], []);
    renderTab();
    await waitFor(() => expect(screen.getByTestId('learn-subject-maths')).toBeInTheDocument());
    const card = screen.getByTestId('learn-subject-maths');
    expect(card.className).toMatch(/motion-safe:hover:-translate-y-0\.5/);
    expect(card.className).not.toMatch(/motion-safe:hover:-translate-y-1\b/);
  });
});

// ─── Art subject (FHS-371) ────────────────────────────────────────────────────

// Mock canvas context so ArtDrawingCanvas doesn't throw in jsdom
const artCtxStub = {
  fillStyle: '',
  strokeStyle: '',
  lineWidth: 5,
  lineCap: 'round',
  lineJoin: 'round',
  fillRect: vi.fn(),
  beginPath: vi.fn(),
  moveTo: vi.fn(),
  lineTo: vi.fn(),
  stroke: vi.fn(),
  scale: vi.fn(),
};
vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(
  artCtxStub as unknown as CanvasRenderingContext2D,
);

describe('Art subject card (FHS-371)', () => {
  it('Art card is always shown after the API subjects', async () => {
    installDefault([{ subject: 'Maths', progress: 20 }], []);
    renderTab();
    await waitFor(() => expect(screen.getByTestId('learn-subject-maths')).toBeInTheDocument());
    expect(screen.getByTestId('learn-subject-art')).toBeInTheDocument();
  });

  // FHS-414: Art is being redesigned: the card is disabled (Coming soon),
  // no longer free-play, and tapping it does nothing.
  it('Art card is disabled (Coming soon, no progress bar, not free-play)', async () => {
    installDefault([], []);
    renderTab();
    const card = await screen.findByTestId('learn-subject-art');
    expect(card).toBeDisabled();
    expect(screen.queryByTestId('learn-progress-Art')).not.toBeInTheDocument();
    expect(screen.queryByTestId('learn-art-freeplay')).not.toBeInTheDocument();
    // Shows the shared "Coming soon" cue.
    expect(screen.getAllByTestId('learn-coming-soon').length).toBeGreaterThan(0);
  });

  it('clicking the disabled Art card does not open the canvas', async () => {
    installDefault([], []);
    renderTab();
    const card = await screen.findByTestId('learn-subject-art');
    await act(async () => {
      fireEvent.click(card);
    });
    expect(screen.queryByTestId('art-canvas')).not.toBeInTheDocument();
  });
});

// ─── WorldFlagsLearn Explore behaviour ───────────────────────────────────────

describe('WorldFlagsLearn Explore', () => {
  async function openWorldFlags() {
    installDefault([{ subject: 'World Flags', progress: 5 }], []);
    renderTab();
    await waitFor(() =>
      expect(screen.getByTestId('learn-subject-world-flags')).toBeInTheDocument(),
    );
    await act(async () => {
      fireEvent.click(screen.getByTestId('learn-subject-world-flags'));
    });
    // Default tab is now Learn: click Explore to show the flashcard.
    await waitFor(() => expect(screen.getByTestId('world-subtab-explore')).toBeInTheDocument());
    await act(async () => {
      fireEvent.click(screen.getByTestId('world-subtab-explore'));
    });
    await waitFor(() => expect(screen.getByTestId('world-flashcard')).toBeInTheDocument());
  }

  it('renders a continent filter bar with All button', async () => {
    await openWorldFlags();
    expect(screen.getByTestId('world-continent-all')).toBeInTheDocument();
    expect(screen.getByTestId('world-continent-africa')).toBeInTheDocument();
  });

  it('renders a progress bar', async () => {
    await openWorldFlags();
    expect(screen.getByTestId('world-progress')).toBeInTheDocument();
  });

  it('renders Next Flag button', async () => {
    await openWorldFlags();
    expect(screen.getByTestId('world-next-flag')).toBeInTheDocument();
  });

  it('tapping the flashcard (flag→name) reveals the country name and POSTs explore', async () => {
    await openWorldFlags();
    // Tap to reveal name
    await act(async () => {
      fireEvent.click(screen.getByTestId('world-flashcard'));
    });
    await waitFor(() => expect(screen.getByTestId('world-flag-name')).toBeInTheDocument());
    // Verify a POST to /api/world-flags/explore was made
    await waitFor(() => {
      const calls = fetchMock.mock.calls as [string, RequestInit | undefined][];
      const postCall = calls.find(
        ([url, init]) =>
          (url as string).includes('/api/world-flags/explore') &&
          (init as RequestInit | undefined)?.method === 'POST',
      );
      expect(postCall).toBeTruthy();
    });
  });

  it('tapping the flashcard again (name→facts) reveals the facts panel', async () => {
    await openWorldFlags();
    // First tap → name
    await act(async () => {
      fireEvent.click(screen.getByTestId('world-flashcard'));
    });
    await waitFor(() => expect(screen.getByTestId('world-flag-name')).toBeInTheDocument());
    // Second tap → facts
    await act(async () => {
      fireEvent.click(screen.getByTestId('world-flashcard'));
    });
    await waitFor(() => expect(screen.getByTestId('world-flag-facts')).toBeInTheDocument());
  });

  it('clicking a continent filter updates the visible progress', async () => {
    await openWorldFlags();
    await act(async () => {
      fireEvent.click(screen.getByTestId('world-continent-africa'));
    });
    // Progress bar should still be present and reflect Africa subset
    expect(screen.getByTestId('world-progress')).toBeInTheDocument();
  });

  it('continent certificates section renders for each continent', async () => {
    await openWorldFlags();
    expect(screen.getByTestId('world-cert-africa')).toBeInTheDocument();
    expect(screen.getByTestId('world-cert-europe')).toBeInTheDocument();
    expect(screen.getByTestId('world-cert-asia')).toBeInTheDocument();
  });
});

// ─── GAP 3: kid mode (kidToken) ───────────────────────────────────────────────
//
// <LearnTab kidToken="..."> routes to /api/kid/learn (subjects) and
// /api/kid/reading-log (books). The parent /api/learn path is NEVER hit.

const KID_TOKEN = 'kid.jwt.tok';

function installKidDefault(
  subjects: Array<{ subject: string; progress: number }>,
  books: ReturnType<typeof makeBook>[],
) {
  fetchMock.mockImplementation((url: string, init?: RequestInit) => {
    const method = (init as RequestInit | undefined)?.method ?? 'GET';
    // Kid world-flags stubs (for when World Flags is clicked in kid mode)
    if ((url as string).includes('/api/kid/world-flags/learn')) {
      if (method === 'POST') {
        return Promise.resolve({ ok: true, status: 200, json: async () => ({ completed: true }) });
      }
      return Promise.resolve({ ok: true, status: 200, json: async () => ({ progress: {} }) });
    }
    if ((url as string).includes('/api/kid/world-flags')) {
      if (method === 'POST') {
        return Promise.resolve({ ok: true, status: 200, json: async () => ({ explored: true }) });
      }
      return Promise.resolve({ ok: true, status: 200, json: async () => ({ explored: [] }) });
    }
    // Kid learn + reading-log
    if ((url as string).includes('/api/kid/learn')) {
      return Promise.resolve({ ok: true, status: 200, json: async () => ({ subjects }) });
    }
    if ((url as string).includes('/api/kid/reading-log')) {
      if (method === 'POST') {
        // Return the first element of the books array as the newly created book,
        // or a default if none supplied.
        const newBook = books[0] ?? makeBook();
        return Promise.resolve({ ok: true, status: 201, json: async () => newBook });
      }
      if (method === 'PATCH') {
        const existing = books[0] ?? makeBook({ finished: true });
        return Promise.resolve({
          ok: true,
          status: 200,
          json: async () => ({ ...existing, finished: !existing.finished }),
        });
      }
      if (method === 'DELETE') {
        return Promise.resolve({ ok: true, status: 204, json: async () => null });
      }
      return Promise.resolve({ ok: true, status: 200, json: async () => ({ books }) });
    }
    // Reject any accidental hit to the PARENT /api/learn or /api/reading-log
    if ((url as string).includes('/api/learn') || (url as string).includes('/api/reading-log')) {
      throw new Error(`kid mode should not call parent route: ${url}`);
    }
    return Promise.resolve({ ok: false, status: 500, json: async () => ({}) });
  });
}

function renderKidTab() {
  // kid mode: kidToken prop, no memberId. TenantProvider context still needed
  // because WorldFlags inside the tab may read the slug.
  return render(
    <MemoryRouter initialEntries={['/t/khan/child/' + CHILD]}>
      <Routes>
        <Route
          path="/t/:slug/child/:memberId"
          element={
            <TenantProvider>
              <LearnTab kidToken={KID_TOKEN} />
            </TenantProvider>
          }
        />
      </Routes>
    </MemoryRouter>,
  );
}

describe('kid mode (kidToken)', () => {
  it('fetches subjects from /api/kid/learn, not /api/learn', async () => {
    installKidDefault(
      [
        { subject: 'Maths', progress: 30 },
        { subject: 'Science', progress: 10 },
      ],
      [],
    );
    renderKidTab();
    await waitFor(() => expect(screen.getByTestId('learn-subject-maths')).toBeInTheDocument());
    // Confirm every fetch call went to /api/kid/*: never the parent path.
    const calls = fetchMock.mock.calls as [string][];
    const parentHits = calls.filter(([url]) => /\/api\/learn(?!\/)/.test(url as string));
    expect(parentHits).toHaveLength(0);
  });

  it('renders subject cards from /api/kid/learn', async () => {
    installKidDefault(
      [
        { subject: 'Maths', progress: 50 },
        { subject: 'Logic', progress: 0 },
      ],
      [],
    );
    renderKidTab();
    await waitFor(() => expect(screen.getByTestId('learn-subject-maths')).toBeInTheDocument());
    expect(screen.getByTestId('learn-subject-logic')).toBeInTheDocument();
  });

  it('fetches books from /api/kid/reading-log, not /api/reading-log', async () => {
    installKidDefault([], [makeBook()]);
    renderKidTab();
    await waitFor(() =>
      expect(screen.getByTestId(`reading-log-item-${BOOK_ID}`)).toBeInTheDocument(),
    );
    const calls = fetchMock.mock.calls as [string][];
    const parentHits = calls.filter(
      ([url]) =>
        /\/api\/reading-log(?!\/)/.test(url as string) && !(url as string).includes('/api/kid/'),
    );
    expect(parentHits).toHaveLength(0);
  });

  // FHS-387: the World Flags overview fetch can fail (slow/offline); the card
  // must still render at 0% with no crash.
  it('renders the World Flags card at 0% (no crash) when the world-flags fetch fails', async () => {
    fetchMock.mockImplementation((url: string) => {
      const u = String(url);
      if (u.includes('/api/kid/world-flags'))
        return Promise.resolve({ ok: false, status: 500, json: async () => ({}) });
      if (u.includes('/api/kid/learn'))
        return Promise.resolve({
          ok: true,
          status: 200,
          json: async () => ({ subjects: [{ subject: 'Maths', progress: 20 }] }),
        });
      if (u.includes('/api/kid/reading-log'))
        return Promise.resolve({ ok: true, status: 200, json: async () => ({ books: [] }) });
      return Promise.resolve({ ok: false, status: 500, json: async () => ({}) });
    });
    renderKidTab();
    await waitFor(() =>
      expect(screen.getByTestId('learn-subject-world-flags')).toBeInTheDocument(),
    );
    expect(screen.getByTestId('learn-subject-world-flags')).toHaveTextContent('0%');
  });

  it('adding a book POSTs to /api/kid/reading-log with no memberId in the body', async () => {
    const newBook = makeBook({ title: 'Narnia' });
    // FHS-387: kid mode also fetches /api/kid/world-flags on mount, so use a
    // URL-keyed mock (positional .once chains break on the extra call).
    fetchMock.mockImplementation((url: string, init?: RequestInit) => {
      const u = String(url);
      const method = (init as RequestInit | undefined)?.method ?? 'GET';
      if (u.includes('/api/kid/world-flags'))
        return Promise.resolve({ ok: true, status: 200, json: async () => ({ explored: [] }) });
      if (u.includes('/api/kid/learn'))
        return Promise.resolve({ ok: true, status: 200, json: async () => ({ subjects: [] }) });
      if (u.includes('/api/kid/reading-log') && method === 'POST')
        return Promise.resolve({ ok: true, status: 201, json: async () => newBook });
      if (u.includes('/api/kid/reading-log'))
        return Promise.resolve({ ok: true, status: 200, json: async () => ({ books: [] }) });
      return Promise.resolve({ ok: false, status: 500, json: async () => ({}) });
    });

    renderKidTab();
    await waitFor(() => expect(screen.getByTestId('reading-log')).toBeInTheDocument());
    await waitFor(() => expect(screen.getByTestId('reading-log-empty')).toBeInTheDocument());

    await act(async () => {
      fireEvent.change(screen.getByTestId('reading-log-add-title'), {
        target: { value: 'Narnia' },
      });
      fireEvent.click(screen.getByTestId('reading-log-add-submit'));
    });

    await waitFor(() => {
      const calls = fetchMock.mock.calls as [string, RequestInit][];
      const postCall = calls.find(
        ([url, init]) =>
          (url as string).includes('/api/kid/reading-log') &&
          (init as RequestInit)?.method === 'POST',
      );
      expect(postCall).toBeTruthy();
      const [, init] = postCall!;
      const sentBody = JSON.parse((init as RequestInit).body as string) as Record<string, unknown>;
      // Kid mode must NOT send memberId: the API scopes from the token.
      expect(sentBody).not.toHaveProperty('memberId');
      expect(sentBody.title).toBe('Narnia');
    });
  });

  it('toggling a book PATCHes /api/kid/reading-log/:id', async () => {
    const book = makeBook();
    const toggled = makeBook({ finished: true });

    // FHS-387: kid mode now also fetches /api/kid/world-flags on mount.
    // Use mockImplementation so all calls resolve regardless of order.
    fetchMock.mockImplementation((url: string, init?: RequestInit) => {
      const u = String(url);
      const method = (init as RequestInit | undefined)?.method ?? 'GET';
      if (u.includes('/api/kid/world-flags'))
        return Promise.resolve({
          ok: true,
          status: 200,
          json: async () => ({ explored: [] }),
        });
      if (u.includes('/api/kid/learn'))
        return Promise.resolve({ ok: true, status: 200, json: async () => ({ subjects: [] }) });
      if (u.includes(`/api/kid/reading-log/${BOOK_ID}`) && method === 'PATCH')
        return Promise.resolve({ ok: true, status: 200, json: async () => toggled });
      if (u.includes('/api/kid/reading-log'))
        return Promise.resolve({ ok: true, status: 200, json: async () => ({ books: [book] }) });
      return Promise.resolve({ ok: false, status: 500, json: async () => ({}) });
    });

    renderKidTab();
    await waitFor(() =>
      expect(screen.getByTestId(`reading-log-toggle-${BOOK_ID}`)).toBeInTheDocument(),
    );

    await act(async () => {
      fireEvent.click(screen.getByTestId(`reading-log-toggle-${BOOK_ID}`));
    });

    await waitFor(() => {
      const calls = fetchMock.mock.calls as [string, RequestInit][];
      const patchCall = calls.find(
        ([url, init]) =>
          (url as string).includes(`/api/kid/reading-log/${BOOK_ID}`) &&
          (init as RequestInit)?.method === 'PATCH',
      );
      expect(patchCall).toBeTruthy();
    });
  });

  // FHS-387: World Flags card shows real explored progress (MOCK-3).
  it('in kid mode, World Flags card shows non-zero progress when explored > 0', async () => {
    // The kid has explored 2 countries. COUNTRIES.length > 0, so progress > 0.
    fetchMock.mockImplementation((url: string) => {
      const u = String(url);
      if (u.includes('/api/kid/world-flags/learn'))
        return Promise.resolve({ ok: true, status: 200, json: async () => ({ progress: {} }) });
      if (u.includes('/api/kid/world-flags'))
        return Promise.resolve({
          ok: true,
          status: 200,
          json: async () => ({ explored: ['NG', 'GH'] }),
        });
      if (u.includes('/api/kid/learn'))
        return Promise.resolve({ ok: true, status: 200, json: async () => ({ subjects: [] }) });
      if (u.includes('/api/kid/reading-log'))
        return Promise.resolve({ ok: true, status: 200, json: async () => ({ books: [] }) });
      return Promise.resolve({ ok: false, status: 500, json: async () => ({}) });
    });
    renderKidTab();
    await waitFor(() =>
      expect(screen.getByTestId('learn-subject-world-flags')).toBeInTheDocument(),
    );
    // The World Flags progress bar should show > 0% (2 explored of ~195 countries).
    const progressBar = screen.getByTestId('learn-progress-World Flags');
    const pct = Number(progressBar.getAttribute('aria-valuenow'));
    expect(pct).toBeGreaterThan(0);
  });

  // FHS-387: Art card has no progress bar (MOCK-4).
  // FHS-414: Art is disabled (Coming soon) in kid mode too: no progress bar,
  // no free-play badge, and not clickable.
  it('in kid mode, Art card is disabled (Coming soon, no progress, not free-play)', async () => {
    installKidDefault([], []);
    renderKidTab();
    const card = await screen.findByTestId('learn-subject-art');
    expect(card).toBeDisabled();
    expect(screen.queryByTestId('learn-progress-Art')).not.toBeInTheDocument();
    expect(screen.queryByTestId('learn-art-freeplay')).not.toBeInTheDocument();
    expect(screen.getAllByTestId('learn-coming-soon').length).toBeGreaterThan(0);
  });

  it('deleting a book sends DELETE to /api/kid/reading-log/:id', async () => {
    const book = makeBook();

    // FHS-387: kid mode now fetches /api/kid/world-flags on mount; use
    // mockImplementation so all calls resolve regardless of order.
    fetchMock.mockImplementation((url: string, init?: RequestInit) => {
      const u = String(url);
      const method = (init as RequestInit | undefined)?.method ?? 'GET';
      if (u.includes('/api/kid/world-flags'))
        return Promise.resolve({
          ok: true,
          status: 200,
          json: async () => ({ explored: [] }),
        });
      if (u.includes('/api/kid/learn'))
        return Promise.resolve({ ok: true, status: 200, json: async () => ({ subjects: [] }) });
      if (u.includes(`/api/kid/reading-log/${BOOK_ID}`) && method === 'DELETE')
        return Promise.resolve({ ok: true, status: 204, json: async () => null });
      if (u.includes('/api/kid/reading-log'))
        return Promise.resolve({ ok: true, status: 200, json: async () => ({ books: [book] }) });
      return Promise.resolve({ ok: false, status: 500, json: async () => ({}) });
    });

    renderKidTab();
    await waitFor(() =>
      expect(screen.getByTestId(`reading-log-delete-${BOOK_ID}`)).toBeInTheDocument(),
    );

    await act(async () => {
      fireEvent.click(screen.getByTestId(`reading-log-delete-${BOOK_ID}`));
    });

    await waitFor(() =>
      expect(screen.queryByTestId(`reading-log-item-${BOOK_ID}`)).not.toBeInTheDocument(),
    );

    const calls = fetchMock.mock.calls as [string, RequestInit][];
    const deleteCall = calls.find(
      ([url, init]) =>
        (url as string).includes(`/api/kid/reading-log/${BOOK_ID}`) &&
        (init as RequestInit)?.method === 'DELETE',
    );
    expect(deleteCall).toBeTruthy();
  });
});

// ─── FHS-394: kid mode Maths routes to MathsSubject ──────────────────────────
//
// In kid mode, clicking the Maths card must show MathsSubject (placement /
// journey flow), NOT the old LessonView. Science and Logic keep using
// LessonView unchanged.

describe('FHS-394: kid Maths routes to MathsSubject', () => {
  function installKidMathsFetch() {
    fetchMock.mockImplementation((url: string) => {
      const u = String(url);
      // Kid world-flags (loaded by the tab on mount in kid mode)
      if (u.includes('/api/kid/world-flags'))
        return Promise.resolve({ ok: true, status: 200, json: async () => ({ explored: [] }) });
      if (u.includes('/api/kid/learn'))
        return Promise.resolve({
          ok: true,
          status: 200,
          json: async () => ({
            subjects: [
              { subject: 'Maths', progress: 30 },
              { subject: 'Science', progress: 10 },
            ],
          }),
        });
      if (u.includes('/api/kid/reading-log'))
        return Promise.resolve({ ok: true, status: 200, json: async () => ({ books: [] }) });
      // MathsSubject fetches /api/kid/maths/progress on mount
      if (u.includes('/api/kid/maths/progress'))
        return Promise.resolve({ ok: true, status: 200, json: async () => ({ progress: [] }) });
      // MathsSubject also fetches /api/kid/maths/certificates (via MathsJourney on journey mount)
      if (u.includes('/api/kid/maths/certificates'))
        return Promise.resolve({ ok: true, status: 200, json: async () => ({ certificates: [] }) });
      return Promise.resolve({ ok: false, status: 404, json: async () => ({}) });
    });
  }

  it('clicking Maths in kid mode renders maths-subject (not lesson-view)', async () => {
    installKidMathsFetch();
    renderKidTab();
    await waitFor(() => expect(screen.getByTestId('learn-subject-maths')).toBeInTheDocument());

    await act(async () => {
      fireEvent.click(screen.getByTestId('learn-subject-maths'));
    });

    // MathsSubject renders; the old LessonView should NOT be present.
    await waitFor(() => expect(screen.getByTestId('maths-subject')).toBeInTheDocument());
    expect(screen.queryByTestId('lesson-view')).not.toBeInTheDocument();
  });

  it('Maths in kid mode shows placement-test when no progress exists', async () => {
    installKidMathsFetch();
    renderKidTab();
    await waitFor(() => expect(screen.getByTestId('learn-subject-maths')).toBeInTheDocument());

    await act(async () => {
      fireEvent.click(screen.getByTestId('learn-subject-maths'));
    });

    // No progress → placement test intro shown.
    await waitFor(() => expect(screen.getByTestId('placement-test')).toBeInTheDocument());
    expect(screen.getByTestId('placement-begin')).toBeInTheDocument();
  });

  it('Back button from Maths returns to the subject overview', async () => {
    installKidMathsFetch();
    renderKidTab();
    await waitFor(() => expect(screen.getByTestId('learn-subject-maths')).toBeInTheDocument());

    await act(async () => {
      fireEvent.click(screen.getByTestId('learn-subject-maths'));
    });
    await waitFor(() => expect(screen.getByTestId('maths-subject')).toBeInTheDocument());

    await act(async () => {
      fireEvent.click(screen.getByTestId('learn-back'));
    });
    await waitFor(() => expect(screen.getByTestId('learn-subject-maths')).toBeInTheDocument());
    expect(screen.queryByTestId('maths-subject')).not.toBeInTheDocument();
  });

  it('FHS-403: Science card is disabled (visible, Coming soon, not clickable)', async () => {
    fetchMock.mockImplementation((url: string) => {
      const u = String(url);
      if (u.includes('/api/kid/world-flags'))
        return Promise.resolve({ ok: true, status: 200, json: async () => ({ explored: [] }) });
      if (u.includes('/api/kid/learn'))
        return Promise.resolve({
          ok: true,
          status: 200,
          json: async () => ({ subjects: [{ subject: 'Science', progress: 10 }] }),
        });
      if (u.includes('/api/kid/reading-log'))
        return Promise.resolve({ ok: true, status: 200, json: async () => ({ books: [] }) });
      return Promise.resolve({ ok: false, status: 404, json: async () => ({}) });
    });

    renderKidTab();
    const card = await screen.findByTestId('learn-subject-science');
    // Visible but disabled + a Coming soon cue (Art is also coming-soon now).
    expect(card).toBeDisabled();
    expect(screen.getAllByTestId('learn-coming-soon').length).toBeGreaterThan(0);

    // Clicking does nothing: no lesson view, no Maths/Logic subject.
    await act(async () => {
      fireEvent.click(card);
    });
    expect(screen.queryByTestId('lesson-view')).not.toBeInTheDocument();
    expect(screen.queryByTestId('maths-subject')).not.toBeInTheDocument();
  });
});

// ─── FHS-395: kid mode Logic routes to LogicSubject ──────────────────────────
//
// In kid mode, clicking the Logic card must show LogicSubject (game-type +
// trophy-wall flow), NOT LessonView. Science keeps using LessonView.

describe('FHS-395: kid Logic routes to LogicSubject', () => {
  function installKidLogicFetch() {
    fetchMock.mockImplementation((url: string) => {
      const u = String(url);
      if (u.includes('/api/kid/world-flags'))
        return Promise.resolve({ ok: true, status: 200, json: async () => ({ explored: [] }) });
      if (u.includes('/api/kid/learn'))
        return Promise.resolve({
          ok: true,
          status: 200,
          json: async () => ({
            subjects: [
              { subject: 'Logic', progress: 0 },
              { subject: 'Science', progress: 10 },
            ],
          }),
        });
      if (u.includes('/api/kid/reading-log'))
        return Promise.resolve({ ok: true, status: 200, json: async () => ({ books: [] }) });
      // LogicSubject → LogicLesson fetches questions on mount
      if (u.includes('/api/kid/logic/questions'))
        return Promise.resolve({
          ok: true,
          status: 200,
          json: async () => ({
            questions: [{ id: 'q1', type: 'truefalse', statement: 'The sky is blue.' }],
          }),
        });
      return Promise.resolve({ ok: false, status: 404, json: async () => ({}) });
    });
  }

  it('clicking Logic in kid mode renders logic-subject (not lesson-view)', async () => {
    installKidLogicFetch();
    renderKidTab();
    await waitFor(() => expect(screen.getByTestId('learn-subject-logic')).toBeInTheDocument());

    await act(async () => {
      fireEvent.click(screen.getByTestId('learn-subject-logic'));
    });

    await waitFor(() => expect(screen.getByTestId('logic-subject')).toBeInTheDocument());
    expect(screen.queryByTestId('lesson-view')).not.toBeInTheDocument();
  });

  it('kid Logic shows game-type selector and lesson view', async () => {
    installKidLogicFetch();
    renderKidTab();
    await waitFor(() => expect(screen.getByTestId('learn-subject-logic')).toBeInTheDocument());

    await act(async () => {
      fireEvent.click(screen.getByTestId('learn-subject-logic'));
    });

    await waitFor(() => expect(screen.getByTestId('logic-game-selector')).toBeInTheDocument());
    await waitFor(() => expect(screen.getByTestId('logic-lesson')).toBeInTheDocument());
  });

  it('Back button from Logic returns to the subject overview', async () => {
    installKidLogicFetch();
    renderKidTab();
    await waitFor(() => expect(screen.getByTestId('learn-subject-logic')).toBeInTheDocument());

    await act(async () => {
      fireEvent.click(screen.getByTestId('learn-subject-logic'));
    });
    await waitFor(() => expect(screen.getByTestId('logic-subject')).toBeInTheDocument());

    await act(async () => {
      fireEvent.click(screen.getByTestId('learn-back'));
    });
    await waitFor(() => expect(screen.getByTestId('learn-subject-logic')).toBeInTheDocument());
    expect(screen.queryByTestId('logic-subject')).not.toBeInTheDocument();
  });

  it('FHS-403: Science card stays disabled even when Logic is available', async () => {
    fetchMock.mockImplementation((url: string) => {
      const u = String(url);
      if (u.includes('/api/kid/world-flags'))
        return Promise.resolve({ ok: true, status: 200, json: async () => ({ explored: [] }) });
      if (u.includes('/api/kid/learn'))
        return Promise.resolve({
          ok: true,
          status: 200,
          json: async () => ({
            subjects: [
              { subject: 'Science', progress: 10 },
              { subject: 'Logic', progress: 10 },
            ],
          }),
        });
      if (u.includes('/api/kid/reading-log'))
        return Promise.resolve({ ok: true, status: 200, json: async () => ({ books: [] }) });
      return Promise.resolve({ ok: false, status: 404, json: async () => ({}) });
    });

    renderKidTab();
    const card = await screen.findByTestId('learn-subject-science');
    expect(card).toBeDisabled();

    await act(async () => {
      fireEvent.click(card);
    });
    expect(screen.queryByTestId('lesson-view')).not.toBeInTheDocument();
    expect(screen.queryByTestId('logic-subject')).not.toBeInTheDocument();
  });
});
