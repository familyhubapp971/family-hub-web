# Deployment topology: Railway

Authoritative reference for the `family-hub-saas` Railway project. Captures
the running infrastructure, env-var matrix, deploy flow, and known
constraints. Update whenever topology changes (add a service, rotate a
secret format, change a branch tracking rule, upgrade plan).

> **Status as of 2026-10-31:** the live setup is now **production**
> and builds from `main`. Real users are on it. A new **staging** setup
> builds from the `staging` branch. The code is split across two repos:
> the server in `family-hub-api`, the web site in `family-hub-web`
> (this repo, renamed from `family-hub-app`). See
> [Production switch](#production-switch-2026-10-31). Sections below this
> point describe the earlier staging setup and are partly out of date.

## Project

| Field     | Value                                                                     |
| --------- | ------------------------------------------------------------------------- |
| Name      | `family-hub-saas`                                                         |
| ID        | `bc7e539b-fc8b-4f56-99e2-daffee70138f`                                    |
| Workspace | Trial workspace (1 contributor)                                           |
| Plan      | Trial ($5 cap)                                                            |
| Region    | us-east4 (forced on trial: see [Region constraints](#region-constraints)) |

Created via the Railway MCP server (`@jasontanswe/railway-mcp`)
configured in `.mcp.json` (gitignored, see [`.env.example`](../../.env.example)
for variable names).

## Environments

| Name         | ID                                     | Purpose                                                   | Branch    |
| ------------ | -------------------------------------- | --------------------------------------------------------- | --------- |
| `production` | `3fb76a04-e926-4bdf-ae03-659966366dfb` | Live site with real users                                 | `main`    |
| `staging`    | `8b1d3dab-dc01-49ea-906e-726c8a12f4f2` | Pre-release checks, own sign-in (GoTrue) since 2026-10-31 | `staging` |

The branching strategy is documented in
[ADR 0006](../decisions/0006-branching-strategy.md): merges land on
`staging` only during bootstrap, then promote to `main` as a single
batch when the W1 vertical slice ships ([FHS-198](https://qualicion2.atlassian.net/browse/FHS-198)).

## Services

Three project-level services, each with one instance per environment.
Railway's model: services are project-scoped; per-environment runtime
config (region, build/start commands, vars, source) lives on the
service instance.

```mermaid
flowchart TB
  subgraph staging["staging environment (branch: staging)"]
    direction LR
    fe_s["frontend<br/>vite preview<br/>:8080"]
    api_s["api<br/>Hono / Node 20<br/>:PORT"]
    pg_s["postgres<br/>postgres:16-alpine<br/>+ volume"]
    fe_s -- "fetch /api/*" --> api_s
    api_s -- "DATABASE_URL<br/>(internal :5432)" --> pg_s
  end
  subgraph production["production environment (branch: main, blocked on FHS-202)"]
    direction LR
    fe_p["frontend<br/>(unconfigured)"]
    api_p["api<br/>(unconfigured)"]
    pg_p["postgres<br/>(CRASHED + sleep)"]
    fe_p -.-> api_p
    api_p -.-> pg_p
  end
  user["UAE visitor"] -- "TLS @ Singapore edge" --> fe_s
  staging:::live
  production:::dormant
  classDef live fill:#dcfce7,stroke:#16a34a,color:#14532d
  classDef dormant fill:#f3f4f6,stroke:#9ca3af,color:#6b7280,stroke-dasharray: 5 5
```

| Service    | ID                                     | Source                           | Image                |
| ---------- | -------------------------------------- | -------------------------------- | -------------------- |
| `postgres` | `e2a7c43f-46db-44e8-bc06-a934fe290699` | n/a                              | `postgres:16-alpine` |
| `api`      | `7a93c040-1220-4afb-a564-f4cf98901948` | `familyhubapp971/family-hub-api` | n/a                  |
| `frontend` | `f3048c9c-195b-4141-8cca-daf0f213d6a9` | `familyhubapp971/family-hub-web` | n/a                  |

### Postgres

Persistent volume `postgres-volume-lbGE`
(ID `0531fd3b-5390-4c40-9a59-36988741cc42`) mounted at
`/var/lib/postgresql/data` in the staging instance. Production instance
has no volume and is set to `sleepApplication: true` (deploys CRASHED on
boot due to missing `POSTGRES_PASSWORD`: intentional, prevents trial
credit drain until [FHS-202](https://qualicion2.atlassian.net/browse/FHS-202)).

> **2026-04-30 password recovery.** Original volume
> `5d88b9b5-28e6-4db5-b252-0836214162cf` was wiped + recreated as
> `0531fd3b-...` after `/api/me` returned 500s tracing back to a
> `SASL: client password must be a string` error: the api's
> `DATABASE_URL` had been stored as a literal with an empty password
> (the cross-service `${{postgres.POSTGRES_PASSWORD}}` reference never
> actually resolved). The fix: set a fresh `POSTGRES_PASSWORD` on the
> postgres service, recreate the volume so the postgres image
> re-initialises with that password, and set `DATABASE_URL` on the api
> as a literal string (not a cross-service reference) including the new
> password. The recipe for any future password rotation is the same,
> see "Rotating postgres credentials" below.

### api

Hono server (Node 20+, ESM). pnpm workspace, depends on
`@familyhub/shared` via `workspace:*`. Build/start config lives at the
service-instance level so per-env overrides are possible later.

The build step bundles via [`family-hub-api/build.mjs`](https://github.com/familyhubapp971/family-hub-api/blob/staging/build.mjs)
(esbuild) into a single `family-hub-api/dist/index.js` so workspace cross-
imports resolve at runtime without exporting unnecessary `dist/` from
`shared-rules` (family-hub-api). See [FHS-201](https://qualicion2.atlassian.net/browse/FHS-201).

### frontend

Vite SPA. Built into `dist/` and served via `vite preview`
bound to `$PORT`. Public domain
**[`frontend-staging-409d.up.railway.app`](https://frontend-staging-409d.up.railway.app)**
(domain ID `098cbd7e-9a09-40d2-9004-c37bf6a62518`, target port `8080`).

`vite preview` is acceptable for staging but not ideal long-term, it
runs a full Node process to serve static files. Post-upgrade we can
switch to a static-file server (Caddy/nginx) or Railway Edge.

## Build & start commands (staging)

| Service    | Build                                                                               | Start                                                                        |
| ---------- | ----------------------------------------------------------------------------------- | ---------------------------------------------------------------------------- |
| `api`      | `corepack enable && pnpm install --frozen-lockfile && pnpm -F @familyhub/api build` | `pnpm -F @familyhub/api start`                                               |
| `frontend` | `corepack enable && pnpm install --frozen-lockfile && pnpm -F @familyhub/web build` | `pnpm --filter @familyhub/web exec vite preview --host 0.0.0.0 --port $PORT` |
| `postgres` | n/a (image)                                                                         | n/a (image entrypoint)                                                       |

`rootDirectory` is left at the default (`/`: repo root) on every
instance because a sub-folder rootDirectory would break
pnpm workspace resolution (Railway can't see the workspace packages).

Healthcheck: api uses `/health`
([`family-hub-api/src/areas/health/health.ts`](https://github.com/familyhubapp971/family-hub-api/blob/staging/src/areas/health/health.ts)).
Frontend has no healthcheck, Railway falls back to TCP-level checks.

### Schema migration on api start

The api `start` script runs `drizzle-kit push --force` _before_
booting the server. Every deploy reconciles the live Postgres schema
against `family-hub-api/src/database/schema.ts` automatically, no separate
"apply migrations" step, no opportunity for code-vs-database drift to
ship.

This matters because Railway-managed Postgres has no externally
reachable DBA path: the master password is hidden from the dashboard
and there's no proxy enabled by default, so manual `psql` operations
require setting up a TCP proxy + ALTER USER round-trip every time.
Auto-migrate on start avoids the operational tax.

Trade-offs we accepted:

- **`--force` skips destructive-change confirmation prompts.** With
  Sprint 0 schema (one `users` table, no production data), this is
  safe. Pre-launch we move to `drizzle-kit migrate` with explicit
  migration files generated at PR time and applied at deploy time,
  proper change review, no surprises. Tracked as a follow-up.
- **drizzle-kit must remain installed in the runtime image.** Today
  Railway's build runs `pnpm install --frozen-lockfile` (no `--prod`),
  so devDependencies including `drizzle-kit` ship to the container. If
  we ever switch to a prod-only install, drizzle-kit promotes to a
  runtime dependency.
- **First-startup latency adds ~1 s** for the schema reconciliation
  call. Cold starts already take 5–10 s on Railway; the marginal cost
  is invisible.

## Environment variable matrix (staging)

### postgres vars

| Variable            | Source                  | Value                                                                 |
| ------------------- | ----------------------- | --------------------------------------------------------------------- |
| `POSTGRES_USER`     | MCP `variable_bulk_set` | `familyhub`                                                           |
| `POSTGRES_DB`       | MCP `variable_bulk_set` | `familyhub_staging`                                                   |
| `PGDATA`            | MCP `variable_bulk_set` | `/var/lib/postgresql/data/pgdata`                                     |
| `POSTGRES_PASSWORD` | MCP `variable_set`      | (32-char URL-safe random; rotate via dashboard if exposure suspected) |

### api vars

| Variable                    | Source                           | Value                                                                                                                                                                                                      |
| --------------------------- | -------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `NODE_ENV`                  | MCP                              | `production` (the api config schema only accepts `development`/`test`/`production`; staging is treated as production-like for strictness)                                                                  |
| `LOG_LEVEL`                 | MCP                              | `info`                                                                                                                                                                                                     |
| `DATABASE_URL`              | MCP (Railway-resolved at deploy) | `postgresql://${{postgres.POSTGRES_USER}}:${{postgres.POSTGRES_PASSWORD}}@${{postgres.RAILWAY_PRIVATE_DOMAIN}}:5432/${{postgres.POSTGRES_DB}}` (see [cross-service references](#cross-service-references)) |
| `PORT`                      | Railway-injected                 | (assigned by Railway, read by [`family-hub-api/src/config.ts`](https://github.com/familyhubapp971/family-hub-api/blob/staging/src/config.ts))                                                              |
| `SUPABASE_URL`              | MCP (FHS-189)                    | `https://maolytpqazmykjzdybtj.supabase.co` (staging Supabase project per [ADR 0008](../decisions/0008-supabase-environments.md))                                                                           |
| `SUPABASE_ANON_KEY`         | MCP (FHS-189)                    | legacy HS256 anon JWT: client-safe role, used for the public-API client                                                                                                                                    |
| `SUPABASE_SERVICE_ROLE_KEY` | MCP (FHS-189)                    | legacy HS256 admin JWT: server-side only, bypasses RLS; **never** mirror onto the frontend service                                                                                                         |
| `SUPABASE_PUBLISHABLE_KEY`  | MCP (FHS-189)                    | modern asymmetric `sb_publishable_…`: client-safe, complement to anon key                                                                                                                                  |
| `SUPABASE_SECRET_KEY`       | MCP (FHS-189)                    | modern asymmetric `sb_secret_…`: server-side only                                                                                                                                                          |
| `FOUNDER_PASSCODE`          | Railway API (FHS-672)            | 6 to 12 digits for the founder's `/admin` feedback page; unset switches the page off. Never in the repo.                                                                                                   |
| `FOUNDER_TOKEN_SECRET`      | Railway dashboard (FHS-672)      | 48+ random characters (`openssl rand -base64 48`) that sign the `/admin` pass. Without it the page stays off on deployed servers.                                                                          |

Sign-in passes are checked against public keys (ES256), never a shared
secret. Where the keys come from: `AUTH_JWKS_URL` and `AUTH_ISSUER` when set
(our own GoTrue, see [Sign-in service](#sign-in-service-gotrue)), otherwise
`$SUPABASE_URL/auth/v1/.well-known/jwks.json`. Staging sets the pair;
production uses the Supabase fallback until FHS-701.

### frontend vars

| Variable                        | Source        | Value                                                                                         |
| ------------------------------- | ------------- | --------------------------------------------------------------------------------------------- |
| `VITE_SUPABASE_URL`             | MCP (FHS-189) | `https://maolytpqazmykjzdybtj.supabase.co` (staging Supabase project)                         |
| `VITE_AUTH_URL`                 | FHS-696       | Unset (sign-in via Supabase). Set to the API address to sign in through our own GoTrue server |
| `VITE_SUPABASE_ANON_KEY`        | MCP (FHS-189) | legacy HS256 anon JWT: baked into the browser bundle, safe by design                          |
| `VITE_SUPABASE_PUBLISHABLE_KEY` | MCP (FHS-189) | modern asymmetric `sb_publishable_…`: baked into the browser bundle                           |

The frontend service deliberately gets **only** publishable / anon
client-safe variants. `SUPABASE_SERVICE_ROLE_KEY` and `SUPABASE_SECRET_KEY`
must never be set behind a `VITE_` prefix, Vite inlines `VITE_*` into the
client bundle at build time and exposes them to every browser.

### Production env

Mirrors the staging layout above with the production Supabase project ref
(`bqghmbkoxjompuxixexn`) substituted in for `SUPABASE_URL` /
`VITE_SUPABASE_URL` and the matching `_PRODUCTION` keys for everything
else. Variables are pre-set on the paused production services so the env
is ready when [FHS-202](https://qualicion2.atlassian.net/browse/FHS-202)
unblocks the Hobby-plan upgrade, no separate provisioning step at
unblock time.

### Cross-service references

Railway's `${{serviceName.VAR}}` interpolation lets one service read
another's variables at deploy time. **The service name is lowercase**
and matches what was passed as `name` on `service_create_*`. Empirically
verified at the api service in staging via `list_service_variables`,
where the resolved `DATABASE_URL` showed:

| Token                                  | Resolves to                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| -------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `${{postgres.POSTGRES_USER}}`          | `familyhub` ✓                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            |
| `${{postgres.POSTGRES_DB}}`            | `familyhub_staging` ✓                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    |
| `${{postgres.RAILWAY_PRIVATE_DOMAIN}}` | `postgres.railway.internal` ✓                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            |
| `${{postgres.POSTGRES_PASSWORD}}`      | **Empirically did NOT resolve**: `DATABASE_URL` was stored as a literal with an empty password slot, and end-to-end auth requests returned 500 with `SASL: client password must be a string`. The fix (2026-04-30) is to store `DATABASE_URL` on the api as a complete literal string with the password embedded directly, NOT as a cross-service reference. Whether this is a Railway display artefact or a real resolution failure isn't worth chasing further; the literal-string approach works and rotates cleanly. |

### Rotating postgres credentials

When the staging Postgres password needs to change (suspected
exposure, contributor rotation, or after a recovery like the one
that landed alongside FHS-197):

1. Pick a new password (`python3 -c "import secrets; print(secrets.token_urlsafe(32))"`).
2. `mcp__railway__variable_set` `POSTGRES_PASSWORD` on the postgres service to the new value.
3. `mcp__railway__volume_delete` the postgres volume, wipes the on-disk
   user/role with the old password. Acceptable only when staging has
   no irreplaceable data; capture a `pg_dump` first if not.
4. `mcp__railway__volume_create` a fresh volume mounted at `/var/lib/postgresql/data`.
5. `mcp__railway__service_restart` the postgres service, image init
   uses the new `POSTGRES_PASSWORD`.
6. `mcp__railway__variable_set` `DATABASE_URL` on the api service to a
   literal `postgresql://familyhub:<new-password>@postgres.railway.internal:5432/familyhub_staging`.
7. `mcp__railway__service_restart` the api so its connection pool picks
   up the new URL. The auto-migrate-on-start (FHS-197) creates the
   schema on first connect.
8. Verify: `curl https://api-fhapp.up.railway.app/health` returns 200,
   then a JWT-authenticated `GET /api/me` returns the mirror row.

## Deploy flow

```text
push to staging branch
        ↓
deploymentTrigger fires (per service)
        ↓
Railpack builds image
        ↓
container deployed to staging env
        ↓
healthcheck (api: /health; frontend: TCP)
        ↓
public domain serves traffic
```

Deployment triggers (one per service, per env), as they were before the
split, when both services built from the single repo now called
`family-hub-web`. For today's repos see
[Repos after the split](#repos-after-the-split-2026-10-31).

| Trigger ID                             | Service  | Branch    | Repo                             |
| -------------------------------------- | -------- | --------- | -------------------------------- |
| `a97c3872-4e12-46ac-9883-aeb03e1bd15e` | api      | `staging` | `familyhubapp971/family-hub-web` |
| `f3456b7a-d1a6-461c-a222-c3fa6e011550` | frontend | `staging` | `familyhubapp971/family-hub-web` |

Manual deploys can be triggered via the Railway MCP
(`mcp__railway__deployment_trigger` with a commit SHA) or by pushing
the staging branch.

### Branch → environment mapping

| Branch                                                   | Environment       | Trigger                                                                                                     | Notes                                                                                                                                                                         |
| -------------------------------------------------------- | ----------------- | ----------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `feature/*`, `fix/*`, `documents/*`, `chore/*`, `test/*` | none (no preview) | n/a                                                                                                         | Verified by CI workflows + local dev. Railway preview environments require a paid plan; we don't use them.                                                                    |
| `staging`                                                | staging           | auto-deploy on push (per-service triggers above)                                                            | All bootstrap work merges here per [ADR 0006](../decisions/0006-branching-strategy.md).                                                                                       |
| `main`                                                   | production        | auto-deploy on push (planned, configured during [FHS-202](https://qualicion2.atlassian.net/browse/FHS-202)) | `main` is held at its current commit until the W1 vertical slice ([FHS-198](https://qualicion2.atlassian.net/browse/FHS-198)) is verified, then promoted as one tested batch. |

Feature branches deliberately get no Railway environment. The full
verification matrix is: `pnpm test` (unit + integration locally) → CI
([`.github/workflows/ci-feature.yml`](../../.github/workflows/ci-feature.yml))
on push → CI ([`.github/workflows/ci-pr-staging.yml`](../../.github/workflows/ci-pr-staging.yml))
on PR → manual review → merge to `staging` → first observation in the
real env.

## Rollback

Railway keeps every successful build in the deployment history per
service. The fast path is a **no-rebuild redeploy of the cached image**
(seconds, no CI). The scripted path **rebuilds from source** at an
older commit (slower but works if the cached image was evicted or you
want a fresh build of older code).

### Fast path (Railway dashboard, ~30 seconds)

1. Open [the project dashboard](https://railway.com/project/bc7e539b-fc8b-4f56-99e2-daffee70138f).
2. Pick the broken service (`api` or `frontend`) in the affected
   environment (likely `staging`).
3. **Deployments** tab → find the last known-good deploy
   (status `SUCCESS`, recent timestamp before the regression).
4. Three-dot menu → **Redeploy**. Railway pulls the cached image and
   swaps it in over the bad one. No rebuild.
5. Verify: hit the public domain or `curl <domain>/health` for api.

### Scripted path (Claude / Railway MCP)

The Railway tools below are MCP calls invoked by Claude, not shell
commands. Ask Claude to run them in this order, or call them directly
if you have an MCP-aware client:

| Step                                                     | MCP tool                           | Args (JSON)                                                                     |
| -------------------------------------------------------- | ---------------------------------- | ------------------------------------------------------------------------------- |
| 1. List recent deploys for the broken service            | `mcp__railway__deployment_list`    | `{ "serviceId": "<svc>", "environmentId": "<env>", "limit": 10 }`               |
| 2. Trigger a fresh deploy at the last-good SHA (rebuild) | `mcp__railway__deployment_trigger` | `{ "serviceId": "<svc>", "environmentId": "<env>", "commitSha": "<good-sha>" }` |
| 3. Watch the new deploy                                  | `mcp__railway__deployment_logs`    | `{ "deploymentId": "<returned-id>" }`                                           |

Service / env IDs are listed in the [Services](#services) and
[Environments](#environments) tables above.

For non-MCP environments, the equivalent shell call hits the GraphQL
endpoint directly, see [Operational handles](#operational-handles).

### Git-side rollback (worst case: bad code already on `staging`)

If `staging` itself is poisoned and a future merge would re-break:

1. Identify the bad commit on `staging` (`git log staging`).
2. Open a PR that **reverts** the bad commit, never `git push --force`,
   never `git reset --hard`. Title: `revert: <original commit subject>
(FHS-XXX)`. CI runs as normal.
3. Squash-merge to `staging`. Railway auto-deploys the revert.
4. File a follow-up ticket to fix the underlying bug; the revert is
   not a fix, only a stop-gap.

The same flow applies to `main` once it's live, with `production` as
the deploy target.

### Database rollback

Schema migrations are forward-only. If a migration is broken:

1. Don't reach for a `down` migration, write a **new forward migration**
   that undoes the bad change.
2. If data has been corrupted, restore from Railway's automated Postgres
   backup (Hobby+ plan, not yet available; documented for FHS-202).
3. Until backups are configured, the recovery path is: re-bootstrap the
   staging Postgres volume from the Drizzle schema at
   [`family-hub-api/src/database/schema.ts`](https://github.com/familyhubapp971/family-hub-api/blob/staging/src/database/schema.ts).
   Seed scripts to be added under [FHS-168](https://qualicion2.atlassian.net/browse/FHS-168);
   until then, recovery is schema-only and any test data is lost.

## Region constraints

The Railway trial plan does **not** allow region selection. Setting
`region` via either the MCP `service_update` or the GraphQL
`serviceInstanceUpdate` mutation returns success but does **not**
persist, a silent no-op. All workloads run in `us-east4`.

The user-facing edge (TLS termination + static asset cache) is auto-
selected by Railway based on visitor geography. UAE traffic terminates
at `asia-southeast1-eqsg3a` (Singapore), keeping perceived latency
acceptable for an MVP. Origin requests still cross to us-east4
(~120-140 ms from UAE), so any latency-sensitive paths should be
treated with caution until [FHS-202](https://qualicion2.atlassian.net/browse/FHS-202)
unlocks `europe-west4` for closer Middle East peering.

## Cost expectations (trial plan)

- Idle frontend service: ~free (no traffic ⇒ minimal compute)
- Postgres staging: low constant cost (small image, single replica)
- Postgres production: $0, never wakes (CRASHED + sleep)
- api staging: ~free until [FHS-201](https://qualicion2.atlassian.net/browse/FHS-201) lands and it actually runs

The $5 trial cap is the upper bound until upgrade. Burn rate so far
(2026-04-26 provisioning session): negligible, most credit was
consumed by image pulls and the Postgres staging instance running.

## Logs & monitoring

- **Live logs (per service):** dashboard → service → **Deployments**
  → click latest → **View Logs**. Streams stdout/stderr in real time.
- **Historical logs (scripted):** `mcp__railway__deployment_logs --deploymentId <id>`.
- **api healthcheck:** `GET https://api-fhapp.up.railway.app/health`
  returns `{ "status": "ok" }`. Use as an uptime probe target.
- **frontend healthcheck:** none beyond TCP, fetch the root URL
  ([frontend-staging-409d.up.railway.app](https://frontend-staging-409d.up.railway.app))
  and assert HTTP 200 with the expected document title.
- **Sentry / structured logging:** wired in [FHS-166](https://qualicion2.atlassian.net/browse/FHS-166)
  and [FHS-167](https://qualicion2.atlassian.net/browse/FHS-167): until
  those land, Railway's deployment-log view is the only signal.
- **Uptime alerts (FHS-167):** Better Stack / UptimeRobot pings every
  60s on:

  - `https://api-fhapp.up.railway.app/health` (staging)
  - `https://<api-prod-domain>/health` (production, wires once FHS-202 lands)

  Alert channels: Slack `#family-hub-alerts` + email `oduniyi@gmail.com`.
  Two consecutive failures (~120s) → page; recovery on next OK.
  Configure via the SaaS dashboard; no code or env var needed. Track
  the configured monitor URLs here when set up.

## W1 vertical slice: staging verification (FHS-198)

The Sprint 0 vertical slice (Supabase login → mirror sync → protected
`GET /api/me` → frontend `/me` greeting) is live on staging. Public URLs:

- **Frontend:** [frontend-staging-409d.up.railway.app](https://frontend-staging-409d.up.railway.app)
- **API:** [api-fhapp.up.railway.app](https://api-fhapp.up.railway.app)
- **Auth:** Supabase Staging (`maolytpqazmykjzdybtj`)

End-to-end check, last verified 2026-04-30:

| #   | Check                                                                               | Result                                                                                             |
| --- | ----------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------- |
| 1   | `GET /` on frontend returns the React shell                                         | 200, root mount present                                                                            |
| 2   | `GET /health` on api returns `{status: ok, version, uptime}`                        | 200                                                                                                |
| 3   | `GET /api/me` without `Authorization` header                                        | 401                                                                                                |
| 4   | Supabase password-grant login for `e2e@familyhub.test`                              | `access_token` returned                                                                            |
| 5   | `GET /api/me` with bearer token returns `{id, email, createdAt}`                    | 200, matching email                                                                                |
| 6   | Same call repeated 5x returns identical id + `createdAt` (mirror upsert idempotent) | All identical                                                                                      |
| 7   | CORS rejects unknown origin (`https://evil.example.com`)                            | No `Access-Control-Allow-Origin` echo                                                              |
| 8   | Security headers on every response                                                  | `X-Frame-Options: DENY`, HSTS, CSP, `X-Content-Type-Options: nosniff`, Referrer-Policy all present |
| 9   | k6 auth-smoke (FHS-197)                                                             | 51/51 checks green; p95 = 858 ms (geography-bound on Trial; FHS-202 unlocks europe-west4)          |

Manual UI walkthrough (clickable):

1. Open the frontend URL above.
2. Click **Log in** (or visit `/login` directly).
3. Sign in with the e2e user (or your own confirmed Supabase account).
4. Land on `/dashboard`; navigate to `/me`.
5. See "Hello, &lt;email&gt;" + your user id and account-creation timestamp.

If any of the above fails, follow the
[Rollback fast path](#rollback) to redeploy the prior good build, then
diagnose with [`mcp__railway__deployment_logs`](#logs--monitoring).

## Operational handles

- **Dashboard:** [railway.com/project/bc7e539b-...](https://railway.com/project/bc7e539b-fc8b-4f56-99e2-daffee70138f)
- **Frontend staging:** [frontend-staging-409d.up.railway.app](https://frontend-staging-409d.up.railway.app)
- **api staging:** [api-fhapp.up.railway.app](https://api-fhapp.up.railway.app)
- **Railway MCP:** configured in `.mcp.json` (gitignored). Set `RAILWAY_API_TOKEN` in `.env.local`, then `claude mcp add railway --scope local --env RAILWAY_API_TOKEN=$RAILWAY_API_TOKEN -- npx -y @jasontanswe/railway-mcp`. Verify with `claude mcp list` (expect `railway: connected`).
- **Direct GraphQL:** `https://backboard.railway.com/graphql/v2` with `Authorization: Bearer $RAILWAY_API_TOKEN`. Use for anything the MCP doesn't expose (e.g., `deploymentTriggerCreate`, `serviceInstanceUpdate.region`).

## Runbook: add a new service to staging

The MCP doesn't expose a single "create + connect + deploy" call,
service setup is a 5-step workflow. Capturing it here so it's not
re-derived each time.

1. **Create the service** at the project level:
   - Repo-based: `mcp__railway__service_create_from_repo({ projectId, repo: "familyhubapp971/<family-hub-api or family-hub-web>", name: "<svc-name>" })`
   - Image-based: `mcp__railway__service_create_from_image({ projectId, image: "<image>:<tag>", name: "<svc-name>" })`
   - Capture the returned `serviceId`.
2. **Configure the staging instance** via `mcp__railway__service_update`:
   - Always: `region` (no-op on trial, see [Region constraints](#region-constraints)), `buildCommand`, `startCommand`, `healthcheckPath` if applicable.
   - **Don't** set `rootDirectory` to a sub-folder: it breaks pnpm workspace resolution. Leave at the default `/`.
3. **Wire branch-based deploys** via direct GraphQL (the MCP doesn't expose `deploymentTriggerCreate`):

   ```graphql
   mutation {
     deploymentTriggerCreate(
       input: {
         projectId: "bc7e539b-fc8b-4f56-99e2-daffee70138f"
         environmentId: "3fb76a04-e926-4bdf-ae03-659966366dfb"
         serviceId: "<svc-id>"
         provider: "github"
         repository: "familyhubapp971/<family-hub-api or family-hub-web>"
         branch: "staging"
         checkSuites: false
       }
     ) {
       id
     }
   }
   ```

4. **Set env vars** via `mcp__railway__variable_bulk_set`: secrets must
   not be inlined in the MCP call (transcript exposure); set those via
   the Railway dashboard "Generate" affordance or, if necessary, via
   `mcp__railway__variable_set` accepting the transcript trade-off.
   The full inventory of every variable api / web / tooling read lives
   in [`.env.example`](../../.env.example); `.env.example` is the
   contract, Railway dashboard holds the real values per environment.
5. **Trigger the first deploy** via `mcp__railway__deployment_trigger`
   with the staging branch HEAD SHA, or push to `staging` and let the
   trigger fire automatically. Verify with `mcp__railway__deployment_status`
   and `deployment_logs`.

For image-based services that can't be allowed to also auto-deploy in
the production env (cost reasons during trial), immediately call
`service_update({ environmentId: <production>, sleepApplication: true })`
to neutralize the production instance before it racks up runtime.

## References

- [FHS-156](https://qualicion2.atlassian.net/browse/FHS-156): Create Railway project (this work)
- [FHS-201](https://qualicion2.atlassian.net/browse/FHS-201): Fix api production build (blocks staging api deploy)
- [FHS-202](https://qualicion2.atlassian.net/browse/FHS-202): Configure Railway production post-upgrade
- [FHS-155](https://qualicion2.atlassian.net/browse/FHS-155): Railway Infrastructure & DNS (parent epic)
- [ADR 0006](../decisions/0006-branching-strategy.md): branching strategy

## Sign-in service (GoTrue)

Since 2026-10-31 staging signs people in with our own GoTrue server, not
Supabase ([ADR 0022](../decisions/0022-own-sign-in-server.md)). Production
moves in FHS-701, with a backup first and the founder's go-ahead.

| Part        | Staging set-up                                                                                                                               |
| ----------- | -------------------------------------------------------------------------------------------------------------------------------------------- |
| Service     | `gotrue` (image `supabase/gotrue:v2.197.0`), private only at `gotrue.railway.internal:9999`, no public address                               |
| Database    | The environment's own Postgres, `auth` schema, `gotrue` login role                                                                           |
| Way in      | `https://fh-api-staging.up.railway.app/auth/v1/*`, passed on by the api (`GOTRUE_URL`)                                                       |
| Passes      | ES256 keys in `GOTRUE_JWT_KEYS`. The api trusts them via `AUTH_ISSUER` (`https://fh-api-staging.up.railway.app/auth/v1`) and `AUTH_JWKS_URL` |
| Admin calls | `GOTRUE_ADMIN_SIGNING_KEYS=${{gotrue.GOTRUE_JWT_KEYS}}` on the api. GoTrue refuses admin passes signed with the shared secret                |
| Emails      | Resend SMTP (`smtp.resend.com:587`) from `noreply@fhapp.co`. Needs the Railway Pro plan: Hobby blocks outgoing email                         |
| Templates   | `GOTRUE_MAILER_TEMPLATES_*` read `family-hub-api/email-templates/*.html` from GitHub (`staging` branch on staging, `main` on production)     |
| Google      | `GOTRUE_EXTERNAL_GOOGLE_*`, same Google client as before. Redirect: `https://fh-api-staging.up.railway.app/auth/v1/callback`                 |
| Web         | `VITE_AUTH_URL=https://fh-api-staging.up.railway.app` on the web service                                                                     |

Rules learned the hard way:

- `API_EXTERNAL_URL` is the bare api address. Email links get their path
  from `GOTRUE_MAILER_URLPATHS_*=/auth/v1/verify`. Putting `/auth/v1` in
  `API_EXTERNAL_URL` drops it from the links.
- Never set `GOTRUE_MAILER_EXTERNAL_HOSTS`.
- An account added by hand needs blank text (`''`), not a missing value, in
  its four token columns, and dates in `created_at` and `updated_at`, or
  GoTrue cannot load it.

### Browser-test account

The full browser run (after each merge to `staging`) signs in for real as
`e2e@familyhub.test`, the only account on staging with a password. Its
details live in the web repo's GitHub secrets `E2E_AUTH_USER_EMAIL` and
`E2E_AUTH_USER_PASSWORD`. The api refuses password sign-in for every other
address: only those listed in `PASSWORD_SIGNIN_EMAILS` on the staging api
(`e2e@familyhub.test`) may use one (FHS-704). To replace the password, write a bcrypt hash of a
new one into `auth.users.encrypted_password` for that address on the
staging database, then update the secret. The quick run on every pull
request needs no account and no secret.

## Production switch (2026-10-31)

[FHS-200](https://qualicion2.atlassian.net/browse/FHS-200). The live
setup was renamed rather than rebuilt, so users saw no change.

| Step              | What happened                                                                     |
| ----------------- | --------------------------------------------------------------------------------- |
| Backup            | Full database copy to the founder's Mac; 41 tables, 719 rows, counts verified     |
| Promote           | First `staging` → `main` merge (PR 468); both branches identical afterwards       |
| Old production    | The empty, never-deployed `production` environment was deleted (no volume)        |
| Rename            | `staging` environment renamed `production`; same services, addresses and database |
| Branch            | `api` and `frontend` deploy triggers moved from `staging` to `main`               |
| Checks            | `/health` 200, site 200, Supabase sign-in settings point at the live address      |
| Post-deploy smoke | `PROD_API_URL` repo variable set; `ci-deploy` passes on `main`                    |

Production keeps Supabase project `maolytpqazmykjzdybtj` (labelled
"Family Hub Staging" in Supabase). The unused Supabase project
`bqghmbkoxjompuxixexn` was left alone.

### Repos after the split (2026-10-31)

| Service    | Production (`main`)                                                | Staging (`staging`)                             |
| ---------- | ------------------------------------------------------------------ | ----------------------------------------------- |
| `api`      | `family-hub-api`; build `pnpm build`, start `pnpm start` (FHS-690) | `family-hub-api`, fh-api-staging.up.railway.app |
| `frontend` | `family-hub-web`                                                   | `family-hub-web`, fh-web-staging.up.railway.app |

The production build command is prefixed with
`corepack enable && pnpm install --frozen-lockfile &&`. Staging has its
own empty database.

### Before any production change

1. Back up: `railway ssh -i <key> --service postgres --environment production -- 'pg_dump -U "$POSTGRES_USER" -d "$POSTGRES_DB" --no-owner | gzip -9 | base64 -w 0'`, decoded locally, kept outside the repo.
2. Record row counts for every table, and compare them after each step.
3. Railway's built-in backups need the Pro plan, which this account does not have ([FHS-660](https://qualicion2.atlassian.net/browse/FHS-660)).
