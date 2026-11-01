# 0022: Sign-in runs on our own GoTrue server

**Status:** accepted (staging switched 2026-10-31; production switches in FHS-701)
**Date:** 2026-11-01
**Jira:** [FHS-676](https://qualicion2.atlassian.net/browse/FHS-676) (children FHS-694 to FHS-703)
**Supersedes:** [0003: Auth library: Supabase Auth](0003-auth-library.md), [0008: Supabase environments](0008-supabase-environments.md)
**Amends:** [0011: magic link and Google, no passwords](0011-magic-link-only-parent-auth.md). That rule stands; only the server behind it changes.

## Context

Sign-in ran on Supabase Auth (0003), in two Supabase projects (0008).
Supabase did nothing for us except sign-in, yet:

- it pauses free projects, which takes sign-in down with it;
- it is one more outside service to pay for, watch and keep keys for;
- our database already runs on Railway, so sign-in could sit next to it.

Our other projects already run Supabase's sign-in software (GoTrue) on
Railway themselves, so the pattern was proven.

## Decision

**Run GoTrue ourselves on Railway, reached only through our api.**

| Part          | What we chose                                                                                                                                                                                   |
| ------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Server        | GoTrue v2.197.0 (the version Supabase runs), one private Railway service per environment, with no public address                                                                                |
| Data          | GoTrue's tables live in an `auth` schema in our own Postgres, owned by a dedicated `gotrue` role                                                                                                |
| Way in        | The web and phone app call the api at `/auth/v1/*`, which passes requests on to GoTrue. It lets through only the routes the web app uses (no admin or password routes) and caps bodies at 64 KB |
| Limits        | The api adds what GoTrue lacks: 5 sign-in emails an hour per address, and 5 wrong codes or passwords lock the address for 15 minutes                                                            |
| Trust         | Passes are ES256 signed. The api checks them against GoTrue's public keys (`AUTH_JWKS_URL`) and name (`AUTH_ISSUER`)                                                                            |
| Admin actions | Invites and email change use a one-minute service pass the api signs with GoTrue's own key (`GOTRUE_ADMIN_SIGNING_KEYS`)                                                                        |
| Emails        | Resend, from `noreply@fhapp.co`, using the branded templates in `family-hub-api/email-templates` (FHS-703). This needs Railway Pro: the Hobby plan blocks email sending                         |
| Google        | The same Google sign-in client as before. Each environment adds its own `/auth/v1/callback` address to it                                                                                       |
| Accounts      | Copied across keeping every id (FHS-699), so families, roles and history stay linked and nobody signs up again                                                                                  |
| Web           | Keeps the supabase-js library, which speaks GoTrue's language. `VITE_AUTH_URL` points it at the api                                                                                             |

Rollout: staging switched on 2026-10-31. Production switches in FHS-701,
only after a backup and the founder's go-ahead. Supabase stays for 30
days afterwards as the way back.

## Consequences

Easier:

- One fewer outside service, and no paused projects taking sign-in down.
- Sign-in data sits next to the app's data, under our own limits and emails.
- Tests no longer need Supabase at all (FHS-700): browser tests make their
  own passes, and the one real sign-in uses a test account on staging.

Harder:

- We run GoTrue ourselves. The version is pinned; security fixes in
  Supabase's GoTrue releases must be watched and picked up by hand.
- There is no Supabase dashboard. Account fixes go through GoTrue's admin
  calls from inside Railway, or SQL on the `auth` schema.
- Sign-in accounts now live in our database, so losing it loses every
  login. Production backups (FHS-660) matter more than before.
- We own email delivery, through the Resend domain set-up.

Follow-ups:

- **Passwords blocked (FHS-704, 2026-11-01):** the check found a real gap.
  An outsider could sign up someone's address with a password and sign in as
  them once the owner confirmed it. The api now refuses password sign-up,
  reset, account changes and password sign-in, except addresses listed in
  `PASSWORD_SIGNIN_EMAILS` (staging lists only the browser-test account).
- Rename the api's `supabase-admin` module once Supabase is removed.

## Alternatives considered

- **Stay on Supabase Auth and pay for Pro:** stops the pausing, but keeps
  an outside service that only does sign-in, at a monthly cost.
- **Write our own sign-in:** magic links, Google, email change and limits
  are easy to get wrong. GoTrue is the same code Supabase runs, so the web
  client and every flow kept working unchanged.
- **Another hosted service (Clerk, Auth0):** a second migration of every
  account and every screen, for the same outside-service problem.
