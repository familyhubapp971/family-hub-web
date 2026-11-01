import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor, fireEvent, act, within } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';

// FHS-265: CalendarTabPanel (MP layout). School/Home sub-tabs, legend +
// per-child filter pills, day cards with when/where/wear rows, and the
// per-day Add Activity form. An in-memory fake backs /api/events +
// /api/members so add + refetch behave like the real API.

const fetchMock = vi.fn();
const authState: { session: { access_token?: string } | null } = {
  session: { access_token: 'tok-abc' },
};
vi.mock('../../../../../src/app/lib/auth-context', () => ({
  useAuth: () => authState,
}));

import { CalendarTabPanel } from '../../../../../src/areas/calendar/CalendarTabPanel';
import { TenantProvider } from '../../../../../src/app/lib/tenant-context';

interface Ev {
  id: string;
  date: string;
  startTime: string | null;
  endTime: string | null;
  title: string;
  notes: string | null;
  memberId: string | null;
  type: 'school' | 'home';
  location: string | null;
  wear: string | null;
  recurrenceDays: number[] | null;
  recurrenceEndDate: string | null;
  isRecurring: boolean;
  seriesStartDate: string;
}
interface Member {
  id: string;
  displayName: string;
  role: string;
}

const AMINA = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const IBRAHIM = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const MEMBERS: Member[] = [
  { id: 'p1', displayName: 'Sarah', role: 'admin' },
  { id: AMINA, displayName: 'Amina', role: 'teen' },
  { id: IBRAHIM, displayName: 'Ibrahim', role: 'child' },
];

// This week's Monday in local time: events seeded on it always render
// in the default-loaded week.
function mondayIso(): string {
  const now = new Date();
  const copy = new Date(now);
  copy.setDate(now.getDate() - ((now.getDay() + 6) % 7));
  const y = copy.getFullYear();
  const m = String(copy.getMonth() + 1).padStart(2, '0');
  const d = String(copy.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

// FHS-438: "today" (not Monday) is the one day in the default-loaded week
// that's guaranteed never to be in the past, whatever weekday the suite
// runs on. Add-activity tests use this instead of mondayIso().
function todayIso(): string {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

// FHS-476: 0 = Sunday .. 6 = Saturday, matching the "Repeat weekly" day
// checkboxes and the API's recurrenceDays.
function weekdayOfIso(iso: string): number {
  const [y, m, d] = iso.split('-').map((s) => Number.parseInt(s, 10));
  return new Date(Date.UTC(y!, m! - 1, d!)).getUTCDay();
}

function ev(over: Partial<Ev>): Ev {
  const date = over.date ?? mondayIso();
  return {
    id: 'e1',
    date,
    startTime: null,
    endTime: null,
    title: 'Event',
    notes: null,
    memberId: null,
    type: 'school',
    location: null,
    wear: null,
    recurrenceDays: null,
    recurrenceEndDate: null,
    isRecurring: false,
    seriesStartDate: date,
    ...over,
  };
}

function installApi(opts: { events?: Ev[]; members?: Member[]; eventsOk?: boolean }) {
  const state = { events: [...(opts.events ?? [])], members: [...(opts.members ?? MEMBERS)] };
  let gen = 0;
  fetchMock.mockImplementation((url: string, init?: RequestInit) => {
    const u = String(url);
    if (init?.method === 'POST') {
      const body = JSON.parse(init.body as string) as Omit<
        Ev,
        'id' | 'endTime' | 'notes' | 'isRecurring' | 'seriesStartDate'
      >;
      const row: Ev = {
        id: `gen-${++gen}`,
        endTime: null,
        notes: null,
        ...body,
        // Mirrors the real API: isRecurring/seriesStartDate are derived,
        // not sent by the client.
        isRecurring: !!(body.recurrenceDays && body.recurrenceDays.length > 0),
        seriesStartDate: body.date,
      } as Ev;
      state.events.push(row);
      return Promise.resolve({ ok: true, status: 201, json: async () => row });
    }
    if (init?.method === 'PUT') {
      const idMatch = u.match(/\/api\/events\/([^?]+)/);
      const id = idMatch?.[1];
      const body = JSON.parse(init.body as string) as Partial<Ev>;
      const idx = state.events.findIndex((e) => e.id === id);
      if (idx >= 0) {
        const merged = { ...state.events[idx]!, ...body };
        merged.isRecurring = !!(merged.recurrenceDays && merged.recurrenceDays.length > 0);
        merged.seriesStartDate = merged.date;
        state.events[idx] = merged;
      }
      return Promise.resolve({ ok: true, status: 200, json: async () => state.events[idx] });
    }
    if (init?.method === 'DELETE') {
      const idMatch = u.match(/\/api\/events\/([^?]+)/);
      const id = idMatch?.[1];
      state.events = state.events.filter((e) => e.id !== id);
      return Promise.resolve({ ok: true, status: 204, json: async () => ({}) });
    }
    if (u.includes('/api/members')) {
      return Promise.resolve({
        ok: true,
        status: 200,
        json: async () => ({ members: state.members, callerRole: 'admin' }),
      });
    }
    return Promise.resolve({
      ok: opts.eventsOk ?? true,
      status: opts.eventsOk === false ? 500 : 200,
      json: async () => ({ weekStart: mondayIso(), events: state.events }),
    });
  });
  return state;
}

function renderAt(initial: string) {
  return render(
    <MemoryRouter initialEntries={[initial]}>
      <Routes>
        <Route
          path="/t/:slug/dashboard"
          element={
            <TenantProvider>
              <CalendarTabPanel />
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

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe('<CalendarTabPanel />', () => {
  it('renders a loading hint while requests are in flight', () => {
    fetchMock.mockReturnValue(new Promise(() => {}));
    renderAt('/t/khans/dashboard');
    expect(screen.getByTestId('calendar-loading')).toBeInTheDocument();
  });

  it('renders the inline error when the events API fails', async () => {
    installApi({ eventsOk: false });
    renderAt('/t/khans/dashboard');
    await waitFor(() => expect(screen.getByTestId('calendar-error')).toBeInTheDocument());
  });

  it('renders 7 day cards, the sub-tabs, legend, filter pills and the Today pill', async () => {
    installApi({});
    renderAt('/t/khans/dashboard');
    await waitFor(() => expect(screen.getByTestId('calendar-ready')).toBeInTheDocument());
    expect(screen.getByTestId('calendar-subtab-school')).toBeInTheDocument();
    expect(screen.getByTestId('calendar-subtab-home')).toBeInTheDocument();
    expect(screen.getByTestId('calendar-legend')).toBeInTheDocument();
    expect(screen.getByTestId('calendar-filter-all')).toBeInTheDocument();
    expect(screen.getByTestId(`calendar-filter-${AMINA}`)).toBeInTheDocument();
    // Only kids get filter pills: the admin doesn't.
    expect(screen.queryByTestId('calendar-filter-p1')).not.toBeInTheDocument();
    expect(screen.getByTestId('calendar-today-pill')).toBeInTheDocument();
    expect(screen.getByTestId('calendar-week-label')).toBeInTheDocument();
  });

  // FHS-474: "Family" duplicated "All": both showed the exact same set of
  // events, so it was a confusing, redundant pill. Only All + per-child
  // filter pills remain.
  it('does not render a Family filter pill (FHS-474)', async () => {
    installApi({});
    renderAt('/t/khans/dashboard');
    await waitFor(() => expect(screen.getByTestId('calendar-ready')).toBeInTheDocument());
    expect(screen.queryByTestId('calendar-filter-family')).not.toBeInTheDocument();
  });

  it('shows an event row with title, when, where, and wear', async () => {
    installApi({
      events: [
        ev({
          id: 'e1',
          title: 'Swimming Lesson',
          startTime: '15:00',
          memberId: AMINA,
          location: 'Leisure Centre',
          wear: 'Swimsuit and towel',
        }),
      ],
    });
    renderAt('/t/khans/dashboard');
    await waitFor(() => expect(screen.getByTestId('calendar-ready')).toBeInTheDocument());
    expect(screen.getByTestId(`calendar-event-e1-${mondayIso()}-title`).textContent).toBe(
      'Swimming Lesson',
    );
    expect(screen.getByTestId(`calendar-event-e1-${mondayIso()}-location`).textContent).toBe(
      'Leisure Centre',
    );
    expect(screen.getByTestId(`calendar-event-e1-${mondayIso()}-wear`).textContent).toBe(
      'Swimsuit and towel',
    );
    expect(screen.getByLabelText('Amina')).toBeInTheDocument();
  });

  it('School/Home sub-tabs split events by type', async () => {
    installApi({
      events: [
        ev({ id: 'sch', title: 'PE Day', type: 'school' }),
        ev({ id: 'hom', title: 'Park visit', type: 'home' }),
      ],
    });
    renderAt('/t/khans/dashboard');
    await waitFor(() => expect(screen.getByTestId('calendar-ready')).toBeInTheDocument());

    // Default = School (founder's call; matches the mockup).
    expect(screen.getByTestId(`calendar-event-sch-${mondayIso()}`)).toBeInTheDocument();
    expect(screen.queryByTestId(`calendar-event-hom-${mondayIso()}`)).not.toBeInTheDocument();

    act(() => {
      fireEvent.click(screen.getByTestId('calendar-subtab-home'));
    });
    expect(screen.queryByTestId(`calendar-event-sch-${mondayIso()}`)).not.toBeInTheDocument();
    expect(screen.getByTestId(`calendar-event-hom-${mondayIso()}`)).toBeInTheDocument();
  });

  it('member filter pill narrows to that member + family-wide, excludes the other child', async () => {
    installApi({
      events: [
        ev({ id: 'am', title: 'Amina swim', memberId: AMINA }),
        ev({ id: 'ib', title: 'Ibrahim football', memberId: IBRAHIM }),
        ev({ id: 'fam', title: 'Family picnic', memberId: null }),
      ],
    });
    renderAt('/t/khans/dashboard');
    await waitFor(() => expect(screen.getByTestId('calendar-ready')).toBeInTheDocument());

    act(() => {
      fireEvent.click(screen.getByTestId(`calendar-filter-${AMINA}`));
    });
    expect(screen.getByTestId(`calendar-event-am-${mondayIso()}`)).toBeInTheDocument();
    // FHS-475: a family-wide event shows under every child's filter, not
    // just "All".
    expect(screen.getByTestId(`calendar-event-fam-${mondayIso()}`)).toBeInTheDocument();
    // Ibrahim's own event still must NOT show under Amina's filter.
    expect(screen.queryByTestId(`calendar-event-ib-${mondayIso()}`)).not.toBeInTheDocument();
  });

  // FHS-475: a beta tester assigned "tennis" to both kids (checking 2+
  // children writes memberId=null, the model's only way to express
  // "more than one member": see the ActivityForm note). Filtering to
  // Amina alone must still show it, not just events with memberId=AMINA.
  it('a both-kids activity (family-wide memberId) appears under a single child filter (FHS-475)', async () => {
    installApi({
      events: [
        ev({ id: 'tennis', title: 'Tennis', memberId: null }),
        ev({ id: 'gym', title: 'Gymnastics', memberId: AMINA }),
      ],
    });
    renderAt('/t/khans/dashboard');
    await waitFor(() => expect(screen.getByTestId('calendar-ready')).toBeInTheDocument());

    act(() => {
      fireEvent.click(screen.getByTestId(`calendar-filter-${AMINA}`));
    });
    expect(screen.getByTestId(`calendar-event-gym-${mondayIso()}`)).toBeInTheDocument();
    expect(screen.getByTestId(`calendar-event-tennis-${mondayIso()}`)).toBeInTheDocument();

    act(() => {
      fireEvent.click(screen.getByTestId(`calendar-filter-${IBRAHIM}`));
    });
    expect(screen.getByTestId(`calendar-event-tennis-${mondayIso()}`)).toBeInTheDocument();
    expect(screen.queryByTestId(`calendar-event-gym-${mondayIso()}`)).not.toBeInTheDocument();

    act(() => {
      fireEvent.click(screen.getByTestId('calendar-filter-all'));
    });
    expect(screen.getByTestId(`calendar-event-tennis-${mondayIso()}`)).toBeInTheDocument();
    expect(screen.getByTestId(`calendar-event-gym-${mondayIso()}`)).toBeInTheDocument();
  });

  it('adding an activity POSTs date/title/time/member/type/location/wear and shows it', async () => {
    installApi({});
    renderAt('/t/khans/dashboard');
    await waitFor(() => expect(screen.getByTestId('calendar-ready')).toBeInTheDocument());

    // FHS-438: the day card must be today or later, since past days no
    // longer show an Add Activity button.
    const today = todayIso();
    act(() => {
      fireEvent.click(screen.getByTestId(`calendar-add-${today}`));
    });
    expect(screen.getByTestId('calendar-add-form')).toBeInTheDocument();
    act(() => {
      fireEvent.click(screen.getByTestId(`calendar-form-child-${AMINA}`));
      fireEvent.change(screen.getByTestId('calendar-form-title'), {
        target: { value: 'Swimming Lesson' },
      });
      fireEvent.change(screen.getByTestId('calendar-form-when'), { target: { value: '15:00' } });
      fireEvent.change(screen.getByTestId('calendar-form-where'), {
        target: { value: 'Leisure Centre' },
      });
      fireEvent.change(screen.getByTestId('calendar-form-wear'), {
        target: { value: 'Swimsuit' },
      });
    });
    await act(async () => {
      fireEvent.click(screen.getByTestId('calendar-form-save'));
    });

    await waitFor(() => expect(screen.getByText('Swimming Lesson')).toBeInTheDocument());
    const postCall = fetchMock.mock.calls.find(([, init]) => init?.method === 'POST');
    expect(JSON.parse((postCall![1] as RequestInit).body as string)).toEqual({
      date: today,
      title: 'Swimming Lesson',
      startTime: '15:00',
      endTime: null,
      memberId: AMINA,
      type: 'school',
      location: 'Leisure Centre',
      wear: 'Swimsuit',
      notes: null,
      recurrenceDays: null,
      recurrenceEndDate: null,
    });
  });

  it('checking two children saves a whole-family event (memberId null)', async () => {
    installApi({});
    renderAt('/t/khans/dashboard');
    await waitFor(() => expect(screen.getByTestId('calendar-ready')).toBeInTheDocument());

    const today = todayIso();
    act(() => {
      fireEvent.click(screen.getByTestId(`calendar-add-${today}`));
    });
    act(() => {
      fireEvent.click(screen.getByTestId(`calendar-form-child-${AMINA}`));
      fireEvent.click(screen.getByTestId(`calendar-form-child-${IBRAHIM}`));
      fireEvent.change(screen.getByTestId('calendar-form-title'), {
        target: { value: 'Dentist' },
      });
    });
    await act(async () => {
      fireEvent.click(screen.getByTestId('calendar-form-save'));
    });

    const postCall = fetchMock.mock.calls.find(([, init]) => init?.method === 'POST');
    expect(JSON.parse((postCall![1] as RequestInit).body as string).memberId).toBeNull();
  });

  it('edit button pre-fills the form and save issues a PUT', async () => {
    const existingEv = ev({
      id: 'e-edit',
      title: 'Old Title',
      memberId: AMINA,
      startTime: '10:00',
      location: 'School',
      wear: 'Uniform',
    });
    installApi({ events: [existingEv] });
    renderAt('/t/khans/dashboard');
    await waitFor(() => expect(screen.getByTestId('calendar-ready')).toBeInTheDocument());

    act(() => {
      fireEvent.click(screen.getByTestId(`calendar-edit-e-edit-${mondayIso()}`));
    });
    // Form should be open with pre-filled title
    expect(screen.getByTestId('calendar-add-form')).toBeInTheDocument();
    expect((screen.getByTestId('calendar-form-title') as HTMLInputElement).value).toBe('Old Title');

    act(() => {
      fireEvent.change(screen.getByTestId('calendar-form-title'), {
        target: { value: 'New Title' },
      });
    });
    await act(async () => {
      fireEvent.click(screen.getByTestId('calendar-form-save'));
    });

    const putCall = fetchMock.mock.calls.find(
      ([url, init]) => String(url).includes('/api/events/e-edit') && init?.method === 'PUT',
    );
    expect(putCall).toBeTruthy();
    expect(JSON.parse((putCall![1] as RequestInit).body as string).title).toBe('New Title');
  });

  it('delete button opens the app confirm dialog and DELETEs on confirm', async () => {
    const existingEv = ev({ id: 'e-del', title: 'To Delete', memberId: AMINA });
    installApi({ events: [existingEv] });
    renderAt('/t/khans/dashboard');
    await waitFor(() => expect(screen.getByTestId('calendar-ready')).toBeInTheDocument());

    fetchMock.mockImplementationOnce((url: string, init?: RequestInit) => {
      if (String(url).includes('/api/events/e-del') && init?.method === 'DELETE') {
        return Promise.resolve({ ok: true, status: 204, json: async () => ({}) });
      }
      return Promise.resolve({ ok: true, status: 200, json: async () => ({ events: [] }) });
    });

    // Clicking delete opens the in-app confirm dialog (not window.confirm).
    act(() => {
      fireEvent.click(screen.getByTestId(`calendar-delete-e-del-${mondayIso()}`));
    });
    await waitFor(() => expect(screen.getByTestId('calendar-delete-confirm')).toBeInTheDocument());
    await act(async () => {
      fireEvent.click(screen.getByTestId('calendar-delete-confirm-confirm'));
    });

    const deleteCall = fetchMock.mock.calls.find(
      ([url, init]) => String(url).includes('/api/events/e-del') && init?.method === 'DELETE',
    );
    expect(deleteCall).toBeTruthy();
  });

  it('the saved event type follows the active sub-tab', async () => {
    installApi({});
    renderAt('/t/khans/dashboard');
    await waitFor(() => expect(screen.getByTestId('calendar-ready')).toBeInTheDocument());

    act(() => {
      fireEvent.click(screen.getByTestId('calendar-subtab-home'));
    });
    const today = todayIso();
    act(() => {
      fireEvent.click(screen.getByTestId(`calendar-add-${today}`));
    });
    act(() => {
      fireEvent.change(screen.getByTestId('calendar-form-title'), {
        target: { value: 'Park visit' },
      });
    });
    await act(async () => {
      fireEvent.click(screen.getByTestId('calendar-form-save'));
    });
    const postCall = fetchMock.mock.calls.find(([, init]) => init?.method === 'POST');
    expect(JSON.parse((postCall![1] as RequestInit).body as string).type).toBe('home');
  });

  it('shows the friendly empty state on a day with no activities', async () => {
    installApi({});
    renderAt('/t/khans/dashboard');
    await waitFor(() => expect(screen.getByTestId('calendar-ready')).toBeInTheDocument());
    expect(screen.getByTestId(`calendar-day-${mondayIso()}-empty`)).toBeInTheDocument();
    expect(screen.getAllByText('No activities scheduled').length).toBeGreaterThan(0);
  });

  it('blocks adding an activity on a day before today (FHS-438)', async () => {
    // Fri 2026-07-10 → its Monday (2026-07-06) is a past day in the same
    // default-loaded week. Fake only Date so fetch/waitFor keep working.
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date('2026-07-10T09:00:00'));
    const pastMonday = '2026-07-06';
    const today = '2026-07-10';

    installApi({});
    renderAt('/t/khans/dashboard');
    await waitFor(() => expect(screen.getByTestId('calendar-ready')).toBeInTheDocument());

    // Past day: no Add Activity button, a friendly inline message instead.
    expect(screen.queryByTestId(`calendar-add-${pastMonday}`)).not.toBeInTheDocument();
    const blocked = screen.getByTestId(`calendar-add-blocked-${pastMonday}`);
    expect(blocked.textContent).toMatch(/passed.*today or a future date/i);

    // Today still allows adding.
    expect(screen.getByTestId(`calendar-add-${today}`)).toBeInTheDocument();
  });

  // FHS-443: a beta reviewer saw a Saturday marked "Today" on a weekly
  // planner and wasn't sure the days were date-driven. This locks down that
  // the Today badge always lands on the real calendar date (whatever day of
  // the week it falls on) and that days already passed in the same week
  // read as visually "Past" so it's never ambiguous which day is which.
  it('marks the real current date as Today even when it falls on a Saturday, and mutes days already passed', async () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date('2026-07-11T10:00:00')); // a Saturday
    const monday = '2026-07-06';
    const saturday = '2026-07-11';
    const sunday = '2026-07-12';

    installApi({});
    renderAt('/t/khans/dashboard');
    await waitFor(() => expect(screen.getByTestId('calendar-ready')).toBeInTheDocument());

    // Today pill sits on the real Saturday card, not Monday or any other day.
    const satCard = screen.getByTestId(`calendar-day-${saturday}`);
    expect(within(satCard).getByTestId('calendar-today-pill')).toBeInTheDocument();
    expect(within(satCard).getByText(/Saturday/)).toBeInTheDocument();

    const monCard = screen.getByTestId(`calendar-day-${monday}`);
    expect(within(monCard).queryByTestId('calendar-today-pill')).not.toBeInTheDocument();
    expect(within(monCard).getByText(/Monday/)).toBeInTheDocument();

    // Monday through Friday have already passed this week: muted "Past" tag.
    expect(within(monCard).getByTestId(`calendar-past-pill-${monday}`)).toBeInTheDocument();
    // Today itself is never also flagged as Past.
    expect(within(satCard).queryByTestId(`calendar-past-pill-${saturday}`)).not.toBeInTheDocument();

    // Sunday hasn't happened yet: neither Today nor Past.
    const sunCard = screen.getByTestId(`calendar-day-${sunday}`);
    expect(within(sunCard).queryByTestId('calendar-today-pill')).not.toBeInTheDocument();
    expect(within(sunCard).queryByTestId(`calendar-past-pill-${sunday}`)).not.toBeInTheDocument();
  });

  it('passes the bearer token + tenant slug and a weekStart query', async () => {
    installApi({});
    renderAt('/t/khans/dashboard');
    await waitFor(() => expect(fetchMock).toHaveBeenCalled());
    const [url, init] = fetchMock.mock.calls[0]!;
    expect(String(url)).toContain('/api/events?weekStart=');
    expect(init.headers).toMatchObject({
      Authorization: 'Bearer tok-abc',
      'x-tenant-slug': 'khans',
    });
  });

  // FHS-476: recurring activities: the "Repeat weekly" toggle, day picker,
  // end date, the "Repeats" indicator on a recurring occurrence, and the
  // edit-changes-the-series confirm.
  describe('recurring activities (FHS-476)', () => {
    it('turning on Repeat weekly pre-checks the activity’s own weekday', async () => {
      installApi({});
      renderAt('/t/khans/dashboard');
      await waitFor(() => expect(screen.getByTestId('calendar-ready')).toBeInTheDocument());

      const today = todayIso();
      act(() => {
        fireEvent.click(screen.getByTestId(`calendar-add-${today}`));
      });
      act(() => {
        fireEvent.click(screen.getByTestId('calendar-form-repeat-toggle'));
      });
      const preChecked = weekdayOfIso(today);
      expect(
        (screen.getByTestId(`calendar-form-day-${preChecked}`) as HTMLInputElement).checked,
      ).toBe(true);
    });

    it('creating a recurring activity POSTs recurrenceDays + recurrenceEndDate', async () => {
      // Pin "today" to a known Monday so the day-checkbox clicks below are
      // deterministic regardless of which weekday the suite actually runs on.
      vi.useFakeTimers({ toFake: ['Date'] });
      vi.setSystemTime(new Date('2026-07-06T09:00:00')); // a Monday
      const today = '2026-07-06';

      installApi({});
      renderAt('/t/khans/dashboard');
      await waitFor(() => expect(screen.getByTestId('calendar-ready')).toBeInTheDocument());

      act(() => {
        fireEvent.click(screen.getByTestId(`calendar-add-${today}`));
      });
      act(() => {
        fireEvent.change(screen.getByTestId('calendar-form-title'), {
          target: { value: 'Tennis' },
        });
        fireEvent.click(screen.getByTestId('calendar-form-repeat-toggle'));
      });
      // Monday (1) is pre-checked; swap it for Tuesday (2) + Thursday (4).
      act(() => {
        fireEvent.click(screen.getByTestId('calendar-form-day-1'));
        fireEvent.click(screen.getByTestId('calendar-form-day-2'));
        fireEvent.click(screen.getByTestId('calendar-form-day-4'));
        fireEvent.change(screen.getByTestId('calendar-form-repeat-end'), {
          target: { value: '2026-12-31' },
        });
      });
      await act(async () => {
        fireEvent.click(screen.getByTestId('calendar-form-save'));
      });

      const postCall = fetchMock.mock.calls.find(([, init]) => init?.method === 'POST');
      const body = JSON.parse((postCall![1] as RequestInit).body as string) as {
        recurrenceDays: number[] | null;
        recurrenceEndDate: string | null;
      };
      expect(body.recurrenceDays).toEqual([2, 4]);
      expect(body.recurrenceEndDate).toBe('2026-12-31');
    });

    it('blocks saving when Repeat weekly is on but no day is picked', async () => {
      installApi({});
      renderAt('/t/khans/dashboard');
      await waitFor(() => expect(screen.getByTestId('calendar-ready')).toBeInTheDocument());

      const today = todayIso();
      act(() => {
        fireEvent.click(screen.getByTestId(`calendar-add-${today}`));
      });
      act(() => {
        fireEvent.change(screen.getByTestId('calendar-form-title'), {
          target: { value: 'Tennis' },
        });
        fireEvent.click(screen.getByTestId('calendar-form-repeat-toggle'));
      });
      // Untick the day that got pre-checked, leaving none selected.
      const preChecked = weekdayOfIso(today);
      act(() => {
        fireEvent.click(screen.getByTestId(`calendar-form-day-${preChecked}`));
      });
      await act(async () => {
        fireEvent.click(screen.getByTestId('calendar-form-save'));
      });

      expect(screen.getByTestId('calendar-save-error').textContent).toMatch(/pick at least one/i);
      expect(fetchMock.mock.calls.some(([, init]) => init?.method === 'POST')).toBe(false);
    });

    it('a recurring occurrence renders with a "Repeats" indicator', async () => {
      installApi({
        events: [
          ev({
            id: 'series-1',
            title: 'Tennis',
            isRecurring: true,
            recurrenceDays: [weekdayOfIso(mondayIso())],
            recurrenceEndDate: null,
          }),
        ],
      });
      renderAt('/t/khans/dashboard');
      await waitFor(() => expect(screen.getByTestId('calendar-ready')).toBeInTheDocument());

      const key = `series-1-${mondayIso()}`;
      expect(screen.getByTestId(`calendar-event-${key}-repeats`)).toBeInTheDocument();
    });

    it('editing a recurring occurrence confirms first, then pre-fills its days + end date', async () => {
      const seriesEv = ev({
        id: 'series-2',
        title: 'Piano',
        isRecurring: true,
        recurrenceDays: [2, 4],
        recurrenceEndDate: '2026-12-31',
        seriesStartDate: '2026-01-05',
      });
      installApi({ events: [seriesEv] });
      renderAt('/t/khans/dashboard');
      await waitFor(() => expect(screen.getByTestId('calendar-ready')).toBeInTheDocument());

      const key = `series-2-${mondayIso()}`;
      act(() => {
        fireEvent.click(screen.getByTestId(`calendar-edit-${key}`));
      });
      // No edit form yet: the confirm gates it.
      expect(screen.queryByTestId('calendar-add-form')).not.toBeInTheDocument();
      await waitFor(() =>
        expect(screen.getByTestId('calendar-edit-recurring-confirm')).toBeInTheDocument(),
      );
      expect(screen.getByTestId('calendar-edit-recurring-confirm-message').textContent).toMatch(
        /whole repeating activity/i,
      );

      await act(async () => {
        fireEvent.click(screen.getByTestId('calendar-edit-recurring-confirm-confirm'));
      });

      expect(screen.getByTestId('calendar-add-form')).toBeInTheDocument();
      expect((screen.getByTestId('calendar-form-title') as HTMLInputElement).value).toBe('Piano');
      expect((screen.getByTestId('calendar-form-day-2') as HTMLInputElement).checked).toBe(true);
      expect((screen.getByTestId('calendar-form-day-4') as HTMLInputElement).checked).toBe(true);
      expect((screen.getByTestId('calendar-form-repeat-end') as HTMLInputElement).value).toBe(
        '2026-12-31',
      );

      // Saving PUTs the series' real anchor date, not the occurrence's own
      // (this week's) date.
      await act(async () => {
        fireEvent.click(screen.getByTestId('calendar-form-save'));
      });
      const putCall = fetchMock.mock.calls.find(
        ([url, init]) => String(url).includes('/api/events/series-2') && init?.method === 'PUT',
      );
      expect(putCall).toBeTruthy();
      const body = JSON.parse((putCall![1] as RequestInit).body as string) as { date: string };
      expect(body.date).toBe('2026-01-05');
    });

    it('deleting a recurring occurrence warns it removes the whole series (FHS-476)', async () => {
      installApi({
        events: [
          ev({
            id: 'series-del',
            title: 'Tennis',
            isRecurring: true,
            recurrenceDays: [weekdayOfIso(mondayIso())],
            recurrenceEndDate: null,
          }),
        ],
      });
      renderAt('/t/khans/dashboard');
      await waitFor(() => expect(screen.getByTestId('calendar-ready')).toBeInTheDocument());

      act(() => {
        fireEvent.click(screen.getByTestId(`calendar-delete-series-del-${mondayIso()}`));
      });
      await waitFor(() =>
        expect(screen.getByTestId('calendar-delete-confirm')).toBeInTheDocument(),
      );
      expect(screen.getByTestId('calendar-delete-confirm-message').textContent).toMatch(
        /whole repeating activity/i,
      );
    });

    it('un-checking Repeat weekly makes a one-off on ITS day, not the anchor (FHS-476)', async () => {
      installApi({
        events: [
          ev({
            id: 'series-un',
            title: 'Piano',
            isRecurring: true,
            recurrenceDays: [2, 4],
            recurrenceEndDate: '2026-12-31',
            seriesStartDate: '2026-01-05',
          }),
        ],
      });
      renderAt('/t/khans/dashboard');
      await waitFor(() => expect(screen.getByTestId('calendar-ready')).toBeInTheDocument());

      const key = `series-un-${mondayIso()}`;
      act(() => {
        fireEvent.click(screen.getByTestId(`calendar-edit-${key}`));
      });
      await waitFor(() =>
        expect(screen.getByTestId('calendar-edit-recurring-confirm')).toBeInTheDocument(),
      );
      await act(async () => {
        fireEvent.click(screen.getByTestId('calendar-edit-recurring-confirm-confirm'));
      });
      // Turn OFF the repeat, making this occurrence a plain one-off.
      act(() => {
        fireEvent.click(screen.getByTestId('calendar-form-repeat-toggle'));
      });
      await act(async () => {
        fireEvent.click(screen.getByTestId('calendar-form-save'));
      });

      const putCall = fetchMock.mock.calls.find(
        ([url, init]) => String(url).includes('/api/events/series-un') && init?.method === 'PUT',
      );
      const body = JSON.parse((putCall![1] as RequestInit).body as string) as {
        date: string;
        recurrenceDays: number[] | null;
      };
      expect(body.recurrenceDays).toBeNull();
      // The day the parent was looking at: NOT the 2026-01-05 series anchor.
      expect(body.date).toBe(mondayIso());
    });

    it('cancelling the edit-series confirm leaves the form closed', async () => {
      const seriesEv = ev({
        id: 'series-3',
        title: 'Piano',
        isRecurring: true,
        recurrenceDays: [weekdayOfIso(mondayIso())],
      });
      installApi({ events: [seriesEv] });
      renderAt('/t/khans/dashboard');
      await waitFor(() => expect(screen.getByTestId('calendar-ready')).toBeInTheDocument());

      const key = `series-3-${mondayIso()}`;
      act(() => {
        fireEvent.click(screen.getByTestId(`calendar-edit-${key}`));
      });
      await waitFor(() =>
        expect(screen.getByTestId('calendar-edit-recurring-confirm')).toBeInTheDocument(),
      );
      await act(async () => {
        fireEvent.click(screen.getByTestId('calendar-edit-recurring-confirm-cancel'));
      });

      expect(screen.queryByTestId('calendar-add-form')).not.toBeInTheDocument();
      expect(screen.queryByTestId('calendar-edit-recurring-confirm')).not.toBeInTheDocument();
    });
  });
});
