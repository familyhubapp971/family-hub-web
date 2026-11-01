// FHS-395: LogicSubject unit tests.
// Covers: game-type switching, trophy toggle, difficulty selector wiring.

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor, fireEvent, act } from '@testing-library/react';
import { LogicSubject } from '../../../../../../src/areas/learn/logic/LogicSubject';

const fetchMock = vi.fn();
const KID_TOKEN = 'kid-logic-subject-tok';

// URL-keyed fetch mock
function installFetch(overrides: Record<string, unknown> = {}) {
  fetchMock.mockImplementation((url: string, init?: RequestInit) => {
    const u = String(url);
    const method = (init as RequestInit | undefined)?.method ?? 'GET';

    if (u.includes('/api/kid/logic/answer') && method === 'POST') {
      const r = overrides['answer'] ?? {
        correct: true,
        correctAnswer: 'true',
        explanation: 'Correct!',
        comboCorrect: 1,
        certificateEarned: false,
      };
      return Promise.resolve({ ok: true, status: 200, json: async () => r });
    }
    if (u.includes('/api/kid/logic/certificates')) {
      const r = overrides['certificates'] ?? { certificates: [] };
      return Promise.resolve({ ok: true, status: 200, json: async () => r });
    }
    if (u.includes('/api/kid/logic/questions')) {
      const r = overrides['questions'] ?? {
        questions: [
          {
            id: 'q1',
            type: 'truefalse',
            statement: 'The sky is blue.',
          },
        ],
      };
      return Promise.resolve({ ok: true, status: 200, json: async () => r });
    }
    return Promise.resolve({ ok: false, status: 404, json: async () => ({}) });
  });
}

beforeEach(() => {
  fetchMock.mockReset();
  vi.stubGlobal('fetch', fetchMock);
});
afterEach(() => vi.unstubAllGlobals());

// ─── Game type switching ──────────────────────────────────────────────────────

describe('LogicSubject: game type switching', () => {
  it('renders all five game type buttons', async () => {
    installFetch();
    render(<LogicSubject kidToken={KID_TOKEN} />);
    await waitFor(() => expect(screen.getByTestId('logic-game-selector')).toBeInTheDocument());
    expect(screen.getByTestId('logic-game-truefalse')).toBeInTheDocument();
    expect(screen.getByTestId('logic-game-patterns')).toBeInTheDocument();
    expect(screen.getByTestId('logic-game-oddoneout')).toBeInTheDocument();
    expect(screen.getByTestId('logic-game-ifthen')).toBeInTheDocument();
    expect(screen.getByTestId('logic-game-sorting')).toBeInTheDocument();
  });

  it('truefalse is active (aria-pressed=true) by default', async () => {
    installFetch();
    render(<LogicSubject kidToken={KID_TOKEN} />);
    await waitFor(() => expect(screen.getByTestId('logic-game-truefalse')).toBeInTheDocument());
    expect(screen.getByTestId('logic-game-truefalse')).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByTestId('logic-game-patterns')).toHaveAttribute('aria-pressed', 'false');
  });

  it('clicking patterns sets it as active', async () => {
    installFetch();
    render(<LogicSubject kidToken={KID_TOKEN} />);
    await waitFor(() => expect(screen.getByTestId('logic-game-patterns')).toBeInTheDocument());
    await act(async () => {
      fireEvent.click(screen.getByTestId('logic-game-patterns'));
    });
    expect(screen.getByTestId('logic-game-patterns')).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByTestId('logic-game-truefalse')).toHaveAttribute('aria-pressed', 'false');
  });

  it('switching game type closes certificates view and shows lesson', async () => {
    installFetch();
    render(<LogicSubject kidToken={KID_TOKEN} />);
    await waitFor(() => expect(screen.getByTestId('logic-subject')).toBeInTheDocument());

    // Open certificates
    await act(async () => {
      fireEvent.click(screen.getByTestId('logic-trophy-toggle'));
    });
    expect(screen.getByTestId('logic-certificates')).toBeInTheDocument();

    // Switch game type: should close certificates
    await act(async () => {
      fireEvent.click(screen.getByTestId('logic-game-patterns'));
    });
    await waitFor(() => expect(screen.queryByTestId('logic-certificates')).not.toBeInTheDocument());
    expect(screen.getByTestId('logic-lesson')).toBeInTheDocument();
  });

  it('lesson view is shown initially', async () => {
    installFetch();
    render(<LogicSubject kidToken={KID_TOKEN} />);
    await waitFor(() => expect(screen.getByTestId('logic-lesson')).toBeInTheDocument());
  });
});

// ─── Trophy toggle ────────────────────────────────────────────────────────────

describe('LogicSubject: trophy toggle', () => {
  it('clicking trophy shows LogicCertificates', async () => {
    installFetch();
    render(<LogicSubject kidToken={KID_TOKEN} />);
    await waitFor(() => expect(screen.getByTestId('logic-subject')).toBeInTheDocument());
    await act(async () => {
      fireEvent.click(screen.getByTestId('logic-trophy-toggle'));
    });
    await waitFor(() => expect(screen.getByTestId('logic-certificates')).toBeInTheDocument());
    expect(screen.queryByTestId('logic-lesson')).not.toBeInTheDocument();
  });

  it('clicking trophy again returns to lesson view', async () => {
    installFetch();
    render(<LogicSubject kidToken={KID_TOKEN} />);
    await waitFor(() => expect(screen.getByTestId('logic-subject')).toBeInTheDocument());
    await act(async () => {
      fireEvent.click(screen.getByTestId('logic-trophy-toggle'));
    });
    expect(screen.getByTestId('logic-certificates')).toBeInTheDocument();
    await act(async () => {
      fireEvent.click(screen.getByTestId('logic-trophy-toggle'));
    });
    await waitFor(() => expect(screen.queryByTestId('logic-certificates')).not.toBeInTheDocument());
    expect(screen.getByTestId('logic-lesson')).toBeInTheDocument();
  });

  it('trophy has aria-pressed=true when certificates is shown', async () => {
    installFetch();
    render(<LogicSubject kidToken={KID_TOKEN} />);
    await waitFor(() => expect(screen.getByTestId('logic-subject')).toBeInTheDocument());
    const trophy = screen.getByTestId('logic-trophy-toggle');
    expect(trophy).toHaveAttribute('aria-pressed', 'false');
    await act(async () => {
      fireEvent.click(trophy);
    });
    expect(trophy).toHaveAttribute('aria-pressed', 'true');
  });

  it('game buttons show aria-pressed=false when certificates view is active', async () => {
    installFetch();
    render(<LogicSubject kidToken={KID_TOKEN} />);
    await waitFor(() => expect(screen.getByTestId('logic-subject')).toBeInTheDocument());
    await act(async () => {
      fireEvent.click(screen.getByTestId('logic-trophy-toggle'));
    });
    // All game buttons should be aria-pressed=false when in certificates view
    expect(screen.getByTestId('logic-game-truefalse')).toHaveAttribute('aria-pressed', 'false');
    expect(screen.getByTestId('logic-game-patterns')).toHaveAttribute('aria-pressed', 'false');
  });
});

// ─── Certificates GET ─────────────────────────────────────────────────────────

describe('LogicSubject: certificates API call', () => {
  it('GET /api/kid/logic/certificates is called with kidToken when trophy is clicked', async () => {
    installFetch({ certificates: { certificates: [] } });
    render(<LogicSubject kidToken={KID_TOKEN} />);
    await waitFor(() => expect(screen.getByTestId('logic-subject')).toBeInTheDocument());
    await act(async () => {
      fireEvent.click(screen.getByTestId('logic-trophy-toggle'));
    });
    await waitFor(() => expect(screen.getByTestId('logic-certificates')).toBeInTheDocument());
    const calls = fetchMock.mock.calls as [string, RequestInit][];
    const certGet = calls.find(
      ([url, init]) =>
        (url as string).includes('/api/kid/logic/certificates') &&
        ((init as RequestInit)?.method ?? 'GET') === 'GET',
    );
    expect(certGet).toBeTruthy();
    expect((certGet![1] as RequestInit)?.headers).toMatchObject({
      Authorization: `Bearer ${KID_TOKEN}`,
    });
  });
});
