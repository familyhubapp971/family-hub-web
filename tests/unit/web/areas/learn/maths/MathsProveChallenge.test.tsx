// FHS-394: MathsProveChallenge unit tests.
// Covers: timer countdown, onComplete fires once with score+avgTime when time
// runs out, double-tap guard on answers, pass vs fail thresholds.
//
// Uses fake timers with shouldAdvanceTime so waitFor polling still works.

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor, fireEvent, act } from '@testing-library/react';
import { MathsProveChallenge } from '../../../../../../src/areas/learn/maths/MathsProveChallenge';

// Deterministic problem: always returns answer=12 with choices [10, 12, 14, 16].
vi.mock('../../../../../../src/areas/learn/maths/maths-utils', async (importOriginal) => {
  const actual =
    await importOriginal<typeof import('../../../../../../src/areas/learn/maths/maths-utils')>();
  return {
    ...actual,
    generateTableProblem: () => ({
      a: 3,
      b: 4,
      operation: 'multiplication',
      answer: 12,
      emoji: 'star',
      choices: [10, 12, 14, 16],
    }),
  };
});

const onComplete = vi.fn();
const onBack = vi.fn();

function renderProve() {
  render(
    <MathsProveChallenge
      operation="multiplication"
      tableNumber={3}
      onComplete={onComplete}
      onBack={onBack}
    />,
  );
}

beforeEach(() => {
  onComplete.mockReset();
  onBack.mockReset();
  vi.useFakeTimers({ shouldAdvanceTime: true });
});

afterEach(() => {
  vi.useRealTimers();
});

// ─── Setup screen ─────────────────────────────────────────────────────────────

describe('MathsProveChallenge: setup screen', () => {
  it('renders the setup screen before starting', () => {
    renderProve();
    expect(screen.getByTestId('prove-challenge-setup')).toBeInTheDocument();
    expect(screen.queryByTestId('prove-challenge-active')).not.toBeInTheDocument();
  });

  it('renders the Start button', () => {
    renderProve();
    expect(screen.getByTestId('prove-start')).toBeInTheDocument();
  });

  it('calls onBack when the Back button is clicked from setup', async () => {
    renderProve();
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /back/i }));
    });
    expect(onBack).toHaveBeenCalledOnce();
  });

  it('clicking Start transitions to the active challenge', async () => {
    renderProve();
    await act(async () => {
      fireEvent.click(screen.getByTestId('prove-start'));
    });
    expect(screen.getByTestId('prove-challenge-active')).toBeInTheDocument();
    expect(screen.queryByTestId('prove-challenge-setup')).not.toBeInTheDocument();
  });
});

// ─── Timer countdown ──────────────────────────────────────────────────────────

describe('MathsProveChallenge: timer countdown', () => {
  it('shows 60s on the timer when the challenge first starts', async () => {
    renderProve();
    await act(async () => {
      fireEvent.click(screen.getByTestId('prove-start'));
    });
    expect(screen.getByText('60s')).toBeInTheDocument();
  });

  it('decrements the timer every second', async () => {
    renderProve();
    await act(async () => {
      fireEvent.click(screen.getByTestId('prove-start'));
    });
    await act(async () => {
      vi.advanceTimersByTime(3000);
    });
    await waitFor(() => expect(screen.getByText('57s')).toBeInTheDocument());
  });

  it('fires onComplete when the 60-second timer reaches 0', async () => {
    renderProve();
    await act(async () => {
      fireEvent.click(screen.getByTestId('prove-start'));
    });
    await act(async () => {
      vi.advanceTimersByTime(60_000);
    });
    await waitFor(() => expect(onComplete).toHaveBeenCalledOnce());
  });

  it('passes score and avgTime to onComplete', async () => {
    renderProve();
    await act(async () => {
      fireEvent.click(screen.getByTestId('prove-start'));
    });

    // Answer one correct question, then let the timer run out.
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Answer 12' }));
    });
    await act(async () => {
      vi.advanceTimersByTime(60_000);
    });

    await waitFor(() => expect(onComplete).toHaveBeenCalledOnce());
    const [score, avgTime] = onComplete.mock.calls[0] as [number, number];
    expect(score).toBe(1);
    // avgTime = totalTime / totalAnswered / 1000. In fake-timer environments
    // Date.now() doesn't advance between answer and expiry, so elapsed=0
    // and avgTime can be 0. We just verify it's a finite number (not 999 sentinel).
    expect(isFinite(avgTime)).toBe(true);
    expect(avgTime).toBeLessThan(999);
  });
});

// ─── onComplete fires exactly once ───────────────────────────────────────────

describe('MathsProveChallenge: onComplete guard', () => {
  it('calls onComplete exactly once even after multiple timer ticks settle', async () => {
    renderProve();
    await act(async () => {
      fireEvent.click(screen.getByTestId('prove-start'));
    });
    await act(async () => {
      vi.advanceTimersByTime(60_000);
    });
    // Extra ticks: guard must prevent a second call.
    await act(async () => {
      vi.advanceTimersByTime(5_000);
    });
    await waitFor(() => expect(onComplete).toHaveBeenCalledOnce());
  });

  it('does NOT render its own results screen: parent owns MathsStageComplete', async () => {
    renderProve();
    await act(async () => {
      fireEvent.click(screen.getByTestId('prove-start'));
    });
    await act(async () => {
      vi.advanceTimersByTime(60_000);
    });
    await waitFor(() => expect(onComplete).toHaveBeenCalledOnce());
    // The component must not render a results UI of its own.
    expect(screen.queryByTestId('prove-challenge-results')).not.toBeInTheDocument();
  });
});

// ─── Pass vs fail thresholds ─────────────────────────────────────────────────

describe('MathsProveChallenge: pass/fail values passed to onComplete', () => {
  it('passes score=0 and avgTime=999 when no questions were answered', async () => {
    renderProve();
    await act(async () => {
      fireEvent.click(screen.getByTestId('prove-start'));
    });
    await act(async () => {
      vi.advanceTimersByTime(60_000);
    });
    await waitFor(() => expect(onComplete).toHaveBeenCalledOnce());
    const [score, avgTime] = onComplete.mock.calls[0] as [number, number];
    expect(score).toBe(0);
    expect(avgTime).toBe(999);
  });

  it('correctly counts right answers in the score', async () => {
    renderProve();
    await act(async () => {
      fireEvent.click(screen.getByTestId('prove-start'));
    });

    // Answer 3 correct (answer=12), then let timer expire.
    for (let i = 0; i < 3; i++) {
      await waitFor(() =>
        expect(screen.getAllByRole('button', { name: /Answer \d+/ }).length).toBeGreaterThan(0),
      );
      await act(async () => {
        fireEvent.click(screen.getByRole('button', { name: 'Answer 12' }));
      });
      await act(async () => {
        vi.advanceTimersByTime(500);
      });
    }
    await act(async () => {
      vi.advanceTimersByTime(60_000);
    });

    await waitFor(() => expect(onComplete).toHaveBeenCalledOnce());
    const [score] = onComplete.mock.calls[0] as [number, number];
    expect(score).toBe(3);
  });
});

// ─── Double-tap guard ─────────────────────────────────────────────────────────

describe('MathsProveChallenge: double-tap guard', () => {
  it('ignores a second tap on a different answer button in the same question', async () => {
    renderProve();
    await act(async () => {
      fireEvent.click(screen.getByTestId('prove-start'));
    });

    await waitFor(() =>
      expect(screen.getAllByRole('button', { name: /Answer \d+/ }).length).toBeGreaterThan(0),
    );

    // Two rapid taps on different choices: only the first should count.
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Answer 12' })); // correct
      fireEvent.click(screen.getByRole('button', { name: 'Answer 10' })); // wrong
    });

    // Advance past auto-advance (400ms for correct) and timer.
    await act(async () => {
      vi.advanceTimersByTime(60_000);
    });

    await waitFor(() => expect(onComplete).toHaveBeenCalledOnce());
    const [score] = onComplete.mock.calls[0] as [number, number];
    // Only 1 question answered, and the first tap was correct → score = 1.
    expect(score).toBe(1);
  });

  it('shows feedback after selecting an answer', async () => {
    renderProve();
    await act(async () => {
      fireEvent.click(screen.getByTestId('prove-start'));
    });
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Answer 12' }));
    });
    expect(screen.getByTestId('prove-feedback')).toHaveTextContent(/Correct/i);
  });
});

// ─── Accessibility ────────────────────────────────────────────────────────────

describe('MathsProveChallenge: accessibility', () => {
  it('shows the live timer label during the challenge', async () => {
    renderProve();
    await act(async () => {
      fireEvent.click(screen.getByTestId('prove-start'));
    });
    // aria-label on the timer span
    expect(screen.getByLabelText(/seconds remaining/i)).toBeInTheDocument();
  });
});
