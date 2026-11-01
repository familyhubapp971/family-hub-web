import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import pg from 'pg';
import { drizzle } from 'drizzle-orm/node-postgres';
import * as schema from '../../.api-repo/src/database/schema.js';

// FHS-516: direct DB access for the authed e2e fixture's seed/cleanup.
// Reuses the SAME Drizzle schema module the api and the integration tier
// use (family-hub-api src/database/schema.ts) so column names/types can never drift
// out from under this fixture.
//
// Connection string: resolved EXACTLY like playwright.config.ts resolves
// the api webServer's DATABASE_URL (`process.env.DATABASE_URL` with the
// same local-dev fallback), captured at module load, before anything else
// in this package touches process.env, so it can never accidentally pick
// up a value meant for something else (such as the staging DATABASE_URL in
// .env.local).
const E2E_DATABASE_URL = process.env['DATABASE_URL'] ?? 'postgres://localhost:5432/familyhub_test';

let _pool: pg.Pool | undefined;

function getPool(): pg.Pool {
  if (_pool) return _pool;
  _pool = new pg.Pool({
    connectionString: E2E_DATABASE_URL,
    application_name: '@familyhub/e2e-auth-fixture',
    max: 5,
    idleTimeoutMillis: 5_000,
    connectionTimeoutMillis: 5_000,
  });
  _pool.on('error', (err) => {
    // Don't crash the Playwright process on an idle-client error.
    console.error('[e2e auth fixture] postgres pool error', err);
  });
  return _pool;
}

export function getE2eDb() {
  return drizzle(getPool(), { schema });
}

// FHS-516: the e2e api webServer boots with `drizzle-kit push` (schema only),
// exactly like staging/prod. That never creates the SECURITY DEFINER reader
// functions (app_user_memberships etc.), which GET /api/me calls to list a
// user's families across tenants. Without them /api/me returns no tenants and
// every authed page's header falls back to "Your family". Staging fixes this
// with apply-functions.mjs on boot; here we apply the SAME idempotent SQL files
// to the e2e DB once, before the first seed, so authed specs see the real
// production behaviour. Memoised: runs a single time per Playwright process.
const FUNCTION_SQL_FILES = ['0030_rls_read_path_functions.sql', 'apply-email-change-function.sql'];
let _functionsApplied: Promise<void> | undefined;

export function ensureReaderFunctions(): Promise<void> {
  if (_functionsApplied) return _functionsApplied;
  _functionsApplied = (async () => {
    const here = path.dirname(fileURLToPath(import.meta.url));
    const drizzleDir = path.resolve(here, '../../.api-repo/src/database/migrations');
    const pool = getPool();
    // FHS-607: memoising per process is not enough once two authed specs run
    // in parallel, because Playwright gives each worker its own process and
    // two concurrent CREATE OR REPLACE FUNCTION calls on the same catalogue
    // row fail with "tuple concurrently updated". A transaction-scoped
    // advisory lock serialises the workers; the SQL is idempotent, so the
    // second one simply re-applies it.
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      await client.query('SELECT pg_advisory_xact_lock(6070607)');
      for (const file of FUNCTION_SQL_FILES) {
        const sql = await readFile(path.join(drizzleDir, file), 'utf8');
        await client.query(sql);
      }
      await client.query('COMMIT');
    } catch (err) {
      await client.query('ROLLBACK').catch(() => undefined);
      throw err;
    } finally {
      client.release();
    }
  })();
  return _functionsApplied;
}

export { schema };

export async function closeE2eDb(): Promise<void> {
  if (_pool) {
    await _pool.end();
    _pool = undefined;
  }
}
