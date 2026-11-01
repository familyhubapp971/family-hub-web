// Translates Supabase auth error messages into the copy we want to show
// to a user staring at our form. Defaults to passing the original message
// through unchanged so a new failure mode never silently turns into the
// catch-all "something went wrong".
//
// Add a case here every time you see a Supabase error message in
// production that we wouldn't put on the screen as-is.

export function friendlyAuthErrorMessage(raw: string | undefined): string {
  const message = (raw ?? '').trim();
  if (!message) return 'Something went wrong. Please try again.';

  // Supabase returns "email rate limit exceeded" / "Email rate limit
  // exceeded for ..." when the auth project's per-hour OTP cap is hit.
  // On managed email (free tier) that cap is 2/hr; with custom SMTP
  // wired it's whatever rate_limit_email_sent is set to. Either way
  // the user-facing answer is the same: wait, or pick Google.
  // FHS-695/696: our own server's per-address cap on sign-in emails says
  // "Too many sign-in emails to this address..."; same advice as Supabase's.
  if (
    (/rate\s*limit/i.test(message) && /email/i.test(message)) ||
    /too many sign-in emails/i.test(message)
  ) {
    return "We've sent too many sign-in links recently. Try again in an hour, or use Continue with Google.";
  }

  // Generic per-IP / per-method rate limit hit: same advice without
  // singling out email since the limit may be the OTP-verify or
  // token-refresh bucket.
  if (/rate\s*limit/i.test(message) || /too\s+many\s+requests/i.test(message)) {
    return 'Too many attempts. Please wait a moment and try again, or use Continue with Google.';
  }

  // FHS-564: over_email_send_rate_limit is the short per-address throttle
  // and its message says neither "rate limit" nor "too many requests", so
  // it slipped through the two patterns above and reached the screen raw:
  // "For security purposes, you can only request this after 30 seconds."
  // Keep the number when Supabase gives us one, since "wait 30 seconds" is
  // more useful than "wait a moment".
  const throttle = /for security purposes.*?after (\d+) seconds?/i.exec(message);
  if (throttle) {
    return `Please wait ${throttle[1]} seconds before asking for another link, or use Continue with Google.`;
  }
  if (/for security purposes/i.test(message)) {
    return 'Please wait a moment before asking for another link, or use Continue with Google.';
  }

  // A user who clicks a link Supabase has already consumed gets this on
  // verify. Surfaces during testing when a tab reloads with `?code=...`
  // still on the URL.
  if (/already been used/i.test(message) || /expired/i.test(message)) {
    return 'That sign-in link has expired or already been used. Request a new one.';
  }

  // FHS-279: Log in with an email that has no account. The login form
  // sends shouldCreateUser=false on purpose (login must not create
  // accounts), and Supabase answers "Signups not allowed for otp".
  if (/signups?\s+not\s+allowed/i.test(message)) {
    return 'No account found for this email - create an account first, then log in.';
  }

  // Supabase's invalid-email guard. Front-end Zod normally catches this
  // first; keep the fallback for when the network strips the casing.
  if (/invalid.*email/i.test(message) || /email.*invalid/i.test(message)) {
    return 'Please enter a valid email address.';
  }

  return message;
}
