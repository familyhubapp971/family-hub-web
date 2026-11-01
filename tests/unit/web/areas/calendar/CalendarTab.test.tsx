import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';

// FHS-269: ChildWorld Calendar tab (read-only, child-filtered).

const fetchMock = vi.fn();
const authState: { session: { access_token?: string } | null } = {
  session: { access_token: 'tok-abc' },
};
vi.mock('../../../../../src/app/lib/auth-context', () => ({
  useAuth: () => authState,
}));

import { CalendarTab } from '../../../../../src/areas/calendar/CalendarTab';
import { TenantProvider } from '../../../../../src/app/lib/tenant-context';

const CHILD = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc';
const OTHER = 'dddddddd-dddd-4ddd-8ddd-dddddddddddd';

function evt(over: Record<string, unknown>) {
  return {
    id: 'e1',
    date: '2026-06-10',
    startTime: '09:00',
    endTime: '10:00',
    title: 'Assembly',
    notes: null,
    memberId: null,
    type: 'school',
    location: 'Hall',
    wear: 'Uniform',
    ...over,
  };
}

function installEvents(events: unknown[]) {
  fetchMock.mockResolvedValue({ ok: true, status: 200, json: async () => ({ events }) });
}

function renderTab() {
  return render(
    <MemoryRouter initialEntries={['/t/khan/child/' + CHILD]}>
      <Routes>
        <Route
          path="/t/:slug/child/:memberId"
          element={
            <TenantProvider>
              <CalendarTab memberId={CHILD} />
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

describe('<CalendarTab />', () => {
  it('shows the empty state when the child has no events', async () => {
    installEvents([evt({ id: 'x', memberId: OTHER })]);
    renderTab();
    await waitFor(() => expect(screen.getByTestId('calendar-empty')).toBeInTheDocument());
  });

  it('renders this child + whole-family events, hiding other members', async () => {
    installEvents([
      evt({ id: 'e1', date: '2026-06-10', title: 'Assembly', memberId: null }),
      evt({ id: 'e2', date: '2026-06-11', title: 'Football', memberId: CHILD }),
      evt({ id: 'e3', date: '2026-06-12', title: 'Ballet', memberId: OTHER }),
    ]);
    renderTab();
    await waitFor(() => expect(screen.getByTestId('calendar-tab')).toBeInTheDocument());
    expect(screen.getByTestId('cal-event-e1')).toBeInTheDocument();
    expect(screen.getByTestId('cal-event-e2')).toBeInTheDocument();
    expect(screen.queryByTestId('cal-event-e3')).not.toBeInTheDocument();
    // GET /api/events requires a weekStart: without it the API 400s and the
    // calendar shows the error state (regression: the tab used to omit it).
    const url = String(fetchMock.mock.calls[0]?.[0] ?? '');
    expect(url).toMatch(/\/api\/events\?weekStart=\d{4}-\d{2}-\d{2}/);
  });

  it('renders an error state on a failed load', async () => {
    fetchMock.mockResolvedValue({ ok: false, status: 500, json: async () => ({}) });
    renderTab();
    await waitFor(() => expect(screen.getByTestId('calendar-error')).toBeInTheDocument());
  });

  it('renders an error state when the request throws (network)', async () => {
    fetchMock.mockRejectedValue(new Error('offline'));
    renderTab();
    await waitFor(() => expect(screen.getByTestId('calendar-error')).toBeInTheDocument());
  });

  it('renders an event with all optional fields null (title only, no crash)', async () => {
    installEvents([
      evt({
        id: 'e1',
        startTime: null,
        endTime: null,
        location: null,
        wear: null,
        title: 'Free play',
        memberId: CHILD,
      }),
    ]);
    renderTab();
    await waitFor(() => expect(screen.getByTestId('cal-event-e1')).toBeInTheDocument());
    expect(screen.getByTestId('cal-event-e1').textContent).toContain('Free play');
  });

  it('has no create / edit / delete controls (read-only)', async () => {
    installEvents([evt({ id: 'e1', memberId: CHILD })]);
    renderTab();
    await waitFor(() => expect(screen.getByTestId('calendar-tab')).toBeInTheDocument());
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
  });
});
