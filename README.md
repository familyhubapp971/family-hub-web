# Family Hub

A multi-tenant SaaS platform for families to coordinate schedules, tasks, and shared life.

## Stack

- **API:** [Hono](https://hono.dev/) + [Drizzle ORM](https://orm.drizzle.team/) + [Zod](https://zod.dev/) + [pino](https://getpino.io/)
- **Frontend:** [React 18](https://react.dev/) + [Vite](https://vitejs.dev/) + [Tailwind CSS 3](https://tailwindcss.com/)
- **Database:** Postgres (with Row-Level Security for tenant isolation, [ADR 0001](documents/decisions/0001-multi-tenancy.md))
- **Hosting:** Railway (staging + production)
- **Auth:** our own GoTrue server on Railway, reached through the api ([ADR 0022](documents/decisions/0022-own-sign-in-server.md)). Production stays on Supabase Auth until FHS-701
- **Billing:** Stripe ([ADR 0004](documents/decisions/0004-stripe-billing.md))
- **Testing:** Vitest (unit + integration), Playwright + playwright-bdd (E2E), k6 (perf)
- **Package manager:** pnpm 10 workspaces

### Stack Reuse Rationale

This stack is **deliberately reused verbatim** from the legacy
`family-hub` codebase rather than re-evaluated greenfield. The
trade-offs and the criteria for revisiting any single library are
captured in [ADR 0007: Reuse the family-hub stack](documents/decisions/0007-stack-reuse.md).

In short: Sprint 0's job is to ship a tenant vertical slice, not to
bikeshed library choices. The two surfaces that **do** diverge from
family-hub get their own ADRs ([0001](documents/decisions/0001-multi-tenancy.md)
multi-tenancy, [0002](documents/decisions/0002-subdomain-tenant-routing.md)
subdomain routing). Swap a single library when a specific metric
forces it; don't re-litigate the whole stack at once.

## Quick Start

Requires Node 20+ and pnpm 10+. The server and its database live in
[`family-hub-api`](https://github.com/familyhubapp971/family-hub-api); clone
it next to this repo (`../family-hub-api`) and start it there first.

```bash
# Install
pnpm install

# Web site on :5273 (creates .env.local from .env.example if missing)
./scripts/dev

# Tests
pnpm test                          # unit tests (web site and design system)
pnpm -F @familyhub/e2e test:e2e    # browser tests (see "Browser tests on a new machine" below)
```

The browser tests start the server from `../family-hub-api` (or the folder
in `FH_API_DIR`) and need its database running: `pnpm dev:up` in that repo.

## Browser tests on a new machine

The signed-in Playwright specs drive the real web app, which builds its
Supabase client from `VITE_` variables. Vite only reads names that start with
`VITE_`, so on a machine whose root `.env.local` has only the plain names
every authed spec fails at once with no obvious reason: the app cannot restore
the injected session, so no `/t/:slug` page ever renders.

One file fixes it (gitignored, values copied from your root `.env.local`):

```bash
cat > .env.development.local <<'ENV'
VITE_API_URL=http://localhost:3001
VITE_SUPABASE_URL=<same as SUPABASE_URL in .env.local>
VITE_SUPABASE_ANON_KEY=<same as SUPABASE_ANON_KEY in .env.local>
ENV
```

FHS-635 also turned the api's per-IP rate limit off for e2e runs
(`RATE_LIMIT_PER_MINUTE=0`, set in the Playwright configs). Every worker drives
the browser from the same machine, so they share one bucket of 100 requests a
minute; several specs at once used to sail past it and the api answered 429,
which the app shows as "Couldn't load your dashboard (server 429)". That is
what made a handful of specs fail at random, and fail every time on a developer
machine, which runs more workers than CI.

## Environment

[`.env.example`](.env.example) is the canonical list of every variable
the api, web, and tooling read. Copy it to `.env.local` (gitignored)
and fill in the values you need.

Minimum vars needed to boot api + web locally: `DATABASE_URL` (and that
alone: everything else is optional until the dependent feature is wired).

Source of truth for real values:

| Group                                                                    | Where the value comes from                                                                                          |
| ------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------- |
| Postgres                                                                 | Local: `pnpm dev:up` in family-hub-api, or your own Postgres. Hosted: Railway injects `DATABASE_URL` automatically. |
| Runtime (`NODE_ENV`, `PORT`, `LOG_LEVEL`, `BASE_DOMAIN`, `VITE_API_URL`) | No external source: set per environment. Defaults in `.env.example` are dev-safe.                                   |
| Supabase auth                                                            | Supabase dashboard → Project Settings → API                                                                         |
| Stripe billing                                                           | Stripe dashboard → Developers → API keys (test mode for dev)                                                        |
| Sentry                                                                   | Sentry dashboard → Project Settings → Client Keys (DSN), separate projects for api + web                            |
| Jira tooling                                                             | [id.atlassian.com: API tokens](https://id.atlassian.com/manage-profile/security/api-tokens)                         |
| Railway MCP                                                              | [railway.com/account/tokens](https://railway.com/account/tokens) (Account Tokens, not Project)                      |

`.env.example` itself **never** holds real secrets. Production /
staging values live in the Railway dashboard; local dev values live
only in your `.env.local`. When the team grows past one person we'll
move to a shared vault, tracked as a follow-up.

## Tooling

[`scripts/jira/refresh-confluence-epics-page.py`](scripts/jira/refresh-confluence-epics-page.py)
refreshes the Confluence "FHS: Epics & Tickets" page from live Jira.
Runs after every ticket close per the CLAUDE.md post-merge rule:

```bash
set -a; source .env.local; set +a
python3 scripts/jira/refresh-confluence-epics-page.py --reason "FHS-XXX close"
```

## Working with coding agents

[`AGENTS.md`](AGENTS.md) holds the project rules for every coding agent
(Claude Code, Codex and others). [`CLAUDE.md`](CLAUDE.md) imports it and
adds only Claude Code setup.

This repo ships [`.claude/`](.claude/README.md) with a curated set of
specialist subagents and skills, plus a conservative permission
allowlist. After cloning, Claude Code picks them up automatically.

Useful slash commands (via `~/.claude/skills/commands/`):

- `/plan` · `/write-plan` · `/execute-plan`: planning lifecycle
- `/brainstorm`: feature exploration before code
- `/start`: surface relevant skills at session start
- `/status`: check progress on the current effort

See [`.claude/README.md`](.claude/README.md) for the full list of
shipped agents and skills, and [`CLAUDE.md`](CLAUDE.md) for the
skill-routing map.

## Repository Layout

```text
src/            # React + Vite web site
  areas/        # signed-in screens grouped by product area (today, calendar, money...)
  public-pages/ # home page, legal pages, sign-in and sign-up
  app/          # routing, shared layout and menus, app-wide helpers
public/         # static files served as-is (fonts)
index.html      # web entry page
design-system/  # shared components, Storybook, Tailwind preset (@familyhub/ui)
documents/
  features/
  technical/
  decisions/  # ADRs
  strategy/
```

## Branches

- `main`: production
- `staging`: pre-production / QA
- feature branches → PR into `staging` → promoted to `main`

Both `main` and `staging` require PR reviews and passing CI.

## Documentation

- [Documentation index](documents/README.md)
- [Architecture Decision Records](documents/decisions/): durable choices
  - [ADR 0001: Multi-tenancy strategy](documents/decisions/0001-multi-tenancy.md)
  - [ADR 0002: Subdomain tenant routing](documents/decisions/0002-subdomain-tenant-routing.md)
  - [ADR 0003: Auth library: Supabase Auth](documents/decisions/0003-auth-library.md) (superseded by 0022)
  - [ADR 0004: Billing provider: Stripe](documents/decisions/0004-stripe-billing.md)
  - [ADR 0005: Monorepo structure](documents/decisions/0005-monorepo-structure.md) (superseded by 0021)
  - [ADR 0006: Branching strategy](documents/decisions/0006-branching-strategy.md)
  - [ADR 0007: Reuse the family-hub stack](documents/decisions/0007-stack-reuse.md)
  - [ADR 0021: Split into three repos](documents/decisions/0021-three-repo-split.md)
  - [ADR 0022: Sign-in runs on our own GoTrue server](documents/decisions/0022-own-sign-in-server.md)
- [Technical docs](documents/technical/)
- [Feature specs](documents/features/)
- [Strategy docs](documents/strategy/): incl. [SaaS Transformation Strategy](documents/strategy/saas-transformation.md)

## License

See [LICENSE](LICENSE).
