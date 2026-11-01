import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor, fireEvent, act, within } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';

// FHS-231 / FHS-266: AssignmentsTabPanel (Magic Patterns layout).
// Member filter pills, avatar dot + name badge per row, a single list
// with done rows dimmed, and an inline add form with a member <select>.

const fetchMock = vi.fn();
const authState: { session: { access_token?: string } | null } = {
  session: { access_token: 'tok-abc' },
};
vi.mock('../../../../../src/app/lib/auth-context', () => ({
  useAuth: () => authState,
}));

import {
  AssignmentsTabPanel,
  localToday,
} from '../../../../../src/areas/assignments/AssignmentsTabPanel';
import { TenantProvider } from '../../../../../src/app/lib/tenant-context';

interface A {
  id: string;
  title: string;
  notes: string | null;
  dueDate: string | null;
  memberId: string | null;
  done: boolean;
  doneAt: string | null;
}
const ALI = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const SARA = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const MEMBERS = [
  { id: ALI, displayName: 'Ali', avatarEmoji: '👦' },
  { id: SARA, displayName: 'Sara', avatarEmoji: '👧' },
];

// URL-routing fetch mock: assignments + members are fetched together via
// Promise.all, so a sequence of mockResolvedValueOnce can't model it.
function installApi(opts: {
  assignments?: A[];
  aOk?: boolean;
  aStatus?: number;
  callerRole?: string;
  deleteStatus?: number;
}) {
  const state = { assignments: [...(opts.assignments ?? [])] };
  fetchMock.mockImplementation((url: string, init?: RequestInit) => {
    const u = String(url);
    if (u.includes('/api/members')) {
      return Promise.resolve({
        ok: true,
        status: 200,
        json: async () => ({ members: MEMBERS, callerRole: opts.callerRole ?? 'admin' }),
      });
    }
    if (init?.method === 'POST') {
      const b = JSON.parse(init.body as string) as Partial<A>;
      const row: A = {
        id: `gen-${state.assignments.length + 1}`,
        title: b.title ?? '',
        notes: null,
        dueDate: b.dueDate ?? null,
        memberId: b.memberId ?? null,
        done: false,
        doneAt: null,
      };
      state.assignments.push(row);
      return Promise.resolve({ ok: true, status: 201, json: async () => row });
    }
    if (init?.method === 'PATCH') {
      const id = u.split('/api/assignments/')[1]!;
      const next = JSON.parse(init.body as string) as { done: boolean };
      state.assignments = state.assignments.map((a) =>
        a.id === id ? { ...a, done: next.done } : a,
      );
      return Promise.resolve({ ok: true, status: 200, json: async () => ({}) });
    }
    if (init?.method === 'PUT') {
      const idMatch = u.match(/\/api\/assignments\/([^?]+)/);
      const id = idMatch?.[1];
      const patch = JSON.parse(init.body as string) as Partial<A>;
      const idx = state.assignments.findIndex((a) => a.id === id);
      if (idx >= 0) state.assignments[idx] = { ...state.assignments[idx]!, ...patch };
      return Promise.resolve({
        ok: true,
        status: 200,
        json: async () => state.assignments[idx],
      });
    }
    if (init?.method === 'DELETE') {
      const id = u.split('/api/assignments/')[1]!;
      const status = opts.deleteStatus ?? 204;
      if (status < 300) state.assignments = state.assignments.filter((a) => a.id !== id);
      return Promise.resolve({ ok: status < 300, status, json: async () => ({}) });
    }
    return Promise.resolve({
      ok: opts.aOk ?? true,
      status: opts.aStatus ?? 200,
      json: async () => ({ assignments: state.assignments }),
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
              <AssignmentsTabPanel />
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
  vi.unstubAllGlobals();
});

describe('<AssignmentsTabPanel />', () => {
  it('renders a loading hint while the request is in flight', () => {
    fetchMock.mockReturnValue(new Promise(() => {}));
    renderAt('/t/khans/dashboard');
    expect(screen.getByTestId('assignments-loading')).toBeInTheDocument();
  });

  it('renders inline error when the assignments request fails', async () => {
    installApi({ aOk: false, aStatus: 500 });
    renderAt('/t/khans/dashboard');
    await waitFor(() => expect(screen.getByTestId('assignments-error')).toBeInTheDocument());
  });

  it('renders the empty state + a filter pill per member', async () => {
    installApi({ assignments: [] });
    renderAt('/t/khans/dashboard');
    await waitFor(() => expect(screen.getByTestId('assignments-ready')).toBeInTheDocument());
    expect(screen.getByTestId('assignments-empty')).toBeInTheDocument();
    expect(screen.getByTestId('assignments-filter-all')).toBeInTheDocument();
    expect(screen.getByTestId(`assignments-filter-${ALI}`)).toBeInTheDocument();
    expect(screen.getByTestId(`assignments-filter-${SARA}`)).toBeInTheDocument();
  });

  it('renders rows with an avatar dot + member badge; whole-family rows read "Family"', async () => {
    installApi({
      assignments: [
        {
          id: 'a1',
          title: 'Maths',
          notes: null,
          dueDate: '2026-06-20',
          memberId: ALI,
          done: false,
          doneAt: null,
        },
        {
          id: 'a2',
          title: 'Tidy up',
          notes: null,
          dueDate: null,
          memberId: null,
          done: false,
          doneAt: null,
        },
      ],
    });
    renderAt('/t/khans/dashboard');
    await waitFor(() => expect(screen.getByTestId('assignments-ready')).toBeInTheDocument());
    expect(screen.getByTestId('assignment-title-a1').textContent).toContain('Maths');
    expect(screen.getByTestId('assignment-avatar-a1')).toBeInTheDocument();
    expect(screen.getByTestId('assignment-member-a1').textContent).toBe('Ali');
    expect(screen.getByTestId('assignment-member-a2').textContent).toBe('Family');
  });

  it('keeps done rows in the same list (dimmed), not a separate section', async () => {
    installApi({
      assignments: [
        {
          id: 'a1',
          title: 'Spelling',
          notes: null,
          dueDate: null,
          memberId: ALI,
          done: false,
          doneAt: null,
        },
        {
          id: 'a2',
          title: 'Reading',
          notes: null,
          dueDate: null,
          memberId: SARA,
          done: true,
          doneAt: '2026-06-10T00:00:00Z',
        },
      ],
    });
    renderAt('/t/khans/dashboard');
    await waitFor(() => expect(screen.getByTestId('assignments-ready')).toBeInTheDocument());
    const list = screen.getByTestId('assignments-list');
    expect(list).toContainElement(screen.getByTestId('assignment-row-a1'));
    expect(list).toContainElement(screen.getByTestId('assignment-row-a2'));
    expect(screen.getByTestId('assignment-title-a2').className).toContain('line-through');
  });

  it('filters the list down to one member', async () => {
    installApi({
      assignments: [
        {
          id: 'a1',
          title: 'Maths',
          notes: null,
          dueDate: null,
          memberId: ALI,
          done: false,
          doneAt: null,
        },
        {
          id: 'a2',
          title: 'Piano',
          notes: null,
          dueDate: null,
          memberId: SARA,
          done: false,
          doneAt: null,
        },
      ],
    });
    renderAt('/t/khans/dashboard');
    await waitFor(() => expect(screen.getByTestId('assignments-ready')).toBeInTheDocument());
    act(() => {
      fireEvent.click(screen.getByTestId(`assignments-filter-${ALI}`));
    });
    expect(screen.getByTestId('assignment-row-a1')).toBeInTheDocument();
    expect(screen.queryByTestId('assignment-row-a2')).not.toBeInTheDocument();
  });

  it('falls back to "Family" when the assigned member was deleted', async () => {
    installApi({
      assignments: [
        {
          id: 'a1',
          title: 'Old task',
          notes: null,
          dueDate: null,
          memberId: 'deleted-uuid',
          done: false,
          doneAt: null,
        },
      ],
    });
    renderAt('/t/khans/dashboard');
    await waitFor(() => expect(screen.getByTestId('assignments-ready')).toBeInTheDocument());
    expect(screen.getByTestId('assignment-member-a1').textContent).toBe('Family');
    expect(screen.getByTestId('assignment-avatar-a1').textContent).toBe('👪');
  });

  it('shows a filtered empty state while keeping the member pill selected', async () => {
    installApi({
      assignments: [
        {
          id: 'a1',
          title: 'Piano',
          notes: null,
          dueDate: null,
          memberId: SARA,
          done: false,
          doneAt: null,
        },
      ],
    });
    renderAt('/t/khans/dashboard');
    await waitFor(() => expect(screen.getByTestId('assignments-ready')).toBeInTheDocument());
    act(() => {
      fireEvent.click(screen.getByTestId(`assignments-filter-${ALI}`));
    });
    expect(screen.getByTestId('assignments-empty')).toBeInTheDocument();
    expect(screen.getByTestId(`assignments-filter-${ALI}`).getAttribute('aria-pressed')).toBe(
      'true',
    );
    expect(screen.getByTestId('assignments-empty').textContent).toContain(
      'No assignments for this person',
    );
  });

  it('blocks a whitespace-only title without firing a POST', async () => {
    installApi({ assignments: [] });
    renderAt('/t/khans/dashboard');
    await waitFor(() => expect(screen.getByTestId('assignments-ready')).toBeInTheDocument());
    act(() => {
      fireEvent.click(screen.getByTestId('assignments-add'));
    });
    act(() => {
      fireEvent.change(screen.getByTestId('assignments-add-title'), { target: { value: '   ' } });
    });
    await act(async () => {
      fireEvent.submit(screen.getByTestId('assignments-add-form'));
    });
    expect(screen.getByTestId('assignments-add-error')).toBeInTheDocument();
    expect(fetchMock.mock.calls.some(([, init]) => init?.method === 'POST')).toBe(false);
  });

  it('+ Add opens form; submitting POSTs title + member and refetches', async () => {
    installApi({ assignments: [] });
    renderAt('/t/khans/dashboard');
    await waitFor(() => expect(screen.getByTestId('assignments-ready')).toBeInTheDocument());

    act(() => {
      fireEvent.click(screen.getByTestId('assignments-add'));
    });
    act(() => {
      fireEvent.change(screen.getByTestId('assignments-add-title'), {
        target: { value: 'Spelling' },
      });
      fireEvent.change(screen.getByTestId('assignments-add-due'), {
        target: { value: '2099-05-05' },
      });
      // In-app dropdown (FHS-359): open then pick Ali.
      fireEvent.click(within(screen.getByTestId('assignments-add-member')).getByRole('button'));
    });
    act(() => {
      fireEvent.click(within(screen.getByRole('listbox')).getByText('Ali'));
    });
    await act(async () => {
      fireEvent.click(screen.getByTestId('assignments-add-submit'));
    });
    await waitFor(() => expect(screen.getByText('Spelling')).toBeInTheDocument());
    const postCall = fetchMock.mock.calls.find(([, init]) => init?.method === 'POST');
    expect(postCall).toBeDefined();
    const body = JSON.parse((postCall![1] as RequestInit).body as string);
    expect(body).toMatchObject({ title: 'Spelling', dueDate: '2099-05-05', memberId: ALI });
  });

  it('returns focus to the Add button after cancelling the form', async () => {
    installApi({ assignments: [] });
    renderAt('/t/khans/dashboard');
    await waitFor(() => expect(screen.getByTestId('assignments-ready')).toBeInTheDocument());
    act(() => {
      fireEvent.click(screen.getByTestId('assignments-add'));
    });
    await act(async () => {
      fireEvent.click(screen.getByTestId('assignments-add-cancel'));
    });
    await waitFor(() => expect(screen.getByTestId('assignments-add')).toHaveFocus());
  });

  it('reverts + announces an error when the toggle PATCH fails', async () => {
    const state = installApi({
      assignments: [
        {
          id: 'a1',
          title: 'Spelling',
          notes: null,
          dueDate: null,
          memberId: ALI,
          done: false,
          doneAt: null,
        },
      ],
    });
    // Make PATCH fail.
    fetchMock.mockImplementation((url: string, init?: RequestInit) => {
      const u = String(url);
      if (u.includes('/api/members')) {
        return Promise.resolve({
          ok: true,
          status: 200,
          json: async () => ({ members: MEMBERS, callerRole: 'admin' }),
        });
      }
      if (init?.method === 'PATCH') {
        return Promise.resolve({ ok: false, status: 500, json: async () => ({}) });
      }
      return Promise.resolve({
        ok: true,
        status: 200,
        json: async () => ({ assignments: state.assignments }),
      });
    });
    renderAt('/t/khans/dashboard');
    await waitFor(() => expect(screen.getByTestId('assignment-toggle-a1')).toBeInTheDocument());
    await act(async () => {
      fireEvent.click(screen.getByTestId('assignment-toggle-a1'));
    });
    // Row reverts to not-done (no line-through) + an error is announced.
    await waitFor(() =>
      expect(screen.getByTestId('assignment-title-a1').className).not.toContain('line-through'),
    );
    expect(screen.getByTestId('assignments-error-announcement').textContent).not.toBe('');
  });

  it('toggling the circle PATCHes /api/assignments/:id', async () => {
    installApi({
      assignments: [
        {
          id: 'a1',
          title: 'Spelling',
          notes: null,
          dueDate: null,
          memberId: ALI,
          done: false,
          doneAt: null,
        },
      ],
    });
    renderAt('/t/khans/dashboard');
    await waitFor(() => expect(screen.getByTestId('assignment-toggle-a1')).toBeInTheDocument());

    await act(async () => {
      fireEvent.click(screen.getByTestId('assignment-toggle-a1'));
    });

    const patchCall = fetchMock.mock.calls.find(([, init]) => init?.method === 'PATCH');
    expect(patchCall).toBeDefined();
    expect(patchCall![0]).toBe('http://localhost:3001/api/assignments/a1');
    expect(JSON.parse((patchCall![1] as RequestInit).body as string)).toEqual({ done: true });
    await waitFor(() =>
      expect(screen.getByTestId('assignment-title-a1').className).toContain('line-through'),
    );
  });

  it('passes bearer token + tenant slug on every request', async () => {
    installApi({ assignments: [] });
    renderAt('/t/khans/dashboard');
    await waitFor(() => expect(fetchMock).toHaveBeenCalled());
    const [url, init] = fetchMock.mock.calls[0]!;
    expect(url).toBe('http://localhost:3001/api/assignments');
    expect(init.headers).toMatchObject({
      Authorization: 'Bearer tok-abc',
      'x-tenant-slug': 'khans',
    });
  });

  it('edit button pre-fills the form and save issues a PUT', async () => {
    const existing: A = {
      id: 'a-edit',
      title: 'Old Spelling',
      notes: null,
      dueDate: '2026-05-05',
      memberId: ALI,
      done: false,
      doneAt: null,
    };
    installApi({ assignments: [existing] });
    renderAt('/t/khans/dashboard');
    await waitFor(() => expect(screen.getByTestId('assignments-ready')).toBeInTheDocument());

    act(() => {
      fireEvent.click(screen.getByTestId('assignment-edit-a-edit'));
    });
    // Form opens with pre-filled title
    expect(screen.getByTestId('assignments-add-form')).toBeInTheDocument();
    expect((screen.getByTestId('assignments-add-title') as HTMLInputElement).value).toBe(
      'Old Spelling',
    );

    act(() => {
      fireEvent.change(screen.getByTestId('assignments-add-title'), {
        target: { value: 'New Spelling' },
      });
    });
    await act(async () => {
      fireEvent.click(screen.getByTestId('assignments-add-submit'));
    });

    const putCall = fetchMock.mock.calls.find(
      ([url, init]) => String(url).includes('/api/assignments/a-edit') && init?.method === 'PUT',
    );
    expect(putCall).toBeTruthy();
    expect(JSON.parse((putCall![1] as RequestInit).body as string).title).toBe('New Spelling');
  });

  // FHS-313: gate the add/edit affordances by the caller's role, the same
  // rule the API already enforces (WRITE_ROLES = admin/adult).
  it('hides the add + edit controls for a child caller', async () => {
    installApi({
      assignments: [
        {
          id: 'a1',
          title: 'Maths',
          notes: null,
          dueDate: null,
          memberId: ALI,
          done: false,
          doneAt: null,
        },
      ],
      callerRole: 'child',
    });
    renderAt('/t/khans/dashboard');
    await waitFor(() => expect(screen.getByTestId('assignments-ready')).toBeInTheDocument());
    expect(screen.queryByTestId('assignments-add')).not.toBeInTheDocument();
    expect(screen.queryByTestId('assignment-edit-a1')).not.toBeInTheDocument();
  });

  it('hides the add control for a teen caller', async () => {
    installApi({ assignments: [], callerRole: 'teen' });
    renderAt('/t/khans/dashboard');
    await waitFor(() => expect(screen.getByTestId('assignments-ready')).toBeInTheDocument());
    expect(screen.queryByTestId('assignments-add')).not.toBeInTheDocument();
  });

  it('keeps the add + edit controls visible for an admin caller', async () => {
    installApi({
      assignments: [
        {
          id: 'a1',
          title: 'Maths',
          notes: null,
          dueDate: null,
          memberId: ALI,
          done: false,
          doneAt: null,
        },
      ],
      callerRole: 'admin',
    });
    renderAt('/t/khans/dashboard');
    await waitFor(() => expect(screen.getByTestId('assignments-ready')).toBeInTheDocument());
    expect(screen.getByTestId('assignments-add')).toBeInTheDocument();
    expect(screen.getByTestId('assignment-edit-a1')).toBeInTheDocument();
  });

  it('keeps the add + edit controls visible for an adult caller', async () => {
    installApi({
      assignments: [
        {
          id: 'a1',
          title: 'Maths',
          notes: null,
          dueDate: null,
          memberId: ALI,
          done: false,
          doneAt: null,
        },
      ],
      callerRole: 'adult',
    });
    renderAt('/t/khans/dashboard');
    await waitFor(() => expect(screen.getByTestId('assignments-ready')).toBeInTheDocument());
    expect(screen.getByTestId('assignments-add')).toBeInTheDocument();
    expect(screen.getByTestId('assignment-edit-a1')).toBeInTheDocument();
  });

  it('a 404 on save (PUT) reloads the list and shows a plain-words message', async () => {
    let assignmentsState: A[] = [
      {
        id: 'a-edit',
        title: 'Old Spelling',
        notes: null,
        dueDate: null,
        memberId: ALI,
        done: false,
        doneAt: null,
      },
    ];
    fetchMock.mockImplementation((url: string, init?: RequestInit) => {
      const u = String(url);
      if (u.includes('/api/members')) {
        return Promise.resolve({
          ok: true,
          status: 200,
          json: async () => ({ members: MEMBERS, callerRole: 'admin' }),
        });
      }
      if (init?.method === 'PUT') {
        // The row was deleted by someone else while the form was open.
        assignmentsState = [];
        return Promise.resolve({
          ok: false,
          status: 404,
          json: async () => ({ error: 'not found' }),
        });
      }
      return Promise.resolve({
        ok: true,
        status: 200,
        json: async () => ({ assignments: assignmentsState }),
      });
    });
    renderAt('/t/khans/dashboard');
    await waitFor(() => expect(screen.getByTestId('assignment-edit-a-edit')).toBeInTheDocument());
    act(() => {
      fireEvent.click(screen.getByTestId('assignment-edit-a-edit'));
    });
    await act(async () => {
      fireEvent.click(screen.getByTestId('assignments-add-submit'));
    });
    expect(screen.getByTestId('assignments-add-error').textContent).toMatch(/removed/i);
    await waitFor(() =>
      expect(screen.queryByTestId('assignment-row-a-edit')).not.toBeInTheDocument(),
    );
  });
});

const OVERDUE: A = {
  id: 'a-old',
  title: 'Old Spelling',
  notes: null,
  dueDate: '2020-01-01',
  memberId: ALI,
  done: false,
  doneAt: null,
};

async function openEdit(id: string) {
  await waitFor(() => expect(screen.getByTestId('assignments-ready')).toBeInTheDocument());
  act(() => {
    fireEvent.click(screen.getByTestId(`assignment-edit-${id}`));
  });
}

describe('FHR-39: long assignment text', () => {
  it('caps the title at 50 characters and notes at 300', async () => {
    installApi({ assignments: [] });
    renderAt('/t/khans/dashboard');
    await waitFor(() => expect(screen.getByTestId('assignments-add')).toBeInTheDocument());
    act(() => {
      fireEvent.click(screen.getByTestId('assignments-add'));
    });
    expect(screen.getByTestId('assignments-add-title')).toHaveAttribute('maxLength', '50');
    expect(screen.getByTestId('assignments-add-notes')).toHaveAttribute('maxLength', '300');
  });

  it('a long unbroken title wraps inside the card instead of stretching it', async () => {
    installApi({ assignments: [{ ...OVERDUE, title: 'x'.repeat(50) }] });
    renderAt('/t/khans/dashboard');
    await waitFor(() => expect(screen.getByTestId('assignment-title-a-old')).toBeInTheDocument());
    expect(screen.getByTestId('assignment-title-a-old').className).toContain(
      '[overflow-wrap:anywhere]',
    );
  });
});

describe('FHR-40: no past due dates', () => {
  it("today is the device's own date", () => {
    expect(localToday(new Date(2026, 0, 5, 23, 59))).toBe('2026-01-05');
  });

  it('the date picker on a new assignment starts at today', async () => {
    installApi({ assignments: [] });
    renderAt('/t/khans/dashboard');
    await waitFor(() => expect(screen.getByTestId('assignments-add')).toBeInTheDocument());
    act(() => {
      fireEvent.click(screen.getByTestId('assignments-add'));
    });
    expect(screen.getByTestId('assignments-add-due')).toHaveAttribute('min', localToday());
  });

  it('a new assignment with a past date is not saved', async () => {
    installApi({ assignments: [] });
    renderAt('/t/khans/dashboard');
    await waitFor(() => expect(screen.getByTestId('assignments-add')).toBeInTheDocument());
    act(() => {
      fireEvent.click(screen.getByTestId('assignments-add'));
    });
    act(() => {
      fireEvent.change(screen.getByTestId('assignments-add-title'), {
        target: { value: 'Maths' },
      });
      fireEvent.change(screen.getByTestId('assignments-add-due'), {
        target: { value: '2020-01-01' },
      });
    });
    await act(async () => {
      fireEvent.submit(screen.getByTestId('assignments-add-form'));
    });
    expect(screen.getByTestId('assignments-add-error')).toHaveTextContent(
      'Pick today or a later date.',
    );
    expect(fetchMock.mock.calls.some(([, init]) => init?.method === 'POST')).toBe(false);
  });

  it('editing an overdue assignment keeps its date and still saves', async () => {
    installApi({ assignments: [OVERDUE] });
    renderAt('/t/khans/dashboard');
    await openEdit('a-old');
    expect(screen.getByTestId('assignments-add-due')).toHaveAttribute('min', '2020-01-01');
    await act(async () => {
      fireEvent.submit(screen.getByTestId('assignments-add-form'));
    });
    const putCall = fetchMock.mock.calls.find(([, init]) => init?.method === 'PUT');
    expect(JSON.parse((putCall![1] as RequestInit).body as string).dueDate).toBe('2020-01-01');
  });
});

describe('FHR-41: delete an assignment', () => {
  it('Delete shows only while editing, never on a new assignment', async () => {
    installApi({ assignments: [OVERDUE] });
    renderAt('/t/khans/dashboard');
    await waitFor(() => expect(screen.getByTestId('assignments-add')).toBeInTheDocument());
    act(() => {
      fireEvent.click(screen.getByTestId('assignments-add'));
    });
    expect(screen.queryByTestId('assignments-delete')).not.toBeInTheDocument();
    act(() => {
      fireEvent.click(screen.getByTestId('assignments-add-cancel'));
    });
    await openEdit('a-old');
    expect(screen.getByTestId('assignments-delete')).toHaveTextContent('Delete');
  });

  it('cancelling the confirm keeps the assignment', async () => {
    installApi({ assignments: [OVERDUE] });
    renderAt('/t/khans/dashboard');
    await openEdit('a-old');
    act(() => {
      fireEvent.click(screen.getByTestId('assignments-delete'));
    });
    expect(screen.getByText('Delete "Old Spelling"?')).toBeInTheDocument();
    act(() => {
      fireEvent.click(screen.getByTestId('assignments-delete-confirm-cancel'));
    });
    expect(fetchMock.mock.calls.some(([, init]) => init?.method === 'DELETE')).toBe(false);
    expect(screen.getByTestId('assignment-row-a-old')).toBeInTheDocument();
  });

  it('confirming deletes it, closes the form and says so', async () => {
    installApi({ assignments: [OVERDUE] });
    renderAt('/t/khans/dashboard');
    await openEdit('a-old');
    act(() => {
      fireEvent.click(screen.getByTestId('assignments-delete'));
    });
    await act(async () => {
      fireEvent.click(screen.getByTestId('assignments-delete-confirm-confirm'));
    });
    await waitFor(() =>
      expect(screen.queryByTestId('assignment-row-a-old')).not.toBeInTheDocument(),
    );
    const delCall = fetchMock.mock.calls.find(([, init]) => init?.method === 'DELETE');
    expect(String(delCall![0])).toBe('http://localhost:3001/api/assignments/a-old');
    expect(screen.queryByTestId('assignments-add-form')).not.toBeInTheDocument();
    expect(screen.getByTestId('assignments-status-announcement')).toHaveTextContent(
      'Deleted "Old Spelling"',
    );
  });

  it('a failed delete keeps the assignment and shows the error', async () => {
    installApi({ assignments: [OVERDUE], deleteStatus: 500 });
    renderAt('/t/khans/dashboard');
    await openEdit('a-old');
    act(() => {
      fireEvent.click(screen.getByTestId('assignments-delete'));
    });
    await act(async () => {
      fireEvent.click(screen.getByTestId('assignments-delete-confirm-confirm'));
    });
    expect(screen.getByTestId('assignments-add-error')).toHaveTextContent(
      "Couldn't delete (server returned 500)",
    );
    expect(screen.getByTestId('assignment-row-a-old')).toBeInTheDocument();
  });

  it('the confirm shows the saved title, not unsaved typing', async () => {
    installApi({ assignments: [OVERDUE] });
    renderAt('/t/khans/dashboard');
    await openEdit('a-old');
    act(() => {
      fireEvent.change(screen.getByTestId('assignments-add-title'), {
        target: { value: 'Half typed' },
      });
    });
    act(() => {
      fireEvent.click(screen.getByTestId('assignments-delete'));
    });
    expect(screen.getByText('Delete "Old Spelling"?')).toBeInTheDocument();
  });

  it('a double tap on Confirm sends only one delete', async () => {
    installApi({ assignments: [OVERDUE] });
    renderAt('/t/khans/dashboard');
    await openEdit('a-old');
    act(() => {
      fireEvent.click(screen.getByTestId('assignments-delete'));
    });
    await act(async () => {
      const confirm = screen.getByTestId('assignments-delete-confirm-confirm');
      fireEvent.click(confirm);
      fireEvent.click(confirm);
    });
    expect(fetchMock.mock.calls.filter(([, init]) => init?.method === 'DELETE')).toHaveLength(1);
  });

  it('a delete that loses the network keeps the assignment and says so', async () => {
    installApi({ assignments: [OVERDUE] });
    const routed = fetchMock.getMockImplementation()!;
    fetchMock.mockImplementation((url: string, init?: RequestInit) =>
      init?.method === 'DELETE' ? Promise.reject(new Error('Network down')) : routed(url, init),
    );
    renderAt('/t/khans/dashboard');
    await openEdit('a-old');
    act(() => {
      fireEvent.click(screen.getByTestId('assignments-delete'));
    });
    await act(async () => {
      fireEvent.click(screen.getByTestId('assignments-delete-confirm-confirm'));
    });
    expect(screen.getByTestId('assignments-add-error')).toHaveTextContent('Network down');
    expect(screen.getByTestId('assignment-row-a-old')).toBeInTheDocument();
  });
});

describe('FHR-39: an old title over the new limit', () => {
  it('editing one says plainly that it must be shortened', async () => {
    installApi({ assignments: [{ ...OVERDUE, title: 'y'.repeat(120) }] });
    renderAt('/t/khans/dashboard');
    await openEdit('a-old');
    expect(screen.getByTestId('assignments-title-too-long')).toHaveTextContent(
      'This title is over 50 characters. Shorten it to save.',
    );
  });
});
