// FHS-394: MathsPlacementTest unit tests.
// Covers: intro screen, phase flow (intro → testing → results),
// correct/incorrect answer feedback, POST /api/kid/maths/placement,
// results grid colour coding, and onComplete callback.

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor, fireEvent, act } from '@testing-library/react';
import { MathsPlacementTest } from '../../../../../../src/areas/learn/maths/MathsPlacementTest';

const fetchMock = vi.fn();
const KID_TOKEN = 'kid-bearer-test';

// Build a placement POST response with a given unlocked array.
function mockPlacementPost(unlocked: number[] = [1, 2, 3]) {
  fetchMock.mockImplementation((url: string, init?: RequestInit) => {
    const method = (init as RequestInit | undefined)?.method ?? 'GET';
    if ((url as string).includes('/api/kid/maths/placement') && method === 'POST') {
      return Promise.resolve({ ok: true, status: 200, json: async () => ({ unlocked }) });
    }
    return Promise.resolve({ ok: false, status: 404, json: async () => ({}) });
  });
}

const onComplete = vi.fn();
const onBack = vi.fn();

beforeEach(() => {
  fetchMock.mockReset();
  onComplete.mockReset();
  onBack.mockReset();
  vi.stubGlobal('fetch', fetchMock);
  // Use fake timers with shouldAdvanceTime so waitFor polling still works.
  vi.useFakeTimers({ shouldAdvanceTime: true });
});
afterEach(() => {
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

// ─── Intro screen ─────────────────────────────────────────────────────────────

describe('MathsPlacementTest: intro screen', () => {
  it('renders the intro phase by default', () => {
    mockPlacementPost();
    render(
      <MathsPlacementTest
        kidToken={KID_TOKEN}
        operation="multiplication"
        onComplete={onComplete}
        onBack={onBack}
      />,
    );
    expect(screen.getByTestId('placement-test')).toBeInTheDocument();
    expect(screen.getByTestId('placement-begin')).toBeInTheDocument();
    expect(screen.getByText(/Quick Placement Test/i)).toBeInTheDocument();
  });

  it('calls onBack when the Back button is clicked on intro', () => {
    mockPlacementPost();
    render(
      <MathsPlacementTest
        kidToken={KID_TOKEN}
        operation="addition"
        onComplete={onComplete}
        onBack={onBack}
      />,
    );
    fireEvent.click(screen.getByRole('button', { name: /back/i }));
    expect(onBack).toHaveBeenCalledOnce();
  });

  it("clicking Let's Go! transitions to the testing phase", async () => {
    mockPlacementPost();
    render(
      <MathsPlacementTest
        kidToken={KID_TOKEN}
        operation="multiplication"
        onComplete={onComplete}
        onBack={onBack}
      />,
    );
    await act(async () => {
      fireEvent.click(screen.getByTestId('placement-begin'));
    });
    // Testing phase renders a progress bar and choice buttons
    await waitFor(() => expect(screen.getByRole('progressbar')).toBeInTheDocument());
    expect(screen.getByText(/Question 1 of 12/i)).toBeInTheDocument();
  });
});

// ─── Testing phase ────────────────────────────────────────────────────────────

describe('MathsPlacementTest: testing phase', () => {
  async function enterTestingPhase() {
    mockPlacementPost();
    render(
      <MathsPlacementTest
        kidToken={KID_TOKEN}
        operation="multiplication"
        onComplete={onComplete}
        onBack={onBack}
      />,
    );
    await act(async () => {
      fireEvent.click(screen.getByTestId('placement-begin'));
    });
    await waitFor(() => expect(screen.getByText(/Question 1 of 12/i)).toBeInTheDocument());
  }

  it('renders 4 choice buttons for the first question', async () => {
    await enterTestingPhase();
    const choices = screen.getAllByRole('button', { name: /Answer \d+/ });
    expect(choices).toHaveLength(4);
  });

  it('shows status feedback after any answer is chosen', async () => {
    await enterTestingPhase();
    const choices = screen.getAllByRole('button', { name: /Answer \d+/ });
    await act(async () => {
      fireEvent.click(choices[0]!);
    });
    await waitFor(() => expect(screen.getByRole('status')).toBeInTheDocument());
  });

  it('auto-advances after 800ms to the next question', async () => {
    await enterTestingPhase();
    const choices = screen.getAllByRole('button', { name: /Answer \d+/ });
    await act(async () => {
      fireEvent.click(choices[0]!);
    });
    // Advance fake timer past the 800ms auto-advance
    await act(async () => {
      vi.advanceTimersByTime(900);
    });
    await waitFor(() => expect(screen.getByText(/Question 2 of 12/i)).toBeInTheDocument());
  });
});

// ─── Results phase (POST + onComplete) ───────────────────────────────────────

// Helper: answer all 12 questions and wait for the placement POST.
async function answerAll12() {
  await act(async () => {
    fireEvent.click(screen.getByTestId('placement-begin'));
  });
  await waitFor(() => expect(screen.getByText(/Question 1 of 12/i)).toBeInTheDocument());

  for (let q = 0; q < 12; q++) {
    await waitFor(() =>
      expect(screen.getAllByRole('button', { name: /Answer \d+/ }).length).toBeGreaterThan(0),
    );
    await act(async () => {
      fireEvent.click(screen.getAllByRole('button', { name: /Answer \d+/ })[0]!);
    });
    await act(async () => {
      vi.advanceTimersByTime(900);
    });
  }
}

describe('MathsPlacementTest: results phase', () => {
  it('POSTs to /api/kid/maths/placement after all 12 questions', async () => {
    mockPlacementPost([1, 2]);
    render(
      <MathsPlacementTest
        kidToken={KID_TOKEN}
        operation="addition"
        onComplete={onComplete}
        onBack={onBack}
      />,
    );
    await answerAll12();

    await waitFor(() => {
      const calls = fetchMock.mock.calls as [string, RequestInit][];
      expect(
        calls.find(
          ([url, init]) =>
            (url as string).includes('/api/kid/maths/placement') &&
            (init as RequestInit)?.method === 'POST',
        ),
      ).toBeTruthy();
    });
  });

  it('sends the Bearer token in the placement POST', async () => {
    mockPlacementPost([]);
    render(
      <MathsPlacementTest
        kidToken={KID_TOKEN}
        operation="addition"
        onComplete={onComplete}
        onBack={onBack}
      />,
    );
    await answerAll12();

    await waitFor(() => {
      const calls = fetchMock.mock.calls as [string, RequestInit][];
      const postCall = calls.find(
        ([url, init]) =>
          (url as string).includes('/api/kid/maths/placement') &&
          (init as RequestInit)?.method === 'POST',
      );
      expect(postCall).toBeTruthy();
      const [, init] = postCall!;
      expect((init as RequestInit).headers).toMatchObject({
        Authorization: `Bearer ${KID_TOKEN}`,
      });
    });
  });

  it('shows the results screen with the Continue button', async () => {
    mockPlacementPost([1, 2, 3]);
    render(
      <MathsPlacementTest
        kidToken={KID_TOKEN}
        operation="multiplication"
        onComplete={onComplete}
        onBack={onBack}
      />,
    );
    await answerAll12();

    await waitFor(() => expect(screen.getByTestId('placement-done')).toBeInTheDocument());
    expect(screen.getByText(/You got \d+\/12 correct/i)).toBeInTheDocument();
  });

  it('clicking Continue calls onComplete (parent re-fetches; no args passed)', async () => {
    mockPlacementPost([1, 2, 3, 4]);
    render(
      <MathsPlacementTest
        kidToken={KID_TOKEN}
        operation="multiplication"
        onComplete={onComplete}
        onBack={onBack}
      />,
    );
    await answerAll12();

    await waitFor(() => expect(screen.getByTestId('placement-done')).toBeInTheDocument());
    await act(async () => {
      fireEvent.click(screen.getByTestId('placement-done'));
    });
    expect(onComplete).toHaveBeenCalledOnce();
  });

  it('ignores a rapid double-tap: records exactly one answer per question (FHS-394)', async () => {
    // Capture the placement POST body so we can assert no duplicate result rows.
    let postedResults: unknown[] = [];
    fetchMock.mockImplementation((url: string, init?: RequestInit) => {
      const method = (init as RequestInit | undefined)?.method ?? 'GET';
      if ((url as string).includes('/api/kid/maths/placement') && method === 'POST') {
        postedResults = JSON.parse((init as RequestInit).body as string).results;
        return Promise.resolve({ ok: true, status: 200, json: async () => ({ unlocked: [] }) });
      }
      return Promise.resolve({ ok: false, status: 404, json: async () => ({}) });
    });
    render(
      <MathsPlacementTest
        kidToken={KID_TOKEN}
        operation="addition"
        onComplete={onComplete}
        onBack={onBack}
      />,
    );
    await act(async () => {
      fireEvent.click(screen.getByTestId('placement-begin'));
    });
    for (let q = 0; q < 12; q++) {
      await waitFor(() =>
        expect(screen.getAllByRole('button', { name: /Answer \d+/ }).length).toBeGreaterThan(0),
      );
      const choices = screen.getAllByRole('button', { name: /Answer \d+/ });
      // Double-tap: two synchronous taps on the same question.
      await act(async () => {
        fireEvent.click(choices[0]!);
        fireEvent.click(choices[1]!);
      });
      await act(async () => {
        vi.advanceTimersByTime(900);
      });
    }
    // Despite a double-tap on every question, exactly 12 results are recorded.
    await waitFor(() => expect(postedResults).toHaveLength(12));
  });
});
