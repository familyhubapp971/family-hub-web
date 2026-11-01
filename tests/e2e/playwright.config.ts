import { defineConfig, devices } from '@playwright/test';
import { defineBddConfig } from 'playwright-bdd';
import { linkApiRepo } from './support/api-repo.js';
import { STAGING_AUTH_URL, trustSettings } from './support/auth/env.js';

// In CI the workflow exports DATABASE_URL with credentials matching the
// `postgres:16-alpine` service (e.g. fh_test:fh_test@localhost). Inline
// command-line env vars on a child_process spawn OVERRIDE the parent
// process env, so previously hardcoding a no-credential URL here meant
// the API process tried to connect anonymously and every DB-touching
// endpoint failed in CI. Inherit DATABASE_URL when set; fall back to
// the local-dev convention only when it isn't.
// FHS-688: the server comes from the family-hub-api repo, not this one.
const apiDir = linkApiRepo();
const apiDatabaseUrl = process.env.DATABASE_URL ?? 'postgres://localhost:5432/familyhub_test';

// FHS-545 / FHS-700: this full matrix does NOT set E2E_TEST_JWKS on the api.
// Its one authed spec (auth.feature, FHS-196) does a REAL password sign-in on
// our staging sign-in service, so the local api trusts that service's public
// keys (trustSettings below). The test-key harness's @authed-local specs are
// excluded from this matrix (see the `tags` filter below) and run only in
// playwright.critical.config.ts, which DOES wire E2E_TEST_JWKS.

// Generates Playwright spec files from .feature files into .features-gen/.
// Scenario names in features/ MUST mirror Gherkin scenarios in
// documents/features/<slug>.md character-for-character (Jira AC traceability).
// Paths in defineBddConfig are resolved relative to THIS config file's
// directory (tests/e2e/), NOT the CWD where bddgen was invoked.
const testDir = defineBddConfig({
  features: 'features/**/*.feature',
  steps: 'steps/**/*.ts',
  outputDir: '.features-gen',
  // FHS-516: steps/authed-smoke.ts uses `test` extended with the
  // `authedFamily` fixture (support/fixtures.ts), not the bare
  // playwright-bdd test. bddgen can't infer that from the steps glob alone
  // (support/ isn't in it), so it needs pointing at the fixtures file
  // explicitly to generate specs that import the right `test` instance.
  importTestFrom: 'support/fixtures.ts',
  // FHS-516: @authed-local specs need the local api booted with the
  // E2E_TEST_JWKS override; this full matrix points web at the real staging
  // api (for the legacy real-login auth.feature spec), so it CANNOT also serve
  // the test-JWKS harness. Those specs run in playwright.critical.config.ts
  // instead (which points web at the local api). Excluded here.
  tags: 'not @authed-local',
});

export default defineConfig({
  testDir,
  timeout: 30_000,
  expect: { timeout: 10_000 },
  retries: process.env.CI ? 1 : 0,
  outputDir: './test-results',
  fullyParallel: true,
  workers: process.env.CI ? 2 : undefined,
  forbidOnly: !!process.env.CI,
  reporter: process.env.CI
    ? [['github'], ['html', { outputFolder: './playwright-report', open: 'never' }]]
    : [['list'], ['html', { outputFolder: './playwright-report', open: 'never' }]],
  use: {
    baseURL: 'http://localhost:5273',
    testIdAttribute: 'data-testid',
    screenshot: 'only-on-failure',
    trace: 'on-first-retry',
    video: 'retain-on-failure',
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
    {
      name: 'mobile-chrome',
      use: { ...devices['Pixel 5'] },
    },
  ],
  // Boot BOTH the api (port 3001) and the web (port 5273). Web's Vite
  // dev server proxies /api → api. CI has no manually-started servers;
  // locally we reuse if already running. Bumped timeout to 120s for
  // cold pnpm + tsx + vite startup on a fresh CI runner.
  //
  webServer: [
    {
      // FHS-545 / FHS-700: no E2E_TEST_JWKS here: the api checks passes
      // against the staging sign-in service's real public keys, so
      // auth.feature's real sign-in works. In CI, VITE_API_URL is unset (its
      // .env.development.local is gitignored), so the web app calls this local
      // api, which is exactly why it must trust that service.
      // FHS-635: RATE_LIMIT_PER_MINUTE=0 disables the api's per-IP token bucket
      // for this run, which .env.example documents as the setting for test runs.
      // Every Playwright worker drives the browser from the same machine, so
      // they all share ONE bucket of 100 requests a minute. Alone a spec is
      // nowhere near it; several in parallel sail past it and the api starts
      // answering 429, which the app renders as "Couldn't load your dashboard
      // (server 429)". That is what made role-permissions and the money-row
      // recap fail at random, always fail on a developer machine (more workers
      // than CI runs), and pass the moment they were run on their own.
      command: `NODE_ENV=test PORT=3001 LOG_LEVEL=error RATE_LIMIT_PER_MINUTE=0 DATABASE_URL=${apiDatabaseUrl} pnpm --dir "${apiDir}" dev`,
      url: 'http://localhost:3001/health',
      reuseExistingServer: !process.env.CI,
      timeout: 120_000,
      env: trustSettings(STAGING_AUTH_URL),
    },
    {
      command: 'pnpm --filter @familyhub/web dev',
      url: 'http://localhost:5273',
      reuseExistingServer: !process.env.CI,
      timeout: 120_000,
      // FHS-516: the full matrix deliberately does NOT override VITE_API_URL.
      // Locally .env.development.local points it at the staging api; in CI it
      // is unset, so the web calls the local api above. Both trust the staging
      // sign-in service. The test-key harness's @authed-local specs, which need
      // the local api, are excluded from this matrix (see the `tags` filter
      // above) and run in playwright.critical.config.ts.
      // FHS-700: VITE_AUTH_URL makes the sign-in client read the session that
      // auth.feature stores under the staging sign-in address's key.
      env: { VITE_AUTH_URL: STAGING_AUTH_URL },
    },
  ],
});
