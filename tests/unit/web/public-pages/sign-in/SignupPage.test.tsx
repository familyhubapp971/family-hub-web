import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { SignupPage } from '../../../../../src/public-pages/sign-in/SignupPage';

// /signup is now email-only (option A in the duplication thread).
// Family name + slug are collected post-auth on the
// CreateFamilyPanel rendered by LegacyDashboardRedirect: see
// `LegacyDashboardRedirect.test.tsx`. The signup screen's only jobs
// are: send a magic link OR kick off Google OAuth.

const signInWithOtp = vi.fn();
const signInWithOAuth = vi.fn();
vi.mock('../../../../../src/app/lib/supabase', () => ({
  supabase: {
    auth: {
      signInWithOtp: (...args: unknown[]) => signInWithOtp(...args),
      signInWithOAuth: (...args: unknown[]) => signInWithOAuth(...args),
    },
  },
}));

describe('<SignupPage />', () => {
  afterEach(() => {
    signInWithOtp.mockReset();
    signInWithOAuth.mockReset();
    sessionStorage.clear();
  });

  function renderPage() {
    return render(
      <MemoryRouter>
        <SignupPage />
      </MemoryRouter>,
    );
  }

  it('renders both panels: left social proof + right email form', () => {
    renderPage();
    expect(screen.getByText(/2,400\+ families/i)).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: /get started/i })).toBeInTheDocument();
    expect(screen.getByTestId('signup-email')).toBeInTheDocument();
    expect(screen.getByTestId('signup-submit')).toBeInTheDocument();
    expect(screen.getByTestId('signup-google')).toBeInTheDocument();
  });

  // FHR-22: the Terms link opened a blank page because /terms never existed.
  it('links Terms and Privacy to the real legal pages', () => {
    renderPage();
    expect(screen.getByRole('link', { name: 'Terms' })).toHaveAttribute('href', '/legal/terms');
    expect(screen.getByRole('link', { name: /Privacy/ })).toHaveAttribute('href', '/legal/privacy');
  });

  it('does not render the legacy family-name / slug / display-name fields', () => {
    renderPage();
    expect(screen.queryByTestId('signup-family-name')).toBeNull();
    expect(screen.queryByTestId('signup-display-name')).toBeNull();
    expect(screen.queryByTestId('signup-slug-preview')).toBeNull();
  });

  it('rejects invalid email + does not call Supabase', () => {
    renderPage();
    fireEvent.change(screen.getByTestId('signup-email'), { target: { value: 'not-an-email' } });
    fireEvent.submit(screen.getByTestId('signup-form'));
    expect(screen.getByTestId('signup-error').textContent).toMatch(/valid email/i);
    expect(signInWithOtp).not.toHaveBeenCalled();
  });

  it('calls signInWithOtp with the email and stashes the email on submit', async () => {
    signInWithOtp.mockResolvedValue({ error: null });
    renderPage();
    fireEvent.change(screen.getByTestId('signup-email'), {
      target: { value: 'sarah@example.com' },
    });
    fireEvent.submit(screen.getByTestId('signup-form'));
    await Promise.resolve();
    expect(signInWithOtp).toHaveBeenCalledWith(
      expect.objectContaining({
        email: 'sarah@example.com',
        options: expect.objectContaining({
          emailRedirectTo: expect.stringContaining('/auth/callback'),
        }),
      }),
    );
    // Stash the email for /verify-email to render "Check your inbox at <addr>".
    expect(sessionStorage.getItem('fh.signup.email')).toBe('sarah@example.com');
    // No legacy intent should be written.
    expect(sessionStorage.getItem('fh.signup.intent')).toBeNull();
  });

  it('clears the inline error the moment the user starts typing again', () => {
    renderPage();
    fireEvent.submit(screen.getByTestId('signup-form'));
    expect(screen.getByTestId('signup-error')).toBeInTheDocument();
    fireEvent.change(screen.getByTestId('signup-email'), { target: { value: 's' } });
    expect(screen.queryByTestId('signup-error')).toBeNull();
  });

  it('Google button kicks off signInWithOAuth without a pre-flight gate', () => {
    signInWithOAuth.mockResolvedValue({ error: null });
    renderPage();
    fireEvent.click(screen.getByTestId('signup-google'));
    expect(signInWithOAuth).toHaveBeenCalledWith(
      expect.objectContaining({
        provider: 'google',
        options: expect.objectContaining({
          redirectTo: expect.stringContaining('/auth/callback'),
        }),
      }),
    );
  });

  it('rewrites the email rate-limit error to a friendly next-step message', async () => {
    signInWithOtp.mockResolvedValue({ error: { message: 'email rate limit exceeded' } });
    renderPage();
    fireEvent.change(screen.getByTestId('signup-email'), {
      target: { value: 'sarah@example.com' },
    });
    fireEvent.submit(screen.getByTestId('signup-form'));
    await waitFor(() => {
      const text = screen.getByTestId('signup-error').textContent ?? '';
      expect(text).toMatch(/too many sign-in links/i);
      expect(text).toMatch(/google/i);
    });
  });

  it('passes through an unknown Supabase error unchanged', async () => {
    signInWithOtp.mockResolvedValue({ error: { message: 'Some brand-new Supabase failure' } });
    renderPage();
    fireEvent.change(screen.getByTestId('signup-email'), {
      target: { value: 'sarah@example.com' },
    });
    fireEvent.submit(screen.getByTestId('signup-form'));
    await waitFor(() =>
      expect(screen.getByTestId('signup-error').textContent).toMatch(/brand-new supabase failure/i),
    );
  });
});
