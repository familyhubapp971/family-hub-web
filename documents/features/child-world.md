# Feature: Child world (a per-child screen)

**Jira:** [FHS-268](https://qualicion2.atlassian.net/browse/FHS-268) (shell) · [FHS-401](https://qualicion2.atlassian.net/browse/FHS-401) (Learning Insights) · [FHS-523](https://qualicion2.atlassian.net/browse/FHS-523) (account pill) · [FHS-529](https://qualicion2.atlassian.net/browse/FHS-529) (header matches the design) · [FHS-585](https://qualicion2.atlassian.net/browse/FHS-585) (the menu marks the open world)
**Status:** shipped
**Owner:** product-manager

One-line: a friendly, per-child screen at `/t/:slug/child/:memberId` where a
grown-up opens one child's world, their habits/rewards (My World), Meals,
Calendar, Journal, and (for grown-ups) Learning Insights, reached from the
account menu's "View World" links.

> This doc covers the **child-world screen a grown-up views**. The screen a
> child sees after their own PIN login is the separate "kid dashboard"
> (`KidDashboardShell`), which keeps its own simpler, kid-only header.

## User stories

### Story 1: The header matches the rest of the app

**As a** grown-up viewing one of my children's worlds
**I want** the top of the screen to look like the rest of the app
**so that** I always know where I am and how to get back or switch child.

#### Acceptance criteria

**Scenario: The child-world header matches the design (breadcrumb + hero + pill)**

- **Given** I am a signed-in grown-up on a child's world
- **Then** the top-left shows a "← Family Hub / {Child}'s World" breadcrumb
- **And** below it a hero row: the child's avatar disc, a "{Child}'s Magical World ✨" title, and a "Magic Active" indicator
- **And** the top-right shows the same account pill as the family dashboard

**Scenario: "Family Hub" goes back to the family dashboard**

- **Given** I am on a child's world
- **When** I tap "Family Hub" in the breadcrumb
- **Then** I land back on the family dashboard

**Scenario: Switching to another child**

- **Given** I have more than one child
- **When** I open the account pill and tap another child's "View World"
- **Then** that child's world opens

**Scenario: The menu says which world is open**

- **Given** I am viewing one child's world and have more than one child
- **When** I open the account menu
- **Then** that child's row is marked as the one being viewed and reads "Viewing ✓", and every other child still reads "View World →"
- **And** a screen reader announces that row as the current item

**Scenario: Tapping the child I am already viewing**

- **Given** the account menu is open on that child's world
- **When** I tap their row
- **Then** the menu closes and nothing reloads

**Scenario: Nothing is marked on the family dashboard**

- **Given** I am on the family dashboard with no child's world open
- **When** I open the account menu
- **Then** no child row is marked as being viewed

**Scenario: The pill shows my name, never my login email**

- **Given** my login has no full name saved
- **When** the account pill renders on a child's world
- **Then** it shows my family-roster name, not my email address

**Scenario: Learning Insights is grown-ups-only**

- **Given** I am a child or teen viewing a world
- **Then** the "Learning Insights" tab is not shown to me

## Out of scope

- The child's own PIN-login dashboard header (`KidDashboardShell`), unchanged
  by FHS-523; it keeps its kid-only stars chip + Sign out.
- The child's balance in the header, it now lives inside the My World tab, not
  the top bar (removed from the header to match the design).

## Open questions

- Should the breadcrumb also show the family name (e.g. "Khan Family / Ali's
  World") rather than the generic "Family Hub"?

## Success metrics

- Zero "how do I get back to the family?" confusion reports after the header
  change (the breadcrumb is the single, obvious way back).

## Implementation notes

- The header reuses the exported `ProfilePill` from
  `src/app/layout/AppHeader.tsx`: same account menu (children +
  Manage family + Reward settings + Log out) as the dashboard, so the two
  never drift.
- The pill's name comes from the caller's roster row: `GET /api/members` now
  returns `callerMemberId`, so the page finds the caller in the roster and
  shows their display name instead of the JWT email (FHS-506/FHS-523).
