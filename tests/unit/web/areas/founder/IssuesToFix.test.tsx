/**
 * FHS-717: "Issues to fix" at the top of the founder's /admin page.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor, within, act } from '@testing-library/react';
import { IssuesToFix } from '../../../../../src/areas/founder/IssuesToFix';
import type { FounderIssue } from '../../../../../src/app/lib/founder-issues';

const NOW = new Date('2026-11-01T12:00:00.000Z');

function issue(over: Partial<FounderIssue>): FounderIssue {
  return {
    id: 'i',
    createdAt: '2026-11-01T10:00:00.000Z',
    screen: 'meals',
    description: '',
    status: 'new',
    fixedAt: null,
    familyName: 'Smith Family',
    reporterEmail: null,
    reporterName: null,
    photos: [],
    ...over,
  };
}

// Deliberately not in date order, to prove the page sorts them.
const ISSUES: FounderIssue[] = [
  issue({
    id: 'i-old',
    createdAt: '2026-10-30T09:00:00.000Z',
    screen: 'calendar',
    description: 'Old one',
    familyName: 'Jones Family',
    reporterName: 'Jo Jones',
    reporterEmail: 'jo@example.com',
  }),
  issue({
    id: 'i-new',
    createdAt: '2026-11-01T10:00:00.000Z',
    screen: 'meals',
    description: 'Add meal does nothing',
    reporterName: 'Sam Smith',
    reporterEmail: 'sam@example.com',
    photos: [
      { id: 'p1', contentType: 'image/jpeg', sizeBytes: 120_000 },
      { id: 'p2', contentType: 'image/jpeg', sizeBytes: 90_000 },
    ],
  }),
  issue({
    id: 'i-fixed',
    createdAt: '2026-10-29T09:00:00.000Z',
    screen: 'somewhere-new',
    description: 'Was broken',
    status: 'fixed',
    fixedAt: '2026-10-31T12:00:00.000Z',
    familyName: 'Lee Family',
  }),
];

type Reply = () => Promise<unknown>;
let listReply: Reply;
let patchReply: Reply;
let photoReply: Reply;
const fetchMock = vi.fn();

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status });
}

const photoBytes = () =>
  Promise.resolve({ ok: true, status: 200, blob: async () => new Blob(['img']) });

let urlCount = 0;
const createObjectURL = vi.fn(() => `blob:issue-photo-${++urlCount}`);
const revokeObjectURL = vi.fn();
const onUnauthorized = vi.fn();

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(NOW);
  urlCount = 0;
  createObjectURL.mockClear();
  revokeObjectURL.mockClear();
  onUnauthorized.mockReset();
  Object.assign(URL, { createObjectURL, revokeObjectURL });
  listReply = () => Promise.resolve(json({ issues: ISSUES }));
  patchReply = () =>
    Promise.resolve(json({ id: 'x', status: 'fixed', fixedAt: NOW.toISOString() }));
  photoReply = photoBytes;
  fetchMock.mockReset();
  fetchMock.mockImplementation((url: string, init?: RequestInit) => {
    if (url.includes('/photos/')) return photoReply();
    if (init?.method === 'PATCH') return patchReply();
    return listReply();
  });
  vi.stubGlobal('fetch', fetchMock);
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

function renderSection() {
  return render(<IssuesToFix token="tok" onUnauthorized={onUnauthorized} />);
}

async function loaded() {
  renderSection();
  await waitFor(() => expect(screen.getByTestId('founder-issues-filter-new')).toBeInTheDocument());
}

const cards = () => screen.queryAllByTestId('founder-issue');
const cardTitles = () => cards().map((c) => within(c).getByRole('heading').textContent);
const patchCalls = () => fetchMock.mock.calls.filter(([, init]) => init?.method === 'PATCH');

describe('<IssuesToFix />', () => {
  it('shows grey cards the shape of the real ones while issues load', () => {
    listReply = () => new Promise(() => {});
    renderSection();
    const loading = screen.getByTestId('founder-issues-loading');
    expect(loading).toHaveAttribute('aria-busy', 'true');
    expect(within(loading).getByRole('status')).toHaveTextContent('Loading issues');
    expect(loading.querySelectorAll('.rounded-2xl')).toHaveLength(2);
  });

  it('reads the list with the founder pass', async () => {
    await loaded();
    const [url, init] = fetchMock.mock.calls[0]!;
    expect(url).toMatch(/\/api\/founder\/issues$/);
    expect(init.headers['x-founder-token']).toBe('tok');
  });

  it('lists new issues newest first', async () => {
    await loaded();
    expect(cardTitles()).toEqual(['Weekly Meals', 'The Calendar']);
  });

  it('shows the screen, family, person, when, and what went wrong on each card', async () => {
    await loaded();
    const card = cards()[0]!;
    expect(card).toHaveTextContent('Weekly Meals');
    expect(card).toHaveTextContent('Smith Family');
    expect(card).toHaveTextContent('Sam Smith · sam@example.com');
    expect(card).toHaveTextContent('Add meal does nothing');
    const when = within(card).getByText('2 hours ago');
    expect(when.tagName).toBe('TIME');
    expect(when).toHaveAttribute('dateTime', '2026-11-01T10:00:00.000Z');
    expect(when.getAttribute('title')).toMatch(/2026/);
  });

  it('counts the issues still to fix next to the title', async () => {
    await loaded();
    expect(screen.getByRole('heading', { name: /Issues to fix/ })).toHaveTextContent(
      'Issues to fix2',
    );
  });

  it('shows New first, with a count on each choice', async () => {
    await loaded();
    expect(screen.getByRole('button', { name: 'New 2' })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('button', { name: 'Fixed 1' })).toHaveAttribute(
      'aria-pressed',
      'false',
    );
  });

  it('shows the fixed ones when Fixed is chosen', async () => {
    await loaded();
    fireEvent.click(screen.getByRole('button', { name: 'Fixed 1' }));
    expect(cards()).toHaveLength(1);
    const card = cards()[0]!;
    // Not a screen the app knows, so its own name is shown.
    expect(card).toHaveTextContent('Somewhere-new');
    expect(card).toHaveTextContent('Name and email not known');
    expect(card).toHaveTextContent('Fixed 1 day ago');
    expect(within(card).getByRole('button', { name: 'Reopen' })).toBeInTheDocument();
  });

  it('moves an issue to Fixed the moment Mark fixed is tapped', async () => {
    let finish!: (r: Response) => void;
    patchReply = () => new Promise<Response>((r) => (finish = r));
    await loaded();
    fireEvent.click(within(cards()[0]!).getByRole('button', { name: 'Mark fixed' }));

    expect(cardTitles()).toEqual(['The Calendar']);
    expect(screen.getByRole('button', { name: 'New 1' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Fixed 2' })).toBeInTheDocument();

    const [url, init] = patchCalls()[0]!;
    expect(url).toMatch(/\/api\/founder\/issues\/i-new$/);
    expect(init.headers['x-founder-token']).toBe('tok');
    expect(JSON.parse(init.body)).toEqual({ status: 'fixed' });
    finish(json({ id: 'i-new', status: 'fixed', fixedAt: NOW.toISOString() }));
    await waitFor(() => expect(screen.queryByTestId('founder-issues-save-error')).toBeNull());
  });

  it('puts the issue back in New and says so when Mark fixed fails', async () => {
    patchReply = () => Promise.resolve(json({ error: 'nope' }, 500));
    await loaded();
    fireEvent.click(within(cards()[0]!).getByRole('button', { name: 'Mark fixed' }));
    await waitFor(() =>
      expect(screen.getByTestId('founder-issues-save-error')).toHaveTextContent(
        'Could not mark that issue fixed. Please try again.',
      ),
    );
    expect(cardTitles()).toEqual(['Weekly Meals', 'The Calendar']);
    expect(screen.getByRole('button', { name: 'New 2' })).toBeInTheDocument();
  });

  it('moves an issue back to New when Reopen is tapped', async () => {
    patchReply = () => Promise.resolve(json({ id: 'i-fixed', status: 'new', fixedAt: null }));
    await loaded();
    fireEvent.click(screen.getByRole('button', { name: 'Fixed 1' }));
    fireEvent.click(screen.getByRole('button', { name: 'Reopen' }));
    expect(screen.getByTestId('founder-issues-empty')).toHaveTextContent(
      'Nothing marked fixed yet.',
    );
    expect(JSON.parse(patchCalls()[0]![1].body)).toEqual({ status: 'new' });
    fireEvent.click(screen.getByRole('button', { name: 'New 3' }));
    await waitFor(() => expect(cardTitles()).toContain('Somewhere-new'));
  });

  it('puts the issue back in Fixed and says so when Reopen fails', async () => {
    patchReply = () => Promise.reject(new TypeError('network down'));
    await loaded();
    fireEvent.click(screen.getByRole('button', { name: 'Fixed 1' }));
    fireEvent.click(screen.getByRole('button', { name: 'Reopen' }));
    await waitFor(() =>
      expect(screen.getByTestId('founder-issues-save-error')).toHaveTextContent(
        'Could not reopen that issue. Please try again.',
      ),
    );
    expect(cardTitles()).toEqual(['Somewhere-new']);
  });

  it('locks the page when the pass runs out while marking fixed', async () => {
    patchReply = () => Promise.resolve(json({ error: 'sign in again' }, 401));
    await loaded();
    fireEvent.click(within(cards()[0]!).getByRole('button', { name: 'Mark fixed' }));
    await waitFor(() => expect(onUnauthorized).toHaveBeenCalled());
  });

  it('loads each photo with the founder pass and shows it small', async () => {
    await loaded();
    await waitFor(() => expect(screen.getAllByTestId('founder-issue-photo')).toHaveLength(2));
    const photoCall = fetchMock.mock.calls.find(([url]) => (url as string).includes('/photos/'))!;
    expect(photoCall[0]).toMatch(/\/api\/founder\/issues\/i-new\/photos\/p1$/);
    expect(photoCall[1].headers['x-founder-token']).toBe('tok');
    expect(screen.getAllByTestId('founder-issue-photo')[0]!.querySelector('img')).toHaveAttribute(
      'src',
      'blob:issue-photo-1',
    );
  });

  it('opens a photo large, and Close shuts it', async () => {
    await loaded();
    fireEvent.click(await screen.findByRole('button', { name: 'Open photo 1 of 2 large' }));
    const dialog = screen.getByRole('dialog', { name: 'Photo 1 of 2' });
    expect(within(dialog).getByTestId('founder-issue-photo-large')).toHaveAttribute(
      'src',
      'blob:issue-photo-1',
    );
    fireEvent.click(within(dialog).getByRole('button', { name: 'Close' }));
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('shuts the large photo with Escape', async () => {
    await loaded();
    fireEvent.click(await screen.findByRole('button', { name: 'Open photo 2 of 2 large' }));
    expect(screen.getByRole('dialog', { name: 'Photo 2 of 2' })).toBeInTheDocument();
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('does not fetch a photo again after switching between New and Fixed', async () => {
    await loaded();
    await waitFor(() => expect(screen.getAllByTestId('founder-issue-photo')).toHaveLength(2));
    fireEvent.click(screen.getByRole('button', { name: 'Fixed 1' }));
    fireEvent.click(screen.getByRole('button', { name: 'New 2' }));
    await waitFor(() => expect(screen.getAllByTestId('founder-issue-photo')).toHaveLength(2));
    const photoCalls = fetchMock.mock.calls.filter(([url]) => (url as string).includes('/photos/'));
    expect(photoCalls).toHaveLength(2);
  });

  it('lets the founder tap a photo that did not load to try again', async () => {
    photoReply = () => Promise.resolve({ ok: false, status: 500, blob: async () => new Blob() });
    await loaded();
    const retry = await screen.findAllByRole('button', { name: 'Try loading photo again' });
    expect(retry).toHaveLength(2);
    expect(retry[0]).toHaveClass('h-20', 'w-20');

    photoReply = photoBytes;
    fireEvent.click(retry[0]!);
    await waitFor(() => expect(screen.getAllByTestId('founder-issue-photo')).toHaveLength(1));
    expect(screen.getAllByRole('button', { name: 'Try loading photo again' })).toHaveLength(1);
  });

  it('locks the page when the pass runs out while loading a photo', async () => {
    photoReply = () => Promise.resolve({ ok: false, status: 401, blob: async () => new Blob() });
    await loaded();
    await waitFor(() => expect(onUnauthorized).toHaveBeenCalled());
  });

  it("waits to download a card's photos until the card is near the screen", async () => {
    const watchers: Array<(entries: Array<{ isIntersecting: boolean }>) => void> = [];
    const margins: string[] = [];
    vi.stubGlobal(
      'IntersectionObserver',
      class {
        constructor(
          cb: (entries: Array<{ isIntersecting: boolean }>) => void,
          opts?: { rootMargin?: string },
        ) {
          watchers.push(cb);
          margins.push(opts?.rootMargin ?? '');
        }
        observe() {}
        disconnect() {}
      },
    );
    await loaded();
    const photoCalls = () =>
      fetchMock.mock.calls.filter(([url]) => (url as string).includes('/photos/'));
    expect(screen.getAllByTestId('founder-issue-photo-loading')).toHaveLength(2);
    expect(photoCalls()).toHaveLength(0);
    expect(margins[0]).toBe('300px 0px');

    await act(async () => watchers[0]!([{ isIntersecting: true }]));
    await waitFor(() => expect(screen.getAllByTestId('founder-issue-photo')).toHaveLength(2));
    expect(photoCalls()).toHaveLength(2);
  });

  it('moves the keyboard to the next card after Mark fixed', async () => {
    await loaded();
    fireEvent.click(within(cards()[0]!).getByRole('button', { name: 'Mark fixed' }));
    expect(cardTitles()).toEqual(['The Calendar']);
    expect(within(cards()[0]!).getByRole('button', { name: 'Mark fixed' })).toHaveFocus();
  });

  it('moves the keyboard to the New and Fixed choice when the last card leaves the list', async () => {
    patchReply = () => Promise.resolve(json({ id: 'i-fixed', status: 'new', fixedAt: null }));
    await loaded();
    fireEvent.click(screen.getByRole('button', { name: 'Fixed 1' }));
    fireEvent.click(screen.getByRole('button', { name: 'Reopen' }));
    expect(screen.getByRole('button', { name: 'Fixed 0' })).toHaveFocus();
  });

  it('lets go of the photos when the page closes', async () => {
    const { unmount } = renderSection();
    await waitFor(() => expect(screen.getAllByTestId('founder-issue-photo')).toHaveLength(2));
    unmount();
    expect(revokeObjectURL).toHaveBeenCalledWith('blob:issue-photo-1');
    expect(revokeObjectURL).toHaveBeenCalledWith('blob:issue-photo-2');
  });

  it('says "No issues to fix. Nice." when nothing is waiting', async () => {
    listReply = () => Promise.resolve(json({ issues: [ISSUES[2]] }));
    await loaded();
    expect(screen.getByTestId('founder-issues-empty')).toHaveTextContent('No issues to fix. Nice.');
    expect(cards()).toHaveLength(0);
  });

  it('says "Nothing marked fixed yet." when nothing is fixed', async () => {
    listReply = () => Promise.resolve(json({ issues: [ISSUES[0]] }));
    await loaded();
    fireEvent.click(screen.getByRole('button', { name: 'Fixed 0' }));
    expect(screen.getByTestId('founder-issues-empty')).toHaveTextContent(
      'Nothing marked fixed yet.',
    );
  });

  it('shows an error with Try again when the list cannot load, and Try again works', async () => {
    listReply = () => Promise.reject(new TypeError('network down'));
    renderSection();
    const error = await screen.findByTestId('founder-issues-error');
    expect(error).toHaveAttribute('role', 'alert');
    expect(error).toHaveTextContent('Could not load issues. Check your connection.');

    listReply = () => Promise.resolve(json({ issues: ISSUES }));
    fireEvent.click(within(error).getByRole('button', { name: 'Try again' }));
    await waitFor(() => expect(cardTitles()).toEqual(['Weekly Meals', 'The Calendar']));
  });

  it('locks the page when the pass has run out', async () => {
    listReply = () => Promise.resolve(json({ error: 'sign in again' }, 401));
    renderSection();
    await waitFor(() => expect(onUnauthorized).toHaveBeenCalled());
  });

  // jsdom cannot measure layout, so this pins what keeps the cards usable at
  // 375px. Each card stacks, and every control stays finger sized.
  describe('on a 375px phone', () => {
    beforeEach(() => {
      Object.defineProperty(window, 'innerWidth', { configurable: true, value: 375 });
    });

    it('stacks the Mark fixed button under the details instead of squeezing them', async () => {
      await loaded();
      const button = within(cards()[0]!).getByRole('button', { name: 'Mark fixed' });
      expect(button.parentElement).toHaveClass('flex-col', 'sm:flex-row');
      expect(button).toHaveClass('min-h-[44px]');
    });

    it('wraps long family names, emails and words rather than running off the edge', async () => {
      await loaded();
      const card = cards()[0]!;
      for (const text of ['Add meal does nothing', 'Sam Smith · sam@example.com', 'Smith Family']) {
        expect(within(card).getByText(text)).toHaveClass('break-words', '[overflow-wrap:anywhere]');
      }
      expect(within(card).getByRole('heading')).toHaveClass('[overflow-wrap:anywhere]');
    });

    it('keeps the New and Fixed choices and the photos big enough to tap', async () => {
      await loaded();
      for (const name of ['New 2', 'Fixed 1']) {
        expect(screen.getByRole('button', { name })).toHaveClass('min-h-[44px]');
      }
      expect(screen.getByRole('group', { name: 'Show issues' })).toHaveClass('flex-wrap');
      const photo = await screen.findByRole('button', { name: 'Open photo 1 of 2 large' });
      expect(photo).toHaveClass('h-20', 'w-20');
    });
  });
});
