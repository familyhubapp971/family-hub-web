# Feature: Legal pages

**Jira:** [FHS-509](https://qualicion2.atlassian.net/browse/FHS-509), [FHS-541](https://qualicion2.atlassian.net/browse/FHS-541) (homepage entry points)
**Status:** shipped
**Owner:** product-manager

One-line: a proper Legal section (Privacy, Children & Parents, Terms, Cookies) with
its own index page, replacing the old single draft `/privacy` page.

The old `/privacy` route (FHS-435) was a single hand-transcribed draft policy. This
ticket replaces it with a four-page Legal section, Privacy Policy, Children &
Parents, Terms of Service, and Cookies & Storage, each sharing a common layout
(a pill nav between the four pages, a sticky "On this page" table of contents, and
a highlighted plain-English summary above the legal detail of every section), plus
an index page at `/legal` linking to all four.

**The copy is placeholder text pending legal review**, ported verbatim from the
Magic Patterns design (artifact `7f19f840-c796-4eaa-90fc-934fb4ef587d`). Every
`[Legal entity name]`, `[Contact email]`, `[Privacy contact]`, `[Effective date]`,
`[Governing law / country]` and `[Liability cap]` marker is a deliberate
placeholder, not a mistake, it must stay visible until the founder and a
solicitor fill it in.

## User stories

### Story 1: A visitor reads any of the four legal documents

**As a** visitor or parent
**I want** clear, plain-English legal pages I can navigate between
**so that** I can understand what Family Hub does with my family's data and the
rules of using the service.

#### Acceptance criteria

**Scenario: Visiting the Legal index**

- **Given** I go to `/legal`
- **Then** I see four cards: Privacy Policy, Children & Parents, Terms of Service,
  and Cookies & Storage
- **And** each card links to its own page

**Scenario: Reading a legal page**

- **Given** I open `/legal/privacy` (or any of the other three)
- **Then** I see a pill nav to switch between the four legal pages
- **And** an "On this page" table of contents that jumps to each section
- **And** a highlighted plain-English summary above the legal detail of every
  numbered section

**Scenario: The old /privacy link still works**

- **Given** I follow a link that still points at `/privacy` (e.g. the signup
  consent link, or a bookmark from before this ticket)
- **When** the page loads
- **Then** I land on `/legal/privacy` showing the same Privacy Policy content

### Story 2: The founder can spot every placeholder that still needs filling in

**As a** the founder
**I want** every legal-entity/contact/date placeholder to stay visibly marked
**so that** nothing gets missed before a solicitor reviews the copy and it goes
live.

#### Acceptance criteria

**Scenario: Placeholders stay visible**

- **Given** any of the four legal pages
- **Then** every `[Legal entity name]`, `[Contact email]`, `[Privacy contact]`,
  `[Effective date]`, `[Governing law / country]` and `[Liability cap]` marker
  renders as highlighted placeholder text, not real values

## Pages shipped

| Route             | Page                        | Component                                        |
| ----------------- | --------------------------- | ------------------------------------------------ |
| `/legal`          | Index: 4 cards              | `src/public-pages/legal/LegalIndexPage.tsx`      |
| `/legal/privacy`  | Privacy Policy              | `src/public-pages/legal/PrivacyPolicyPage.tsx`   |
| `/legal/children` | Children & Parents          | `src/public-pages/legal/ChildrenPrivacyPage.tsx` |
| `/legal/terms`    | Terms of Service            | `src/public-pages/legal/TermsOfServicePage.tsx`  |
| `/legal/cookies`  | Cookies & Storage           | `src/public-pages/legal/CookiesPage.tsx`         |
| `/privacy`        | Redirect → `/legal/privacy` | inline `<Navigate>` in `src/app/App.tsx`         |

Shared shell: `src/public-pages/legal/LegalLayout.tsx` (title card, pill nav,
table of contents, numbered sections) plus `src/public-pages/SiteChrome.tsx`
(`SiteHeader`/`SiteFooter`, reused by the marketing header/footer look already on
`WelcomePage`/`PricingPage`/`AboutPage`).

## Entry points (FHS-541)

- The homepage (`WelcomePage`) header nav has a **Legal** link → `/legal`; the
  footer links **Legal** (`/legal`) + **Privacy Policy** (`/legal/privacy`).
  **About** stays in the header (not the footer). The old "What is Family Hub?"
  value-prop card was removed, that content lives on the About page.
- `AboutPage`, `PricingPage`, `SignupPage`, and the Admin Panel link to
  `/privacy`, which redirects to `/legal/privacy`.

## Out of scope

- **Real legal copy.** The wording is a placeholder draft pending a solicitor's
  review, filling in `[Legal entity name]` etc. and legal sign-off is separate,
  future work.
- **Cookie consent banner.** The Cookies page states Family Hub only uses
  strictly-necessary storage, so no consent banner is needed (matches the old
  `/privacy` page's stance), revisit if analytics/marketing cookies are ever
  added.
- **Retrofitting the remaining marketing pages to `SiteChrome`.** FHS-544 moved
  the homepage (`WelcomePage`, logged-out) onto the shared `SiteHeader` +
  `SiteFooter`; `PricingPage`/`AboutPage` still keep their own inline
  header/footer for now, a follow-up if full-site consistency is wanted.

## Open questions

- Who signs off the final legal wording, and by when, before or after public
  launch?
- Should the `/privacy` redirect be removed once every inbound link is updated
  to `/legal/privacy` directly, or kept indefinitely for old bookmarks/emails?

## Success metrics

- Zero broken links from the 5 existing `/privacy` references
  (`AdminPanelPage`, `SignupPage`, `AboutPage` x2, `PricingPage`, `WelcomePage`)
  after the redirect ships.
- No support questions about "where's the terms/cookies policy" once the Legal
  index is discoverable from the site footer.

## Implementation notes

- Content is a forensic, character-for-character port of the Magic Patterns
  design (artifact `7f19f840-c796-4eaa-90fc-934fb4ef587d`,
  `pages/legal/{LegalIndex,Privacy,ChildrenPrivacy,Terms,Cookies}.tsx` +
  `components/{LegalLayout,SiteChrome}.tsx`), headings, "In short" summaries,
  bullet lists and placeholders are unedited.
- Design tokens: `bg-[#3d1065]` → `bg-kingdom-bg` (existing preset token, same
  colour); `font-heading`/`shadow-neo-*` used as-is since the preset already
  defines them.
- `SiteChrome.tsx` drops the Magic Patterns mock's
  `localStorage.getItem('fh_loggedIn')` logged-in check (that key is never set
  anywhere in this codebase) and uses the repo's own `Button` from
  `@familyhub/ui` instead of a local mock.
- Tests: `tests/unit/web/public-pages/legal/{LegalIndexPage,PrivacyPolicyPage,PrivacyRedirect}.test.tsx`.
