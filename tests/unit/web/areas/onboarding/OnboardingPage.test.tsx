import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { OnboardingPage } from '../../../../../src/areas/onboarding/OnboardingPage';
import { TenantProvider } from '../../../../../src/app/lib/tenant-context';

// FHS-36 / FHS-432: OnboardingWizard tests.
//
// FHS-432 changes: timezone + currency are auto-detected and applied
// silently in step 3 (Location). No manual selection required on the
// happy path. Tests cover:
// - gate (skip wizard if onboarding_completed=true on mount)
// - back/forward without losing member-step state
// - auto-detected values are applied and submitted without the user
//   touching the pickers
// - "Change" affordance reveals the picker when clicked
// - fallback: manual picker shown when detection returns empty/invalid
// - final submit POSTs timezone + currency (payload unchanged)
// - progress bar reflects the current step count (now 4 steps)

const fetchMock = vi.fn();
const authState: { session: { access_token?: string } | null } = {
  session: { access_token: 'fake-jwt' },
};
vi.mock('../../../../../src/app/lib/auth-context', () => ({
  useAuth: () => authState,
}));

// Controls what the browser detection helpers return. Default: valid values.
const detectionMocks = {
  timezone: 'Europe/London',
  currency: 'GBP',
};
vi.mock('@familyhub/ui', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@familyhub/ui')>();
  return {
    ...actual,
    detectBrowserTimezone: () => detectionMocks.timezone,
    detectBrowserCurrency: () => detectionMocks.currency,
  };
});

function renderAt(initial: string) {
  return render(
    <MemoryRouter initialEntries={[initial]}>
      <Routes>
        <Route
          path="/t/:slug/onboarding"
          element={
            <TenantProvider>
              <OnboardingPage />
            </TenantProvider>
          }
        />
        <Route
          path="/t/:slug/dashboard"
          element={<div data-testid="route-marker">tenant-dashboard</div>}
        />
      </Routes>
    </MemoryRouter>,
  );
}

function mockNotOnboarded() {
  fetchMock.mockResolvedValueOnce({
    ok: true,
    json: async () => ({ tenants: [{ slug: 'khans', onboardingCompleted: false }] }),
  });
}

// FHR-25: the wizard looks up the founder's saved name separately. Answer that
// call here so the queued replies in each test still line up with their calls.
let todayReply: { ok: boolean; json?: () => Promise<unknown> } = { ok: false };

beforeEach(() => {
  fetchMock.mockReset();
  todayReply = { ok: false };
  vi.stubGlobal('fetch', (url: string, init?: RequestInit) =>
    String(url).includes('/api/dashboard/today')
      ? Promise.resolve(todayReply)
      : fetchMock(url, init),
  );
  authState.session = { access_token: 'fake-jwt' };
  // Reset to valid defaults.
  detectionMocks.timezone = 'Europe/London';
  detectionMocks.currency = 'GBP';
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('<OnboardingPage />', () => {
  it('redirects to /dashboard on mount when onboarding is already completed', async () => {
    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        tenants: [{ slug: 'khans', onboardingCompleted: true }],
      }),
    });
    renderAt('/t/khans/onboarding');
    await waitFor(() =>
      expect(screen.getByTestId('route-marker').textContent).toBe('tenant-dashboard'),
    );
    expect(fetchMock).toHaveBeenCalledWith(
      'http://localhost:3001/api/me',
      expect.objectContaining({
        headers: expect.objectContaining({ Authorization: 'Bearer fake-jwt' }),
      }),
    );
  });

  it('renders the wizard when the tenant has not been onboarded', async () => {
    mockNotOnboarded();
    renderAt('/t/khans/onboarding');
    await waitFor(() => expect(screen.getByTestId('onboarding-step-welcome')).toBeInTheDocument());
    // Stepper now shows 4 steps (FHS-432: Welcome, Members, Location, Done).
    expect(screen.getByTestId('onboarding-stepper').getAttribute('aria-label')).toMatch(
      /step 1 of 4/i,
    );
  });

  it('walks forward and back without losing member-step state', async () => {
    mockNotOnboarded();
    renderAt('/t/khans/onboarding');
    await waitFor(() => screen.getByTestId('onboarding-step-welcome'));

    // Step 1 → 2.
    fireEvent.click(screen.getByTestId('onboarding-next'));
    expect(screen.getByTestId('onboarding-step-members')).toBeInTheDocument();

    // FHS-274: fill the pinned "You" row, then add one other member.
    fireEvent.change(screen.getByTestId('onboarding-your-name'), {
      target: { value: 'Sarah' },
    });
    fireEvent.click(screen.getByTestId('onboarding-add-member'));
    fireEvent.change(screen.getByTestId('onboarding-member-name-0'), {
      target: { value: 'Iman' },
    });

    // Step 2 → 3 (Location, no manual entry needed).
    fireEvent.click(screen.getByTestId('onboarding-next'));
    expect(screen.getByTestId('onboarding-step-location')).toBeInTheDocument();

    // Back to step 2: both names should still be there.
    fireEvent.click(screen.getByTestId('onboarding-back'));
    expect((screen.getByTestId('onboarding-your-name') as HTMLInputElement).value).toBe('Sarah');
    expect((screen.getByTestId('onboarding-member-name-0') as HTMLInputElement).value).toBe('Iman');
  });

  // FHR-26 replaced FHS-274's greyed-out Next: Next now says what is missing.
  it('says your name is missing when Next is pressed with it blank', async () => {
    mockNotOnboarded();
    renderAt('/t/khans/onboarding');
    await waitFor(() => screen.getByTestId('onboarding-step-welcome'));

    fireEvent.click(screen.getByTestId('onboarding-next'));
    fireEvent.change(screen.getByTestId('onboarding-your-name'), { target: { value: '' } });
    fireEvent.click(screen.getByTestId('onboarding-next'));

    expect(screen.getByTestId('onboarding-step-members')).toBeInTheDocument();
    expect(screen.getByTestId('onboarding-your-name-error')).toHaveTextContent('Enter your name.');
    expect(screen.getByTestId('onboarding-step-error')).toHaveTextContent(
      'Fill in every name to continue.',
    );
    expect(screen.getByTestId('onboarding-your-name')).toHaveAttribute('aria-invalid', 'true');
  });

  it('says an added person needs a name when Next is pressed', async () => {
    mockNotOnboarded();
    renderAt('/t/khans/onboarding');
    await waitFor(() => screen.getByTestId('onboarding-step-welcome'));

    fireEvent.click(screen.getByTestId('onboarding-next'));
    fireEvent.change(screen.getByTestId('onboarding-your-name'), { target: { value: 'Sarah' } });
    fireEvent.click(screen.getByTestId('onboarding-add-member'));
    fireEvent.click(screen.getByTestId('onboarding-next'));

    expect(screen.getByTestId('onboarding-member-name-error-0')).toHaveTextContent(
      'Enter a name, or remove this person.',
    );
    fireEvent.change(screen.getByTestId('onboarding-member-name-0'), { target: { value: 'Iman' } });
    fireEvent.click(screen.getByTestId('onboarding-next'));
    expect(screen.getByTestId('onboarding-step-location')).toBeInTheDocument();
  });

  it('a saved name that arrives late does not overwrite what you typed', async () => {
    let release!: () => void;
    const gate = new Promise<void>((r) => (release = r));
    todayReply = {
      ok: true,
      json: async () => {
        await gate;
        return { callerMemberId: 'm1', members: [{ id: 'm1', displayName: 'Saved Name' }] };
      },
    };
    mockNotOnboarded();
    renderAt('/t/khans/onboarding');
    await waitFor(() => screen.getByTestId('onboarding-step-welcome'));
    fireEvent.click(screen.getByTestId('onboarding-next'));
    fireEvent.change(screen.getByTestId('onboarding-your-name'), { target: { value: 'Typed' } });
    release();
    await new Promise((r) => setTimeout(r, 20));
    expect((screen.getByTestId('onboarding-your-name') as HTMLInputElement).value).toBe('Typed');
  });

  it('moves focus to the first empty name when Next is pressed', async () => {
    mockNotOnboarded();
    renderAt('/t/khans/onboarding');
    await waitFor(() => screen.getByTestId('onboarding-step-welcome'));
    fireEvent.click(screen.getByTestId('onboarding-next'));
    fireEvent.change(screen.getByTestId('onboarding-your-name'), { target: { value: '' } });
    fireEvent.click(screen.getByTestId('onboarding-next'));
    await waitFor(() =>
      expect(document.activeElement).toBe(screen.getByTestId('onboarding-your-name')),
    );
  });

  it('hides Back on the first step (FHR-28)', async () => {
    mockNotOnboarded();
    renderAt('/t/khans/onboarding');
    await waitFor(() => screen.getByTestId('onboarding-step-welcome'));
    expect(screen.queryByTestId('onboarding-back')).toBeNull();
    fireEvent.click(screen.getByTestId('onboarding-next'));
    expect(screen.getByTestId('onboarding-back')).toBeInTheDocument();
  });

  it('caps names at 40 characters (FHR-24)', async () => {
    mockNotOnboarded();
    renderAt('/t/khans/onboarding');
    await waitFor(() => screen.getByTestId('onboarding-step-welcome'));
    fireEvent.click(screen.getByTestId('onboarding-next'));
    expect(screen.getByTestId('onboarding-your-name')).toHaveAttribute('maxLength', '40');
  });

  it('fills your name from the name you typed when creating the family (FHR-25)', async () => {
    todayReply = {
      ok: true,
      json: async () => ({
        callerMemberId: 'm1',
        members: [{ id: 'm1', displayName: 'Sarah' }],
      }),
    };
    mockNotOnboarded();
    renderAt('/t/khans/onboarding');
    await waitFor(() => screen.getByTestId('onboarding-step-welcome'));
    fireEvent.click(screen.getByTestId('onboarding-next'));
    await waitFor(() =>
      expect((screen.getByTestId('onboarding-your-name') as HTMLInputElement).value).toBe('Sarah'),
    );
  });

  it('FHS-432: auto-detected timezone + currency shown on Location step without picker', async () => {
    mockNotOnboarded();
    renderAt('/t/khans/onboarding');
    await waitFor(() => screen.getByTestId('onboarding-step-welcome'));

    // Welcome → Members (fill name) → Location.
    fireEvent.click(screen.getByTestId('onboarding-next'));
    fireEvent.change(screen.getByTestId('onboarding-your-name'), { target: { value: 'Sarah' } });
    fireEvent.click(screen.getByTestId('onboarding-next'));

    expect(screen.getByTestId('onboarding-step-location')).toBeInTheDocument();

    // Detected values are displayed as text, not as pickers.
    expect(screen.getByTestId('onboarding-detected-timezone').textContent).toBe('Europe/London');
    expect(screen.getByTestId('onboarding-detected-currency').textContent).toBe('GBP');

    // Pickers are hidden by default on the happy path.
    expect(screen.queryByTestId('onboarding-timezone')).not.toBeInTheDocument();
    expect(screen.queryByTestId('onboarding-currency')).not.toBeInTheDocument();

    // Next is enabled because both values are valid.
    expect((screen.getByTestId('onboarding-next') as HTMLButtonElement).disabled).toBe(false);
  });

  it('FHS-432: Change button reveals the timezone picker', async () => {
    mockNotOnboarded();
    renderAt('/t/khans/onboarding');
    await waitFor(() => screen.getByTestId('onboarding-step-welcome'));

    fireEvent.click(screen.getByTestId('onboarding-next'));
    fireEvent.change(screen.getByTestId('onboarding-your-name'), { target: { value: 'Sarah' } });
    fireEvent.click(screen.getByTestId('onboarding-next'));

    // Click the timezone Change button.
    fireEvent.click(screen.getByTestId('onboarding-timezone-change'));
    // Picker should now appear.
    expect(screen.getByTestId('onboarding-timezone')).toBeInTheDocument();
  });

  it('FHS-432: Change button reveals the currency picker', async () => {
    mockNotOnboarded();
    renderAt('/t/khans/onboarding');
    await waitFor(() => screen.getByTestId('onboarding-step-welcome'));

    fireEvent.click(screen.getByTestId('onboarding-next'));
    fireEvent.change(screen.getByTestId('onboarding-your-name'), { target: { value: 'Sarah' } });
    fireEvent.click(screen.getByTestId('onboarding-next'));

    fireEvent.click(screen.getByTestId('onboarding-currency-change'));
    expect(screen.getByTestId('onboarding-currency')).toBeInTheDocument();
  });

  it('FHS-432: fallback: shows timezone picker immediately when detection returns empty', async () => {
    detectionMocks.timezone = ''; // detection failure
    detectionMocks.currency = 'USD';
    mockNotOnboarded();
    renderAt('/t/khans/onboarding');
    await waitFor(() => screen.getByTestId('onboarding-step-welcome'));

    fireEvent.click(screen.getByTestId('onboarding-next'));
    fireEvent.change(screen.getByTestId('onboarding-your-name'), { target: { value: 'Sarah' } });
    fireEvent.click(screen.getByTestId('onboarding-next'));

    // Picker shown immediately because timezone is empty.
    expect(screen.getByTestId('onboarding-timezone')).toBeInTheDocument();
    // Currency picker NOT shown (detection succeeded).
    expect(screen.queryByTestId('onboarding-currency')).not.toBeInTheDocument();
    // Next blocked until user fills timezone.
    // FHR-26: Next stays clickable and explains what is missing instead.
    fireEvent.click(screen.getByTestId('onboarding-next'));
    expect(screen.getByTestId('onboarding-step-location')).toBeInTheDocument();
    expect(screen.getByTestId('onboarding-step-error')).toHaveTextContent(
      'Check the highlighted details to continue.',
    );
  });

  it('FHS-432: fallback: shows currency picker immediately when detection returns invalid code', async () => {
    detectionMocks.timezone = 'America/Chicago';
    detectionMocks.currency = 'XX'; // not a valid 3-letter code
    mockNotOnboarded();
    renderAt('/t/khans/onboarding');
    await waitFor(() => screen.getByTestId('onboarding-step-welcome'));

    fireEvent.click(screen.getByTestId('onboarding-next'));
    fireEvent.change(screen.getByTestId('onboarding-your-name'), { target: { value: 'Sarah' } });
    fireEvent.click(screen.getByTestId('onboarding-next'));

    // Currency picker shown immediately.
    expect(screen.getByTestId('onboarding-currency')).toBeInTheDocument();
    // Timezone picker NOT shown.
    expect(screen.queryByTestId('onboarding-timezone')).not.toBeInTheDocument();
    // Next blocked until user selects a valid currency.
    // FHR-26: Next stays clickable and explains what is missing instead.
    fireEvent.click(screen.getByTestId('onboarding-next'));
    expect(screen.getByTestId('onboarding-step-location')).toBeInTheDocument();
    expect(screen.getByTestId('onboarding-step-error')).toHaveTextContent(
      'Check the highlighted details to continue.',
    );
  });

  it('FHS-487: shows an age input for kid rows (child + teen) and includes it in the submit payload', async () => {
    mockNotOnboarded();
    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ tenant: { onboardingCompleted: true }, membersAdded: 1 }),
    });
    renderAt('/t/khans/onboarding');
    await waitFor(() => screen.getByTestId('onboarding-step-welcome'));

    fireEvent.click(screen.getByTestId('onboarding-next'));
    fireEvent.change(screen.getByTestId('onboarding-your-name'), { target: { value: 'Sarah' } });
    fireEvent.click(screen.getByTestId('onboarding-add-member'));
    fireEvent.change(screen.getByTestId('onboarding-member-name-0'), {
      target: { value: 'Iman' },
    });

    // Default role is 'adult': no age field shown.
    expect(screen.queryByTestId('onboarding-member-age-0')).not.toBeInTheDocument();

    // Switch role to 'child': age field appears; email field (adult-only) disappears.
    fireEvent.change(screen.getByTestId('onboarding-member-role-0'), {
      target: { value: 'child' },
    });
    expect(screen.getByTestId('onboarding-member-age-0')).toBeInTheDocument();
    expect(screen.queryByTestId('onboarding-member-email-0')).not.toBeInTheDocument();

    // Teen rows also get the age field (FHS-487), then back to child for the rest.
    fireEvent.change(screen.getByTestId('onboarding-member-role-0'), {
      target: { value: 'teen' },
    });
    expect(screen.getByTestId('onboarding-member-age-0')).toBeInTheDocument();
    fireEvent.change(screen.getByTestId('onboarding-member-role-0'), {
      target: { value: 'child' },
    });

    fireEvent.change(screen.getByTestId('onboarding-member-age-0'), { target: { value: '6' } });

    fireEvent.click(screen.getByTestId('onboarding-next')); // Members → Location
    fireEvent.click(screen.getByTestId('onboarding-next')); // Location → Done
    fireEvent.click(screen.getByTestId('onboarding-finish'));

    await waitFor(() =>
      expect(screen.getByTestId('route-marker').textContent).toBe('tenant-dashboard'),
    );
    const submitCall = fetchMock.mock.calls.find(
      ([url]) => url === 'http://localhost:3001/api/onboarding/complete',
    );
    expect(submitCall).toBeDefined();
    const payload = JSON.parse((submitCall![1] as RequestInit).body as string);
    expect(payload.members).toEqual([{ displayName: 'Iman', role: 'child', age: 6 }]);
  });

  it('final submit POSTs all wizard state to /api/onboarding/complete and redirects', async () => {
    // First call: /api/me (gate check).
    mockNotOnboarded();
    // Second call: POST /api/onboarding/complete.
    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ tenant: { onboardingCompleted: true }, membersAdded: 1 }),
    });
    renderAt('/t/khans/onboarding');
    await waitFor(() => screen.getByTestId('onboarding-step-welcome'));

    // Welcome → Members → fill → Location (auto) → Done → Finish.
    // FHS-432: no manual timezone/currency steps: Location auto-applies.
    fireEvent.click(screen.getByTestId('onboarding-next'));
    fireEvent.change(screen.getByTestId('onboarding-your-name'), {
      target: { value: 'Sarah' },
    });
    fireEvent.click(screen.getByTestId('onboarding-add-member'));
    fireEvent.change(screen.getByTestId('onboarding-member-name-0'), {
      target: { value: 'Iman' },
    });
    // FHS-275: default role is adult, so the email field shows.
    fireEvent.change(screen.getByTestId('onboarding-member-email-0'), {
      target: { value: 'iman@example.com' },
    });
    fireEvent.click(screen.getByTestId('onboarding-next')); // Members → Location
    fireEvent.click(screen.getByTestId('onboarding-next')); // Location → Done (auto values)
    fireEvent.click(screen.getByTestId('onboarding-finish'));

    await waitFor(() =>
      expect(screen.getByTestId('route-marker').textContent).toBe('tenant-dashboard'),
    );
    // Inspect the POST payload: timezone + currency still sent.
    const submitCall = fetchMock.mock.calls.find(
      ([url]) => url === 'http://localhost:3001/api/onboarding/complete',
    );
    expect(submitCall).toBeDefined();
    const init = submitCall![1] as RequestInit;
    expect(init.method).toBe('POST');
    const payload = JSON.parse(init.body as string);
    expect(payload).toMatchObject({
      timezone: 'Europe/London',
      currency: 'GBP',
      yourName: 'Sarah',
      members: [{ displayName: 'Iman', role: 'adult', email: 'iman@example.com' }],
    });
  });
});
