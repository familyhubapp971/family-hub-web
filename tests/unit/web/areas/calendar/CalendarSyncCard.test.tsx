import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';

// FHS-445: "Sync to your calendar" card. Collapsed by default; on first open it
// loads the family subscribe URL and (for admins) exposes "Regenerate link".

const fetchMock = vi.fn();
const writeText = vi.fn(() => Promise.resolve());

import { CalendarSyncCard } from '../../../../../src/areas/calendar/CalendarSyncCard';

const HEADERS = { Authorization: 'Bearer tok', 'x-tenant-slug': 'smith' };
const FEED_URL = 'https://api.example.com/api/public/calendar/tid.sig.ics';

function installApi(callerRole: 'admin' | 'adult' = 'admin') {
  fetchMock.mockImplementation((url: string, init?: RequestInit) => {
    const u = String(url);
    if (u.includes('/api/calendar/feed/rotate') && init?.method === 'POST') {
      return Promise.resolve({
        ok: true,
        status: 200,
        json: async () => ({ url: `${FEED_URL}?v2` }),
      });
    }
    if (u.includes('/api/calendar/feed')) {
      return Promise.resolve({ ok: true, status: 200, json: async () => ({ url: FEED_URL }) });
    }
    if (u.includes('/api/members')) {
      return Promise.resolve({ ok: true, status: 200, json: async () => ({ callerRole }) });
    }
    return Promise.resolve({ ok: false, status: 404, json: async () => ({}) });
  });
}

beforeEach(() => {
  fetchMock.mockReset();
  writeText.mockReset();
  vi.stubGlobal('fetch', fetchMock);
  Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true });
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('CalendarSyncCard', () => {
  it('is collapsed by default and does not fetch the feed', () => {
    installApi();
    render(<CalendarSyncCard headers={HEADERS} />);
    expect(screen.getByTestId('calendar-sync-toggle')).toBeTruthy();
    expect(screen.queryByTestId('calendar-sync-url')).toBeNull();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('loads and shows the subscribe URL when opened', async () => {
    installApi();
    render(<CalendarSyncCard headers={HEADERS} />);
    fireEvent.click(screen.getByTestId('calendar-sync-toggle'));
    await waitFor(() => expect(screen.getByTestId('calendar-sync-url').textContent).toBe(FEED_URL));
  });

  it('copies the URL to the clipboard', async () => {
    installApi();
    render(<CalendarSyncCard headers={HEADERS} />);
    fireEvent.click(screen.getByTestId('calendar-sync-toggle'));
    await waitFor(() => screen.getByTestId('calendar-sync-copy'));
    fireEvent.click(screen.getByTestId('calendar-sync-copy'));
    await waitFor(() => expect(writeText).toHaveBeenCalledWith(FEED_URL));
  });

  it('shows the regenerate action to admins', async () => {
    installApi('admin');
    render(<CalendarSyncCard headers={HEADERS} />);
    fireEvent.click(screen.getByTestId('calendar-sync-toggle'));
    await waitFor(() => expect(screen.getByTestId('calendar-sync-rotate')).toBeTruthy());
  });

  it('hides the regenerate action from non-admins', async () => {
    installApi('adult');
    render(<CalendarSyncCard headers={HEADERS} />);
    fireEvent.click(screen.getByTestId('calendar-sync-toggle'));
    await waitFor(() => screen.getByTestId('calendar-sync-url'));
    expect(screen.queryByTestId('calendar-sync-rotate')).toBeNull();
  });

  it('regenerates the link and swaps the URL when confirmed', async () => {
    installApi('admin');
    render(<CalendarSyncCard headers={HEADERS} />);
    fireEvent.click(screen.getByTestId('calendar-sync-toggle'));
    await waitFor(() => screen.getByTestId('calendar-sync-rotate'));
    fireEvent.click(screen.getByTestId('calendar-sync-rotate'));
    fireEvent.click(await screen.findByTestId('confirm-dialog-confirm'));
    await waitFor(() =>
      expect(screen.getByTestId('calendar-sync-url').textContent).toBe(`${FEED_URL}?v2`),
    );
  });

  it('shows an error and keeps the old link when regenerate fails', async () => {
    installApi('admin');
    // Make only the rotate call fail; feed + members still succeed.
    fetchMock.mockImplementation((url: string, init?: RequestInit) => {
      const u = String(url);
      if (u.includes('/api/calendar/feed/rotate') && init?.method === 'POST') {
        return Promise.resolve({ ok: false, status: 500, json: async () => ({}) });
      }
      if (u.includes('/api/calendar/feed')) {
        return Promise.resolve({ ok: true, status: 200, json: async () => ({ url: FEED_URL }) });
      }
      return Promise.resolve({
        ok: true,
        status: 200,
        json: async () => ({ callerRole: 'admin' }),
      });
    });
    render(<CalendarSyncCard headers={HEADERS} />);
    fireEvent.click(screen.getByTestId('calendar-sync-toggle'));
    await waitFor(() => screen.getByTestId('calendar-sync-rotate'));
    fireEvent.click(screen.getByTestId('calendar-sync-rotate'));
    fireEvent.click(await screen.findByTestId('confirm-dialog-confirm'));
    await waitFor(() => expect(screen.getByTestId('calendar-sync-rotate-error')).toBeTruthy());
    // Old URL is unchanged: the compromised link is (correctly) still shown as live.
    expect(screen.getByTestId('calendar-sync-url').textContent).toBe(FEED_URL);
  });
});
