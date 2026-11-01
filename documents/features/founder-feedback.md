# Feature: Founder feedback page

**Jira:** [FHS-672](https://qualicion2.atlassian.net/browse/FHS-672), [FHS-674](https://qualicion2.atlassian.net/browse/FHS-674), [FHS-675](https://qualicion2.atlassian.net/browse/FHS-675), [FHS-717](https://qualicion2.atlassian.net/browse/FHS-717) (Report an issue with photos) (epic FHS-417, Beta program and feedback)
**Status:** shipped
**Related:** [Feedback on each screen](screen-feedback.md) (FHS-670, FHS-671, FHS-717)

A private page at **/admin** where the founder reads every family's feedback.
It covers the per-screen form, the in-app survey and the homepage survey. Since
FHS-717 it also lists the issues parents report, with their photos, so the
founder can work through them and mark each one fixed.

## How it works

| Part            | What it does                                                                                                                                                                         |
| --------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Passcode        | One box and an Open button, centred on the screen. The passcode is a server setting (`FOUNDER_PASSCODE`), never in the code.                                                         |
| Server secret   | `FOUNDER_TOKEN_SECRET`, a long random value, signs the 8-hour pass. Without it on a deployed server the page stays off.                                                              |
| Lockout         | Five wrong tries lock the page for 15 minutes for everyone, whatever address they come from.                                                                                         |
| Staying in      | The page keeps an 8-hour pass in this browser tab. Lock ends it.                                                                                                                     |
| Issues to fix   | At the very top. Every reported issue, newest first, with a count of the ones still to fix. See below.                                                                               |
| Filters         | Where from, family and screen. Every section below follows them.                                                                                                                     |
| At a glance     | Tiles: answers, people, families, and the average "would recommend" score out of 10.                                                                                                 |
| How it is going | Bars for solves a real problem, easy to use and will keep using it (out of 5: green 4+, yellow 3+, red below). A split bar of very, somewhat or not disappointed without Family Hub. |
| By screen       | One card per screen: answers, people, three mini bars, and the parts mentioned with counts.                                                                                          |
| In their words  | Every written answer as a quote card, sorted into Wishes, What is hard and Other comments, with who, where and when.                                                                 |
| Each person     | A folding card per person (first three open), grouped by visit, with rating dots and labelled quotes.                                                                                |
| Download        | The filtered answers as a spreadsheet. Text that looks like a formula is made safe.                                                                                                  |

## Issues to fix (FHS-717)

The first section after the passcode, above the filters and At a glance. It
loads on its own, so it still shows if the feedback list fails to load, and
the other way round. The Where from, Family and Screen filters do not apply to it.

| Part            | What it shows                                                                                                                                                                         |
| --------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Title           | "Issues to fix" and the number still New.                                                                                                                                             |
| New and Fixed   | Two choices, each with its count. New is chosen when the page opens.                                                                                                                  |
| Each card       | The screen's name (its own key if the app does not know it), family, the person's name and email, when, and what went wrong.                                                          |
| When            | "2 hours ago", with the full date and time when the pointer rests on it. Fixed cards also say when they were fixed.                                                                   |
| Photos          | Small pictures, downloaded only when the card is near the screen. Tapping one opens it large; Close or the Escape key shuts it. A photo that fails shows **Try loading photo again**. |
| One button      | **Mark fixed** on a New card, **Reopen** on a Fixed one. The card moves straight away, and the keyboard moves to the next card's button (or to New and Fixed when none is left).      |
| If saving fails | The card moves back, with "Could not mark that issue fixed. Please try again." or "Could not reopen that issue. Please try again."                                                    |
| Empty           | "No issues to fix. Nice." under New, "Nothing marked fixed yet." under Fixed.                                                                                                         |
| Loading         | Two grey cards the shape of the real ones.                                                                                                                                            |
| Cannot load     | "Could not load issues. Check your connection." with a **Try again** button.                                                                                                          |

Photos only load with the founder pass, so each one is fetched with it and
shown from a short-lived address in the browser. Each photo is fetched once,
even when switching between New and Fixed, and all are let go of when the page
closes or is locked. Long family names and emails wrap inside the card on a
phone.

If the server turns the pass down (for the list, a photo, or Mark fixed and
Reopen), the page goes back to the passcode box and says "Your admin pass ran
out. Enter the passcode again." The feedback list does the same. Tapping Lock
goes back without that message.

## Acceptance criteria

**Scenario: Founder sees the issues to fix first**

- **Given** two families reported issues and one issue is already fixed
- **When** the founder opens /admin
- **Then** "Issues to fix" sits above At a glance, with a count of 2
- **And** New is chosen, showing the two reports newest first

**Scenario: Each issue says where, who, when and what**

- **Given** Sam Smith reported "Add meal does nothing" on Weekly Meals two hours ago, with two photos
- **Then** the card shows Weekly Meals, Smith Family, "Sam Smith · sam@example.com", "2 hours ago", the words and two small pictures

**Scenario: Founder marks an issue fixed**

- **Given** an issue under New
- **When** the founder taps Mark fixed
- **Then** it moves to Fixed straight away and the counts change
- **And** if the server refuses, it moves back to New with "Could not mark that issue fixed. Please try again."

**Scenario: Founder reopens a fixed issue**

- **Given** an issue under Fixed
- **When** the founder taps Reopen
- **Then** it moves back to New
- **And** if the server refuses, it returns to Fixed with "Could not reopen that issue. Please try again."

**Scenario: Founder looks at a photo up close**

- **When** the founder taps a small picture
- **Then** it opens large in a window that Close or the Escape key shuts

**Scenario: Nothing to fix**

- **Given** every issue is fixed
- **Then** New says "No issues to fix. Nice."

**Scenario: The admin pass runs out**

- **Given** the founder's 8-hour pass has ended
- **When** the page asks the server for issues, a photo or a change
- **Then** the passcode box comes back with "Your admin pass ran out. Enter the passcode again."

**Scenario: A photo does not load**

- **Given** a photo fails to download
- **When** the founder taps "Try loading photo again"
- **Then** the photo is fetched again

**Scenario: Founder sees the headline numbers first**

- **Given** feedback from two people
- **When** the founder opens /admin
- **Then** tiles show answers, people, families and the average recommend score

**Scenario: Wishes are easy to scan**

- **Given** answers with a wished-for feature
- **Then** each wish shows as a quote card with who said it

**Scenario: Filters still apply**

- **Given** the founder filters to one source
- **Then** every tile, bar and list reflects only that source

**Scenario: Founder opens the feedback page**

- **Given** a family has given feedback on the Meals screen
- **When** I open the founder page and enter the passcode
- **Then** I see "Weekly Meals" in the summary by screen
- **And** I see that family's answer

**Scenario: Wrong passcode is refused**

- **When** I open the founder page and enter a wrong passcode
- **Then** the founder page says the passcode is wrong

**Scenario: Repeated guesses are locked out**

- **Given** five wrong passcodes in a row
- **When** anyone tries again, even with the right passcode
- **Then** they are told to wait (server answers 429)

**Scenario: A burst of parallel guesses cannot skip the lockout**

- **When** someone fires 20 wrong passcodes at once
- **Then** at most 5 of them are checked

**Scenario: The founder page works on a phone**

- **Given** a phone-sized screen
- **Then** the filters stack, the table scrolls inside its box, and the page does not scroll sideways
- **And** each issue card stacks its button under the details, and every button is at least 44px tall

## How it is tested

The founder chose unit tests for the screen and light server tests (2026-10-23).
There are no browser tests for this page, so the phone layout was checked by
screenshot, not by an automated test.

- **Unit:** the passcode form, every error message, filters, empty states, grouping, the spreadsheet and the pass.
- **Layout (FHS-717):** Issues to fix was measured in a real browser at 375, 768 and 1280px wide on 2026-11-01: no sideways scrolling, every button at least 44px tall, and the large photo inside the screen.
- **Unit (FHS-717):** Issues to fix: newest first, New and Fixed with counts, Mark fixed and Reopen with the move back on failure, photos fetched with the pass and opened large, empty, loading and error states, and the phone layout rules.
- **Server (real database):** opening the page, the lockout, a parallel burst, no pass, and that only the reader crosses families.

## Decisions

- **Reading across families.** Each family's data is locked to that family. This page reads past that lock through one read-only database reader (`app_founder_feedback`). The founder approved this on 2026-10-23.
- **One shared lockout, not per address.** Someone guessing can change their address but not the shared count. The cost: a stranger guessing can lock the founder out for 15 minutes. A redeploy resets the count.
- **Lock only clears this browser.** A copied pass keeps working until it expires (8 hours).
- **The reader is open to the app's database role.** A database-injection bug anywhere in the api could use it. This matches the existing readers; a narrower role is a possible follow-up.
- **The page sits at /admin.** The server routes are `/api/founder/*`, because `/api/admin` already serves the family settings.
- **Issues to fix comes first (FHS-717).** A broken screen is the most urgent thing on the page, so it sits above every chart.
- **Only two states, New and Fixed.** The founder asked for "a simple and clean way to gather these issues to fix". No owners, priorities or comments.
- **Cards move at once, then check.** Marking fixed feels instant; a refusal puts the card back and says so.

## Out of scope

- Separate logins per team member. Everyone shares the one passcode.
- Replying to feedback from the page.
- Replying to an issue report, or telling the parent it was fixed.
- Closing the large photo with the browser's back button. The shared pop-up window does not listen to it anywhere in the app; Close and Escape do.
- Issue reports in the spreadsheet download.
