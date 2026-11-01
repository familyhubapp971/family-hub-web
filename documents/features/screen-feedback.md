# Feature: Feedback on each screen

**Jira:** [FHS-670](https://qualicion2.atlassian.net/browse/FHS-670), [FHS-671](https://qualicion2.atlassian.net/browse/FHS-671), [FHS-678](https://qualicion2.atlassian.net/browse/FHS-678) (epic FHS-417, Beta program and feedback)
**Status:** shipped
**Related:** FHS-418 (in-app survey), FHS-429 (homepage survey), FHS-434 (floating button removed from in-app screens)

Every signed-in parent screen has a pink **Feedback** button floating in its
bottom-right corner. Each time a parent lands on a screen or switches tab, a
speech bubble pops up above it for five seconds: "You can give feedback on
Weekly Meals here." Tapping the button or the bubble opens a short form about
that screen only. The homepage survey is a separate form and did not change.

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

Every question is optional, but at least one must be answered. Tapping a
feature on its own is not an answer.

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

## Decisions

- **Floating at the bottom, with room made for it.** The founder asked for it at the bottom of the screen (FHS-671). FHS-434 once removed a floating button because it covered content, so while it shows every page gets 6rem of extra room at its end, and on Reward settings it sits above the fixed Save bar.
- **The bubble shows on every screen or tab change, not every tap.** A bubble on every tap would get in the way of using the screen. It hides after five seconds and while the form is open. Screen readers hear the same sentence, and keyboard users reach the Feedback button itself.
- **The form never grows taller than the screen (FHS-678).** On an iPhone the old form used 90% of the screen height, which counts the area behind the browser bars, so its header and close button hid under the address bar. The form now fits the visible screen, keeps its header fixed and scrolls only the questions. The homepage survey got the same layout fix; its questions and wording did not change.
- **Grown-ups only.** We do not collect children's opinions.
- **One table, not a new one.** Answers go in `beta_feedback` with three new columns. Rows from the general survey leave them empty.
- **The visit ID lives in the browser tab.** It only groups answers. It is not saved state, so keeping it on the device fits the rule that family data lives on the server.

## Out of scope

- The Me page and the onboarding wizard do not show the button.
- An admin page to read feedback. The export is the only view for now.
- Child World Meals and Calendar have no feature list yet.
