import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';

// FHS-269: ChildWorld Meals tab (read-only, child-filtered).

const fetchMock = vi.fn();
const authState: { session: { access_token?: string } | null } = {
  session: { access_token: 'tok-abc' },
};
vi.mock('../../../../../src/app/lib/auth-context', () => ({
  useAuth: () => authState,
}));

import { MealsTab } from '../../../../../src/areas/meals/MealsTab';
import { TenantProvider } from '../../../../../src/app/lib/tenant-context';

const CHILD = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc';
const OTHER = 'dddddddd-dddd-4ddd-8ddd-dddddddddddd';

function meal(over: Record<string, unknown>) {
  return {
    id: 'm1',
    dayOfWeek: 'mon',
    slot: 'breakfast',
    name: 'Porridge',
    memberId: null,
    recurring: false,
    ...over,
  };
}

function installMeals(meals: unknown[]) {
  fetchMock.mockResolvedValue({ ok: true, status: 200, json: async () => ({ meals }) });
}

function renderTab() {
  return render(
    <MemoryRouter initialEntries={['/t/khan/child/' + CHILD]}>
      <Routes>
        <Route
          path="/t/:slug/child/:memberId"
          element={
            <TenantProvider>
              <MealsTab memberId={CHILD} />
            </TenantProvider>
          }
        />
      </Routes>
    </MemoryRouter>,
  );
}

beforeEach(() => {
  fetchMock.mockReset();
  vi.stubGlobal('fetch', fetchMock);
  authState.session = { access_token: 'tok-abc' };
});
afterEach(() => vi.unstubAllGlobals());

describe('<MealsTab />', () => {
  it('shows the empty state when the child has no meals', async () => {
    installMeals([{ ...meal({ id: 'x', memberId: OTHER, name: 'Sushi' }) }]);
    renderTab();
    await waitFor(() => expect(screen.getByTestId('meals-empty')).toBeInTheDocument());
  });

  it('renders this child + whole-family meals, hiding other members and empty cells', async () => {
    installMeals([
      meal({ id: 'm1', dayOfWeek: 'mon', slot: 'breakfast', name: 'Porridge', memberId: null }),
      meal({ id: 'm2', dayOfWeek: 'mon', slot: 'lunch', name: 'Pasta', memberId: CHILD }),
      meal({ id: 'm3', dayOfWeek: 'tue', slot: 'dinner', name: 'Steak', memberId: OTHER }),
      meal({ id: 'm4', dayOfWeek: 'wed', slot: 'snack', name: '', memberId: CHILD }), // empty cell
    ]);
    renderTab();
    await waitFor(() => expect(screen.getByTestId('meals-tab')).toBeInTheDocument());
    expect(screen.getByTestId('meal-item-m1')).toBeInTheDocument();
    expect(screen.getByTestId('meal-item-m2')).toBeInTheDocument();
    expect(screen.queryByTestId('meal-item-m3')).not.toBeInTheDocument(); // other member
    expect(screen.queryByTestId('meal-item-m4')).not.toBeInTheDocument(); // empty cell
    expect(screen.getByTestId('meal-day-mon')).toBeInTheDocument();
    expect(screen.queryByTestId('meal-day-tue')).not.toBeInTheDocument();
  });

  it('renders an error state on a failed load', async () => {
    fetchMock.mockResolvedValue({ ok: false, status: 500, json: async () => ({}) });
    renderTab();
    await waitFor(() => expect(screen.getByTestId('meals-error')).toBeInTheDocument());
  });

  it('renders an error state when the request throws (network)', async () => {
    fetchMock.mockRejectedValue(new Error('offline'));
    renderTab();
    await waitFor(() => expect(screen.getByTestId('meals-error')).toBeInTheDocument());
  });

  it('does not crash if a meal name is null (defensive)', async () => {
    installMeals([
      meal({ id: 'm1', name: null, memberId: CHILD }),
      meal({ id: 'm2', name: 'Toast', memberId: CHILD }),
    ]);
    renderTab();
    await waitFor(() => expect(screen.getByTestId('meals-tab')).toBeInTheDocument());
    expect(screen.queryByTestId('meal-item-m1')).not.toBeInTheDocument();
    expect(screen.getByTestId('meal-item-m2')).toBeInTheDocument();
  });

  it('has no create / edit / delete controls (read-only)', async () => {
    installMeals([meal({ id: 'm1', memberId: CHILD, name: 'Porridge' })]);
    renderTab();
    await waitFor(() => expect(screen.getByTestId('meals-tab')).toBeInTheDocument());
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
    expect(screen.queryByRole('textbox')).not.toBeInTheDocument();
  });
});
