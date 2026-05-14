// path: playwright.config.js

// MUST be the very first line — loads .env before any process.env access
require('dotenv').config();

const { defineConfig, devices } = require('@playwright/test');

/**
 * PlaywrightHub — Playwright Configuration v2
 *
 * Phase 4 changes from Phase 1:
 * 1. Worker count tuned for local vs CI vs sharded CI
 * 2. Explicit shard-awareness (SHARD env var for CI matrix)
 * 3. Stronger timeout hierarchy (global → test → action → expect)
 * 4. Firefox and WebKit projects added (commented out for daily use,
 *    enabled in the nightly CI workflow via --project flag)
 * 5. outputDir configured for test artifacts
 * 6. More granular screenshot/video/trace settings
 */
module.exports = defineConfig({

  // ── Test Discovery ──────────────────────────────────────────────
  testDir: './tests',
  testMatch: '**/*.spec.js',

  // Where Playwright stores screenshots, videos, traces.
  // Each test gets its own subfolder: test-results/{test-title}/
  outputDir: 'test-results',

  // ── Parallelism ─────────────────────────────────────────────────
  // fullyParallel: true = tests within the SAME file run in parallel.
  // Without this, files run in parallel but tests inside a file run serially.
  // This is safe because each test gets its own browser context/page.
  fullyParallel: true,

  // ── Retries ─────────────────────────────────────────────────────
  // CI: 2 retries catches transient network issues.
  // Local: 0 retries — see failures immediately, don't mask them.
  retries: process.env.CI ? 2 : 0,

  // ── Workers ─────────────────────────────────────────────────────
  //
  // Worker decision matrix:
  //
  // | Environment          | Workers | Why                              |
  // |----------------------|---------|----------------------------------|
  // | Local development    | 4       | Fast feedback, typical 4-core dev machine |
  // | CI (no sharding)     | 2       | GitHub Actions runner has 2 cores |
  // | CI (with sharding)   | 2       | 2 workers × 4 shards = 8 parallel |
  //
  // We detect sharding via the SHARD env var (set in GitHub Actions matrix).
  // We detect CI via the CI env var (auto-set by GitHub Actions).
  //
  // IMPORTANT: Setting workers too high on a 2-core CI runner causes
  // context switching overhead that SLOWS tests down, not speeds them up.
  workers: process.env.CI ? 2 : 4,

  // ── Timeout Hierarchy ────────────────────────────────────────────
  // Playwright has 4 independent timeout levels:
  //
  // 1. globalTimeout   — entire suite timeout (failsafe for hung CI jobs)
  // 2. timeout         — single test timeout
  // 3. actionTimeout   — single action (click, fill, etc.)
  // 4. expect.timeout  — single assertion retry period
  //
  // Set each independently. Don't rely on one big timeout to cover everything.
  globalTimeout: process.env.CI ? 15 * 60 * 1_000 : 10 * 60 * 1_000,
  timeout: 30_000,

  expect: {
    // How long expect() retries before failing.
    // 5 seconds is enough for SauceDemo's simple UI transitions.
    timeout: 5_000,
  },

  // ── Reporters ───────────────────────────────────────────────────
  // ── Reporters ───────────────────────────────────────────────────
reporter: [
  [
    'allure-playwright',
    {
      detail: true,
      outputFolder: 'allure-results',
      suiteTitle: true,

      environmentInfo: {
        App_URL: process.env.BASE_URL || 'https://www.saucedemo.com',
        Node_Version: process.version,
        Platform: process.platform,
        Environment: process.env.CI
          ? 'CI / GitHub Actions'
          : 'Local Development',
        Playwright_Version: (() => {
          try {
            return require('@playwright/test/package.json').version;
          } catch {
            return 'unknown';
          }
        })(),
        Branch: process.env.GITHUB_REF_NAME || 'local',
        Commit_SHA: process.env.GITHUB_SHA
          ? process.env.GITHUB_SHA.substring(0, 7)
          : 'local',
        Run_ID: process.env.GITHUB_RUN_ID || 'local',
        Test_Suite: 'PlaywrightHub E2E Suite',
      },

      categories: (() => {
        try {
          return require('./allure-results/categories.json');
        } catch {
          return undefined;
        }
      })(),
    },
  ],

  ['html', { outputFolder: 'playwright-report', open: 'never' }],
  ['list'],

  // Always create results.json
  ['json', { outputFile: 'results.json' }],
],

  // ── Global Use Settings ──────────────────────────────────────────
  // These apply to ALL projects unless a project overrides them.
  use: {
    // baseURL means page.goto('/inventory.html') works without full URL
    baseURL: process.env.BASE_URL || 'https://www.saucedemo.com',

    // Screenshots: capture on failure only (saves disk space)
    screenshot: 'only-on-failure',

    // Video: retain only for failing tests
    // Allows frame-by-frame replay of what went wrong
    video: 'retain-on-failure',

    // Trace: record on the FIRST retry of a failing test.
    // A trace contains: network requests, DOM snapshots, console logs,
    // screenshots at each action — everything you need to debug a flake.
    // 'on-first-retry' means: record when we retry (flaky indicator),
    // not on a clean first-run failure (would be too much data).
    trace: 'on-first-retry',

    // Action timeout: how long a single action has before giving up.
    // 10s is generous for SauceDemo but not infinite.
    actionTimeout: 10_000,

    // Navigation timeout: how long page.goto() / waitForURL() waits.
    // 15s handles the performance_glitch_user's deliberate 5s delay.
    navigationTimeout: 15_000,

    // Locale: set explicitly for consistent date/number formatting in tests
    locale: 'en-US',

    // Timezone: set explicitly so time-based assertions are reproducible
    timezoneId: 'America/New_York',

    // Viewport: standard desktop size, consistent across all workers
    viewport: { width: 1280, height: 720 },

    // ignoreHTTPSErrors: false (default) — we WANT to know about cert errors
    ignoreHTTPSErrors: false,
  },

  // ── Global Hooks ────────────────────────────────────────────────
  globalSetup: require.resolve('./src/setup/globalSetup.js'),
  globalTeardown: require.resolve('./src/setup/globalTeardown.js'),

  // ── Projects ────────────────────────────────────────────────────
  //
  // PROJECT ARCHITECTURE:
  //
  // ┌─────────────────┬────────────────────┬───────────────────────┐
  // │ Project         │ Tests Included     │ Auth State            │
  // ├─────────────────┼────────────────────┼───────────────────────┤
  // │ chromium        │ Non-auth tests     │ .auth/user.json       │
  // │ no-auth         │ Auth tests only    │ None (clean browser)  │
  // │ firefox         │ Non-auth tests     │ .auth/user.json       │
  // │ webkit          │ Non-auth tests     │ .auth/user.json       │
  // └─────────────────┴────────────────────┴───────────────────────┘
  //
  // Firefox and WebKit are commented out for day-to-day development.
  // Uncomment them in the nightly CI workflow by passing:
  //   npx playwright test --project=chromium --project=firefox --project=webkit
  //
  projects: [
    // ── Primary: Chromium with stored auth ──────────────────────
    {
      name: 'chromium',
      use: {
        ...devices['Desktop Chrome'],
        // Each test context loads this file → starts already logged in.
        // Playwright reads storageState per-context, so each worker's
        // test contexts are independent (no shared cookie jar).
        storageState: '.auth/user.json',
        launchOptions: {
          args: ['--disable-gpu'],
        },
      },
      // Exclude auth tests — they must run without a stored session
      testIgnore: ['**/auth/**'],
    },

    // ── No-Auth: Chromium without session (for login tests) ──────
    {
      name: 'no-auth',
      use: {
        ...devices['Desktop Chrome'],
        // Explicitly undefined — no storageState loaded.
        // Tests start with a completely clean browser context.
        storageState: undefined,
        launchOptions: {
          args: ['--disable-gpu'],
        },
      },
      // Only run auth tests in this project
      testMatch: ['**/auth/**'],
    },

    // ── Firefox: cross-browser (nightly only) ───────────────────
    // {
    //   name: 'firefox',
    //   use: {
    //     ...devices['Desktop Firefox'],
    //     storageState: '.auth/user.json',
    //   },
    //   testIgnore: ['**/auth/**'],
    // },

    // ── WebKit: Safari engine (nightly only) ────────────────────
    // {
    //   name: 'webkit',
    //   use: {
    //     ...devices['Desktop Safari'],
    //     storageState: '.auth/user.json',
    //   },
    //   testIgnore: ['**/auth/**'],
    // },
  ],
});