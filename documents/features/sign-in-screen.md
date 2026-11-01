# Feature: Sign-in screen

**Jira:** [FHS-573](https://qualicion2.atlassian.net/browse/FHS-573) (design alignment),
[FHS-578](https://qualicion2.atlassian.net/browse/FHS-578) (email box to button gap),
[FHS-602](https://qualicion2.atlassian.net/browse/FHS-602) (one read-only box on the expired-link screen),
[FHS-604](https://qualicion2.atlassian.net/browse/FHS-604) (the address survives into a new tab),
[FHS-605](https://qualicion2.atlassian.net/browse/FHS-605) (the link itself carries the address),
[FHS-609](https://qualicion2.atlassian.net/browse/FHS-609) (the known address is stated in the panel),
[FHS-586](https://qualicion2.atlassian.net/browse/FHS-586) (email box colour + helper copy),
[FHS-360](https://qualicion2.atlassian.net/browse/FHS-360) (kid sign-in),
[FHS-237](https://qualicion2.atlassian.net/browse/FHS-237) (the card),
[FHS-714](https://qualicion2.atlassian.net/browse/FHS-714) (sign-in and sign-up test sweep)
**Status:** shipped
**Owner:** product-manager
**Design:** Magic Patterns `kudjspxd3xxroueg5jw11o`, `pages/Login.tsx`

One card at `/login` with a Parent / Kid toggle. Parents get a passwordless
magic link or Google. Kids pick their face and type a PIN.

## User stories

### Story 1: A kid signs in without reading

**As a** child using the family tablet
**I want** to tap my own face and type my PIN
**so that** I can get into my world without an email address or a password.

#### Acceptance criteria

**Scenario: Picking a face opens that child's PIN**

- **Given** a kid opens the sign-in card and chooses "I'm a Kid"
- **When** they tap their face
- **Then** the row of faces is replaced by their avatar, their name and a PIN box
- **And** a "Back" control returns them to the faces

**Scenario: A sibling can take over**

- **Given** one child has started typing a PIN
- **When** a sibling presses Back and picks their own face
- **Then** the first child's part-finished attempt is discarded and cannot sign anyone in

### Story 2: The screen matches the design

**As the** founder
**I want** the shipped screen to match the Magic Patterns design
**so that** what I approve is what families see.

#### Acceptance criteria

**Scenario: Kid sign-in matches the design**

- **Given** a visitor picks "I'm a Kid"
- **When** the picker and the PIN step render
- **Then** they match the Magic Patterns design in layout, cards, avatar and PIN row

**Scenario: The transitions are there**

- **Given** a visitor moves between parent, kid picker and PIN entry
- **When** each step changes
- **Then** the arriving step slides in, and reduced-motion users get a plain swap

**Scenario: No accessibility regression**

- **Given** the ported screen
- **When** it is measured
- **Then** every control is at least 44px, focus rings are visible, and inputs keep their labels

## Behaviour as shipped

- **Two steps for kids.** Pick a face, then a focused view of that child:
  avatar disc, name, "Enter your PIN", and the PIN row, with a Back control
  above. The faces are replaced rather than left on screen underneath.
- **Coloured tiles.** Each face sits on a coloured tile with a white avatar
  disc inside it, matching the design.
- **The faces fill the card** (FHS-577). Two sit side by side at full width.
  Three squeeze into one row at a smaller size rather than leaving one
  stranded on its own line. One renders alone rather than half a grid.
- **Motion.** Panels and steps fade up on the way in and out, and the card
  itself eases to its new height rather than snapping between three
  differently sized views. `popLayout` takes the outgoing view out of flow at
  once, so the arriving one is never held waiting for it. Reduced motion gets
  an instant swap and no height animation.
- **The swap settles in one movement** (FHS-584). The arriving panel and the
  card's height both run for 260ms, so the content no longer lands before the
  card has stopped moving under it, and the leaving panel clears in 120ms so
  the two are not crossing for long.
- **Height measuring** uses a `ResizeObserver` on the live panel. Where that
  does not exist the card simply uses auto height rather than pinning itself
  to a stale measurement.
- **Parent side** stays passwordless: one email field, a magic link, or
  Continue with Google.
- **The email box reads as the thing to fill in, not as disabled**
  (FHS-586). It is white with a black border (the shared Input's `dark`
  variant), matching the design's boxes elsewhere on this card; the
  shared component's default gray-fill variant used elsewhere in the app
  is unchanged. The helper line above it reads "We will email you a link
  that signs you in. No password needed."
- **The button sits close under the email box** (FHS-578). The slot that
  reserves room for an error lives inside the field's own wrapper, so the
  form's stacking gap is counted once rather than above and below it. The
  space between the box and the button is 24px, and one line of error text
  fits the reserved slot exactly, so the button never moves when an error
  appears or clears.

## Deliberate deviations from the Magic Patterns design

| Deviation                                   | Why                                                                                                                                                                            |
| ------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Parent form has no password field           | The product is passwordless by decision (ADR 0011). MP's mock shows email + password and a "Forgot password?" link; building those would contradict how sign-in actually works |
| No "Teen, 14" line under each face          | The faces come from a public endpoint that needs no sign-in. Adding an age would publish a child's age to anyone who knows the family's web address                            |
| Kept the accessible label on the PIN inputs | MP's PIN boxes have no label; a screen reader would read four unnamed boxes                                                                                                    |
| Kids are fetched, not hard-coded            | MP lists two example children; the real screen loads the family's own                                                                                                          |

### The expired link screen (FHS-574 design, FHS-575 build)

A sign-in link lasts an hour and works once. A dead one used to land on the
loading screen's stalled state, saying "This is taking longer than usual."
with a progress bar still creeping along while nothing was loading.

- It has its own screen now, with no progress bar and no suggestion that
  anything is still happening.
- Expired, already used and malformed share one shape: the outcome is the
  same, so only the headline and the line beneath it change.
- Getting a new link happens on that screen. When we already know the
  address, the pale blue panel states it once: "We will send it to" with the
  address beneath, nothing to type (FHS-609, the founder's revised design,
  superseding the FHS-602 read-only box). The labelled email box appears only
  when the address is genuinely unknown. "Use a different email" swaps to the
  empty box and puts the cursor in it.
- **The link itself carries the address** (FHS-605). Every magic-link
  request hands Supabase a return URL of `/auth/callback?email=...`, so the
  expired screen knows who the link was for on any device and in any browser,
  including one that never requested it. Junk in that parameter is ignored
  rather than displayed. Deliberate trade-off: the address appears in the
  link URL; the email it sits in was sent to that address anyway.
- **The address survives into a new tab** (FHS-604). An email link always
  opens a fresh tab, whose per-tab memory is empty, so requesting a link also
  remembers the address on the device (`localStorage`, key `fh.auth.email`).
  The tab's own memory still wins when present, and a device that never
  requested a link still gets the empty editable box. Deliberate trade-off:
  the address persists on the device; it is the same address the sign-in
  screens already display, not a secret.
- A confirmation follows, so nobody wonders whether it sent.
- A genuinely slow sign-in still shows the loading screen, because that one
  really is waiting.

The spacing was corrected after the first port: the reserved error line sat
as its own band above the button, and nesting it brought the gap to 24px
(FHS-578). The known-address state moved twice: FHS-602 tried one read-only
box for both states, and the founder's design revision brought back the
stated panel, which shipped as FHS-609. The panel is fed by the address in
the link (FHS-605) with device memory as the fallback (FHS-604).

### Fixes from the sign-in test sweep (FHS-714)

- **No signal gets plain words.** "{}", "Load failed" and similar now read
  "We couldn't reach Family Hub. Check your signal and try again." The phone
  app says the same.
- **A failed family check offers a retry.** If the check for your family
  fails, you see that message with a "Try again" button. The create-a-family
  form shows only when the check works and you have no family.
- **An old sign-in email no longer signs you out.** If you are still signed
  in, the expired-link screen says "You're still signed in, so there's
  nothing to fix." with a "Continue as" button showing your email.
- **Invited parents get a way out.** The create-a-family form says "Invited
  to a family? Log out and sign in with the email the invite went to." and
  ends with "Not you?" and a Log out button.
- **Resend waits a minute from the start.** The check-email page starts its
  60-second wait when it opens, because the email was just sent.
- **"No account found" carries the email over.** A "Create a family with
  this email" button opens sign-up with the email already filled in.
- **Kid family codes are tidied.** Capitals, spaces and long dashes become
  small letters and hyphens, and a link with capitals works the same.
- **PIN boxes come back after a lockout** by themselves when the wait ends.
- **A kid signing in on a shared tablet gets the kid view.** It signs the
  parent out of that tablet only; their other devices stay signed in.
  Letting the kid view win while both stayed signed in would not hold: the
  parent's session clears the kid sign-in every time the tab comes back to
  the front.

## Out of scope

- Password sign-in. The product is passwordless by decision (ADR 0011).

## Known drift elsewhere

`documents/features/auth.md` still describes email + password sign-up and a
password reset. Those stories predate the move to magic links and need a pass
of their own; this doc covers the sign-in screen only.
