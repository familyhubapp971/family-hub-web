import { defineConfig, devices } from '@playwright/test';
import { defineBddConfig } from 'playwright-bdd';
import { linkApiRepo } from './support/api-repo.js';
import { e2eTestJwksJson } from './support/auth/test-key.js';
import { LOCAL_AUTH_URL, trustSettings } from './support/auth/env.js';

// See playwright.config.ts for the rationale: inline command-line env
// vars override the parent process env on child_process spawn, so a
// hardcoded no-credential DATABASE_URL here meant the API booted but
// couldn't connect to the postgres service in CI. Inherit the URL
// from the CI workflow's env when set.
// FHS-688: the server comes from the family-hub-api repo, not this one.
const apiDir = linkApiRepo();
const apiDatabaseUrl = process.env.DATABASE_URL ?? 'postgres://localhost:5432/familyhub_test';

// FHS-516 / FHS-700: the local api trusts only passes signed with the fixed
// test key, issued as LOCAL_AUTH_ISSUER. Nothing here needs a secret or a
// real sign-in service, so the signed-in specs run on any machine.
const apiWebServerEnv = { ...trustSettings(LOCAL_AUTH_URL), E2E_TEST_JWKS: e2eTestJwksJson() };

// Critical-path subset for PR CI: only @critical-tagged scenarios,
// chromium only, must finish under 5 min. Full matrix runs post-merge
// to staging via the regular playwright.config.ts.
// Paths relative to THIS config file's directory (tests/e2e/).
const testDir = defineBddConfig({
  features: 'features/**/*.feature',
  steps: 'steps/**/*.ts',
  outputDir: '.features-gen-critical',
  tags: '@critical',
  // FHS-516: see playwright.config.ts for the rationale.
  importTestFrom: 'support/fixtures.ts',
});

export default defineConfig({
  testDir,
  timeout: 30_000,
  expect: { timeout: 10_000 },
  retries: process.env.CI ? 1 : 0,
  outputDir: './test-results-critical',
  fullyParallel: true,
  workers: process.env.CI ? 2 : undefined,
  forbidOnly: !!process.env.CI,
  reporter: process.env.CI
    ? [['github'], ['html', { outputFolder: './playwright-report-critical', open: 'never' }]]
    : [['list'], ['html', { outputFolder: './playwright-report-critical', open: 'never' }]],
  use: {
    baseURL: 'http://localhost:5273',
    testIdAttribute: 'data-testid',
    screenshot: 'only-on-failure',
    trace: 'on-first-retry',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  // Boot api + web; CI has no manual servers. See playwright.config.ts for
  // the FHS-516 `reuseExistingServer` gotcha (a stray :3001 process from
  // another terminal masks E2E_TEST_JWKS and breaks only the authed spec).
  webServer: [
    {
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
      // FHS-516: see playwright.config.ts for the rationale.
      env: apiWebServerEnv,
    },
    {
      command: 'pnpm --filter @familyhub/web dev',
      url: 'http://localhost:5273',
      reuseExistingServer: !process.env.CI,
      timeout: 120_000,
      // FHS-516: the web app reads VITE_API_URL (src/app/lib/api.ts), and
      // .env.development.local points it at the STAGING api by default
      // (a local-dev convenience). For e2e the browser MUST hit the local api on
      // :3001, the only one that trusts the test-minted JWT via E2E_TEST_JWKS.
      // Vite gives a real env var priority over .env files.
      // FHS-700: VITE_AUTH_URL points the sign-in client at the same local api,
      // so it reads the session the fixture stores under that address's key.
      env: { VITE_API_URL: LOCAL_AUTH_URL, VITE_AUTH_URL: LOCAL_AUTH_URL },
    },
  ],
});
