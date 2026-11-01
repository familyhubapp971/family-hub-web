# Feature: Reward economy (sticker rate, habit boosts, skip penalty)

**Jira:** [FHS-512](https://qualicion2.atlassian.net/browse/FHS-512) (build), [FHS-488](https://qualicion2.atlassian.net/browse/FHS-488) (rate placement), [FHS-489](https://qualicion2.atlassian.net/browse/FHS-489) (boosts + skip penalty), [FHS-534](https://qualicion2.atlassian.net/browse/FHS-534) (investment coefficient → pay + growth), [FHS-606](https://qualicion2.atlassian.net/browse/FHS-606) (the money row), [FHS-607](https://qualicion2.atlassian.net/browse/FHS-607) (investment tags + the Active Investments rows), [FHS-613](https://qualicion2.atlassian.net/browse/FHS-613) (value over time + localised money)
**Status:** shipped
**Owner:** product-manager
**ADR:** [0020: configurable reward economy (rate, boost, skip penalty)](../decisions/0020-configurable-reward-economy.md)

One-line: families set their own "1 sticker = how much money" rate (family-wide,
or a different rate per child), and can make specific habits pay more or dock
savings when skipped, replacing the old hardcoded 1 sticker = half a dirham
rule.

All of this lives on a single admin-only **"Reward settings"** screen
(`/t/:slug/reward-settings`, reachable from the profile menu). Every amount is
stored as a whole number of the family's onboarding currency's smallest unit
(e.g. `50` = `0.50`), never a decimal, so money math never drifts from a
rounding error (see ADR 0020).

## User stories

### Story 1: Set how much a sticker is worth

**As an** admin
**I want** to set my family's default sticker rate, and optionally give one
child a different rate
**so that** each child's board pays out at the amount I choose for them.

#### Acceptance criteria

**Scenario: Admin sets the family's default rate**

- **Given** I am an admin on the "Reward settings" screen
- **When** I set "How much is one sticker worth?" to a new amount
- **Then** every child who doesn't have their own override earns at that rate
- **And** the amount is saved as a whole number of minor currency units (e.g.
  `75` for `0.75`), never a fraction

**Scenario: Admin gives one child a different rate**

- **Given** my family's default rate is `0.50`
- **When** I turn on "Different amount for {child}" and set it to `1.00`
- **Then** that child's board earns at `1.00` per sticker
- **And** every other child keeps earning at the family default of `0.50`

**Scenario: Turning an override off falls back to the family default**

- **Given** a child has a per-child rate override set
- **When** I turn that child's "Different amount" toggle off
- **Then** the override is cleared
- **And** the child's board goes back to earning at the family default

**Scenario: A non-admin can see but not change the rates**

- **Given** I am a signed-in family member who is not an admin
- **When** I open "Reward settings"
- **Then** I see the current family rate and each child's rate
- **And** every control is disabled, with a note that only an admin can change it
- **And** a save attempt is rejected by the server even if the UI were bypassed

### Story 2: Make a habit pay more

**As an** admin
**I want** to boost a specific habit's payout (2x, 3x, or 5x)
**so that** a bigger or harder habit is worth more than a routine one.

#### Acceptance criteria

**Scenario: Admin boosts a habit**

- **Given** I am an admin editing one of a child's habits
- **When** I choose a `2x`, `3x`, or `5x` boost
- **Then** that habit pays boost × the child's effective rate every time it's completed
- **And** the settings screen shows the resulting amount before I save (e.g.
  "This habit pays $1.50 each time")

**Scenario: A habit with no boost chosen pays the plain rate**

- **Given** a habit has never had a boost set
- **When** it is completed
- **Then** it pays exactly the child's effective rate (boost = 1×)

### Story 3: Dock money for a skipped habit

**As an** admin
**I want** to optionally deduct money when my child skips a habit
**so that** habits I've flagged as important carry real weight.

#### Acceptance criteria

**Scenario: Admin turns on a skip penalty**

- **Given** I am an admin editing a habit
- **When** I choose "They lose some money" and set an amount
- **Then** missing that habit on a day deducts the amount from the child's
  savings once the week closes
- **And** the deduction is written to an audit trail as well as taken
  immediately off the visible balance

**Scenario: No penalty is the default**

- **Given** a habit has never had a skip penalty configured
- **When** a day for that habit is missed
- **Then** nothing is deducted, the child simply earns no sticker that day

**Scenario: A penalty never pushes a balance negative**

- **Given** a child's savings balance is smaller than a habit's skip penalty
- **When** the week closes and the penalty is applied
- **Then** their balance is floored at zero, never negative
- **And** closing then reopening that week restores exactly what was deducted
  (no money is created, see ADR 0020's floor-compensation rule)

### Story 4: Invest in a habit to boost its pay and grow faster (FHS-534)

**As an** admin
**I want** to pick a coefficient (1x/2x/3x/5x) when I invest my child's stickers in a habit
**so that** one choice makes the habit both pay more per day and grow the investment faster.

Background: a My World "investment" is the child putting earned stickers into a
habit; the invested value grew by a fixed +5 per completed day. FHS-534 makes
that daily growth a **parent-chosen coefficient** that _also_ sets the habit's
pay boost, unifying the two "multiplier" numbers that previously looked alike
but were unrelated.

#### Acceptance criteria

**Scenario: Parent picks a coefficient when investing**

- **Given** I open the invest flow for a habit
- **When** I choose a `5x` coefficient and invest
- **Then** the investment is created with coefficient 5x
- **And** the habit's pay boost is set to 5x (so completing it pays 5× the rate)
- **And** Reward Settings shows 5x for that habit

**Scenario: Only the presets are offered**

- **When** picking a coefficient
- **Then** only 1x, 2x, 3x and 5x are selectable

**Scenario: The investment grows at the chosen coefficient**

- **Given** an investment created with coefficient 3x
- **When** the child completes 4 days that week
- **Then** the invested value grows by 3 per completed day (not the old fixed 5)

**Scenario: Existing investments are unchanged**

- **Given** an investment created before this change
- **Then** it keeps a coefficient of 5x (backfilled) and its growth is identical to before

**Scenario: Editing the habit's pay later does not disturb an active investment**

- **Given** a habit at 5x with an active investment
- **When** the parent changes the habit to 2x in Reward Settings
- **Then** future completions pay 2x
- **And** the active investment keeps growing at its own snapshotted 5x

## The money row (FHS-606)

The parent My World board shows three money cards on one full-width row with
matched heights: Your Savings, Active Investments, and This Week. Ported from
the Magic Patterns board rework (FHS-540). Current week only, parents only:
the kid view keeps its simpler savings pair and never sees bankable figures
(FHS-376).

- **Your Savings** shows the sticker total split into "Earned last week" and
  "Rest of the total". The split is server-derived
  (`GET /api/mw/financial/savings`, fields `earnedLastWeekStickers` and
  `keptFromEarlierStickers`): sticker-type savings ledger entries recorded
  since a day before the current week began count as earned last week, capped
  at the balance so the two lines always sum to the total. Total Value is
  stickers at the child's rate plus any saved cash, and a "Saved as cash"
  line appears only when cash exists.
- **Active Investments** keeps its rows and gains a footer: "Worth this week"
  (the sum of each investment's current value) and "N of M could lose value"
  (the deductible count). Both computed on the client from the existing
  investments payload; no API change.
- **This Week** replaces the sidebar's Bankable card: stickers to bank, habit
  days done with a progress bar, the child's sticker rate, and the week's
  worth. Same underlying numbers as before, new home.
- **Reward Requests** keeps its title and pending count only. It carried the
  week label for one release; the board already names the week at the top, so
  the label just crowded the heading and came back off in
  [FHS-612](https://qualicion2.atlassian.net/browse/FHS-612).

All the small labels on these cards are neutral light greys, not tinted
purples. The tinted ones read as washed out against the purple panels, and the
ones inside the investment rows measured 3.3:1, below the 4.5:1 accessibility
floor ([FHS-611](https://qualicion2.atlassian.net/browse/FHS-611)). The
contrast maths is locked by a test, so a faint colour cannot come back. The
values beside those labels carried no colour at all for one release, so they
inherited the page's near-black body text onto a dark panel
([FHS-615](https://qualicion2.atlassian.net/browse/FHS-615)); a second test now
fails if any text inside these cards takes its colour from outside the card.

Deliberate deviations from the mock: the mock's sample data had no cash
savings, so the cash line and its inclusion in Total Value are ours; and the
investment card's row redesign (tags, flip buttons) shipped separately under
FHS-607, described next.

## Investment tags and the Active Investments rows (FHS-607)

Every invested habit says so on its row, and the Active Investments card reads
as a list rather than a stack of cards. Ported from the Magic Patterns design
(FHS-583).

- **The tag** is a shared design-system component (`design-system/InvestmentTag`):
  two pills, the kind (red warning + "Deductible", or green shield + "No
  penalty") then a yellow chart + "Invested · Nx", where N is the investment's
  own coefficient (FHS-534). Colour is never the only signal: each pill carries
  an icon and a word, and the pair has one plain-words spoken label ("Invested
  at 3 times. Deductible, so a missed day takes value away.").
- **On a habit row** the tag sits under the habit's name on phone and tablet,
  where it cannot push the day circles, and moves to the card's right column
  from desktop. Exactly one of the two renders at any width. An uninvested
  habit gets no tag and no gap.
- **The card header** carries a yellow "N habits" count badge.
- **Each investment is one line**: a coloured dot with the kind's icon (and the
  kind's word for screen readers), the habit's name, its worth, and a chevron.
  At-risk rows sort first. Opening a row closes any other, so the card keeps a
  steady height instead of scrolling inside itself.
- **The open row** shows the tag, then the investment's value as three points
  in time, then days done with its bar, then "Pays X each day it is done." (the
  coefficient at the child's sticker rate).
- **Parents get a full-width "Switch to no penalty" / "Switch to deductible"
  button**, which saves through the existing investment settings endpoint. Kids
  see the same rows and tags but get a plain sentence explaining the kind
  instead of the control (FHS-376/378 gates).
- **Empty state** reads "Habits invested 0" with "Nothing growing yet. Mark a
  habit as invested to pay a multiple."

## An investment's value over time (FHS-613)

The open row used to list Originally / Invested / Now. "Invested" described the
same money as the rows around it, so the three lines did not read as three
different things. They are now three points in time, each a sticker count with
its money value beside it:

- **Put in at the start**: `originalInvestedStickers`, the stickers first placed
  into this investment.
- **After last week's roll over**: `investedStickers`, the principal the server
  carried forward when the previous week closed.
- **Today**: `currentValueStickers` with the server's own cash figure. Emphasised,
  because it is the figure that matters.

The Today row carries a change tag measured **against last week's total**, not
against the original: green "+N", red "−N", grey "0". The sign always renders, so
the direction survives greyscale, and a sentence under the rows restates it
("Up 2 stickers since last week" / "Down 3 stickers since last week" / "No change
since last week"). The tag itself is `aria-hidden`, so a screen reader hears the
sentence once rather than the figure twice.

The change is exactly this week's growth less anything a deductible habit clawed
back for days missed, which is why a no-penalty investment can only stay flat or
rise while a deductible one can show a real loss. That contrast is the point of
having two kinds.

### Money is formatted, never concatenated

Every money figure on the board goes through `formatMoney` in
`family-hub-api/shared-rules/src/money.ts`, which wraps `Intl.NumberFormat` with the family's
currency (`tenants.currency`, chosen at onboarding) and the viewer's own locale.
Hand-built strings like `` `${currency} ${x.toFixed(2)}` `` only ever looked right
for codes that sit in front with a space: they render "USD 7.50" instead of
"$7.50" and "EUR 7.50" instead of "7,50 €", and they ignore decimal separators and
digit grouping. There is no locale column (the family picks a currency, not a
language), so the conventions come from the device, the same source the currency
picker already uses to guess a currency. The duplicated `formatMinor` in the api
and on the reward settings page now both delegate to this one helper.

**FHS-614 finished the job across the product.** FHS-613 converted the My World
board; the Close Week dialog, the Admin Panel, the kid panels and Reward Settings
followed, so no screen glues a currency onto a number any more. Three things came
out of that sweep:

| Thing               | What changed                                                                                                                                                                                                                                                                                                               |
| ------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| The fallback        | The Admin Panel fell back to AED when the API sent no currency, while the database and every other screen fall back to USD. It now uses the shared `FALLBACK_CURRENCY`.                                                                                                                                                    |
| One source per page | The Admin Panel reads the currency once at page level and passes it to every tab, and Settings pushes a change back up. The Savings tab used to resolve its own from a different endpoint, so two tabs could show different currencies at once and a currency changed in Settings never reached the others until a reload. |
| Hardcoded labels    | Five Admin Panel labels had "AED" written into the text ("Amount (AED)", "Carried Cash (AED)"). They show the family's own currency symbol.                                                                                                                                                                                |
| The one exception   | The ± amount stepper (`AmountPicker`) keeps its number in an editable input, so it cannot render one formatted string. It shows the symbol beside the input via `currencySymbol()`, and is the single allowlisted file in the guard below.                                                                                 |

A guard test (`tests/unit/web/money-formatting-guard.test.ts`) walks the web and
design-system source and fails the build if a hand-built money string reappears.
It is narrow on purpose: it looks for a currency token sat directly beside an
amount, not for the words "currency" or "toFixed" on their own. Its own patterns
are pinned by a test, so a regex that quietly stops matching cannot quietly stop
guarding. Known blind spots, accepted for now: a hand-built string split across
more than two lines, and `+` concatenation rather than a template literal.

**Not fixed here:** the ± amount control assumes every currency has two decimal
places, so a zero-decimal currency (JPY, KRW, both offered by the picker) reads
100 times too small. That predates this ticket and is tracked as
[FHS-636](https://qualicion2.atlassian.net/browse/FHS-636).

Deviations from the mock: its figures are invented (a 6% and a 4% growth
constant), so all three come from the live payload instead; and the change
sentence pluralises, so one sticker reads "Up 1 sticker since last week".

One API change, additive: `GET /api/kid/financial/investments` now returns
`coefficient`. Its response schema was silently stripping the field, so every
kid's tag read 5x whatever the parent had chosen. The parent endpoint already
carried it.

Deliberate deviations from the mock: the mock's figures are invented
(`base × multiplier × days`, and a 10% growth constant), so every number here
comes from the live payload instead: worth is the investment's real current
value, and Originally / Invested / Now are the real sticker figures with the
existing delta chip. The mock flipped the kind in local state only; the app
saves it. The mock's tag took an unused `base` prop, dropped here.

## The finished-week recap (FHS-608)

When a parent walks back to a closed week, the board reads as a record rather
than a live screen. Ported from the Magic Patterns design.

- **The banner** says "This week is finished" with the line "A record of what
  happened. Nothing here can be changed." It used to carry the kid's
  celebratory copy, which was the wrong voice for this viewer.
- **"Habits that week"** heads the cards, which stay read-only. Each still
  shows its own progress out of its own target.
- **The Final summary** sits in the sidebar, so the habit cards keep exactly
  the width they have on the live week. It shows the stickers earned with
  their money value, where those stickers went, and how much of the week was
  done.
- **Where they went** is a single bar plus a legend: Saved, Invested, Spent on
  rewards, and Cashed out. Each line pairs its sticker count with its money
  value at the family's rate, including the zero lines, so no number on this
  card stands on its own. Every figure is read from the week's recorded
  actions (`GET /api/mw/weeks/:id/actions`), never inferred by subtraction.
  A withdrawal nets off what was invested, clamped at zero.
- **Invested counts only stickers newly committed that week.** Closing a week
  writes a roll-forward record for any investment that keeps running, carrying
  its _entire current value_. Counting that reported the same investment again
  every week it rolled on: a week that earned 21 stickers claimed 101 invested
  ([FHS-617](https://qualicion2.atlassian.net/browse/FHS-617)). Roll-forwards
  are excluded on both the parent and the child side.
- **How much was done** reads "{done} of {possible}" with a bar and the line
  "{percent}% of the week's habits were done."

The action split is one shared function, `summariseWeekActions` in
`family-hub-api/shared-rules/src/week-actions.ts`. The parent board and the kid recap each
kept their own copy of the same filters, and they had already drifted: the kid's
copy never netted withdrawals, so a week that invested 10 and pulled 4 back
showed the child "Planted 10" while the parent's card said 6. Both now read the
same function.

Neither view falls back to the week's carried-in balance any more. That figure
is what arrived from the previous week's close, not what the week itself saved,
so showing it here put the same stickers in two weeks and contradicted
"Stickers earned: 0" in the same card. A week with nothing recorded now shows no
split at all, and a week whose activity could not be loaded says so instead of
drawing one.

Deviations from the mock: the mock has three buckets and works the third out by
subtracting the other two from the total. The app has a fourth real outcome its
sample data never had, **cashed out**, where stickers become money; folding that
into "spent on rewards" would misreport it, so it gets its own line, shown only
when it happened.

**Tidied alongside:** four separate places each computed the week's "possible
days" as seven per habit, while the per-habit pill already read the habit's own
target. They now all call one helper that adds up the targets. Nothing moves on
screen today, because the api does not surface a habit target yet and every
habit is therefore seven; the point is that the week total and the pill can no
longer drift apart once one arrives.

**Fixed in [FHS-616](https://qualicion2.atlassian.net/browse/FHS-616):** a
closed week's habit list is now scoped to that week, not to whichever habits
the child has today. `loadHabitsForWeek` (`family-hub-api/src/areas/my-world/myworld.ts`)
branches on `week.isFinalized`: a finalized week returns only habits created
before the week actually closed (read from `closureSnapshot.capturedAt`,
since a week can close early, mid-week, not just at the calendar boundary)
and not archived before the week started; the still-open (live) week keeps
the old "not archived right now" rule unchanged, so adding or archiving a
habit shows up on it immediately. This closes the two bugs the banner ("This
week is finished... nothing here can be changed") was contradicting: a habit
added today no longer grows a phantom 0-day card on every past week, and a
habit archived today no longer vanishes from weeks it actually belonged to.
Shared by the parent board, the kid recap, and any other reader of the same
helper. Covered by
`tests/integration/features/mw-week-scoped-habits.feature`.

## Out of scope

- **Cadence-aware "due days."** Every day currently counts as due for the
  skip penalty (a weekdays-only habit still accrues a penalty on the
  weekend), a deliberate simplification per ADR 0020, since habit cadence
  has never been enforced anywhere in the economy. Follow-up if wanted.
- **Migrating legacy decimal money columns** (`saved_cash`,
  `invested_amount`, etc.) to the new integer-minor-unit representation,
  ADR 0020 keeps the two representations side by side for now.
- **Zero/3-decimal currencies** (JPY, KWD), the money math still assumes
  2 decimals everywhere. [FHS-515](https://qualicion2.atlassian.net/browse/FHS-515)
  handled this by **constraining the onboarding currency picker to 2-decimal
  currencies** (via `currencyDecimals()`), so no family can land on a currency
  the sticker economy would render wrong.
  [FHS-636](https://qualicion2.atlassian.net/browse/FHS-636) closed the other
  half: the picker refused these, but the API's own validation was only
  `/^[A-Z]{3}$/`, so `POST /api/onboarding/complete` and
  `PUT /api/admin/settings/currency` would both have stored JPY happily, and
  every screen would then have read a hundred times too small. Both now share
  the picker's rule via `isSupportedCurrency()` in `family-hub-api/shared-rules/src/money.ts`,
  which is the single copy of it. Full multi-decimal support (native minor units and
  currency-aware display everywhere) is still the follow-up if a 0/3-decimal
  market is needed; remove the fence then, not before.
- **The rewards shop / redemption flow itself**: a separate feature; this
  doc only covers what a sticker is _worth_, not spending it.

## Open questions

- Should changing a child's rate or a habit's boost notify the child, or is
  silent-until-they-look the right default?
- Do we want cadence-aware due days for the skip penalty (ADR 0020's noted
  follow-up), or is "every day counts" fine long-term?

## Success metrics

- Share of admin families who ever customise a rate, boost, or skip penalty
  (adoption of the Reward settings screen beyond the defaults).
- Zero "wrong amount paid out" support reports after rollout.
- Zero savings balances observed negative in production (validates the
  floor-at-zero rule holds under real skip-penalty load).

## Implementation notes

- **Money resolver:** `effectiveRateMinor(child, family)` in
  `family-hub-api/src/areas/my-world/reward-config.ts` picks the child's own
  `stickerRateMinor` if set, else the family default, every money read
  site in the API goes through this resolver instead of a hardcoded constant.
- **Per-child data flow:** each kid's board reads _their own_ effective rate
  (via `/api/kid/financial/savings` → `stickerRateMinor`) and each habit's
  boost (via `/api/kid/habits`); the parent's view of a child uses the same
  resolver, so both sides always agree.
- **Endpoints:** `GET /api/reward-config` (any member, read-only) and
  `PUT /api/reward-config` (admin-only) manage the family + per-child rates;
  `PUT /api/habits/:id` carries `boost` and `skipPenaltyMinor` for a single habit.
- **Currency:** rates are in the family's onboarding currency
  (`tenants.currency`); the UI formats minor units back to a decimal display
  string via `Intl.NumberFormat`, but never stores or transmits a float.
- **Atomic rate on redemption (FHS-517):** `redeemReward` and
  `approveRedemptionRequest` resolve the effective rate _inside_ the locked
  transaction (via `tx`), so an admin editing the rate mid-request can't split
  one redemption across two rates. A placed day-sticker stores
  `stickerValue = the habit's boost at that moment`; re-tapping the same day
  after the boost changed re-prices it to the new boost (upsert in
  `POST /api/habits/:id/stickers`).
