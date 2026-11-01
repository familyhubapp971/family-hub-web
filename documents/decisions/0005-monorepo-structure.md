# 0005: Monorepo structure

**Status:** superseded by 0021
**Date:** 2026-04-24
**Jira:** [FHS-174](https://qualicion2.atlassian.net/browse/FHS-174)

## Context

The SaaS spans an API (Hono) and a web app (React + Vite), with shared
Zod schemas, TypeScript types, a future design system, and shared test
utilities. We need a code layout that:

- lets `apps/web` and `apps/api` share types end-to-end without
  publishing internal packages;
- keeps reusable libraries from accidentally depending on app-specific
  code;
- supports a future `apps/mobile` consuming the same shared packages;
- gives one `pnpm install` for the whole repo and one CI matrix.

## Decision

**Single repo, pnpm workspaces, two top-level workspace types:
`apps/*` and `packages/*`. Plus `tests/` and `documents/` as
non-workspace folders.**

Layout:

```text
apps/
  api/         # Hono API server
  web/         # React + Vite frontend
  (mobile/)    # future
packages/
  shared/      # Zod schemas + TS types used by api + web
  ui/          # design system (FHS-199)
  test-utils/  # shared factories, fixtures, withTenant() helper (FHS-184)
tests/
  e2e/         # Playwright (cross-app, mirrors Gherkin per CLAUDE.md)
  perf/        # k6 scripts
documents/          # see documents/README.md
.github/       # workflows + PR template
```

### Import rules

| From         | May import                                  | Must not import             |
| ------------ | ------------------------------------------- | --------------------------- |
| `apps/*`     | other `packages/*`, third-party             | another `apps/*`, `tests/*` |
| `packages/*` | other `packages/*` (no cycles), third-party | any `apps/*`, `tests/*`     |
| `tests/*`    | `apps/*`, `packages/*`, third-party         | nothing forbidden           |

The cardinal rule: **direction of dependency is `apps → packages`,
never the reverse.** A `packages/*` library that needs to know about
an app is a smell, extract the abstraction into the package, or move
the code out of the package.

Enforced by:

- `pnpm-workspace.yaml` declaring only `apps/*` and `packages/*` as
  workspaces (so `tests/` doesn't accumulate package boundaries by
  accident).
- A lint rule (`eslint-plugin-import` `no-restricted-paths`) that
  fails the build if a `packages/*` file imports from `apps/*`.
- `tsconfig.base.json` path aliases that resolve `@familyhub/<pkg>`
  to `packages/<pkg>/src`: apps reference packages by the alias,
  never via relative `../../`.

## Consequences

**Easier:** end-to-end type safety (changes to a Zod schema in
`packages/shared` break the build of every consumer at compile time);
single dependency graph and one `pnpm install`; one CI workflow
matrix; reusable libraries are first-class, not afterthoughts.

**Harder:** package boundaries must be respected (the lint rule
matters); a poorly-scoped `packages/shared` becomes a junk drawer,
review additions before merging; pnpm workspace edge cases (peer
deps, hoisting) need occasional troubleshooting.

## Alternatives considered

- **Polyrepo (api / web / shared as separate GitHub repos)**, rejected:
  cross-repo type sharing requires publishing, versioning, and
  coordinating PRs across repos. For a small team, the overhead is
  large with no offsetting benefit.
- **Single `src/` with no workspace boundaries**, rejected: nothing
  prevents `web/` from importing `api/`'s server code, which leaks
  server secrets / dependencies into the client bundle.
- **Nx / Turbo on top of pnpm**: deferred. Plain pnpm workspaces are
  enough for our scale; revisit if build-graph caching becomes a
  bottleneck.

## References

- [ADR 0006: Branching strategy](0006-branching-strategy.md)
- [`/CLAUDE.md` Project context layout](../../CLAUDE.md#project-context)

## Update, 2026-08-06

`deploy/` was removed. It never held anything but a README describing a
layout that was never built: Railway keeps its own service configuration,
the test database runs from `docker-compose.test.yml` at the root, and the
Supabase settings live in Supabase. An empty folder promising structure is
worse than no folder, because it implies a home for config that is
actually elsewhere.

`bugs/` went at the same time. Every bug goes straight to Jira (see the
"every reported bug gets logged" rule in CLAUDE.md), so the local backlog
had nothing left in it.
