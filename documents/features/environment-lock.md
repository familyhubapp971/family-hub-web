# Feature: Environment lock

**Jira:** [FHS-644](https://qualicion2.atlassian.net/browse/FHS-644)
**Status:** shipped
**Owner:** product-manager

One passcode screen in front of the whole deployed site. Nothing renders, and
no request is sent, until the passcode is right.

## What this is not

**It is a curtain, not a lock.** The passcode ships inside the browser bundle,
so anyone who opens developer tools can read it and walk past the screen. It
exists to stop a link shared with a tester being browsed by whoever the link
gets forwarded to, and to blank a laptop left open on the product.

Nothing that matters may ever be defended by it. The api authenticates every
request on its own and must keep doing so. If we later need a gate that really
holds, it has to live on the server, not in the browser.

## User stories

### Story 1: Share the site without the link spreading

**As a** founder handing the staging link to a tester or an investor
**I want** the site to ask for a passcode I share separately
**so that** the link on its own does not let a stranger walk through the product.

#### Acceptance criteria

**Scenario: A visitor without the passcode sees nothing**

- **Given** the site is deployed
- **When** someone opens any address on it
- **Then** they see only the lock screen
- **And** no page of the product is shown behind it

**Scenario: The right passcode opens the site**

- **Given** a visitor is on the lock screen
- **When** they type `2FH3`
- **Then** the site opens on the page they asked for
- **And** refreshing the page does not ask again

**Scenario: A wrong passcode is refused**

- **Given** a visitor is on the lock screen
- **When** they type any other four characters
- **Then** they are told the code is wrong and the boxes clear
- **And** the site stays hidden

### Story 2: A laptop left open does not stay open

**As a** founder who demos on a laptop in public
**I want** the site to shut itself after half an hour of nothing
**so that** an unattended screen is not sitting on the product.

#### Acceptance criteria

**Scenario: Half an hour of nothing locks it again**

- **Given** a visitor unlocked the site
- **When** 30 minutes pass with no clicking, typing or scrolling
- **Then** the lock screen comes back
- **And** the passcode is needed again

**Scenario: A machine that was asleep is locked on return**

- **Given** a visitor unlocked the site and shut the laptop
- **When** they open it again more than 30 minutes later
- **Then** the lock screen is showing before they can use the page

## What shipped

| Thing          | Behaviour                                                                                                          |
| -------------- | ------------------------------------------------------------------------------------------------------------------ |
| The passcode   | `2FH3`. Case is folded, so `2fh3` works. Surrounding spaces from a paste are ignored                               |
| The screen     | Kingdom purple starfield, a padlock disc, the wordmark, one line of copy, four cells, one error line. Nothing else |
| Where it sits  | Above the router in `src/app/main.tsx`, so there is one entry point rather than one per route                      |
| What it hides  | Everything, including the marketing pages. While locked, no route resolves and no lazy chunk is downloaded         |
| Staying in     | A timestamp in `localStorage`, so a refresh or a second tab does not ask again                                     |
| Timing out     | 30 minutes without a click, keypress, wheel, touch or scroll. The stamp is deleted when it locks                   |
| Where it runs  | Deployed builds only. `pnpm dev` and the test suites run unbuilt, so development and CI are never gated            |
| Taking it down | `VITE_ENV_LOCK=off` on Railway. Any other value, including `OFF`, leaves it up                                     |

### Decisions worth knowing

- **The idle check compares clock times, it does not count down.** A background
  tab has its timers throttled and a sleeping laptop runs none at all, so a
  timer alone would let a machine that was shut for two hours come back
  unlocked. Elapsed time is also compared the moment the tab becomes visible.
- **A stamp dated in the future grants one window, not forever.** Clocks move,
  and reading that as an endless pass would be worse than reading it as now.
- **Storage that throws reads as locked.** Safari private mode and a browser set
  to block site data both throw rather than return empty.
- **The error line is yellow.** Red on this purple is unreadable.
- **The shake on a wrong code is behind `motion-safe:`.**

### Deviations

None. There was no Magic Patterns design for this screen: it is assembled from
tokens and components the design system already had (`space-bg`, the kingdom
palette, the neo-brutalist disc, `PinInput`).

## Design system change

`PinInput` gained a `mode` prop. It was digits-only, which a passcode with
letters in it cannot use. `mode="alphanumeric"` also takes letters, folds them
to upper case, says "character" rather than "digit" in its per-cell label, and
turns off the autocorrect and autocapitalise a phone keyboard would otherwise
apply. The default is unchanged, so kid login (FHS-238) still refuses letters.

The same change moved `onChange` and `onComplete` out of the `setValues`
updater. They ran during render, so any caller that changed its own state in
response was updating a component mid-render and React warned about it. Kid
login had the same warning; it is gone from both.

## Out of scope

- A real server-side gate. See "What this is not".
- Per-person passcodes, or any record of who came in.
- Rotating the passcode without a code change.
- Locking one tab when another tab locks.

## Success metrics

- The staging link can be shared without the product being open to anyone who
  receives a forward of it.
- No developer or CI run is ever asked for a passcode.
