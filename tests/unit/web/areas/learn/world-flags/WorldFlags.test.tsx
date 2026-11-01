import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor, fireEvent, act } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';

// World Flags container: Explore / Learn path / Certificates sub-tabs.
// Tests cover both parent mode (memberId) and kid mode (kidToken).

const fetchMock = vi.fn();
const authState: { session: { access_token?: string } | null } = {
  session: { access_token: 'tok-abc' },
};
vi.mock('../../../../../../src/app/lib/auth-context', () => ({
  useAuth: () => authState,
}));
vi.mock('react-leaflet', () => ({
  MapContainer: ({ children }: { children?: unknown }) => children ?? null,
  TileLayer: () => null,
  Marker: ({ children }: { children?: unknown }) => children ?? null,
  Popup: ({ children }: { children?: unknown }) => children ?? null,
}));
vi.mock('leaflet', () => ({ default: { icon: () => ({}) }, icon: () => ({}) }));

import { WorldFlags } from '../../../../../../src/areas/learn/world-flags/WorldFlags';
import { TenantProvider } from '../../../../../../src/app/lib/tenant-context';

const CHILD = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc';
const KID_TOKEN = 'kid.jwt.tok';

function installFetch(opts: { explored?: string[]; progress?: Record<string, number[]> } = {}) {
  fetchMock.mockImplementation((url: string, init?: RequestInit) => {
    const method = (init as RequestInit | undefined)?.method ?? 'GET';
    if (
      (url as string).includes('/api/world-flags/learn') ||
      (url as string).includes('/api/kid/world-flags/learn')
    ) {
      if (method === 'POST') {
        return Promise.resolve({ ok: true, status: 200, json: async () => ({ completed: true }) });
      }
      return Promise.resolve({
        ok: true,
        status: 200,
        json: async () => ({ progress: opts.progress ?? {} }),
      });
    }
    if (
      (url as string).includes('/api/world-flags') ||
      (url as string).includes('/api/kid/world-flags')
    ) {
      if (method === 'POST') {
        return Promise.resolve({ ok: true, status: 200, json: async () => ({ explored: true }) });
      }
      return Promise.resolve({
        ok: true,
        status: 200,
        json: async () => ({ explored: opts.explored ?? [] }),
      });
    }
    // Wikipedia landmark lookups etc. → fail to placeholder.
    return Promise.resolve({ ok: false, status: 500, json: async () => ({}) });
  });
}

function renderWorldFlags() {
  return render(
    <MemoryRouter initialEntries={['/t/khan/child/' + CHILD]}>
      <Routes>
        <Route
          path="/t/:slug/child/:memberId"
          element={
            <TenantProvider>
              <WorldFlags memberId={CHILD} />
            </TenantProvider>
          }
        />
      </Routes>
    </MemoryRouter>,
  );
}

function renderWorldFlagsKid() {
  // Must be under a /t/:slug route so TenantProvider can read the slug param
  // (useTenantSlug() throws outside it). The slug value is irrelevant for kid
  // mode: only the kidToken is used to build headers.
  return render(
    <MemoryRouter initialEntries={['/t/khan/kid']}>
      <Routes>
        <Route
          path="/t/:slug/kid"
          element={
            <TenantProvider>
              <WorldFlags kidToken={KID_TOKEN} />
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
  localStorage.clear();
});
afterEach(() => vi.unstubAllGlobals());

describe('WorldFlags sub-tabs', () => {
  it('defaults to Learn and shows all three sub-tab buttons', async () => {
    installFetch();
    renderWorldFlags();
    expect(screen.getByTestId('world-subtab-explore')).toBeInTheDocument();
    expect(screen.getByTestId('world-subtab-learn')).toBeInTheDocument();
    expect(screen.getByTestId('world-subtab-certificates')).toBeInTheDocument();
    // Default tab is Learn: wfpath is visible immediately.
    await waitFor(() => expect(screen.getByTestId('wfpath')).toBeInTheDocument());
  });

  it('shows the continent picker in the Learn path (default tab)', async () => {
    installFetch();
    renderWorldFlags();
    // Default is Learn: continent picker appears immediately.
    await waitFor(() => expect(screen.getByTestId('wfpath')).toBeInTheDocument());
    expect(screen.getByTestId('wfpath-continent-africa')).toBeInTheDocument();
  });

  it('switches to the Explore tab and shows the flashcard', async () => {
    installFetch();
    renderWorldFlags();
    await waitFor(() => expect(screen.getByTestId('wfpath')).toBeInTheDocument());
    await act(async () => {
      fireEvent.click(screen.getByTestId('world-subtab-explore'));
    });
    await waitFor(() => expect(screen.getByTestId('world-flashcard')).toBeInTheDocument());
  });

  it('switches to the Certificates tab and shows the progress bar', async () => {
    installFetch();
    renderWorldFlags();
    await waitFor(() => expect(screen.getByTestId('wfpath')).toBeInTheDocument());
    await act(async () => {
      fireEvent.click(screen.getByTestId('world-subtab-certificates'));
    });
    await waitFor(() => expect(screen.getByTestId('wfcert')).toBeInTheDocument());
    expect(screen.getByTestId('wfcert-progress-bar')).toBeInTheDocument();
  });
});

describe('WorldFlags Learn path', () => {
  it('picking a continent unlocks set 1 and locks the rest', async () => {
    installFetch({ progress: {} });
    renderWorldFlags();
    // Default tab is Learn: no need to click the tab.
    await waitFor(() => expect(screen.getByTestId('wfpath-continent-africa')).toBeInTheDocument());
    await act(async () => {
      fireEvent.click(screen.getByTestId('wfpath-continent-africa'));
    });
    await waitFor(() => expect(screen.getByTestId('wfpath-set-0')).toBeInTheDocument());
    // First set is unlocked, second is locked (disabled) until set 0 passes.
    expect(screen.getByTestId('wfpath-set-0')).not.toBeDisabled();
    expect(screen.getByTestId('wfpath-set-1')).toBeDisabled();
  });

  it('answering every question correctly completes the set and POSTs once', async () => {
    installFetch({ progress: {} });
    renderWorldFlags();
    // Default tab is Learn: continent picker is present without clicking.
    await waitFor(() => expect(screen.getByTestId('wfpath-continent-africa')).toBeInTheDocument());
    await act(async () => {
      fireEvent.click(screen.getByTestId('wfpath-continent-africa'));
    });
    await waitFor(() => expect(screen.getByTestId('wfpath-set-0')).toBeInTheDocument());
    await act(async () => {
      fireEvent.click(screen.getByTestId('wfpath-set-0'));
    });
    // Study phase: click through all 5 cards (last "Next" starts the quiz).
    await waitFor(() => expect(screen.getByTestId('wfpath-study')).toBeInTheDocument());
    for (let i = 0; i < 5; i++) {
      await act(async () => {
        fireEvent.click(screen.getByTestId('wfpath-study-next'));
      });
    }
    // Quiz phase: answer each of the 5 questions correctly. The flag image's
    // alt text ("Flag of X") reveals the country whose name is the answer.
    await waitFor(() => expect(screen.getByTestId('wfpath-quiz')).toBeInTheDocument());
    for (let q = 0; q < 5; q++) {
      const img = screen.getByTestId('world-flag-image') as HTMLImageElement;
      const name = img.alt.replace(/^Flag of /, '');
      const choices = screen.getAllByTestId(/^wfpath-quiz-choice-/);
      const target = choices.find((b) => b.textContent === name);
      expect(target, `choice for "${name}" present`).toBeTruthy();
      await act(async () => {
        fireEvent.click(target!);
      });
      // Each correct answer auto-advances after 500ms.
      await act(async () => {
        await new Promise((r) => setTimeout(r, 600));
      });
    }
    // Set passed → results screen + exactly one learn-complete POST.
    await waitFor(() => expect(screen.getByTestId('wfpath-results')).toBeInTheDocument());
    const completeCalls = (fetchMock.mock.calls as [string, RequestInit | undefined][]).filter(
      ([url, init]) =>
        (url as string).includes('/api/world-flags/learn-complete') && init?.method === 'POST',
    );
    expect(completeCalls).toHaveLength(1);
  }, 15000);

  it('completed sets from the server are marked and unlock the next set', async () => {
    installFetch({ progress: { Africa: [0] } });
    renderWorldFlags();
    // Default tab is Learn.
    await waitFor(() => expect(screen.getByTestId('wfpath-continent-africa')).toBeInTheDocument());
    await act(async () => {
      fireEvent.click(screen.getByTestId('wfpath-continent-africa'));
    });
    await waitFor(() => expect(screen.getByTestId('wfpath-set-1')).toBeInTheDocument());
    // Set 0 done → set 1 now unlocked.
    expect(screen.getByTestId('wfpath-set-1')).not.toBeDisabled();
  });
});

describe('WorldFlags Certificates', () => {
  it('shows an earned certificate + quiz button when a continent is fully explored', async () => {
    // Mark every African flag explored so Africa's certificate is earned.
    const { COUNTRIES } = await import('../../../../../../src/areas/learn/world-flags/countries');
    const africa = COUNTRIES.filter((c) => c.continent === 'Africa').map((c) => c.code);
    installFetch({ explored: africa });
    renderWorldFlags();
    // Default is Learn: navigate from Learn to Certificates.
    await waitFor(() => expect(screen.getByTestId('wfpath')).toBeInTheDocument());
    await act(async () => {
      fireEvent.click(screen.getByTestId('world-subtab-certificates'));
    });
    await waitFor(() => expect(screen.getByTestId('wfcert-card-africa')).toBeInTheDocument());
    expect(screen.getByTestId('wfcert-quiz-africa')).toBeInTheDocument();
  });
});

// ─── Kid-mode tests (FHS-373) ─────────────────────────────────────────────────

describe('WorldFlags kid mode: Explore', () => {
  it('GETs /api/kid/world-flags with only the kid Bearer token (no memberId, no x-tenant-slug)', async () => {
    // Kid mode does NOT need a Supabase session: set to null to prove it.
    authState.session = null;
    installFetch();
    renderWorldFlagsKid();
    // Default is Learn; navigate to Explore to trigger the explore fetch.
    await waitFor(() => expect(screen.getByTestId('wfpath')).toBeInTheDocument());
    await act(async () => {
      fireEvent.click(screen.getByTestId('world-subtab-explore'));
    });
    await waitFor(() => expect(screen.getByTestId('world-flashcard')).toBeInTheDocument());

    const exploreCalls = (fetchMock.mock.calls as [string, RequestInit | undefined][]).filter(
      ([url, init]) =>
        (url as string).includes('/api/kid/world-flags') && (init?.method ?? 'GET') === 'GET',
    );
    expect(exploreCalls.length).toBeGreaterThan(0);
    const [url, init] = exploreCalls[0]!;
    expect(url).not.toContain('memberId');
    expect((init?.headers as Record<string, string>)?.Authorization).toBe(`Bearer ${KID_TOKEN}`);
    expect((init?.headers as Record<string, string>)?.['x-tenant-slug']).toBeUndefined();
  });

  it('POSTs /api/kid/world-flags/explore with countryCode only (no memberId)', async () => {
    authState.session = null;
    installFetch();
    renderWorldFlagsKid();
    // Navigate to Explore (default is Learn).
    await waitFor(() => expect(screen.getByTestId('wfpath')).toBeInTheDocument());
    await act(async () => {
      fireEvent.click(screen.getByTestId('world-subtab-explore'));
    });
    await waitFor(() => expect(screen.getByTestId('world-flashcard')).toBeInTheDocument());

    // Tapping the card (flag → name state) triggers markExplored.
    await act(async () => {
      fireEvent.click(screen.getByTestId('world-flashcard'));
    });

    await waitFor(() => {
      const postCalls = (fetchMock.mock.calls as [string, RequestInit | undefined][]).filter(
        ([url, init]) =>
          (url as string).includes('/api/kid/world-flags/explore') && init?.method === 'POST',
      );
      expect(postCalls.length).toBeGreaterThan(0);
      const body = JSON.parse(postCalls[0]![1]!.body as string) as Record<string, unknown>;
      expect(body.countryCode).toBeTruthy();
      expect(body.memberId).toBeUndefined();
    });
  });
});

describe('WorldFlags kid mode: Learn path', () => {
  it('GETs /api/kid/world-flags/learn with no memberId in the URL', async () => {
    authState.session = null;
    installFetch();
    renderWorldFlagsKid();
    // Default is Learn: wfpath renders immediately.
    await waitFor(() => expect(screen.getByTestId('wfpath')).toBeInTheDocument());

    const learnCalls = (fetchMock.mock.calls as [string, RequestInit | undefined][]).filter(
      ([url, init]) =>
        (url as string).includes('/api/kid/world-flags/learn') && (init?.method ?? 'GET') === 'GET',
    );
    expect(learnCalls.length).toBeGreaterThan(0);
    expect(String(learnCalls[0]![0])).not.toContain('memberId');
  });

  it('POSTs /api/kid/world-flags/learn-complete without memberId', async () => {
    authState.session = null;
    installFetch({ progress: {} });
    renderWorldFlagsKid();
    // Default is Learn: continent picker present immediately.
    await waitFor(() => expect(screen.getByTestId('wfpath-continent-africa')).toBeInTheDocument());
    await act(async () => {
      fireEvent.click(screen.getByTestId('wfpath-continent-africa'));
    });
    await waitFor(() => expect(screen.getByTestId('wfpath-set-0')).toBeInTheDocument());
    await act(async () => {
      fireEvent.click(screen.getByTestId('wfpath-set-0'));
    });
    await waitFor(() => expect(screen.getByTestId('wfpath-study')).toBeInTheDocument());
    for (let i = 0; i < 5; i++) {
      await act(async () => {
        fireEvent.click(screen.getByTestId('wfpath-study-next'));
      });
    }
    await waitFor(() => expect(screen.getByTestId('wfpath-quiz')).toBeInTheDocument());
    for (let q = 0; q < 5; q++) {
      const img = screen.getByTestId('world-flag-image') as HTMLImageElement;
      const name = img.alt.replace(/^Flag of /, '');
      const choices = screen.getAllByTestId(/^wfpath-quiz-choice-/);
      const target = choices.find((b) => b.textContent === name);
      expect(target).toBeTruthy();
      await act(async () => {
        fireEvent.click(target!);
      });
      await act(async () => {
        await new Promise((r) => setTimeout(r, 600));
      });
    }
    await waitFor(() => expect(screen.getByTestId('wfpath-results')).toBeInTheDocument());

    const completeCalls = (fetchMock.mock.calls as [string, RequestInit | undefined][]).filter(
      ([url, init]) =>
        (url as string).includes('/api/kid/world-flags/learn-complete') && init?.method === 'POST',
    );
    expect(completeCalls).toHaveLength(1);
    const body = JSON.parse(completeCalls[0]![1]!.body as string) as Record<string, unknown>;
    expect(body.memberId).toBeUndefined();
    expect(body.continent).toBe('Africa');
  }, 15000);
});

// ─── Design parity tests (FHS-397) ───────────────────────────────────────────

describe('WorldFlags Explore: continent gradient flashcard', () => {
  it('applies the continent gradient class to the flag section', async () => {
    installFetch();
    renderWorldFlags();
    // Navigate to Explore.
    await waitFor(() => expect(screen.getByTestId('wfpath')).toBeInTheDocument());
    await act(async () => {
      fireEvent.click(screen.getByTestId('world-subtab-explore'));
    });
    await waitFor(() => expect(screen.getByTestId('world-flashcard')).toBeInTheDocument());
    // The flag section div should include gradient classes (All continent default).
    const flashcard = screen.getByTestId('world-flashcard');
    const gradientSection = flashcard.querySelector('[class*="bg-gradient-to-br"]');
    expect(gradientSection).not.toBeNull();
    expect(gradientSection?.className).toMatch(/from-gray-500/);
  });
});

describe('WorldFlags Explore: progress bar gradient', () => {
  it('progress bar fill uses the continent gradient, not plain bg-black', async () => {
    installFetch();
    renderWorldFlags();
    await waitFor(() => expect(screen.getByTestId('wfpath')).toBeInTheDocument());
    await act(async () => {
      fireEvent.click(screen.getByTestId('world-subtab-explore'));
    });
    await waitFor(() => expect(screen.getByTestId('world-progress-fill')).toBeInTheDocument());
    const fill = screen.getByTestId('world-progress-fill');
    expect(fill.className).toMatch(/bg-gradient-to-r/);
    expect(fill.className).not.toMatch(/\bbg-black\b/);
  });
});

describe('WorldFlags Explore: continent certificate overlay', () => {
  it('shows the full-screen overlay once when a new cert is earned', async () => {
    const { COUNTRIES } = await import('../../../../../../src/areas/learn/world-flags/countries');
    // All Africa flags already explored on load: exploring one more from a tiny
    // 1-country list triggers the cert. Instead, we simulate it by exploring the
    // last un-explored Africa flag via a card tap.
    const africa = COUNTRIES.filter((c) => c.continent === 'Africa');
    // Pre-explore all but the first Africa country.
    const allButFirst = africa.slice(1).map((c) => c.code);
    installFetch({ explored: allButFirst });
    renderWorldFlags();
    await waitFor(() => expect(screen.getByTestId('wfpath')).toBeInTheDocument());
    await act(async () => {
      fireEvent.click(screen.getByTestId('world-subtab-explore'));
    });
    await waitFor(() => expect(screen.getByTestId('world-flashcard')).toBeInTheDocument());

    // Select Africa continent so the current card is an Africa country.
    await act(async () => {
      fireEvent.click(screen.getByTestId('world-continent-africa'));
    });
    // The first Africa country (un-explored) is now the flashcard.
    // Tapping it marks it explored and triggers the certificate overlay.
    await act(async () => {
      fireEvent.click(screen.getByTestId('world-flashcard'));
    });

    // Overlay appears with role=dialog.
    await waitFor(() => expect(screen.getByTestId('world-cert-earned')).toBeInTheDocument());
    expect(screen.getByTestId('world-cert-earned')).toHaveAttribute('role', 'dialog');

    // Dismiss button is present.
    const dismissBtn = screen.getByRole('button', { name: /Amazing!/i });
    expect(dismissBtn).toBeInTheDocument();

    // Clicking dismiss removes the overlay.
    await act(async () => {
      fireEvent.click(dismissBtn);
    });
    expect(screen.queryByTestId('world-cert-earned')).not.toBeInTheDocument();
  });

  it('overlay does not re-fire for an already-earned cert', async () => {
    const { COUNTRIES } = await import('../../../../../../src/areas/learn/world-flags/countries');
    const africa = COUNTRIES.filter((c) => c.continent === 'Africa');
    const allButFirst = africa.slice(1).map((c) => c.code);
    installFetch({ explored: allButFirst });
    renderWorldFlags();
    await waitFor(() => expect(screen.getByTestId('wfpath')).toBeInTheDocument());
    await act(async () => {
      fireEvent.click(screen.getByTestId('world-subtab-explore'));
    });
    await waitFor(() => expect(screen.getByTestId('world-flashcard')).toBeInTheDocument());
    await act(async () => {
      fireEvent.click(screen.getByTestId('world-continent-africa'));
    });
    // First tap: cert earned.
    await act(async () => {
      fireEvent.click(screen.getByTestId('world-flashcard'));
    });
    await waitFor(() => expect(screen.getByTestId('world-cert-earned')).toBeInTheDocument());
    // Dismiss.
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /Amazing!/i }));
    });
    expect(screen.queryByTestId('world-cert-earned')).not.toBeInTheDocument();
    // Tapping again (same card, already explored) must NOT re-open the overlay.
    await act(async () => {
      fireEvent.click(screen.getByTestId('world-flashcard'));
    });
    expect(screen.queryByTestId('world-cert-earned')).not.toBeInTheDocument();
  });

  it('backdrop is a div (not a button): no interactive-inside-interactive nesting', async () => {
    const { COUNTRIES } = await import('../../../../../../src/areas/learn/world-flags/countries');
    const africa = COUNTRIES.filter((c) => c.continent === 'Africa');
    const allButFirst = africa.slice(1).map((c) => c.code);
    installFetch({ explored: allButFirst });
    renderWorldFlags();
    await waitFor(() => expect(screen.getByTestId('wfpath')).toBeInTheDocument());
    await act(async () => {
      fireEvent.click(screen.getByTestId('world-subtab-explore'));
    });
    await waitFor(() => expect(screen.getByTestId('world-flashcard')).toBeInTheDocument());
    await act(async () => {
      fireEvent.click(screen.getByTestId('world-continent-africa'));
    });
    await act(async () => {
      fireEvent.click(screen.getByTestId('world-flashcard'));
    });
    await waitFor(() => expect(screen.getByTestId('world-cert-backdrop')).toBeInTheDocument());
    // Backdrop must be a div, not a button.
    expect(screen.getByTestId('world-cert-backdrop').tagName).toBe('DIV');
    // The dialog card (role=dialog) must be inside that div, not inside a button.
    const dialog = screen.getByTestId('world-cert-earned');
    expect(dialog.closest('button')).toBeNull();
  });

  it('pressing Escape while the overlay is open dismisses it', async () => {
    const { COUNTRIES } = await import('../../../../../../src/areas/learn/world-flags/countries');
    const africa = COUNTRIES.filter((c) => c.continent === 'Africa');
    const allButFirst = africa.slice(1).map((c) => c.code);
    installFetch({ explored: allButFirst });
    renderWorldFlags();
    await waitFor(() => expect(screen.getByTestId('wfpath')).toBeInTheDocument());
    await act(async () => {
      fireEvent.click(screen.getByTestId('world-subtab-explore'));
    });
    await waitFor(() => expect(screen.getByTestId('world-flashcard')).toBeInTheDocument());
    await act(async () => {
      fireEvent.click(screen.getByTestId('world-continent-africa'));
    });
    await act(async () => {
      fireEvent.click(screen.getByTestId('world-flashcard'));
    });
    await waitFor(() => expect(screen.getByTestId('world-cert-earned')).toBeInTheDocument());
    // Fire the Escape key on the document: the useEffect listener should close it.
    await act(async () => {
      fireEvent.keyDown(document, { key: 'Escape' });
    });
    expect(screen.queryByTestId('world-cert-earned')).not.toBeInTheDocument();
  });

  it('overlay auto-dismisses after 6 seconds', async () => {
    // Render and open the overlay using real timers so waitFor polling works normally.
    const { COUNTRIES } = await import('../../../../../../src/areas/learn/world-flags/countries');
    const africa = COUNTRIES.filter((c) => c.continent === 'Africa');
    const allButFirst = africa.slice(1).map((c) => c.code);
    installFetch({ explored: allButFirst });
    renderWorldFlags();
    await waitFor(() => expect(screen.getByTestId('wfpath')).toBeInTheDocument());
    await act(async () => {
      fireEvent.click(screen.getByTestId('world-subtab-explore'));
    });
    await waitFor(() => expect(screen.getByTestId('world-flashcard')).toBeInTheDocument());
    await act(async () => {
      fireEvent.click(screen.getByTestId('world-continent-africa'));
    });
    // Swap to fake timers immediately before the tap so the 6s setTimeout is intercepted.
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
    try {
      await act(async () => {
        fireEvent.click(screen.getByTestId('world-flashcard'));
      });
      // Flush React's own pending setState batches (microtasks not affected by fake timers).
      await act(async () => {
        await Promise.resolve();
        await Promise.resolve();
      });
      // Cert overlay must be up: assert synchronously, NOT via waitFor: waitFor
      // polls with setTimeout which is now faked and would never advance (hang).
      // The overlay is in the DOM after the click + microtask flush above.
      expect(screen.queryByTestId('world-cert-earned')).not.toBeNull();
      // Now advance past 6s: the fake setTimeout fires → setCertEarned(null).
      await act(async () => {
        vi.advanceTimersByTime(6001);
      });
      expect(screen.queryByTestId('world-cert-earned')).not.toBeInTheDocument();
    } finally {
      vi.useRealTimers();
    }
  }, 10000);
});
