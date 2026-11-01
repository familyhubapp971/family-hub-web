# Feature: Public site header navigation

**Jira:** [FHS-572](https://qualicion2.atlassian.net/browse/FHS-572) (Magic Patterns port),
[FHS-601](https://qualicion2.atlassian.net/browse/FHS-601) (no rule above the footer),
[FHS-568](https://qualicion2.atlassian.net/browse/FHS-568) (Log in as a button),
[FHS-559](https://qualicion2.atlassian.net/browse/FHS-559) (skip link),
[FHS-555](https://qualicion2.atlassian.net/browse/FHS-555) (burger menu),
[FHS-554](https://qualicion2.atlassian.net/browse/FHS-554) (design),
[FHS-509](https://qualicion2.atlassian.net/browse/FHS-509) (shared header introduced),
[FHS-544](https://qualicion2.atlassian.net/browse/FHS-544) (homepage adopts it)
**Status:** shipped
**Owner:** product-manager

The header shared by every public page (`/`, `/about`, `/pricing`, `/legal/*`).
It carries the FamilyHub wordmark, the four section links, `Log in`, and the
yellow `Start free` call to action.

## User stories

### Story 1: Reach any public page from a phone

**As a** visitor arriving on a phone
**I want** to reach every part of the public site from the header
**so that** I can read about the product before signing up.

Family Hub's adult users are 70%+ on phones, so the phone layout is the
primary one, not a fallback.

#### Acceptance criteria

**Scenario: Every link is reachable on a phone**

- **Given** a visitor opens the public site at 375px wide
- **When** they tap the burger menu button in the header
- **Then** a panel opens listing Features, About, Pricing and Legal
- **And** it offers both Log in and Start free
- **And** tapping any of them navigates to that page

**Scenario: Nothing wraps or overflows**

- **Given** a visitor opens the public site at 375px wide
- **When** the header is rendered
- **Then** the header sits on one line with no wrapped text and no sideways scrolling
- **And** the menu button is visible

**Scenario: Desktop keeps the full row**

- **Given** a visitor opens the public site at 1024px wide
- **When** the header is rendered
- **Then** the inline links are shown and no burger button appears

### Story 2: Use the menu without a mouse

**As a** keyboard or screen-reader user
**I want** the menu to behave like a menu
**so that** I am never trapped or lost inside it.

#### Acceptance criteria

**Scenario: The menu announces its state**

- **Given** the menu is closed
- **When** a screen reader reads the burger button
- **Then** it is named "Open menu" and reports `aria-expanded=false`
- **And** once opened it is named "Close menu" and reports `aria-expanded=true`

**Scenario: Escape closes the menu and restores focus**

- **Given** the menu is open
- **When** the visitor presses Escape
- **Then** the menu closes
- **And** focus returns to the burger button

**Scenario: Focus stays inside the open menu**

- **Given** the menu is open
- **When** the visitor tabs past the last row
- **Then** focus wraps to the first row rather than leaving the panel

## Behaviour as shipped

- The switch happens at `lg` (1024px). Below it the bar carries the wordmark
  and the menu button only. At `lg` and up: the inline row, unchanged.
- Both `Log in` and `Start free` live inside the menu on phones (FHS-572,
  matching the Magic Patterns design). The homepage carries its own call to
  action, so the bar does not need a second one.
- The panel is a full-width sheet over the header (`kingdom-bg`) with a
  black bottom border, a brand row with a close button, links separated by
  hairlines at 52px, and the two actions side by side at 48px.
- A scrim covers the page behind the panel. Tapping it closes the menu.
- Page scroll is locked while the menu is open (`useBodyScrollLock`).
- Navigating closes the menu, so it never survives into the next page.
- The drop-in animation is gated behind `motion-safe:`, so reduced-motion
  visitors get the panel with no movement.

### Footer on phones (FHS-567, FHS-571, FHS-572)

- Legal links sit on one dot-separated row, matching the Magic Patterns
  design. Tablet and desktop keep the plain inline row.
- Each link still stands 44px tall: MP's own `py-1` is about half this
  repo's tap floor, so the height is ours and the look is MP's.
- The small print keeps clearance beneath it so the floating feedback
  button cannot cover it.
- **No rule above the footer** (FHS-601). The page and the footer share one
  purple, so a top border drew a seam across the page. Space separates the
  footer now, not a line.

## Out of scope

- The signed-in app navigation (`TopNav` in `design-system`), which uses a
  scrolling tab strip rather than a burger.
- The footer, which already stacks on phones.

## Success metrics

- No horizontal scroll on any public page at 375px.
- Every header control at or above the 44px tap-target floor.
