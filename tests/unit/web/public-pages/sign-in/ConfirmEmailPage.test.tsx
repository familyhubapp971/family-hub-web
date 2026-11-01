import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { ConfirmEmailPage } from '../../../../../src/public-pages/sign-in/ConfirmEmailPage';
import { ApiError } from '../../../../../src/app/lib/api';

// FHS-510: the landing page for an admin-initiated sign-in email change.
// Five states: ready (click-to-confirm gate) → checking (spinner) → done
// (new email + back button) / expired (link genuinely dead) / error
// (transient failure, retryable, distinct from expired).
//
// SECURITY: the confirm POST must NEVER fire until the user taps the
// button (guards against email link-scanners burning the single-use
// token before the real recipient opens the link). Every "done"/"expired"
// test below drives through the button click rather than relying on an
// auto-fire-on-mount effect.

const apiFetch = vi.fn();
vi.mock('../../../../../src/app/lib/api', async () => {
  const actual = await vi.importActual<typeof import('../../../../../src/app/lib/api')>(
    '../../../../../src/app/lib/api',
  );
  return {
    ...actual,
    apiFetch: (...args: unknown[]) => apiFetch(...args),
  };
});

function renderAt(initial: string) {
  return render(
    <MemoryRouter initialEntries={[initial]}>
      <Routes>
        <Route path="/confirm-email/:memberId" element={<ConfirmEmailPage />} />
        <Route path="/t/:slug/dashboard" element={<div data-testid="dashboard-route" />} />
        <Route path="/" element={<div data-testid="home-route" />} />
      </Routes>
    </MemoryRouter>,
  );
}

beforeEach(() => {
  apiFetch.mockReset();
});

describe('<ConfirmEmailPage />', () => {
  it('shows the ready (click-to-confirm) state first and does NOT auto-fire the request', async () => {
    apiFetch.mockImplementation(() => new Promise(() => {}));
    renderAt('/confirm-email/member-1?token=abc123');
    expect(screen.getByText('Confirm your new email')).toBeInTheDocument();
    expect(screen.getByTestId('confirm-email-confirm')).toBeInTheDocument();
    // Give any stray effect a tick to fire: it must not.
    await new Promise((r) => setTimeout(r, 0));
    expect(apiFetch).not.toHaveBeenCalled();
  });

  it('clicking "Confirm email change" fires the request and shows the checking state', async () => {
    apiFetch.mockImplementation(() => new Promise(() => {}));
    renderAt('/confirm-email/member-1?token=abc123');
    fireEvent.click(screen.getByTestId('confirm-email-confirm'));
    expect(screen.getByText('Checking your link')).toBeInTheDocument();
    expect(screen.getByTestId('confirm-email-spinner')).toBeInTheDocument();
    expect(apiFetch).toHaveBeenCalledTimes(1);
  });

  it('goes straight to expired when the URL has no token (no ready/button state)', async () => {
    renderAt('/confirm-email/member-1');
    await waitFor(() => expect(screen.getByText('This link has expired')).toBeInTheDocument());
    expect(apiFetch).not.toHaveBeenCalled();
    expect(screen.queryByTestId('confirm-email-confirm')).not.toBeInTheDocument();
  });

  it('posts memberId + token anonymously after the click, then shows the done state on success', async () => {
    apiFetch.mockResolvedValue({
      newEmail: 'yusuf.new@example.com',
      memberName: 'Yusuf',
      tenantSlug: 'khans',
    });
    renderAt('/confirm-email/member-1?token=the-raw-token');
    fireEvent.click(screen.getByTestId('confirm-email-confirm'));

    await waitFor(() => expect(screen.getByText('Email updated')).toBeInTheDocument());
    expect(screen.getByTestId('confirm-email-new-address').textContent).toBe(
      'yusuf.new@example.com',
    );
    expect(screen.getByText(/Yusuf now signs in with/)).toBeInTheDocument();

    expect(apiFetch).toHaveBeenCalledWith(
      '/api/members/email-change/confirm',
      expect.objectContaining({
        method: 'POST',
        anonymous: true,
        body: JSON.stringify({ memberId: 'member-1', token: 'the-raw-token' }),
      }),
    );
  });

  it('"Back to the family" navigates to the tenant dashboard after a successful confirm', async () => {
    apiFetch.mockResolvedValue({
      newEmail: 'yusuf.new@example.com',
      memberName: 'Yusuf',
      tenantSlug: 'khans',
    });
    renderAt('/confirm-email/member-1?token=the-raw-token');
    fireEvent.click(screen.getByTestId('confirm-email-confirm'));
    await waitFor(() => expect(screen.getByTestId('confirm-email-back')).toBeInTheDocument());
    fireEvent.click(screen.getByTestId('confirm-email-back'));
    await waitFor(() => expect(screen.getByTestId('dashboard-route')).toBeInTheDocument());
  });

  it('a 410 response shows the expired state, with no member email leaked', async () => {
    apiFetch.mockRejectedValue(
      new ApiError(410, '/api/members/email-change/confirm', { error: 'expired' }),
    );
    renderAt('/confirm-email/member-1?token=used-token');
    fireEvent.click(screen.getByTestId('confirm-email-confirm'));
    await waitFor(() => expect(screen.getByText('This link has expired')).toBeInTheDocument());
    expect(
      screen.getByText(/ask an admin to send a new one/i, { exact: false }),
    ).toBeInTheDocument();
    expect(screen.queryByTestId('confirm-email-new-address')).not.toBeInTheDocument();
  });

  it('"Back to the family" on the expired state falls back to "/" (no tenant known)', async () => {
    apiFetch.mockRejectedValue(
      new ApiError(410, '/api/members/email-change/confirm', { error: 'expired' }),
    );
    renderAt('/confirm-email/member-1?token=used-token');
    fireEvent.click(screen.getByTestId('confirm-email-confirm'));
    await waitFor(() => expect(screen.getByTestId('confirm-email-back')).toBeInTheDocument());
    fireEvent.click(screen.getByTestId('confirm-email-back'));
    await waitFor(() => expect(screen.getByTestId('home-route')).toBeInTheDocument());
  });

  // FHS-510 blocker #3: a transient failure (network drop, 502 Supabase
  // hiccup, 500 post-apply drift) is NOT "expired": the token may still be
  // good, so the page must offer a retry, not tell the user to ask for a
  // new link.
  describe('transient failures render "error" (retryable), never "expired"', () => {
    it('a 502 EMAIL_CHANGE_APPLY_FAILED response shows the error state with a retry button', async () => {
      apiFetch.mockRejectedValue(
        new ApiError(502, '/api/members/email-change/confirm', {
          error: 'could not update email',
          errorCode: 'EMAIL_CHANGE_APPLY_FAILED',
        }),
      );
      renderAt('/confirm-email/member-1?token=some-token');
      fireEvent.click(screen.getByTestId('confirm-email-confirm'));
      await waitFor(() => expect(screen.getByText('Something went wrong')).toBeInTheDocument());
      expect(screen.queryByText('This link has expired')).not.toBeInTheDocument();
      expect(screen.getByTestId('confirm-email-retry')).toBeInTheDocument();
    });

    it('a 500 EMAIL_CHANGE_APPLY_FAILED (post-apply drift) response also shows the error state', async () => {
      apiFetch.mockRejectedValue(
        new ApiError(500, '/api/members/email-change/confirm', {
          error: 'apply failed',
          errorCode: 'EMAIL_CHANGE_APPLY_FAILED',
        }),
      );
      renderAt('/confirm-email/member-1?token=some-token');
      fireEvent.click(screen.getByTestId('confirm-email-confirm'));
      await waitFor(() => expect(screen.getByText('Something went wrong')).toBeInTheDocument());
    });

    it('a plain network error (no HTTP status) also shows the error state, not expired', async () => {
      apiFetch.mockRejectedValue(new TypeError('Failed to fetch'));
      renderAt('/confirm-email/member-1?token=some-token');
      fireEvent.click(screen.getByTestId('confirm-email-confirm'));
      await waitFor(() => expect(screen.getByText('Something went wrong')).toBeInTheDocument());
    });

    it('"Try again" on the error state re-fires the confirm request', async () => {
      apiFetch.mockRejectedValueOnce(
        new ApiError(502, '/api/members/email-change/confirm', { error: 'boom' }),
      );
      renderAt('/confirm-email/member-1?token=some-token');
      fireEvent.click(screen.getByTestId('confirm-email-confirm'));
      await waitFor(() => expect(screen.getByTestId('confirm-email-retry')).toBeInTheDocument());

      apiFetch.mockResolvedValueOnce({
        newEmail: 'yusuf.new@example.com',
        memberName: 'Yusuf',
        tenantSlug: 'khans',
      });
      fireEvent.click(screen.getByTestId('confirm-email-retry'));
      await waitFor(() => expect(screen.getByText('Email updated')).toBeInTheDocument());
      expect(apiFetch).toHaveBeenCalledTimes(2);
    });

    it('"Back to the family" on the error state navigates home', async () => {
      apiFetch.mockRejectedValue(
        new ApiError(502, '/api/members/email-change/confirm', { error: 'boom' }),
      );
      renderAt('/confirm-email/member-1?token=some-token');
      fireEvent.click(screen.getByTestId('confirm-email-confirm'));
      await waitFor(() => expect(screen.getByTestId('confirm-email-back')).toBeInTheDocument());
      fireEvent.click(screen.getByTestId('confirm-email-back'));
      await waitFor(() => expect(screen.getByTestId('home-route')).toBeInTheDocument());
    });
  });

  // FHS-510 blocker #9: screen readers must announce the state transitions.
  it('the status region is announced via role="status" aria-live="polite"', () => {
    apiFetch.mockImplementation(() => new Promise(() => {}));
    renderAt('/confirm-email/member-1?token=abc123');
    const region = screen.getByTestId('confirm-email-status-region');
    expect(region).toHaveAttribute('role', 'status');
    expect(region).toHaveAttribute('aria-live', 'polite');
  });
});
