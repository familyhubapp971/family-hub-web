// FHS-395: LogicCertificates unit tests.
// Covers: earned vs locked cards, empty state, progress bar, API call.

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { LogicCertificates } from '../../../../../../src/areas/learn/logic/LogicCertificates';

const fetchMock = vi.fn();
const KID_TOKEN = 'kid-logic-certs-tok';

function installFetch(certificates: unknown[] = []) {
  fetchMock.mockImplementation((url: string) => {
    const u = String(url);
    if (u.includes('/api/kid/logic/certificates')) {
      return Promise.resolve({
        ok: true,
        status: 200,
        json: async () => ({ certificates }),
      });
    }
    return Promise.resolve({ ok: false, status: 404, json: async () => ({}) });
  });
}

beforeEach(() => {
  fetchMock.mockReset();
  vi.stubGlobal('fetch', fetchMock);
});
afterEach(() => vi.unstubAllGlobals());

// ─── Empty state ──────────────────────────────────────────────────────────────

describe('LogicCertificates: empty state', () => {
  it('renders 15 locked cards when no certificates are earned', async () => {
    installFetch([]);
    render(<LogicCertificates kidToken={KID_TOKEN} />);
    // Wait for the loaded state: both loading and loaded share data-testid="logic-certificates";
    // wait for a specific card instead so we know loading has finished.
    await waitFor(() =>
      expect(screen.getByTestId('logic-cert-truefalse-easy')).toBeInTheDocument(),
    );

    // 5 game types × 3 difficulties = 15 cards
    const gameTypes = ['truefalse', 'patterns', 'oddoneout', 'ifthen', 'sorting'];
    const diffs = ['easy', 'medium', 'hard'];
    for (const gt of gameTypes) {
      for (const diff of diffs) {
        expect(screen.getByTestId(`logic-cert-${gt}-${diff}`)).toBeInTheDocument();
      }
    }
  });

  it('locked card shows lock icon and "10 correct to unlock"', async () => {
    installFetch([]);
    render(<LogicCertificates kidToken={KID_TOKEN} />);
    await waitFor(() =>
      expect(screen.getByTestId('logic-cert-truefalse-easy')).toBeInTheDocument(),
    );
    const card = screen.getByTestId('logic-cert-truefalse-easy');
    expect(card.textContent).toContain('10 correct to unlock');
  });

  it('progress bar shows 0%', async () => {
    installFetch([]);
    render(<LogicCertificates kidToken={KID_TOKEN} />);
    await waitFor(() => expect(screen.getByTestId('logic-cert-progress-bar')).toBeInTheDocument());
    expect(screen.getByTestId('logic-cert-progress-bar')).toHaveAttribute('aria-valuenow', '0');
  });
});

// ─── Earned certificates ──────────────────────────────────────────────────────

describe('LogicCertificates: earned certificates', () => {
  const earnedCert = {
    gameType: 'truefalse',
    difficulty: 'easy',
    totalCorrect: 10,
    earnedAt: '2026-06-20T10:00:00.000Z',
  };

  it('earned card shows date, not lock icon', async () => {
    installFetch([earnedCert]);
    render(<LogicCertificates kidToken={KID_TOKEN} />);
    await waitFor(() =>
      expect(screen.getByTestId('logic-cert-truefalse-easy')).toBeInTheDocument(),
    );
    const card = screen.getByTestId('logic-cert-truefalse-easy');
    // Should show a date, not "10 correct to unlock"
    expect(card.textContent).not.toContain('10 correct to unlock');
    // Should contain a date string (Jun 2026)
    expect(card.textContent).toMatch(/2026/);
  });

  it('progress bar reflects earned count', async () => {
    installFetch([earnedCert]);
    render(<LogicCertificates kidToken={KID_TOKEN} />);
    await waitFor(() => expect(screen.getByTestId('logic-cert-progress-bar')).toBeInTheDocument());
    expect(screen.getByTestId('logic-cert-progress-bar')).toHaveAttribute('aria-valuenow', '1');
  });

  it('easy level card shows 1 star, hard would show 3', async () => {
    const hardCert = {
      gameType: 'patterns',
      difficulty: 'hard',
      totalCorrect: 10,
      earnedAt: '2026-06-21T10:00:00.000Z',
    };
    installFetch([earnedCert, hardCert]);
    render(<LogicCertificates kidToken={KID_TOKEN} />);
    await waitFor(() =>
      expect(screen.getByTestId('logic-cert-truefalse-easy')).toBeInTheDocument(),
    );
    // Easy card should have aria for 1 star
    const easyCard = screen.getByTestId('logic-cert-truefalse-easy');
    expect(easyCard.textContent).toContain('⭐');
    // Hard card should have 3 stars
    const hardCard = screen.getByTestId('logic-cert-patterns-hard');
    const stars = (hardCard.textContent?.match(/⭐/g) ?? []).length;
    expect(stars).toBe(3);
  });
});

// ─── API call ─────────────────────────────────────────────────────────────────

describe('LogicCertificates: API', () => {
  it('calls GET /api/kid/logic/certificates with kidToken', async () => {
    installFetch([]);
    render(<LogicCertificates kidToken={KID_TOKEN} />);
    await waitFor(() => expect(screen.getByTestId('logic-certificates')).toBeInTheDocument());
    const calls = fetchMock.mock.calls as [string, RequestInit][];
    const certCall = calls.find(([url]) => (url as string).includes('/api/kid/logic/certificates'));
    expect(certCall).toBeTruthy();
    expect((certCall![1] as RequestInit)?.headers).toMatchObject({
      Authorization: `Bearer ${KID_TOKEN}`,
    });
  });
});

// ─── All earned ───────────────────────────────────────────────────────────────

describe('LogicCertificates: all earned', () => {
  it('shows "Logic Master" message when all 15 earned', async () => {
    const gameTypes = ['truefalse', 'patterns', 'oddoneout', 'ifthen', 'sorting'];
    const diffs = ['easy', 'medium', 'hard'];
    const all = gameTypes.flatMap((gt) =>
      diffs.map((diff) => ({
        gameType: gt,
        difficulty: diff,
        totalCorrect: 10,
        earnedAt: '2026-06-20T10:00:00.000Z',
      })),
    );
    installFetch(all);
    render(<LogicCertificates kidToken={KID_TOKEN} />);
    await waitFor(() => expect(screen.getByText(/Logic Master/i)).toBeInTheDocument());
  });
});
