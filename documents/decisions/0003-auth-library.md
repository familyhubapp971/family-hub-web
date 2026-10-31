# 0003: Auth library: Supabase Auth

**Status:** superseded by [0022](0022-own-sign-in-server.md) (2026-11-01)
**Date:** 2026-04-24
**Jira:** [FHS-173](https://qualicion2.atlassian.net/browse/FHS-173)

## Context

We need email + Google OAuth, sessions, password reset, magic links,
and email-template management. Auth touches every protected route and
locks in downstream tooling (FHS-178 epic).

Forces: small team can't hand-roll session/OAuth/email plumbing; auth
state must integrate with our Postgres `users` mirror; future need for
more providers (GitHub, Microsoft, SAML) without rewriting middleware.

## Decision

**Use Supabase Auth as the authentication provider.**

Specifics:

- Supabase project per environment (staging now per the staging-only
  policy; production at batch-promotion time per [FHS-200](https://qualicion2.atlassian.net/browse/FHS-200)).
- Email + Google OAuth enabled at project creation (FHS-187).
- Session JWTs issued by Supabase, verified in API middleware
  (FHS-191).
- Postgres `users` mirror table populated on first request (FHS-192)
  joining the Supabase `auth.users.id` to our `users.id` so RLS and
  app queries can `JOIN users` without a remote call.
- Email templates customized in Supabase (FHS-188), versioned via
  Supabase CLI export and committed under
  `infra/supabase/templates/` once that workflow lands.

## Consequences

**Becomes easier:**

- No session/OAuth code to maintain.
- Adding a provider is a Supabase dashboard toggle + an OAuth-app
  credential, no application code change.
- Magic links, password reset, email change confirmations, and
  invite tokens are batteries-included.
- Same provider gives us Postgres + Storage + (optional) Edge
  Functions, simplifying ops while we're a small team.

**Becomes harder:**

- Vendor lock-in on auth flows. Migration to another provider would
  require re-issuing every user's credential and rotating OAuth apps.
- Two sources of truth for the user (Supabase `auth.users` + our
  mirror `users`); requires the sync logic in FHS-192 to stay
  rigorous.
- Some Supabase-specific quirks leak into the codebase (JWT
  audience claim, RLS policy syntax that uses `auth.uid()` in
  Supabase docs but plain `current_setting('app.tenant_id')` in
  ours, see ADR 0001).
- We pay per Monthly Active User above the free tier; cost grows
  with users, not infra.

## Alternatives considered

- **better-auth**, rejected: we'd still build email-provider
  integration, OAuth-app management, and template versioning ourselves.
  Re-evaluate if Supabase pricing becomes prohibitive at >50k MAU.
- **Auth.js / NextAuth**, rejected: coupled to Next.js; we're on
  Hono + React + Vite.
- **Custom JWT + Postgres**, rejected (explicit non-goal): months
  of work for zero customer-facing value.
- **Auth0 / Clerk**, rejected: more expensive at our scale and
  doesn't bundle Postgres + Storage like Supabase.

## Re-evaluate when

- We exceed 50k MAU and Supabase auth costs warrant looking at
  self-hosted alternatives.
- An enterprise tenant requires SAML/SSO that Supabase doesn't
  support adequately.
- A regulatory regime (FedRAMP, certain EU public-sector tiers)
  precludes Supabase as a sub-processor.

## References

- [ADR 0001: Multi-tenancy strategy](0001-multi-tenancy.md)
- [FHS-178: Supabase Auth Integration epic](https://qualicion2.atlassian.net/browse/FHS-178)
- [FHS-200: Production environments + batch promotion](https://qualicion2.atlassian.net/browse/FHS-200)
