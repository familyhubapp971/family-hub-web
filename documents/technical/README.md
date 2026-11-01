# Technical docs

Implementation specs derived from feature requirements. This is _how_
the system is built; the _what_ and _why_ live in
[`../features/`](../features/) and [`../decisions/`](../decisions/).

## When to add a doc

- Architecture overviews when a major system component is introduced.
- API contracts when a new public surface stabilises (the OpenAPI spec
  itself lives in `family-hub-api/api-docs/openapi.json`: link from here, don't duplicate).
- Data model docs (ERDs, schema rationale) when tables are added or
  reshaped beyond a routine migration.
- Sequence diagrams or runbooks when a flow spans multiple services or
  has non-obvious failure modes.
- Deployment / infra docs when topology changes.

Skip docs for routine implementation that the code itself documents
adequately.

## Naming

`<topic-slug>.md`: kebab-case, no prefixes. Examples:

- `architecture.md`
- `api/conventions.md`
- `data-model/tenants.md`
- `deployment.md`
- `slos.md`

Use subfolders (`api/`, `data-model/`, etc.) when a topic grows past
3–4 docs.

## Cross-linking

Every technical doc that implements a feature should link back to the
matching `../features/<slug>.md`. ADRs that drove the implementation
should be linked in a "References" section at the bottom.

## Index

_Initial seed, populate as docs are added:_

- `architecture.md`: TBD (high-level system overview)
- [`deployment.md`](deployment.md): Railway topology, env-var matrix, deploy flow, trial-plan constraints
- `slos.md`: TBD (SLI/SLO definitions per service)
- `api/`: TBD (conventions, error envelope, pagination, auth)
- `data-model/`: TBD (per-domain ERDs and schema rationale)

## API docs and test collection

- **Spec:** [`family-hub-api/api-docs/openapi.json`](https://github.com/familyhubapp971/family-hub-api/blob/staging/api-docs/openapi.json), generated
  from the live routes. Browse it at `/docs` on any non-production API.
- **Postman:** [`family-hub-api/api-docs/postman/`](https://github.com/familyhubapp971/family-hub-api/blob/staging/api-docs/postman/) holds the test
  collection plus `local` and `staging` environments, built from the spec.
  The same command keeps a local, gitignored copy in `documents/postman/` for
  sharing with testers.
- **To test:** import the collection and an environment into Postman. Get a
  parent token with folder 01: set `supabaseAnonKey` and `signInEmail`, send
  "Send sign-in email", copy the emailed link (do not click it) into
  `emailLink`, then send "Verify email link"; it saves `userToken`. A new
  parent uses "Send sign-up email", then POST /api/public/tenant to create the
  family. Set `tenantSlug` too. For kid
  endpoints, set `kidMemberId` and `kidPin`, then send "Exchange a kid PIN";
  it saves `kidToken` for you. Every request checks its documented status code.
- **After any API change:** run `pnpm openapi:generate` in family-hub-api and commit both there.
  CI's `openapi:check` fails if either is stale or an endpoint lacks full docs.
