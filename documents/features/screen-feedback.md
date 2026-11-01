# Feature: Feedback on each screen

**Jira:** [FHS-670](https://qualicion2.atlassian.net/browse/FHS-670), [FHS-671](https://qualicion2.atlassian.net/browse/FHS-671), [FHS-678](https://qualicion2.atlassian.net/browse/FHS-678), [FHS-717](https://qualicion2.atlassian.net/browse/FHS-717) (Report an issue with photos) (epic FHS-417, Beta program and feedback)
**Status:** shipped
**Related:** FHS-418 (in-app survey), FHS-429 (homepage survey), FHS-434 (floating button removed from in-app screens), [Founder feedback page](founder-feedback.md) (where answers and issue reports are read)

Every signed-in parent screen has a pink **Feedback** button floating in its
bottom-right corner. Each time a parent lands on a screen or switches tab, a
speech bubble pops up above it for five seconds: "You can give feedback on
Weekly Meals here." Tapping the button or the bubble opens a short form about
that screen only. The homepage survey is a separate form and did not change.

## Report an issue (FHS-717)

The top of the form is a yellow box headed **"Found an issue on this screen?
Report it."** It is for something broken, not an opinion.

| Part             | What it does                                                                                                     |
| ---------------- | ---------------------------------------------------------------------------------------------------------------- |
| What went wrong? | A text box, up to 2,000 characters, with the hint "What you tapped, and what happened".                          |
| Add photos       | Opens the phone's photo picker. Up to 3 photos. Each shows as a small picture with a **Remove** button under it. |
| Up to 3 photos   | Always shown next to the button. At 3 photos the button greys out.                                               |
| Too many chosen  | Only the first ones that fit are added, with "Up to 3 photos, so we added the first 2." (or 1, or 3).            |
| Not a photo      | A file the browser cannot open as a picture is skipped, with "That file isn't a photo we can use."               |
| Getting ready    | Each photo is shrunk on the device first. While that happens a spinner shows and Send waits.                     |

A report counts when it has words **or** at least one photo. It can be sent
on its own, without answering any question.

## What the form asks

The homepage questions, reworded for the screen (shown here for Weekly Meals):

| Question                                                         | Answer                                |
| ---------------------------------------------------------------- | ------------------------------------- |
| Which part are you thinking of?                                  | Tap any of the screen's features      |
| How well does Weekly Meals solve a real problem for your family? | 1 to 5                                |
| How easy is Weekly Meals to use?                                 | 1 to 5                                |
| After the beta, how likely are you to keep using Weekly Meals?   | 1 to 5                                |
| What's one thing you wish Weekly Meals had?                      | Text, with an example for that screen |
| Anything else about Weekly Meals?                                | Text                                  |

Every question is optional. To send, the parent reports an issue or answers
at least one question; the line above Send says "Report an issue or answer at
least one question to submit." Tapping a feature on its own is not an answer.

## Screens covered

The screen names, features and examples live in
`src/app/lib/screen-feedback.ts`. The covered screens are:

- **Dashboard tabs:** Family Dashboard, Calendar, Weekly Meals, Assignments, Noticeboard, My Tasks.
- **Account pages:** Manage family, Kids money, Family settings, Reward settings.
- **Child World tabs:** World, Meals, Calendar, Journal, Learning Insights.

A page not on the list asks about "this screen" with no feature list.

## What is saved

Each answer is saved with the person, the family and the screen. It also keeps
the features tapped and a visit ID. The visit ID stays the same until the
browser tab closes, so one person's answers from one visit group together.

`pnpm feedback:export out.csv` writes two files:

- `out.csv`: every answer, sorted by family, then person, then visit, then time.
- `out-by-screen.csv`: one line per screen, with the number of answers and people, the average of each rating, and the features mentioned most.

An issue report is saved on its own, with the person, the family, the screen,
the visit ID, the words and its photos. Photos are kept in our own database,
not a separate file store. The founder reads reports in **Issues to fix** at
the top of [/admin](founder-feedback.md). The Download spreadsheet button
on /admin does not include them.

### Sending

- Tapping **Send feedback** sends the report and the answers at the same time, as two requests.
- **Thank you!** shows only when every part that needed sending worked.
- If a part fails, everything typed and chosen stays, with a plain message, and Send can be tapped again.
- Trying again sends only the part that failed, so nothing arrives twice.
- Send greys out while sending, so a double tap sends once.

## User stories

### Story 1: Feedback about the screen I am on

**As a** parent trying Family Hub
**I want** to give feedback about the screen I am on
**so that** the team knows exactly which part my comment is about.

#### Acceptance criteria

**Scenario: Parent gives feedback on the Meals screen**

- **Given** I am signed in as the admin of a family
- **When** I open the Meals screen and open Feedback on this screen
- **Then** the form asks "How easy is Weekly Meals to use?"
- **When** I tap "Add meal", rate ease of use 4 and send it
- **Then** I see the thank-you message
- **And** the answer is saved with screen `meals`, the feature and a visit ID

**Scenario: Answers from one visit share a visit ID**

- **Given** a parent sends feedback on two screens in one visit
- **When** the founder exports feedback
- **Then** both rows carry the same visit ID and sort together

**Scenario: Screen details alone are not an answer**

- **Given** a parent has only tapped a feature
- **Then** the Send button stays disabled, and the server refuses the request

**Scenario: The feedback button works on a phone**

- **Given** a 375px wide screen
- **Then** the button is at least 44px square, the page does not scroll sideways, the button does not cover the end of the page, and the form fits the screen
- **And** the issue report is at the top of the form, and Add photos is at least 44px square

**Scenario: The feedback button works on a tablet**

- **Given** a 768px wide screen
- **Then** the button is at least 44px square, the page does not scroll sideways, and the form fits the screen

**Scenario: The feedback form fits every screen size**

- **Given** a screen of 320x568, 375x667, 390x844, 430x932, 667x375, 768x1024, 1024x768 or 1440x900
- **When** the parent opens the feedback form
- **Then** the whole form, its pink header and its 44px close button sit inside the screen, with no sideways scrolling
- **And** after scrolling down to Send, the header and close button are still on screen

**Scenario: A bubble reminds parents they can give feedback on each screen**

- **Given** I am signed in as the admin of a family
- **When** I open the Meals screen
- **Then** a bubble says I can give feedback on "Weekly Meals"
- **When** I switch to the Calendar tab
- **Then** a bubble says I can give feedback on "the Calendar"

**Scenario: Children never see the button**

- **Given** a child is signed in, or a grown-up's role is still loading
- **Then** no feedback button is shown

**Scenario: Homepage form is unchanged**

- **Given** a visitor on the homepage
- **When** they open Give feedback
- **Then** they see the same questions as before

### Story 2: Report something broken, with photos (FHS-717)

**As a** parent who hit a problem on a screen
**I want** to say what went wrong and add a photo of it
**so that** the team can see the problem and fix it, without me answering a survey.

#### Acceptance criteria

**Scenario: Parent reports an issue with a photo**

- **Given** I am signed in as the admin of a family, on a phone-sized screen
- **When** I open the Meals screen and open Feedback on this screen
- **And** I write "The Add meal button does nothing" under What went wrong
- **And** I add a photo of the problem
- **Then** I see the photo ready to send, and the page does not scroll sideways
- **When** I send the feedback
- **Then** I see the thank-you message
- **And** the report is saved with screen `meals`, the words, the photo and a visit ID

**Scenario: A report on its own can be sent**

- **Given** I have written what went wrong, or added a photo, and answered nothing else
- **Then** Send feedback is ready to tap
- **And** only the report is sent

**Scenario: A report and answers are sent together**

- **Given** I have written what went wrong and rated how easy the screen is
- **When** I tap Send feedback
- **Then** both the report and the answers are sent, and Thank you! shows once both arrive

**Scenario: Up to 3 photos**

- **Given** I choose 4 photos at once
- **Then** the first 3 are added, the form says "Up to 3 photos, so we added the first 3."
- **And** Add photos greys out until I remove one

**Scenario: Removing a photo**

- **Given** I have added two photos
- **When** I tap Remove under the first
- **Then** only the second is left, now called photo 1

**Scenario: A file that is not a photo**

- **Given** I choose a PDF
- **Then** it is skipped, and the form says "That file isn't a photo we can use."

**Scenario: Photos are shrunk before sending**

- **Given** I add a 4000 by 3000 photo from my phone
- **Then** it is sent as a JPEG no longer than 1600px on its longest side and under 1,000,000 bytes

**Scenario: A failed send keeps everything**

- **Given** the server cannot take my report
- **When** I tap Send feedback
- **Then** my words and photos stay, with "We could not send your report. Your words and photos are still here, so tap Send feedback to try again."
- **And** tapping Send feedback again sends it, and only the part that failed is sent again

## Decisions

- **Floating at the bottom, with room made for it.** The founder asked for it at the bottom of the screen (FHS-671). FHS-434 once removed a floating button because it covered content, so while it shows every page gets 6rem of extra room at its end, and on Reward settings it sits above the fixed Save bar.
- **The bubble shows on every screen or tab change, not every tap.** A bubble on every tap would get in the way of using the screen. It hides after five seconds and while the form is open. Screen readers hear the same sentence, and keyboard users reach the Feedback button itself.
- **The form never grows taller than the screen (FHS-678).** On an iPhone the old form used 90% of the screen height, which counts the area behind the browser bars, so its header and close button hid under the address bar. The form now fits the visible screen, keeps its header fixed and scrolls only the questions. The homepage survey got the same layout fix; its questions and wording did not change.
- **Grown-ups only.** We do not collect children's opinions.
- **One table, not a new one.** Answers go in `beta_feedback` with three new columns. Rows from the general survey leave them empty.
- **The visit ID lives in the browser tab.** It only groups answers. It is not saved state, so keeping it on the device fits the rule that family data lives on the server.
- **Report first, survey second (FHS-717).** The founder asked for "found an issue on this screen, report it" in each screen's form. It sits at the top so a parent with a problem does not scroll past six questions to say so.
- **Photos live in our own database, shrunk on the phone first (founder choice, FHS-717).** Each photo is redrawn as a JPEG of at most 1600px and under 1,000,000 bytes, stepping the quality down from 0.8, then the size, until it fits. The server takes at most 1,048,576 bytes a photo, so there is room to spare.
- **Every photo is redrawn, even a small one.** Redrawing also drops the hidden details a phone stores in a photo, including where it was taken.
- **Photos are shrunk one at a time.** A full-size phone photo takes a lot of memory while it is resized; doing three at once could crash a small phone's browser.
- **A report has no feature chips.** The chips belong to the questions; the report's words say which part is broken.

## Out of scope

- The Me page and the onboarding wizard do not show the button.
- Video or screen recordings with a report. Photos only.
- An email or alert to the founder when a report arrives. Reports wait in Issues to fix on /admin.
- Parents seeing what happened to their report. Only the founder sees New and Fixed.
- Child World Meals and Calendar have no feature list yet.
