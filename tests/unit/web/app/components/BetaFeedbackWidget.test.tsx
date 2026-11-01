/**
 * Unit tests for BetaFeedbackWidget: FHS-418 (in-app) / FHS-429 (public) /
 * FHS-449 (streamlined layout: PMF + recommend up front, everything else
 * behind an "A few more (optional)" expander).
 *
 * Covers:
 *  - button renders and opens dialog
 *  - submit disabled with nothing answered
 *  - answering one question enables submit
 *  - recommendScore = 0 is a valid answer (falsy-value guard)
 *  - the "A few more" expander is collapsed on open and reveals the
 *    secondary rating rows + free-text boxes once toggled
 *  - submit POSTs the right body and shows thank-you
 *  - re-opening after success shows a blank form (not thank-you)
 *  - error response shows inline error message
 *  - widget renders null when no session (in-app)
 *  - widget renders null when session present but no tenant slug (in-app)
 *  - public variant renders without session/slug
 *  - public variant: name+email alone do not enable submit
 *  - public variant: posts to /api/public/feedback with no auth/tenant header
 *  - public variant: email validation only when non-empty
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';

// ── Mocks (before import of component) ───────────────────────────────────────

// react-router-dom: useParams returns { slug: 'test-family' } by default
vi.mock('react-router-dom', () => ({
  useParams: () => ({ slug: 'test-family' }),
}));

// auth-context: default to a logged-in parent session
const mockSession = { access_token: 'parent.jwt.tok' };
vi.mock('../../../../../src/app/lib/auth-context', () => ({
  useAuth: () => ({ session: mockSession }),
}));

// supabase stub (imported transitively via app/lib/api)
vi.mock('../../../../../src/app/lib/supabase', () => ({
  supabase: {
    auth: { getSession: async () => ({ data: { session: null } }) },
  },
}));

import { BetaFeedbackWidget } from '../../../../../src/app/components/BetaFeedbackWidget';

// ── fetch mock ────────────────────────────────────────────────────────────────

const fetchMock = vi.fn();

beforeEach(() => {
  fetchMock.mockReset();
  vi.stubGlobal('fetch', fetchMock);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

// ── Helpers ───────────────────────────────────────────────────────────────────

function renderWidget() {
  return render(<BetaFeedbackWidget />);
}

function openDialog() {
  fireEvent.click(screen.getByTestId('beta-feedback-button'));
}

// FHS-449: solves/ease/keep + the three free-text boxes live behind the
// "A few more (optional)" expander; open it before interacting with them.
function openMore() {
  fireEvent.click(screen.getByTestId('beta-feedback-more-toggle'));
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('<BetaFeedbackWidget />', () => {
  it('renders the floating button', () => {
    renderWidget();
    expect(screen.getByTestId('beta-feedback-button')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /give feedback/i })).toBeInTheDocument();
  });

  it('opens the dialog when the button is clicked', () => {
    renderWidget();
    expect(screen.queryByTestId('beta-feedback-dialog')).not.toBeInTheDocument();
    openDialog();
    expect(screen.getByTestId('beta-feedback-dialog')).toBeInTheDocument();
    expect(screen.getByText(/Help shape Family Hub/)).toBeInTheDocument();
  });

  it('submit button is disabled with nothing answered', () => {
    renderWidget();
    openDialog();
    expect(screen.getByTestId('beta-feedback-submit')).toBeDisabled();
  });

  it('submit button becomes enabled after answering one PMF option', () => {
    renderWidget();
    openDialog();
    fireEvent.click(screen.getByTestId('beta-feedback-pmf-very'));
    expect(screen.getByTestId('beta-feedback-submit')).not.toBeDisabled();
  });

  it('submit button becomes enabled after entering a pain-point textarea', () => {
    renderWidget();
    openDialog();
    openMore();
    fireEvent.change(screen.getByTestId('beta-feedback-pain'), {
      target: { value: 'Keeping chores in sync' },
    });
    expect(screen.getByTestId('beta-feedback-submit')).not.toBeDisabled();
  });

  it('submit button becomes enabled after selecting recommend score = 9', () => {
    renderWidget();
    openDialog();
    fireEvent.click(screen.getByTestId('beta-feedback-recommend-9'));
    expect(screen.getByTestId('beta-feedback-submit')).not.toBeDisabled();
  });

  // FHS-449: the short-form goal: only PMF + recommend show on open.
  it('opens with only the PMF and recommend questions visible, and the "A few more" expander collapsed', () => {
    renderWidget();
    openDialog();

    expect(
      screen.getByText(/How would you feel if you could no longer use Family Hub/),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/How likely are you to recommend it to another family/),
    ).toBeInTheDocument();

    const toggle = screen.getByTestId('beta-feedback-more-toggle');
    expect(toggle).toHaveAttribute('aria-expanded', 'false');
    expect(screen.queryByTestId('beta-feedback-more-content')).not.toBeInTheDocument();
    expect(screen.queryByTestId('beta-feedback-pain')).not.toBeInTheDocument();
  });

  it('the "A few more" expander reveals the secondary questions and free-text boxes when toggled', () => {
    renderWidget();
    openDialog();

    openMore();

    expect(screen.getByTestId('beta-feedback-more-toggle')).toHaveAttribute(
      'aria-expanded',
      'true',
    );
    expect(screen.getByTestId('beta-feedback-more-content')).toBeInTheDocument();
    expect(screen.getByTestId('beta-feedback-solves-3')).toBeInTheDocument();
    expect(screen.getByTestId('beta-feedback-ease-3')).toBeInTheDocument();
    expect(screen.getByTestId('beta-feedback-keep-3')).toBeInTheDocument();
    expect(screen.getByTestId('beta-feedback-pain')).toBeInTheDocument();
    expect(screen.getByTestId('beta-feedback-feature')).toBeInTheDocument();
    expect(screen.getByTestId('beta-feedback-other')).toBeInTheDocument();

    // Toggling again collapses it back.
    openMore();
    expect(screen.getByTestId('beta-feedback-more-toggle')).toHaveAttribute(
      'aria-expanded',
      'false',
    );
    expect(screen.queryByTestId('beta-feedback-more-content')).not.toBeInTheDocument();
  });

  it('submit stays enabled from a primary answer alone with the expander left collapsed', async () => {
    fetchMock.mockResolvedValueOnce({
      ok: true,
      status: 201,
      json: async () => ({}),
    });

    renderWidget();
    openDialog();
    fireEvent.click(screen.getByTestId('beta-feedback-pmf-very'));
    expect(screen.getByTestId('beta-feedback-submit')).not.toBeDisabled();

    fireEvent.click(screen.getByTestId('beta-feedback-submit'));

    await waitFor(() => expect(fetchMock).toHaveBeenCalledOnce());
    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    const body = JSON.parse(init.body as string) as Record<string, unknown>;
    expect(body.pmfDisappointment).toBe('very');
    expect(body).not.toHaveProperty('solvesProblem');
    expect(body).not.toHaveProperty('painPoint');
  });

  // Blocker 1: falsy-value guard: 0 is a valid recommendScore
  it('recommendScore = 0 enables submit and is included in the POST body', async () => {
    fetchMock.mockResolvedValueOnce({
      ok: true,
      status: 201,
      json: async () => ({}),
    });

    renderWidget();
    openDialog();

    // Score 0 is falsy: must use !== undefined check, not truthiness
    fireEvent.click(screen.getByTestId('beta-feedback-recommend-0'));
    expect(screen.getByTestId('beta-feedback-submit')).not.toBeDisabled();

    fireEvent.click(screen.getByTestId('beta-feedback-submit'));

    await waitFor(() => expect(fetchMock).toHaveBeenCalledOnce());

    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    const body = JSON.parse(init.body as string) as Record<string, unknown>;
    expect(body.recommendScore).toBe(0);
  });

  it('POSTs the correct body and shows the thank-you state on 201', async () => {
    fetchMock.mockResolvedValueOnce({
      ok: true,
      status: 201,
      json: async () => ({ id: 'fb1' }),
    });

    renderWidget();
    openDialog();
    openMore();

    fireEvent.click(screen.getByTestId('beta-feedback-pmf-somewhat'));
    fireEvent.change(screen.getByTestId('beta-feedback-feature'), {
      target: { value: 'Shared shopping list' },
    });

    fireEvent.click(screen.getByTestId('beta-feedback-submit'));

    await waitFor(() => expect(screen.getByTestId('beta-feedback-thanks')).toBeInTheDocument());

    expect(fetchMock).toHaveBeenCalledOnce();
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toContain('/api/feedback');
    expect(init.method).toBe('POST');

    const body = JSON.parse(init.body as string) as Record<string, unknown>;
    expect(body.pmfDisappointment).toBe('somewhat');
    expect(body.featureRequest).toBe('Shared shopping list');
    expect(body).not.toHaveProperty('recommendScore');
    expect(body).not.toHaveProperty('solvesProblem');

    const headers = init.headers as Record<string, string>;
    expect(headers['Authorization']).toBe('Bearer parent.jwt.tok');
    expect(headers['x-tenant-slug']).toBe('test-family');
  });

  // New test: re-opening after success shows a blank form, not thank-you
  it('re-opening the widget after a successful submit shows a blank form', async () => {
    fetchMock.mockResolvedValueOnce({
      ok: true,
      status: 201,
      json: async () => ({}),
    });

    renderWidget();
    openDialog();

    fireEvent.click(screen.getByTestId('beta-feedback-pmf-very'));
    fireEvent.click(screen.getByTestId('beta-feedback-submit'));

    // Wait for thank-you
    await waitFor(() => expect(screen.getByTestId('beta-feedback-thanks')).toBeInTheDocument());

    // Close via the thank-you Close button
    fireEvent.click(screen.getByRole('button', { name: /^Close$/i }));

    // Re-open
    openDialog();

    // Thank-you state must not be showing
    expect(screen.queryByTestId('beta-feedback-thanks')).not.toBeInTheDocument();
    // Submit must be disabled again (blank form)
    expect(screen.getByTestId('beta-feedback-submit')).toBeDisabled();
    // The PMF buttons must all be unselected
    expect(screen.getByTestId('beta-feedback-pmf-very')).toHaveAttribute('aria-pressed', 'false');
  });

  it('shows inline error message when the server returns an error', async () => {
    fetchMock.mockResolvedValueOnce({
      ok: false,
      status: 500,
      json: async () => ({ error: 'Internal server error' }),
    });

    renderWidget();
    openDialog();

    fireEvent.click(screen.getByTestId('beta-feedback-pmf-not'));
    fireEvent.click(screen.getByTestId('beta-feedback-submit'));

    await waitFor(() => expect(screen.getByTestId('beta-feedback-error')).toBeInTheDocument());
    expect(screen.getByTestId('beta-feedback-error').textContent).toMatch(/Internal server error/);
    expect(screen.queryByTestId('beta-feedback-thanks')).not.toBeInTheDocument();
    expect(screen.getByTestId('beta-feedback-submit')).not.toBeDisabled();
  });

  it('shows a generic error message when the network throws', async () => {
    fetchMock.mockRejectedValueOnce(new Error('Network failure'));

    renderWidget();
    openDialog();
    openMore();

    fireEvent.change(screen.getByTestId('beta-feedback-other'), {
      target: { value: 'Love the app!' },
    });
    fireEvent.click(screen.getByTestId('beta-feedback-submit'));

    await waitFor(() => expect(screen.getByTestId('beta-feedback-error')).toBeInTheDocument());
    expect(screen.getByTestId('beta-feedback-error').textContent).toMatch(
      /Could not reach the server/,
    );
  });

  it('omits unanswered numeric fields from the POST body', async () => {
    fetchMock.mockResolvedValueOnce({
      ok: true,
      status: 201,
      json: async () => ({}),
    });

    renderWidget();
    openDialog();

    fireEvent.click(screen.getByTestId('beta-feedback-recommend-7'));
    fireEvent.click(screen.getByTestId('beta-feedback-submit'));

    await waitFor(() => expect(fetchMock).toHaveBeenCalledOnce());

    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    const body = JSON.parse(init.body as string) as Record<string, unknown>;
    expect(body.recommendScore).toBe(7);
    expect(body).not.toHaveProperty('pmfDisappointment');
    expect(body).not.toHaveProperty('solvesProblem');
    expect(body).not.toHaveProperty('easeOfUse');
    expect(body).not.toHaveProperty('keepUsing');
  });
});

// ── Public variant tests ──────────────────────────────────────────────────────

describe('<BetaFeedbackWidget variant="public" />', () => {
  it('renders the floating button without a session or tenant slug', () => {
    // Default mock has session + slug: override both to null/empty to prove
    // the public variant ignores the guard.
    vi.doMock('../../../../../src/app/lib/auth-context', () => ({
      useAuth: () => ({ session: null }),
    }));
    vi.doMock('react-router-dom', () => ({
      useParams: () => ({}),
    }));
    render(<BetaFeedbackWidget variant="public" />);
    expect(screen.getByTestId('beta-feedback-button')).toBeInTheDocument();
  });

  it('submit is disabled when only name and email are filled (no survey answer)', () => {
    render(<BetaFeedbackWidget variant="public" />);
    fireEvent.click(screen.getByTestId('beta-feedback-button'));

    fireEvent.change(screen.getByTestId('beta-feedback-name'), {
      target: { value: 'Sarah' },
    });
    fireEvent.change(screen.getByTestId('beta-feedback-email'), {
      target: { value: 'sarah@example.com' },
    });

    expect(screen.getByTestId('beta-feedback-submit')).toBeDisabled();
  });

  it('submit becomes enabled once a survey answer is added alongside name/email', () => {
    render(<BetaFeedbackWidget variant="public" />);
    fireEvent.click(screen.getByTestId('beta-feedback-button'));

    fireEvent.change(screen.getByTestId('beta-feedback-name'), {
      target: { value: 'Sarah' },
    });
    fireEvent.change(screen.getByTestId('beta-feedback-email'), {
      target: { value: 'sarah@example.com' },
    });
    fireEvent.click(screen.getByTestId('beta-feedback-pmf-very'));

    expect(screen.getByTestId('beta-feedback-submit')).not.toBeDisabled();
  });

  it('POSTs to /api/public/feedback with name+email+survey and no auth/tenant headers', async () => {
    fetchMock.mockResolvedValueOnce({
      ok: true,
      status: 201,
      json: async () => ({}),
    });

    render(<BetaFeedbackWidget variant="public" />);
    fireEvent.click(screen.getByTestId('beta-feedback-button'));

    fireEvent.change(screen.getByTestId('beta-feedback-name'), {
      target: { value: 'Sarah' },
    });
    fireEvent.change(screen.getByTestId('beta-feedback-email'), {
      target: { value: 'sarah@example.com' },
    });
    fireEvent.click(screen.getByTestId('beta-feedback-pmf-somewhat'));
    openMore();
    fireEvent.change(screen.getByTestId('beta-feedback-pain'), {
      target: { value: 'Keeping chores in sync' },
    });

    fireEvent.click(screen.getByTestId('beta-feedback-submit'));

    await waitFor(() => expect(screen.getByTestId('beta-feedback-thanks')).toBeInTheDocument());

    expect(fetchMock).toHaveBeenCalledOnce();
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toContain('/api/public/feedback');
    expect(init.method).toBe('POST');

    const body = JSON.parse(init.body as string) as Record<string, unknown>;
    expect(body.name).toBe('Sarah');
    expect(body.email).toBe('sarah@example.com');
    expect(body.pmfDisappointment).toBe('somewhat');
    expect(body.painPoint).toBe('Keeping chores in sync');

    const headers = init.headers as Record<string, string>;
    expect(headers).not.toHaveProperty('Authorization');
    expect(headers).not.toHaveProperty('x-tenant-slug');
  });

  it('POSTs to /api/public/feedback without name/email when fields are blank', async () => {
    fetchMock.mockResolvedValueOnce({
      ok: true,
      status: 201,
      json: async () => ({}),
    });

    render(<BetaFeedbackWidget variant="public" />);
    fireEvent.click(screen.getByTestId('beta-feedback-button'));
    fireEvent.click(screen.getByTestId('beta-feedback-pmf-not'));
    fireEvent.click(screen.getByTestId('beta-feedback-submit'));

    await waitFor(() => expect(fetchMock).toHaveBeenCalledOnce());

    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toContain('/api/public/feedback');

    const body = JSON.parse(init.body as string) as Record<string, unknown>;
    expect(body).not.toHaveProperty('name');
    expect(body).not.toHaveProperty('email');
    expect(body.pmfDisappointment).toBe('not');
  });

  it('shows inline email error when a malformed email is blurred', () => {
    render(<BetaFeedbackWidget variant="public" />);
    fireEvent.click(screen.getByTestId('beta-feedback-button'));

    const emailInput = screen.getByTestId('beta-feedback-email');
    fireEvent.change(emailInput, { target: { value: 'not-an-email' } });
    fireEvent.blur(emailInput);

    expect(screen.getByTestId('beta-feedback-email-error')).toBeInTheDocument();
  });

  it('does NOT show email error when email field is left blank', () => {
    render(<BetaFeedbackWidget variant="public" />);
    fireEvent.click(screen.getByTestId('beta-feedback-button'));

    const emailInput = screen.getByTestId('beta-feedback-email');
    // Blur without entering anything
    fireEvent.blur(emailInput);

    expect(screen.queryByTestId('beta-feedback-email-error')).not.toBeInTheDocument();
  });

  it('blocks submit when email field has a malformed value (re-validates on submit)', async () => {
    render(<BetaFeedbackWidget variant="public" />);
    fireEvent.click(screen.getByTestId('beta-feedback-button'));

    fireEvent.change(screen.getByTestId('beta-feedback-email'), {
      target: { value: 'bad-email' },
    });
    // Answer a survey question so submit would otherwise be enabled
    fireEvent.click(screen.getByTestId('beta-feedback-pmf-very'));
    fireEvent.click(screen.getByTestId('beta-feedback-submit'));

    // fetch should NOT have been called: submit blocked by email validation
    expect(fetchMock).not.toHaveBeenCalled();
    expect(screen.getByTestId('beta-feedback-email-error')).toBeInTheDocument();
  });
});

// ── Guard tests (no session / no slug) ───────────────────────────────────────

describe('<BetaFeedbackWidget />: no session', () => {
  beforeEach(() => {
    vi.resetModules();
  });

  it('renders nothing when session is null', async () => {
    vi.doMock('../../../../../src/app/lib/auth-context', () => ({
      useAuth: () => ({ session: null }),
    }));
    const { BetaFeedbackWidget: Widget } = await import(
      '../../../../../src/app/components/BetaFeedbackWidget'
    );
    render(<Widget />);
    expect(screen.queryByTestId('beta-feedback-button')).not.toBeInTheDocument();
  });
});

describe('<BetaFeedbackWidget />: session present, no tenant slug', () => {
  beforeEach(() => {
    vi.resetModules();
  });

  it('renders nothing when useParams returns no slug (legacy routes)', async () => {
    // Override react-router-dom to return empty params (no :slug)
    vi.doMock('react-router-dom', () => ({
      useParams: () => ({}),
    }));
    vi.doMock('../../../../../src/app/lib/auth-context', () => ({
      useAuth: () => ({ session: { access_token: 'tok' } }),
    }));
    vi.doMock('../../../../../src/app/lib/supabase', () => ({
      supabase: { auth: { getSession: async () => ({ data: { session: null } }) } },
    }));
    const { BetaFeedbackWidget: Widget } = await import(
      '../../../../../src/app/components/BetaFeedbackWidget'
    );
    render(<Widget />);
    expect(screen.queryByTestId('beta-feedback-button')).not.toBeInTheDocument();
  });

  // FHS-670: the per-screen form is separate; the homepage survey must not change.
  it('Homepage form is unchanged', () => {
    render(<BetaFeedbackWidget variant="public" />);
    fireEvent.click(screen.getByTestId('beta-feedback-button'));
    fireEvent.click(screen.getByTestId('beta-feedback-more-toggle'));
    const questions = screen
      .getAllByText((_, el) => el?.tagName === 'LEGEND' || el?.tagName === 'LABEL')
      .map((el) => el.textContent?.replace('(optional)', '').trim());
    expect(questions).toEqual([
      'Name',
      'Email',
      'How would you feel if you could no longer use Family Hub?',
      'How likely are you to recommend it to another family?',
      'How well does it solve a real problem for your family?',
      'How easy is it to use?',
      'After the beta, how likely are you to keep using it?',
      "What's the biggest problem you're hoping Family Hub solves?",
      "What's one feature you wish it had?",
      'Anything else?',
    ]);
  });

  // FHS-678: the same phone fix as the per-screen form, layout only.
  it('keeps the header and close button out of the scrolling part', () => {
    renderWidget();
    openDialog();
    const header = screen.getByTestId('beta-feedback-header');
    const body = screen.getByTestId('beta-feedback-body');
    expect(body).toHaveClass('overflow-y-auto', 'min-h-0');
    expect(body).not.toContainElement(header);
    const close = screen.getByRole('button', { name: 'Close feedback dialog' });
    expect(header).toContainElement(close);
    expect(close).toHaveClass('h-11', 'w-11');
    expect(screen.getByTestId('beta-feedback-card').className).not.toContain('90vh');
  });
});
