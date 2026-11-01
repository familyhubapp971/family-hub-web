# Feature: Getting started (first-run setup guide)

**Jira:** [FHS-511](https://qualicion2.atlassian.net/browse/FHS-511),
[FHS-634](https://qualicion2.atlassian.net/browse/FHS-634)
**Status:** shipped
**Owner:** product-manager

One-line: a card at the top of the family dashboard that walks a brand-new
family through the first four setup steps, celebrates when they're all done,
then clears itself and never comes back.

The card lives above the Today content on the dashboard's home tab. A step is
ticked when the family **really has that thing**, and hiding the card is
remembered **against the parent's account**, so both answers follow the person
rather than the browser they happen to be using (FHS-634).

Two guardrails: the guide **only shows to an admin** (every step lands on an
admin-only setup screen, so a non-admin adult never sees it), and the steps are
**sequential**: only the next outstanding step has an active button; later steps
sit as a quiet "Up next" so the eye lands on one job at a time.

## User stories

### Story 1: A new family is guided through setup

**As a** parent who just created a family
**I want** a short checklist of the first things to do
**so that** I know how to get the app working for my kids.

#### Acceptance criteria

**Scenario: New family sees the guide**

- **Given** a family that just signed up
- **When** I open the dashboard
- **Then** I see the "Getting started" card with "0 of 4 done" and the first
  step highlighted as the button to tap

**Scenario: Steps tick when the family really has them**

- **Given** I am signed in as the admin of a freshly seeded family
- **When** I open the family dashboard
- **Then** the setup guide counts the steps my family has already done
- **And** the steps my family has done are ticked off

**Scenario: Finished**

- **Given** all four steps are done
- **Then** the card celebrates with "You are all set up"
- **And** a "Got it" button clears it for good

### Story 2: The guide remembers me, not my browser

**As a** parent who signs in from a phone and a laptop
**I want** the guide to stay hidden once I hide it
**so that** finished setup is not presented to me again as unfinished work.

#### Acceptance criteria

**Scenario: Hiding the guide follows the parent to another browser**

- **Given** I am signed in as the admin of a freshly seeded family
- **And** I have hidden the setup guide on the family dashboard
- **When** I open the family dashboard in a different browser
- **Then** the setup guide does not appear

**Scenario: The guide is usable on a phone**

- **Given** I am signed in as the admin of a freshly seeded family
- **And** I am on a phone-sized screen
- **When** I open the family dashboard
- **Then** the setup guide fits the screen with no sideways scrolling
- **And** its button is big enough to tap

**Scenario: The guide is usable on a tablet**

- **Given** I am signed in as the admin of a freshly seeded family
- **And** I am on a tablet-sized screen
- **When** I open the family dashboard
- **Then** the setup guide fits the screen with no sideways scrolling
- **And** its button is big enough to tap
- **And** each step sits on one row

**Scenario: One parent hiding it does not hide it for the other parent**

- **Given** two admins in the same family
- **When** one of them hides the guide
- **Then** the other still sees it, because it is their own setup view

## The four steps

| #   | Step                           | Counts as done when                                                       | Button           | Goes to                 |
| --- | ------------------------------ | ------------------------------------------------------------------------- | ---------------- | ----------------------- |
| 1   | Add your kids                  | The family has at least one child or teen.                                | Add a child      | Manage Members          |
| 2   | Give each kid a PIN            | **Every** kid has a PIN, so nobody is locked out.                         | Set PINs         | Manage Members          |
| 3   | Choose what a sticker is worth | The rate was saved, differs from the default, or a child has an override. | Set pocket money | Reward Settings         |
| 4   | Pick their first habits        | At least one kid owns a habit of their own.                               | Open their world | The first child's world |

Two deliberate calls in that table:

- **Every kid needs a PIN**, not just one. A family where two of three children
  cannot sign in has not finished that step, and ticking it would walk them
  past a job that is still half done.
- **The starter habits seeded at sign-up do not count.** Those are family-level
  rows with no owner (`db/seed-tenant-defaults.ts`); step 4 asks whether the
  family chose habits **for a child**. An archived habit does not count either.
- **The rate step has three ways to be true.** The timestamp only exists from
  FHS-634 onwards, so every family that predates it starts with a null stamp.
  Asking a family that has been running for months to go and choose a sticker
  rate is the nagging this ticket exists to stop, so a rate that differs from
  the 0.50 default, or any per-child override, counts as proof somebody already
  decided. A family still sitting on an untouched 0.50 is genuinely
  indistinguishable from one that never looked, so they are asked once.

## How it is stored

| Thing           | Where                                                                    |
| --------------- | ------------------------------------------------------------------------ |
| Step progress   | Nowhere. Derived per request from members, habits and the tenant's rate. |
| Hidden by me    | `members.get_started_dismissed_at`, so it is per person per family.      |
| Rate was chosen | `tenants.sticker_rate_set_at`, stamped by `PUT /api/reward-config`.      |

`sticker_rate_minor` carries `NOT NULL DEFAULT 50`, so its value alone cannot
say whether a family ever picked it. From FHS-634 onwards the timestamp answers
that precisely; for families that predate it, a non-default rate or a per-child
override stands in (see the note above).

## Out of scope

- **Un-hiding.** There is no "show me the guide again" control. Once hidden it
  stays hidden for that parent; the underlying steps are all reachable from the
  normal navigation anyway.
- **A family-wide dismissal.** Hiding is per parent on purpose: a second parent
  joining later still gets their own orientation.

## Success metrics

- Share of new families who complete all four steps within their first session.
- Fewer "how do I add a child / set a PIN / start habits?" support questions
  from new families after rollout.

## Implementation notes

- Component: `src/areas/today/GetStarted.tsx`, mounted above
  `TodayTabPanel` on the dashboard home tab (`DashboardPage.tsx`).
- API: `GET /api/onboarding/get-started` returns `{ dismissed, steps, firstKidId }`;
  `POST /api/onboarding/get-started/dismiss` hides it. Both admin-only (403
  otherwise), both in `family-hub-api/api-docs/openapi.json`.
- Step rules live in `family-hub-api/src/areas/family/get-started.ts`; `deriveGetStartedSteps`
  is pure so the rules are unit-tested without a database.
- Migration `0045_get_started_state.sql` adds the two nullable columns; rollback
  in `drizzle/down/`.

### Deviations from FHS-511 as shipped

| What changed                                  | Why                                                                                                                      |
| --------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------ |
| Tapping a step no longer ticks it             | Tapping proved nothing. The step ticks when the family has the thing.                                                    |
| State moved out of `localStorage`             | It was keyed per family per browser, so it reset on every new browser and was shared between two parents on one machine. |
| Existing browser-side dismissals carried over | Read once on first load after the upgrade, POSTed to the server, then the old key is deleted.                            |
