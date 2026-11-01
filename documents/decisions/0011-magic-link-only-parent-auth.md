# 0011: Parent auth is magic-link + Google OAuth (no passwords)

**Status:** accepted (amended by [0022](0022-own-sign-in-server.md), 2026-11-01: the rule stands, now on our own GoTrue server)
**Date:** 2026-05-02
**Jira:** FHS-23 (Public Signup epic) · FHS-224 (auth migration) · FHS-248 (Google OAuth provider)

## Context

The Sarah persona (`documents/design/personas.html`) explicitly calls out
"no password to remember" as a hard requirement. The current
`apps/web/src/pages/auth/LoginPage.tsx` and `SignupPage.tsx` use Supabase
`signInWithPassword` and the existing `ResetPasswordRequestPage.tsx` exists
solely to handle forgotten passwords. The Magic Patterns design
(`kudjspxd3xxroueg5jw11o`) for Register and Login does not contain a password
field for parents at all.

Kid auth is a separate question answered by ADR `0009-family-membership-model`
plus the kid PIN epic FHS-234, kids do not use Supabase auth at all.

## Decision

Parent authentication is **passwordless** with two co-equal entry points:

1. **Supabase magic link** (`signInWithOtp`), primary path. Email-only form;
   clicking the emailed link both verifies the address and creates the
   session.
2. **Google OAuth** (`signInWithOAuth({ provider: 'google' })`), one-click
   path for users with a Google account. Same Supabase user record under the
   hood; provider linking handled by Supabase.

Both paths exist on **both** the signup form (FHS-26) and the login form
(FHS-237 redesign). On signup, choosing Google skips the magic-link round-trip
entirely, the user lands authenticated and is sent straight into onboarding.
On login, both buttons are visible side-by-side; the user picks whichever they
remember last.

`ResetPasswordRequestPage` is repurposed as `ResendMagicLinkPage` (or retired
and merged into the Login page with a "didn't get it? send again" button,
implementation detail). The Supabase password column is left in place at the
schema level (Supabase manages it; we do not query it) so the escape hatch in
§Consequences is available without a migration.

## Consequences

- **Easier:** entire class of password-related attacks gone (reuse, phishing,
  credential stuffing); ~30% of typical support volume eliminated; signup form
  simplified to two fields; no password-strength UI to design or maintain;
  Google users get one-click signup with zero email round-trip.
- **Harder:** users on magic-link only who lose inbox access are locked out
  (Google login still works for those who linked Google); magic-link
  deliverability remains a P0 concern (Supabase template stuck in spam =
  locked-out user); Google OAuth requires per-environment Supabase provider
  config (staging + production each need their own OAuth client) and the
  redirect URI must be locked to `https://<env>.familyhub.app/auth/callback`.
- **Follow-ups:**
  - Add deliverability monitoring as an acceptance criterion on FHS-224
    (bounce-rate alert, spam-rate alert via Supabase + the email provider).
  - File FHS-248: configure Google OAuth provider in both Supabase projects
    (staging today, production after Pro upgrade per ADR 0008).
  - Update existing E2E auth tests to use Supabase admin
    `auth.admin.generateLink()` for magic-link path; add a stubbed Google path
    using Supabase admin to mint a session without the OAuth round-trip.
  - Document in the Slice 2 PR body that signup/login UIs now show two
    side-by-side buttons (`Continue with email` + `Continue with Google`), no
    password field anywhere.
  - Surface "linked accounts" in the user profile page so a user can see they
    signed in with Google and can still request a magic link for the same
    email.

## Escape hatch

Supabase exposes `signInWithOtp`, `signInWithOAuth`, and
`signInWithPassword` simultaneously on the same project. If real-user feedback
later demands a password fallback, we can re-enable the password code path as
an opt-in toggle without a schema migration or auth-library swap. Additional
OAuth providers (Apple, Microsoft, Facebook) can be added the same way Google
was, Supabase provider config plus one button on the auth pages.

## Alternatives considered

- **Magic-link only**, rejected: a meaningful share of target families live
  inside Gmail and prefer one-click Google sign-in over the open-email-then-
  click-link round-trip. Magic-link stays as a parallel path for users on
  non-Google email and as the recovery route when Google is unavailable.
- **Google OAuth only**, rejected: forces every user to have a Google
  account; many target families do not. Magic-link works against any email
  provider.
- **Email + password with magic-link as opt-in**, rejected: keeps the support
  burden of password resets and contradicts the Sarah persona spec; defeats
  the simplicity goal.
- **WebAuthn / passkeys**, rejected for v1: passkey UX still varies wildly
  across browsers and OSes; recovery story is worse than email magic-link for
  non-technical parents. Revisit post-launch.
- **Apple Sign-in alongside Google**: deferred: Apple requires its own
  developer-account paperwork. Add when iOS native shell ships (post-launch).
