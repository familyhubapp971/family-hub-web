# Feature: Family settings

**Jira:** [FHS-620](https://qualicion2.atlassian.net/browse/FHS-620) (Admin Panel redesign epic) · [FHS-621](https://qualicion2.atlassian.net/browse/FHS-621) (route + menu) · [FHS-626](https://qualicion2.atlassian.net/browse/FHS-626) (family name endpoint) · [FHS-624](https://qualicion2.atlassian.net/browse/FHS-624) (this page)
**Status:** shipped
**Owner:** product-manager

`/t/:slug/family-settings` holds the things a parent sets once and the two
they hope never to touch: the family's name, the currency the whole app
shows money in, downloading the family's data, and deleting the family hub.
It replaced the "App Info" and "Settings" tabs of the old Admin Panel
(FHS-620), which mixed these rare controls in with daily money tools.

Everyday controls (what a sticker is worth, what happens on a skipped day)
live on a separate page, Earning rules (`/t/:slug/reward-settings`): this
page only links there, so nobody hunts for it here.

Admin-only, like every other family-wide setting: a non-admin caller is
redirected to the dashboard.

## User stories

### Story 1: Rename the family

**As an** admin
**I want** to change my family's display name
**so that** it shows correctly everywhere the family is named.

#### Acceptance criteria

**Scenario: An admin renames the family**

- **Given** an admin changes the family name and saves
- **When** any member reloads
- **Then** they see the new name wherever the family is named

**Scenario: A blank name is refused**

- **Given** an admin clears the name and saves
- **When** it is submitted
- **Then** the Save button stays disabled and a plain-words reason shows,
  the old name stands

### Story 2: Set the currency the whole app shows

**As an** admin
**I want** to choose the currency every amount in the app displays in
**so that** money is shown the way my family expects.

#### Acceptance criteria

**Scenario: Changing the currency sticks**

- **Given** a parent changes the currency to pounds and saves
- **When** they reload, and when another parent opens the app
- **Then** both see pounds everywhere
- **And** the page says plainly that changing it does not convert amounts
  already recorded

**Scenario: A currency the app cannot show is refused**

- **Given** a parent whose request asks for a currency with no small change,
  like the yen
- **When** they save
- **Then** the save is refused with a plain reason, and the currency does not
  change

The picker never offers one of these, so nobody reaches this by clicking
(FHS-515 filtered the list to currencies the sticker economy can render).
FHS-636 made the server say the same thing, because its own check was three
uppercase letters and nothing more.

### Story 3: Find the everyday controls without hunting

**As a** parent looking for the sticker rate or skip-day rule
**I want** a clear pointer to where those live
**so that** I don't search Family settings for something that isn't there.

#### Acceptance criteria

**Scenario: Nothing rare sits next to something daily**

- **Given** the page
- **When** it is reviewed
- **Then** the things touched once (name, currency) are visually separated
  from the things touched often (a banner links to Earning rules)
- **And** the dangerous ones (export, delete) sit in their own fenced
  "Careful zone"

### Story 4: Download the family's data

**As an** admin
**I want** a real, immediate download of everything my family has stored
**so that** I always have my own copy (GDPR data portability).

#### Acceptance criteria

**Scenario: Export gives a real file**

- **Given** a parent asks for their data
- **When** they confirm
- **Then** they get their actual data as a downloaded file, not a message
  saying it is coming

### Story 5: Delete the family hub, safely

**As an** admin
**I want** deleting the family to require real effort and say exactly what
is lost
**so that** nobody loses their family by tapping something on the way past.

#### Acceptance criteria

**Scenario: Deleting takes real effort**

- **Given** a parent presses delete
- **When** they have not typed the confirmation (their exact family name)
- **Then** nothing can be deleted, and the page says in plain words what
  would be lost
- **And** once they type the exact name, the delete request is sent and
  they are signed out

## Deviations from the Magic Patterns design

The design (editor `kudjspxd3xxroueg5jw11o`, artifact
`265da613-5c0f-45f1-bfc9-9c840d102995`, `pages/FamilySettings.tsx`) matches
this page's layout and copy closely, with these deliberate changes:

| Design showed                                                      | Shipped instead                                                          | Why                                                                                                                                                                               |
| ------------------------------------------------------------------ | ------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| A "Short line underneath" the family name, saved to `localStorage` | Dropped entirely                                                         | FHS-626 deliberately shipped no endpoint for it ("a decision on whether it is worth having at all"). A field that looks editable and saves nowhere is worse than not offering it. |
| Currency written straight to `localStorage`                        | `PUT /api/admin/settings/currency`, shared by every member               | The design never called the API at all; the ticket requires the change to be visible to every parent, not just the browser that made it.                                          |
| Family name with no save path                                      | `PUT /api/admin/settings/familyName` (FHS-626)                           | Same reason: nothing in the design persisted the name.                                                                                                                            |
| "Download our data" showed a fake "we'll email you" message        | `GET /api/admin/export`, a real file downloads immediately               | The real endpoint already exists and returns the file synchronously; the design's copy described a flow the app doesn't have.                                                     |
| Delete required typing the literal word "DELETE"                   | Delete requires typing the family's **exact name**                       | `POST /api/admin/delete-account` only accepts `confirm` equal to the tenant's name; the design's confirmation word doesn't match what the API checks.                             |
| Delete button had no handler                                       | Wired to the real endpoint, then signs the caller out and returns to `/` | The design's button did nothing at all.                                                                                                                                           |

## Out of scope

- **The family's web address (slug).** Renaming the family never touches
  the slug; changing the slug itself is not offered anywhere in the app.
  Since FHS-715 (Private family code) the slug is the private code the server
  makes, like e29b-41d4, not the surname.
- **Currency conversion of historical amounts.** Changing the currency
  only changes how future and existing raw numbers are labelled and
  formatted, it never recalculates or converts stored amounts.
- **Undoing a deletion.** `POST /api/admin/delete-account` is permanent;
  there is no recovery flow.

## Open questions

- Whether a "short line underneath" the family name is worth building at
  all (and, if so, what it would be used for) is still open; see FHS-626.

## Success metrics

- Zero support reports of a currency or name change not showing up for
  other family members (checks the PUT calls actually land, not just the
  local screen).
- Zero accidental family deletions reported (the typed-confirmation gate
  holding).
