import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor, fireEvent, act } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';

// FHS-512: "Pocket money" reward-config settings screen. MONEY-CRITICAL:
// every assertion here works in INTEGER MINOR UNITS end to end.

const fetchMock = vi.fn();
const authState: {
  session: { access_token?: string } | null;
  user: { email?: string; id?: string; user_metadata?: Record<string, unknown> } | null;
} = {
  session: { access_token: 'tok-admin' },
  user: { email: 'sarah@example.com', id: 'u-admin', user_metadata: {} },
};

vi.mock('../../../../../src/app/lib/auth-context', () => ({
  useAuth: () => authState,
  signOutAll: vi.fn().mockResolvedValue({ error: null }),
  getKidToken: () => null,
  clearKidToken: vi.fn(),
}));

import { RewardSettingsPage } from '../../../../../src/areas/settings/RewardSettingsPage';
import { TenantProvider } from '../../../../../src/app/lib/tenant-context';

const KID_ID = 'kid-uuid-1111';
const HABIT_ID = 'habit-uuid-aaaa';

const MEMBERS = [
  { id: 'admin-1', displayName: 'Sarah', role: 'admin', avatarEmoji: null, isChild: false },
  { id: KID_ID, displayName: 'Amina', role: 'child', avatarEmoji: '🦄', isChild: true },
];

const REWARD_CONFIG = {
  currency: 'AED',
  familyRateMinor: 50,
  members: [
    {
      memberId: KID_ID,
      displayName: 'Amina',
      avatarEmoji: '🦄',
      rateMinor: null,
      effectiveRateMinor: 50,
    },
  ],
};

const HABITS = [
  {
    id: HABIT_ID,
    name: 'Read a book',
    description: null,
    color: '#facc15',
    icon: null,
    isBonus: false,
    boost: 1,
    skipPenaltyMinor: 0,
  },
];

const HABIT_ID_2 = 'habit-uuid-bbbb';
const HABITS_TWO = [
  ...HABITS,
  {
    id: HABIT_ID_2,
    name: 'Make the bed',
    description: null,
    color: '#38bdf8',
    icon: null,
    isBonus: false,
    boost: 2,
    skipPenaltyMinor: 25,
  },
];

function installApi(
  overrides: {
    callerRole?: string;
    rewardConfig?: typeof REWARD_CONFIG;
    habits?: typeof HABITS;
  } = {},
) {
  const callerRole = overrides.callerRole ?? 'admin';
  const rewardConfig = overrides.rewardConfig ?? REWARD_CONFIG;
  const habitsData = overrides.habits ?? HABITS;
  fetchMock.mockImplementation((url: string, init?: RequestInit) => {
    const u = String(url);
    if (/\/api\/me(\?|$)/.test(u))
      return Promise.resolve({
        ok: true,
        status: 200,
        json: async () => ({
          id: 'u-admin',
          email: 'sarah@example.com',
          tenants: [{ id: 't-1', slug: 'khans', name: 'The Khans', role: callerRole }],
        }),
      });
    if (u.includes('/api/dashboard/today'))
      return Promise.resolve({
        ok: true,
        status: 200,
        json: async () => ({ date: '2026-06-15', callerMemberId: 'admin-1', members: [] }),
      });
    if (u.includes('/api/reward-config') && init?.method === 'PUT') {
      return Promise.resolve({ ok: true, status: 200, json: async () => rewardConfig });
    }
    if (u.includes('/api/reward-config')) {
      return Promise.resolve({ ok: true, status: 200, json: async () => rewardConfig });
    }
    if (u.includes('/api/members'))
      return Promise.resolve({
        ok: true,
        status: 200,
        json: async () => ({ members: MEMBERS, callerRole }),
      });
    if (u.includes('/api/habits/') && init?.method === 'PUT') {
      return Promise.resolve({ ok: true, status: 200, json: async () => ({ ...habitsData[0] }) });
    }
    if (u.includes('/api/habits'))
      return Promise.resolve({ ok: true, status: 200, json: async () => ({ habits: habitsData }) });
    return Promise.resolve({ ok: true, status: 200, json: async () => ({}) });
  });
}

function renderAt(path = '/t/khans/reward-settings') {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route
          path="/t/:slug/reward-settings"
          element={
            <TenantProvider>
              <RewardSettingsPage />
            </TenantProvider>
          }
        />
        <Route path="/t/:slug/dashboard" element={<div data-testid="dashboard-page" />} />
      </Routes>
    </MemoryRouter>,
  );
}

beforeEach(() => {
  fetchMock.mockReset();
  vi.stubGlobal('fetch', fetchMock);
  authState.session = { access_token: 'tok-admin' };
  installApi();
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('<RewardSettingsPage />', () => {
  it('renders the family default rate loaded from the API', async () => {
    renderAt();
    await waitFor(() =>
      expect(
        (screen.getByTestId('reward-settings-family-rate-input') as HTMLInputElement).value,
      ).toBe('0.50'),
    );
  });

  it('shows a read-only notice and hides the Save bar for a non-admin caller', async () => {
    installApi({ callerRole: 'adult' });
    renderAt();
    await waitFor(() =>
      expect(screen.getByTestId('reward-settings-readonly-notice')).toBeInTheDocument(),
    );
    expect(screen.queryByTestId('reward-settings-save-btn')).toBeNull();
  });

  it('shows the Save bar for an admin', async () => {
    renderAt();
    await waitFor(() => expect(screen.getByTestId('reward-settings-save-btn')).toBeInTheDocument());
  });

  it('lists each kid with a "Different amount" toggle, off by default when they have no override', async () => {
    renderAt();
    await waitFor(() =>
      expect(screen.getByTestId(`reward-settings-kid-${KID_ID}-toggle`)).toBeInTheDocument(),
    );
    expect(screen.getByTestId(`reward-settings-kid-${KID_ID}-toggle`)).toHaveAttribute(
      'aria-checked',
      'false',
    );
    // The per-child rate picker is hidden until the toggle is on.
    expect(screen.queryByTestId(`reward-settings-kid-${KID_ID}-rate`)).toBeNull();
  });

  it('turning on the per-child toggle reveals an AmountPicker seeded from the family rate', async () => {
    renderAt();
    await waitFor(() =>
      expect(screen.getByTestId(`reward-settings-kid-${KID_ID}-toggle`)).toBeInTheDocument(),
    );
    fireEvent.click(screen.getByTestId(`reward-settings-kid-${KID_ID}-toggle`));
    await waitFor(() =>
      expect(screen.getByTestId(`reward-settings-kid-${KID_ID}-rate-input`)).toBeInTheDocument(),
    );
    expect(
      (screen.getByTestId(`reward-settings-kid-${KID_ID}-rate-input`) as HTMLInputElement).value,
    ).toBe('0.50');
  });

  it('an existing per-child override starts with the toggle ON and the override rate shown', async () => {
    installApi({
      rewardConfig: {
        ...REWARD_CONFIG,
        members: [{ ...REWARD_CONFIG.members[0]!, rateMinor: 100, effectiveRateMinor: 100 }],
      },
    });
    renderAt();
    await waitFor(() =>
      expect(screen.getByTestId(`reward-settings-kid-${KID_ID}-toggle`)).toHaveAttribute(
        'aria-checked',
        'true',
      ),
    );
    expect(
      (screen.getByTestId(`reward-settings-kid-${KID_ID}-rate-input`) as HTMLInputElement).value,
    ).toBe('1.00');
  });

  it('Save PUTs the family rate + per-child overrides in integer minor units', async () => {
    renderAt();
    await waitFor(() => expect(screen.getByTestId('reward-settings-save-btn')).toBeInTheDocument());

    // Bump the family rate to 0.75 via the increment button (default step 0.25).
    fireEvent.click(screen.getByTestId('reward-settings-family-rate-increment'));

    // Turn on Amina's override and set it to 1.00.
    fireEvent.click(screen.getByTestId(`reward-settings-kid-${KID_ID}-toggle`));
    await waitFor(() =>
      expect(screen.getByTestId(`reward-settings-kid-${KID_ID}-rate-input`)).toBeInTheDocument(),
    );
    fireEvent.change(screen.getByTestId(`reward-settings-kid-${KID_ID}-rate-input`), {
      target: { value: '1.00' },
    });

    await act(async () => {
      fireEvent.click(screen.getByTestId('reward-settings-save-btn'));
    });

    await waitFor(() => {
      const putCall = fetchMock.mock.calls.find(
        ([url, init]) =>
          String(url).includes('/api/reward-config') &&
          (init as RequestInit | undefined)?.method === 'PUT',
      );
      expect(putCall).toBeDefined();
      const body = JSON.parse((putCall![1] as RequestInit).body as string) as {
        familyRateMinor: number;
        memberOverrides: Array<{ memberId: string; rateMinor: number | null }>;
      };
      expect(body.familyRateMinor).toBe(75);
      expect(Number.isInteger(body.familyRateMinor)).toBe(true);
      expect(body.memberOverrides).toEqual([{ memberId: KID_ID, rateMinor: 100 }]);
    });
  });

  it('turning the toggle back off sends rateMinor: null to clear the override', async () => {
    installApi({
      rewardConfig: {
        ...REWARD_CONFIG,
        members: [{ ...REWARD_CONFIG.members[0]!, rateMinor: 100, effectiveRateMinor: 100 }],
      },
    });
    renderAt();
    await waitFor(() =>
      expect(screen.getByTestId(`reward-settings-kid-${KID_ID}-toggle`)).toHaveAttribute(
        'aria-checked',
        'true',
      ),
    );
    fireEvent.click(screen.getByTestId(`reward-settings-kid-${KID_ID}-toggle`)); // turn off
    await act(async () => {
      fireEvent.click(screen.getByTestId('reward-settings-save-btn'));
    });
    await waitFor(() => {
      const putCall = fetchMock.mock.calls.find(
        ([url, init]) =>
          String(url).includes('/api/reward-config') &&
          (init as RequestInit | undefined)?.method === 'PUT',
      );
      const body = JSON.parse((putCall![1] as RequestInit).body as string) as {
        memberOverrides: Array<{ memberId: string; rateMinor: number | null }>;
      };
      expect(body.memberOverrides).toEqual([{ memberId: KID_ID, rateMinor: null }]);
    });
  });

  it("pre-selects the family's only habit and shows its name + boost picker without an extra tap", async () => {
    renderAt();
    await waitFor(() =>
      expect(screen.getByTestId('reward-settings-habit-name').textContent).toBe('Read a book'),
    );
    expect(screen.getByTestId('reward-settings-boost-1')).toBeInTheDocument();
    // Only one habit → no dropdown needed.
    expect(screen.queryByTestId('reward-settings-habit-select')).toBeNull();
  });

  it('shows a habit picker when the child has more than one habit, and Save targets the picked habit', async () => {
    installApi({ habits: HABITS_TWO });
    renderAt();
    // Defaults to the first habit's own saved boost (1x).
    await waitFor(() =>
      expect(screen.getByTestId('reward-settings-boost-1')).toHaveAttribute('aria-pressed', 'true'),
    );

    fireEvent.change(screen.getByTestId('reward-settings-habit-select'), {
      target: { value: HABIT_ID_2 },
    });
    // Switches to the second habit's own saved boost (2x): not a shared value.
    await waitFor(() =>
      expect(screen.getByTestId('reward-settings-boost-2')).toHaveAttribute('aria-pressed', 'true'),
    );

    await act(async () => {
      fireEvent.click(screen.getByTestId('reward-settings-save-btn'));
    });

    await waitFor(() => {
      const putCall = fetchMock.mock.calls.find(
        ([url, init]) =>
          String(url).includes(`/api/habits/${HABIT_ID_2}`) &&
          (init as RequestInit | undefined)?.method === 'PUT',
      );
      expect(putCall).toBeDefined();
    });
  });

  it('lets the admin set the boost, showing the live payout preview', async () => {
    renderAt();
    await waitFor(() => expect(screen.getByTestId('reward-settings-boost-3')).toBeInTheDocument());
    fireEvent.click(screen.getByTestId('reward-settings-boost-3'));
    // Family rate 0.50 * boost 3 = AED 1.50.
    await waitFor(() =>
      expect(screen.getByTestId('reward-settings-boost-result').textContent).toContain('1.50'),
    );
  });

  it('choosing the skip-penalty option reveals the penalty amount picker', async () => {
    renderAt();
    await waitFor(() =>
      expect(screen.getByTestId('reward-settings-skip-penalty')).toBeInTheDocument(),
    );
    expect(screen.queryByTestId('reward-settings-penalty-amount')).toBeNull();
    fireEvent.click(screen.getByTestId('reward-settings-skip-penalty'));
    await waitFor(() =>
      expect(screen.getByTestId('reward-settings-penalty-amount')).toBeInTheDocument(),
    );
  });

  it('Save PUTs the habit boost + skipPenaltyMinor as integers', async () => {
    renderAt();
    await waitFor(() => expect(screen.getByTestId('reward-settings-boost-5')).toBeInTheDocument());
    fireEvent.click(screen.getByTestId('reward-settings-boost-5'));
    fireEvent.click(screen.getByTestId('reward-settings-skip-penalty'));
    await waitFor(() =>
      expect(screen.getByTestId('reward-settings-penalty-amount-input')).toBeInTheDocument(),
    );
    fireEvent.change(screen.getByTestId('reward-settings-penalty-amount-input'), {
      target: { value: '0.25' },
    });

    await act(async () => {
      fireEvent.click(screen.getByTestId('reward-settings-save-btn'));
    });

    await waitFor(() => {
      const putCall = fetchMock.mock.calls.find(
        ([url, init]) =>
          String(url).includes(`/api/habits/${HABIT_ID}`) &&
          (init as RequestInit | undefined)?.method === 'PUT',
      );
      expect(putCall).toBeDefined();
      const body = JSON.parse((putCall![1] as RequestInit).body as string) as {
        boost: number;
        skipPenaltyMinor: number;
      };
      expect(body.boost).toBe(5);
      expect(body.skipPenaltyMinor).toBe(25);
      expect(Number.isInteger(body.skipPenaltyMinor)).toBe(true);
    });
  });

  it('choosing "Nothing happens" sends skipPenaltyMinor: 0 even if a penalty amount was set earlier', async () => {
    renderAt();
    await waitFor(() =>
      expect(screen.getByTestId('reward-settings-skip-penalty')).toBeInTheDocument(),
    );
    fireEvent.click(screen.getByTestId('reward-settings-skip-penalty'));
    await waitFor(() =>
      expect(screen.getByTestId('reward-settings-penalty-amount-input')).toBeInTheDocument(),
    );
    fireEvent.click(screen.getByTestId('reward-settings-skip-none'));

    await act(async () => {
      fireEvent.click(screen.getByTestId('reward-settings-save-btn'));
    });

    await waitFor(() => {
      const putCall = fetchMock.mock.calls.find(
        ([url, init]) =>
          String(url).includes(`/api/habits/${HABIT_ID}`) &&
          (init as RequestInit | undefined)?.method === 'PUT',
      );
      const body = JSON.parse((putCall![1] as RequestInit).body as string) as {
        skipPenaltyMinor: number;
      };
      expect(body.skipPenaltyMinor).toBe(0);
    });
  });

  it('shows the server error detail when the save fails', async () => {
    fetchMock.mockImplementation((url: string, init?: RequestInit) => {
      const u = String(url);
      if (/\/api\/me(\?|$)/.test(u))
        return Promise.resolve({
          ok: true,
          status: 200,
          json: async () => ({
            id: 'u-admin',
            tenants: [{ id: 't-1', slug: 'khans', name: 'The Khans', role: 'admin' }],
          }),
        });
      if (u.includes('/api/dashboard/today'))
        return Promise.resolve({
          ok: true,
          status: 200,
          json: async () => ({ date: '2026-06-15', members: [] }),
        });
      if (u.includes('/api/reward-config') && init?.method === 'PUT')
        return Promise.resolve({
          ok: false,
          status: 403,
          json: async () => ({ error: 'forbidden', detail: 'admin role required' }),
        });
      if (u.includes('/api/reward-config'))
        return Promise.resolve({ ok: true, status: 200, json: async () => REWARD_CONFIG });
      if (u.includes('/api/members'))
        return Promise.resolve({
          ok: true,
          status: 200,
          json: async () => ({ members: MEMBERS, callerRole: 'admin' }),
        });
      if (u.includes('/api/habits'))
        return Promise.resolve({ ok: true, status: 200, json: async () => ({ habits: HABITS }) });
      return Promise.resolve({ ok: true, status: 200, json: async () => ({}) });
    });
    renderAt();
    await waitFor(() => expect(screen.getByTestId('reward-settings-save-btn')).toBeInTheDocument());
    await act(async () => {
      fireEvent.click(screen.getByTestId('reward-settings-save-btn'));
    });
    await waitFor(() =>
      expect(screen.getByTestId('reward-settings-save-error').textContent).toContain(
        'admin role required',
      ),
    );
  });
});
