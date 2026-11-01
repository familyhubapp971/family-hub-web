// FHS-394: MathsTablePractice unit tests.
// Covers: renders 10 questions, correct/incorrect feedback, double-tap guard,
// and onComplete called with the accumulated score.

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor, fireEvent, act } from '@testing-library/react';
import { MathsTablePractice } from '../../../../../../src/areas/learn/maths/MathsTablePractice';

// Stable seeded problem so tests don't flake on random choices.
// generateTableProblem is pure: we replace it with a deterministic version.
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

beforeEach(() => {
  onComplete.mockReset();
  onBack.mockReset();
  // Fake timers with shouldAdvanceTime so waitFor polling still works.
  vi.useFakeTimers({ shouldAdvanceTime: true });
});
afterEach(() => {
  vi.useRealTimers();
});

function renderPractice() {
  render(
    <MathsTablePractice
      operation="multiplication"
      tableNumber={3}
      onComplete={onComplete}
      onBack={onBack}
    />,
  );
}

// ─── Initial render ───────────────────────────────────────────────────────────

describe('MathsTablePractice: initial render', () => {
  it('renders the practice component with question 1 of 10', () => {
    renderPractice();
    expect(screen.getByTestId('maths-table-practice')).toBeInTheDocument();
    expect(screen.getByTestId('practice-progress')).toHaveTextContent('Question 1 of 10');
  });

  it('renders 4 answer choice buttons', () => {
    renderPractice();
    const choices = screen.getAllByRole('button', { name: /Answer \d+/ });
    expect(choices).toHaveLength(4);
  });

  it('renders the visual cue card', () => {
    renderPractice();
    expect(screen.getByTestId('practice-visual-cue')).toBeInTheDocument();
  });

  it('renders the written problem', () => {
    renderPractice();
    // The seeded problem is 3 × 4 = ?
    expect(screen.getByTestId('practice-written-problem')).toHaveTextContent('= ?');
  });

  it('calls onBack when the back button is clicked', () => {
    renderPractice();
    fireEvent.click(screen.getByTestId('practice-back-btn'));
    expect(onBack).toHaveBeenCalledOnce();
  });
});

// ─── Correct answer feedback ──────────────────────────────────────────────────

describe('MathsTablePractice: correct answer', () => {
  it('shows a correct feedback message after the right answer', async () => {
    renderPractice();
    const correctBtn = screen.getByRole('button', { name: 'Answer 12' });
    await act(async () => {
      fireEvent.click(correctBtn);
    });
    expect(screen.getByTestId('practice-feedback')).toHaveTextContent(/Correct/i);
  });

  it('auto-advances to question 2 after ~600ms on a correct answer', async () => {
    renderPractice();
    const correctBtn = screen.getByRole('button', { name: 'Answer 12' });
    await act(async () => {
      fireEvent.click(correctBtn);
    });
    await act(async () => {
      vi.advanceTimersByTime(700);
    });
    await waitFor(() =>
      expect(screen.getByTestId('practice-progress')).toHaveTextContent('Question 2 of 10'),
    );
  });
});

// ─── Incorrect answer feedback ────────────────────────────────────────────────

describe('MathsTablePractice: incorrect answer', () => {
  it('shows an incorrect feedback message after a wrong answer', async () => {
    renderPractice();
    const wrongBtn = screen.getByRole('button', { name: 'Answer 10' });
    await act(async () => {
      fireEvent.click(wrongBtn);
    });
    expect(screen.getByTestId('practice-feedback')).toHaveTextContent(/It was 12/i);
  });

  it('auto-advances after ~1000ms on an incorrect answer', async () => {
    renderPractice();
    const wrongBtn = screen.getByRole('button', { name: 'Answer 10' });
    await act(async () => {
      fireEvent.click(wrongBtn);
    });
    await act(async () => {
      vi.advanceTimersByTime(1100);
    });
    await waitFor(() =>
      expect(screen.getByTestId('practice-progress')).toHaveTextContent('Question 2 of 10'),
    );
  });
});

// ─── Double-tap guard ─────────────────────────────────────────────────────────

describe('MathsTablePractice: double-tap guard', () => {
  it('records exactly one answer per question even on rapid double-tap', async () => {
    renderPractice();
    // Two synchronous taps on different buttons before React flushes state.
    const correctBtn = screen.getByRole('button', { name: 'Answer 12' });
    const wrongBtn = screen.getByRole('button', { name: 'Answer 10' });
    await act(async () => {
      fireEvent.click(correctBtn);
      fireEvent.click(wrongBtn);
    });
    // Advance past the auto-advance timer.
    await act(async () => {
      vi.advanceTimersByTime(700);
    });
    // Should have advanced to Q2, meaning only one answer was recorded for Q1.
    await waitFor(() =>
      expect(screen.getByTestId('practice-progress')).toHaveTextContent('Question 2 of 10'),
    );
  });
});

// ─── Full 10-question run → onComplete ───────────────────────────────────────
// The component no longer renders its own done-screen. When the 10th question
// resolves, onComplete fires automatically via useEffect. The parent
// (MathsSubject) owns the celebration (MathsStageComplete).

// Helper: answer all questions with the given choice label.
// Uses 1200ms advance to cover both the 600ms (correct) and 1000ms (wrong) delays.
async function answerAll(choiceLabel: string) {
  for (let q = 0; q < 10; q++) {
    await waitFor(() =>
      expect(screen.getAllByRole('button', { name: /Answer \d+/ }).length).toBeGreaterThan(0),
    );
    const btn = screen.getByRole('button', { name: choiceLabel });
    await act(async () => {
      fireEvent.click(btn);
    });
    await act(async () => {
      vi.advanceTimersByTime(1200);
    });
  }
}

describe('MathsTablePractice: 10-question completion', () => {
  it('calls onComplete automatically (no button tap) with score 10 when all correct', async () => {
    renderPractice();
    await answerAll('Answer 12'); // all correct: answer=12
    await waitFor(() => {
      expect(onComplete).toHaveBeenCalledOnce();
      expect(onComplete).toHaveBeenCalledWith(10);
    });
  });

  it('calls onComplete automatically with score 0 when all wrong', async () => {
    renderPractice();
    await answerAll('Answer 10'); // all wrong: correct answer is 12
    await waitFor(() => {
      expect(onComplete).toHaveBeenCalledOnce();
      expect(onComplete).toHaveBeenCalledWith(0);
    });
  });

  it('does NOT render an internal done-screen: parent owns celebration', async () => {
    renderPractice();
    await answerAll('Answer 12');
    await waitFor(() => expect(onComplete).toHaveBeenCalled());
    // No internal continue button should exist: MathsStageComplete is in the parent
    expect(screen.queryByTestId('practice-complete-continue')).not.toBeInTheDocument();
  });

  it('fires onComplete exactly once even if the component re-renders after done', async () => {
    renderPractice();
    await answerAll('Answer 12');
    await waitFor(() => expect(onComplete).toHaveBeenCalled());
    // Wait another tick to confirm no second call
    await act(async () => {
      vi.advanceTimersByTime(500);
    });
    expect(onComplete).toHaveBeenCalledOnce();
  });
});
