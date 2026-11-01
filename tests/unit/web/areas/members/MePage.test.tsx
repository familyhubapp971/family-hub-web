import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';

// Hoist mocks so vi.mock() factories can read shared state.
const mocks = vi.hoisted(() => ({
  fetchMock: vi.fn(),
  getSessionMock: vi.fn(),
}));

vi.stubGlobal('fetch', mocks.fetchMock);

vi.mock('../../../../../src/app/lib/supabase', () => ({
  supabase: {
    auth: {
      getSession: mocks.getSessionMock,
    },
  },
}));

// Import AFTER vi.mock so the page picks up the mocked supabase.
import { MePage } from '../../../../../src/areas/members/MePage';

const ME_FIXTURE = {
  id: '00000000-0000-4000-8000-000000000001',
  email: 'alice@example.com',
  createdAt: '2026-01-15T10:30:00.000Z',
};

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

beforeEach(() => {
  mocks.fetchMock.mockReset();
  mocks.getSessionMock.mockReset();
  mocks.getSessionMock.mockResolvedValue({ data: { session: { access_token: 'tok-abc' } } });
});

describe('FHS-195: <MePage />', () => {
  it('renders Hello, {email} after the fetch resolves', async () => {
    mocks.fetchMock.mockResolvedValue(jsonResponse(ME_FIXTURE));

    render(<MePage />);

    expect(screen.getByTestId('me-loading')).toBeInTheDocument();
    await waitFor(() => expect(screen.getByTestId('me-greeting')).toBeInTheDocument());
    expect(screen.getByTestId('me-greeting')).toHaveTextContent(`Hello, ${ME_FIXTURE.email}`);
    expect(screen.getByTestId('me-id')).toHaveTextContent(ME_FIXTURE.id);
    expect(screen.getByTestId('me-created-at')).toHaveTextContent(ME_FIXTURE.createdAt);
  });

  it('passes the bearer token from the live Supabase session', async () => {
    mocks.fetchMock.mockResolvedValue(jsonResponse(ME_FIXTURE));

    render(<MePage />);

    await waitFor(() => expect(mocks.fetchMock).toHaveBeenCalled());
    const [, init] = mocks.fetchMock.mock.calls[0]!;
    expect((init as RequestInit).headers).toMatchObject({ Authorization: 'Bearer tok-abc' });
  });

  it('renders an error when /api/me returns non-2xx', async () => {
    mocks.fetchMock.mockResolvedValue(jsonResponse({ error: 'unauthorized' }, 401));

    render(<MePage />);

    await waitFor(() => expect(screen.getByTestId('me-error')).toBeInTheDocument());
    expect(screen.getByTestId('me-error')).toHaveTextContent('/api/me → 401');
  });

  it('renders an error when /api/me returns a malformed body', async () => {
    mocks.fetchMock.mockResolvedValue(jsonResponse({ wat: 'no shape' }));

    render(<MePage />);

    await waitFor(() => expect(screen.getByTestId('me-error')).toBeInTheDocument());
    expect(screen.getByTestId('me-error')).toHaveTextContent('unexpected /api/me response shape');
  });
});
