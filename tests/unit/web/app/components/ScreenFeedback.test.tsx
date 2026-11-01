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

// FHS-717: shrinking a photo needs a real browser, so it is faked here. It has
// its own tests in tests/unit/web/app/lib/shrink-photo.test.ts.
const { shrinkMock } = vi.hoisted(() => ({ shrinkMock: vi.fn() }));
vi.mock('../../../../../src/app/lib/shrink-photo', () => ({
  shrinkPhoto: (file: File) => shrinkMock(file),
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

// FHS-717: report an issue with photos, at the top of the same form.
describe('reporting an issue on this screen', () => {
  let thumbCount = 0;
  const createObjectURL = vi.fn(() => `blob:thumb-${++thumbCount}`);
  const revokeObjectURL = vi.fn();

  beforeEach(() => {
    thumbCount = 0;
    createObjectURL.mockClear();
    revokeObjectURL.mockClear();
    Object.assign(URL, { createObjectURL, revokeObjectURL });
    shrinkMock.mockReset();
    shrinkMock.mockImplementation(async (file: File) => {
      if (!file.type.startsWith('image/')) throw new Error('not a photo');
      return new Blob(['small'], { type: 'image/jpeg' });
    });
  });

  const jpeg = (name = 'photo.jpg') => new File(['x'], name, { type: 'image/jpeg' });

  async function addPhotos(...files: File[]) {
    fireEvent.change(screen.getByTestId('screen-feedback-photo-input'), { target: { files } });
    await waitFor(() =>
      expect(screen.queryAllByTestId('screen-feedback-photo-preparing')).toHaveLength(0),
    );
  }

  function describeIssue(text: string) {
    fireEvent.change(screen.getByLabelText('What went wrong?'), { target: { value: text } });
  }

  function send() {
    fireEvent.click(screen.getByTestId('screen-feedback-submit'));
  }

  /** Answers each address the way the test says; anything else is a 201. */
  function serverReplies(replies: {
    issues?: () => Promise<Response>;
    answers?: () => Promise<Response>;
  }) {
    fetchMock.mockImplementation((url: string) => {
      if (url.endsWith('/api/feedback/issues')) {
        return replies.issues?.() ?? Promise.resolve(new Response('{"id":"i1"}', { status: 201 }));
      }
      return replies.answers?.() ?? Promise.resolve(new Response('{}', { status: 201 }));
    });
  }

  const callsTo = (path: string) =>
    fetchMock.mock.calls.filter(([url]) => (url as string).endsWith(path));

  it('opens with the issue report at the top, before the questions', () => {
    render(<ScreenFeedback role="admin" />);
    open();
    const section = screen.getByRole('region', {
      name: 'Found an issue on this screen? Report it.',
    });
    const firstQuestion = screen.getByText('Which part are you thinking of?');
    expect(
      section.compareDocumentPosition(firstQuestion) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
    expect(screen.getByPlaceholderText('What you tapped, and what happened')).toBeInTheDocument();
  });

  it('tells the parent a report on its own is enough to send', () => {
    render(<ScreenFeedback role="admin" />);
    open();
    expect(
      screen.getByText('Report an issue or answer at least one question to submit.'),
    ).toBeInTheDocument();
    expect(screen.getByTestId('screen-feedback-submit')).toBeDisabled();
    describeIssue('The Add meal button does nothing');
    expect(screen.getByTestId('screen-feedback-submit')).not.toBeDisabled();
  });

  it('treats spaces alone as nothing written', () => {
    render(<ScreenFeedback role="admin" />);
    open();
    describeIssue('   ');
    expect(screen.getByTestId('screen-feedback-submit')).toBeDisabled();
  });

  it('shows a small picture of each photo added', async () => {
    render(<ScreenFeedback role="admin" />);
    open();
    await addPhotos(jpeg('a.jpg'), jpeg('b.jpg'));
    expect(
      screen.getAllByTestId('screen-feedback-photo').map((img) => img.getAttribute('alt')),
    ).toEqual(['Attachment 1', 'Attachment 2']);
    expect(screen.getByRole('button', { name: 'Remove photo 2' })).toBeInTheDocument();
  });

  it('lets a photo on its own count as a report', async () => {
    render(<ScreenFeedback role="admin" />);
    open();
    await addPhotos(jpeg());
    expect(screen.getByTestId('screen-feedback-submit')).not.toBeDisabled();
  });

  it('removes just the photo the parent taps Remove on', async () => {
    render(<ScreenFeedback role="admin" />);
    open();
    await addPhotos(jpeg('a.jpg'), jpeg('b.jpg'));
    fireEvent.click(screen.getByRole('button', { name: 'Remove photo 1' }));
    const left = screen.getAllByTestId('screen-feedback-photo');
    expect(left).toHaveLength(1);
    expect(left[0]).toHaveAttribute('src', 'blob:thumb-2');
    expect(left[0]).toHaveAttribute('alt', 'Attachment 1');
    expect(revokeObjectURL).toHaveBeenCalledWith('blob:thumb-1');
  });

  it('stops at 3 photos and says so', async () => {
    render(<ScreenFeedback role="admin" />);
    open();
    expect(screen.getByText('Up to 3 photos')).toBeInTheDocument();
    await addPhotos(jpeg('a.jpg'), jpeg('b.jpg'), jpeg('c.jpg'), jpeg('d.jpg'));
    expect(screen.getAllByTestId('screen-feedback-photo')).toHaveLength(3);
    expect(screen.getByTestId('screen-feedback-photo-error')).toHaveTextContent(
      'Up to 3 photos, so we added the first 3.',
    );
    expect(screen.getByTestId('screen-feedback-add-photos')).toBeDisabled();
    expect(shrinkMock).toHaveBeenCalledTimes(3);
  });

  it('lets the parent add another photo after removing one of 3', async () => {
    render(<ScreenFeedback role="admin" />);
    open();
    await addPhotos(jpeg('a.jpg'), jpeg('b.jpg'), jpeg('c.jpg'));
    fireEvent.click(screen.getByRole('button', { name: 'Remove photo 3' }));
    expect(screen.getByTestId('screen-feedback-add-photos')).not.toBeDisabled();
  });

  it('says so when a file is not a photo it can use, and keeps the rest', async () => {
    render(<ScreenFeedback role="admin" />);
    open();
    await addPhotos(jpeg('a.jpg'), new File(['%PDF'], 'menu.pdf', { type: 'application/pdf' }));
    expect(screen.getByTestId('screen-feedback-photo-error')).toHaveTextContent(
      "That file isn't a photo we can use.",
    );
    expect(screen.getAllByTestId('screen-feedback-photo')).toHaveLength(1);
  });

  it('waits for a photo to be ready before Send can be tapped', async () => {
    let finish!: (b: Blob) => void;
    shrinkMock.mockReturnValue(new Promise<Blob>((r) => (finish = r)));
    render(<ScreenFeedback role="admin" />);
    open();
    describeIssue('Blank screen');
    fireEvent.change(screen.getByTestId('screen-feedback-photo-input'), {
      target: { files: [jpeg()] },
    });
    expect(await screen.findByLabelText('Getting your photo ready')).toBeInTheDocument();
    expect(screen.getByTestId('screen-feedback-submit')).toBeDisabled();
    await act(async () => finish(new Blob(['small'], { type: 'image/jpeg' })));
    expect(screen.getByTestId('screen-feedback-submit')).not.toBeDisabled();
  });

  it('sends a report on its own, with the words, the photos, the screen and the visit', async () => {
    serverReplies({});
    render(<ScreenFeedback role="admin" />);
    open();
    describeIssue('  The Add meal button does nothing  ');
    await addPhotos(jpeg('a.jpg'), jpeg('b.jpg'));
    send();

    await waitFor(() => expect(screen.getByTestId('screen-feedback-thanks')).toBeInTheDocument());
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0]!;
    expect(url).toMatch(/\/api\/feedback\/issues$/);
    expect(init.method).toBe('POST');
    expect(init.headers['Authorization']).toBe('Bearer parent.jwt.tok');
    expect(init.headers['x-tenant-slug']).toBe('test-family');
    // The browser must set this itself, with the photo boundary in it.
    expect(init.headers['Content-Type']).toBeUndefined();
    const form = init.body as FormData;
    expect(form.get('screen')).toBe('meals');
    expect(form.get('description')).toBe('The Add meal button does nothing');
    expect(form.get('visitId')).toBe(sessionStorage.getItem('fh-feedback-visit'));
    expect(form.getAll('photos')).toHaveLength(2);
  });

  it('sends the report and the answers when the parent does both', async () => {
    serverReplies({});
    render(<ScreenFeedback role="admin" />);
    open();
    describeIssue('Meals list is empty');
    fireEvent.click(screen.getByTestId('screen-feedback-ease-2'));
    send();

    await waitFor(() => expect(screen.getByTestId('screen-feedback-thanks')).toBeInTheDocument());
    expect(callsTo('/api/feedback/issues')).toHaveLength(1);
    const answers = callsTo('/api/feedback');
    expect(answers).toHaveLength(1);
    expect(JSON.parse(answers[0]![1].body)).toMatchObject({ screen: 'meals', easeOfUse: 2 });
  });

  it('keeps the words and photos when the report fails, so the parent can try again', async () => {
    let fail = true;
    serverReplies({
      issues: () =>
        Promise.resolve(
          fail ? new Response('{}', { status: 500 }) : new Response('{"id":"i1"}', { status: 201 }),
        ),
    });
    render(<ScreenFeedback role="admin" />);
    open();
    describeIssue('Calendar will not scroll');
    await addPhotos(jpeg());
    send();

    await waitFor(() =>
      expect(screen.getByTestId('screen-feedback-error')).toHaveTextContent(
        'We could not send your report. Your words and photos are still here, so tap Send feedback to try again.',
      ),
    );
    expect(screen.queryByTestId('screen-feedback-thanks')).toBeNull();
    expect(screen.getByLabelText('What went wrong?')).toHaveValue('Calendar will not scroll');
    expect(screen.getAllByTestId('screen-feedback-photo')).toHaveLength(1);
    expect(screen.getByTestId('screen-feedback-submit')).not.toBeDisabled();

    fail = false;
    send();
    await waitFor(() => expect(screen.getByTestId('screen-feedback-thanks')).toBeInTheDocument());
  });

  it('only sends again the part that failed', async () => {
    let answersFail = true;
    serverReplies({
      answers: () => Promise.resolve(new Response('{}', { status: answersFail ? 500 : 201 })),
    });
    render(<ScreenFeedback role="admin" />);
    open();
    describeIssue('Wrong total');
    fireEvent.click(screen.getByTestId('screen-feedback-solves-4'));
    send();
    await waitFor(() => expect(screen.getByTestId('screen-feedback-error')).toBeInTheDocument());
    expect(screen.queryByTestId('screen-feedback-thanks')).toBeNull();

    answersFail = false;
    send();
    await waitFor(() => expect(screen.getByTestId('screen-feedback-thanks')).toBeInTheDocument());
    expect(callsTo('/api/feedback/issues')).toHaveLength(1);
    expect(callsTo('/api/feedback')).toHaveLength(2);
  });

  it('explains when the photos are too big to send', async () => {
    serverReplies({ issues: () => Promise.resolve(new Response('{}', { status: 413 })) });
    render(<ScreenFeedback role="admin" />);
    open();
    await addPhotos(jpeg());
    send();
    await waitFor(() =>
      expect(screen.getByTestId('screen-feedback-error')).toHaveTextContent(
        'Those photos are too big to send.',
      ),
    );
  });

  it('says so when the server cannot be reached', async () => {
    serverReplies({ issues: () => Promise.reject(new TypeError('network down')) });
    render(<ScreenFeedback role="admin" />);
    open();
    describeIssue('Nothing loads');
    send();
    await waitFor(() =>
      expect(screen.getByTestId('screen-feedback-error')).toHaveTextContent(
        'Could not reach the server',
      ),
    );
  });

  it('sends the report once when Send is tapped twice', async () => {
    let resolve!: (r: Response) => void;
    serverReplies({ issues: () => new Promise<Response>((r) => (resolve = r)) });
    render(<ScreenFeedback role="admin" />);
    open();
    describeIssue('Double tap test');
    send();
    send();
    expect(screen.getByTestId('screen-feedback-submit')).toBeDisabled();
    resolve(new Response('{"id":"i1"}', { status: 201 }));
    await waitFor(() => expect(screen.getByTestId('screen-feedback-thanks')).toBeInTheDocument());
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('lets go of the photos when the form is closed', async () => {
    render(<ScreenFeedback role="admin" />);
    open();
    await addPhotos(jpeg('a.jpg'), jpeg('b.jpg'));
    fireEvent.click(screen.getByRole('button', { name: 'Close feedback dialog' }));
    expect(revokeObjectURL).toHaveBeenCalledWith('blob:thumb-1');
    expect(revokeObjectURL).toHaveBeenCalledWith('blob:thumb-2');
  });

  it('starts empty the next time the form opens', async () => {
    render(<ScreenFeedback role="admin" />);
    open();
    describeIssue('Old words');
    await addPhotos(jpeg());
    fireEvent.click(screen.getByRole('button', { name: 'Close feedback dialog' }));
    open();
    expect(screen.getByLabelText('What went wrong?')).toHaveValue('');
    expect(screen.queryAllByTestId('screen-feedback-photo')).toHaveLength(0);
  });

  it('drops a photo that finishes getting ready after the form was closed', async () => {
    let finish!: (b: Blob) => void;
    shrinkMock.mockReturnValue(new Promise<Blob>((r) => (finish = r)));
    render(<ScreenFeedback role="admin" />);
    open();
    fireEvent.change(screen.getByTestId('screen-feedback-photo-input'), {
      target: { files: [jpeg()] },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Close feedback dialog' }));
    await act(async () => finish(new Blob(['small'], { type: 'image/jpeg' })));
    open();
    expect(screen.queryAllByTestId('screen-feedback-photo')).toHaveLength(0);
    expect(createObjectURL).not.toHaveBeenCalled();
  });

  // The form is used on phones most of all. jsdom cannot measure layout, so
  // this pins what keeps it usable at 375px; the browser test measures it.
  describe('on a 375px phone', () => {
    beforeEach(() => {
      Object.defineProperty(window, 'innerWidth', { configurable: true, value: 375 });
    });

    it('lays the photos out three across, shrinking to fit the width', async () => {
      render(<ScreenFeedback role="admin" />);
      open();
      await addPhotos(jpeg('a.jpg'), jpeg('b.jpg'), jpeg('c.jpg'));
      expect(screen.getByTestId('screen-feedback-photos')).toHaveClass('grid', 'grid-cols-3');
      for (const img of screen.getAllByTestId('screen-feedback-photo')) {
        expect(img).toHaveClass('w-full', 'aspect-square', 'object-cover');
        expect(img.parentElement).toHaveClass('min-w-0');
      }
    });

    it('keeps Add photos and every Remove button big enough to tap', async () => {
      render(<ScreenFeedback role="admin" />);
      open();
      await addPhotos(jpeg('a.jpg'));
      expect(screen.getByTestId('screen-feedback-add-photos')).toHaveClass('min-h-[44px]');
      expect(screen.getByRole('button', { name: 'Remove photo 1' })).toHaveClass(
        'min-h-[44px]',
        'w-full',
      );
    });

    it('wraps Add photos and its note instead of pushing past the edge', () => {
      render(<ScreenFeedback role="admin" />);
      open();
      expect(screen.getByTestId('screen-feedback-add-photos').parentElement).toHaveClass(
        'flex-wrap',
      );
    });
  });
});
