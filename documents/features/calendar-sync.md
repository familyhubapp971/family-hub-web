# Feature: Calendar sync (subscribe link)

**Jira:** FHS-445
**Status:** in-progress
**Owner:** product-manager

One-line: families can add their FamilyHub activities to their own phone
calendar (Google, Apple, or Outlook) via a private "subscribe link", so the
week's schedule shows up where they already look.

## Approach (v1)

A one-way **iCalendar (ICS) subscribe feed**, not a two-way login sync:

- The family gets a private URL (`…/api/public/calendar/<token>.ics`) they add
  to their calendar app once. The app re-polls it on its own schedule, so new
  and changed activities appear automatically.
- Works with Google, Apple, and Outlook with **no** developer-account setup and
  no OAuth/consent-screen review. Apple has no sync API at all, so a subscribe
  feed is the only way to cover all three uniformly.
- Times are emitted as absolute UTC instants (`…Z`), so every client (including
  Outlook, which mishandles bare IANA timezones) renders the right local time.

Two-way sync (create an event in Google → it flows back into FamilyHub) is out
of scope for v1, it needs Google/Microsoft OAuth apps the founder must set up,
and is tracked separately.

## User stories

### Story 1: Add my family calendar to my phone

**As a** parent
**I want** a link that puts our FamilyHub activities in my phone calendar
**so that** I see the week's schedule without opening the app.

#### Acceptance criteria

**Scenario: A member fetches the subscribe url and the public feed lists their events**

- **Given** I am a signed-in member of a family with activities
- **When** I open the "Sync to your calendar" card and request the link
- **Then** I get a private subscribe URL
- **And** fetching that URL (with no login) returns a calendar feed listing our activities

**Scenario: Tenant isolation: a family's feed never includes another family's events**

- **Given** family A and family B each have activities
- **When** family A's subscribe URL is fetched
- **Then** the feed contains only family A's activities, never family B's

### Story 2: Kill a link I shared by mistake

**As a** family admin
**I want** to regenerate the link
**so that** a link I leaked stops working.

#### Acceptance criteria

**Scenario: Rotating the feed key invalidates the old url and issues a working new one**

- **Given** I am an admin with an existing subscribe URL
- **When** I regenerate the link
- **Then** the old URL stops working (404)
- **And** the new URL returns the feed

**Scenario: Rotating the feed key is admin-only**

- **Given** I am a non-admin member
- **When** I try to regenerate the link
- **Then** I am refused (403)

### Story 3: A bad or forged link reveals nothing

**Scenario: A forged signature on a real tenant id returns 404**

- **Given** a URL with a real family id but a wrong signature
- **When** it is fetched
- **Then** it returns 404 with no family data

**Scenario: A malformed token returns 404**

- **Given** a malformed subscribe token
- **When** it is fetched
- **Then** it returns 404

## Out of scope (v1)

- Two-way sync (external calendar → FamilyHub); needs Google/Microsoft OAuth apps.
- Per-child feeds (v1 is one whole-family feed).
- A `VTIMEZONE` block; not needed while times are emitted as UTC.

## Open questions

- Should removing a member auto-rotate the feed key? (v1: no; an admin can
  rotate manually.)

## Success metrics

- Families who open the sync card and add the link at least once.
- Support tickets about "wrong time in my calendar" stay at zero (validated by
  emitting UTC + the Dubai/London timezone tests).

## Traceability

The scenario names above match the integration feature file
`tests/integration/features/calendar-feed.feature` character-for-character; the
ICS/token internals are unit-tested in
`tests/unit/api/lib/calendar-feed.test.ts`, and the card in
`tests/unit/web/areas/calendar/CalendarSyncCard.test.tsx`. A browser E2E that
subscribes a real Google/Apple/Outlook calendar is not automatable in CI (those
apps can't be driven headlessly), so the API contract is covered at the
integration tier and the UI at the web-unit tier instead.
