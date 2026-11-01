import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor, fireEvent, act } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';

// FHS-270: JournalTab (Magic Patterns redesign, new per-day journal API).
//
// Covers: initial load renders today's date + quote; selecting a mood /
// typing gratitude / body / creativity then clicking Save issues the right
// PUT; navigating to the previous day refetches GET with that date;
// switching to Past Entries renders the list (and the empty state).

const fetchMock = vi.fn();
const authState: { session: { access_token?: string } | null } = {
  session: { access_token: 'tok-abc' },
};
vi.mock('../../../../../src/app/lib/auth-context', () => ({
  useAuth: () => authState,
}));

import { JournalTab } from '../../../../../src/areas/journal/JournalTab';
import { TenantProvider } from '../../../../../src/app/lib/tenant-context';

const MEMBER = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc';
const ENTRY_ID = 'eeee1111-eeee-4eee-8eee-eeeeeeeeeeee';

// Fixed "today" so date assertions are deterministic.
// 2026-06-15 is a Monday.
const FAKE_TODAY = '2026-06-15';
const FAKE_PREV = '2026-06-14'; // Sunday

function makeEntry(
  partial: Partial<{
    id: string;
    entryDate: string;
    mood: string | null;
    gratitude1: string | null;
    gratitude2: string | null;
    gratitude3: string | null;
    body: string | null;
    creativity: Record<string, string> | null;
    createdAt: string;
    updatedAt: string;
  }> = {},
) {
  return {
    id: partial.id ?? ENTRY_ID,
    entryDate: partial.entryDate ?? FAKE_TODAY,
    mood: partial.mood ?? null,
    gratitude1: partial.gratitude1 ?? null,
    gratitude2: partial.gratitude2 ?? null,
    gratitude3: partial.gratitude3 ?? null,
    body: partial.body ?? null,
    creativity: partial.creativity ?? null,
    createdAt: '2026-06-15T08:00:00.000Z',
    updatedAt: '2026-06-15T08:00:00.000Z',
    ...partial,
  };
}

interface ApiState {
  entry: ReturnType<typeof makeEntry> | null;
  quoteIndex: number;
  earliestDate: string | null;
  entries: ReturnType<typeof makeEntry>[];
}

function installApi(over: Partial<ApiState> = {}) {
  const state: ApiState = {
    entry: over.entry ?? null,
    quoteIndex: over.quoteIndex ?? 0,
    earliestDate: over.earliestDate ?? null,
    entries: over.entries ?? [],
  };

  fetchMock.mockImplementation((url: string, init?: RequestInit) => {
    const u = String(url);

    // PUT /api/journal: upsert
    if (init?.method === 'PUT' && /\/api\/journal$/.test(u)) {
      const b = JSON.parse(init.body as string) as Record<string, unknown>;
      const saved = makeEntry({
        id: state.entry?.id ?? ENTRY_ID,
        entryDate: b['entryDate'] as string,
        mood: (b['mood'] as string | null) ?? null,
        gratitude1: (b['gratitude1'] as string | null) ?? null,
        gratitude2: (b['gratitude2'] as string | null) ?? null,
        gratitude3: (b['gratitude3'] as string | null) ?? null,
        body: (b['body'] as string | null) ?? null,
        creativity: (b['creativity'] as Record<string, string> | null) ?? null,
      });
      state.entry = saved;
      state.entries = [saved, ...state.entries.filter((e) => e.id !== saved.id)];
      return Promise.resolve({ ok: true, status: 200, json: async () => saved });
    }

    // GET /api/journal/earliest
    if (u.includes('/api/journal/earliest')) {
      return Promise.resolve({
        ok: true,
        status: 200,
        json: async () => ({ earliestDate: state.earliestDate }),
      });
    }

    // GET /api/journal/entries
    if (u.includes('/api/journal/entries')) {
      return Promise.resolve({
        ok: true,
        status: 200,
        json: async () => ({ entries: state.entries }),
      });
    }

    // GET /api/journal?memberId=&date=
    if (/\/api\/journal\?/.test(u)) {
      return Promise.resolve({
        ok: true,
        status: 200,
        json: async () => ({ entry: state.entry, quoteIndex: state.quoteIndex }),
      });
    }

    return Promise.resolve({ ok: true, status: 200, json: async () => ({}) });
  });

  return state;
}

function renderTab() {
  return render(
    <MemoryRouter initialEntries={['/t/khan/child/' + MEMBER]}>
      <Routes>
        <Route
          path="/t/:slug/child/:memberId"
          element={
            <TenantProvider>
              <JournalTab memberId={MEMBER} />
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
  // Fix "today" so date-navigator tests are deterministic.
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date(`${FAKE_TODAY}T10:00:00`));
});
afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe('<JournalTab />', () => {
  it("renders today's date label + quote from API on initial load", async () => {
    // quoteIndex 0 → first quote: "You get to choose who you want to be."
    installApi({ quoteIndex: 0 });
    renderTab();

    // Date label should contain the day name and date for 2026-06-15 (Monday)
    await waitFor(() =>
      expect(screen.getByTestId('journal-date-label').textContent).toContain('MONDAY'),
    );
    expect(screen.getByTestId('journal-date-label').textContent).toContain('15');
    expect(screen.getByTestId('journal-date-label').textContent).toContain('JUNE');
    expect(screen.getByTestId('journal-date-label').textContent).toContain('2026');

    // Quote banner renders with text from quoteIndex 0
    expect(screen.getByTestId('journal-quote').textContent).toContain(
      'You get to choose who you want to be.',
    );

    // "Today" relative label is shown
    expect(screen.getByText('Today')).toBeInTheDocument();

    // Next-day button is disabled (can't go past today)
    expect(screen.getByTestId('journal-next-day')).toBeDisabled();
  });

  it('selecting a mood + typing all fields + clicking Save PUTs the right payload for today', async () => {
    installApi();
    renderTab();
    await waitFor(() => expect(screen.getByTestId('journal-tab')).toBeInTheDocument());

    // Pick mood "happy"
    act(() => {
      fireEvent.click(screen.getByTestId('journal-mood-happy'));
    });

    // Fill gratitude fields
    act(() => {
      fireEvent.change(screen.getByTestId('journal-gratitude-1'), {
        target: { value: 'My family' },
      });
      fireEvent.change(screen.getByTestId('journal-gratitude-2'), {
        target: { value: 'Sunny weather' },
      });
      fireEvent.change(screen.getByTestId('journal-gratitude-3'), {
        target: { value: 'Good food' },
      });
    });

    // Fill body
    act(() => {
      fireEvent.change(screen.getByTestId('journal-body'), {
        target: { value: 'Had a great day at school.' },
      });
    });

    // Fill first creativity question
    act(() => {
      fireEvent.change(screen.getByTestId('journal-creativity-0'), {
        target: { value: 'Playing with friends' },
      });
    });

    // Click Save
    await act(async () => {
      fireEvent.click(screen.getByTestId('journal-save'));
    });

    // Should show "Saved ✓" feedback
    await waitFor(() => expect(screen.getByTestId('journal-saved')).toBeInTheDocument());

    // Verify PUT was called with the right payload
    const putCall = fetchMock.mock.calls.find(
      ([u, i]) => (i as RequestInit)?.method === 'PUT' && String(u).includes('/api/journal'),
    );
    expect(putCall).toBeDefined();
    const body = JSON.parse((putCall![1] as RequestInit).body as string) as Record<string, unknown>;
    expect(body).toMatchObject({
      memberId: MEMBER,
      entryDate: FAKE_TODAY,
      mood: 'happy',
      gratitude1: 'My family',
      gratitude2: 'Sunny weather',
      gratitude3: 'Good food',
      body: 'Had a great day at school.',
      creativity: { '0': 'Playing with friends' },
    });
  });

  it('navigating to previous day refetches GET with that date', async () => {
    // earliestDate is null so prev is always enabled
    installApi({ earliestDate: null });
    renderTab();
    await waitFor(() => expect(screen.getByTestId('journal-prev-day')).toBeInTheDocument());
    // Prev button should be enabled (no earliestDate)
    expect(screen.getByTestId('journal-prev-day')).not.toBeDisabled();

    await act(async () => {
      fireEvent.click(screen.getByTestId('journal-prev-day'));
    });

    // Date label should now show 2026-06-14 (Sunday)
    await waitFor(() =>
      expect(screen.getByTestId('journal-date-label').textContent).toContain('SUNDAY'),
    );

    // A GET call should have been made with date=2026-06-14
    const prevFetch = fetchMock.mock.calls.find(
      ([u]) => String(u).includes('/api/journal?') && String(u).includes(FAKE_PREV),
    );
    expect(prevFetch).toBeDefined();
  });

  it('switching to Past Entries renders the entry list', async () => {
    const savedEntry = makeEntry({
      id: 'past-1',
      entryDate: FAKE_PREV,
      body: 'Yesterday was fun',
      mood: 'happy',
      gratitude1: 'Sunshine',
    });
    installApi({ entries: [savedEntry] });
    renderTab();
    await waitFor(() => expect(screen.getByTestId('journal-tab')).toBeInTheDocument());

    // Switch to Past Entries
    act(() => {
      fireEvent.click(screen.getByTestId('journal-subtab-past'));
    });

    await waitFor(() => expect(screen.getByTestId('journal-past-list')).toBeInTheDocument());

    expect(screen.getByTestId('journal-entry-past-1')).toBeInTheDocument();
    expect(screen.getByTestId('journal-entry-past-1').textContent).toContain('Yesterday was fun');
    expect(screen.getByTestId('journal-entry-past-1').textContent).toContain('Sunshine');
  });

  it('switching to Past Entries shows the empty state when there are no entries', async () => {
    installApi({ entries: [] });
    renderTab();
    await waitFor(() => expect(screen.getByTestId('journal-tab')).toBeInTheDocument());

    act(() => {
      fireEvent.click(screen.getByTestId('journal-subtab-past'));
    });

    await waitFor(() => expect(screen.getByTestId('journal-past-empty')).toBeInTheDocument());
    expect(screen.getByTestId('journal-past-empty').textContent).toContain('No entries yet!');
  });

  it('shows the error state when the initial load fails', async () => {
    fetchMock.mockResolvedValue({ ok: false, status: 500, json: async () => ({}) });
    renderTab();
    await waitFor(() => expect(screen.getByTestId('journal-error')).toBeInTheDocument());
  });

  it('prev-day is disabled when currentDate equals earliestDate', async () => {
    installApi({ earliestDate: FAKE_TODAY });
    renderTab();
    await waitFor(() => expect(screen.getByTestId('journal-prev-day')).toBeDisabled());
  });

  it('shows journal-save-error when PUT returns a non-2xx response', async () => {
    // Override the PUT to return a 400 (e.g. future date or over-length field).
    installApi();
    fetchMock.mockImplementation((url: string, init?: RequestInit) => {
      if (
        (init as RequestInit | undefined)?.method === 'PUT' &&
        String(url).includes('/api/journal')
      ) {
        return Promise.resolve({
          ok: false,
          status: 400,
          json: async () => ({ message: 'Entry date cannot be in the future.' }),
        });
      }
      // Default GET responses stay intact.
      if (String(url).includes('/api/journal/earliest')) {
        return Promise.resolve({
          ok: true,
          status: 200,
          json: async () => ({ earliestDate: null }),
        });
      }
      if (/\/api\/journal\?/.test(String(url))) {
        return Promise.resolve({
          ok: true,
          status: 200,
          json: async () => ({ entry: null, quoteIndex: 0 }),
        });
      }
      return Promise.resolve({ ok: true, status: 200, json: async () => ({}) });
    });

    renderTab();
    await waitFor(() => expect(screen.getByTestId('journal-tab')).toBeInTheDocument());

    await act(async () => {
      fireEvent.click(screen.getByTestId('journal-save'));
    });

    await waitFor(() => expect(screen.getByTestId('journal-save-error')).toBeInTheDocument());
    expect(screen.getByTestId('journal-save-error')).toHaveAttribute('role', 'alert');
    // Server detail message is surfaced to the user.
    expect(screen.getByTestId('journal-save-error').textContent).toContain(
      'Entry date cannot be in the future.',
    );
  });

  it('gratitude inputs have maxLength of 500', async () => {
    installApi();
    renderTab();
    await waitFor(() => expect(screen.getByTestId('journal-gratitude-1')).toBeInTheDocument());

    expect(screen.getByTestId('journal-gratitude-1')).toHaveAttribute('maxLength', '500');
    expect(screen.getByTestId('journal-gratitude-2')).toHaveAttribute('maxLength', '500');
    expect(screen.getByTestId('journal-gratitude-3')).toHaveAttribute('maxLength', '500');
  });
});
