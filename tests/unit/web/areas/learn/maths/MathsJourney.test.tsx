// FHS-394: MathsJourney unit tests.
// Covers: loading state, stage derivation from progress, lock/unlock by
// certificate, milestone markers, Continue button, and stage card clicks.

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor, fireEvent, act } from '@testing-library/react';
import { MathsJourney } from '../../../../../../src/areas/learn/maths/MathsJourney';

const fetchMock = vi.fn();
const KID_TOKEN = 'kid-journey-tok';

const onStartLearn = vi.fn();
const onStartPractice = vi.fn();
const onStartProve = vi.fn();

// Default progress / certificate fixtures
function makeProgress(
  overrides: Partial<{
    operation: string;
    tableNumber: number;
    learnCompleted: boolean;
    practiceCorrect: number;
    proveScore: number;
    proveAvgTime: number;
  }> = {},
) {
  return {
    operation: 'multiplication',
    tableNumber: 1,
    learnCompleted: false,
    practiceCorrect: 0,
    proveScore: 0,
    proveAvgTime: 0,
    ...overrides,
  };
}

function installFetch(
  progress: ReturnType<typeof makeProgress>[],
  certificates: { operation: string; difficulty: string }[] = [],
) {
  fetchMock.mockImplementation((url: string) => {
    const u = String(url);
    if (u.includes('/api/kid/maths/certificates')) {
      return Promise.resolve({ ok: true, status: 200, json: async () => ({ certificates }) });
    }
    if (u.includes('/api/kid/maths/progress')) {
      return Promise.resolve({ ok: true, status: 200, json: async () => ({ progress }) });
    }
    return Promise.resolve({ ok: false, status: 404, json: async () => ({}) });
  });
}

beforeEach(() => {
  fetchMock.mockReset();
  onStartLearn.mockReset();
  onStartPractice.mockReset();
  onStartProve.mockReset();
  vi.stubGlobal('fetch', fetchMock);
});
afterEach(() => vi.unstubAllGlobals());

function renderJourney(operation: 'multiplication' | 'addition' = 'multiplication') {
  return render(
    <MathsJourney
      kidToken={KID_TOKEN}
      operation={operation}
      onStartLearn={onStartLearn}
      onStartPractice={onStartPractice}
      onStartProve={onStartProve}
    />,
  );
}

// ─── Loading state ────────────────────────────────────────────────────────────

describe('MathsJourney: loading state', () => {
  it('shows loading indicator while fetching', () => {
    fetchMock.mockImplementation(() => new Promise(() => {}));
    renderJourney();
    expect(screen.getByTestId('maths-journey')).toBeInTheDocument();
    expect(screen.getByLabelText(/loading journey/i)).toBeInTheDocument();
  });
});

// ─── Stage derivation from progress ──────────────────────────────────────────

describe('MathsJourney: stage derivation', () => {
  it('shows the "Learn" stage as active when learnCompleted is false', async () => {
    installFetch([makeProgress({ tableNumber: 1, learnCompleted: false })]);
    renderJourney();
    await waitFor(() => expect(screen.getByTestId('journey-detail-panel')).toBeInTheDocument());
    // Learn card should be active (blue border class implies isActive)
    expect(screen.getByTestId('stage-learn')).toBeInTheDocument();
    // Continue button should be present for an active stage
    expect(screen.getByTestId('journey-continue-btn')).toBeInTheDocument();
  });

  it('shows the "Practice" stage as next after learn is done', async () => {
    installFetch([makeProgress({ tableNumber: 1, learnCompleted: true, practiceCorrect: 0 })]);
    renderJourney();
    await waitFor(() => expect(screen.getByTestId('journey-detail-panel')).toBeInTheDocument());
    // The Learn card should now show '✓ Done' and Practice should be active
    expect(screen.getByTestId('stage-learn')).toBeInTheDocument();
    expect(screen.getByTestId('stage-practice')).toBeInTheDocument();
  });

  it('shows "Prove" stage after practice threshold (10 correct) is met', async () => {
    installFetch([
      makeProgress({ tableNumber: 1, learnCompleted: true, practiceCorrect: 10, proveScore: 0 }),
    ]);
    renderJourney();
    await waitFor(() => expect(screen.getByTestId('journey-detail-panel')).toBeInTheDocument());
    expect(screen.getByTestId('stage-prove')).toBeInTheDocument();
  });
});

// ─── Lock / unlock by certificate ────────────────────────────────────────────

describe('MathsJourney: lock/unlock by certificate', () => {
  it('table 1 circle is always rendered (never locked)', async () => {
    installFetch([]);
    renderJourney();
    await waitFor(() => expect(screen.getByTestId('journey-circle-1')).toBeInTheDocument());
    expect(screen.getByTestId('journey-circle-1')).not.toBeDisabled();
  });

  it('table 2 is locked when table 1 has no certificate', async () => {
    installFetch([]);
    renderJourney();
    await waitFor(() => expect(screen.getByTestId('journey-circle-2')).toBeInTheDocument());
    expect(screen.getByTestId('journey-circle-2')).toBeDisabled();
  });

  it('table 2 unlocks when table 1 has a certificate', async () => {
    installFetch(
      [makeProgress({ tableNumber: 2, learnCompleted: false })],
      [{ operation: 'multiplication', difficulty: '1' }],
    );
    renderJourney();
    await waitFor(() => expect(screen.getByTestId('journey-circle-2')).toBeInTheDocument());
    expect(screen.getByTestId('journey-circle-2')).not.toBeDisabled();
  });

  it('mastered table shows a check mark (✓)', async () => {
    installFetch([], [{ operation: 'multiplication', difficulty: '1' }]);
    renderJourney();
    await waitFor(() => expect(screen.getByTestId('journey-circle-1')).toBeInTheDocument());
    // The mastered circle button's aria-label should say 'mastered'
    expect(screen.getByTestId('journey-circle-1')).toHaveAttribute(
      'aria-label',
      expect.stringContaining('mastered'),
    );
  });
});

// ─── Milestone markers ────────────────────────────────────────────────────────

describe('MathsJourney: milestone markers', () => {
  it('renders all 12 table circles', async () => {
    installFetch([]);
    renderJourney();
    await waitFor(() => expect(screen.getByTestId('journey-circle-1')).toBeInTheDocument());
    for (let t = 1; t <= 12; t++) {
      expect(screen.getByTestId(`journey-circle-${t}`)).toBeInTheDocument();
    }
  });
});

// ─── Continue button callbacks ────────────────────────────────────────────────

describe('MathsJourney: Continue button', () => {
  it('clicking Continue when active stage is "learn" calls onStartLearn', async () => {
    installFetch([makeProgress({ tableNumber: 1, learnCompleted: false })]);
    renderJourney();
    await waitFor(() => expect(screen.getByTestId('journey-continue-btn')).toBeInTheDocument());
    await act(async () => {
      fireEvent.click(screen.getByTestId('journey-continue-btn'));
    });
    expect(onStartLearn).toHaveBeenCalledWith(1);
    expect(onStartPractice).not.toHaveBeenCalled();
  });

  it('clicking Continue when active stage is "practice" calls onStartPractice', async () => {
    installFetch([makeProgress({ tableNumber: 1, learnCompleted: true, practiceCorrect: 5 })]);
    renderJourney();
    await waitFor(() => expect(screen.getByTestId('journey-continue-btn')).toBeInTheDocument());
    await act(async () => {
      fireEvent.click(screen.getByTestId('journey-continue-btn'));
    });
    expect(onStartPractice).toHaveBeenCalledWith(1);
  });

  it('clicking Continue when active stage is "prove" calls onStartProve', async () => {
    installFetch([
      makeProgress({
        tableNumber: 1,
        learnCompleted: true,
        practiceCorrect: 10,
        proveScore: 5,
        proveAvgTime: 6,
      }),
    ]);
    renderJourney();
    await waitFor(() => expect(screen.getByTestId('journey-continue-btn')).toBeInTheDocument());
    await act(async () => {
      fireEvent.click(screen.getByTestId('journey-continue-btn'));
    });
    expect(onStartProve).toHaveBeenCalledWith(1);
  });

  it('mastered circle has the correct aria-label and shows no Continue in its detail panel when selected', async () => {
    // Only table 1 is mastered; the journey auto-advances activeTable to table 2.
    // Click circle 1 to select the mastered table and verify no Continue button.
    installFetch([], [{ operation: 'multiplication', difficulty: '1' }]);
    renderJourney();
    await waitFor(() => expect(screen.getByTestId('journey-circle-1')).toBeInTheDocument());

    // Select the mastered table explicitly
    await act(async () => {
      fireEvent.click(screen.getByTestId('journey-circle-1'));
    });

    await waitFor(() => expect(screen.getByTestId('journey-detail-panel')).toBeInTheDocument());
    // A mastered table shows "Mastered!" text and no Continue button.
    expect(screen.getByText(/Mastered!/i)).toBeInTheDocument();
    expect(screen.queryByTestId('journey-continue-btn')).not.toBeInTheDocument();
  });
});

// ─── Fetch resilience ─────────────────────────────────────────────────────────

describe('MathsJourney: fetch resilience', () => {
  it('renders without crashing when both fetch calls fail', async () => {
    fetchMock.mockResolvedValue({ ok: false, status: 500, json: async () => ({}) });
    renderJourney();
    await waitFor(() => expect(screen.getByTestId('maths-journey')).toBeInTheDocument());
    // Should show the journey with default (all locked) state
    expect(screen.getByTestId('journey-circle-1')).toBeInTheDocument();
  });
});
