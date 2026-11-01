import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor, fireEvent, act } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';

// FHS-232 / FHS-266: NoticeboardTabPanel (Magic Patterns post-it grid).
// Each note is a coloured card with an emoji icon, optional pin, body, and
// a "From <author>" footer. Posting opens an inline form with an emoji
// picker; the POST body carries body + pinned + icon.

const fetchMock = vi.fn();
const authState: { session: { access_token?: string } | null } = {
  session: { access_token: 'tok-abc' },
};
vi.mock('../../../../../src/app/lib/auth-context', () => ({
  useAuth: () => authState,
}));

import { NoticeboardTabPanel } from '../../../../../src/areas/noticeboard/NoticeboardTabPanel';
import { TenantProvider } from '../../../../../src/app/lib/tenant-context';

interface N {
  id: string;
  body: string;
  pinned: boolean;
  authorMemberId: string | null;
  authorName: string | null;
  icon: string | null;
  createdAt: string;
}

function notice(over: Partial<N>): N {
  return {
    id: 'n1',
    body: 'Hello',
    pinned: false,
    authorMemberId: null,
    authorName: null,
    icon: '📌',
    createdAt: '2026-05-03T10:00:00.000Z',
    ...over,
  };
}

// URL-routing fetch mock: notices and the caller's role (/api/members)
// are fetched independently, so a fixed sequence of mockResolvedValueOnce
// calls can't model the real call order.
function installApi(opts: { notices?: N[]; callerRole?: string }) {
  const state = { notices: [...(opts.notices ?? [])] };
  fetchMock.mockImplementation((url: string, init?: RequestInit) => {
    const u = String(url);
    if (u.includes('/api/members')) {
      return Promise.resolve({
        ok: true,
        status: 200,
        json: async () => ({ members: [], callerRole: opts.callerRole ?? 'admin' }),
      });
    }
    if (init?.method === 'POST') {
      const b = JSON.parse(init.body as string) as Partial<N>;
      const row = notice({
        id: `gen-${state.notices.length + 1}`,
        body: b.body ?? '',
        pinned: b.pinned ?? false,
        icon: b.icon ?? null,
      });
      state.notices.push(row);
      return Promise.resolve({ ok: true, status: 201, json: async () => row });
    }
    if (init?.method === 'DELETE') {
      const id = u.split('/api/notices/')[1]!;
      state.notices = state.notices.filter((n) => n.id !== id);
      return Promise.resolve({ ok: true, status: 204, json: async () => ({}) });
    }
    if (init?.method === 'PUT') {
      const idMatch = u.match(/\/api\/notices\/([^?]+)/);
      const id = idMatch?.[1];
      const patch = JSON.parse(init.body as string) as Partial<N>;
      const idx = state.notices.findIndex((n) => n.id === id);
      if (idx >= 0) state.notices[idx] = { ...state.notices[idx]!, ...patch };
      return Promise.resolve({ ok: true, status: 200, json: async () => state.notices[idx] });
    }
    return Promise.resolve({
      ok: true,
      status: 200,
      json: async () => ({ notices: state.notices }),
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
              <NoticeboardTabPanel />
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

describe('<NoticeboardTabPanel />', () => {
  it('renders a loading hint while the request is in flight', () => {
    fetchMock.mockReturnValue(new Promise(() => {}));
    renderAt('/t/khans/dashboard');
    expect(screen.getByTestId('notices-loading')).toBeInTheDocument();
  });

  it('renders inline error on non-2xx', async () => {
    fetchMock.mockImplementation((url: string) => {
      const u = String(url);
      if (u.includes('/api/members')) {
        return Promise.resolve({
          ok: true,
          status: 200,
          json: async () => ({ members: [], callerRole: 'admin' }),
        });
      }
      return Promise.resolve({ ok: false, status: 500, json: async () => ({}) });
    });
    renderAt('/t/khans/dashboard');
    await waitFor(() => expect(screen.getByTestId('notices-error')).toBeInTheDocument());
  });

  it('renders the empty hint when no notices exist', async () => {
    installApi({ notices: [] });
    renderAt('/t/khans/dashboard');
    await waitFor(() => expect(screen.getByTestId('notices-ready')).toBeInTheDocument());
    expect(screen.getByTestId('notices-empty')).toBeInTheDocument();
  });

  it('renders each notice as a card with its icon + author', async () => {
    installApi({
      notices: [
        notice({ id: 'n1', body: 'Pizza Friday', pinned: true, icon: '🍕', authorName: 'Sarah' }),
        notice({ id: 'n2', body: 'PE kit', pinned: false, icon: '📅', authorName: null }),
      ],
    });
    renderAt('/t/khans/dashboard');
    await waitFor(() => expect(screen.getByTestId('notices-ready')).toBeInTheDocument());
    const grid = screen.getByTestId('notices-grid');
    expect(grid).toContainElement(screen.getByTestId('notice-row-n1'));
    expect(grid).toContainElement(screen.getByTestId('notice-row-n2'));
    expect(screen.getByTestId('notice-icon-n1').textContent).toBe('🍕');
    expect(screen.getByTestId('notice-author-n1').textContent).toBe('From Sarah');
    expect(screen.getByTestId('notice-author-n2').textContent).toBe('From Family');
  });

  it('+ Add opens form; submitting POSTs body + pinned + icon and refetches', async () => {
    installApi({ notices: [] });
    renderAt('/t/khans/dashboard');
    await waitFor(() => expect(screen.getByTestId('notices-ready')).toBeInTheDocument());

    act(() => {
      fireEvent.click(screen.getByTestId('notices-add'));
    });
    act(() => {
      fireEvent.change(screen.getByTestId('notices-add-body'), {
        target: { value: 'Trip on Sat' },
      });
      fireEvent.click(screen.getByTestId('notices-add-pinned'));
      fireEvent.click(screen.getByLabelText('Use icon 🎉'));
    });
    await act(async () => {
      fireEvent.click(screen.getByTestId('notices-add-submit'));
    });
    await waitFor(() =>
      expect(screen.getByTestId('notice-body-gen-1').textContent).toBe('Trip on Sat'),
    );

    const postCall = fetchMock.mock.calls.find(([, init]) => init?.method === 'POST');
    expect(postCall).toBeDefined();
    const body = JSON.parse((postCall![1] as RequestInit).body as string);
    expect(body).toEqual({ body: 'Trip on Sat', pinned: true, icon: '🎉' });
  });

  it('blocks a whitespace-only note without firing a POST', async () => {
    installApi({ notices: [] });
    renderAt('/t/khans/dashboard');
    await waitFor(() => expect(screen.getByTestId('notices-ready')).toBeInTheDocument());
    act(() => {
      fireEvent.click(screen.getByTestId('notices-add'));
    });
    act(() => {
      fireEvent.change(screen.getByTestId('notices-add-body'), { target: { value: '   ' } });
    });
    await act(async () => {
      fireEvent.submit(screen.getByTestId('notices-add-form'));
    });
    expect(screen.getByTestId('notices-add-error')).toBeInTheDocument();
    expect(fetchMock.mock.calls.some(([, init]) => init?.method === 'POST')).toBe(false);
  });

  it('Delete fires DELETE /api/notices/:id and refetches', async () => {
    installApi({ notices: [notice({ id: 'n1', body: 'Pizza Friday', pinned: true })] });

    renderAt('/t/khans/dashboard');
    await waitFor(() => expect(screen.getByTestId('notice-delete-n1')).toBeInTheDocument());

    await act(async () => {
      fireEvent.click(screen.getByTestId('notice-delete-n1'));
    });

    const deleteCall = fetchMock.mock.calls.find(([, init]) => init?.method === 'DELETE');
    expect(deleteCall).toBeDefined();
    expect(deleteCall![0]).toBe('http://localhost:3001/api/notices/n1');
    await waitFor(() => expect(screen.queryByTestId('notice-row-n1')).toBeNull());
  });

  it('passes bearer token + tenant slug', async () => {
    installApi({ notices: [] });
    renderAt('/t/khans/dashboard');
    await waitFor(() =>
      expect(
        fetchMock.mock.calls.some(([url]) => String(url) === 'http://localhost:3001/api/notices'),
      ).toBe(true),
    );
    const call = fetchMock.mock.calls.find(
      ([url]) => String(url) === 'http://localhost:3001/api/notices',
    )!;
    expect(call[1].headers).toMatchObject({
      Authorization: 'Bearer tok-abc',
      'x-tenant-slug': 'khans',
    });
  });

  it('edit button pre-fills the form and save issues a PUT', async () => {
    const existing = notice({ id: 'n-edit', body: 'Old body', pinned: false, icon: '📌' });
    installApi({ notices: [existing] });

    renderAt('/t/khans/dashboard');
    await waitFor(() => expect(screen.getByTestId('notices-ready')).toBeInTheDocument());

    act(() => {
      fireEvent.click(screen.getByTestId('notice-edit-n-edit'));
    });
    // Form opens pre-filled with existing body
    expect(screen.getByTestId('notices-add-form')).toBeInTheDocument();
    expect((screen.getByTestId('notices-add-body') as HTMLTextAreaElement).value).toBe('Old body');

    act(() => {
      fireEvent.change(screen.getByTestId('notices-add-body'), {
        target: { value: 'New body' },
      });
    });
    await act(async () => {
      fireEvent.click(screen.getByTestId('notices-add-submit'));
    });

    const putCall = fetchMock.mock.calls.find(
      ([url, init]) => String(url).includes('/api/notices/n-edit') && init?.method === 'PUT',
    );
    expect(putCall).toBeTruthy();
    expect(JSON.parse((putCall![1] as RequestInit).body as string).body).toBe('New body');
  });

  // FHS-313: gate the post/edit/delete affordances by the caller's role,
  // the same rule the API already enforces (WRITE_ROLES = admin/adult).
  it('hides the post + edit + delete controls for a child caller', async () => {
    installApi({
      notices: [notice({ id: 'n1', body: 'Pizza Friday' })],
      callerRole: 'child',
    });
    renderAt('/t/khans/dashboard');
    await waitFor(() => expect(screen.getByTestId('notices-ready')).toBeInTheDocument());
    expect(screen.queryByTestId('notices-add')).not.toBeInTheDocument();
    expect(screen.queryByTestId('notice-edit-n1')).not.toBeInTheDocument();
    expect(screen.queryByTestId('notice-delete-n1')).not.toBeInTheDocument();
  });

  it('hides the post control for a teen caller', async () => {
    installApi({ notices: [], callerRole: 'teen' });
    renderAt('/t/khans/dashboard');
    await waitFor(() => expect(screen.getByTestId('notices-ready')).toBeInTheDocument());
    expect(screen.queryByTestId('notices-add')).not.toBeInTheDocument();
  });

  it('keeps the post + edit + delete controls visible for an admin caller', async () => {
    installApi({
      notices: [notice({ id: 'n1', body: 'Pizza Friday' })],
      callerRole: 'admin',
    });
    renderAt('/t/khans/dashboard');
    await waitFor(() => expect(screen.getByTestId('notices-ready')).toBeInTheDocument());
    expect(screen.getByTestId('notices-add')).toBeInTheDocument();
    expect(screen.getByTestId('notice-edit-n1')).toBeInTheDocument();
    expect(screen.getByTestId('notice-delete-n1')).toBeInTheDocument();
  });

  it('keeps the post + edit + delete controls visible for an adult caller', async () => {
    installApi({
      notices: [notice({ id: 'n1', body: 'Pizza Friday' })],
      callerRole: 'adult',
    });
    renderAt('/t/khans/dashboard');
    await waitFor(() => expect(screen.getByTestId('notices-ready')).toBeInTheDocument());
    expect(screen.getByTestId('notices-add')).toBeInTheDocument();
    expect(screen.getByTestId('notice-edit-n1')).toBeInTheDocument();
    expect(screen.getByTestId('notice-delete-n1')).toBeInTheDocument();
  });

  it('a 404 on save (PUT) reloads the list and shows a plain-words message', async () => {
    let noticesState: N[] = [notice({ id: 'n-edit', body: 'Old body' })];
    fetchMock.mockImplementation((url: string, init?: RequestInit) => {
      const u = String(url);
      if (u.includes('/api/members')) {
        return Promise.resolve({
          ok: true,
          status: 200,
          json: async () => ({ members: [], callerRole: 'admin' }),
        });
      }
      if (init?.method === 'PUT') {
        // The note was deleted by someone else while the form was open.
        noticesState = [];
        return Promise.resolve({
          ok: false,
          status: 404,
          json: async () => ({ error: 'not found' }),
        });
      }
      return Promise.resolve({
        ok: true,
        status: 200,
        json: async () => ({ notices: noticesState }),
      });
    });
    renderAt('/t/khans/dashboard');
    await waitFor(() => expect(screen.getByTestId('notice-edit-n-edit')).toBeInTheDocument());
    act(() => {
      fireEvent.click(screen.getByTestId('notice-edit-n-edit'));
    });
    await act(async () => {
      fireEvent.click(screen.getByTestId('notices-add-submit'));
    });
    expect(screen.getByTestId('notices-add-error').textContent).toMatch(/removed/i);
    await waitFor(() => expect(screen.queryByTestId('notice-row-n-edit')).not.toBeInTheDocument());
  });
});
