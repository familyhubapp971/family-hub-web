# Feature: Auth

**Jira:** [FHS-178](https://qualicion2.atlassian.net/browse/FHS-178) (epic), child tickets FHS-187..FHS-194
**Status:** in-progress
**Owner:** product-manager

The sign-in service is the source of truth for identity: our own GoTrue
server on staging, and Supabase Auth on production until FHS-701 (see
[ADR 0022](../decisions/0022-own-sign-in-server.md), which replaced
[ADR 0003](../decisions/0003-auth-library.md)). GoTrue is the software
Supabase runs, so every flow below behaves the same on both; where a step
says "Supabase", read "the sign-in service". This doc covers the
user-facing web flows shipped under FHS-190: signup, login (email +
Google), logout, password reset request, and the OAuth callback. JWT
verification on the api (FHS-191) and the user-mirror sync
(FHS-192) are tracked separately and are out of scope here.

## User stories

### Story 1: Sign up with email + password

**As a** prospective Family Hub member
**I want to** create an account with my email and a password
**so that** I can sign in and start using the app.

#### Acceptance criteria

**Scenario: Visitor signs up with valid credentials**

- **Given** I am on the public landing
- **When** I open `/signup`
- **And** I fill in a valid email and a password of at least 8 characters
- **And** I submit the form
- **Then** the form posts to Supabase and returns success
- **And** I see a "Check your inbox to confirm your email" message

**Scenario: Visitor submits an invalid email**

- **Given** I am on `/signup`
- **When** I enter `not-an-email` and a valid password
- **And** I submit the form
- **Then** the form does not call Supabase
- **And** I see a validation error inline

**Scenario: Supabase rejects the signup**

- **Given** I am on `/signup`
- **When** I submit credentials Supabase rejects (e.g., user already exists)
- **Then** the Supabase error message is rendered inline
- **And** the form remains editable so I can retry

### Story 2: Log in with email + password

**As a** registered Family Hub user
**I want to** sign in with my email and password
**so that** I can access my account.

#### Acceptance criteria

**Scenario: User logs in with correct credentials**

- **Given** I have a confirmed account
- **And** I am on `/login`
- **When** I submit my email and password
- **Then** Supabase issues a session
- **And** I am redirected to `/dashboard`

**Scenario: User logs in with wrong password**

- **Given** I am on `/login`
- **When** I submit a wrong password
- **Then** I see an inline error message
- **And** I remain on `/login`

### Story 3: Log in with Google OAuth

**As a** Family Hub user
**I want to** sign in with my Google account
**so that** I don't have to manage another password.

#### Acceptance criteria

**Scenario: User signs in via Google OAuth callback**

- **Given** I am on `/login`
- **When** I click "Continue with Google"
- **Then** Supabase redirects me to Google's consent screen
- **And** after consenting I land on `/auth/callback`
- **And** the Supabase JS client picks up the session from the URL hash
- **And** I am redirected to `/dashboard`

### Story 4: Log out

**As a** signed-in Family Hub user
**I want to** sign out
**so that** my session ends on this device.

#### Acceptance criteria

**Scenario: User logs out from the dashboard**

- **Given** I am signed in and viewing `/dashboard`
- **When** I click "Log out"
- **Then** `supabase.auth.signOut()` is called
- **And** the session is cleared
- **And** I am redirected to the public landing

### Story 5: Request a password reset

**As a** Family Hub user who has forgotten their password
**I want to** request a password-reset email
**so that** I can regain access to my account.

#### Acceptance criteria

**Scenario: User requests a password reset email**

- **Given** I am on `/login`
- **When** I open "Forgot password?"
- **And** I submit my email address
- **Then** `supabase.auth.resetPasswordForEmail` is called with a `redirectTo` of `/auth/reset`
- **And** I see a "Check your inbox" confirmation message

### Story 6: Protected dashboard

**As a** signed-in Family Hub user
**I want** the dashboard to require a session
**so that** signed-out visitors can't see authenticated UI.

#### Acceptance criteria

**Scenario: Signed-out visitor is redirected to login**

- **Given** I have no Supabase session
- **When** I navigate to `/dashboard`
- **Then** I am redirected to `/login`

**Scenario: Signed-in user sees the dashboard**

- **Given** I have a valid Supabase session
- **When** I navigate to `/dashboard`
- **Then** I see my email and a logout button

### Story 7: See my name on /me

**As a** signed-in Family Hub user
**I want** the `/me` page to greet me by email
**so that** I know the api recognises my session and the user-mirror sync worked end-to-end.

#### Acceptance criteria

**Scenario: Signed-in user sees their email greeting on /me**

- **Given** I am signed in with the e2e test account
- **When** I navigate to `/me`
- **Then** I see "Hello, {my email}"
- **And** my user id and account-creation timestamp are visible

## Out of scope

- JWT verification on the api side, FHS-191.
- Postgres `users` mirror upsert on first authenticated request, FHS-192.
- Magic-link / OTP flows, backlog.
- Multi-factor auth, backlog.
- Tenant-context propagation from session to api, Sprint 1 (FHS-12).

## Open questions

- Final visual treatment of the auth screens (current pass uses the
  shared `@familyhub/ui` neo-brutalist design system; revisit once a
  brand pass lands).

## Success metrics

- Signup → confirmed account conversion ≥ 70 % (post-launch).
- Login p95 latency < 500 ms (k6 perf, FHS-185 territory).
- Zero unhandled auth errors surfaced to Sentry per 1k attempts.
