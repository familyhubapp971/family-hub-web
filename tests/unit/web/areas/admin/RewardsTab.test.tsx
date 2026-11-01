import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';

// FHS-483: RewardsTab (Admin Panel): parents add/edit/remove the reward
// shop's catalogue. Listing reuses GET /api/rewards?memberId=<any tenant
// member> (see the component doc comment); mutations hit the new
// POST/PATCH/DELETE /api/rewards[/:id] endpoints.

import { RewardsTab } from '../../../../../src/areas/admin/RewardsTab';

const fetchMock = vi.fn();

interface RewardRow {
  id: string;
  name: string;
  description: string | null;
  stickerCost: number;
  icon: string | null;
}

const MEMBER_ID = 'member-admin-1';

function reward(over: Partial<RewardRow>): RewardRow {
  return {
    id: 'r1',
    name: 'Movie night',
    description: 'Pick the film',
    stickerCost: 20,
    icon: '🎬',
    ...over,
  };
}

function installApi(opts: { rewards?: RewardRow[] } = {}) {
  const state = { rewards: [...(opts.rewards ?? [])] };
  fetchMock.mockImplementation((url: string, init?: RequestInit) => {
    const u = String(url);
    if (u.includes('/api/members')) {
      return Promise.resolve({
        ok: true,
        status: 200,
        json: async () => ({ members: [{ id: MEMBER_ID }], callerRole: 'admin' }),
      });
    }
    if (u.includes('/api/rewards') && (!init || init.method === undefined)) {
      return Promise.resolve({
        ok: true,
        status: 200,
        json: async () => ({ rewards: state.rewards, stickerBalance: 0 }),
      });
    }
    if (init?.method === 'POST' && u.endsWith('/api/rewards')) {
      const body = JSON.parse(init.body as string) as Partial<RewardRow>;
      const row = reward({
        id: `gen-${state.rewards.length + 1}`,
        name: body.name ?? '',
        description: body.description ?? null,
        stickerCost: body.stickerCost ?? 1,
        icon: body.icon ?? null,
      });
      state.rewards.push(row);
      return Promise.resolve({ ok: true, status: 201, json: async () => row });
    }
    if (init?.method === 'PATCH') {
      const id = u.split('/api/rewards/')[1]!;
      const patch = JSON.parse(init.body as string) as Partial<RewardRow>;
      state.rewards = state.rewards.map((r) => (r.id === id ? { ...r, ...patch } : r));
      const updated = state.rewards.find((r) => r.id === id)!;
      return Promise.resolve({ ok: true, status: 200, json: async () => updated });
    }
    if (init?.method === 'DELETE') {
      const id = u.split('/api/rewards/')[1]!;
      state.rewards = state.rewards.filter((r) => r.id !== id);
      return Promise.resolve({ ok: true, status: 204, json: async () => ({}) });
    }
    return Promise.resolve({
      ok: true,
      status: 200,
      json: async () => ({ rewards: state.rewards, stickerBalance: 0 }),
    });
  });
  return state;
}

const HEADERS = { Authorization: 'Bearer tok', 'x-tenant-slug': 'khans' };

beforeEach(() => {
  fetchMock.mockReset();
  vi.stubGlobal('fetch', fetchMock);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('FHS-483: RewardsTab', () => {
  it('shows a loading state, then the reward list', async () => {
    installApi({ rewards: [reward({})] });
    render(<RewardsTab headers={HEADERS} />);
    expect(screen.getByTestId('admin-rewards-loading')).toBeInTheDocument();
    await waitFor(() => expect(screen.getByTestId('admin-rewards-ready')).toBeInTheDocument());
    expect(screen.getByTestId('admin-rewards-row-r1-name')).toHaveTextContent('Movie night');
    expect(screen.getByTestId('admin-rewards-row-r1-cost')).toHaveTextContent('20');
  });

  it('shows an empty state when the family has no rewards yet', async () => {
    installApi({ rewards: [] });
    render(<RewardsTab headers={HEADERS} />);
    await waitFor(() => expect(screen.getByTestId('admin-rewards-empty')).toBeInTheDocument());
  });

  it('adds a reward via POST /api/rewards and refreshes the list', async () => {
    installApi({ rewards: [] });
    render(<RewardsTab headers={HEADERS} />);
    await waitFor(() => expect(screen.getByTestId('admin-rewards-ready')).toBeInTheDocument());

    fireEvent.click(screen.getByTestId('admin-rewards-add-btn'));
    fireEvent.change(screen.getByTestId('admin-rewards-add-form-name'), {
      target: { value: 'Pizza night' },
    });
    fireEvent.change(screen.getByTestId('admin-rewards-add-form-cost'), {
      target: { value: '15' },
    });
    fireEvent.click(screen.getByTestId('admin-rewards-add-form-save'));

    await waitFor(() =>
      expect(fetchMock).toHaveBeenCalledWith(
        expect.stringContaining('/api/rewards'),
        expect.objectContaining({ method: 'POST' }),
      ),
    );
    const postCall = fetchMock.mock.calls.find(
      ([, init]: [string, RequestInit?]) => init?.method === 'POST',
    )!;
    const postBody = JSON.parse((postCall[1] as RequestInit).body as string) as Partial<RewardRow>;
    expect(postBody).toEqual({
      name: 'Pizza night',
      description: null,
      stickerCost: 15,
      icon: null,
    });
    await waitFor(() =>
      expect(screen.getByTestId('admin-rewards-row-gen-1-name')).toHaveTextContent('Pizza night'),
    );
  });

  it('blocks the add when the name is blank: no network call', async () => {
    installApi({ rewards: [] });
    render(<RewardsTab headers={HEADERS} />);
    await waitFor(() => expect(screen.getByTestId('admin-rewards-ready')).toBeInTheDocument());

    fireEvent.click(screen.getByTestId('admin-rewards-add-btn'));
    fireEvent.change(screen.getByTestId('admin-rewards-add-form-cost'), {
      target: { value: '10' },
    });
    fireEvent.click(screen.getByTestId('admin-rewards-add-form-save'));

    expect(await screen.findByTestId('admin-rewards-add-form-error')).toHaveTextContent(
      'Reward name is required.',
    );
    expect(fetchMock.mock.calls.some(([, init]) => init?.method === 'POST')).toBe(false);
  });

  it('edits a reward via PATCH /api/rewards/:id', async () => {
    installApi({ rewards: [reward({})] });
    render(<RewardsTab headers={HEADERS} />);
    await waitFor(() => expect(screen.getByTestId('admin-rewards-ready')).toBeInTheDocument());

    fireEvent.click(screen.getByTestId('admin-rewards-row-r1-edit-btn'));
    const costInput = screen.getByTestId('admin-rewards-edit-form-r1-cost');
    fireEvent.change(costInput, { target: { value: '30' } });
    fireEvent.click(screen.getByTestId('admin-rewards-edit-form-r1-save'));

    await waitFor(() =>
      expect(fetchMock).toHaveBeenCalledWith(
        expect.stringContaining('/api/rewards/r1'),
        expect.objectContaining({ method: 'PATCH' }),
      ),
    );
    await waitFor(() =>
      expect(screen.getByTestId('admin-rewards-row-r1-cost')).toHaveTextContent('30'),
    );
  });

  it('removes a reward via the confirm dialog + DELETE /api/rewards/:id', async () => {
    installApi({ rewards: [reward({})] });
    render(<RewardsTab headers={HEADERS} />);
    await waitFor(() => expect(screen.getByTestId('admin-rewards-ready')).toBeInTheDocument());

    fireEvent.click(screen.getByTestId('admin-rewards-row-r1-delete-btn'));
    expect(screen.getByTestId('admin-rewards-delete-confirm')).toBeInTheDocument();
    fireEvent.click(screen.getByTestId('admin-rewards-delete-confirm-confirm'));

    await waitFor(() =>
      expect(fetchMock).toHaveBeenCalledWith(
        expect.stringContaining('/api/rewards/r1'),
        expect.objectContaining({ method: 'DELETE' }),
      ),
    );
    await waitFor(() => expect(screen.getByTestId('admin-rewards-empty')).toBeInTheDocument());
  });

  it('shows an error state when the rewards fetch fails', async () => {
    fetchMock.mockImplementation((url: string) => {
      const u = String(url);
      if (u.includes('/api/members')) {
        return Promise.resolve({
          ok: true,
          status: 200,
          json: async () => ({ members: [{ id: MEMBER_ID }], callerRole: 'admin' }),
        });
      }
      return Promise.resolve({ ok: false, status: 500, json: async () => ({}) });
    });
    render(<RewardsTab headers={HEADERS} />);
    await waitFor(() => expect(screen.getByTestId('admin-rewards-error')).toBeInTheDocument());
  });
});
