import { describe, it, expect, vi, afterEach } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Routes, Route, useLocation, useParams } from 'react-router-dom';
import { LoginPage } from '../../../../../src/public-pages/sign-in/LoginPage';

// FHS-224: passwordless login. Tests cover the rewritten UX:
// magic-link via signInWithOtp, Google via signInWithOAuth, no
// password field, redirect to /verify-email after magic-link send.

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

function LocationProbe() {
  const loc = useLocation();
  return <span data-testid="location-search">{loc.search}</span>;
}

// FHS-353: marks the kid picker route so we can assert the kid panel
// navigates to /t/<slug>/kid-login with the typed family code.
function KidLoginMarker() {
  const { slug } = useParams<{ slug: string }>();
  return <div data-testid="route-kid-login">kid-login:{slug}</div>;
}

function renderPage(initial = '/login') {
  return render(
    <MemoryRouter initialEntries={[initial]}>
      <Routes>
        <Route
          path="/login"
          element={
            <>
              <LoginPage />
              <LocationProbe />
            </>
          }
        />
        <Route path="/verify-email" element={<div data-testid="route-marker">verify-email</div>} />
        <Route path="/signup" element={<div data-testid="route-marker">signup</div>} />
        <Route path="/t/:slug/kid-login" element={<KidLoginMarker />} />
      </Routes>
    </MemoryRouter>,
  );
}

// FHS-360: the kid view now renders KidSignIn, which fetches
// /api/public/kid-members/:slug. Stub it to return one kid so the tiles render.
function stubKidMembersFetch() {
  vi.stubGlobal(
    'fetch',
    vi.fn(async () => ({
      ok: true,
      status: 200,
      json: async () => ({
        family: { slug: 'smiths', name: 'The Smiths' },
        kids: [{ id: 'k1', displayName: 'Sam', avatarEmoji: '🦊' }],
      }),
    })),
  );
}

describe('<LoginPage />', () => {
  afterEach(() => {
    signInWithOtp.mockReset();
    signInWithOAuth.mockReset();
    sessionStorage.clear();
    localStorage.clear();
    vi.unstubAllGlobals();
  });

  it('renders the magic-link form (no password field) and the Google button', () => {
    renderPage();
    expect(screen.getByTestId('login-email')).toBeInTheDocument();
    expect(screen.getByTestId('login-submit')).toBeInTheDocument();
    expect(screen.getByTestId('login-google')).toBeInTheDocument();
    // Confirm the legacy password field is gone.
    expect(screen.queryByTestId('login-password')).toBeNull();
  });

  // FHS-258: error from a failed submit must clear the moment the
  // user starts typing again.
  it('clears the inline error when the user types into email after a failed submit', () => {
    renderPage();
    fireEvent.change(screen.getByTestId('login-email'), { target: { value: 'not-an-email' } });
    fireEvent.submit(screen.getByTestId('login-form'));
    expect(screen.getByTestId('login-error')).toBeInTheDocument();
    fireEvent.change(screen.getByTestId('login-email'), {
      target: { value: 'sarah@example.com' },
    });
    expect(screen.queryByTestId('login-error')).toBeNull();
  });

  it('rejects an invalid email + does not call Supabase', () => {
    renderPage();
    fireEvent.change(screen.getByTestId('login-email'), { target: { value: 'not-an-email' } });
    fireEvent.submit(screen.getByTestId('login-form'));
    expect(signInWithOtp).not.toHaveBeenCalled();
    expect(screen.getByTestId('login-error')).toBeInTheDocument();
  });

  it('calls signInWithOtp + redirects to /verify-email on submit with a valid email', async () => {
    signInWithOtp.mockResolvedValue({ error: null });
    renderPage();
    fireEvent.change(screen.getByTestId('login-email'), {
      target: { value: 'sarah@example.com' },
    });
    fireEvent.submit(screen.getByTestId('login-form'));
    await waitFor(() =>
      expect(screen.getByTestId('route-marker').textContent).toBe('verify-email'),
    );
    expect(signInWithOtp).toHaveBeenCalledWith({
      email: 'sarah@example.com',
      options: {
        emailRedirectTo: expect.stringContaining('/auth/callback'),
        // /login must NOT silently create accounts: keeps signup/login
        // semantically distinct (AC1).
        shouldCreateUser: false,
      },
    });
    // Email is stashed for /verify-email to render "Check your inbox at <email>".
    expect(sessionStorage.getItem('fh.signup.email')).toBe('sarah@example.com');
  });

  it('rewrites the email rate-limit error to a friendly next-step message', async () => {
    signInWithOtp.mockResolvedValue({ error: { message: 'email rate limit exceeded' } });
    renderPage();
    fireEvent.change(screen.getByTestId('login-email'), {
      target: { value: 'sarah@example.com' },
    });
    fireEvent.submit(screen.getByTestId('login-form'));
    await Promise.resolve();
    await Promise.resolve();
    const text = screen.getByTestId('login-error').textContent ?? '';
    expect(text).toMatch(/too many sign-in links/i);
    expect(text).toMatch(/google/i);
    expect(screen.queryByTestId('route-marker')).toBeNull();
  });

  it('Google button kicks off signInWithOAuth with provider=google', () => {
    signInWithOAuth.mockResolvedValue({ error: null });
    renderPage();
    fireEvent.click(screen.getByTestId('login-google'));
    expect(signInWithOAuth).toHaveBeenCalledWith({
      provider: 'google',
      options: { redirectTo: expect.stringContaining('/auth/callback') },
    });
  });

  it('"Create a new family" link routes to /signup', () => {
    renderPage();
    fireEvent.click(screen.getByTestId('login-create-family'));
    expect(screen.getByTestId('route-marker').textContent).toBe('signup');
  });

  // FHS-237: parent / kid toggle.
  it('defaults to the parent panel + role-toggle has aria-pressed=true on parent', () => {
    renderPage();
    expect(screen.getByTestId('login-parent-panel')).toBeInTheDocument();
    expect(screen.queryByTestId('login-kid-panel')).toBeNull();
    expect(screen.getByTestId('login-role-parent').getAttribute('aria-pressed')).toBe('true');
    expect(screen.getByTestId('login-role-kid').getAttribute('aria-pressed')).toBe('false');
    // Default URL has no ?role= param: kid is the only state we encode
    // so a returning parent doesn't see ugly query strings on /login.
    expect(screen.getByTestId('location-search').textContent).toBe('');
  });

  it('the role toggle buttons read cleanly to screen readers (emoji hidden)', () => {
    renderPage();
    // Accessible name excludes the decorative emoji (aria-hidden).
    expect(screen.getByRole('button', { name: "I'm a Parent" })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: "I'm a Kid" })).toBeInTheDocument();
  });

  it('honours ?role=kid on initial render', () => {
    renderPage('/login?role=kid');
    expect(screen.getByTestId('login-kid-panel')).toBeInTheDocument();
    expect(screen.queryByTestId('login-parent-panel')).toBeNull();
    // FHS-353: the kid panel now offers a self-serve family-code entry.
    expect(screen.getByTestId('login-kid-code')).toBeInTheDocument();
  });

  // FHS-360: entering a family code shows that family's kid tiles in-card.
  it('entering a family code shows that family kid tiles', async () => {
    stubKidMembersFetch();
    renderPage('/login?role=kid');
    fireEvent.change(screen.getByTestId('login-kid-code'), { target: { value: 'Smiths' } });
    fireEvent.submit(screen.getByTestId('login-kid-form'));
    await waitFor(() => expect(screen.getByTestId('kid-login-avatars')).toBeInTheDocument());
  });

  it('shows a friendly error for an invalid family code and does not navigate', () => {
    renderPage('/login?role=kid');
    fireEvent.change(screen.getByTestId('login-kid-code'), { target: { value: 'bad code!!' } });
    fireEvent.submit(screen.getByTestId('login-kid-form'));
    expect(screen.getByTestId('login-kid-error')).toBeInTheDocument();
    expect(screen.queryByTestId('route-kid-login')).toBeNull();
  });

  // FHS-437: a device with no remembered family must land on the friendly
  // code-entry prompt, never an error/dead-end screen.
  it('no remembered family shows the code-entry prompt, not an error', () => {
    renderPage('/login?role=kid');
    expect(screen.getByTestId('login-kid-code')).toBeInTheDocument();
    expect(screen.queryByTestId('kid-login-not-found')).toBeNull();
    expect(screen.queryByTestId('login-kid-error')).toBeNull();
    expect(screen.queryByTestId('login-kid-notice')).toBeNull();
  });

  // FHS-437: a stale remembered family (deleted / recreated tenant) must
  // never strand the kid on "we couldn't find a family". It gets forgotten
  // and the kid is dropped back to the code-entry prompt with a plain note.
  it('a stale remembered family that 404s is forgotten and drops back to code entry', async () => {
    localStorage.setItem(
      'fh.kid.lastFamily',
      JSON.stringify({ slug: 'ghost-family', name: 'Ghost Family' }),
    );
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => ({ ok: false, status: 404, json: async () => ({}) })),
    );
    renderPage('/login?role=kid');

    await waitFor(() => expect(screen.getByTestId('login-kid-code')).toBeInTheDocument());
    expect(screen.getByTestId('login-kid-notice').textContent).toMatch(/didn.t work/i);
    expect(screen.queryByTestId('kid-login-not-found')).toBeNull();
    expect(localStorage.getItem('fh.kid.lastFamily')).toBeNull();
  });

  // FHS-437: a mistyped code (valid format, no such family) must not wipe
  // out a different, perfectly good remembered family, and shows an inline
  // error the kid can fix in place instead of a dead-end screen.
  it('a mistyped code that 404s shows an inline error and leaves a good remembered family alone', async () => {
    // "smiths" is a genuinely working remembered family on this device.
    localStorage.setItem(
      'fh.kid.lastFamily',
      JSON.stringify({ slug: 'smiths', name: 'The Smiths' }),
    );
    vi.stubGlobal(
      'fetch',
      vi.fn(async (url: string) => {
        if (String(url).includes('/kid-members/smiths')) {
          return {
            ok: true,
            status: 200,
            json: async () => ({
              family: { slug: 'smiths', name: 'The Smiths' },
              kids: [{ id: 'k1', displayName: 'Sam', avatarEmoji: '🦊' }],
            }),
          };
        }
        return { ok: false, status: 404, json: async () => ({}) };
      }),
    );
    renderPage('/login?role=kid');
    await waitFor(() => expect(screen.getByTestId('kid-login-avatars')).toBeInTheDocument());

    // Kid picks "Enter a different code" and mistypes.
    fireEvent.click(screen.getByTestId('login-kid-change-family'));
    fireEvent.change(screen.getByTestId('login-kid-code'), { target: { value: 'no-such-family' } });
    fireEvent.submit(screen.getByTestId('login-kid-form'));

    await waitFor(() => expect(screen.getByTestId('login-kid-error')).toBeInTheDocument());
    expect(screen.getByTestId('login-kid-error').textContent).toMatch(
      /couldn.t find that family code/i,
    );
    expect(screen.queryByTestId('login-kid-notice')).toBeNull();
    // The unrelated remembered family is untouched.
    expect(localStorage.getItem('fh.kid.lastFamily')).toBe(
      JSON.stringify({ slug: 'smiths', name: 'The Smiths' }),
    );
  });

  it('a remembered family shows its kid tiles straight away', async () => {
    localStorage.setItem(
      'fh.kid.lastFamily',
      JSON.stringify({ slug: 'smiths', name: 'The Smiths' }),
    );
    stubKidMembersFetch();
    renderPage('/login?role=kid');
    // No family-code step: the remembered family loads its tiles directly.
    await waitFor(() => expect(screen.getByTestId('kid-login-avatars')).toBeInTheDocument());
    expect(screen.queryByTestId('login-kid-code')).toBeNull();
  });

  it('clicking the kid tab swaps the panel + sets ?role=kid in the URL', async () => {
    renderPage();
    fireEvent.click(screen.getByTestId('login-role-kid'));
    expect(screen.getByTestId('login-kid-panel')).toBeInTheDocument();
    // FHS-577: the parent panel fades out, so it lingers for a beat.
    await waitFor(() => expect(screen.queryByTestId('login-parent-panel')).toBeNull());
    expect(screen.getByTestId('location-search').textContent).toBe('?role=kid');
    expect(screen.getByTestId('login-role-kid').getAttribute('aria-pressed')).toBe('true');
    expect(screen.getByTestId('login-role-parent').getAttribute('aria-pressed')).toBe('false');
  });

  it('toggling back to parent clears ?role= from the URL', () => {
    renderPage('/login?role=kid');
    fireEvent.click(screen.getByTestId('login-role-parent'));
    expect(screen.getByTestId('login-parent-panel')).toBeInTheDocument();
    expect(screen.getByTestId('location-search').textContent).toBe('');
  });

  it('falls back to the parent panel when ?role is unknown', () => {
    renderPage('/login?role=banana');
    expect(screen.getByTestId('login-parent-panel')).toBeInTheDocument();
  });

  // I4 (qa-expert): a stale "enter a valid email" error from the parent
  // form mustn't reappear after the user toggles to kid and back:
  // they cleared their input by switching tabs, the warning would read
  // as a glitch.
  it('clears any inline parent-form error when the user toggles role', () => {
    renderPage();
    fireEvent.change(screen.getByTestId('login-email'), { target: { value: 'not-an-email' } });
    fireEvent.submit(screen.getByTestId('login-form'));
    expect(screen.getByTestId('login-error')).toBeInTheDocument();
    fireEvent.click(screen.getByTestId('login-role-kid'));
    fireEvent.click(screen.getByTestId('login-role-parent'));
    expect(screen.queryByTestId('login-error')).toBeNull();
  });
  // FHS-565: the error used to be inserted with no space reserved, pushing
  // the submit button 20px down under the user's finger.
  it('FHS-565: keeps the error slot in the layout before any error appears', () => {
    renderPage();
    const slot = screen.getByTestId('login-error-slot');
    expect(slot).toBeInTheDocument();
    expect(slot.className).toContain('min-h-');
    expect(screen.queryByTestId('login-error')).not.toBeInTheDocument();
  });

  // FHS-578: the slot used to be a sibling of the email field, so the form's
  // 16px stacking gap landed above AND below it, leaving a 44px empty band
  // under the box. Nesting it inside the field counts that gap once.
  it('FHS-578: the error slot sits inside the email field, not beside it', () => {
    renderPage();
    const slot = screen.getByTestId('login-error-slot');
    const input = screen.getByTestId('login-email');
    expect(slot.parentElement).toBe(input.parentElement);
    expect(screen.getByTestId('login-form').className).toContain('space-y-1');
    expect(slot.className).toContain('min-h-[1rem]');
  });

  // FHS-584: the card's height tween ran for 320ms while the arriving panel
  // faded in over 220ms, so the content landed 100ms before the card stopped
  // moving under it. Both now run for the same time, and the leaving panel
  // clears faster than the arriving one appears.
  it('FHS-584: one role swap leaves exactly one panel on screen', async () => {
    stubKidMembersFetch();
    renderPage();
    expect(screen.getByTestId('login-parent-panel')).toBeInTheDocument();

    fireEvent.click(screen.getByTestId('login-role-kid'));
    await waitFor(() => expect(screen.queryByTestId('login-parent-panel')).toBeNull());

    fireEvent.click(screen.getByTestId('login-role-parent'));
    await waitFor(() => expect(screen.getByTestId('login-parent-panel')).toBeInTheDocument());
    vi.unstubAllGlobals();
  });

  // FHS-586: the helper line above the email box must read exactly as the
  // design copy, no apostrophe/contraction variant.
  it('FHS-586: shows the exact helper copy above the email field', () => {
    renderPage();
    expect(
      screen.getByText('We will email you a link that signs you in. No password needed.'),
    ).toBeInTheDocument();
  });

  // FHS-586: the shared Input's `default` variant reads as disabled
  // (gray-50 fill, gray border). The email field must use the `dark`
  // variant instead: white fill, black border, matching the design.
  it('FHS-586: the email field renders the white/black-border input variant', () => {
    renderPage();
    const input = screen.getByTestId('login-email');
    expect(input.className).toContain('bg-white');
    expect(input.className).toContain('border-black');
    expect(input.className).not.toContain('bg-gray-50');
  });

  // FHS-578: one line of error text has to fit the reserved slot exactly, or
  // the button moves the moment an error appears.
  it('FHS-578: an error fits the reserved slot and leaves the button in place', () => {
    renderPage();
    const form = screen.getByTestId('login-form');
    const buttonIndexBefore = Array.from(form.children).indexOf(
      screen.getByTestId('login-submit').closest('button') as Element,
    );

    fireEvent.change(screen.getByTestId('login-email'), { target: { value: 'not-an-email' } });
    fireEvent.submit(form);

    const error = screen.getByTestId('login-error');
    expect(error.className).toContain('text-xs');
    expect(error.className).toContain('leading-4');
    expect(
      Array.from(form.children).indexOf(
        screen.getByTestId('login-submit').closest('button') as Element,
      ),
    ).toBe(buttonIndexBefore);
  });
});
