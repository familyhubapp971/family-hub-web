# Feature: Kids money

**Jira:** [FHS-620](https://qualicion2.atlassian.net/browse/FHS-620) (epic), [FHS-621](https://qualicion2.atlassian.net/browse/FHS-621) (route split), [FHS-622](https://qualicion2.atlassian.net/browse/FHS-622) (this page's body), [FHS-623](https://qualicion2.atlassian.net/browse/FHS-623) (the action sheet), [FHS-627](https://qualicion2.atlassian.net/browse/FHS-627) (documents the endpoints this page reads), [FHS-646](https://qualicion2.atlassian.net/browse/FHS-646) (browser proof of the savings maths)
**Status:** shipped
**Owner:** product-manager
**Design:** Magic Patterns editor `kudjspxd3xxroueg5jw11o`, `pages/KidsMoney.tsx` + `components/MoneyActions.tsx`

One-line: one screen per child showing what they have (ready to spend, in
savings, growing, and the total), what a parent can do with it, and a
week-by-week record of what happened, replacing the old Admin Panel's three
look-alike Balance/Savings/History tabs. Every one of the five action
buttons (FHS-623) actually saves to the server: nothing is a no-op or
discarded on close.

## User stories

### Story 1: See one child's money as one story

**As an** admin
**I want** to pick a child and see everything about their money on one
screen
**so that** I don't have to guess which of three tabs holds what I'm
looking for

#### Acceptance criteria

**Scenario: One child's money reads as one story**

- **Given** a parent opens Kids money and picks a child
- **When** the page renders
- **Then** they see what that child can spend, has saved and has growing,
  and a total, without changing tab

**Scenario: A family with one child skips the picker**

- **Given** a family with exactly one child
- **When** the page renders
- **Then** there is no picker to use, just that child

**Scenario: A fresh child does not look broken**

- **Given** a child with no stickers and no finished weeks
- **When** the page renders
- **Then** it says their stickers will show up here once they finish a
  habit, and no figure looks like an error

**Scenario: A failed load says so**

- **Given** the figures cannot be fetched
- **When** the page renders
- **Then** it says nothing is shown rather than something wrong, confirms
  nothing changed, and offers to try again

### Story 2: See what happened week by week

**As an** admin
**I want** a collapsible, newest-first list of a child's weeks
**so that** I can check what a specific week earned, saved and spent
without leaving the page

#### Acceptance criteria

**Scenario: A closed week's breakdown**

- **Given** a child has at least one closed (finalized) week
- **When** I open that week's row
- **Then** I see what it earned, what moved to savings, and what was spent
  on rewards, sourced from that week's real action log

**Scenario: The open week never shows fake zeroes**

- **Given** a child's current week is still open
- **When** I open that week's row
- **Then** it says the week is still open, so nothing has moved to savings
  yet, rather than showing 0 as if the week were finished

### Story 3: Do something with the money, for real (FHS-623)

**As an** admin
**I want** each of the five action buttons to actually save
**so that** a save reflects on the child's figures immediately, and again
after the page reloads, not something the design only pretended to do

#### Acceptance criteria

**Scenario: An action actually saves**

- **Given** a parent moves 5 stickers into savings
- **When** they confirm
- **Then** the child's spendable figure drops by 5, their savings rise by
  5, and both survive a reload

**Scenario: Investing carries the choices**

- **Given** a parent invests behind a habit at 3x with a skipped day taking
  value off
- **When** they confirm
- **Then** the investment is created with that multiplier and that rule,
  not with the defaults

**Scenario: Part of an investment can come out**

- **Given** an investment holding 20 stickers
- **When** a parent takes out 8
- **Then** 8 move to savings and 12 keep growing

**Scenario: The rewards are the family's own**

- **Given** a family that has set up its own reward shop
- **When** a parent opens Claim a reward
- **Then** they see their own rewards, and one costing more than the child
  has cannot be chosen

**Scenario: A failure changes nothing**

- **Given** the save does not reach the server
- **When** it fails
- **Then** the sheet says nothing changed and the figures are untouched

**Scenario: Finishing the week says so and stays said**

- **Given** a parent on their child's board on the last day of the week
- **When** they open Close Week and finish the week
- **Then** the sheet says "All done" and a new week has started
- **And** it stays on that screen instead of returning to the list of choices

### Story 4: The savings maths adds up in a real browser (FHS-646)

**As a** parent moving my child's stickers into savings
**I want** the figures to move by exactly what I moved, once
**so that** I can trust the money side of the app on a real phone, not just
in an API test

#### Acceptance criteria

**Scenario: Moving stickers to savings adds up**

- **Given** a child with 7 stickers ready to spend
- **When** a grown-up moves 5 of them into savings and confirms once
- **Then** the sheet says 5 moved and 2 are still ready to spend
- **And** exactly one save of 5 stickers is recorded against that week

**Scenario: Confirming twice still only saves once**

- **Given** a child with 7 stickers ready to spend
- **When** a grown-up taps confirm twice in a row
- **Then** exactly one save of 5 stickers is recorded against that week

**Scenario: A child cannot save more than they have**

- **Given** a child with 7 stickers ready to spend
- **When** a grown-up types a larger amount into the picker
- **Then** the amount is held at 7

These three run in the browser (`tests/e2e/features/savings-maths.feature`)
and check the screen and the recorded actions together: the message alone
would pass on a screen that lies, and the rows alone would pass on a screen
that never updates. The recorded-action count is scoped to the child's open
week, because a closed week carries its own actions.

## Where the figures come from

Every number on this page is a real API response; nothing is computed from
invented data. `formatMoney` (`family-hub-api/shared-rules/src/money.ts`) turns every
sticker count into money using the child's own currency and sticker rate;
no screen builds a money string by hand.

| Figure                    | Source                                                                                                                                                                                                  |
| ------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Who counts as a child     | `GET /api/members`, filtered with `isKidRole`                                                                                                                                                           |
| Ready to spend            | `GET /api/mw/weeks/current` for the week id, then `GET /api/mw/weeks/:id/stats` → `unallocatedStickers`                                                                                                 |
| In savings                | `GET /api/mw/financial/savings` → `savedStickers`                                                                                                                                                       |
| Growing                   | `GET /api/mw/financial/investments` → sum of `currentValueStickers`                                                                                                                                     |
| Currency + sticker rate   | `GET /api/mw/financial/savings` → `currency`, `stickerRate` (the child's own, not a hardcoded 0.5)                                                                                                      |
| Week list                 | `GET /api/mw/weeks` (reversed client-side to read newest first)                                                                                                                                         |
| A week's "earned" figure  | `GET /api/mw/weeks/:id/stats` → `totalStickers`, fetched for the visible slice (6 weeks), and for older ones only once "show older weeks" is used                                                       |
| A closed week's breakdown | `GET /api/mw/weeks/:id/actions`, summarised by `summariseWeekActions` (`family-hub-api/shared-rules/src/week-actions.ts`, the same helper the parent My World board's finished-week recap already uses) |

## Deviations from the Magic Patterns design

| In the mock                                                                                        | What shipped, and why                                                                                                                                                                                                                                                                                                                                                                                                          |
| -------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `data/kidsMoney.ts` invented per-week `earned`/`saved`/`spent` numbers                             | Replaced with the real endpoints above. Nothing on this page is mock data.                                                                                                                                                                                                                                                                                                                                                     |
| Week-list header showed a running lifetime total of stickers earned                                | Dropped. Computing a true lifetime total means fetching every week's `/stats`, unbounded for a family with a long history. The header keeps the free part (the week count) and drops the invented total.                                                                                                                                                                                                                       |
| Each child had a fixed `color` field                                                               | The API has no colour field for a member. The avatar tile colour is derived deterministically from the child's id instead, so it's still stable across visits, and shows the child's real `avatarEmoji` when one is set.                                                                                                                                                                                                       |
| `bg-kingdom` on the page background                                                                | That utility class doesn't exist in the real Tailwind preset (no `DEFAULT` shade on the `kingdom` token). Used the real class, `bg-kingdom-bg`, which renders the same purple the mock intended.                                                                                                                                                                                                                               |
| Back button read `from=child` / `child=` query params to retrace a ChildWorld → Kids money journey | Nothing in the app sets those params today (`ChildWorldPage`'s "Kids money" menu link is a plain, un-scoped navigation). Simplified Back to always return to the dashboard rather than build a return path with no caller. The `?child=` param is still honoured if present, so a future deep link can pre-select a child.                                                                                                     |
| "Do something with it" opened `components/MoneyActions.tsx`, a full action sheet                   | Built in FHS-623 as `src/areas/money/MoneyActionsSheet.tsx` plus one flow per action, then **ported to the real design in FHS-630** (see the section below). FHS-623 built from the written spec because that agent had no access to the Magic Patterns tools, which is the gap FHS-630 closed.                                                                                                                                |
| Week detail only ever showed "moved to savings" and "spent on rewards"                             | Kept both, and additionally show "Invested" and "Cashed out" when they're non-zero, mirroring the same real action outcomes the parent My World board's finished-week recap (FHS-608) already surfaces, so a week that invested or cashed out doesn't read as if nothing happened to that money.                                                                                                                               |
| Claim a reward hardcoded six rewards                                                               | Reads the family's real shop, `GET /api/rewards?memberId=`. A reward costing more than the child's real balance (the server's own `stickerBalance`, not a client guess) cannot be picked: its row is disabled with a "needs N more stickers" note.                                                                                                                                                                             |
| Invest and grow never asked for a multiplier or a skipped-day rule                                 | Both are now real fields (`coefficient` 1/2/3/5, `deductible` on/off) and both are sent on `POST /api/mw/financial/investments`, which the server has always accepted but this app had never sent.                                                                                                                                                                                                                             |
| Take money out of an investment always took the whole thing                                        | A `StickerAmountPicker` asks how much, and whatever is chosen is sent as an explicit `stickers` amount on `POST /investments/:id/withdraw`, never omitted. FHS-630 changed the starting point from the full value to zero: see below.                                                                                                                                                                                          |
| The design's "close the week" chooser, reachable from the same `MoneyActions.tsx`                  | Not built at the time. Superseded by FHS-637: see "The chooser was the missing step" below.                                                                                                                                                                                                                                                                                                                                    |
| Invest and grow's sticker ceiling                                                                  | The server's true ceiling also counts money already saved as cash, converted at the child's rate. The page's own snapshot only tracks spendable stickers + saved stickers (not saved cash), so the picker's ceiling (`available + saved`) is a conservative lower bound: it can under-offer by a few stickers for a family that saves cash rather than stickers, never over-offer. The server stays the final word either way. |

## The sheets were ported to the design in FHS-630

FHS-623 shipped the five sheets working correctly, but built from the written
spec rather than the approved design, because that agent could not open Magic
Patterns. The founder spotted the difference on sight. FHS-630 ported the real
design (`components/MoneyActions.tsx`, editor `kudjspxd3xxroueg5jw11o`).

**What changed, all of it visible:**

| Thing           | Before                                                          | Now                                                                    |
| --------------- | --------------------------------------------------------------- | ---------------------------------------------------------------------- |
| Step headings   | Small grey uppercase labels                                     | Numbered discs carrying the action's colour, each titled as a question |
| Invest step 2   | "Growth multiplier"                                             | "How much does it pay?"                                                |
| Invest step 4   | "How many stickers to invest (10 to N)"                         | "How many stickers?"                                                   |
| Invest defaults | 1x, a missed day takes value off                                | 2x, a missed day costs nothing, as the design opens                    |
| Later steps     | All shown at once                                               | Appear once the habit or investment is picked                          |
| Amount control  | Stepper only                                                    | Stepper plus the design's one-tap "Use all N"                          |
| Take money out  | Pre-selected the only investment and pre-filled its whole value | Nothing pre-selected, amount starts at zero                            |

**Deliberate deviations from the design, and why:**

| In the design                                                                             | What shipped, and why                                                                                                                                                                                                                                          |
| ----------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `utils/money.ts` hardcodes a 0.50 sticker rate and reads the currency from `localStorage` | Never copied. Every figure goes through `formatMoney` from `shared-rules` (family-hub-api) with the family's real currency and the real rate from `GET /api/mw/financial/savings`.                                                                             |
| Six hardcoded rewards                                                                     | Still the family's own shop, as FHS-623 shipped it.                                                                                                                                                                                                            |
| Three multipliers: 2x, 3x, 5x                                                             | Four: 1x, 2x, 3x, 5x. The server accepts 1 (no boost) and a parent should be able to invest without one.                                                                                                                                                       |
| Nothing on screen before the first choice                                                 | A short line says what to pick first ("Pick a habit to choose how much it pays and how many stickers go behind it"). The design left the sheet ending in nothing, which reads as broken. This is the one place the port deliberately adds rather than matches. |
| "Take out" available with the whole investment pre-filled                                 | Nothing is pre-selected and the amount starts at zero, so one tap on Confirm can never empty an investment a parent only meant to look at.                                                                                                                     |
| The "close the week" chooser                                                              | Still not built at the time. Superseded by FHS-637.                                                                                                                                                                                                            |

## FHS-631 finished the port

FHS-630 said it matched the design. It did not. The founder spotted twelve
differences on sight, one of which was a real bug.

**The bug:** a habit's icon is stored as a **name** ("heart", "star"), not an
emoji. The sheets rendered the stored value directly, so a habit row read
"heart" in a grey box. The same bug class was fixed once before (FHS-374) by a
helper that lived inside the kid pages, out of reach of anything else, so it was
reintroduced somewhere new. That helper now lives in `design-system/habitIcon.tsx`
so there is one copy every screen can reach, and two tests fail if a habit icon
ever renders as raw text again.

**The other eleven:** a tick instead of a radio dot on the chosen row; the
chosen row solid yellow instead of pale; the skipped-day pair green and red
instead of both pale; a shield and a warning triangle on that pair; the sticker
count back in the sheet header, which had been lost; the header icon tile
removed; the amount stepper rebuilt as separate square buttons either side of
the number with no "stickers" suffix; the summary line without its star icon;
and the design's own wording for the skipped-day choices.

**Shared components gained options, they did not change.** `ChoiceRow` has
`marker` and `selectedTone`, `ResultBanner` has `showIcon`, and
`StickerAmountPicker` has `variant`. Every default preserves exactly what other
screens rendered before, so nothing outside the money sheets moved.

**Deliberate deviations that remain:**

| In the design                                | What shipped, and why                                                                                                                                                                                                                                                   |
| -------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| The habit icon is a bare emoji at `text-2xl` | Ours is a line icon inside the design system's bordered tile. The server stores icon **names**, so we draw a line icon, and a bare 18px line icon has no presence next to a 2xl emoji. The tile gives it weight and it is what `ChoiceRow` already does everywhere else |
| Pays 2x, 3x, 5x                              | 1x is kept. The server accepts it, and a parent should be able to invest without a boost                                                                                                                                                                                |

## What the five actions do

| Action                          | Endpoint                                              | Notes                                                                                    |
| ------------------------------- | ----------------------------------------------------- | ---------------------------------------------------------------------------------------- |
| Claim a reward                  | `POST /api/rewards/{id}/redeem`                       | Reward list from `GET /api/rewards?memberId=`; unaffordable rewards are disabled         |
| Cash out                        | `POST /api/mw/financial/savings/cashout`              | Draws from savings only; amount picked in stickers, sent to the server as cash           |
| Move to savings                 | `POST /api/mw/financial/savings` (`type: "stickers"`) | Draws from this week's spendable stickers only                                           |
| Invest and grow                 | `POST /api/mw/financial/investments`                  | Sends `coefficient` + `deductible`; habits already invested are excluded from the picker |
| Take money out of an investment | `POST /api/mw/financial/investments/{id}/withdraw`    | Always sends an explicit `stickers` amount, so a partial withdrawal is always available  |

Every confirm is a real POST; a failure shows a plain-words error inline
and leaves the sheet open with nothing changed. On success the sheet shows
a "done" screen with what happened, and the Kids money page re-fetches its
figures in the background (`refreshAfterAction` in `KidsMoneyPage.tsx`), so
the numbers on the page move immediately and still show correctly after a
full reload, since they always come from the same real endpoints.

### Design-system additions

- `design-system/src/StepHeading.tsx` (FHS-630): the numbered step heading from
  the design. One disc, one question, the action's colour. Used by all five
  sheets so a parent can see how many answers are wanted.
- `design-system/src/StickerAmountPicker.tsx`: a whole-number +/- stepper for
  picking a count of stickers, paired with a money preview line. Sibling to
  `AmountPicker`, which works in minor currency units instead. FHS-630 added
  the design's optional one-tap "Use all N" shortcut.
- `design-system/src/Dialog.tsx` gained a real focus trap (Tab/Shift+Tab
  cycle inside the dialog, focus returns to whatever opened it on close)
  and an `align="bottom-sheet"` variant (pinned to the bottom edge on a
  phone, a centred panel from `sm:` up). Both are additive: every existing
  `Dialog`/`ConfirmDialog` consumer keeps its current behaviour unless it
  opts into the new variant.
- `design-system/src/ChoiceRow.tsx` gained an optional `disabled` prop, used
  by the reward and habit pickers to grey out an option that cannot be
  chosen.

## Who can see this page

**Any grown-up: an admin or an adult.** Anyone else (teen, child, guest) who
reaches the address is sent back to the dashboard, and the door to this page
does not appear in their profile menu at all.

Settled by [FHS-625](https://qualicion2.atlassian.net/browse/FHS-625). FHS-622
shipped with the admin-only redirect it had inherited from the Admin Panel,
which was wrong: the server has always let an adult move a child's money
(`canManage`, [ADR 0015](../decisions/0015-role-model-owner-flag.md)), so the
gate was locking adults out of something they were allowed to do. The rule now
matches the server exactly:

- **Any grown-up** may bank, invest, withdraw, claim and cash out. All of it
  can be undone.
- **Only an admin** may close, reopen or repair a week, or set a balance by
  hand. None of those controls live on this page, so nothing here 403s for an
  adult.

The page is not the gate: the server refuses regardless. See
[role-permissions.md](role-permissions.md), Story 6, for the full door-by-door
rule, and `tests/integration/features/money-permissions-by-role.feature` for
the per-role, per-endpoint proof.

## Out of scope

- ~~The design's "close the week" chooser~~: built in FHS-637, see below.
- The reward shop's catalogue management (unchanged; still reached from
  the child's own world / Earning rules).
- Editing an already-running investment's rule after it's created
  (`POST /investments/:id/settings` exists server-side but nothing in this
  sheet calls it: only new investments set `coefficient`/`deductible`).

## Success metrics

- A parent can read a child's full money picture (spend / save / grow /
  total) without switching tabs.
- No support question of the shape "where did the Balance tab go".
- Every one of the five action buttons results in a real, persisted change,
  not a screen that resets itself on close.

## The chooser was the missing step (FHS-637)

FHS-623 left the design's "close the week" chooser out on the grounds that
closing a week already existed. It did, in a much older dialog
(`CloseWeekDialog.tsx`, built in FHS-297), so the My World board's Close Week
button opened dark purple tiles and an "Admin Mode Active" banner while the
screens either side of it were the redesigned sheet. The founder reported it as
a regression, which is exactly how a deliberate carve-out with no follow-up
ticket reads.

What shipped:

| Thing            | What it does                                                                                                                                                                                                 |
| ---------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| The chooser      | `CloseWeekChooser.tsx`, ported from `components/MoneyActions.tsx` in the Magic Patterns editor: what is on the table, one row per choice with a line of explanation, then the button that finishes the week. |
| Where it opens   | The My World board's Close Week button, via the same `MoneyActionsSheet` Kids money uses. Kids money's own five buttons never reach it.                                                                      |
| Going back       | A back arrow returns from any flow to the list, and the "all done" screen offers "Do something else" so a parent can make several decisions in one sitting.                                                  |
| Closing the week | `POST /api/mw/weeks/{id}/finalize`, carrying every still-running investment into the new week. The ids are read fresh, so a withdrawal made in the same sitting is not re-continued.                         |
| The old dialog   | Deleted, about 2,000 lines, along with its own copies of all five flows. Two copies of a money flow is how they drift.                                                                                       |

**FHS-639: the header shipped white on white.** The chooser's purple header was
written as `bg-kingdom`, which is the token name in the design's own Tailwind
config. Here `kingdom` is a scale, so that class produced no rule at all: no
error, no background, and the white title and white close icon disappeared into
the white card. It is `bg-kingdom-900` (#3d1065, the design's exact purple), and
a browser test now reads the header's computed colours and fails if any of them
matches its own background. Class names that do not exist fail silently, so only
a real browser can see this.

**FHS-640: the close button was still invisible after that.** The round back and
close buttons are white discs, and a lucide icon paints with `currentColor`, so
on the now-white-on-purple header they inherited white and disappeared into
their own disc. They carry `text-black` themselves now, so the header's ink
cannot blank them again. The FHS-639 guard had compared the button's
_background_ with the header's background, which are obviously different, so it
passed while the cross inside was white on white; it now compares each icon with
the button it actually sits on.

**FHS-641: the sheets are 672px on a computer, and all the same width.** Two
things were wrong. The design specifies `max-w-lg` (512px), which the founder
found slim against the rest of the page. More importantly, `Dialog`'s
bottom-sheet wrapper is `sm:w-auto`, so a `w-full max-w-*` child sat inside a
shrink-to-fit parent and every sheet ended up as wide as its own content:
measured, "Claim a reward" rendered at 478px and "Cash out" wider, so no two
actions matched. The sheet now takes a definite `sm:w-[42rem]`, capped to the
viewport, and a browser test pins the number. Below `sm` it is full-bleed as
before. A deliberate departure from the design's width, founder call 2026-08-10.

Deliberate deviations, founder decision (2026-08-09) to follow the design
exactly:

- **The "Admin Mode Active" banner is gone.** It unlocked nothing; the server
  is the real boundary (FHS-335).
- **The running "actions taken this session" list and the finalize summary
  screen are gone.** The design ends each action on its own "all done" screen
  instead.

That gap is closed. FHS-638 added `seedFamily({ weekEndsToday: true })`, which
anchors the live week so today is its last day whatever day that is, and the
`authedFamilyClosableWeek` fixture that uses it. `tests/e2e/features/close-week.feature`
now opens the chooser from the My World board for real and checks it at 375px
and 768px. The date rule itself is unit-tested across all seven weekdays and
over a month and a year boundary, because the browser spec can only ever run on
the day it runs.

## The all done screen never survived closing the week (FHS-642)

Closing the week worked, but the parent never saw it. A beat after the "All
done" message appeared the sheet came back on the list of choices, now reading
"0 stickers ready to spend" because it was describing the brand new week. It
looked like the dialog had reloaded and nothing had happened.

Two faults met:

| Fault                                                                                                                                                                   | What shipped                                                                                                                                                                                                                                                 |
| ----------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| The board refreshed loudly. `fetchData()` sets `loading`, and the full-page loading screen is an early return, so the whole board unmounted and took the sheet with it. | `fetchData({ silent: true })` for refreshes that follow a mutation: the figures update underneath while the screen stays put. A silent refresh that fails also keeps what is on screen.                                                                      |
| The done screen was missing half the design.                                                                                                                            | The design's "All done" heading, "Do something else" after closing the week and not only after the five actions, and "See their money". The result sits in a live region so it is announced, and takes focus so the keyboard does not fall out of the sheet. |

"See their money" goes to Kids money for that child, and is only offered to an
admin, because that is an admin screen. Kids money opens the same sheet without
it, since it is already the page underneath; there the plain "Done" keeps the
yellow so the screen still has one obvious way on.

One thing the design does not get followed on: after closing the week, "Do
something else" returns to the list of choices for the NEW week, but the button
that finishes a week is replaced with a line saying the week is closed.
Otherwise a parent could close the brand new empty week one tap after closing
the last one, and the server only refuses a week dated in the future.

The guard for the reload itself lives in `tests/unit/web/areas/my-world/MyWorldTab.test.tsx`,
not in the sheet's own tests: the sheet was never the broken part, so a test that
renders it alone passes on the broken code too. It holds the post-close refresh
open and fails if the board swaps itself for the loading screen. `close-week.feature`
covers the same journey end to end, and checks the done screen at 375px.
