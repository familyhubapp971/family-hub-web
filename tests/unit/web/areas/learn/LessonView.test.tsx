import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor, fireEvent, act } from '@testing-library/react';
import { LessonView } from '../../../../../src/areas/learn/LessonView';

// FHS-283: the interactive lesson UI: renders questions, grades a pick via the
// API, shows feedback + a Next button, and reveals a certificate at 100%.
//
// FHS-397: design parity + reviewer fixes:
//   • cert modal fires only on not-certified → certified transition (not on mount if already certified)
//   • streak overlay fires only on in-session crossings (not on mount for pre-existing streak)
//   • cert timer fires once (stable [] deps, not [onDismiss])
//   • subject-neutral streak messages (no "Maths Wizard" for Science)
//   • shake timer cleaned up; redundant encouragement state removed

const fetchMock = vi.fn();
const HEADERS = { Authorization: 'Bearer tok', 'x-tenant-slug': 'khan' };
const MEMBER = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc';

const QUESTION = {
  id: 'q1',
  prompt: '2 + 2 = ?',
  choices: ['3', '4', '5'],
};

function makeStats(
  overrides: Partial<{
    progress: number;
    score: number;
    streak: number;
    best: number;
    answered: number;
    certificate: boolean;
  }> = {},
) {
  return {
    progress: 0,
    score: 0,
    streak: 0,
    best: 0,
    answered: 0,
    certificate: false,
    ...overrides,
  };
}

// URL-keyed mock: GET → questions with zero stats, POST → answer.
function installApi(answer: { correct: boolean; answerIndex: number; stats: object }) {
  fetchMock.mockImplementation((url: string, init?: { method?: string }) => {
    if (init?.method === 'POST') {
      return Promise.resolve({ ok: true, status: 200, json: async () => answer });
    }
    return Promise.resolve({
      ok: true,
      status: 200,
      json: async () => ({
        subject: 'Maths',
        difficulty: 'easy',
        questions: [QUESTION],
        stats: makeStats(),
      }),
    });
  });
}

// GET returns questions with the given initial stats; POST returns the answer.
function installWithInitialStats(
  initialStats: ReturnType<typeof makeStats>,
  answer: { correct: boolean; answerIndex: number; stats: object },
) {
  fetchMock.mockImplementation((url: string, init?: { method?: string }) => {
    if (init?.method === 'POST') {
      return Promise.resolve({ ok: true, status: 200, json: async () => answer });
    }
    return Promise.resolve({
      ok: true,
      status: 200,
      json: async () => ({
        subject: 'Science',
        difficulty: 'easy',
        questions: [QUESTION],
        stats: initialStats,
      }),
    });
  });
}

beforeEach(() => {
  fetchMock.mockReset();
  vi.stubGlobal('fetch', fetchMock);
  vi.useFakeTimers({ shouldAdvanceTime: true });
});
afterEach(() => {
  vi.runAllTimers();
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

// ─── Baseline behaviour ───────────────────────────────────────────────────────

describe('<LessonView />', () => {
  it('renders the question, choices, difficulty pills and stats', async () => {
    installApi({ correct: true, answerIndex: 1, stats: makeStats() });
    render(<LessonView subject="Maths" memberId={MEMBER} headers={HEADERS} />);
    await waitFor(() => expect(screen.getByTestId('lesson-question')).toBeInTheDocument());
    expect(screen.getByText('2 + 2 = ?')).toBeInTheDocument();
    expect(screen.getByTestId('lesson-difficulty-hard')).toBeInTheDocument();
    expect(screen.getByTestId('lesson-stat-streak')).toBeInTheDocument();
  });

  it('does NOT render sub-topic pills for a non-Logic subject (Maths)', async () => {
    installApi({ correct: true, answerIndex: 1, stats: makeStats() });
    render(<LessonView subject="Maths" memberId={MEMBER} headers={HEADERS} />);
    await waitFor(() => expect(screen.getByTestId('lesson-question')).toBeInTheDocument());
    expect(screen.queryByTestId('lesson-subtopic-patterns')).not.toBeInTheDocument();
  });

  it('renders all 4 Logic sub-topic pills when subject is Logic', async () => {
    installApi({ correct: true, answerIndex: 1, stats: makeStats() });
    render(<LessonView subject="Logic" memberId={MEMBER} headers={HEADERS} />);
    await waitFor(() => expect(screen.getByTestId('lesson-question')).toBeInTheDocument());
    expect(screen.getByTestId('lesson-subtopic-patterns')).toBeInTheDocument();
    expect(screen.getByTestId('lesson-subtopic-odd-one-out')).toBeInTheDocument();
    expect(screen.getByTestId('lesson-subtopic-if-then')).toBeInTheDocument();
    expect(screen.getByTestId('lesson-subtopic-sorting')).toBeInTheDocument();
  });

  it('patterns pill is active by default (aria-pressed=true)', async () => {
    installApi({ correct: true, answerIndex: 1, stats: makeStats() });
    render(<LessonView subject="Logic" memberId={MEMBER} headers={HEADERS} />);
    await waitFor(() => expect(screen.getByTestId('lesson-subtopic-patterns')).toBeInTheDocument());
    expect(screen.getByTestId('lesson-subtopic-patterns')).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByTestId('lesson-subtopic-sorting')).toHaveAttribute('aria-pressed', 'false');
  });

  it('selecting a sub-topic refetches with subtopic= in the URL', async () => {
    installApi({ correct: true, answerIndex: 1, stats: makeStats() });
    render(<LessonView subject="Logic" memberId={MEMBER} headers={HEADERS} />);
    await waitFor(() => expect(screen.getByTestId('lesson-subtopic-sorting')).toBeInTheDocument());

    fetchMock.mockClear();

    await act(async () => {
      fireEvent.click(screen.getByTestId('lesson-subtopic-sorting'));
    });

    await waitFor(() => {
      const calls = fetchMock.mock.calls as [string][];
      const refetch = calls.find(([url]) => String(url).includes('subtopic=sorting'));
      expect(refetch).toBeTruthy();
    });
  });

  it('grades a correct pick, shows Correct feedback + Next, and updates the score', async () => {
    installApi({
      correct: true,
      answerIndex: 1,
      stats: makeStats({ progress: 10, score: 1, streak: 1, best: 1, answered: 1 }),
    });
    render(<LessonView subject="Maths" memberId={MEMBER} headers={HEADERS} />);
    await waitFor(() => expect(screen.getByTestId('lesson-question')).toBeInTheDocument());
    await act(async () => {
      fireEvent.click(screen.getByTestId('lesson-choice-1'));
    });
    await waitFor(() =>
      expect(screen.getByTestId('lesson-feedback').textContent).toMatch(/Correct/),
    );
    expect(screen.getByTestId('lesson-next')).toBeInTheDocument();
    expect(screen.getByTestId('lesson-stat-score').textContent).toContain('1');
  });

  it('recovers when the answer POST fails: re-enables choices + shows an error', async () => {
    fetchMock.mockImplementation((url: string, init?: { method?: string }) => {
      if (init?.method === 'POST') {
        return Promise.resolve({ ok: false, status: 500, json: async () => ({}) });
      }
      return Promise.resolve({
        ok: true,
        status: 200,
        json: async () => ({
          subject: 'Maths',
          difficulty: 'easy',
          questions: [QUESTION],
          stats: makeStats(),
        }),
      });
    });
    render(<LessonView subject="Maths" memberId={MEMBER} headers={HEADERS} />);
    await waitFor(() => expect(screen.getByTestId('lesson-question')).toBeInTheDocument());
    await act(async () => {
      fireEvent.click(screen.getByTestId('lesson-choice-1'));
    });
    await waitFor(() => expect(screen.getByTestId('lesson-pick-error')).toBeInTheDocument());
    // Choices are tappable again (not frozen).
    expect((screen.getByTestId('lesson-choice-0') as HTMLButtonElement).disabled).toBe(false);
  });
});

// ─── FHS-397: wrong-answer reveal ────────────────────────────────────────────

describe('FHS-397: wrong-answer reveal', () => {
  it('shows encouragement text + reveals the correct answer', async () => {
    // answerIndex: 2 = '5' is correct. Kid picks 0 ('3').
    installApi({ correct: false, answerIndex: 2, stats: makeStats() });
    render(<LessonView subject="Science" memberId={MEMBER} headers={HEADERS} />);
    await waitFor(() => expect(screen.getByTestId('lesson-question')).toBeInTheDocument());

    await act(async () => {
      fireEvent.click(screen.getByTestId('lesson-choice-0'));
    });

    await waitFor(() => expect(screen.getByTestId('lesson-feedback')).toBeInTheDocument());
    // Correct answer revealed (choice at answerIndex 2 = '5').
    expect(screen.getByTestId('lesson-correct-answer').textContent).toBe('5');
    // An encouragement phrase is shown.
    const encouragements = [
      'Try again!',
      'Almost!',
      'Keep going!',
      'You can do it!',
      'Don’t give up!',
    ];
    const feedbackText = screen.getByTestId('lesson-feedback').textContent ?? '';
    expect(encouragements.some((e) => feedbackText.includes(e))).toBe(true);
  });

  it('correct answer does NOT show the correct-answer reveal', async () => {
    installApi({ correct: true, answerIndex: 1, stats: makeStats() });
    render(<LessonView subject="Maths" memberId={MEMBER} headers={HEADERS} />);
    await waitFor(() => expect(screen.getByTestId('lesson-question')).toBeInTheDocument());

    await act(async () => {
      fireEvent.click(screen.getByTestId('lesson-choice-1'));
    });

    await waitFor(() => expect(screen.getByTestId('lesson-feedback')).toBeInTheDocument());
    expect(screen.queryByTestId('lesson-correct-answer')).not.toBeInTheDocument();
  });
});

// ─── FHS-397: certificate modal ──────────────────────────────────────────────

describe('FHS-397: certificate modal', () => {
  it('shows the inline certificate banner when stats.certificate is true', async () => {
    installApi({
      correct: true,
      answerIndex: 1,
      stats: makeStats({
        progress: 100,
        score: 10,
        streak: 10,
        best: 10,
        answered: 10,
        certificate: true,
      }),
    });
    render(<LessonView subject="Maths" memberId={MEMBER} headers={HEADERS} />);
    await waitFor(() => expect(screen.getByTestId('lesson-question')).toBeInTheDocument());
    await act(async () => {
      fireEvent.click(screen.getByTestId('lesson-choice-1'));
    });
    await waitFor(() => expect(screen.getByTestId('lesson-certificate')).toBeInTheDocument());
    expect(screen.getByTestId('lesson-progress-pct').textContent).toContain('100');
  });

  it('cert modal appears once when stats.certificate flips true in-session', async () => {
    // Initial GET: certificate: false. POST: certificate: true.
    installWithInitialStats(makeStats({ progress: 90 }), {
      correct: true,
      answerIndex: 1,
      stats: makeStats({ progress: 100, certificate: true }),
    });
    render(<LessonView subject="Science" memberId={MEMBER} headers={HEADERS} />);
    await waitFor(() => expect(screen.getByTestId('lesson-question')).toBeInTheDocument());

    await act(async () => {
      fireEvent.click(screen.getByTestId('lesson-choice-1'));
    });

    await waitFor(() => expect(screen.getByTestId('lesson-certificate-modal')).toBeInTheDocument());
  });

  // BLOCKING fix #1: pre-existing cert must NOT pop the modal on mount.
  it('does NOT show cert modal when initial GET already returns certificate: true', async () => {
    installWithInitialStats(makeStats({ progress: 100, certificate: true }), {
      correct: true,
      answerIndex: 1,
      stats: makeStats({ progress: 100, certificate: true }),
    });
    render(<LessonView subject="Science" memberId={MEMBER} headers={HEADERS} />);
    await waitFor(() => expect(screen.getByTestId('lesson-question')).toBeInTheDocument());
    // Give any spurious effects time to fire.
    await act(async () => {
      vi.advanceTimersByTime(100);
    });
    expect(screen.queryByTestId('lesson-certificate-modal')).not.toBeInTheDocument();
  });

  it('cert modal dismiss button closes the modal', async () => {
    installWithInitialStats(makeStats({ progress: 90 }), {
      correct: true,
      answerIndex: 1,
      stats: makeStats({ progress: 100, certificate: true }),
    });
    render(<LessonView subject="Science" memberId={MEMBER} headers={HEADERS} />);
    await waitFor(() => expect(screen.getByTestId('lesson-question')).toBeInTheDocument());

    await act(async () => {
      fireEvent.click(screen.getByTestId('lesson-choice-1'));
    });
    await waitFor(() => expect(screen.getByTestId('lesson-certificate-modal')).toBeInTheDocument());

    await act(async () => {
      fireEvent.click(screen.getByTestId('lesson-cert-dismiss'));
    });

    expect(screen.queryByTestId('lesson-certificate-modal')).not.toBeInTheDocument();
  });

  // BLOCKING fix #3: timer fires exactly once (stable [] deps on CertificateModal).
  it('cert modal auto-dismisses after 6 s (timer not reset by parent re-renders)', async () => {
    installWithInitialStats(makeStats({ progress: 90 }), {
      correct: true,
      answerIndex: 1,
      stats: makeStats({ progress: 100, certificate: true }),
    });
    render(<LessonView subject="Science" memberId={MEMBER} headers={HEADERS} />);
    await waitFor(() => expect(screen.getByTestId('lesson-question')).toBeInTheDocument());

    await act(async () => {
      fireEvent.click(screen.getByTestId('lesson-choice-1'));
    });
    await waitFor(() => expect(screen.getByTestId('lesson-certificate-modal')).toBeInTheDocument());

    await act(async () => {
      vi.advanceTimersByTime(6100);
    });

    expect(screen.queryByTestId('lesson-certificate-modal')).not.toBeInTheDocument();
  });

  it('cert modal does NOT reappear on a subsequent correct answer (guard holds)', async () => {
    let callCount = 0;
    fetchMock.mockImplementation((url: string, init?: { method?: string }) => {
      if (init?.method === 'POST') {
        callCount++;
        return Promise.resolve({
          ok: true,
          status: 200,
          json: async () => ({
            correct: true,
            answerIndex: 1,
            stats: makeStats({ progress: 100, certificate: true }),
          }),
        });
      }
      return Promise.resolve({
        ok: true,
        status: 200,
        json: async () => ({
          subject: 'Science',
          difficulty: 'easy',
          questions: [QUESTION],
          stats: makeStats({ progress: 90 }),
        }),
      });
    });

    render(<LessonView subject="Science" memberId={MEMBER} headers={HEADERS} />);
    await waitFor(() => expect(screen.getByTestId('lesson-question')).toBeInTheDocument());

    // First answer: modal appears.
    await act(async () => {
      fireEvent.click(screen.getByTestId('lesson-choice-1'));
    });
    await waitFor(() => expect(screen.getByTestId('lesson-certificate-modal')).toBeInTheDocument());
    // Dismiss.
    await act(async () => {
      fireEvent.click(screen.getByTestId('lesson-cert-dismiss'));
    });
    expect(screen.queryByTestId('lesson-certificate-modal')).not.toBeInTheDocument();

    // Next question.
    await act(async () => {
      fireEvent.click(screen.getByTestId('lesson-next'));
    });
    await waitFor(() => expect(screen.getByTestId('lesson-question')).toBeInTheDocument());

    // Second answer: modal must NOT reappear.
    await act(async () => {
      fireEvent.click(screen.getByTestId('lesson-choice-1'));
    });
    await waitFor(() => expect(callCount).toBeGreaterThanOrEqual(2));
    expect(screen.queryByTestId('lesson-certificate-modal')).not.toBeInTheDocument();
  });
});

// ─── FHS-397: streak overlay ─────────────────────────────────────────────────

describe('FHS-397: streak overlay', () => {
  it('streak overlay appears at the streak-3 milestone (in-session crossing)', async () => {
    // Initial streak 0, answer bumps to 3.
    installWithInitialStats(makeStats({ streak: 0 }), {
      correct: true,
      answerIndex: 1,
      stats: makeStats({ streak: 3 }),
    });
    render(<LessonView subject="Science" memberId={MEMBER} headers={HEADERS} />);
    await waitFor(() => expect(screen.getByTestId('lesson-question')).toBeInTheDocument());

    await act(async () => {
      fireEvent.click(screen.getByTestId('lesson-choice-1'));
    });

    await waitFor(() => expect(screen.getByTestId('lesson-streak-overlay')).toBeInTheDocument());
    expect(screen.getByTestId('lesson-streak-overlay').textContent).toContain('On fire');
  });

  // BLOCKING fix #2: pre-existing streak must NOT fire the overlay on mount.
  it('does NOT show streak overlay when initial GET already returns streak >= milestone', async () => {
    installWithInitialStats(makeStats({ streak: 5 }), {
      correct: true,
      answerIndex: 1,
      stats: makeStats({ streak: 5 }),
    });
    render(<LessonView subject="Science" memberId={MEMBER} headers={HEADERS} />);
    await waitFor(() => expect(screen.getByTestId('lesson-question')).toBeInTheDocument());
    // Give any spurious effects time to fire.
    await act(async () => {
      vi.advanceTimersByTime(100);
    });
    expect(screen.queryByTestId('lesson-streak-overlay')).not.toBeInTheDocument();
  });

  it('streak overlay auto-dismisses after 2 s', async () => {
    installWithInitialStats(makeStats({ streak: 0 }), {
      correct: true,
      answerIndex: 1,
      stats: makeStats({ streak: 3 }),
    });
    render(<LessonView subject="Science" memberId={MEMBER} headers={HEADERS} />);
    await waitFor(() => expect(screen.getByTestId('lesson-question')).toBeInTheDocument());

    await act(async () => {
      fireEvent.click(screen.getByTestId('lesson-choice-1'));
    });
    await waitFor(() => expect(screen.getByTestId('lesson-streak-overlay')).toBeInTheDocument());

    await act(async () => {
      vi.advanceTimersByTime(2100);
    });

    expect(screen.queryByTestId('lesson-streak-overlay')).not.toBeInTheDocument();
  });

  // BLOCKING fix #4: subject-neutral streak messages.
  it('streak-10 message does not contain "Maths" (subject-neutral for Science)', async () => {
    // Seed initial streak at 9 so milestones 3+5 are already celebrated;
    // only the 10 crossing is new this session.
    installWithInitialStats(makeStats({ streak: 9 }), {
      correct: true,
      answerIndex: 1,
      stats: makeStats({ streak: 10 }),
    });
    render(<LessonView subject="Science" memberId={MEMBER} headers={HEADERS} />);
    await waitFor(() => expect(screen.getByTestId('lesson-question')).toBeInTheDocument());

    await act(async () => {
      fireEvent.click(screen.getByTestId('lesson-choice-1'));
    });

    await waitFor(() => expect(screen.getByTestId('lesson-streak-overlay')).toBeInTheDocument());
    expect(screen.getByTestId('lesson-streak-overlay').textContent).not.toContain('Maths');
    expect(screen.getByTestId('lesson-streak-overlay').textContent).toContain('Wizard');
  });
});
