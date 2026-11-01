# Feature: Change your own sign-in email

**Jira:** [FHS-510](https://qualicion2.atlassian.net/browse/FHS-510)
**Status:** shipped
**Owner:** product-manager

A grown-up can update their OWN sign-in email from Manage Members,
**self-serve only; nobody can change someone else's login email, admin or
not.** A one-time confirm link is emailed to the NEW address; the old
address keeps working until that link is clicked and the recipient
explicitly confirms. The OLD address is also notified, both when the
change starts and when it completes, so a silent account takeover isn't
possible. Clicking the link lands on a ConfirmEmail screen that applies the
change only after an explicit tap.

> **Pivot note (2026-07-31):** this feature originally shipped as an
> admin-changes-anyone flow. The founder reversed that design before wider
> rollout: a member may only ever change their own sign-in email. The
> backend now rejects any attempt to target another member's row
> (`family-hub-api/src/areas/family/members.ts`, `POST /api/members/:id/email-change`)
> with a 403, regardless of the caller's role. This doc reflects the
> shipped self-serve behaviour, not the original pitch.

## User stories

### Story 1: A member starts a change to their OWN email

**As a** signed-in grown-up (any role, admin, adult, teen)
**I want to** set a new sign-in email for MYSELF
**so that** my account moves to my current email address without losing
access in the meantime.

#### Acceptance criteria

**Scenario: A member sends a confirm link to their own new address**

- **Given** I am signed in and viewing Manage Members
- **And** my own card has a sign-in email and no change already pending
- **When** I choose "Change email" on MY OWN card and submit a new address
- **Then** a one-time confirm link is emailed to the NEW address
- **And** a heads-up notice (no action link) is emailed to my OLD address
- **And** my card shows "Confirm the new email" with the pending address
- **And** I can still sign in with my OLD email until the link is confirmed

**Scenario: The new address already belongs to another Family Hub account**

- **Given** I am on Manage Members, starting a change for my own email
- **When** I submit an email that is already registered to a different account
- **Then** the request is rejected
- **And** no confirm email is sent

**Scenario: A caller cannot start or cancel a change for ANOTHER member**

- **Given** I am signed in, admin or not
- **When** I attempt to start or cancel an email change for a member row that
  isn't my own
- **Then** the request is rejected with a 403 and nothing is written
- **And** this is true even for an admin targeting another admin's row

**Scenario: A member never sees another member's sign-in email or pending change**

- **Given** I am signed in as any role, viewing Manage Members
- **When** I view a card that isn't my own
- **Then** that member's sign-in email and any pending change are hidden from me
- **And** no "Change email" or pending-change controls are shown on their card
- **And** MY OWN card shows my real email + any pending change of my own

### Story 2: I confirm the new email I requested

**As the** grown-up who started their own email change
**I want to** open the link I was emailed and explicitly confirm it
**so that** my account starts using the new address, and a scanned or
prefetched link can never spend the confirmation on my behalf.

#### Acceptance criteria

**Scenario: Opening the link shows a confirm step, not an instant change**

- **Given** I started an email change for myself and received the confirm link
- **When** I open the link
- **Then** I land on a ConfirmEmail screen showing "Confirm your new email" and a button
- **And** nothing about my account has changed yet

**Scenario: Tapping confirm applies the change**

- **Given** I am on the "Confirm your new email" screen from a valid link
- **When** I tap "Confirm email change"
- **Then** the screen shows "Email updated" with my new sign-in email
- **And** a heads-up notice is emailed to my OLD address confirming the change
- **And** a "Back to the family" button returns me to the family

**Scenario: An expired, already-used, or cancelled link shows a clear message**

- **Given** the link has already been confirmed once, or 24 hours have passed, or I cancelled my own change
- **When** I tap "Confirm email change"
- **Then** I see "This link has expired" with no email address shown
- **And** nothing about my account is changed

**Scenario: A transient failure shows a retryable error, not "expired"**

- **Given** I am on the "Confirm your new email" screen from a valid, unexpired, unused link
- **When** I tap "Confirm email change" and a transient failure occurs (e.g. the Supabase
  update fails, or the local apply fails right after Supabase succeeds)
- **Then** I see "Something went wrong" with a "Try again" button
- **And** I am never told the link has expired for a failure that may still be retryable

### Story 3: I manage my own pending change

**As a** grown-up with a change already in flight
**I want to** resend or cancel MY OWN pending email change
**so that** I can recover from a typo or a change of mind before I confirm
the link.

#### Acceptance criteria

**Scenario: I resend my own confirm link**

- **Given** I have a pending email change of my own
- **When** I choose Resend on my own card
- **Then** a fresh one-time link is emailed to the same pending address
- **And** the previous link stops working

**Scenario: I cancel my own pending change**

- **Given** I have a pending email change of my own
- **When** I choose "Cancel change" on my own card
- **Then** the pending request is dropped
- **And** my card no longer shows a pending state
- **And** my sign-in email is unchanged

**Scenario: I cannot cancel someone else's pending change**

- **Given** another member has a pending email change
- **When** I attempt to cancel it
- **Then** the request is rejected with a 403 and their pending row is untouched

## Out of scope

- **An admin changing another member's email**: the original pitch for
  this ticket; reversed before rollout (see the pivot note above). An
  admin who wants to help a grown-up who's locked out still has to ask
  them to do it themselves, or reset their password via the normal
  Supabase auth recovery flow.
- Changing a kid's PIN-login identity, kids don't have a sign-in email
  (ADR 0009).
- Per-target throttling beyond the one-pending-change-per-member database
  constraint, drift monitoring/alerting on the rare Supabase-succeeded-but-
  local-apply-failed case, and revoking the target's other active sessions
  on a completed change, tracked as follow-ups, not blocking for v1.

## Open questions

- None outstanding.

## Success metrics

- Zero cross-member email changes, nobody can start, resend, or cancel a
  change for a row that isn't their own (verified by the single-use,
  hashed-token design + the self-serve `target.userId !== userRow.id` gate).
- Members can recover from a mis-typed new address without engineering
  support (Resend / Cancel cover it).
- Zero silent account takeovers, the OLD address always gets a signal
  (start + completion notices), so an unexpected change is always
  detectable by the person it happened to.
