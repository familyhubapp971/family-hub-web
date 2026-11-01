# 0021: Split into three repos

**Status:** accepted
**Date:** 2026-10-31 (amended 2026-10-31: rules installed by version label, not GitHub Packages)
**Jira:** [FHS-686](https://qualicion2.atlassian.net/browse/FHS-686) (children FHS-687 to FHS-690)
**Supersedes:** [0005: Monorepo structure](0005-monorepo-structure.md)

## Context

Family Hub is one repo holding the server (`apps/api`), the web site
(`apps/web`), three shared packages and all tests. The founder wants a
phone app, and wants the server, the web site and the app kept as
separate codebases in separate repos, laid out so anyone can find
things by product area. Real users are on production, so the move must
not disturb them.

## Decision

**Three GitHub repos under `familyhubapp971`, each with its own checks,
deploys and `CLAUDE.md`:**

| Repo             | Holds                                                                                                                  |
| ---------------- | ---------------------------------------------------------------------------------------------------------------------- |
| `family-hub-api` | The server, database changes, sign-in emails, endpoint docs, and the common rules package                              |
| `family-hub-web` | Today's repo (renamed from `family-hub-app` on 2026-10-31): the web site, the design system, documents and doc scripts |
| `family-hub-app` | A new Expo (React Native) phone app                                                                                    |

Inside each repo, code is grouped **by product area** (members,
calendar, meals, learn, my-world and so on) rather than by technical
type.

**Common rules** (`packages/shared`: request and response schemas,
money and week helpers) move to `family-hub-api/shared-rules/`. The web
site and the app install them straight from that repo, pinned to a
version label (a Git tag such as `shared-rules-v0.1.0`):
`github:familyhubapp971/family-hub-api#shared-rules-v0.1.0&path:shared-rules`.
The repo is public, so no key or package registry is needed.

**The look** (colours, fonts, sizes, shadows: the design system's
Tailwind preset) is published from `family-hub-web/design-system/`. The
app installs it and styles with NativeWind, so both use the same
styling words. Components are rebuilt for phones under
`family-hub-app/design-system/` with the same names and options.

**Tests** split by owner: unit, integration and speed tests go with the
server; unit and browser tests go with the web site, and its browser
tests start the server from `family-hub-api` in their checks.
`packages/test-utils` splits the same way.

**History** is kept: each new repo is cut from this one with its past
changes. This repo was renamed `family-hub-web`, which keeps every past
pull request and Jira link working. The phone app then takes the name
`family-hub-app`, which ends GitHub's redirect from the old name, so every
saved address must point at `family-hub-web` before the app repo exists.

**Order, to protect users:** build and test each repo on staging first;
production keeps building from today's repo until the new ones are
proven, then moves in one short, reversible switch with a database
backup first (FHS-690).

## Consequences

- A change to the common rules becomes a new package version, then an
  update in web and mobile. Slower than one pull request, but explicit.
- A rules change needs a new version label in `family-hub-api`, then a
  one-line update in web and mobile. Never move a label once pushed.
- Browser tests need access to a second repo in their checks.
- Each repo needs its own `CLAUDE.md`, checks and branch protection.
- Shared fixes to test helpers are made twice when both sides need them.

## Alternatives considered

- **Keep one repo with `apps/web`, `apps/api` and `apps/mobile`:**
  simplest for shared code and the common pattern at this size;
  rejected by the founder in favour of separate codebases.
- **Five repos (separate shared rules and docs repos):** rejected as
  too many to manage for a small team.
- **Wrap the web site as an app, or an installable web app:** rejected
  in favour of a real React Native app for the app stores.
- **GitHub Packages for the common rules:** dropped during the build.
  It needs a sign-in key even to install public packages, and
  `family-hub-api` became public (its checks would not start while
  private), so installing from the repo by version label is simpler.
- **Private `family-hub-api`:** its push and pull request checks never
  started on GitHub while private; made public, like `family-hub-web`.
