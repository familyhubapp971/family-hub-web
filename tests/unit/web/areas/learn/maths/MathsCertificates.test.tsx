// FHS-394: MathsCertificates unit tests.
// Covers: earned certs render, empty state, speed-challenge milestone gating,
// localStorage best scores.

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor, fireEvent, act } from '@testing-library/react';
import { MathsCertificates } from '../../../../../../src/areas/learn/maths/MathsCertificates';

// ─── Deterministic speed-challenge problems ───────────────────────────────────

vi.mock('../../../../../../src/areas/learn/maths/maths-utils', async (importOriginal) => {
  const actual =
    await importOriginal<typeof import('../../../../../../src/areas/learn/maths/maths-utils')>();
  return {
    ...actual,
    generateTableProblem: () => ({
      a: 2,
      b: 3,
      operation: 'multiplication',
      answer: 6,
      emoji: 'star',
      choices: [4, 6, 8, 10],
    }),
    pickRandom: (arr: number[]) => arr[0],
  };
});

// ─── Fetch mock ───────────────────────────────────────────────────────────────

const fetchMock = vi.fn();
const KID_TOKEN = 'kid-cert-tok';

function mockCerts(certs: object[]) {
  fetchMock.mockResolvedValue({
    ok: true,
    json: async () => ({ certificates: certs }),
  });
}

beforeEach(() => {
  fetchMock.mockReset();
  vi.stubGlobal('fetch', fetchMock);
  // Clear localStorage between tests.
  localStorage.clear();
  vi.useFakeTimers({ shouldAdvanceTime: true });
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

// Wait for the component to finish loading (loading state also has the testid,
// so we gate on the progress bar which only renders post-load).
async function waitLoaded() {
  await waitFor(() => expect(screen.getByTestId('maths-cert-progress-bar')).toBeInTheDocument());
}

// ─── Empty state ──────────────────────────────────────────────────────────────

describe('MathsCertificates: empty state', () => {
  it('renders the certificates panel with 0% progress when no certs exist', async () => {
    mockCerts([]);
    render(<MathsCertificates kidToken={KID_TOKEN} operation="multiplication" />);

    await waitLoaded();
    expect(screen.getByText('0 of 12 tables mastered')).toBeInTheDocument();
    expect(screen.getByText('0%')).toBeInTheDocument();
  });

  it('renders all 12 table slots as locked when no certs exist', async () => {
    mockCerts([]);
    render(<MathsCertificates kidToken={KID_TOKEN} operation="multiplication" />);

    await waitLoaded();

    // All 12 slots exist.
    for (let t = 1; t <= 12; t++) {
      expect(screen.getByTestId(`maths-cert-${t}`)).toBeInTheDocument();
    }
  });

  it('does not show any speed milestone buttons when no certs are earned', async () => {
    mockCerts([]);
    render(<MathsCertificates kidToken={KID_TOKEN} operation="multiplication" />);

    await waitLoaded();
    expect(screen.queryByTestId('speed-milestone-bronze')).not.toBeInTheDocument();
  });
});

// ─── Earned certificates ──────────────────────────────────────────────────────

describe('MathsCertificates: earned certificates', () => {
  it('renders earned certificates with star decoration', async () => {
    mockCerts([
      { operation: 'multiplication', difficulty: '1', earnedAt: '2025-01-15T10:00:00Z' },
      { operation: 'multiplication', difficulty: '3', earnedAt: '2025-02-20T12:00:00Z' },
    ]);
    render(<MathsCertificates kidToken={KID_TOKEN} operation="multiplication" />);

    await waitFor(() => expect(screen.getByTestId('maths-cert-1')).toBeInTheDocument());

    // Cert 1 and 3 are earned: they should have the medal decoration (🏅).
    const cert1 = screen.getByTestId('maths-cert-1');
    const cert3 = screen.getByTestId('maths-cert-3');
    expect(cert1).toHaveTextContent('🏅');
    expect(cert3).toHaveTextContent('🏅');

    // Cert 2 is still locked.
    const cert2 = screen.getByTestId('maths-cert-2');
    expect(cert2).not.toHaveTextContent('🏅');
  });

  it('shows correct earned count and percentage', async () => {
    const certs = [1, 2, 3].map((n) => ({
      operation: 'multiplication',
      difficulty: String(n),
      earnedAt: '2025-01-01T00:00:00Z',
    }));
    mockCerts(certs);
    render(<MathsCertificates kidToken={KID_TOKEN} operation="multiplication" />);

    await waitLoaded();
    expect(screen.getByText('3 of 12 tables mastered')).toBeInTheDocument();
    expect(screen.getByText('25%')).toBeInTheDocument();
  });

  it('filters certificates to the current operation only', async () => {
    mockCerts([
      { operation: 'addition', difficulty: '1', earnedAt: '2025-01-01T00:00:00Z' },
      { operation: 'multiplication', difficulty: '1', earnedAt: '2025-01-02T00:00:00Z' },
    ]);
    render(<MathsCertificates kidToken={KID_TOKEN} operation="addition" />);

    await waitLoaded();
    // Only 1 cert for addition: count should be 1 of 12.
    expect(screen.getByText('1 of 12 tables mastered')).toBeInTheDocument();
  });
});

// ─── Speed milestone gating ───────────────────────────────────────────────────

describe('MathsCertificates: speed milestone gating', () => {
  it('shows Bronze speed test button when tables 1-4 are all mastered', async () => {
    const certs = [1, 2, 3, 4].map((n) => ({
      operation: 'multiplication',
      difficulty: String(n),
      earnedAt: '2025-01-01T00:00:00Z',
    }));
    mockCerts(certs);
    render(<MathsCertificates kidToken={KID_TOKEN} operation="multiplication" />);

    await waitFor(() => expect(screen.getByTestId('speed-milestone-bronze')).toBeInTheDocument());
  });

  it('does NOT show Silver speed test button when only tables 1-4 are mastered', async () => {
    const certs = [1, 2, 3, 4].map((n) => ({
      operation: 'multiplication',
      difficulty: String(n),
      earnedAt: '2025-01-01T00:00:00Z',
    }));
    mockCerts(certs);
    render(<MathsCertificates kidToken={KID_TOKEN} operation="multiplication" />);

    await waitFor(() => expect(screen.getByTestId('speed-milestone-bronze')).toBeInTheDocument());
    expect(screen.queryByTestId('speed-milestone-silver')).not.toBeInTheDocument();
  });

  it('shows Gold speed test after tables 9-12 mastered (cumulative)', async () => {
    const certs = Array.from({ length: 12 }, (_, i) => ({
      operation: 'multiplication',
      difficulty: String(i + 1),
      earnedAt: '2025-01-01T00:00:00Z',
    }));
    mockCerts(certs);
    render(<MathsCertificates kidToken={KID_TOKEN} operation="multiplication" />);

    await waitFor(() => expect(screen.getByTestId('speed-milestone-gold')).toBeInTheDocument());
  });

  it('shows Grand Master speed test button when all 12 tables mastered', async () => {
    const certs = Array.from({ length: 12 }, (_, i) => ({
      operation: 'multiplication',
      difficulty: String(i + 1),
      earnedAt: '2025-01-01T00:00:00Z',
    }));
    mockCerts(certs);
    render(<MathsCertificates kidToken={KID_TOKEN} operation="multiplication" />);

    await waitFor(() =>
      expect(screen.getByTestId('speed-milestone-grand-master')).toBeInTheDocument(),
    );
  });
});

// ─── Speed challenge flow ─────────────────────────────────────────────────────

describe('MathsCertificates: speed challenge flow', () => {
  function allTwelveCerts() {
    return Array.from({ length: 12 }, (_, i) => ({
      operation: 'multiplication',
      difficulty: String(i + 1),
      earnedAt: '2025-01-01T00:00:00Z',
    }));
  }

  it('clicking Bronze speed test opens the speed challenge setup screen', async () => {
    mockCerts(allTwelveCerts());
    render(<MathsCertificates kidToken={KID_TOKEN} operation="multiplication" />);

    await waitFor(() => expect(screen.getByTestId('speed-milestone-bronze')).toBeInTheDocument());
    await act(async () => {
      fireEvent.click(screen.getByTestId('speed-milestone-bronze'));
    });
    expect(screen.getByTestId('speed-challenge-setup')).toBeInTheDocument();
  });

  it('can start the speed challenge and see the active screen', async () => {
    mockCerts(allTwelveCerts());
    render(<MathsCertificates kidToken={KID_TOKEN} operation="multiplication" />);

    await waitFor(() => expect(screen.getByTestId('speed-milestone-bronze')).toBeInTheDocument());
    await act(async () => {
      fireEvent.click(screen.getByTestId('speed-milestone-bronze'));
    });
    await act(async () => {
      fireEvent.click(screen.getByTestId('speed-challenge-go'));
    });
    expect(screen.getByTestId('speed-challenge-active')).toBeInTheDocument();
  });

  it('timer finishes and shows results screen', async () => {
    mockCerts(allTwelveCerts());
    render(<MathsCertificates kidToken={KID_TOKEN} operation="multiplication" />);

    await waitFor(() => expect(screen.getByTestId('speed-milestone-bronze')).toBeInTheDocument());
    await act(async () => {
      fireEvent.click(screen.getByTestId('speed-milestone-bronze'));
    });
    await act(async () => {
      fireEvent.click(screen.getByTestId('speed-challenge-go'));
    });
    await act(async () => {
      vi.advanceTimersByTime(60_000);
    });
    await waitFor(() => expect(screen.getByTestId('speed-challenge-results')).toBeInTheDocument());
  });

  it('Back button from speed challenge results returns to certificates panel', async () => {
    mockCerts(allTwelveCerts());
    render(<MathsCertificates kidToken={KID_TOKEN} operation="multiplication" />);

    await waitFor(() => expect(screen.getByTestId('speed-milestone-bronze')).toBeInTheDocument());
    await act(async () => {
      fireEvent.click(screen.getByTestId('speed-milestone-bronze'));
    });
    await act(async () => {
      fireEvent.click(screen.getByTestId('speed-challenge-go'));
    });
    await act(async () => {
      vi.advanceTimersByTime(60_000);
    });
    await waitFor(() => expect(screen.getByTestId('speed-challenge-results')).toBeInTheDocument());
    await act(async () => {
      fireEvent.click(screen.getByTestId('speed-challenge-exit'));
    });
    await waitFor(() => expect(screen.getByTestId('maths-cert-progress-bar')).toBeInTheDocument());
  });
});

// ─── localStorage best scores ─────────────────────────────────────────────────

describe('MathsCertificates: localStorage best scores', () => {
  function allTwelveCerts() {
    return Array.from({ length: 12 }, (_, i) => ({
      operation: 'multiplication',
      difficulty: String(i + 1),
      earnedAt: '2025-01-01T00:00:00Z',
    }));
  }

  it('shows stored best score for a milestone when localStorage has a value', async () => {
    // Pre-seed localStorage as if a Bronze speed test was previously played.
    localStorage.setItem('maths_speedBest_multiplication_bronze', '12');

    mockCerts(allTwelveCerts());
    render(<MathsCertificates kidToken={KID_TOKEN} operation="multiplication" />);

    await waitFor(() => expect(screen.getByTestId('speed-milestone-bronze')).toBeInTheDocument());

    // The button label should show the stored best.
    expect(screen.getByTestId('speed-milestone-bronze')).toHaveTextContent('Best: 12');
  });

  it('saves a new best score to localStorage after a speed challenge', async () => {
    mockCerts(allTwelveCerts());
    render(<MathsCertificates kidToken={KID_TOKEN} operation="multiplication" />);

    await waitFor(() => expect(screen.getByTestId('speed-milestone-bronze')).toBeInTheDocument());
    await act(async () => {
      fireEvent.click(screen.getByTestId('speed-milestone-bronze'));
    });
    await act(async () => {
      fireEvent.click(screen.getByTestId('speed-challenge-go'));
    });

    // Answer 5 questions correctly (answer=6).
    for (let i = 0; i < 5; i++) {
      await waitFor(() =>
        expect(screen.getAllByRole('button', { name: /Answer \d+/ }).length).toBeGreaterThan(0),
      );
      await act(async () => {
        fireEvent.click(screen.getByRole('button', { name: 'Answer 6' }));
      });
      await act(async () => {
        vi.advanceTimersByTime(500);
      });
    }

    // Let the timer expire.
    await act(async () => {
      vi.advanceTimersByTime(60_000);
    });
    await waitFor(() => expect(screen.getByTestId('speed-challenge-results')).toBeInTheDocument());

    // localStorage should now have a best score >= 5.
    const stored = parseInt(
      localStorage.getItem('maths_speedBest_multiplication_bronze') ?? '0',
      10,
    );
    expect(stored).toBeGreaterThanOrEqual(5);
  });
});
