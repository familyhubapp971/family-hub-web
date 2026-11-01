# Feature: Loading screen

**Jira:** [FHS-550](https://qualicion2.atlassian.net/browse/FHS-550) (one branded wait everywhere),
[FHS-419](https://qualicion2.atlassian.net/browse/FHS-419) (first branded loader)
**Status:** shipped
**Owner:** product-manager
**Design:** Magic Patterns `kudjspxd3xxroueg5jw11o`, `components/LoadingScreen.tsx`

Every full-screen wait in the product shows the same branded screen: the
magic-link callback, protected routes, the route-level code-splitting
fallback, the legacy dashboard redirect and the kid load.

## User stories

### Story 1: Know the app is working, not broken

**As a** parent who has just clicked a sign-in link
**I want** a clear screen while the app signs me in
**so that** I do not think it has hung or taken me somewhere wrong.

Before this, two washed-out screens showed faint grey text on the dark
purple: "Sign in to Family Hub", then "Finding your family hub…". Both read
as a broken page rather than a wait.

#### Acceptance criteria

**Scenario: magic-link sign-in shows one clear loading screen**

- **Given** I click the magic link in my email
- **When** the app is signing me in and finding my family
- **Then** I see the branded loading screen with clearly readable text until my dashboard appears
- **And** the faint "Sign in to Family Hub" and "Finding your family hub…" greys never show

**Scenario: a stalled wait offers a way out**

- **Given** the wait has run for 15 seconds, or the sign-in link has failed
- **When** the screen updates
- **Then** it reads "This is taking longer than usual." with the reason beneath
- **And** it offers "Try again" where the caller supports retrying, and always "Back to sign in"

### Story 2: One loading component, not a dozen

**As an** engineer
**I want** a single shared wait
**so that** screens stop inventing their own spinners and drifting apart.

#### Acceptance criteria

**Scenario: one loading component in the codebase**

- **Given** a full-screen wait anywhere in the app
- **When** it renders
- **Then** it uses `src/app/components/LoadingScreen.tsx`
- **And** small in-panel waits use the shared `Spinner` from `design-system` rather than their own `animate-spin`

### Story 3: Usable on any device, with or without motion

**As a** visitor on a phone, or someone who has asked for less motion
**I want** the wait to behave
**so that** it neither overflows my screen nor moves when I have asked it not to.

#### Acceptance criteria

**Scenario: accessible and responsive**

- **Given** a user on any device or with reduced-motion enabled
- **When** the loading screen shows
- **Then** it fits mobile, tablet and desktop with no horizontal scroll
- **And** it shows a static, readable state without animation for reduced-motion users

## Behaviour as shipped

- **Composition:** a pastel star disc flanked by two smaller family discs, the
  FamilyHub wordmark, one line of reassurance copy, then a progress bar. The
  kingdom starfield sits behind it.
- **The copy is always white.** Faint grey on purple is the defect this screen
  exists to remove, so the reassurance line is `text-white` and the supporting
  line on the failure state is `pastel-cyan`, both well clear of the contrast
  floor.
- **A travelling bar, not a spinning circle**, on a black-bordered white track.
  A circle spinning forever tells the reader nothing.
- **Per-wait copy.** `callback`, `protected`, `redirect` and `kid` each open
  with their own line and then rotate through reassurance messages every 2.8
  seconds.
- **Reduced motion:** nothing animates, and the bar holds a partial fill so the
  screen still reads as deliberate rather than frozen.
- **Stall:** after 15 seconds, or on an error passed by the caller, the screen
  switches to the recovery state with its buttons at the 44px tap floor.
- **The live region is the copy line itself**, so screen readers hear the wait
  change rather than a separate hidden announcement.

## Deliberate deviations from the Magic Patterns design

| Deviation                                                                                      | Why                                                                                                                                                     |
| ---------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Kept the timeout inside `LoadingScreen` rather than MP's separate `LoadingWithTimeout` wrapper | The repo already had the 15s stall and an `error` prop that callers pass; adopting the wrapper meant rewriting every caller for no user-visible gain    |
| Kept the rotating reassurance copy MP dropped                                                  | A line frozen for 15 seconds reads as a hang; it rotates only when motion is allowed                                                                    |
| Kept `role="main"` and the brand link                                                          | The loader stays a landmark and keeps a way out                                                                                                         |
| `LoadingScreen` lives in `src/`, not `design-system`                                           | It uses the router for the brand link and "Back to sign in"; `design-system` has no router dependency. The inline `Spinner` did go into `design-system` |

## Out of scope

- Per-component skeleton screens. This is the full-screen wait only.
- The in-button spinner states, which use the shared `Spinner` rather than
  taking over the viewport.

## Success metrics

- No grey interim text on any wait.
- One full-screen loading component, and one inline spinner primitive.
