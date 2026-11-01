import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { LandingPage } from '../../../../../src/public-pages/home/LandingPage';

// Stub supabase + AuthProvider: the landing page only needs
// `session` to decide which CTA buttons to render. Mocking the module
// avoids pulling the real Supabase client (and its localStorage
// hydration race) into the unit test.
vi.mock('../../../../../src/app/lib/auth-context', () => ({
  useAuth: () => ({ session: null, user: null, loading: false }),
}));

describe('<LandingPage />', () => {
  const originalFetch = global.fetch;

  afterEach(() => {
    global.fetch = originalFetch;
    vi.restoreAllMocks();
  });

  function renderPage() {
    return render(
      <MemoryRouter>
        <LandingPage />
      </MemoryRouter>,
    );
  }

  it('renders the fetched /hello payload', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          message: 'hello from @familyhub/api',
          timestamp: '2025-01-01T00:00:00.000Z',
        }),
        { status: 200, headers: { 'content-type': 'application/json' } },
      ),
    );
    global.fetch = fetchMock as unknown as typeof global.fetch;

    renderPage();

    expect(screen.getByRole('heading', { name: /family hub/i })).toBeInTheDocument();

    await waitFor(() => {
      expect(screen.getByTestId('hello-message')).toHaveTextContent('hello from @familyhub/api');
    });
    expect(screen.getByTestId('hello-timestamp')).toHaveTextContent('2025-01-01T00:00:00.000Z');

    // Regression: the hello endpoint is mounted at /hello on the API
    // (not /api/hello). Asserting the URL stops a future drift between
    // web fetch and API mount point that would silently 404 in CI.
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [calledUrl] = fetchMock.mock.calls[0]!;
    expect(String(calledUrl)).toMatch(/\/hello$/);
    expect(String(calledUrl)).not.toMatch(/\/api\/hello$/);
  });

  it('shows an error card when the response shape is invalid', async () => {
    global.fetch = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ message: '', timestamp: 'not-a-date' }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      }),
    ) as unknown as typeof global.fetch;

    renderPage();

    await waitFor(() => {
      expect(screen.getByTestId('hello-error')).toHaveTextContent(/invalid/i);
    });
  });

  it('shows an error card on non-2xx response', async () => {
    global.fetch = vi
      .fn()
      .mockResolvedValue(new Response('boom', { status: 500 })) as unknown as typeof global.fetch;

    renderPage();

    await waitFor(() => {
      expect(screen.getByTestId('hello-error')).toHaveTextContent(/500/);
    });
  });
});
