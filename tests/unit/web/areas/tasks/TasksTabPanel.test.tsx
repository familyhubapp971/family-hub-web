import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor, fireEvent, act } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';

// FHS-233 / FHS-267: TasksTabPanel (shared family board).
// One column per member with a done/total badge; only the caller's
// column is interactive (toggle + delete + add). See ADR 0013.

const fetchMock = vi.fn();
const authState: { session: { access_token?: string } | null } = {
  session: { access_token: 'tok-abc' },
};
vi.mock('../../../../../src/app/lib/auth-context', () => ({
  useAuth: () => authState,
}));

import { TasksTabPanel } from '../../../../../src/areas/tasks/TasksTabPanel';
import { TenantProvider } from '../../../../../src/app/lib/tenant-context';

interface T {
  id: string;
  title: string;
  dueDate: string | null;
  memberId: string;
  done: boolean;
  doneAt: string | null;
}
const CALLER = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const OTHER = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const MEMBERS = [
  { id: CALLER, displayName: 'Sarah', avatarEmoji: '👩' },
  { id: OTHER, displayName: 'Bilal', avatarEmoji: '👨' },
];

function task(over: Partial<T>): T {
  return {
    id: 't1',
    title: 'Task',
    dueDate: null,
    memberId: CALLER,
    done: false,
    doneAt: null,
    ...over,
  };
}

function installApi(opts: { tasks?: T[]; tOk?: boolean; tStatus?: number }) {
  const state = { tasks: [...(opts.tasks ?? [])] };
  fetchMock.mockImplementation((url: string, init?: RequestInit) => {
    const u = String(url);
    if (u.includes('/api/members')) {
      return Promise.resolve({
        ok: true,
        status: 200,
        json: async () => ({ members: MEMBERS, callerRole: 'admin' }),
      });
    }
    if (init?.method === 'POST') {
      const b = JSON.parse(init.body as string) as Partial<T>;
      const row = task({
        id: `gen-${state.tasks.length + 1}`,
        title: b.title ?? '',
        dueDate: b.dueDate ?? null,
      });
      state.tasks.push(row);
      return Promise.resolve({ ok: true, status: 201, json: async () => row });
    }
    if (init?.method === 'PATCH') {
      const id = u.split('/api/tasks/')[1]!;
      const next = JSON.parse(init.body as string) as { done: boolean };
      state.tasks = state.tasks.map((t) => (t.id === id ? { ...t, done: next.done } : t));
      return Promise.resolve({ ok: true, status: 200, json: async () => ({}) });
    }
    if (init?.method === 'DELETE') {
      const id = u.split('/api/tasks/')[1]!;
      state.tasks = state.tasks.filter((t) => t.id !== id);
      return Promise.resolve({ ok: true, status: 204, json: async () => ({}) });
    }
    if (init?.method === 'PUT') {
      const idMatch = u.match(/\/api\/tasks\/([^?]+)/);
      const id = idMatch?.[1];
      const patch = JSON.parse(init.body as string) as Partial<T>;
      const idx = state.tasks.findIndex((t) => t.id === id);
      if (idx >= 0) state.tasks[idx] = { ...state.tasks[idx]!, ...patch };
      return Promise.resolve({
        ok: true,
        status: 200,
        json: async () => state.tasks[idx],
      });
    }
    return Promise.resolve({
      ok: opts.tOk ?? true,
      status: opts.tStatus ?? 200,
      json: async () => ({ tasks: state.tasks, callerMemberId: CALLER }),
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
              <TasksTabPanel />
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

describe('<TasksTabPanel />', () => {
  it('renders a loading hint while the request is in flight', () => {
    fetchMock.mockReturnValue(new Promise(() => {}));
    renderAt('/t/khans/dashboard');
    expect(screen.getByTestId('tasks-loading')).toBeInTheDocument();
  });

  it('renders inline error when the tasks request fails', async () => {
    installApi({ tOk: false, tStatus: 500 });
    renderAt('/t/khans/dashboard');
    await waitFor(() => expect(screen.getByTestId('tasks-error')).toBeInTheDocument());
  });

  it('always renders the caller column even with no tasks', async () => {
    installApi({ tasks: [] });
    renderAt('/t/khans/dashboard');
    await waitFor(() => expect(screen.getByTestId('tasks-ready')).toBeInTheDocument());
    expect(screen.getByTestId(`tasks-column-${CALLER}`)).toBeInTheDocument();
    expect(screen.getByTestId(`tasks-column-empty-${CALLER}`)).toBeInTheDocument();
    expect(screen.getByTestId(`tasks-column-badge-${CALLER}`).textContent).toBe('0/0 Done');
  });

  it('renders one column per member with a done/total badge', async () => {
    installApi({
      tasks: [
        task({ id: 't1', title: 'Buy milk', memberId: CALLER, done: false }),
        task({ id: 't2', title: 'Email school', memberId: CALLER, done: true }),
        task({ id: 't3', title: 'Renew passport', memberId: OTHER, done: false }),
      ],
    });
    renderAt('/t/khans/dashboard');
    await waitFor(() => expect(screen.getByTestId('tasks-ready')).toBeInTheDocument());
    expect(screen.getByTestId(`tasks-column-name-${CALLER}`).textContent).toContain('Sarah');
    expect(screen.getByTestId(`tasks-column-name-${OTHER}`).textContent).toContain('Bilal');
    expect(screen.getByTestId(`tasks-column-badge-${CALLER}`).textContent).toBe('1/2 Done');
    expect(screen.getByTestId(`tasks-column-badge-${OTHER}`).textContent).toBe('0/1 Done');
  });

  it('shows toggle + delete + add only in the caller column', async () => {
    installApi({
      tasks: [
        task({ id: 't1', title: 'Buy milk', memberId: CALLER }),
        task({ id: 't3', title: 'Renew passport', memberId: OTHER }),
      ],
    });
    renderAt('/t/khans/dashboard');
    await waitFor(() => expect(screen.getByTestId('tasks-ready')).toBeInTheDocument());
    // Caller's own task is interactive.
    expect(screen.getByTestId('task-toggle-t1')).toBeInTheDocument();
    expect(screen.getByTestId('task-delete-t1')).toBeInTheDocument();
    expect(screen.getByTestId('tasks-add')).toBeInTheDocument();
    // Other member's task is read-only.
    expect(screen.queryByTestId('task-toggle-t3')).not.toBeInTheDocument();
    expect(screen.queryByTestId('task-delete-t3')).not.toBeInTheDocument();
    // Their task title still shows.
    expect(screen.getByTestId('task-title-t3').textContent).toBe('Renew passport');
  });

  it('merges tasks from removed members into a single "Family" column', async () => {
    installApi({
      tasks: [
        task({ id: 't9', title: 'Orphan A', memberId: 'deleted-1' }),
        task({ id: 't8', title: 'Orphan B', memberId: 'deleted-2' }),
      ],
    });
    renderAt('/t/khans/dashboard');
    await waitFor(() => expect(screen.getByTestId('tasks-ready')).toBeInTheDocument());
    // Two different deleted members → ONE Family column, not two.
    expect(screen.getByTestId('tasks-column-name-__family__').textContent).toContain('Family');
    expect(screen.getByTestId('tasks-column-badge-__family__').textContent).toBe('0/2 Done');
    expect(screen.getByTestId('task-title-t9').textContent).toBe('Orphan A');
    expect(screen.getByTestId('task-title-t8').textContent).toBe('Orphan B');
  });

  it('keeps the caller column interactive even when /api/members fails', async () => {
    const state = { tasks: [task({ id: 't1', title: 'Buy milk', memberId: CALLER })] };
    fetchMock.mockImplementation((url: string, init?: RequestInit) => {
      const u = String(url);
      if (u.includes('/api/members')) {
        return Promise.resolve({ ok: false, status: 500, json: async () => ({}) });
      }
      if (init?.method === 'PATCH') {
        return Promise.resolve({ ok: true, status: 200, json: async () => ({}) });
      }
      return Promise.resolve({
        ok: true,
        status: 200,
        json: async () => ({ tasks: state.tasks, callerMemberId: CALLER }),
      });
    });
    renderAt('/t/khans/dashboard');
    await waitFor(() => expect(screen.getByTestId('tasks-ready')).toBeInTheDocument());
    // Caller's own task stays in the caller column and is still interactive.
    expect(screen.getByTestId(`tasks-column-${CALLER}`)).toBeInTheDocument();
    expect(screen.getByTestId('task-toggle-t1')).toBeInTheDocument();
    expect(screen.getByTestId('tasks-add')).toBeInTheDocument();
  });

  it('+ Add posts and refetches', async () => {
    installApi({ tasks: [] });
    renderAt('/t/khans/dashboard');
    await waitFor(() => expect(screen.getByTestId('tasks-ready')).toBeInTheDocument());
    act(() => {
      fireEvent.click(screen.getByTestId('tasks-add'));
    });
    act(() => {
      fireEvent.change(screen.getByTestId('tasks-add-title'), { target: { value: 'Call doctor' } });
    });
    await act(async () => {
      fireEvent.click(screen.getByTestId('tasks-add-submit'));
    });
    await waitFor(() => expect(screen.getByText('Call doctor')).toBeInTheDocument());
    const postCall = fetchMock.mock.calls.find(([, init]) => init?.method === 'POST');
    expect(postCall).toBeDefined();
    expect(JSON.parse((postCall![1] as RequestInit).body as string)).toMatchObject({
      title: 'Call doctor',
    });
  });

  it('toggle PATCHes /api/tasks/:id and strikes the title', async () => {
    installApi({ tasks: [task({ id: 't1', title: 'Buy milk', memberId: CALLER })] });
    renderAt('/t/khans/dashboard');
    await waitFor(() => expect(screen.getByTestId('task-toggle-t1')).toBeInTheDocument());
    await act(async () => {
      fireEvent.click(screen.getByTestId('task-toggle-t1'));
    });
    const patchCall = fetchMock.mock.calls.find(([, init]) => init?.method === 'PATCH');
    expect(patchCall).toBeDefined();
    expect(patchCall![0]).toBe('http://localhost:3001/api/tasks/t1');
    await waitFor(() =>
      expect(screen.getByTestId('task-title-t1').className).toContain('line-through'),
    );
  });

  it('fires the dashboard-stale signal after a successful toggle (FHS-309)', async () => {
    installApi({ tasks: [task({ id: 't1', title: 'Buy milk', memberId: CALLER })] });
    const onStale = vi.fn();
    window.addEventListener('fh:dashboard-stale', onStale);
    renderAt('/t/khans/dashboard');
    await waitFor(() => expect(screen.getByTestId('task-toggle-t1')).toBeInTheDocument());
    await act(async () => {
      fireEvent.click(screen.getByTestId('task-toggle-t1'));
    });
    await waitFor(() => expect(onStale).toHaveBeenCalled());
    window.removeEventListener('fh:dashboard-stale', onStale);
  });

  it('blocks a whitespace-only title without firing a POST', async () => {
    installApi({ tasks: [] });
    renderAt('/t/khans/dashboard');
    await waitFor(() => expect(screen.getByTestId('tasks-ready')).toBeInTheDocument());
    act(() => {
      fireEvent.click(screen.getByTestId('tasks-add'));
    });
    act(() => {
      fireEvent.change(screen.getByTestId('tasks-add-title'), { target: { value: '   ' } });
    });
    await act(async () => {
      fireEvent.submit(screen.getByTestId('tasks-add-form'));
    });
    expect(screen.getByTestId('tasks-add-error')).toBeInTheDocument();
    expect(fetchMock.mock.calls.some(([, init]) => init?.method === 'POST')).toBe(false);
  });

  it('returns focus to the Add button after cancelling the form', async () => {
    installApi({ tasks: [] });
    renderAt('/t/khans/dashboard');
    await waitFor(() => expect(screen.getByTestId('tasks-ready')).toBeInTheDocument());
    act(() => {
      fireEvent.click(screen.getByTestId('tasks-add'));
    });
    await act(async () => {
      fireEvent.click(screen.getByTestId('tasks-add-cancel'));
    });
    await waitFor(() => expect(screen.getByTestId('tasks-add')).toHaveFocus());
  });

  it('reverts the row when the toggle PATCH fails', async () => {
    const state = { tasks: [task({ id: 't1', title: 'Buy milk', memberId: CALLER })] };
    fetchMock.mockImplementation((url: string, init?: RequestInit) => {
      const u = String(url);
      if (u.includes('/api/members')) {
        return Promise.resolve({ ok: true, status: 200, json: async () => ({ members: MEMBERS }) });
      }
      if (init?.method === 'PATCH') {
        return Promise.resolve({ ok: false, status: 500, json: async () => ({}) });
      }
      return Promise.resolve({
        ok: true,
        status: 200,
        json: async () => ({ tasks: state.tasks, callerMemberId: CALLER }),
      });
    });
    renderAt('/t/khans/dashboard');
    await waitFor(() => expect(screen.getByTestId('task-toggle-t1')).toBeInTheDocument());
    await act(async () => {
      fireEvent.click(screen.getByTestId('task-toggle-t1'));
    });
    await waitFor(() =>
      expect(screen.getByTestId('tasks-error-announcement').textContent).not.toBe(''),
    );
    expect(screen.getByTestId('task-title-t1').className).not.toContain('line-through');
  });

  it('reverts two failing toggles to their own prior states (no cross-contamination)', async () => {
    const state = {
      tasks: [
        task({ id: 't1', title: 'A', memberId: CALLER, done: false }),
        task({ id: 't2', title: 'B', memberId: CALLER, done: true }),
      ],
    };
    fetchMock.mockImplementation((url: string, init?: RequestInit) => {
      const u = String(url);
      if (u.includes('/api/members')) {
        return Promise.resolve({ ok: true, status: 200, json: async () => ({ members: MEMBERS }) });
      }
      if (init?.method === 'PATCH') {
        return Promise.resolve({ ok: false, status: 500, json: async () => ({}) });
      }
      return Promise.resolve({
        ok: true,
        status: 200,
        json: async () => ({ tasks: state.tasks, callerMemberId: CALLER }),
      });
    });
    renderAt('/t/khans/dashboard');
    await waitFor(() => expect(screen.getByTestId('task-toggle-t1')).toBeInTheDocument());
    // Toggle both in the same tick: t1 false→true, t2 true→false.
    await act(async () => {
      fireEvent.click(screen.getByTestId('task-toggle-t1'));
      fireEvent.click(screen.getByTestId('task-toggle-t2'));
    });
    // Both PATCHes fail → each reverts to its OWN prior state.
    await waitFor(() => {
      expect(screen.getByTestId('task-title-t1').className).not.toContain('line-through'); // back to not-done
      expect(screen.getByTestId('task-title-t2').className).toContain('line-through'); // back to done
    });
  });

  it('Delete fires DELETE /api/tasks/:id and refetches', async () => {
    installApi({ tasks: [task({ id: 't1', title: 'Buy milk', memberId: CALLER })] });
    renderAt('/t/khans/dashboard');
    await waitFor(() => expect(screen.getByTestId('task-delete-t1')).toBeInTheDocument());
    await act(async () => {
      fireEvent.click(screen.getByTestId('task-delete-t1'));
    });
    const deleteCall = fetchMock.mock.calls.find(([, init]) => init?.method === 'DELETE');
    expect(deleteCall).toBeDefined();
    expect(deleteCall![0]).toBe('http://localhost:3001/api/tasks/t1');
    await waitFor(() => expect(screen.queryByTestId('task-row-t1')).toBeNull());
  });

  it('passes bearer token + tenant slug', async () => {
    installApi({ tasks: [] });
    renderAt('/t/khans/dashboard');
    await waitFor(() => expect(fetchMock).toHaveBeenCalled());
    const [url, init] = fetchMock.mock.calls[0]!;
    expect(url).toBe('http://localhost:3001/api/tasks');
    expect(init.headers).toMatchObject({
      Authorization: 'Bearer tok-abc',
      'x-tenant-slug': 'khans',
    });
  });

  it('edit button pre-fills the form and save issues a PUT', async () => {
    // The edit button only appears on the caller's own column rows.
    const callerTask = task({ id: 't-edit', title: 'Old task', memberId: CALLER, dueDate: null });
    installApi({ tasks: [callerTask] });
    renderAt('/t/khans/dashboard');
    await waitFor(() => expect(screen.getByTestId('tasks-ready')).toBeInTheDocument());

    act(() => {
      fireEvent.click(screen.getByTestId('task-edit-t-edit'));
    });
    // Form opens pre-filled with the existing title
    expect(screen.getByTestId('tasks-add-form')).toBeInTheDocument();
    expect((screen.getByTestId('tasks-add-title') as HTMLInputElement).value).toBe('Old task');

    act(() => {
      fireEvent.change(screen.getByTestId('tasks-add-title'), {
        target: { value: 'New task' },
      });
    });
    await act(async () => {
      fireEvent.click(screen.getByTestId('tasks-add-submit'));
    });

    const putCall = fetchMock.mock.calls.find(
      ([url, init]) => String(url).includes('/api/tasks/t-edit') && init?.method === 'PUT',
    );
    expect(putCall).toBeTruthy();
    expect(JSON.parse((putCall![1] as RequestInit).body as string).title).toBe('New task');
  });
});
