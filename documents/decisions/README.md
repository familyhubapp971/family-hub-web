# Architecture Decision Records (ADRs)

Durable record of decisions that shape the system. ADRs are immutable
once accepted, supersede with a new ADR rather than editing.

## When to write an ADR

Write one when a decision:

- changes the shape of the system in a way someone might later question,
- chooses one viable option over another (e.g., Postgres vs DynamoDB),
- locks in a constraint future contributors need to respect.

**Don't** write an ADR for routine implementation choices. The bar is
"future-me would want context on this if they come back in six months."

## Naming

`NNNN-kebab-case-title.md`, where `NNNN` is a zero-padded sequential
number starting at `0001`. Examples:

- `0001-multi-tenancy-strategy.md`
- `0002-subdomain-tenant-routing.md`
- `0003-auth-library-choice.md`

Numbers are assigned at write time, bump from the highest existing
number; never reuse or renumber.

## Format

Every ADR uses the [MADR-lite template defined in
`/CLAUDE.md`](../../CLAUDE.md#architecture-decision-records-adrs). Required
sections:

- **Status:** proposed / accepted / superseded by NNNN
- **Date** (ISO `YYYY-MM-DD`)
- **Jira:** ticket key when applicable
- **Context**: what forces are in play
- **Decision**: what we decided
- **Consequences**: what becomes easier, what becomes harder, follow-ups
- **Alternatives considered**: and why rejected

## Lifecycle

- **Proposed**: drafted but not yet ratified. Open a PR to discuss.
- **Accepted**: merged after sign-off; treat as binding.
- **Superseded**: keep the file; update its `Status` line to point at the
  ADR that replaced it. Never delete an ADR.

## Index

_Seeded by FHS-172 / FHS-173 / FHS-174, populate as ADRs land:_

- [`0001-multi-tenancy.md`](0001-multi-tenancy.md): accepted (FHS-172)
- [`0002-subdomain-tenant-routing.md`](0002-subdomain-tenant-routing.md): accepted (FHS-173); amended by 0012
- [`0003-auth-library.md`](0003-auth-library.md): superseded by 0022: Supabase Auth (FHS-173)
- [`0004-stripe-billing.md`](0004-stripe-billing.md): accepted (FHS-173)
- [`0005-monorepo-structure.md`](0005-monorepo-structure.md): superseded by 0021 (FHS-174)
- [`0006-branching-strategy.md`](0006-branching-strategy.md): accepted (FHS-174)
- [`0007-stack-reuse.md`](0007-stack-reuse.md): accepted (FHS-154)
- [`0008-supabase-environments.md`](0008-supabase-environments.md): superseded by 0022 (FHS-187): two projects on Free, branches when on Pro
- [`0009-family-membership-model.md`](0009-family-membership-model.md): accepted: single `family_members` table for everyone in a family (parents, children, guardians)
- [`0010-frontend-animation-library.md`](0010-frontend-animation-library.md): accepted: framer-motion v11 for web animations (FHS-220)
- [`0011-magic-link-only-parent-auth.md`](0011-magic-link-only-parent-auth.md): accepted: parent auth is magic-link + Google OAuth, no passwords (FHS-224, FHS-248); amended by 0022
- [`0012-path-prefix-tenant-routing-interim.md`](0012-path-prefix-tenant-routing-interim.md): accepted: path-prefix `/t/<slug>/` as interim tenant routing alongside subdomain (FHS-13, FHS-249)
- [`0013-tasks-tab-shared-visibility.md`](0013-tasks-tab-shared-visibility.md): accepted: Tasks tab is shared-to-see, private-to-edit, family-wide read, owner-scoped write (FHS-267)
- [`0014-myworld-economy-separate-tables.md`](0014-myworld-economy-separate-tables.md): accepted: My World uses its own per-child `mw_*` tables, leaving the generic family-finance stubs free (FHS-291)
- [`0015-role-model-owner-flag.md`](0015-role-model-owner-flag.md): accepted: two grown-up tiers, admin (full legacy-admin rights incl. past-day edits) vs normal user; registrant is admin; admins set who's admin (never a child) (FHS-333)
- [`0016-postgres-rls-tenant-isolation.md`](0016-postgres-rls-tenant-isolation.md): proposed: DB-enforced tenant isolation via RLS; non-BYPASSRLS role + per-request `app.current_tenant` GUC (AsyncLocalStorage) + deny-by-default policies; fails closed (FHS-344)
- [`0017-learn-is-kid-only.md`](0017-learn-is-kid-only.md): accepted: Learn lives only in the kid experience (/api/kid/\*); parent /api/learn, /api/reading-log, /api/world-flags routes removed; parents get a read-only Learning Insights tab via FHS-388 (FHS-382)
- [`0018-ai-in-learn.md`](0018-ai-in-learn.md): accepted: AI Maths lessons via Anthropic Claude Haiku, double-gated (LEARN_AI_ENABLED + ANTHROPIC_API_KEY), server-validated JSON, no PII in prompts, flag-off = static bank only (FHS-389)
- [`0019-role-privilege-matrix.md`](0019-role-privilege-matrix.md): accepted: formalises the 5-role privilege matrix (admin/adult/teen/child/guest); invite flow can now grant `admin` with an admin-only safeguard; fixes the "Parent" mislabel on the `adult` badge; flags the Calendar past-date enforcement gap as a follow-up (FHS-485, FHS-486)
- [`0020-configurable-reward-economy.md`](0020-configurable-reward-economy.md): accepted: replaces the fixed 0.5 sticker rate with a configurable per-family/per-child rate (integer minor units) + habit boost + a skip-penalty ledger folded into savings (FHS-512)
- [`0021-three-repo-split.md`](0021-three-repo-split.md): accepted: split into family-hub-api, family-hub-web and family-hub-app, grouped by product area (FHS-686)
- [`0022-own-sign-in-server.md`](0022-own-sign-in-server.md): accepted: sign-in runs on our own GoTrue server on Railway, reached through the api; supersedes 0003 and 0008 (FHS-676, FHS-700)
