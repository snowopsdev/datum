import { defineConfig, devices } from '@playwright/test'

/**
 * Read environment variables from file.
 * https://github.com/motdotla/dotenv
 */
import 'dotenv/config'

import { assertTestDatabase } from './tests/helpers/testDatabaseGuard'

const testPort = process.env.TEST_PORT || '3101'
const testBaseURL = process.env.TEST_BASE_URL || `http://127.0.0.1:${testPort}`

// The specs seed users, create and archive articles and rewrite globals through
// Payload against `DATABASE_URL`, whether Playwright starts the server or
// `TEST_BASE_URL` points at one you started, so the guard always applies.
assertTestDatabase()

/**
 * See https://playwright.dev/docs/test-configuration.
 */
export default defineConfig({
  testDir: './tests/e2e',
  /* Fail the build on CI if you accidentally left test.only in the source code. */
  forbidOnly: !!process.env.CI,
  /* Retry on CI only */
  retries: process.env.CI ? 2 : 0,
  // E2E specs share one migration-built database and several specs create or
  // archive articles. Keep those fixtures deterministic locally as well as in
  // CI so dashboard redirect expectations cannot race another spec.
  workers: 1,
  /* Reporter to use. See https://playwright.dev/docs/test-reporters */
  reporter: [['list'], ['html', { open: 'never' }]],
  /* Shared settings for all the projects below. See https://playwright.dev/docs/api/class-testoptions. */
  use: {
    /* Base URL to use in actions like `await page.goto('/')`. */
    baseURL: testBaseURL,

    /* Collect trace when retrying the failed test. See https://playwright.dev/docs/trace-viewer */
    trace: 'on-first-retry',
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'], channel: 'chromium' },
    },
  ],
  webServer: process.env.TEST_BASE_URL
    ? undefined
    : {
        command: `npm run dev -- --hostname 127.0.0.1 --port ${testPort}`,
        // Structured data only carries absolute URLs when SITE_URL is set
        // (see `getConfiguredSiteUrl`), and frontend.e2e.spec.ts reads them.
        env: { SITE_URL: testBaseURL },
        reuseExistingServer: false,
        // A cold dev server compiles the first page on request; CI is slower than a laptop.
        timeout: 180_000,
        url: testBaseURL,
      },
})
