// FHS-401: Unit tests for ChildLearningInsights
//
// Tests cover: loading state, error state + retry, empty state (no activity),
// ready state (summary tiles, subject cards, needs-help chips, accuracy labels,
// stuck panel, world-flags panel), and that no child switcher is rendered.

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor, fireEvent, act } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

const fetchMock = vi.fn();
const authState: { session: { access_token?: string } | null } = {
  session: { access_token: 'tok-parent' },
};

vi.mock('../../../../../src/app/lib/auth-context', () => ({
  useAuth: () => authState,
}));
vi.mock('../../../../../src/app/lib/tenant-context', () => ({
  useTenantSlug: () => 'khans',
}));
vi.stubGlobal('fetch', fetchMock);

import { ChildLearningInsights } from '../../../../../src/areas/learn/ChildLearningInsights';

const MEMBER_ID = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc';

// ─── Fixture builders ─────────────────────────────────────────────────────────

function makeSubject(
  subject: 'Maths' | 'Logic' | 'Science' | 'World Flags',
  overrides: Partial<{
    progressPct: number;
    certificatesEarned: number;
    certificatesTotal: number;
    lastActive: string | null;
    needsHelp: boolean;
    accuracyPct: number | null;
    continentsExplored: number;
    continentsTotal: number;
    exploredContinents: string[];
  }> = {},
) {
  return {
    subject,
    progressPct: 0,
    certificatesEarned: 0,
    certificatesTotal:
      subject === 'Maths' ? 48 : subject === 'Logic' ? 15 : subject === 'Science' ? 1 : 6,
    lastActive: null,
    needsHelp: false,
    accuracyPct: null,
    continentsExplored: 0,
    continentsTotal: subject === 'World Flags' ? 6 : 0,
    exploredContinents: [],
    ...overrides,
  };
}

const EMPTY_INSIGHTS = {
  memberId: MEMBER_ID,
  displayName: 'Ali',
  hasActivity: false,
  subjects: [
    makeSubject('Maths'),
    makeSubject('Logic'),
    makeSubject('Science'),
    makeSubject('World Flags'),
  ],
  weakest: null,
};

function activeInsights(overrides: Partial<typeof EMPTY_INSIGHTS> = {}) {
  return {
    ...EMPTY_INSIGHTS,
    hasActivity: true,
    subjects: [
      makeSubject('Maths', { progressPct: 50, certificatesEarned: 5, accuracyPct: 72 }),
      makeSubject('Logic', { progressPct: 30, accuracyPct: 55, needsHelp: true }),
      makeSubject('Science', { progressPct: 70, certificatesEarned: 1, accuracyPct: 80 }),
      makeSubject('World Flags', {
        progressPct: 25,
        continentsExplored: 3,
        continentsTotal: 6,
        exploredContinents: ['Africa', 'Asia', 'Europe'],
      }),
    ],
    ...overrides,
  };
}

function renderComponent() {
  return render(
    <MemoryRouter>
      <ChildLearningInsights memberId={MEMBER_ID} />
    </MemoryRouter>,
  );
}

beforeEach(() => {
  fetchMock.mockReset();
  authState.session = { access_token: 'tok-parent' };
});

afterEach(() => {
  vi.restoreAllMocks();
});

// ─── Loading state ────────────────────────────────────────────────────────────

describe('<ChildLearningInsights />: loading', () => {
  it('shows the loading message while fetch is pending', () => {
    fetchMock.mockReturnValue(new Promise(() => {}));
    renderComponent();
    expect(screen.getByTestId('child-insights-loading')).toBeInTheDocument();
  });

  it('loading element has aria-busy=true', () => {
    fetchMock.mockReturnValue(new Promise(() => {}));
    renderComponent();
    expect(screen.getByTestId('child-insights-loading').getAttribute('aria-busy')).toBe('true');
  });

  it('shows error panel instead of perpetual loading when session resolves to null', async () => {
    // Simulate auth context resolving with no session (e.g. token expired).
    authState.session = null;
    renderComponent();
    await waitFor(() => expect(screen.getByTestId('child-insights-error')).toBeInTheDocument());
    expect(screen.getByTestId('child-insights-error').textContent).toContain('Session expired');
  });
});

// ─── Error state ──────────────────────────────────────────────────────────────

describe('<ChildLearningInsights />: error state', () => {
  it('shows error panel when fetch fails', async () => {
    fetchMock.mockResolvedValue({ ok: false, status: 500, json: async () => ({}) });
    renderComponent();
    await waitFor(() => expect(screen.getByTestId('child-insights-error')).toBeInTheDocument());
  });

  it('error panel has role=alert', async () => {
    fetchMock.mockResolvedValue({ ok: false, status: 500, json: async () => ({}) });
    renderComponent();
    await waitFor(() =>
      expect(screen.getByTestId('child-insights-error').getAttribute('role')).toBe('alert'),
    );
  });

  it('retry button re-triggers the fetch', async () => {
    fetchMock
      .mockResolvedValueOnce({ ok: false, status: 500, json: async () => ({}) })
      .mockResolvedValue({
        ok: true,
        json: async () => EMPTY_INSIGHTS,
      });

    renderComponent();
    await waitFor(() => expect(screen.getByTestId('child-insights-retry')).toBeInTheDocument());
    await act(async () => {
      fireEvent.click(screen.getByTestId('child-insights-retry'));
    });
    await waitFor(() => expect(screen.getByTestId('child-insights-panel')).toBeInTheDocument());
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('retry button meets the 44px minimum tap target', async () => {
    fetchMock.mockResolvedValue({ ok: false, status: 500, json: async () => ({}) });
    renderComponent();
    const btn = await screen.findByTestId('child-insights-retry');
    expect(btn.className).toContain('min-h-[44px]');
  });
});

// ─── Empty state ──────────────────────────────────────────────────────────────

describe('<ChildLearningInsights />: empty state (no activity)', () => {
  beforeEach(() => {
    fetchMock.mockResolvedValue({ ok: true, json: async () => EMPTY_INSIGHTS });
  });

  it('renders the empty state panel when hasActivity is false', async () => {
    renderComponent();
    await waitFor(() => expect(screen.getByTestId('child-insights-empty')).toBeInTheDocument());
  });

  it('does NOT show subject cards grid in empty state', async () => {
    renderComponent();
    await waitFor(() => expect(screen.getByTestId('child-insights-empty')).toBeInTheDocument());
    expect(screen.queryByTestId('child-subject-cards-grid')).not.toBeInTheDocument();
  });

  it('renders the child name in the empty state message', async () => {
    renderComponent();
    await waitFor(() => expect(screen.getByTestId('child-insights-empty')).toBeInTheDocument());
    expect(screen.getByTestId('child-insights-empty').textContent).toContain('Ali');
  });
});

// ─── Ready state: no child switcher ──────────────────────────────────────────

describe('<ChildLearningInsights />: no child switcher', () => {
  it('does not render a child switcher (memberId is fixed by prop)', async () => {
    fetchMock.mockResolvedValue({ ok: true, json: async () => activeInsights() });
    renderComponent();
    await waitFor(() => expect(screen.getByTestId('child-insights-panel')).toBeInTheDocument());
    expect(screen.queryByTestId('child-switcher')).not.toBeInTheDocument();
  });
});

// ─── Ready state: header ──────────────────────────────────────────────────────

describe('<ChildLearningInsights />: header', () => {
  it('shows the "📖 LEARNING INSIGHTS" heading', async () => {
    fetchMock.mockResolvedValue({ ok: true, json: async () => activeInsights() });
    renderComponent();
    await waitFor(() => expect(screen.getByTestId('child-insights-panel')).toBeInTheDocument());
    const heading = screen.getByRole('heading', { name: /LEARNING INSIGHTS/i });
    expect(heading).toBeInTheDocument();
  });
});

// ─── Ready state: summary card ────────────────────────────────────────────────

describe('<ChildLearningInsights />: summary card', () => {
  beforeEach(() => {
    fetchMock.mockResolvedValue({ ok: true, json: async () => activeInsights() });
  });

  it('renders summary card', async () => {
    renderComponent();
    await waitFor(() => expect(screen.getByTestId('child-insights-summary')).toBeInTheDocument());
  });

  it('summary text names the child and mentions subjects needing help', async () => {
    renderComponent();
    await waitFor(() =>
      expect(screen.getByTestId('child-insights-summary-text').textContent).toContain('Ali'),
    );
    expect(screen.getByTestId('child-insights-summary-text').textContent).toContain('1 subject');
  });

  it('renders AVG PROGRESS stat tile', async () => {
    renderComponent();
    await waitFor(() => expect(screen.getByTestId('stat-avg-progress')).toBeInTheDocument());
    // avg of 50+30+70+25 = 175 / 4 = 43.75 → 44%
    expect(screen.getByTestId('stat-avg-progress').textContent).toContain('44%');
  });

  it('renders NEED HELP stat tile with count of subjects flagged', async () => {
    renderComponent();
    await waitFor(() => expect(screen.getByTestId('stat-need-help')).toBeInTheDocument());
    // 1 subject has needsHelp: true (Logic)
    expect(screen.getByTestId('stat-need-help').textContent).toContain('1');
  });

  it('renders CERTIFICATES stat tile with total earned', async () => {
    renderComponent();
    await waitFor(() => expect(screen.getByTestId('stat-certificates')).toBeInTheDocument());
    // Maths=5, Logic=0, Science=1, WF=0 → total 6
    expect(screen.getByTestId('stat-certificates').textContent).toContain('6');
  });
});

// ─── Ready state: subject cards ──────────────────────────────────────────────

describe('<ChildLearningInsights />: subject cards', () => {
  beforeEach(() => {
    fetchMock.mockResolvedValue({ ok: true, json: async () => activeInsights() });
  });

  it('renders a card for each of the 4 subjects', async () => {
    renderComponent();
    await waitFor(() => expect(screen.getByTestId('child-subject-cards-grid')).toBeInTheDocument());
    for (const slug of ['maths', 'logic', 'science', 'world-flags']) {
      expect(screen.getByTestId(`subject-card-${slug}`)).toBeInTheDocument();
    }
  });

  it('shows trophy badge on subject cards where certificatesEarned > 0', async () => {
    renderComponent();
    await waitFor(() => expect(screen.getByTestId('child-subject-cards-grid')).toBeInTheDocument());
    // Maths=5 certs → badge; Logic=0 → no badge; Science=1 → badge; WF=0 → no badge.
    expect(screen.getByTestId('trophy-badge-maths')).toBeInTheDocument();
    expect(screen.getByTestId('trophy-badge-science')).toBeInTheDocument();
    expect(screen.queryByTestId('trophy-badge-logic')).not.toBeInTheDocument();
    expect(screen.queryByTestId('trophy-badge-world-flags')).not.toBeInTheDocument();
  });

  it('shows accuracy ring for each subject', async () => {
    renderComponent();
    await waitFor(() => expect(screen.getByTestId('child-subject-cards-grid')).toBeInTheDocument());
    expect(screen.getAllByTestId('accuracy-ring')).toHaveLength(4);
  });

  it('accuracy label shows "-" when accuracyPct is null', async () => {
    renderComponent();
    await waitFor(() =>
      expect(screen.getByTestId('accuracy-label-world-flags')).toBeInTheDocument(),
    );
    expect(screen.getByTestId('accuracy-label-world-flags').textContent).toContain('-');
  });

  it('accuracy label shows the percentage when accuracyPct is set', async () => {
    renderComponent();
    await waitFor(() => expect(screen.getByTestId('accuracy-label-maths')).toBeInTheDocument());
    expect(screen.getByTestId('accuracy-label-maths').textContent).toContain('72%');
  });

  it('shows "Needs a little help here" chip only on flagged subjects', async () => {
    renderComponent();
    await waitFor(() => expect(screen.getByTestId('child-subject-cards-grid')).toBeInTheDocument());
    expect(screen.getByTestId('needs-help-chip-logic')).toBeInTheDocument();
    expect(screen.queryByTestId('needs-help-chip-maths')).not.toBeInTheDocument();
  });

  it('last-active label shows "Never" when lastActive is null', async () => {
    renderComponent();
    await waitFor(() => expect(screen.getByTestId('last-active-maths')).toBeInTheDocument());
    expect(screen.getByTestId('last-active-maths').textContent).toContain('Never');
  });
});

// ─── Ready state: stuck panel ────────────────────────────────────────────────

describe('<ChildLearningInsights />: "Where they\'re stuck" panel', () => {
  it('renders the stuck panel when weakest is non-null', async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () =>
        activeInsights({
          weakest: {
            subject: 'Logic',
            detail: 'Struggling with sorting puzzles.',
            tip: 'Try sorting physical objects like coloured blocks.',
          },
        }),
    });
    renderComponent();
    await waitFor(() => expect(screen.getByTestId('stuck-panel')).toBeInTheDocument());
    expect(screen.getByTestId('stuck-subject').textContent).toBe('Logic');
    expect(screen.getByTestId('stuck-detail').textContent).toContain('sorting puzzles');
    expect(screen.getByTestId('stuck-tip').textContent).toContain('coloured blocks');
  });

  it('hides the stuck panel when weakest is null', async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => activeInsights({ weakest: null }),
    });
    renderComponent();
    await waitFor(() => expect(screen.getByTestId('child-insights-panel')).toBeInTheDocument());
    expect(screen.queryByTestId('stuck-panel')).not.toBeInTheDocument();
  });

  it('stuck panel heading includes "WHERE THEY\'RE STUCK"', async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () =>
        activeInsights({
          weakest: { subject: 'Maths', detail: 'Low score', tip: 'Practice daily.' },
        }),
    });
    renderComponent();
    const panel = await screen.findByTestId('stuck-panel');
    expect(panel.textContent).toContain('WHERE THEY');
    expect(panel.textContent).toContain('STUCK');
  });
});

// ─── Ready state: World Flags panel ─────────────────────────────────────────

describe('<ChildLearningInsights />: World Flags panel', () => {
  it('renders the WF continent panel when continentsTotal > 0', async () => {
    fetchMock.mockResolvedValue({ ok: true, json: async () => activeInsights() });
    renderComponent();
    await waitFor(() => expect(screen.getByTestId('world-flags-panel')).toBeInTheDocument());
  });

  it('hides the WF panel when continentsTotal = 0', async () => {
    const noWF = activeInsights();
    // Zero out the WF subject's continent fields
    const wf = noWF.subjects.find((s) => s.subject === 'World Flags')!;
    wf.continentsTotal = 0;
    wf.continentsExplored = 0;
    wf.exploredContinents = [];
    fetchMock.mockResolvedValue({ ok: true, json: async () => noWF });
    renderComponent();
    await waitFor(() => expect(screen.getByTestId('child-insights-panel')).toBeInTheDocument());
    expect(screen.queryByTestId('world-flags-panel')).not.toBeInTheDocument();
  });

  it('shows the correct continents-explored count', async () => {
    fetchMock.mockResolvedValue({ ok: true, json: async () => activeInsights() });
    renderComponent();
    await waitFor(() => expect(screen.getByTestId('wf-continents-explored')).toBeInTheDocument());
    expect(screen.getByTestId('wf-continents-explored').textContent).toContain('3/6');
  });

  it('shows explored continent pills', async () => {
    fetchMock.mockResolvedValue({ ok: true, json: async () => activeInsights() });
    renderComponent();
    await waitFor(() => expect(screen.getByTestId('wf-continent-pills')).toBeInTheDocument());
    for (const c of ['Africa', 'Asia', 'Europe']) {
      expect(screen.getByTestId('wf-continent-pills').textContent).toContain(c);
    }
  });

  it('shows a cert badge when certificatesEarned > 0', async () => {
    const data = activeInsights();
    const wf = data.subjects.find((s) => s.subject === 'World Flags')!;
    wf.certificatesEarned = 2;
    fetchMock.mockResolvedValue({ ok: true, json: async () => data });
    renderComponent();
    await waitFor(() => expect(screen.getByTestId('wf-cert-badge')).toBeInTheDocument());
    expect(screen.getByTestId('wf-cert-badge').textContent).toContain('2');
  });

  it('hides the cert badge when certificatesEarned = 0', async () => {
    fetchMock.mockResolvedValue({ ok: true, json: async () => activeInsights() });
    renderComponent();
    await waitFor(() => expect(screen.getByTestId('world-flags-panel')).toBeInTheDocument());
    expect(screen.queryByTestId('wf-cert-badge')).not.toBeInTheDocument();
  });
});

// ─── World Flags panel edge cases ────────────────────────────────────────────

describe('<ChildLearningInsights />: World Flags edge cases', () => {
  it('renders "0/6" and no continent pills when continentsExplored=0 (not started)', async () => {
    const data = activeInsights();
    const wf = data.subjects.find((s) => s.subject === 'World Flags')!;
    wf.continentsExplored = 0;
    wf.exploredContinents = [];
    fetchMock.mockResolvedValue({ ok: true, json: async () => data });
    renderComponent();
    await waitFor(() => expect(screen.getByTestId('wf-continents-explored')).toBeInTheDocument());
    expect(screen.getByTestId('wf-continents-explored').textContent).toContain('0/6');
    expect(screen.queryByTestId('wf-continent-pills')).not.toBeInTheDocument();
  });
});

// ─── AccuracyRing boundary values ────────────────────────────────────────────

describe('<ChildLearningInsights />: AccuracyRing boundary values', () => {
  it('renders without crash when accuracyPct = 0', async () => {
    const data = activeInsights();
    // Set all subjects to 0% accuracy.
    for (const s of data.subjects) s.accuracyPct = 0;
    fetchMock.mockResolvedValue({ ok: true, json: async () => data });
    renderComponent();
    await waitFor(() => expect(screen.getByTestId('child-subject-cards-grid')).toBeInTheDocument());
    // All 4 rings should render; the maths label should show "0%".
    expect(screen.getAllByTestId('accuracy-ring')).toHaveLength(4);
    expect(screen.getByTestId('accuracy-label-maths').textContent).toContain('0%');
  });

  it('renders without crash when accuracyPct = 100', async () => {
    const data = activeInsights();
    for (const s of data.subjects) s.accuracyPct = 100;
    fetchMock.mockResolvedValue({ ok: true, json: async () => data });
    renderComponent();
    await waitFor(() => expect(screen.getByTestId('child-subject-cards-grid')).toBeInTheDocument());
    expect(screen.getAllByTestId('accuracy-ring')).toHaveLength(4);
    expect(screen.getByTestId('accuracy-label-maths').textContent).toContain('100%');
  });
});

// ─── API call verification ────────────────────────────────────────────────────

describe('<ChildLearningInsights />: API call', () => {
  it('fetches /api/learn/insights with the correct memberId, bearer token, and tenant slug', async () => {
    fetchMock.mockResolvedValue({ ok: true, json: async () => EMPTY_INSIGHTS });
    renderComponent();
    await waitFor(() => expect(fetchMock).toHaveBeenCalled());
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toContain(`memberId=${MEMBER_ID}`);
    expect((init.headers as Record<string, string>)['Authorization']).toBe('Bearer tok-parent');
    expect((init.headers as Record<string, string>)['x-tenant-slug']).toBe('khans');
  });
});
