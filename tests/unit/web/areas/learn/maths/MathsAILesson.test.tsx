// FHS-389: MathsAILesson component unit tests.
//
// Covers: selection screen, loading state, step flow, practice questions,
// feedback copy, completion screen, error state, and flag-disabled (null render).
// All fetch calls are mocked: no real Anthropic or API calls are made.

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor, fireEvent, act } from '@testing-library/react';
import { MathsAILesson } from '../../../../../../src/areas/learn/maths/MathsAILesson';

const fetchMock = vi.fn();
const KID_TOKEN = 'kid-bearer-tok';

// A valid lesson shape that matches the server-side Zod schema.
const MOCK_LESSON = {
  concept:
    'Adding means putting two groups of things together to find how many there are in total.',
  visual: {
    description: '3 apples then 2 more apples arrive',
    emoji: '🍎',
    groups: 2,
    perGroup: 3,
    total: 5,
    equation: '3 + 2 = 5',
  },
  stickyPhrase: 'When you add, the number gets bigger!',
  gapCheck: 'Adding does not mean taking away: you are making more, not less.',
  practice: [
    {
      emoji: '🍎',
      groups: 2,
      perGroup: 1,
      question: '1 + 2 = ?',
      answer: 3,
      choices: [3, 1, 4, 2],
    },
    {
      emoji: '⭐',
      groups: 2,
      perGroup: 2,
      question: '2 + 3 = ?',
      answer: 5,
      choices: [5, 4, 6, 3],
    },
    {
      emoji: '🍬',
      groups: 2,
      perGroup: 4,
      question: '4 + 1 = ?',
      answer: 5,
      choices: [5, 6, 3, 7],
    },
  ],
};

function mockEnabled(lesson = MOCK_LESSON) {
  fetchMock.mockResolvedValue({
    ok: true,
    status: 200,
    json: async () => ({ enabled: true, lesson }),
  });
}

function mockDisabled() {
  fetchMock.mockResolvedValue({
    ok: true,
    status: 200,
    json: async () => ({ enabled: false }),
  });
}

function mockError(errorMsg = 'Could not generate lesson. Please try again.') {
  fetchMock.mockResolvedValue({
    ok: true,
    status: 200,
    json: async () => ({ enabled: true, lesson: null, error: errorMsg }),
  });
}

function mockFetchFail() {
  fetchMock.mockRejectedValue(new Error('Network error'));
}

beforeEach(() => {
  fetchMock.mockReset();
  vi.stubGlobal('fetch', fetchMock);
});
afterEach(() => vi.unstubAllGlobals());

// ── Selection screen ──────────────────────────────────────────────────────────

describe('<MathsAILesson />: selection screen', () => {
  it('renders the selection screen when no tableNumber is given', () => {
    mockEnabled();
    render(<MathsAILesson kidToken={KID_TOKEN} />);
    expect(screen.getByTestId('ai-lesson')).toBeInTheDocument();
    expect(screen.getByTestId('ai-lesson-op-selector')).toBeInTheDocument();
    expect(screen.getByTestId('ai-lesson-diff-selector')).toBeInTheDocument();
    expect(screen.getByTestId('ai-lesson-start')).toBeInTheDocument();
  });

  it('renders all four operation buttons', () => {
    mockEnabled();
    render(<MathsAILesson kidToken={KID_TOKEN} />);
    expect(screen.getByTestId('ai-lesson-op-addition')).toBeInTheDocument();
    expect(screen.getByTestId('ai-lesson-op-subtraction')).toBeInTheDocument();
    expect(screen.getByTestId('ai-lesson-op-multiplication')).toBeInTheDocument();
    expect(screen.getByTestId('ai-lesson-op-division')).toBeInTheDocument();
  });

  it('renders all three difficulty buttons', () => {
    mockEnabled();
    render(<MathsAILesson kidToken={KID_TOKEN} />);
    expect(screen.getByTestId('ai-lesson-diff-easy')).toBeInTheDocument();
    expect(screen.getByTestId('ai-lesson-diff-medium')).toBeInTheDocument();
    expect(screen.getByTestId('ai-lesson-diff-hard')).toBeInTheDocument();
  });
});

// ── Loading state ────────────────────────────────────────────────────────────

describe('<MathsAILesson />: loading state', () => {
  it('shows loading spinner text after Start Lesson is clicked', async () => {
    fetchMock.mockImplementation(
      () =>
        new Promise((resolve) =>
          setTimeout(
            () =>
              resolve({
                ok: true,
                status: 200,
                json: async () => ({ enabled: true, lesson: MOCK_LESSON }),
              }),
            200,
          ),
        ),
    );

    render(<MathsAILesson kidToken={KID_TOKEN} />);
    fireEvent.click(screen.getByTestId('ai-lesson-start'));
    await waitFor(() => expect(screen.getByTestId('ai-lesson-loading')).toBeInTheDocument());
    expect(screen.getByText(/our ai teacher is preparing something fun/i)).toBeInTheDocument();
  });

  it('ignores a rapid second click while a generation is in flight (FHS-389)', async () => {
    fetchMock.mockImplementation(
      () =>
        new Promise((resolve) =>
          setTimeout(
            () =>
              resolve({
                ok: true,
                status: 200,
                json: async () => ({ enabled: true, lesson: MOCK_LESSON }),
              }),
            100,
          ),
        ),
    );
    render(<MathsAILesson kidToken={KID_TOKEN} />);
    const start = screen.getByTestId('ai-lesson-start');
    fireEvent.click(start);
    fireEvent.click(start); // second click must be a no-op (each call is paid AI)
    await waitFor(() => expect(screen.getByTestId('ai-lesson-loading')).toBeInTheDocument());
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});

// ── Step-by-step lesson flow ──────────────────────────────────────────────────

describe('<MathsAILesson />: lesson steps', () => {
  async function startLesson() {
    mockEnabled();
    render(<MathsAILesson kidToken={KID_TOKEN} />);
    fireEvent.click(screen.getByTestId('ai-lesson-start'));
    await waitFor(() => expect(screen.getByTestId('ai-lesson-active')).toBeInTheDocument());
  }

  it('renders the concept step first', async () => {
    await startLesson();
    expect(screen.getByTestId('ai-lesson-concept')).toBeInTheDocument();
    expect(screen.getByText(/adding means putting two groups/i)).toBeInTheDocument();
  });

  it('advances to the visual step after Next', async () => {
    await startLesson();
    fireEvent.click(screen.getByTestId('ai-lesson-next'));
    await waitFor(() => expect(screen.getByTestId('ai-lesson-visual')).toBeInTheDocument());
  });

  it('advances to sticky phrase step after Next × 2', async () => {
    await startLesson();
    fireEvent.click(screen.getByTestId('ai-lesson-next'));
    await waitFor(() => screen.getByTestId('ai-lesson-visual'));
    fireEvent.click(screen.getByTestId('ai-lesson-next'));
    await waitFor(() => expect(screen.getByTestId('ai-lesson-sticky')).toBeInTheDocument());
    expect(screen.getByText(/when you add, the number gets bigger/i)).toBeInTheDocument();
  });

  it('advances to gap check step after Next × 3', async () => {
    await startLesson();
    for (let i = 0; i < 3; i++) {
      fireEvent.click(screen.getByTestId('ai-lesson-next'));

      await act(async () => {});
    }
    await waitFor(() => expect(screen.getByTestId('ai-lesson-gapcheck')).toBeInTheDocument());
  });

  it('reaches the practice step after Next × 4', async () => {
    await startLesson();
    for (let i = 0; i < 4; i++) {
      fireEvent.click(screen.getByTestId('ai-lesson-next'));

      await act(async () => {});
    }
    await waitFor(() => expect(screen.getByTestId('ai-lesson-practice')).toBeInTheDocument());
    expect(screen.getByTestId('ai-lesson-question')).toBeInTheDocument();
  });

  it('Previous button goes back to prior step', async () => {
    await startLesson();
    fireEvent.click(screen.getByTestId('ai-lesson-next'));
    await waitFor(() => screen.getByTestId('ai-lesson-visual'));
    fireEvent.click(screen.getByTestId('ai-lesson-prev'));
    await waitFor(() => expect(screen.getByTestId('ai-lesson-concept')).toBeInTheDocument());
  });
});

// ── Practice questions + feedback ─────────────────────────────────────────────

describe('<MathsAILesson />: practice questions', () => {
  async function reachPractice() {
    mockEnabled();
    render(<MathsAILesson kidToken={KID_TOKEN} />);
    fireEvent.click(screen.getByTestId('ai-lesson-start'));
    await waitFor(() => screen.getByTestId('ai-lesson-active'));
    for (let i = 0; i < 4; i++) {
      fireEvent.click(screen.getByTestId('ai-lesson-next'));

      await act(async () => {});
    }
    await waitFor(() => screen.getByTestId('ai-lesson-practice'));
  }

  it('shows the question text and four choice buttons', async () => {
    await reachPractice();
    expect(screen.getByTestId('ai-lesson-question')).toHaveTextContent('1 + 2 = ?');
    expect(screen.getByTestId('ai-lesson-choices').children).toHaveLength(4);
  });

  it('shows correct feedback when right answer is chosen', async () => {
    await reachPractice();
    // Answer for q1 is 3.
    const choices = screen.getAllByTestId(/^ai-lesson-choice-/);
    const correctBtn = choices.find((btn) => btn.textContent === '3');
    expect(correctBtn).toBeDefined();
    fireEvent.click(correctBtn!);
    await waitFor(() =>
      expect(screen.getByRole('status')).toHaveTextContent(/amazing! you got it right/i),
    );
  });

  it('shows "Good try! The answer is X" feedback when wrong answer is chosen', async () => {
    await reachPractice();
    // Answer is 3; choose 1 (wrong).
    const choices = screen.getAllByTestId(/^ai-lesson-choice-/);
    const wrongBtn = choices.find((btn) => btn.textContent === '1');
    expect(wrongBtn).toBeDefined();
    fireEvent.click(wrongBtn!);
    await waitFor(() =>
      expect(screen.getByRole('status')).toHaveTextContent(/good try! the answer is 3/i),
    );
  });

  it('shows Next Question button after answering', async () => {
    await reachPractice();
    const choices = screen.getAllByTestId(/^ai-lesson-choice-/);
    fireEvent.click(choices[0]!);
    await waitFor(() => expect(screen.getByTestId('ai-lesson-practice-next')).toBeInTheDocument());
  });
});

// ── Completion screen ─────────────────────────────────────────────────────────

describe('<MathsAILesson />: completion', () => {
  it('shows the completed screen after all 3 practice questions are answered', async () => {
    mockEnabled();
    render(<MathsAILesson kidToken={KID_TOKEN} />);
    fireEvent.click(screen.getByTestId('ai-lesson-start'));
    await waitFor(() => screen.getByTestId('ai-lesson-active'));

    // Navigate to practice.
    for (let i = 0; i < 4; i++) {
      fireEvent.click(screen.getByTestId('ai-lesson-next'));

      await act(async () => {});
    }
    await waitFor(() => screen.getByTestId('ai-lesson-practice'));

    // Answer all 3 questions.
    for (let q = 0; q < 3; q++) {
      const choices = screen.getAllByTestId(/^ai-lesson-choice-/);
      fireEvent.click(choices[0]!);
      await waitFor(() => screen.getByTestId('ai-lesson-practice-next'));
      fireEvent.click(screen.getByTestId('ai-lesson-practice-next'));

      await act(async () => {});
    }

    await waitFor(() => expect(screen.getByTestId('ai-lesson-complete')).toBeInTheDocument());
    expect(screen.getByText(/lesson complete/i)).toBeInTheDocument();
    expect(screen.getByText(/when you add, the number gets bigger/i)).toBeInTheDocument();
  });
});

// ── Error state ───────────────────────────────────────────────────────────────

describe('<MathsAILesson />: error state', () => {
  it('shows the error message when the server returns an error', async () => {
    mockError('Could not generate lesson. Please try again.');
    render(<MathsAILesson kidToken={KID_TOKEN} />);
    fireEvent.click(screen.getByTestId('ai-lesson-start'));
    await waitFor(() =>
      expect(
        screen.getByText(/could not generate lesson\. please try again\./i),
      ).toBeInTheDocument(),
    );
    // Returns to selection screen (not loading, not active).
    expect(screen.queryByTestId('ai-lesson-loading')).not.toBeInTheDocument();
    expect(screen.queryByTestId('ai-lesson-active')).not.toBeInTheDocument();
  });

  it('shows an error when fetch rejects (network failure)', async () => {
    mockFetchFail();
    render(<MathsAILesson kidToken={KID_TOKEN} />);
    fireEvent.click(screen.getByTestId('ai-lesson-start'));
    await waitFor(() => expect(screen.getByText(/something went wrong/i)).toBeInTheDocument());
  });
});

// ── Flag disabled: renders nothing ──────────────────────────────────────────

describe('<MathsAILesson />: flag disabled', () => {
  it('renders nothing when server returns { enabled: false }', async () => {
    mockDisabled();
    // tableNumber forces auto-start (progressive mode).
    const { container } = render(
      <MathsAILesson kidToken={KID_TOKEN} tableNumber={3} operation="multiplication" />,
    );
    await waitFor(() => expect(fetchMock).toHaveBeenCalled());
    // Component should return null when disabled.
    expect(container.firstChild).toBeNull();
  });
});
