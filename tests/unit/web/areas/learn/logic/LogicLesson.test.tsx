// FHS-395: LogicLesson unit tests.
// Covers: renders correct UI per type, submits answer, shows feedback +
// explanation, double-tap guard, certificate overlay on certificateEarned.

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor, fireEvent, act } from '@testing-library/react';
import { LogicLesson } from '../../../../../../src/areas/learn/logic/LogicLesson';

const fetchMock = vi.fn();
const KID_TOKEN = 'kid-logic-lesson-tok';

// ─── Mock factories ───────────────────────────────────────────────────────────

function makeTrueFalseQ() {
  return { id: 'q-tf', type: 'truefalse' as const, statement: 'The sky is blue.' };
}
function makePatternQ() {
  return {
    id: 'q-pat',
    type: 'patterns' as const,
    sequence: ['2', '4', '6', '?'],
    choices: ['7', '8', '9', '10'],
  };
}
function makeOddOneOutQ() {
  return {
    id: 'q-odd',
    type: 'oddoneout' as const,
    items: ['🍎', '🍊', '🚗', '🍋'],
  };
}
function makeIfThenQ() {
  return {
    id: 'q-if',
    type: 'ifthen' as const,
    premise: 'If all cats have tails, and Whiskers is a cat...',
    hint: 'Think about what all cats have.',
    choices: ['Whiskers has a tail', 'Whiskers has no tail', 'We cannot know'],
  };
}
function makeSortingQ() {
  return {
    id: 'q-sort',
    type: 'sorting' as const,
    item: '🦅 Eagle',
    groups: ['Bird', 'Mammal', 'Reptile', 'Fish'],
  };
}

function makeAnswerRes(
  overrides: Partial<{
    correct: boolean;
    correctAnswer: string | boolean;
    explanation: string;
    comboCorrect: number;
    certificateEarned: boolean;
  }> = {},
) {
  return {
    correct: true,
    correctAnswer: 'true',
    explanation: 'That is correct!',
    comboCorrect: 1,
    certificateEarned: false,
    ...overrides,
  };
}

function installFetch(questionData: unknown, answerRes: unknown = makeAnswerRes()) {
  fetchMock.mockImplementation((url: string, init?: RequestInit) => {
    const u = String(url);
    const method = (init as RequestInit | undefined)?.method ?? 'GET';
    if (u.includes('/api/kid/logic/questions')) {
      return Promise.resolve({
        ok: true,
        status: 200,
        json: async () => ({ questions: [questionData] }),
      });
    }
    if (u.includes('/api/kid/logic/answer') && method === 'POST') {
      return Promise.resolve({ ok: true, status: 200, json: async () => answerRes });
    }
    return Promise.resolve({ ok: false, status: 404, json: async () => ({}) });
  });
}

beforeEach(() => {
  fetchMock.mockReset();
  vi.stubGlobal('fetch', fetchMock);
});
afterEach(() => vi.unstubAllGlobals());

// ─── True/False renderer ──────────────────────────────────────────────────────

describe('LogicLesson: TrueFalse', () => {
  it('renders statement and True/False buttons', async () => {
    installFetch(makeTrueFalseQ());
    render(<LogicLesson kidToken={KID_TOKEN} gameType="truefalse" />);
    await waitFor(() => expect(screen.getByTestId('logic-choice-true')).toBeInTheDocument());
    expect(screen.getByTestId('logic-choice-false')).toBeInTheDocument();
    expect(screen.getByText('The sky is blue.')).toBeInTheDocument();
  });

  it('clicking True submits POST /api/kid/logic/answer and shows feedback', async () => {
    installFetch(
      makeTrueFalseQ(),
      makeAnswerRes({ correct: true, correctAnswer: true, explanation: 'Yes, the sky is blue.' }),
    );
    render(<LogicLesson kidToken={KID_TOKEN} gameType="truefalse" />);
    await waitFor(() => expect(screen.getByTestId('logic-choice-true')).toBeInTheDocument());
    await act(async () => {
      fireEvent.click(screen.getByTestId('logic-choice-true'));
    });
    await waitFor(() => expect(screen.getByTestId('logic-next-btn')).toBeInTheDocument());
    expect(screen.getByText('Yes, the sky is blue.')).toBeInTheDocument();
  });

  it('answer buttons are disabled after answering', async () => {
    installFetch(makeTrueFalseQ());
    render(<LogicLesson kidToken={KID_TOKEN} gameType="truefalse" />);
    await waitFor(() => expect(screen.getByTestId('logic-choice-true')).toBeInTheDocument());
    await act(async () => {
      fireEvent.click(screen.getByTestId('logic-choice-true'));
    });
    await waitFor(() => expect(screen.getByTestId('logic-next-btn')).toBeInTheDocument());
    expect(screen.getByTestId('logic-choice-true')).toBeDisabled();
    expect(screen.getByTestId('logic-choice-false')).toBeDisabled();
  });

  it('double-tap guard: clicking True twice only POSTs once', async () => {
    installFetch(makeTrueFalseQ());
    render(<LogicLesson kidToken={KID_TOKEN} gameType="truefalse" />);
    await waitFor(() => expect(screen.getByTestId('logic-choice-true')).toBeInTheDocument());
    await act(async () => {
      fireEvent.click(screen.getByTestId('logic-choice-true'));
      fireEvent.click(screen.getByTestId('logic-choice-true'));
    });
    await waitFor(() => expect(screen.getByTestId('logic-next-btn')).toBeInTheDocument());
    const postCalls = (fetchMock.mock.calls as [string, RequestInit][]).filter(
      ([url, init]) =>
        (url as string).includes('/api/kid/logic/answer') &&
        (init as RequestInit)?.method === 'POST',
    );
    expect(postCalls).toHaveLength(1);
  });

  it('shows certificate overlay when certificateEarned is true', async () => {
    installFetch(makeTrueFalseQ(), makeAnswerRes({ certificateEarned: true, comboCorrect: 10 }));
    render(<LogicLesson kidToken={KID_TOKEN} gameType="truefalse" />);
    await waitFor(() => expect(screen.getByTestId('logic-choice-true')).toBeInTheDocument());
    await act(async () => {
      fireEvent.click(screen.getByTestId('logic-choice-true'));
    });
    await waitFor(() =>
      expect(screen.getByTestId('logic-certificate-overlay')).toBeInTheDocument(),
    );
  });

  it('dismissing certificate overlay hides it', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    installFetch(makeTrueFalseQ(), makeAnswerRes({ certificateEarned: true, comboCorrect: 10 }));
    render(<LogicLesson kidToken={KID_TOKEN} gameType="truefalse" />);
    await waitFor(() => expect(screen.getByTestId('logic-choice-true')).toBeInTheDocument());
    await act(async () => {
      fireEvent.click(screen.getByTestId('logic-choice-true'));
    });
    await waitFor(() =>
      expect(screen.getByTestId('logic-certificate-overlay')).toBeInTheDocument(),
    );
    await act(async () => {
      fireEvent.click(screen.getByTestId('logic-cert-dismiss'));
    });
    expect(screen.queryByTestId('logic-certificate-overlay')).not.toBeInTheDocument();
    vi.useRealTimers();
  });

  it('Next Question button advances to a new question', async () => {
    const qs = [makeTrueFalseQ(), { ...makeTrueFalseQ(), id: 'q2', statement: 'Water is wet.' }];
    fetchMock.mockImplementation((url: string, init?: RequestInit) => {
      const u = String(url);
      const method = (init as RequestInit | undefined)?.method ?? 'GET';
      if (u.includes('/api/kid/logic/questions')) {
        return Promise.resolve({ ok: true, status: 200, json: async () => ({ questions: qs }) });
      }
      if (u.includes('/api/kid/logic/answer') && method === 'POST') {
        return Promise.resolve({ ok: true, status: 200, json: async () => makeAnswerRes() });
      }
      return Promise.resolve({ ok: false, status: 404, json: async () => ({}) });
    });
    render(<LogicLesson kidToken={KID_TOKEN} gameType="truefalse" />);
    await waitFor(() => expect(screen.getByTestId('logic-choice-true')).toBeInTheDocument());
    await act(async () => {
      fireEvent.click(screen.getByTestId('logic-choice-true'));
    });
    await waitFor(() => expect(screen.getByTestId('logic-next-btn')).toBeInTheDocument());
    await act(async () => {
      fireEvent.click(screen.getByTestId('logic-next-btn'));
    });
    // Buttons re-enabled for new question
    await waitFor(() => expect(screen.getByTestId('logic-choice-true')).not.toBeDisabled());
    expect(screen.queryByTestId('logic-next-btn')).not.toBeInTheDocument();
  });
});

// ─── Patterns renderer ────────────────────────────────────────────────────────

describe('LogicLesson: Patterns', () => {
  it('renders sequence boxes and choice buttons', async () => {
    installFetch(makePatternQ());
    render(<LogicLesson kidToken={KID_TOKEN} gameType="patterns" />);
    await waitFor(() => expect(screen.getByTestId('logic-choice-0')).toBeInTheDocument());
    expect(screen.getByTestId('logic-choice-1')).toBeInTheDocument();
    expect(screen.getByText('?')).toBeInTheDocument();
  });

  it('submits answer and shows explanation', async () => {
    installFetch(
      makePatternQ(),
      makeAnswerRes({ correct: true, correctAnswer: '8', explanation: 'Even numbers!' }),
    );
    render(<LogicLesson kidToken={KID_TOKEN} gameType="patterns" />);
    await waitFor(() => expect(screen.getByTestId('logic-choice-0')).toBeInTheDocument());
    await act(async () => {
      fireEvent.click(screen.getByTestId('logic-choice-0'));
    });
    await waitFor(() => expect(screen.getByTestId('logic-next-btn')).toBeInTheDocument());
    expect(screen.getByText('Even numbers!')).toBeInTheDocument();
  });

  it('double-tap guard: clicking choice-0 twice only POSTs once', async () => {
    installFetch(makePatternQ());
    render(<LogicLesson kidToken={KID_TOKEN} gameType="patterns" />);
    await waitFor(() => expect(screen.getByTestId('logic-choice-0')).toBeInTheDocument());
    await act(async () => {
      fireEvent.click(screen.getByTestId('logic-choice-0'));
      fireEvent.click(screen.getByTestId('logic-choice-0'));
    });
    await waitFor(() => expect(screen.getByTestId('logic-next-btn')).toBeInTheDocument());
    const postCalls = (fetchMock.mock.calls as [string, RequestInit][]).filter(
      ([url, init]) =>
        (url as string).includes('/api/kid/logic/answer') &&
        (init as RequestInit)?.method === 'POST',
    );
    expect(postCalls).toHaveLength(1);
  });
});

// ─── Odd One Out renderer ─────────────────────────────────────────────────────

describe('LogicLesson: OddOneOut', () => {
  it('renders items as tappable buttons', async () => {
    installFetch(makeOddOneOutQ());
    render(<LogicLesson kidToken={KID_TOKEN} gameType="oddoneout" />);
    await waitFor(() => expect(screen.getByTestId('logic-choice-0')).toBeInTheDocument());
    // 4 items
    expect(screen.getByTestId('logic-choice-1')).toBeInTheDocument();
    expect(screen.getByTestId('logic-choice-2')).toBeInTheDocument();
    expect(screen.getByTestId('logic-choice-3')).toBeInTheDocument();
  });

  it('submits answer and shows explanation', async () => {
    installFetch(
      makeOddOneOutQ(),
      makeAnswerRes({ correct: true, correctAnswer: '🚗', explanation: 'A car is not a fruit.' }),
    );
    render(<LogicLesson kidToken={KID_TOKEN} gameType="oddoneout" />);
    await waitFor(() => expect(screen.getByTestId('logic-choice-2')).toBeInTheDocument());
    await act(async () => {
      fireEvent.click(screen.getByTestId('logic-choice-2'));
    });
    await waitFor(() => expect(screen.getByTestId('logic-next-btn')).toBeInTheDocument());
    expect(screen.getByText('A car is not a fruit.')).toBeInTheDocument();
  });
});

// ─── If…Then renderer ─────────────────────────────────────────────────────────

describe('LogicLesson: IfThen', () => {
  it('renders premise and choice buttons', async () => {
    installFetch(makeIfThenQ());
    render(<LogicLesson kidToken={KID_TOKEN} gameType="ifthen" />);
    await waitFor(() => expect(screen.getByTestId('logic-clue-btn')).toBeInTheDocument());
    expect(screen.getByText(/If all cats have tails/)).toBeInTheDocument();
    expect(screen.getByTestId('logic-choice-0')).toBeInTheDocument();
  });

  it('hint button opens lightbox with hint text', async () => {
    installFetch(makeIfThenQ());
    render(<LogicLesson kidToken={KID_TOKEN} gameType="ifthen" />);
    await waitFor(() => expect(screen.getByTestId('logic-clue-btn')).toBeInTheDocument());
    await act(async () => {
      fireEvent.click(screen.getByTestId('logic-clue-btn'));
    });
    expect(screen.getByTestId('logic-clue-lightbox')).toBeInTheDocument();
    expect(screen.getByText('Think about what all cats have.')).toBeInTheDocument();
  });

  it('lightbox close button hides it', async () => {
    installFetch(makeIfThenQ());
    render(<LogicLesson kidToken={KID_TOKEN} gameType="ifthen" />);
    await waitFor(() => expect(screen.getByTestId('logic-clue-btn')).toBeInTheDocument());
    await act(async () => {
      fireEvent.click(screen.getByTestId('logic-clue-btn'));
    });
    expect(screen.getByTestId('logic-clue-lightbox')).toBeInTheDocument();
    await act(async () => {
      fireEvent.click(screen.getByTestId('logic-clue-lightbox-close'));
    });
    expect(screen.queryByTestId('logic-clue-lightbox')).not.toBeInTheDocument();
  });

  it('submits answer and shows explanation', async () => {
    installFetch(
      makeIfThenQ(),
      makeAnswerRes({
        correct: true,
        correctAnswer: 'Whiskers has a tail',
        explanation: 'All cats have tails.',
      }),
    );
    render(<LogicLesson kidToken={KID_TOKEN} gameType="ifthen" />);
    await waitFor(() => expect(screen.getByTestId('logic-choice-0')).toBeInTheDocument());
    await act(async () => {
      fireEvent.click(screen.getByTestId('logic-choice-0'));
    });
    await waitFor(() => expect(screen.getByTestId('logic-next-btn')).toBeInTheDocument());
    expect(screen.getByText('All cats have tails.')).toBeInTheDocument();
  });
});

// ─── Sorting renderer ─────────────────────────────────────────────────────────

describe('LogicLesson: Sorting', () => {
  it('renders item card and group buttons', async () => {
    installFetch(makeSortingQ());
    render(<LogicLesson kidToken={KID_TOKEN} gameType="sorting" />);
    await waitFor(() => expect(screen.getByTestId('logic-choice-0')).toBeInTheDocument());
    expect(screen.getByText('🦅 Eagle')).toBeInTheDocument();
    expect(screen.getByTestId('logic-choice-1')).toBeInTheDocument();
  });

  it('submits answer and shows explanation', async () => {
    installFetch(
      makeSortingQ(),
      makeAnswerRes({ correct: true, correctAnswer: 'Bird', explanation: 'Eagles are birds.' }),
    );
    render(<LogicLesson kidToken={KID_TOKEN} gameType="sorting" />);
    await waitFor(() => expect(screen.getByTestId('logic-choice-0')).toBeInTheDocument());
    await act(async () => {
      fireEvent.click(screen.getByTestId('logic-choice-0'));
    });
    await waitFor(() => expect(screen.getByTestId('logic-next-btn')).toBeInTheDocument());
    expect(screen.getByText('Eagles are birds.')).toBeInTheDocument();
  });
});

// ─── Difficulty selector ──────────────────────────────────────────────────────

describe('LogicLesson: difficulty selector', () => {
  it('renders easy/medium/hard buttons', async () => {
    installFetch(makeTrueFalseQ());
    render(<LogicLesson kidToken={KID_TOKEN} gameType="truefalse" />);
    await waitFor(() =>
      expect(screen.getByTestId('logic-difficulty-selector')).toBeInTheDocument(),
    );
    expect(screen.getByTestId('logic-diff-easy')).toBeInTheDocument();
    expect(screen.getByTestId('logic-diff-medium')).toBeInTheDocument();
    expect(screen.getByTestId('logic-diff-hard')).toBeInTheDocument();
  });

  it('easy is active by default (aria-pressed=true)', async () => {
    installFetch(makeTrueFalseQ());
    render(<LogicLesson kidToken={KID_TOKEN} gameType="truefalse" />);
    await waitFor(() => expect(screen.getByTestId('logic-diff-easy')).toBeInTheDocument());
    expect(screen.getByTestId('logic-diff-easy')).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByTestId('logic-diff-hard')).toHaveAttribute('aria-pressed', 'false');
  });

  it('clicking hard re-fetches questions for hard difficulty', async () => {
    installFetch(makeTrueFalseQ());
    render(<LogicLesson kidToken={KID_TOKEN} gameType="truefalse" />);
    await waitFor(() => expect(screen.getByTestId('logic-diff-hard')).toBeInTheDocument());
    await act(async () => {
      fireEvent.click(screen.getByTestId('logic-diff-hard'));
    });
    await waitFor(() => {
      const calls = fetchMock.mock.calls as [string][];
      const hardFetch = calls.find(([url]) => (url as string).includes('difficulty=hard'));
      expect(hardFetch).toBeTruthy();
    });
  });
});

// ─── Score bar ────────────────────────────────────────────────────────────────

describe('LogicLesson: score bar', () => {
  it('renders streak / best streak / score', async () => {
    installFetch(makeTrueFalseQ());
    render(<LogicLesson kidToken={KID_TOKEN} gameType="truefalse" />);
    await waitFor(() => expect(screen.getByTestId('logic-score-bar')).toBeInTheDocument());
    expect(screen.getByTestId('logic-streak')).toHaveTextContent('0');
    expect(screen.getByTestId('logic-best-streak')).toHaveTextContent('0');
    expect(screen.getByTestId('logic-score')).toHaveTextContent('0/0');
  });

  it('correct answer increments streak and score', async () => {
    installFetch(makeTrueFalseQ(), makeAnswerRes({ correct: true, correctAnswer: true }));
    render(<LogicLesson kidToken={KID_TOKEN} gameType="truefalse" />);
    await waitFor(() => expect(screen.getByTestId('logic-choice-true')).toBeInTheDocument());
    await act(async () => {
      fireEvent.click(screen.getByTestId('logic-choice-true'));
    });
    await waitFor(() => expect(screen.getByTestId('logic-next-btn')).toBeInTheDocument());
    expect(screen.getByTestId('logic-streak')).toHaveTextContent('1');
    expect(screen.getByTestId('logic-score')).toHaveTextContent('1/1');
  });

  it('wrong answer resets streak but increments attempted', async () => {
    installFetch(makeTrueFalseQ(), makeAnswerRes({ correct: false, correctAnswer: true }));
    render(<LogicLesson kidToken={KID_TOKEN} gameType="truefalse" />);
    await waitFor(() => expect(screen.getByTestId('logic-choice-false')).toBeInTheDocument());
    await act(async () => {
      fireEvent.click(screen.getByTestId('logic-choice-false'));
    });
    await waitFor(() => expect(screen.getByTestId('logic-next-btn')).toBeInTheDocument());
    expect(screen.getByTestId('logic-streak')).toHaveTextContent('0');
    expect(screen.getByTestId('logic-score')).toHaveTextContent('0/1');
  });
});

// ─── Certificate progress bar ─────────────────────────────────────────────────

describe('LogicLesson: certificate progress', () => {
  it('renders cert progress bar', async () => {
    installFetch(makeTrueFalseQ());
    render(<LogicLesson kidToken={KID_TOKEN} gameType="truefalse" />);
    await waitFor(() => expect(screen.getByTestId('logic-cert-progress')).toBeInTheDocument());
  });
});

// ─── Escape closes hint lightbox (Fix #1) ────────────────────────────────────

describe('LogicLesson: hint lightbox Escape key', () => {
  it('pressing Escape on the close button closes the hint dialog', async () => {
    installFetch(makeIfThenQ());
    render(<LogicLesson kidToken={KID_TOKEN} gameType="ifthen" />);
    await waitFor(() => expect(screen.getByTestId('logic-clue-btn')).toBeInTheDocument());
    await act(async () => {
      fireEvent.click(screen.getByTestId('logic-clue-btn'));
    });
    expect(screen.getByTestId('logic-clue-lightbox')).toBeInTheDocument();
    const closeBtn = screen.getByTestId('logic-clue-lightbox-close');
    await act(async () => {
      // Escape on the focused close button closes the lightbox
      fireEvent.keyDown(closeBtn, { key: 'Escape' });
    });
    expect(screen.queryByTestId('logic-clue-lightbox')).not.toBeInTheDocument();
  });
});

// ─── Fetch error → retry card (Fix #3) ───────────────────────────────────────

describe('LogicLesson: fetch error state', () => {
  it('shows retry card when GET /questions returns non-ok', async () => {
    fetchMock.mockResolvedValue({ ok: false, status: 500, json: async () => ({}) });
    render(<LogicLesson kidToken={KID_TOKEN} gameType="truefalse" />);
    await waitFor(() => expect(screen.getByTestId('logic-error-retry')).toBeInTheDocument());
    expect(screen.getByTestId('logic-retry-btn')).toBeInTheDocument();
  });
});

// ─── Sorting: only tapped wrong button goes red (Fix #4) ─────────────────────

describe('LogicLesson: SortingGame wrong selection highlight', () => {
  it('tapping wrong group only highlights that button red, not others', async () => {
    // groups: ['Bird','Mammal','Reptile','Fish']; correctAnswer is 'Bird' (index 0)
    installFetch(
      makeSortingQ(),
      makeAnswerRes({ correct: false, correctAnswer: 'Bird', explanation: 'Eagles are birds.' }),
    );
    render(<LogicLesson kidToken={KID_TOKEN} gameType="sorting" />);
    await waitFor(() => expect(screen.getByTestId('logic-choice-0')).toBeInTheDocument());
    await act(async () => {
      // Click 'Mammal' (index 1): wrong answer
      fireEvent.click(screen.getByTestId('logic-choice-1'));
    });
    await waitFor(() => expect(screen.getByTestId('logic-next-btn')).toBeInTheDocument());
    // Only index 1 should have red classes; index 2 ('Reptile') should not
    expect(screen.getByTestId('logic-choice-1').className).toContain('bg-red-400');
    expect(screen.getByTestId('logic-choice-2').className).not.toContain('bg-red-400');
  });
});

// ─── Certificate dismiss fires once, timer does not double-fire (Fix #5) ─────

describe('LogicLesson: CertificateOverlay one-shot dismiss', () => {
  it('clicking dismiss fires onDismiss exactly once even if clicked twice', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    installFetch(makeTrueFalseQ(), makeAnswerRes({ certificateEarned: true, comboCorrect: 10 }));
    render(<LogicLesson kidToken={KID_TOKEN} gameType="truefalse" />);
    await waitFor(() => expect(screen.getByTestId('logic-choice-true')).toBeInTheDocument());
    await act(async () => {
      fireEvent.click(screen.getByTestId('logic-choice-true'));
    });
    await waitFor(() =>
      expect(screen.getByTestId('logic-certificate-overlay')).toBeInTheDocument(),
    );
    const btn = screen.getByTestId('logic-cert-dismiss');
    await act(async () => {
      fireEvent.click(btn);
      fireEvent.click(btn);
    });
    // Overlay gone after first click
    expect(screen.queryByTestId('logic-certificate-overlay')).not.toBeInTheDocument();
    // Timer should not re-fire and cause a second state update after 6s
    await act(async () => {
      vi.advanceTimersByTime(7000);
    });
    // Still absent: no second fire
    expect(screen.queryByTestId('logic-certificate-overlay')).not.toBeInTheDocument();
    vi.useRealTimers();
  });
});

// ─── POST sends Authorization header (Fix #7) ────────────────────────────────

describe('LogicLesson: POST auth header', () => {
  it('POST /api/kid/logic/answer sends Authorization: Bearer <kidToken>', async () => {
    installFetch(makeTrueFalseQ());
    render(<LogicLesson kidToken={KID_TOKEN} gameType="truefalse" />);
    await waitFor(() => expect(screen.getByTestId('logic-choice-true')).toBeInTheDocument());
    await act(async () => {
      fireEvent.click(screen.getByTestId('logic-choice-true'));
    });
    await waitFor(() => expect(screen.getByTestId('logic-next-btn')).toBeInTheDocument());
    const calls = fetchMock.mock.calls as [string, RequestInit][];
    const postCall = calls.find(
      ([url, init]) =>
        (url as string).includes('/api/kid/logic/answer') &&
        (init as RequestInit)?.method === 'POST',
    );
    expect(postCall).toBeTruthy();
    expect((postCall![1] as RequestInit).headers).toMatchObject({
      Authorization: `Bearer ${KID_TOKEN}`,
    });
  });
});
