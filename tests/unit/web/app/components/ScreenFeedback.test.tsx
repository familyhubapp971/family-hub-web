/**
 * Unit tests for ScreenFeedback (FHS-670): the per-screen feedback button in
 * the top bar of signed-in parent screens.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';

const mockLocation = { pathname: '/t/test-family/dashboard', search: '?tab=meals' };
let mockSession: { access_token: string } | null = { access_token: 'parent.jwt.tok' };

vi.mock('react-router-dom', () => ({
  useParams: () => ({ slug: 'test-family' }),
  useLocation: () => mockLocation,
}));

vi.mock('../../../../../src/app/lib/auth-context', () => ({
  useAuth: () => ({ session: mockSession }),
}));

vi.mock('../../../../../src/app/lib/supabase', () => ({
  supabase: { auth: { getSession: async () => ({ data: { session: null } }) } },
}));

import { ScreenFeedback } from '../../../../../src/app/components/ScreenFeedback';

const fetchMock = vi.fn();

beforeEach(() => {
  mockSession = { access_token: 'parent.jwt.tok' };
  mockLocation.pathname = '/t/test-family/dashboard';
  mockLocation.search = '?tab=meals';
  sessionStorage.clear();
  fetchMock.mockReset();
  vi.stubGlobal('fetch', fetchMock);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

function open() {
  fireEvent.click(screen.getByTestId('screen-feedback-button'));
}

describe('<ScreenFeedback />', () => {
  it('is hidden without a parent session', () => {
    mockSession = null;
    const { container } = render(<ScreenFeedback role="admin" />);
    expect(container).toBeEmptyDOMElement();
  });

  it('asks about the screen the parent is on', () => {
    render(<ScreenFeedback role="admin" />);
    open();
    expect(screen.getByText('How easy is Weekly Meals to use?')).toBeInTheDocument();
    expect(screen.getByPlaceholderText(/shopping list built from/)).toBeInTheDocument();
  });

  it("lists that screen's own features", () => {
    render(<ScreenFeedback role="admin" />);
    open();
    const names = screen.getAllByTestId('screen-feedback-feature').map((b) => b.textContent);
    expect(names).toEqual(['Add meal', 'Add snack', 'Repeats weekly', 'Filter meals']);
  });

  it('uses the tab it is given on Child World', () => {
    render(<ScreenFeedback role="adult" screenKey="child-journal" />);
    open();
    expect(screen.getByText('How easy is the Journal to use?')).toBeInTheDocument();
  });

  it('needs an answer, not just a feature tap, before it can send', () => {
    render(<ScreenFeedback role="admin" />);
    open();
    fireEvent.click(screen.getByText('Add meal'));
    expect(screen.getByTestId('screen-feedback-submit')).toBeDisabled();
    fireEvent.click(screen.getByTestId('screen-feedback-ease-4'));
    expect(screen.getByTestId('screen-feedback-submit')).not.toBeDisabled();
  });

  it('sends the screen, the features tapped and the visit ID', async () => {
    fetchMock.mockResolvedValue(new Response(JSON.stringify({ success: true }), { status: 201 }));
    render(<ScreenFeedback role="admin" />);
    open();
    fireEvent.click(screen.getByText('Add snack'));
    fireEvent.click(screen.getByTestId('screen-feedback-ease-4'));
    fireEvent.change(screen.getByTestId('screen-feedback-wish'), {
      target: { value: 'A shopping list' },
    });
    fireEvent.click(screen.getByTestId('screen-feedback-submit'));

    await waitFor(() => expect(screen.getByTestId('screen-feedback-thanks')).toBeInTheDocument());
    const [url, init] = fetchMock.mock.calls[0]!;
    expect(url).toMatch(/\/api\/feedback$/);
    expect(init.headers['x-tenant-slug']).toBe('test-family');
    const body = JSON.parse(init.body);
    expect(body).toMatchObject({
      screen: 'meals',
      features: ['Add snack'],
      easeOfUse: 4,
      featureRequest: 'A shopping list',
    });
    expect(body.visitId).toBe(sessionStorage.getItem('fh-feedback-visit'));
  });

  it('shows the error and keeps the answers when sending fails', async () => {
    fetchMock.mockResolvedValue(
      new Response(JSON.stringify({ error: 'invalid request' }), { status: 400 }),
    );
    render(<ScreenFeedback role="admin" />);
    open();
    fireEvent.click(screen.getByTestId('screen-feedback-solves-3'));
    fireEvent.click(screen.getByTestId('screen-feedback-submit'));
    await waitFor(() =>
      expect(screen.getByTestId('screen-feedback-error')).toHaveTextContent('invalid request'),
    );
    expect(screen.getByTestId('screen-feedback-solves-3')).toHaveAttribute('aria-pressed', 'true');
  });

  it('says so when the server cannot be reached', async () => {
    fetchMock.mockRejectedValue(new TypeError('network down'));
    render(<ScreenFeedback role="admin" />);
    open();
    fireEvent.click(screen.getByTestId('screen-feedback-ease-2'));
    fireEvent.click(screen.getByTestId('screen-feedback-submit'));
    await waitFor(() =>
      expect(screen.getByTestId('screen-feedback-error')).toHaveTextContent(
        'Could not reach the server',
      ),
    );
  });

  it('sends once when Send is tapped twice', async () => {
    let resolve!: (r: Response) => void;
    fetchMock.mockReturnValue(new Promise<Response>((r) => (resolve = r)));
    render(<ScreenFeedback role="admin" />);
    open();
    fireEvent.click(screen.getByTestId('screen-feedback-ease-5'));
    fireEvent.click(screen.getByTestId('screen-feedback-submit'));
    fireEvent.click(screen.getByTestId('screen-feedback-submit'));
    resolve(new Response('{}', { status: 201 }));
    await waitFor(() => expect(screen.getByTestId('screen-feedback-thanks')).toBeInTheDocument());
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  describe('Children never see the button', () => {
    it.each([
      ['a child', 'child'],
      ['a teen', 'teen'],
      ['a grown-up whose role is still loading', null],
    ])('is hidden for %s', (_who, role) => {
      const { container } = render(<ScreenFeedback role={role} />);
      expect(container).toBeEmptyDOMElement();
    });
  });

  // FHS-671: the button floats at the bottom and a bubble says feedback is possible.
  describe('the reminder bubble', () => {
    afterEach(() => vi.useRealTimers());

    it('says feedback is possible on the screen the parent lands on', () => {
      render(<ScreenFeedback role="admin" />);
      expect(screen.getByTestId('screen-feedback-hint')).toHaveTextContent(
        'You can give feedback on Weekly Meals here.',
      );
    });

    it('goes away after five seconds', () => {
      vi.useFakeTimers();
      render(<ScreenFeedback role="admin" />);
      act(() => vi.advanceTimersByTime(5000));
      expect(screen.queryByTestId('screen-feedback-hint')).toBeNull();
    });

    it('comes back when the parent changes screen', () => {
      vi.useFakeTimers();
      const { rerender } = render(<ScreenFeedback role="admin" />);
      act(() => vi.advanceTimersByTime(5000));
      mockLocation.search = '?tab=calendar';
      rerender(<ScreenFeedback role="admin" />);
      expect(screen.getByTestId('screen-feedback-hint')).toHaveTextContent('the Calendar');
    });

    it('reads the same sentence to screen readers', () => {
      render(<ScreenFeedback role="admin" />);
      expect(screen.getByRole('status')).toHaveTextContent(
        'You can give feedback on Weekly Meals here.',
      );
    });

    it('comes back when the parent changes Child World tab', () => {
      vi.useFakeTimers();
      const { rerender } = render(<ScreenFeedback role="admin" screenKey="child-world" />);
      act(() => vi.advanceTimersByTime(5000));
      expect(screen.queryByTestId('screen-feedback-hint')).toBeNull();
      rerender(<ScreenFeedback role="admin" screenKey="child-journal" />);
      expect(screen.getByTestId('screen-feedback-hint')).toHaveTextContent('the Journal');
    });

    it('only keeps the latest bubble when tabs change quickly', () => {
      vi.useFakeTimers();
      const { rerender } = render(<ScreenFeedback role="admin" />);
      act(() => vi.advanceTimersByTime(3000));
      mockLocation.search = '?tab=calendar';
      rerender(<ScreenFeedback role="admin" />);
      act(() => vi.advanceTimersByTime(3000));
      expect(screen.getByTestId('screen-feedback-hint')).toHaveTextContent('the Calendar');
      act(() => vi.advanceTimersByTime(2000));
      expect(screen.queryByTestId('screen-feedback-hint')).toBeNull();
    });

    it('hides while the form is open', () => {
      render(<ScreenFeedback role="admin" />);
      open();
      expect(screen.queryByTestId('screen-feedback-hint')).toBeNull();
    });
  });

  it('makes room at the end of the page while it shows', () => {
    const { unmount } = render(<ScreenFeedback role="admin" />);
    expect(document.body).toHaveClass('fh-feedback-fab');
    unmount();
    expect(document.body).not.toHaveClass('fh-feedback-fab');
  });

  it('sits above the Reward settings save bar', () => {
    mockLocation.pathname = '/t/test-family/reward-settings';
    mockLocation.search = '';
    render(<ScreenFeedback role="admin" />);
    expect(screen.getByTestId('screen-feedback-button').parentElement).toHaveClass('bottom-24');
  });

  // FHS-678: on a phone the header and close button sat under the browser bar.
  describe('fits a small screen', () => {
    it('keeps the header out of the scrolling part, so it never scrolls away', () => {
      render(<ScreenFeedback role="admin" />);
      open();
      const header = screen.getByTestId('screen-feedback-header');
      const body = screen.getByTestId('screen-feedback-body');
      expect(header).toHaveClass('shrink-0');
      expect(body).toHaveClass('overflow-y-auto', 'min-h-0');
      expect(body).not.toContainElement(header);
      expect(header).toContainElement(
        screen.getByRole('button', { name: 'Close feedback dialog' }),
      );
    });

    it('caps the card at the visible screen height, not the 90vh that iPhones overshoot', () => {
      render(<ScreenFeedback role="admin" />);
      open();
      const card = screen.getByTestId('screen-feedback-card');
      expect(card.className).not.toContain('90vh');
      expect(card.className).toContain('max-h-[calc(100dvh-2rem)]');
      expect(card).toHaveClass('min-h-0', 'flex-col');
    });

    it('has a close button at least 44px square', () => {
      render(<ScreenFeedback role="admin" />);
      open();
      expect(screen.getByRole('button', { name: 'Close feedback dialog' })).toHaveClass(
        'h-11',
        'w-11',
      );
    });
  });
});
