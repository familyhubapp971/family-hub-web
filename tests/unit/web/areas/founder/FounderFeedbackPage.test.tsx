/**
 * FHS-672: the founder's /admin feedback page.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';

vi.mock('../../../../../src/app/lib/supabase', () => ({
  supabase: { auth: { getSession: async () => ({ data: { session: null } }) } },
}));

import { FounderFeedbackPage } from '../../../../../src/areas/founder/FounderFeedbackPage';

const fetchMock = vi.fn();

const ROWS = [
  {
    source: 'screen',
    familySlug: 'smiths',
    familyName: 'Smith Family',
    name: null,
    email: 'sam@example.com',
    visitId: 'v1',
    screen: 'meals',
    features: ['Add meal'],
    pmfDisappointment: null,
    recommendScore: null,
    solvesProblem: 4,
    easeOfUse: 3,
    keepUsing: null,
    painPoint: null,
    featureRequest: 'A shopping list',
    otherFeedback: null,
    createdAt: '2026-10-20T10:00:00.000Z',
  },
  {
    source: 'public',
    familySlug: null,
    familyName: null,
    name: 'Visitor',
    email: null,
    visitId: null,
    screen: null,
    features: [],
    pmfDisappointment: 'very',
    recommendScore: 9,
    solvesProblem: null,
    easeOfUse: null,
    keepUsing: null,
    painPoint: null,
    featureRequest: null,
    otherFeedback: 'Looks great',
    createdAt: '2026-10-19T10:00:00.000Z',
  },
];

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status });
}

function typePasscode(digits: string) {
  fireEvent.change(screen.getByTestId('founder-passcode'), { target: { value: digits } });
  fireEvent.click(screen.getByTestId('founder-open'));
}

beforeEach(() => {
  sessionStorage.clear();
  fetchMock.mockReset();
  vi.stubGlobal('fetch', fetchMock);
});

afterEach(() => vi.unstubAllGlobals());

describe('<FounderFeedbackPage />', () => {
  it('keeps Open greyed out until something is typed', () => {
    render(<FounderFeedbackPage />);
    expect(screen.getByTestId('founder-open')).toBeDisabled();
  });

  it('centres the passcode box below the title', () => {
    render(<FounderFeedbackPage />);
    expect(screen.getByTestId('founder-lock')).toHaveClass(
      'flex-1',
      'items-center',
      'justify-center',
    );
  });

  it('asks for the passcode first', () => {
    render(<FounderFeedbackPage />);
    expect(screen.getByText('Enter the passcode')).toBeInTheDocument();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('opens with the right passcode and shows the summary and answers', async () => {
    fetchMock
      .mockResolvedValueOnce(json({ token: 'tok', expiresAt: '2026-10-20T18:00:00.000Z' }))
      .mockResolvedValueOnce(json({ rows: ROWS }));
    render(<FounderFeedbackPage />);
    typePasscode('246810');

    await waitFor(() => expect(screen.getByTestId('founder-summary')).toBeInTheDocument());
    expect(screen.getByTestId('founder-summary')).toHaveTextContent('Weekly Meals');
    expect(screen.getByTestId('founder-count')).toHaveTextContent('2 answers from 2 people');
    expect(screen.getAllByText('“A shopping list”')).toHaveLength(2);
    expect(fetchMock.mock.calls[1]![1].headers['x-founder-token']).toBe('tok');
  });

  it('says so when the passcode is wrong', async () => {
    fetchMock.mockResolvedValueOnce(json({ error: 'wrong passcode' }, 401));
    render(<FounderFeedbackPage />);
    typePasscode('000000');
    await waitFor(() =>
      expect(screen.getByTestId('founder-error')).toHaveTextContent('That passcode is wrong.'),
    );
  });

  it('says how long to wait after too many tries', async () => {
    fetchMock.mockResolvedValueOnce(json({ error: 'too many tries', retryAfter: 600 }, 429));
    render(<FounderFeedbackPage />);
    typePasscode('000000');
    await waitFor(() =>
      expect(screen.getByTestId('founder-error')).toHaveTextContent('Try again in 10 minutes.'),
    );
  });

  it('filters to one source', async () => {
    sessionStorage.setItem('fh-founder-token', 'tok');
    fetchMock.mockResolvedValueOnce(json({ rows: ROWS }));
    render(<FounderFeedbackPage />);
    await waitFor(() => expect(screen.getByTestId('founder-count')).toBeInTheDocument());
    fireEvent.change(screen.getByTestId('founder-filter-source'), { target: { value: 'public' } });
    expect(screen.getByTestId('founder-count')).toHaveTextContent('1 answer from 1 person');
  });

  it('locks again when the token has expired', async () => {
    sessionStorage.setItem('fh-founder-token', 'old');
    fetchMock.mockResolvedValueOnce(json({ error: 'sign in again' }, 401));
    render(<FounderFeedbackPage />);
    await waitFor(() => expect(screen.getByText('Enter the passcode')).toBeInTheDocument());
    expect(sessionStorage.getItem('fh-founder-token')).toBeNull();
  });

  it('says so when the server cannot be reached', async () => {
    fetchMock.mockRejectedValueOnce(new TypeError('network down'));
    render(<FounderFeedbackPage />);
    typePasscode('246810');
    await waitFor(() =>
      expect(screen.getByTestId('founder-error')).toHaveTextContent('Could not reach the server'),
    );
  });

  it('says when the page is switched off', async () => {
    fetchMock.mockResolvedValueOnce(json({ error: 'not found' }, 404));
    render(<FounderFeedbackPage />);
    typePasscode('246810');
    await waitFor(() =>
      expect(screen.getByTestId('founder-error')).toHaveTextContent('switched off'),
    );
  });

  it('says when the feedback cannot load', async () => {
    sessionStorage.setItem('fh-founder-token', 'tok');
    fetchMock.mockRejectedValueOnce(new TypeError('network down'));
    render(<FounderFeedbackPage />);
    await waitFor(() =>
      expect(screen.getByRole('alert')).toHaveTextContent('Could not load feedback'),
    );
  });

  it('shows friendly empty messages when there is no feedback yet', async () => {
    sessionStorage.setItem('fh-founder-token', 'tok');
    fetchMock.mockResolvedValueOnce(json({ rows: [] }));
    render(<FounderFeedbackPage />);
    await waitFor(() => expect(screen.getByText('No per-screen answers yet.')).toBeInTheDocument());
    expect(screen.getByText('No feedback matches these filters.')).toBeInTheDocument();
  });

  it('stays open on reload while the pass is still good', async () => {
    sessionStorage.setItem('fh-founder-token', 'tok');
    fetchMock.mockResolvedValueOnce(json({ rows: ROWS }));
    render(<FounderFeedbackPage />);
    await waitFor(() => expect(screen.getByTestId('founder-summary')).toBeInTheDocument());
    expect(screen.queryByText('Enter the passcode')).toBeNull();
  });

  // FHS-675: the visual view.
  describe('the visual view', () => {
    async function openWithRows() {
      sessionStorage.setItem('fh-founder-token', 'tok');
      fetchMock.mockResolvedValueOnce(json({ rows: ROWS }));
      render(<FounderFeedbackPage />);
      await waitFor(() => expect(screen.getByTestId('founder-tile-answers')).toBeInTheDocument());
    }

    it('leads with the headline numbers', async () => {
      await openWithRows();
      expect(screen.getByTestId('founder-tile-answers')).toHaveTextContent('2');
      expect(screen.getByTestId('founder-tile-people')).toHaveTextContent('2');
      expect(screen.getByTestId('founder-tile-families')).toHaveTextContent('1');
      expect(screen.getByTestId('founder-tile-recommend')).toHaveTextContent('9/10');
    });

    it('shows how many would miss it', async () => {
      await openWithRows();
      expect(screen.getByTestId('founder-miss-it')).toHaveTextContent('Very disappointed100% (1)');
      expect(
        screen.getByRole('img', {
          name: 'Very disappointed 100%, Somewhat 0%, Not disappointed 0%',
        }),
      ).toBeInTheDocument();
    });

    it('sorts written answers into wishes and other comments', async () => {
      await openWithRows();
      expect(screen.getByTestId('founder-quotes-wish')).toHaveTextContent('A shopping list');
      expect(screen.getByTestId('founder-quotes-other')).toHaveTextContent('Looks great');
      expect(screen.getByTestId('founder-quotes-pain')).toHaveTextContent('Nothing yet.');
    });

    it('gives each screen its own card', async () => {
      await openWithRows();
      expect(screen.getAllByTestId('founder-screen-card')).toHaveLength(1);
      expect(screen.getByTestId('founder-screen-card')).toHaveTextContent('Add meal · 1');
    });

    it('updates the numbers when filtered', async () => {
      await openWithRows();
      fireEvent.change(screen.getByTestId('founder-filter-source'), {
        target: { value: 'public' },
      });
      expect(screen.getByTestId('founder-tile-answers')).toHaveTextContent('1');
      expect(screen.getByTestId('founder-tile-families')).toHaveTextContent('0');
    });
  });
});
