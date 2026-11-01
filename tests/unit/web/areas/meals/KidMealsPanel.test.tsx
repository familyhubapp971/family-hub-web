import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';

// FHS-365: kid Meals tab reads GET /api/kid/meals (server-scoped to the kid +
// family). Renders the day grid; shows an empty state when there are none.

import { KidMealsPanel } from '../../../../../src/areas/meals/KidMealsPanel';

const fetchMock = vi.fn();
beforeEach(() => {
  fetchMock.mockReset();
  vi.stubGlobal('fetch', fetchMock);
});
afterEach(() => vi.unstubAllGlobals());

describe('<KidMealsPanel />', () => {
  it('renders the kid meals from GET /api/kid/meals', async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        meals: [
          {
            id: 'm1',
            dayOfWeek: 'mon',
            slot: 'lunch',
            name: 'Pasta',
            memberId: null,
            recurring: false,
          },
        ],
      }),
    });
    render(<KidMealsPanel kidToken="kid.jwt" />);
    await waitFor(() => expect(screen.getByTestId('kid-meals-tab')).toBeInTheDocument());
    expect(screen.getByText('Pasta')).toBeInTheDocument();
  });

  it('shows an empty state when there are no meals', async () => {
    fetchMock.mockResolvedValue({ ok: true, status: 200, json: async () => ({ meals: [] }) });
    render(<KidMealsPanel kidToken="kid.jwt" />);
    await waitFor(() => expect(screen.getByTestId('kid-meals-empty')).toBeInTheDocument());
  });

  it('shows an error state when the request fails', async () => {
    fetchMock.mockResolvedValue({ ok: false, status: 500, json: async () => ({}) });
    render(<KidMealsPanel kidToken="kid.jwt" />);
    await waitFor(() => expect(screen.getByTestId('kid-meals-error')).toBeInTheDocument());
  });
});
