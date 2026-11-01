# 0008: Supabase environment strategy: separate projects now, branches on Pro

**Status:** superseded by [0022](0022-own-sign-in-server.md) (2026-11-01)
**Date:** 2026-04-29
**Jira:** [FHS-187](https://qualicion2.atlassian.net/browse/FHS-187)

## Context

[ADR 0003](0003-auth-library.md) chose Supabase Auth as the auth provider.
We need separate auth + database state for **staging** (mirrors prod for
pre-release validation, lives behind the staging Railway env) and
**production** (real customers, behind the prod Railway env).

Supabase exposes two ways to model this:

1. **Separate projects**: one Supabase project per environment. Each
   has its own ref, URL, keys, auth config. Available on every plan.
2. **Branching**: one parent project, with `staging` (and per-PR
   preview) branches that share auth provider config and promote
   schema migrations branch → main. **Branching requires the Pro plan
   (~$25/mo per org)**; not available on Free.

We're currently on Free across the org. FHS-202 (Railway production
env) is blocked on a Hobby-plan upgrade, and most other Pro-tier
features (daily backups, custom domains, custom SMTP) are not yet
needed in Sprint 0.

## Decision

**Use two separate Supabase projects on Free now; migrate to a
single-project + `staging` branch model when the org moves to Pro.**

| Project ref            | Name                  | Role       | Region       | Created    |
| ---------------------- | --------------------- | ---------- | ------------ | ---------- |
| `bqghmbkoxjompuxixexn` | Family Hub Production | production | `ap-south-1` | 2026-04-28 |
| `maolytpqazmykjzdybtj` | Family Hub Staging    | staging    | `ap-south-1` | 2026-04-29 |

Both projects mirror Railway envs 1:1 (staging Supabase ↔ Railway
staging service; production Supabase ↔ Railway production service).
Free tier supports up to 2 active projects per org, which fits.

## Migration plan: separate projects → branches (when org upgrades to Pro)

Triggered by **any** of:

- Production launch (Sprint 6 / Fix Version `1.0-white-label-launch`)
  needs daily backups, custom domain, or custom SMTP, all Pro-only.
- Auth provider config drift between staging + prod becomes painful.
- Per-PR preview environments become a real need.

Pre-migration checks:

1. Confirm both projects have **identical schema** (Drizzle migration
   history matches). Schema drift CI check (FHS-194 territory) should
   already prevent this, but verify.
2. Confirm both projects have **identical auth provider config**
   (Google OAuth client IDs differ but provider is enabled on both).
3. Inventory any **active OAuth callback URLs / Stripe webhooks /
   third-party integrations** registered against the staging project's
   URL, these must be re-pointed to the new branch URL.

Steps:

1. **Upgrade Family Hub org to Pro** via Supabase dashboard.
2. **Create the staging branch** off `bqghmbkoxjompuxixexn` (production):
   - Dashboard: project switcher → Create branch → name `staging`.
   - Or via management API: `POST /v1/projects/{ref}/branches` with
     `branch_name=staging`.
   - Schema clones automatically from main.
3. **Capture branch credentials**: branch ref, branch-specific
   `SUPABASE_URL`, anon + service_role keys, DB password. The branch
   gets its own Postgres instance and auth state.
4. **Re-point staging consumers** at the branch URL + keys:
   - Railway staging service env vars (`SUPABASE_URL_STAGING`,
     `SUPABASE_ANON_KEY_STAGING`, `SUPABASE_SERVICE_ROLE_KEY_STAGING`).
   - `.env.local` overrides (if devs default to staging).
   - Google Cloud OAuth client → add the branch's redirect URL to the
     authorised list, remove the standalone-project URL.
   - Stripe webhook endpoints (if any) registered against the
     standalone staging URL.
5. **Verify** the staging Family Hub app boots against the branch:
   `pnpm test:e2e:critical` against staging Railway service.
6. **Decommission** `maolytpqazmykjzdybtj` (standalone staging
   project):
   - Export any data worth keeping (probably none if migration
     happens before public beta, ideally **migrate before any real
     test users land in staging**).
   - `DELETE /v1/projects/maolytpqazmykjzdybtj` via management API,
     OR pause first (24h grace) then delete.
7. **Update**:
   - `.env.local`, `.env.example`: collapse `_STAGING` and `_PRODUCTION`
     pairs back to a single set if we reorganise; otherwise rewrite
     `_STAGING` values to point at the branch.
   - `documents/technical/deployment.md`: record the branch model.
   - This ADR, flip `Status:` to `superseded by NNNN` and write the
     superseding ADR documenting the branch-based topology.
   - Memory + Confluence "Architecture & multi-tenancy" page.

Risk register:

| Risk                                                                      | Mitigation                                                                                                                                                   |
| ------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Auth user state lost in standalone staging when project deleted           | Migrate before public beta; if real test users exist, export auth.users via service-role API, recreate via branch's admin API.                               |
| Schema drift between standalone projects surfaces as branch creation bugs | Add a CI check (FHS-194) that fails if Drizzle migration files diverge between `staging-deploy` and `prod-deploy` runs; resolve before triggering migration. |
| Google OAuth callback URL change breaks active sessions                   | Add the new branch URL to the OAuth client's authorised list **before** flipping Railway env vars; only remove the old URL after verification.               |
| Stripe / third-party webhooks mis-routed during cutover                   | Maintain both URLs in the webhook config for the cutover window; remove standalone after one full e2e run on the branch.                                     |

## Consequences

**Now (separate projects):**

- **Easier:** zero plan upgrade, hard isolation, independent quotas.
- **Harder:** two auth provider configs to keep in sync (Google OAuth
  client ID + redirect URLs entered twice); two dashboards; schema
  migrations must be applied to both projects (CI takes care of this
  once FHS-194 lands).

**After migration (branches):**

- **Easier:** one auth provider config inherited by all branches; one
  dashboard; schema promotion is a primitive (`migration_version` on
  branch, promote to main).
- **Harder:** branch resource exhaustion can affect main if quotas tight;
  branch deletion is the only "reset", tied to the parent's lifecycle.

## Alternatives considered

- **Branches on Free (not possible).** Branching is gated to Pro per
  Supabase pricing as of 2026-04-29.
- **One project, two databases (separate `public` schemas).** Rejected:
  Supabase auth state lives in the `auth` schema, which is project-wide;
  cannot be isolated per env without separate projects.
- **One project for everything (staging + prod share state).** Rejected:
  obvious blast-radius and compliance issues; staging tests would
  pollute prod auth.users.
- **Self-hosted Supabase (Docker) for staging.** Rejected: operational
  overhead defeats the "use Supabase" decision in [ADR 0003](0003-auth-library.md).

## Open dependencies

- **FHS-194, schema-drift CI check.** Referenced twice in the migration
  plan (pre-check #1 and the schema-drift risk row). Without it, Drizzle
  migration files can diverge silently between the staging and production
  projects, which surfaces as confusing branch-creation errors at
  migration time. Track explicitly so the dependency isn't lost.
