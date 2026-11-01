import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor, fireEvent, act, within } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';

// FHS-264: MealsTabPanel redesign. Day cards, filter pills, avatar
// dots, repeat icon, and the who-for + recurring editor. A small
// in-memory fake stands in for the API so add / edit / delete + refetch
// behave like the real backend.

const fetchMock = vi.fn();
const authState: { session: { access_token?: string } | null } = {
  session: { access_token: 'tok-abc' },
};
vi.mock('../../../../../src/app/lib/auth-context', () => ({
  useAuth: () => authState,
}));

import { MealsTabPanel } from '../../../../../src/areas/meals/MealsTabPanel';
import { TenantProvider } from '../../../../../src/app/lib/tenant-context';

interface Meal {
  id: string;
  dayOfWeek: string;
  slot: string;
  name: string;
  memberId: string | null;
  recurring: boolean;
}
interface Member {
  id: string;
  displayName: string;
  avatarEmoji: string | null;
}

// Wires fetchMock to a mutable in-memory store. GET /api/meals and
// /api/members read it; POST /api/meals upserts/deletes like the API.
function installApi(opts: {
  meals?: Meal[];
  members?: Member[];
  mealsOk?: boolean;
  mealsStatus?: number;
}) {
  const state = {
    meals: [...(opts.meals ?? [])],
    members: [...(opts.members ?? [])],
  };
  let gen = 0;
  fetchMock.mockImplementation((url: string, init?: RequestInit) => {
    const u = String(url);
    if (init?.method === 'POST') {
      const body = JSON.parse(init.body as string) as {
        dayOfWeek: string;
        slot: string;
        name: string;
        memberId: string | null;
        recurring: boolean;
      };
      const match = (m: Meal) =>
        m.dayOfWeek === body.dayOfWeek && m.slot === body.slot && m.memberId === body.memberId;
      if (body.name.trim() === '') {
        state.meals = state.meals.filter((m) => !match(m));
        return Promise.resolve({ ok: true, status: 200, json: async () => ({ deleted: true }) });
      }
      const idx = state.meals.findIndex(match);
      const row: Meal = {
        id: idx >= 0 ? state.meals[idx]!.id : `gen-${++gen}`,
        dayOfWeek: body.dayOfWeek,
        slot: body.slot,
        name: body.name.trim(),
        memberId: body.memberId,
        recurring: body.recurring,
      };
      if (idx >= 0) state.meals[idx] = row;
      else state.meals.push(row);
      return Promise.resolve({ ok: true, status: 200, json: async () => row });
    }
    if (u.includes('/api/members')) {
      return Promise.resolve({
        ok: true,
        status: 200,
        json: async () => ({ members: state.members, callerRole: 'admin' }),
      });
    }
    // GET /api/meals
    return Promise.resolve({
      ok: opts.mealsOk ?? true,
      status: opts.mealsStatus ?? 200,
      json: async () => ({ meals: state.meals }),
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
              <MealsTabPanel />
            </TenantProvider>
          }
        />
      </Routes>
    </MemoryRouter>,
  );
}

const ALI = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const SARA = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const MEMBERS: Member[] = [
  { id: ALI, displayName: 'Ali', avatarEmoji: '👦' },
  { id: SARA, displayName: 'Sara', avatarEmoji: '👧' },
];

beforeEach(() => {
  fetchMock.mockReset();
  vi.stubGlobal('fetch', fetchMock);
  authState.session = { access_token: 'tok-abc' };
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe('<MealsTabPanel />', () => {
  it('renders a loading hint while the request is in flight', () => {
    fetchMock.mockReturnValue(new Promise(() => {}));
    renderAt('/t/khans/dashboard');
    expect(screen.getByTestId('meals-loading')).toBeInTheDocument();
  });

  it('renders the inline error when the meals API returns a non-2xx', async () => {
    installApi({ mealsOk: false, mealsStatus: 500 });
    renderAt('/t/khans/dashboard');
    await waitFor(() => expect(screen.getByTestId('meals-error')).toBeInTheDocument());
  });

  it('fetches both /api/meals and /api/members', async () => {
    installApi({ members: MEMBERS });
    renderAt('/t/khans/dashboard');
    await waitFor(() => expect(screen.getByTestId('meals-ready')).toBeInTheDocument());
    const urls = fetchMock.mock.calls.map(([u]) => String(u));
    expect(urls.some((u) => u.endsWith('/api/meals'))).toBe(true);
    expect(urls.some((u) => u.endsWith('/api/members'))).toBe(true);
  });

  it('renders 7 day cards, a legend, and All/member filter pills (no Family chip)', async () => {
    installApi({ members: MEMBERS });
    renderAt('/t/khans/dashboard');
    await waitFor(() => expect(screen.getByTestId('meals-ready')).toBeInTheDocument());
    for (const d of ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun']) {
      expect(screen.getByTestId(`meals-day-${d}`)).toBeInTheDocument();
    }
    expect(screen.getByTestId('meals-legend')).toBeInTheDocument();
    expect(screen.getByTestId('meals-week-range')).toBeInTheDocument();
    expect(screen.getByTestId('meals-filter-all')).toBeInTheDocument();
    // FHS-525: the "Family" chip is gone; "All" now means everyone.
    expect(screen.queryByTestId('meals-filter-family')).not.toBeInTheDocument();
    expect(screen.getByTestId(`meals-filter-${ALI}`)).toBeInTheDocument();
    // Empty day still shows its Add Meal button.
    expect(screen.getByTestId('meals-add-mon')).toBeInTheDocument();
  });

  // FHS-444: "Week N" alone reads like a mystery code; a hover/focus
  // tooltip spells out the same real date range shown as the page subtitle.
  it('the Week N pill carries a title tooltip with the real date range', async () => {
    installApi({ members: MEMBERS });
    renderAt('/t/khans/dashboard');
    await waitFor(() => expect(screen.getByTestId('meals-ready')).toBeInTheDocument());
    const pill = screen.getByTestId('meals-week-number');
    const range = screen.getByTestId('meals-week-range').textContent;
    expect(pill.getAttribute('title')).toContain(range);
  });

  it('shows a meal with its name, avatar dot, and a repeat icon when recurring', async () => {
    installApi({
      members: MEMBERS,
      meals: [
        {
          id: 'm1',
          dayOfWeek: 'mon',
          slot: 'breakfast',
          name: 'Porridge',
          memberId: null,
          recurring: true,
        },
        {
          id: 'm2',
          dayOfWeek: 'mon',
          slot: 'dinner',
          name: 'Eggs',
          memberId: ALI,
          recurring: false,
        },
      ],
    });
    renderAt('/t/khans/dashboard');
    await waitFor(() => expect(screen.getByTestId('meals-ready')).toBeInTheDocument());
    expect(screen.getByTestId('meals-meal-m1-name').textContent).toBe('Porridge');
    expect(screen.getByTestId('meals-meal-m1-avatar')).toBeInTheDocument();
    // Recurring shows the repeat icon; non-recurring does not.
    expect(screen.getByTestId('meals-meal-m1-recurring')).toBeInTheDocument();
    expect(screen.queryByTestId('meals-meal-m2-recurring')).not.toBeInTheDocument();
  });

  it('filter pills narrow the view by exact owner (All = everyone; member = only theirs)', async () => {
    installApi({
      members: MEMBERS,
      meals: [
        {
          id: 'fam',
          dayOfWeek: 'mon',
          slot: 'breakfast',
          name: 'Family toast',
          memberId: null,
          recurring: false,
        },
        {
          id: 'ali',
          dayOfWeek: 'mon',
          slot: 'lunch',
          name: 'Ali sandwich',
          memberId: ALI,
          recurring: false,
        },
        {
          id: 'sara',
          dayOfWeek: 'mon',
          slot: 'lunch',
          name: 'Sara salad',
          memberId: SARA,
          recurring: false,
        },
      ],
    });
    renderAt('/t/khans/dashboard');
    await waitFor(() => expect(screen.getByTestId('meals-ready')).toBeInTheDocument());

    // Member pill → only that member's meals.
    act(() => {
      fireEvent.click(screen.getByTestId(`meals-filter-${ALI}`));
    });
    expect(screen.getByTestId('meals-meal-ali-name')).toBeInTheDocument();
    expect(screen.queryByTestId('meals-meal-fam-name')).not.toBeInTheDocument();
    expect(screen.queryByTestId('meals-meal-sara-name')).not.toBeInTheDocument();

    // "All" → everyone: family-wide + every member's meals (FHS-525).
    act(() => {
      fireEvent.click(screen.getByTestId('meals-filter-all'));
    });
    expect(screen.getByTestId('meals-meal-fam-name')).toBeInTheDocument();
    expect(screen.getByTestId('meals-meal-ali-name')).toBeInTheDocument();
    expect(screen.getByTestId('meals-meal-sara-name')).toBeInTheDocument();
    // No Family chip exists to click.
    expect(screen.queryByTestId('meals-filter-family')).not.toBeInTheDocument();
  });

  it('adding a meal POSTs day/slot/name/memberId/recurring and shows it after refetch', async () => {
    installApi({ members: MEMBERS });
    renderAt('/t/khans/dashboard');
    await waitFor(() => expect(screen.getByTestId('meals-ready')).toBeInTheDocument());

    act(() => {
      fireEvent.click(screen.getByTestId('meals-add-tue'));
    });
    expect(screen.getByTestId('meals-editor')).toBeInTheDocument();
    // In-app dropdowns (FHS-359): open then pick the option.
    act(() => {
      fireEvent.click(within(screen.getByTestId('meals-editor-slot')).getByRole('button'));
    });
    act(() => {
      fireEvent.click(within(screen.getByRole('listbox')).getByText('Lunch'));
    });
    act(() => {
      fireEvent.click(within(screen.getByTestId('meals-editor-member')).getByRole('button'));
    });
    act(() => {
      fireEvent.click(within(screen.getByRole('listbox')).getByText('Ali'));
    });
    act(() => {
      fireEvent.change(screen.getByTestId('meals-editor-name'), { target: { value: 'Soup' } });
      fireEvent.click(screen.getByTestId('meals-editor-recurring'));
    });
    await act(async () => {
      fireEvent.click(screen.getByTestId('meals-editor-save'));
    });

    await waitFor(() => expect(screen.getByText('Soup')).toBeInTheDocument());
    const postCall = fetchMock.mock.calls.find(([, init]) => init?.method === 'POST');
    expect(JSON.parse((postCall![1] as RequestInit).body as string)).toEqual({
      dayOfWeek: 'tue',
      slot: 'lunch',
      name: 'Soup',
      memberId: ALI,
      recurring: true,
    });
  });

  // FHS-477: a beta tester filtered to one child, added a meal, and it
  // "disappeared" until they switched back to All. The default Add Meal
  // pre-fill already targets the active filter's child, so it should show
  // immediately without the user touching the filter at all.
  it('a meal added under an active child filter shows immediately, no filter switch needed (FHS-477)', async () => {
    installApi({ members: MEMBERS });
    renderAt('/t/khans/dashboard');
    await waitFor(() => expect(screen.getByTestId('meals-ready')).toBeInTheDocument());

    act(() => {
      fireEvent.click(screen.getByTestId(`meals-filter-${ALI}`));
    });
    act(() => {
      fireEvent.click(screen.getByTestId('meals-add-mon'));
    });
    act(() => {
      fireEvent.change(screen.getByTestId('meals-editor-name'), { target: { value: 'Soup' } });
    });
    await act(async () => {
      fireEvent.click(screen.getByTestId('meals-editor-save'));
    });

    // Still on Ali's filter: the meal is visible without any manual switch.
    expect(screen.getByTestId(`meals-filter-${ALI}`)).toHaveAttribute('aria-pressed', 'true');
    await waitFor(() => expect(screen.getByText('Soup')).toBeInTheDocument());
  });

  // FHS-477: if the saved meal's owner does NOT match the active filter
  // (e.g. assigned to "Everyone" while viewing one child's plan), it used
  // to save fine but vanish from view with no explanation. The view now
  // widens to "All" so a just-saved meal is never silently hidden.
  it('widens to the All filter so a just-saved meal that does not match the active filter is never hidden (FHS-477)', async () => {
    installApi({ members: MEMBERS });
    renderAt('/t/khans/dashboard');
    await waitFor(() => expect(screen.getByTestId('meals-ready')).toBeInTheDocument());

    act(() => {
      fireEvent.click(screen.getByTestId(`meals-filter-${ALI}`));
    });
    act(() => {
      fireEvent.click(screen.getByTestId('meals-add-mon'));
    });
    // Deliberately re-target to "Everyone (family)": no longer matches
    // the active Ali filter.
    act(() => {
      fireEvent.click(within(screen.getByTestId('meals-editor-member')).getByRole('button'));
    });
    act(() => {
      fireEvent.click(within(screen.getByRole('listbox')).getByText('Everyone (family)'));
    });
    act(() => {
      fireEvent.change(screen.getByTestId('meals-editor-name'), { target: { value: 'Toast' } });
    });
    await act(async () => {
      fireEvent.click(screen.getByTestId('meals-editor-save'));
    });

    // Filter auto-widens to All so the saved meal is never silently hidden.
    await waitFor(() =>
      expect(screen.getByTestId('meals-filter-all')).toHaveAttribute('aria-pressed', 'true'),
    );
    expect(screen.getByText('Toast')).toBeInTheDocument();
    expect(screen.getByTestId('meals-announcement').textContent).toMatch(/Toast saved/i);
  });

  it('defaults the Add Meal slot to breakfast in the morning (FHS-442)', async () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date('2026-07-06T08:30:00')); // 08:30 → breakfast
    installApi({ members: MEMBERS });
    renderAt('/t/khans/dashboard');
    await waitFor(() => expect(screen.getByTestId('meals-ready')).toBeInTheDocument());

    act(() => {
      fireEvent.click(screen.getByTestId('meals-add-mon'));
    });
    expect(
      within(screen.getByTestId('meals-editor-slot')).getByRole('button').textContent,
    ).toContain('Breakfast');
  });

  it('defaults the Add Meal slot to lunch around midday (FHS-442)', async () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date('2026-07-06T12:15:00')); // 12:15 → lunch
    installApi({ members: MEMBERS });
    renderAt('/t/khans/dashboard');
    await waitFor(() => expect(screen.getByTestId('meals-ready')).toBeInTheDocument());

    act(() => {
      fireEvent.click(screen.getByTestId('meals-add-mon'));
    });
    expect(
      within(screen.getByTestId('meals-editor-slot')).getByRole('button').textContent,
    ).toContain('Lunch');
  });

  it('defaults the Add Meal slot to dinner in the evening (FHS-442)', async () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date('2026-07-06T18:00:00')); // 18:00 → dinner
    installApi({ members: MEMBERS });
    renderAt('/t/khans/dashboard');
    await waitFor(() => expect(screen.getByTestId('meals-ready')).toBeInTheDocument());

    act(() => {
      fireEvent.click(screen.getByTestId('meals-add-mon'));
    });
    expect(
      within(screen.getByTestId('meals-editor-slot')).getByRole('button').textContent,
    ).toContain('Dinner');
  });

  it('defaults the Add Meal slot to snack late at night (FHS-442)', async () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date('2026-07-06T22:00:00')); // 22:00 → snack
    installApi({ members: MEMBERS });
    renderAt('/t/khans/dashboard');
    await waitFor(() => expect(screen.getByTestId('meals-ready')).toBeInTheDocument());

    act(() => {
      fireEvent.click(screen.getByTestId('meals-add-mon'));
    });
    expect(
      within(screen.getByTestId('meals-editor-slot')).getByRole('button').textContent,
    ).toContain('Snack');
  });

  it('the snack add button pre-sets slot=snack and saves a snack (FHS-317)', async () => {
    installApi({ members: MEMBERS });
    renderAt('/t/khans/dashboard');
    await waitFor(() => expect(screen.getByTestId('meals-ready')).toBeInTheDocument());

    act(() => {
      fireEvent.click(screen.getByTestId('meals-add-snack-tue'));
    });
    // Editor opens already targeting snack: no dropdown change needed.
    expect(screen.getByTestId('meals-editor')).toBeInTheDocument();
    expect(
      within(screen.getByTestId('meals-editor-slot')).getByRole('button').textContent,
    ).toContain('Snack');
    act(() => {
      fireEvent.change(screen.getByTestId('meals-editor-name'), {
        target: { value: 'Apple slices' },
      });
    });
    await act(async () => {
      fireEvent.click(screen.getByTestId('meals-editor-save'));
    });

    await waitFor(() => expect(screen.getByText('Apple slices')).toBeInTheDocument());
    const postCall = fetchMock.mock.calls.find(([, init]) => init?.method === 'POST');
    expect(JSON.parse((postCall![1] as RequestInit).body as string)).toMatchObject({
      dayOfWeek: 'tue',
      slot: 'snack',
      name: 'Apple slices',
    });
  });

  it('clicking a meal opens the editor pre-filled and saves an edit', async () => {
    installApi({
      members: MEMBERS,
      meals: [
        {
          id: 'm1',
          dayOfWeek: 'wed',
          slot: 'dinner',
          name: 'Pasta',
          memberId: null,
          recurring: false,
        },
      ],
    });
    renderAt('/t/khans/dashboard');
    await waitFor(() => expect(screen.getByTestId('meals-ready')).toBeInTheDocument());

    act(() => {
      fireEvent.click(screen.getByTestId('meals-meal-m1'));
    });
    const input = screen.getByTestId('meals-editor-name') as HTMLInputElement;
    expect(input.value).toBe('Pasta');
    act(() => {
      fireEvent.change(input, { target: { value: 'Lasagne' } });
    });
    await act(async () => {
      fireEvent.click(screen.getByTestId('meals-editor-save'));
    });
    await waitFor(() => expect(screen.getByText('Lasagne')).toBeInTheDocument());
  });

  it('removing a meal sends an empty name and drops it from the grid', async () => {
    installApi({
      members: MEMBERS,
      meals: [
        {
          id: 'm1',
          dayOfWeek: 'thu',
          slot: 'lunch',
          name: 'Wraps',
          memberId: null,
          recurring: false,
        },
      ],
    });
    renderAt('/t/khans/dashboard');
    await waitFor(() => expect(screen.getByTestId('meals-ready')).toBeInTheDocument());

    act(() => {
      fireEvent.click(screen.getByTestId('meals-meal-m1'));
    });
    await act(async () => {
      fireEvent.click(screen.getByTestId('meals-editor-delete'));
    });
    await waitFor(() => expect(screen.queryByTestId('meals-meal-m1-name')).not.toBeInTheDocument());
    const postCall = fetchMock.mock.calls.find(([, init]) => init?.method === 'POST');
    expect(JSON.parse((postCall![1] as RequestInit).body as string).name).toBe('');
  });

  it('shows Remove only when editing an existing meal, not when adding', async () => {
    installApi({
      members: MEMBERS,
      meals: [
        {
          id: 'm1',
          dayOfWeek: 'fri',
          slot: 'dinner',
          name: 'Fish',
          memberId: null,
          recurring: false,
        },
      ],
    });
    renderAt('/t/khans/dashboard');
    await waitFor(() => expect(screen.getByTestId('meals-ready')).toBeInTheDocument());

    // Adding → no Remove button.
    act(() => {
      fireEvent.click(screen.getByTestId('meals-add-fri'));
    });
    expect(screen.queryByTestId('meals-editor-delete')).not.toBeInTheDocument();

    // Editing an existing meal → Remove present.
    act(() => {
      fireEvent.click(screen.getByTestId('meals-meal-m1'));
    });
    expect(screen.getByTestId('meals-editor-delete')).toBeInTheDocument();
  });

  it('Escape in the name field closes the editor', async () => {
    installApi({ members: MEMBERS });
    renderAt('/t/khans/dashboard');
    await waitFor(() => expect(screen.getByTestId('meals-ready')).toBeInTheDocument());

    act(() => {
      fireEvent.click(screen.getByTestId('meals-add-mon'));
    });
    expect(screen.getByTestId('meals-editor')).toBeInTheDocument();
    act(() => {
      fireEvent.keyDown(screen.getByTestId('meals-editor-name'), { key: 'Escape' });
    });
    expect(screen.queryByTestId('meals-editor')).not.toBeInTheDocument();
  });

  it('labels a meal whose member did not load as a family member, not "Everyone"', async () => {
    // Members fetch returns empty (degraded), but a meal is assigned to ALI.
    installApi({
      members: [],
      meals: [
        {
          id: 'm1',
          dayOfWeek: 'mon',
          slot: 'lunch',
          name: 'Ali wrap',
          memberId: ALI,
          recurring: false,
        },
      ],
    });
    renderAt('/t/khans/dashboard');
    await waitFor(() => expect(screen.getByTestId('meals-ready')).toBeInTheDocument());
    const dot = screen.getByTestId('meals-meal-m1-avatar');
    expect(dot.getAttribute('aria-label')).toBe('Family member');
  });

  it('pre-fills the editor who-for from the active member filter', async () => {
    installApi({ members: MEMBERS });
    renderAt('/t/khans/dashboard');
    await waitFor(() => expect(screen.getByTestId('meals-ready')).toBeInTheDocument());

    act(() => {
      fireEvent.click(screen.getByTestId(`meals-filter-${SARA}`));
    });
    act(() => {
      fireEvent.click(screen.getByTestId('meals-add-mon'));
    });
    expect(
      within(screen.getByTestId('meals-editor-member')).getByRole('button').textContent,
    ).toContain('Sara');
  });

  it('pre-fills the editor who-for as Everyone under the All filter (FHS-525)', async () => {
    installApi({ members: MEMBERS });
    renderAt('/t/khans/dashboard');
    await waitFor(() => expect(screen.getByTestId('meals-ready')).toBeInTheDocument());

    // Default filter is "All" → a new meal defaults to Everyone (family-wide).
    act(() => {
      fireEvent.click(screen.getByTestId('meals-add-mon'));
    });
    expect(
      within(screen.getByTestId('meals-editor-member')).getByRole('button').textContent,
    ).toContain('Everyone');
  });

  it('passes the bearer token + tenant slug on requests', async () => {
    installApi({ members: MEMBERS });
    renderAt('/t/khans/dashboard');
    await waitFor(() => expect(fetchMock).toHaveBeenCalled());
    const [, init] = fetchMock.mock.calls[0]!;
    expect(init.headers).toMatchObject({
      Authorization: 'Bearer tok-abc',
      'x-tenant-slug': 'khans',
    });
  });
});
