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
[FHS-714](https://qualicion2.atlassian.net/browse/FHS-714) (sign-in and sign-up test sweep),
[FHS-715](https://qualicion2.atlassian.net/browse/FHS-715) (Private family code),
[FHS-716](https://qualicion2.atlassian.net/browse/FHS-716) (One family per home),
[FHS-718](https://qualicion2.atlassian.net/browse/FHS-718) (Wrong family address shows a server error)
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

### Story 3: A private family code

**As a** parent
**I want** my family's address and kid code to be a private code, not our surname
**so that** nobody can find my children's faces by guessing our name.

#### Acceptance criteria

**Scenario: A kid types the family code once**

- **Given** a kid on a tablet that does not remember a family chooses "I'm a Kid"
- **When** they type the code from the Members page, like e29b-41d4
- **Then** their family's faces show, and the tablet remembers the family next time

**Scenario: An old surname link works only for the family**

- **Given** a signed-in parent opens an old address like /t/smith/members
- **When** the server says that address was their family's
- **Then** the same page opens at the family's code
- **And** anyone else signed in sees "We can't find that family." (FHS-718), and someone signed out gets the sign-in, never the family

**Scenario: A kid link with a surname asks for the code**

- **Given** a kid opens an old link like /t/smith/kid-login
- **Then** they land on the step where they type the family code, not on any faces

### Story 4: A wrong family address gets a plain page (FHS-718)

**As a** signed-in parent
**I want** an old or mistyped family link to tell me plainly that it goes nowhere
**so that** I am not left on a half-loaded page with a server error, and can get home in one tap.

#### Acceptance criteria

**Scenario: A family code that is not mine shows the can't-find page**

- **Given** a signed-in parent opens /t/e29b-41d4/members
- **And** e29b-41d4 is not one of their families, whether or not that family exists
- **Then** they see "We can't find that family." and "The link may be old or mistyped."
- **And** no family name, member count or server error shows
- **And** a "Go to my family" button opens their own family's home

**Scenario: An old surname link that does not forward shows the same page**

- **Given** a signed-in parent opens an old address like /t/smith/members
- **When** the server says it was not their family's address
- **Then** they see the same "We can't find that family." page

**Scenario: Someone with no family is offered to make one**

- **Given** a signed-in grown-up who belongs to no family opens a family link
- **Then** the can't-find page's button says "Create your family" and opens the create-a-family step

**Scenario: My own family opens as before**

- **Given** a signed-in parent opens any page of their own family, by code or in capitals
- **Then** the page opens as before, after the usual loading screen at most
- **And** a family whose address is still its surname opens its own pages as before
- **And** kid pages and kid sign-ins behave exactly as before

**Scenario: Signed in as the wrong person**

- **Given** a signed-in grown-up sees "We can't find that family."
- **When** they tap "Use a different account"
- **Then** they are signed out and land on the sign-in page

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

## Private family code and one family per home (FHS-715, FHS-716)

What shipped on the website. The server half lives in family-hub-api.

- **The server makes every family's code.** It is 8 letters and digits in two
  groups, like e29b-41d4, and it is the family's address too
  (`/t/e29b-41d4/...`). Older families get one as well; their surname address
  is kept by the server as the "previous" address.
- **Nobody types an address any more.** The create-a-family form asks only
  "Your name" and "Family name", and the Family URL box (with its FHS-713
  tidying) is gone. The form opens the family at the code the server sends
  back.
- **One family per home.** If someone who already made a family fills the form
  again, the server hands back that family and the form opens it, rather than
  making a second one.
- **The address can end with the family name**, like
  `/t/e29b-41d4/the-smith-family`, which opens the family's home. The code on
  its own does the same. Inner pages keep `/t/<code>/<page>`: a deliberate
  choice, so every link in the app did not need rewriting.
- **Old surname addresses forward for members only.** A signed-in person
  opening `/t/smith/...` is asked about on the server; if the address was their
  family's, the same page opens at the code, with the rest of the address and
  anything after the `?` kept. Anyone else, or someone signed out, sees the
  usual sign-in, or since FHS-718 the "can't find" page below, so a surname
  never reveals a family. A code typed in capitals opens the same family.
- **Kid pages with a surname ask for the code.** `/t/smith/kid-login` goes to
  the "I'm a Kid" family-code step instead of showing faces.
- **The kid family-code box** shows "e29b-41d4" as its example, with the help
  line "Ask a grown-up for your family code. It looks like e29b-41d4 and is on
  the Members page." The phone app uses the same words. A code typed in
  capitals, with a space, or without the hyphen still finds the family.
- **Grown-ups get the code on the Members page** in a "Kids' sign-in" card, with
  a button that hands the tablet over to the kids. See
  [family-members.md](family-members.md).

## A wrong family address (FHS-718)

The founder opened a family link with a code no family has. The page showed
"Your family", "0 members" and "Couldn't load members (server returned 400)".
Family pages only checked that someone was signed in, never that the family
was theirs, so each part of the page failed on its own.

- **Every family page checks the family is yours first.** For a signed-in
  grown-up, the website compares the code in the address with the families
  they belong to. A match opens the page as before.
- **No match shows one plain page.** "We can't find that family." with "The
  link may be old or mistyped." and one yellow button, on the app's purple
  background. It is a single column that fits a phone, a tablet and a laptop,
  and the button is full width and at least 44px tall.
- **A way out of the wrong account.** Under the button, a small "Use a
  different account" link signs out and opens the sign-in page.
- **Screen readers hear it first.** The heading takes focus when the page
  appears, so it is read out straight away.
- **The button goes home.** "Go to my family" opens the home of the first
  family they belong to, the same one sign-in picks. Someone with no family
  sees "Create your family", which opens the create-a-family step.
- **It gives nothing away.** A family that does not exist and a family that
  is not yours get exactly the same page. The website never asks the server
  about the code in the address; it only checks the person's own list.
- **Old surname links that do not forward** show the same page, instead of
  opening a page that would fail.
- **A family still on its surname address opens as before.** A family not
  given a code yet (or after a server rollback) has its surname in its own
  members' list, so its pages open, and "Go to my family" never comes back to
  the can't-find page.
- **The list of your families is asked for once per visit** and kept in
  memory, so moving between your own family's pages does not wait again. This
  is one extra request on the first family page of a visit, unless sign-in
  already fetched the list on its way in, which it keeps. A code not on the
  list is checked once more before the page says no, so a family you have
  just made or joined opens straight away.
- **Signing out forgets the list.** The next person to sign in on the same
  tab gets their own families, never the last person's.
- **A failed check never blocks you.** With no signal, if the server cannot
  answer, or if the check takes longer than 8 seconds, the page opens as it
  did before. The loading screen shows while the check runs, so the broken
  page never flashes up.
- **Kids are unchanged.** Kid pages, kid sign-ins on a shared tablet, and the
  kid link with a surname behave exactly as before.

**Known gap, not fixed here:** signing in never returns people to the page
they asked for. The sign-in step remembers it, but the end of sign-in always
opens the first family's home. This was already so before FHS-718 and will
get its own ticket.

## The phone app (FHS-708)

The app (family-hub-app) offers the same choices with the same words and
rules as the website, so nobody relearns anything.

- **One screen, not two pages.** "I'm a Parent" and "I'm a Kid" are tabs, and
  "Create a new family" switches the same card to the sign-up words.
- **Email links come back to the app** at `familyhub://auth/callback`. That
  address is on the staging sign-in server's allowed list. Production gets it
  only when the app is released, with the founder's go-ahead.
- **Google** opens in a secure in-app browser and returns to the app.
- **"Check your email!"** has the same 60-second wait before "Resend".
- **Expired, used or broken links** show the same three reasons and send a
  fresh link in one tap, to the email the device remembers.
- **Kids** type the family code once per device; after that they only tap their
  face and enter the PIN, which checks itself at 4 digits.
- **A grown-up with no family** creates one in the app, with the website's
  labels, rules and error lines.
- **The look is the phone design's.** Magic Patterns "FH Mobile App Branding
  Kit" v3: the kingdom purple with the FH badge at the top, a white sheet
  below, a grey switch for "I'm a Parent" and "I'm a Kid", coloured face
  tiles and a round-key PIN pad. The words stay the website's where the
  website has them (founder decision, 2026-11-01).
- **Two additions from the design:** "Open Mail" after a link is sent, and a
  number pad for the PIN instead of the phone's keyboard.
- **Google sign-in left open over 5 minutes** is closed by the app on an
  iPhone, with "That took too long, so we stopped it to keep your account
  safe. Please try again." (FHS-712, Google sign-in timeout message).
- **Expo Go cannot finish a grown-up sign-in**, because its return address is
  not on the allowed list. Test builds can.
- **The same sweep fixes** apply in the app wherever it has the feature
  (family-hub-app #2, FHS-714).

## Out of scope

- Password sign-in. The product is passwordless by decision (ADR 0011).

## Known drift elsewhere

`documents/features/auth.md` still describes email + password sign-up and a
password reset. Those stories predate the move to magic links and need a pass
of their own; this doc covers the sign-in screen only.
