import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';

// FHS-365: kid Calendar tab reads GET /api/kid/events (server-scoped to the
// kid + family for the week). Renders the schedule; empty state when none.

import { KidCalendarPanel } from '../../../../../src/areas/calendar/KidCalendarPanel';

const fetchMock = vi.fn();
beforeEach(() => {
  fetchMock.mockReset();
  vi.stubGlobal('fetch', fetchMock);
});
afterEach(() => vi.unstubAllGlobals());

describe('<KidCalendarPanel />', () => {
  it('renders the kid events from GET /api/kid/events', async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        weekStart: '2026-06-15',
        events: [
          {
            id: 'e1',
            date: '2026-06-15',
            startTime: '09:00',
            endTime: '10:00',
            title: 'Football',
            notes: null,
            memberId: null,
            type: 'school',
            location: 'Park',
            wear: 'Kit',
          },
        ],
      }),
    });
    render(<KidCalendarPanel kidToken="kid.jwt" />);
    await waitFor(() => expect(screen.getByTestId('kid-calendar-tab')).toBeInTheDocument());
    expect(screen.getByText('Football')).toBeInTheDocument();
    expect(screen.getByText('Park')).toBeInTheDocument();
  });

  it('shows an empty state when there are no events', async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ weekStart: '2026-06-15', events: [] }),
    });
    render(<KidCalendarPanel kidToken="kid.jwt" />);
    await waitFor(() => expect(screen.getByTestId('kid-calendar-empty')).toBeInTheDocument());
  });

  it('shows an error state when the request fails', async () => {
    fetchMock.mockResolvedValue({ ok: false, status: 500, json: async () => ({}) });
    render(<KidCalendarPanel kidToken="kid.jwt" />);
    await waitFor(() => expect(screen.getByTestId('kid-calendar-error')).toBeInTheDocument());
  });
});
