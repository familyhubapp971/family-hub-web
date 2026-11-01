# Scalability audit: will Family Hub hold up as it grows?

**Date:** 2026-07-09 · **Jira:** FHS-459 (epic) · **Method:** three parallel
specialist audits (app code, database, load-test readiness).

## The one-paragraph answer (plain English)

The app is **fine for the beta today** (tens of families) and will keep working
for a while. But it has a small number of **structural limits that will bite as
it grows**, and the biggest one is not obvious: **every time someone opens the
app, the server borrows one of only ten database "phone lines" and holds it for
the whole request while it makes about 25 back-to-back database calls.** With
only ten lines per server, a busy morning (everyone checking the family board at
once) will start making people wait. And a second limitation means we **can't
just add more servers** to cope until we fix how a couple of counters are
stored. None of this is on fire; all of it is cheap to fix before it hurts.

## Traffic-light by scale

| Scale                        | Verdict                                  | Why                                                                                                                                             |
| ---------------------------- | ---------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------- |
| **~10 families (beta, now)** | 🟢 Fine                                  | Low traffic, small data. Nothing bites yet.                                                                                                     |
| **~1,000 families**          | 🟡 Needs the "before 1k" fixes           | Busy-hour bursts exhaust the 10-connection pool; the dashboard's ~25 queries make each request hold a connection too long; can't scale out yet. |
| **~10,000 families**         | 🔴 Needs all fixes + a connection pooler | Unbounded queries slow the oldest families; direct-to-Postgres connection budget runs out; needs PgBouncer/Supavisor + indexes.                 |

## The findings (ranked by "what breaks first")

Each: what it is in plain words, then the technical detail, then the fix + ticket.

### 1. One database connection is held for the whole request (FHS-462)

- **Plain:** Each request grabs 1 of only 10 database connections and keeps it
  until the whole page's work is done. Queries run one-after-another on it, so
  "do these in parallel" in the code doesn't actually run them in parallel.
- **Technical:** `runWithRequestDb` ([family-hub-api/src/security/request-db.ts](https://github.com/familyhubapp971/family-hub-api/blob/staging/src/security/request-db.ts))
  pins one pooled `pg.Client` (pool `max: 10`, [db/client.ts:25](https://github.com/familyhubapp971/family-hub-api/blob/staging/src/database/client.ts))
  for the request lifetime to carry the per-request RLS tenant GUC. A single
  `pg` client is serial, so `Promise.all` in handlers gives **no** concurrency.
  Connection hold time = full handler duration. `connectionTimeoutMillis: 5000`
  → request 11 waits up to 5s, then a fake "fallback" re-queues on the same dead
  pool. Caps one instance at ~50–100 dashboard req/s.
- **Fix:** don't hold a connection per whole request (scope tenant per-query /
  per-write); add a **transaction-mode pooler** (PgBouncer / Supavisor) before
  running more than ~6–8 instances; make the fallback fail fast.

### 2. The dashboard makes ~25 database calls per open (FHS-463)

- **Plain:** Opening the home screen fires about 25 separate database
  questions, one after another. Fewer, smarter questions = much faster, and it
  frees the connection sooner (helps #1 for free).
- **Technical:** `GET /api/dashboard/today` ([routes/dashboard.ts](https://github.com/familyhubapp971/family-hub-api/blob/staging/src/areas/today/dashboard.ts))
  = ~19 fixed queries + ~2 per kid. The recent-activity feed reads several full
  tables then merges + sorts in JS to `slice(0,5)`. Even at 5–10ms/query
  internal latency that's a 100–200ms floor on the most-loaded screen.
- **Fix:** batch into ~3–5 queries; make the activity feed one SQL
  `UNION ALL … ORDER BY created_at DESC LIMIT 5`; fold per-kid sticker balance
  into one grouped `SUM`.

### 3. Can't add more servers yet (FHS-464)

- **Plain:** Two safety counters (how fast someone can hammer the API, and how
  many wrong kid-PIN tries before lockout) are kept in one server's memory. Run
  a second server and each keeps its own count, so the limits leak, and a
  PIN-guesser gets twice the attempts. This blocks "just add servers" to cope
  with #1.
- **Technical:** in-memory `Map` in [middleware/rate-limit.ts:29](https://github.com/familyhubapp971/family-hub-api/blob/staging/src/security/rate-limit.ts)
  and [routes/auth-kid-pin.ts:63](https://github.com/familyhubapp971/family-hub-api/blob/staging/src/areas/kids/auth-kid-pin.ts).
  The kid-PIN one is also a **security** concern (brute-force budget × replica
  count).
- **Fix:** move both to Redis **before** the first horizontal scale-out.

### 4. Missing database indexes on the busiest queries (FHS-461)

- **Plain:** A few of the most-run queries don't have the right "index" (the
  database's shortcut to find rows fast), so as a family builds up months of
  history those queries get slower every week.
- **Technical:** the highest-value gaps (exact DDL):
  ```sql
  CREATE INDEX habit_stickers_tenant_week_idx    ON habit_stickers   (tenant_id, week_id);
  CREATE INDEX habit_stickers_tenant_created_idx ON habit_stickers   (tenant_id, created_at DESC);
  CREATE INDEX mw_week_actions_tenant_created_idx ON mw_week_actions  (tenant_id, created_at DESC);
  CREATE INDEX events_tenant_created_idx         ON events           (tenant_id, created_at DESC);
  CREATE INDEX tasks_tenant_created_idx          ON tasks            (tenant_id, created_at DESC);
  CREATE INDEX tasks_tenant_member_created_idx   ON tasks            (tenant_id, member_id, created_at DESC);
  CREATE INDEX redemption_requests_tenant_status_decided_idx  ON redemption_requests (tenant_id, status, decided_at DESC);
  CREATE INDEX redemption_requests_tenant_status_requested_idx ON redemption_requests (tenant_id, status, requested_at DESC);
  ```
  `habit_stickers` is the fastest-growing table (one row per kid per habit per
  day) and its existing indexes lead with `member_id`, which the dashboard's
  per-week query never filters on, so the index can't be used past the
  `tenant_id` prefix. RLS leading-column convention (`tenant_id` first) holds
  everywhere else. Candidate to review/drop: `tasks_tenant_member_done_idx`
  (no query filters/sorts by `done_at`).
- **Fix:** one small Drizzle migration adding the indexes above (low-risk,
  additive).

### 5. Some lists read every row, forever (FHS-466)

- **Plain:** A few queries fetch _all_ of a family's tasks / transactions and
  then keep only a handful in code. Fine at 20 rows, slow at 5,000 (an old,
  active family).
- **Technical:** `taskRows` (no `LIMIT`, no `member`/`done` filter), `txRows`
  (all savings transactions, summed in JS), and the My World `listInvestments`
  N+1 (`Promise.all` of 2 `count()` per investment, serial on the one
  connection anyway). All in [dashboard.ts](https://github.com/familyhubapp971/family-hub-api/blob/staging/src/areas/today/dashboard.ts)
  / [lib/myworld.ts](https://github.com/familyhubapp971/family-hub-api/blob/staging/src/areas/my-world/myworld.ts).
- **Fix:** `LIMIT` every list/feed; push sums into SQL `GROUP BY`; one grouped
  count for investments.

### 6. The same tiny lookups run on every request (FHS-465)

- **Plain:** Every request re-asks the database for unchanging facts (this
  family's id, its currency/timezone) and writes a "last seen" row for the user
  even when nothing changed, which is wasted work on 100% of requests.
- **Technical:** slug→id ([resolve-tenant.ts](https://github.com/familyhubapp971/family-hub-api/blob/staging/src/security/resolve-tenant.ts)),
  currency/timezone, `loadCaller`, and an `INSERT … ON CONFLICT DO UPDATE` on
  `users` ([auth.ts](https://github.com/familyhubapp971/family-hub-api/blob/staging/src/security/auth.ts)) every call (a WAL
  write on every read).
- **Fix:** short-TTL per-replica cache for the immutable lookups; only write
  `users` on change/first-seen.

### 7. Defense-in-depth gap (FHS-467)

- `mw_transaction_stickers` has no `tenant_id` column and is not in the RLS
  policy set. No live leak (app-layer joins scope it), but it's the one
  tenant-adjacent table with zero database-level isolation. Add `tenant_id` +
  an RLS policy.

## Connection math (the number that decides "how many servers")

- Each API instance opens up to `max: 10` Postgres connections.
- Managed Postgres typically allows ~100 connections total → **~8–9 instances
  is the ceiling** at today's pool size, with no headroom for migrations/cron.
- "1,000 concurrent in-flight requests" would need ~1,000 held connections at
  the current one-per-request design, far past any direct-Postgres budget.
- **Answer:** a transaction-mode pooler (PgBouncer / Supavisor) lets 1,000
  concurrent requests multiplex through ~20–50 real Postgres connections. Needed
  before scaling past a handful of instances. Also: run `SHOW max_connections;`
  on the live Railway Postgres to confirm the real ceiling.

## What we're doing about testing

The old performance tests only pinged `/health` and `/hello`: no login, no
database, no family data, so they proved nothing about real scale. The new
suite (FHS-460, see [tests/performance/README.md](https://github.com/familyhubapp971/family-hub-api/blob/staging/tests/performance/README.md))
drives **real logged-in parent + kid sessions** through the actual hot screens
(dashboard, kid dashboard, My World, learn), so a load run measures what a real
morning rush would feel like. Caveat baked into the docs: the API rate-limits
100 requests/min per IP, so a real load run needs that raised for the test
window (or distributed load), otherwise it just measures rejections.

## Prioritized plan

**Before ~1,000 families** (the ones that break first):

1. Fix the connection model + add a pooler (FHS-462), load-bearing.
2. Slim the dashboard to ~3–5 queries (FHS-463), also the fastest single win.
3. Move rate-limit + kid-PIN lockout to Redis (FHS-464), unblocks scale-out.
4. Cache the per-request lookups + stop the `users` write (FHS-465).
5. Add the missing indexes (FHS-461), cheap, do it early.

**Before ~10,000 families:** 6. `LIMIT` the unbounded lists + fold the N+1 counts (FHS-466). 7. Confirm the pooler ceiling under load; set replica count × pool size against
the real `max_connections`. 8. Close the `mw_transaction_stickers` RLS gap (FHS-467).

**Fastest headroom for the least work:** FHS-463 + FHS-465 together roughly
halve the dashboard's connection-hold time, buying breathing room against the
connection ceiling with no architecture change.
