# Google OAuth provider setup

**Jira:** [FHS-248](https://qualicion2.atlassian.net/browse/FHS-248)
**Owner:** the engineer doing the cutover
**Last verified on staging:** 2026-05-03

> **Since 2026-10-31 (ADR 0022):** staging signs in with Google through our
> own GoTrue server, not Supabase. Same Google client; its redirect is
> `https://fh-api-staging.up.railway.app/auth/v1/callback` and its settings
> are the `GOTRUE_EXTERNAL_GOOGLE_*` values on the staging `gotrue` service.
> Production adds its own `/auth/v1/callback` at the switch (FHS-701), and the
> Supabase redirects below are removed 30 days after. See
> [deployment.md](deployment.md#sign-in-service-gotrue).

Per [ADR 0011](../decisions/0011-magic-link-only-parent-auth.md) parent
auth supports two co-equal entry points: magic-link and Google OAuth.
This page documents how the Google side is wired up, so a fresh
contributor (or a production cutover) is reproducible from a single
checklist.

> **Plain-English summary**
> Google won't let our app sign anyone in until we register it in their
> dashboard. We do that once per environment, paste the resulting Client
> ID + Secret into Supabase, and tick "enable Google", that's it. After
> that the existing "Continue with Google" buttons on `/signup` and
> `/login` Just Work.

---

## What's already wired (staging)

- Single Google Cloud OAuth client used by both Supabase projects (one
  client, multiple authorized redirect URIs whitelisted).
- Client ID lives in `.env.local` as `GOOGLE_OAUTH_CLIENT_ID`; secret as
  `GOOGLE_OAUTH_CLIENT_SECRET`.
- Staging Supabase project (`maolytpqazmykjzdybtj`) is configured,
  `external_google_enabled: true`, client_id + secret pasted in.
- Smoke-test confirms staging redirects to `accounts.google.com` with a
  valid client_id, see [scripts/auth/smoke-google-oauth.py](../../scripts/auth/smoke-google-oauth.py).

To re-apply or audit drift on staging:

```bash
set -a; source .env.local; set +a
python3 scripts/auth/configure-google-oauth.py --check   # diff-only
python3 scripts/auth/configure-google-oauth.py           # apply
python3 scripts/auth/smoke-google-oauth.py               # verify
```

The configure script is idempotent, re-running with the same env vars
is a no-op. To rotate the secret after changing it in Google Cloud:

```bash
python3 scripts/auth/configure-google-oauth.py --rotate-secret
```

---

## Production cutover (one-time, when we move off the parked project)

Production Supabase (`bqghmbkoxjompuxixexn`) is currently parked behind
the Pro upgrade per [ADR 0008](../decisions/0008-supabase-environments.md).
When that flips:

### 1 · Whitelist the production redirect URI in Google Cloud

1. Open <https://console.cloud.google.com/> with the account that owns
   the existing Family Hub OAuth client.
2. Navigate **APIs & Services → Credentials**.
3. Click the **OAuth 2.0 Client ID** named _Family Hub_ (the same one
   already used by staging).
4. Under **Authorized redirect URIs** add:
   ```
   https://bqghmbkoxjompuxixexn.supabase.co/auth/v1/callback
   ```
   (Replace with the custom domain when DNS lands.)
5. **Save**. Changes propagate within ~5 minutes.

### 2 · Run the configure script against production

```bash
set -a; source .env.local; set +a
python3 scripts/auth/configure-google-oauth.py --project production
python3 scripts/auth/smoke-google-oauth.py --project production
```

The script reuses the same `GOOGLE_OAUTH_CLIENT_ID` /
`GOOGLE_OAUTH_CLIENT_SECRET` env vars, same Google client, two
Supabase projects.

### 3 · End-to-end verification

The smoke test only confirms the provider responds with a redirect. To
verify the full round-trip (which exercises the secret + the redirect
URI whitelist):

1. Open the production app, hit `/signup`.
2. Click **Continue with Google**.
3. Pick a Google account → Google should land you back on
   `/auth/callback` with a session, not on a Google error page.

If you get _"Error 400: redirect_uri_mismatch"_, step 1 above wasn't
saved or hasn't propagated yet, wait and retry.

---

## How to create a fresh Google OAuth client (only if starting from scratch)

If the existing client is ever lost or revoked, a new one is created in
Google Cloud Console:

1. **Create / pick a Google Cloud project** dedicated to Family Hub.
   Don't share with unrelated apps.
2. **APIs & Services → OAuth consent screen**:
   - User type: **External**
   - App name: _Family Hub_
   - Authorized domains: `supabase.co` (and your custom domain when
     ready)
   - Scopes: `openid`, `email`, `profile`
   - Add yourself as a test user while the screen is in _Testing_ mode;
     submit for verification before going public.
3. **APIs & Services → Credentials → + Create credentials → OAuth client ID**:
   - Application type: **Web application**
   - Name: _Family Hub_
   - Authorized JavaScript origins: leave empty (Supabase doesn't need
     them; these are for browser-side flows we don't use).
   - Authorized redirect URIs: add the Supabase callback URLs for every
     environment that will use this client:
     ```
     https://maolytpqazmykjzdybtj.supabase.co/auth/v1/callback   # staging
     https://bqghmbkoxjompuxixexn.supabase.co/auth/v1/callback   # production
     ```
4. **Create** → copy the _Client ID_ and _Client secret_ into
   `.env.local`:
   ```bash
   GOOGLE_OAUTH_CLIENT_ID=...
   GOOGLE_OAUTH_CLIENT_SECRET=...
   ```
5. Run `python3 scripts/auth/configure-google-oauth.py` for each project that
   should pick up the new credentials.

---

## Troubleshooting

| Symptom                                                    | Likely cause                                                                                       | Fix                                                                                                          |
| ---------------------------------------------------------- | -------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------ |
| `error: env var SUPABASE_ACCESS_TOKEN is required`         | You haven't sourced `.env.local`, or the var isn't there.                                          | `set -a; source .env.local; set +a`. To mint a new token: <https://supabase.com/dashboard/account/tokens>.   |
| Configure script returns 401 / 403 from `api.supabase.com` | `SUPABASE_ACCESS_TOKEN` is expired, revoked, or doesn't own the target project.                    | Mint a fresh personal access token under the account that created the project.                               |
| Smoke test fails with HTTP 401                             | Anon key in `.env.local` doesn't match the project, or the project is paused.                      | Re-pull the anon key from the Supabase dashboard → API; un-pause the project if it's been idle on Free tier. |
| Browser flow fails with `Error 400: redirect_uri_mismatch` | The Supabase project's callback URL isn't whitelisted in the Google Cloud OAuth client.            | Re-do step 1 of the production cutover above; allow ~5 min for Google to propagate.                          |
| Smoke test passes but real signin still fails              | The Google client _secret_ is wrong (smoke can't verify secrets: only that the provider responds). | Re-paste the secret in `.env.local`, then run the configure script with `--rotate-secret`.                   |

## Ownership

The Family Hub Google OAuth client is owned by the Google account that
created it (currently `oduniyio@gmail.com`'s GCP project). Grant
`Owner` role to a second identity before that account ever leaves the
project, otherwise rotating the secret or adding redirect URIs becomes
a recovery exercise.

## Files

- [`scripts/auth/configure-google-oauth.py`](../../scripts/auth/configure-google-oauth.py): idempotent
  PATCH against `api.supabase.com/v1/projects/{ref}/config/auth`
- [`scripts/auth/smoke-google-oauth.py`](../../scripts/auth/smoke-google-oauth.py): verifies the provider
  redirects to Google with a valid client_id
- `.env.local`: holds `GOOGLE_OAUTH_CLIENT_ID`, `GOOGLE_OAUTH_CLIENT_SECRET`,
  and `SUPABASE_ACCESS_TOKEN`

## Related ADRs

- [0008: Supabase environments](../decisions/0008-supabase-environments.md)
- [0011: Magic-link + Google OAuth parent auth](../decisions/0011-magic-link-only-parent-auth.md)
