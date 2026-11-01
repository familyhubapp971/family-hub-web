import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor, fireEvent, act } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import type { GetStartedState } from '@familyhub/shared';

// FHS-511: first-run "Getting started" guide card.
// FHS-634: its state comes from the server, not this browser's storage.

const fetchMock = vi.fn();
const authState: { session: { access_token?: string } | null } = {
  session: { access_token: 'tok-abc' },
};
vi.mock('../../../../../src/app/lib/auth-context', () => ({
  useAuth: () => authState,
}));

import { GetStarted } from '../../../../../src/areas/today/GetStarted';
import { TenantProvider } from '../../../../../src/app/lib/tenant-context';

const SLUG = 'khan';
const KID = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc';
const LEGACY_KEY = `fh.getStarted.${SLUG}`;

const NO_STEPS = { kids: false, pins: false, rate: false, habits: false };

function state(over: Partial<GetStartedState> = {}): GetStartedState {
  return { dismissed: false, steps: { ...NO_STEPS }, firstKidId: KID, ...over };
}

/** Serve GET /get-started with `body`; 200 everything else (the dismiss POST). */
function installApi(body: GetStartedState | { status: number }) {
  fetchMock.mockImplementation((url: string) => {
    if (String(url).includes('/api/onboarding/get-started/dismiss')) {
      return Promise.resolve({ ok: true, status: 200, json: async () => ({ dismissed: true }) });
    }
    if (String(url).includes('/api/onboarding/get-started')) {
      if ('status' in body) {
        return Promise.resolve({ ok: false, status: body.status, json: async () => ({}) });
      }
      return Promise.resolve({ ok: true, status: 200, json: async () => body });
    }
    return Promise.resolve({ ok: true, status: 200, json: async () => ({}) });
  });
}

const dismissCalls = () =>
  fetchMock.mock.calls.filter((c) => String(c[0]).includes('/api/onboarding/get-started/dismiss'));

function renderAt() {
  return render(
    <MemoryRouter initialEntries={[`/t/${SLUG}/dashboard`]}>
      <Routes>
        <Route
          path="/t/:slug/dashboard"
          element={
            <TenantProvider>
              <GetStarted />
            </TenantProvider>
          }
        />
        <Route path="/t/:slug/members" element={<div data-testid="members-route" />} />
        <Route path="/t/:slug/reward-settings" element={<div data-testid="reward-route" />} />
        <Route path="/t/:slug/child/:memberId" element={<div data-testid="child-route" />} />
      </Routes>
    </MemoryRouter>,
  );
}

beforeEach(() => {
  fetchMock.mockReset();
  installApi(state());
  vi.stubGlobal('fetch', fetchMock);
  authState.session = { access_token: 'tok-abc' };
  window.localStorage.clear();
});
afterEach(() => vi.unstubAllGlobals());

describe('<GetStarted /> (FHS-511, FHS-634)', () => {
  it('a new family sees the guide with 0 of 4 done and the first step as the CTA', async () => {
    renderAt();
    expect(await screen.findByTestId('get-started')).toBeInTheDocument();
    expect(screen.getByTestId('get-started-count').textContent).toContain('0 of 4 done');
    expect(screen.getByTestId('get-started-cta-kids')).toHaveTextContent('Add a child');
    expect(screen.queryByTestId('get-started-done-kids')).not.toBeInTheDocument();
  });

  it('ticks the steps the family has already done, whatever this browser has seen', async () => {
    installApi(state({ steps: { ...NO_STEPS, kids: true, pins: true } }));
    renderAt();
    expect(await screen.findByTestId('get-started')).toBeInTheDocument();
    expect(screen.getByTestId('get-started-count').textContent).toContain('2 of 4 done');
    expect(screen.getByTestId('get-started-done-kids')).toBeInTheDocument();
    expect(screen.getByTestId('get-started-done-pins')).toBeInTheDocument();
    // The rate is the first thing still outstanding, so it carries the CTA.
    expect(screen.getByTestId('get-started-cta-rate')).toHaveTextContent('Set pocket money');
  });

  it("tapping a step's CTA navigates there without ticking it off", async () => {
    renderAt();
    await screen.findByTestId('get-started');
    await act(async () => {
      fireEvent.click(screen.getByTestId('get-started-cta-kids'));
    });
    await waitFor(() => expect(screen.getByTestId('members-route')).toBeInTheDocument());
    // Nothing was written to this browser, and nothing was dismissed: the step
    // only counts once the family really has a child.
    expect(window.localStorage.getItem(LEGACY_KEY)).toBeNull();
    expect(dismissCalls()).toHaveLength(0);
  });

  it('"Open their world" deep-links to the first child', async () => {
    installApi(state({ steps: { kids: true, pins: true, rate: true, habits: false } }));
    renderAt();
    await screen.findByTestId('get-started');
    await act(async () => {
      fireEvent.click(screen.getByTestId('get-started-cta-habits'));
    });
    await waitFor(() => expect(screen.getByTestId('child-route')).toBeInTheDocument());
  });

  it('celebrates when all four are done and "Got it" tells the server', async () => {
    installApi(state({ steps: { kids: true, pins: true, rate: true, habits: true } }));
    renderAt();
    expect(await screen.findByTestId('get-started-celebrate')).toHaveTextContent(
      'You are all set up',
    );
    await act(async () => {
      fireEvent.click(screen.getByTestId('get-started-got-it'));
    });
    expect(screen.queryByTestId('get-started-celebrate')).not.toBeInTheDocument();
    expect(dismissCalls()).toHaveLength(1);
  });

  it('a parent who dismissed it on another device never sees it here', async () => {
    installApi(state({ dismissed: true }));
    renderAt();
    await act(async () => {});
    expect(screen.queryByTestId('get-started')).not.toBeInTheDocument();
    expect(screen.queryByTestId('get-started-celebrate')).not.toBeInTheDocument();
  });

  it('the × dismiss hides the guide and saves it against the account', async () => {
    renderAt();
    await screen.findByTestId('get-started');
    await act(async () => {
      fireEvent.click(screen.getByTestId('get-started-dismiss'));
    });
    expect(screen.queryByTestId('get-started')).not.toBeInTheDocument();
    const [, init] = dismissCalls()[0] as [string, RequestInit];
    expect(init.method).toBe('POST');
  });

  it('does not show the guide to a non-admin caller (the API answers 403)', async () => {
    installApi({ status: 403 });
    renderAt();
    await waitFor(() => expect(fetchMock).toHaveBeenCalled());
    await act(async () => {});
    expect(screen.queryByTestId('get-started')).not.toBeInTheDocument();
  });

  it('carries a pre-FHS-634 dismissal in this browser over to the account, once', async () => {
    window.localStorage.setItem(LEGACY_KEY, JSON.stringify({ dismissed: true, completed: [] }));
    renderAt();
    await waitFor(() => expect(dismissCalls()).toHaveLength(1));
    expect(screen.queryByTestId('get-started')).not.toBeInTheDocument();
    // The old key is gone, so the next load asks the server and nothing else.
    expect(window.localStorage.getItem(LEGACY_KEY)).toBeNull();
  });

  it('keeps the old key when the carry-over call fails, so it can try again', async () => {
    // Review finding: deleting the key first meant one dropped request lost a
    // parent's dismissal for good, which is the very bug this ticket fixes.
    window.localStorage.setItem(LEGACY_KEY, JSON.stringify({ dismissed: true, completed: [] }));
    fetchMock.mockImplementation((url: string) => {
      if (String(url).includes('/dismiss')) return Promise.reject(new Error('network down'));
      return Promise.resolve({ ok: true, status: 200, json: async () => state() });
    });
    renderAt();
    await waitFor(() => expect(dismissCalls()).toHaveLength(1));
    expect(window.localStorage.getItem(LEGACY_KEY)).not.toBeNull();
    expect(screen.queryByTestId('get-started')).not.toBeInTheDocument();
  });

  it('a background token refresh cannot pop the card back open after dismissing', async () => {
    // Supabase hands back a new session object on every token refresh, which
    // re-runs the load. If that lands before the dismiss is saved, the server
    // still says "not dismissed": the card must not reappear on the parent.
    const { rerender } = renderAt();
    await screen.findByTestId('get-started');
    await act(async () => {
      fireEvent.click(screen.getByTestId('get-started-dismiss'));
    });
    expect(screen.queryByTestId('get-started')).not.toBeInTheDocument();

    authState.session = { access_token: 'tok-refreshed' };
    await act(async () => {
      rerender(
        <MemoryRouter initialEntries={[`/t/${SLUG}/dashboard`]}>
          <Routes>
            <Route
              path="/t/:slug/dashboard"
              element={
                <TenantProvider>
                  <GetStarted />
                </TenantProvider>
              }
            />
          </Routes>
        </MemoryRouter>,
      );
    });
    await act(async () => {});
    expect(screen.queryByTestId('get-started')).not.toBeInTheDocument();
  });

  it('ignores a corrupted legacy key and shows what the server says', async () => {
    window.localStorage.setItem(LEGACY_KEY, 'not json {{{');
    renderAt();
    expect(await screen.findByTestId('get-started')).toBeInTheDocument();
    expect(screen.getByTestId('get-started-count').textContent).toContain('0 of 4 done');
    expect(dismissCalls()).toHaveLength(0);
  });

  it('stays hidden when the state cannot be loaded', async () => {
    installApi({ status: 500 });
    renderAt();
    await waitFor(() => expect(fetchMock).toHaveBeenCalled());
    await act(async () => {});
    expect(screen.queryByTestId('get-started')).not.toBeInTheDocument();
  });
});
