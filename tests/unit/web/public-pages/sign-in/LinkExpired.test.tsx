// FHS-575: a dead sign-in link used to land on the loading screen's stalled
// state, saying "This is taking longer than usual." with a progress bar still
// creeping along while nothing was loading. It has its own screen now.
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { LinkExpired, reasonFromError } from '../../../../../src/public-pages/sign-in/LinkExpired';

const signInWithOtp = vi.fn();
vi.mock('../../../../../src/app/lib/supabase', () => ({
  supabase: { auth: { signInWithOtp: (...a: unknown[]) => signInWithOtp(...a) } },
}));

function renderScreen(props: Parameters<typeof LinkExpired>[0] = {}) {
  return render(
    <MemoryRouter>
      <LinkExpired {...props} />
    </MemoryRouter>,
  );
}

describe('reasonFromError', () => {
  it.each([
    ['That sign-in link has expired or already been used.', 'used'],
    ['Email link is invalid or has expired', 'invalid'],
    ['something else entirely', 'expired'],
    [undefined, 'expired'],
  ])('maps %s to %s', (message, expected) => {
    expect(reasonFromError(message)).toBe(expected);
  });
});

describe('LinkExpired', () => {
  beforeEach(() => {
    signInWithOtp.mockReset();
    sessionStorage.clear();
  });

  // The whole point of the ticket.
  it('never says the app is still loading', () => {
    renderScreen({ reason: 'expired' });
    expect(screen.getByTestId('link-expired-title').textContent).toMatch(/expired/i);
    expect(document.body.textContent).not.toMatch(/taking longer than usual/i);
    expect(screen.queryByTestId('loading-progress')).not.toBeInTheDocument();
  });

  it('words each case differently', () => {
    const { unmount } = renderScreen({ reason: 'used' });
    expect(screen.getByTestId('link-expired-title').textContent).toMatch(/already been used/i);
    unmount();

    renderScreen({ reason: 'invalid' });
    expect(screen.getByTestId('link-expired-title').textContent).toMatch(/didn't come through/i);
  });

  // FHS-609: the founder's revised design. A known address is stated in the
  // panel, nothing to type; the labelled box only appears when unknown.
  it('FHS-609: states the known address in the panel instead of a box', () => {
    renderScreen({ email: 'sarah@khan.family' });
    const panel = screen.getByTestId('link-expired-known-address');
    expect(panel.textContent).toContain('We will send it to');
    expect(panel.textContent).toContain('sarah@khan.family');
    expect(screen.queryByTestId('link-expired-email')).not.toBeInTheDocument();
  });

  it('asks for the address when we do not have one', () => {
    renderScreen();
    const box = screen.getByTestId('link-expired-email');
    expect(box).toHaveValue('');
    expect(screen.queryByTestId('link-expired-known-address')).not.toBeInTheDocument();
  });

  // FHS-609: switching swaps to the empty box, rather than making someone
  // clear the wrong address by hand.
  it('lets someone switch to a different address', () => {
    renderScreen({ email: 'wrong@khan.family' });
    fireEvent.click(screen.getByTestId('link-expired-different-email'));
    const box = screen.getByTestId('link-expired-email');
    expect(box).toHaveValue('');
    expect(screen.queryByTestId('link-expired-known-address')).not.toBeInTheDocument();
  });

  it('sends a new link and confirms it', async () => {
    signInWithOtp.mockResolvedValue({ error: null });
    renderScreen({ email: 'sarah@khan.family' });

    fireEvent.submit(screen.getByTestId('link-expired-send').closest('form')!);

    await waitFor(() => expect(screen.getByTestId('link-expired-sent')).toBeInTheDocument());
    expect(signInWithOtp).toHaveBeenCalledWith(
      expect.objectContaining({ email: 'sarah@khan.family' }),
    );
    expect(screen.getByText(/check your inbox/i)).toBeInTheDocument();
    // So /verify-email and a later retry know who we are.
    expect(sessionStorage.getItem('fh.signup.email')).toBe('sarah@khan.family');
  });

  it('rejects a bad address without calling Supabase', async () => {
    renderScreen({ email: 'not-an-email' });

    fireEvent.submit(screen.getByTestId('link-expired-send').closest('form')!);

    await waitFor(() => expect(screen.getByRole('alert').textContent).toMatch(/valid email/i));
    expect(signInWithOtp).not.toHaveBeenCalled();
  });

  it('surfaces a send failure in friendly words', async () => {
    signInWithOtp.mockResolvedValue({
      error: { message: 'For security purposes, you can only request this after 30 seconds.' },
    });
    renderScreen({ email: 'sarah@khan.family' });

    fireEvent.submit(screen.getByTestId('link-expired-send').closest('form')!);

    await waitFor(() => expect(screen.getByRole('alert').textContent).toMatch(/wait 30 seconds/i));
  });

  it('offers a way back to sign in', () => {
    renderScreen();
    expect(screen.getByTestId('link-expired-back')).toHaveAttribute('href', '/login');
  });

  it('keeps its controls above the tap floor', () => {
    renderScreen();
    expect(screen.getByTestId('link-expired-email').className).toContain('min-h-[48px]');
    expect(screen.getByTestId('link-expired-send').className).toContain('min-h-[48px]');
    expect(screen.getByTestId('link-expired-back').className).toContain('min-h-[44px]');
  });

  // FHS-578: the reserved error line used to be a 20px band on top of the
  // button's own margin, so the button sat 32px below the address panel where
  // the Magic Patterns design has it much closer.
  it('FHS-578: the reserved error line does not open a band above the button', () => {
    renderScreen();
    const slot = screen.getByTestId('link-expired-error-slot');
    expect(slot.className).toContain('min-h-[1rem]');
    expect(slot.className).toContain('mt-1');
    expect(screen.getByTestId('link-expired-send').className).toContain('mt-1');
  });

  it('FHS-578: a send failure fits the reserved line', async () => {
    signInWithOtp.mockResolvedValue({
      error: { message: 'For security purposes, you can only request this after 30 seconds.' },
    });
    renderScreen();
    fireEvent.submit(screen.getByTestId('link-expired-send').closest('form')!);

    const error = await screen.findByRole('alert');
    expect(error.className).toContain('text-xs');
    expect(error.className).toContain('leading-4');
  });
});
