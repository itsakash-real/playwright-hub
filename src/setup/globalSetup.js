// path: src/setup/globalSetup.js

require('dotenv').config();

const { chromium } = require('@playwright/test');
const path = require('path');
const fs = require('fs');

/**
 * globalSetup — Runs ONCE before the entire test suite.
 *
 * Phase 4 improvements over Phase 1:
 * 1. Pre-flight environment validation — fail early with clear messages
 * 2. Auth state freshness check — skip re-login if state is < 1 hour old
 * 3. Retry logic — if login fails, try once more before giving up
 * 4. Verification step — after saving state, verify it actually works
 * 5. Detailed timing logs — visible in CI output for performance tracking
 * 6. Graceful cleanup — browser always closed, even on error
 *
 * WHY "ONCE BEFORE ALL" INSTEAD OF "ONCE PER WORKER"?
 * Playwright's globalSetup runs in the main process, before workers start.
 * This means we log in once, save the cookie file, and ALL workers read
 * that same file. We save (N workers × login time) on every run.
 *
 * On a 4-worker run: 4 × 2s login = 8s saved per run.
 * Across 100 CI runs: 800s = 13 minutes saved.
 */
async function globalSetup() {
  const setupStart = Date.now();
  console.info('\n[globalSetup] ─────────────────────────────────────');
  console.info('[globalSetup] Starting pre-suite setup...');

  // ── Step 1: Validate environment ──────────────────────────────
  validateEnvironment();

  const { BASE_URL, SAUCE_USERNAME, SAUCE_PASSWORD } = process.env;
  const baseURL = BASE_URL || 'https://www.saucedemo.com';
  const authStatePath = path.resolve('.auth/user.json');

  // ── Step 2: Ensure .auth directory exists ─────────────────────
  const authDir = path.dirname(authStatePath);
  if (!fs.existsSync(authDir)) {
    fs.mkdirSync(authDir, { recursive: true });
    console.info(`[globalSetup] Created auth directory: ${authDir}`);
  }

  // ── Step 3: Check if existing auth state is still fresh ───────
  // If we ran tests less than 1 hour ago and the file exists,
  // reuse the existing auth state instead of logging in again.
  // This saves ~2 seconds on local re-runs during active development.
  if (isAuthStateFresh(authStatePath, 60)) {
    console.info('[globalSetup] Auth state is fresh (< 60 min old) — reusing.');
    try {
      await verifyAuthState(baseURL, authStatePath);
      console.info('[globalSetup] ─────────────────────────────────────\n');
      return;
    } catch (err) {
      console.info('[globalSetup] Saved auth state is invalid. Proceeding to new login...');
    }
  }

  // ── Step 4: Perform login with retry ──────────────────────────
  console.info(`[globalSetup] Logging in as: ${SAUCE_USERNAME}`);
  console.info(`[globalSetup] Target URL: ${baseURL}`);

  let authSaved = false;
  let lastError = null;

  // Attempt login up to 2 times — catches transient connection issues
  for (let attempt = 1; attempt <= 2; attempt++) {
    if (attempt > 1) {
      console.info(`[globalSetup] Retry attempt ${attempt}/2 after 3 seconds...`);
      await sleep(3_000);
    }

    try {
      await performLogin(baseURL, SAUCE_USERNAME, SAUCE_PASSWORD, authStatePath);
      authSaved = true;
      break; // Success — exit retry loop
    } catch (err) {
      lastError = err;
      console.warn(`[globalSetup] Attempt ${attempt} failed: ${err.message}`);
    }
  }

  if (!authSaved) {
    // Both attempts failed — throw with full context
    throw new Error(
      `[globalSetup] Login failed after 2 attempts.\n` +
        `Last error: ${lastError?.message}\n` +
        `Username: ${SAUCE_USERNAME}\n` +
        `URL: ${baseURL}\n` +
        `Hint: Verify SAUCE_USERNAME and SAUCE_PASSWORD in your .env file.`
    );
  }

  // ── Step 5: Verify the saved auth state actually works ────────
  await verifyAuthState(baseURL, authStatePath);

  const duration = ((Date.now() - setupStart) / 1000).toFixed(2);
  console.info(`[globalSetup] Setup complete in ${duration}s`);
  console.info('[globalSetup] ─────────────────────────────────────\n');
}

// ─────────────────────────────────────────────────────────────────
// PRIVATE HELPER FUNCTIONS
// ─────────────────────────────────────────────────────────────────

/**
 * Validate that all required environment variables are present.
 * Throws a clear, actionable error if anything is missing.
 * Called before any browser is launched.
 */
function validateEnvironment() {
  const required = {
    SAUCE_USERNAME: process.env.SAUCE_USERNAME,
    SAUCE_PASSWORD: process.env.SAUCE_PASSWORD,
  };

  const missing = Object.entries(required)
    .filter(([, value]) => !value || value.trim() === '')
    .map(([key]) => key);

  if (missing.length > 0) {
    throw new Error(
      `[globalSetup] Missing required environment variables: ${missing.join(', ')}\n` +
        `Steps to fix:\n` +
        `  1. Copy .env.example to .env: cp .env.example .env\n` +
        `  2. Fill in the missing values in .env\n` +
        `  3. For CI: add these as GitHub Actions secrets\n` +
        `     Settings → Secrets → New repository secret`
    );
  }

  // Warn (don't fail) if GITHUB_TOKEN is missing — needed for Phase 6
  if (!process.env.GITHUB_TOKEN && process.env.CI) {
    console.warn(
      '[globalSetup] WARNING: GITHUB_TOKEN not set. ' +
        'Auto GitHub Issue creation (Phase 6) will not work.'
    );
  }

  console.info('[globalSetup] Environment validation passed ✓');
}

/**
 * Check if the saved auth state file is fresh enough to reuse.
 *
 * @param {string} filePath - Absolute path to the auth state file
 * @param {number} maxAgeMinutes - Max age in minutes before forcing re-login
 * @returns {boolean} True if file exists and is younger than maxAgeMinutes
 */
function isAuthStateFresh(filePath, maxAgeMinutes) {
  if (!fs.existsSync(filePath)) return false;

  const stats = fs.statSync(filePath);
  const ageMs = Date.now() - stats.mtimeMs;
  const ageMinutes = ageMs / (1000 * 60);

  // Also verify the file is valid JSON (not empty or corrupted)
  try {
    const content = fs.readFileSync(filePath, 'utf-8');
    const parsed = JSON.parse(content);
    // A valid auth state has cookies and origins arrays
    if (!parsed.cookies || !parsed.origins) return false;
  } catch {
    return false;
  }

  return ageMinutes < maxAgeMinutes;
}

/**
 * Launch a browser, log in to SauceDemo, and save the auth state.
 *
 * @param {string} baseURL - SauceDemo URL
 * @param {string} username - Login username
 * @param {string} password - Login password
 * @param {string} authStatePath - Where to save the .json auth file
 */
async function performLogin(baseURL, username, password, authStatePath) {
  const loginStart = Date.now();

  // Launch a temporary browser — separate from the test workers' browsers.
  // headless: true — no UI window, runs silently in background.
  const browser = await chromium.launch({
    headless: true,
    // slowMo: 0 — no artificial delay in setup (unlike debug mode)
  });

  // Use a context with no pre-existing state (blank slate)
  const context = await browser.newContext({
    baseURL,
    // Set the same viewport as tests for consistency
    viewport: { width: 1280, height: 720 },
  });

  const page = await context.newPage();

  try {
    // Navigate to the login page
    // Using 'domcontentloaded' because we just need the form to be ready
    await page.goto('/', { waitUntil: 'domcontentloaded' });

    // Verify we're actually on the login page (not redirected to inventory already)
    const loginButton = page.locator('[data-test="login-button"]');
    await loginButton.waitFor({ state: 'visible', timeout: 10_000 });

    // Fill credentials using data-test selectors (same as LoginPage.js)
    await page.locator('[data-test="username"]').fill(username);
    await page.locator('[data-test="password"]').fill(password);
    await loginButton.click();

    // Wait for successful navigation to inventory
    // If login fails, this throws with a timeout — caught by the retry loop
    await page.waitForURL('**/inventory.html', { timeout: 15_000 });

    // Verify we actually landed on inventory (not a redirect loop or error)
    const inventoryList = page.locator('.inventory_list');
    await inventoryList.waitFor({ state: 'visible', timeout: 5_000 });

    // Save the entire browser context state to file
    // This captures: cookies, localStorage, sessionStorage
    await context.storageState({ path: authStatePath });

    const loginDuration = ((Date.now() - loginStart) / 1000).toFixed(2);
    console.info(`[globalSetup] Login successful in ${loginDuration}s`);
    console.info(`[globalSetup] Auth state saved to: ${authStatePath}`);
  } finally {
    // ALWAYS close the browser — even if an error occurred above.
    // Failing to close leaves a zombie process that wastes memory.
    await browser.close();
  }
}

/**
 * Verify that the saved auth state file actually grants access.
 * Loads the file in a new browser context and checks we can reach inventory.
 * Throws if the auth state doesn't work (e.g., session expired mid-setup).
 *
 * @param {string} baseURL
 * @param {string} authStatePath
 */
async function verifyAuthState(baseURL, authStatePath) {
  console.info('[globalSetup] Verifying saved auth state...');

  const browser = await chromium.launch({ headless: true });

  // Load the saved state file into a new context
  const context = await browser.newContext({
    baseURL,
    storageState: authStatePath,
  });

  const page = await context.newPage();

  try {
    // Navigate directly to inventory — should work without login redirect
    await page.goto('/inventory.html', { waitUntil: 'domcontentloaded' });

    // If auth state is valid, we should be on inventory
    // If invalid, SauceDemo redirects to the login page
    const currentURL = page.url();

    if (!currentURL.includes('inventory.html')) {
      throw new Error(
        `Auth state verification failed.\n` +
          `Expected URL to contain 'inventory.html' but got: ${currentURL}\n` +
          `The saved session may be invalid. Deleting auth file and retrying...`
      );
    }

    // Also verify the inventory list loaded (not just the URL)
    const inventoryList = page.locator('.inventory_list');
    await inventoryList.waitFor({ state: 'visible', timeout: 5_000 });

    console.info('[globalSetup] Auth state verification passed ✓');
  } catch (err) {
    // If verification fails, delete the bad auth file so next run starts fresh
    if (fs.existsSync(authStatePath)) {
      fs.unlinkSync(authStatePath);
      console.warn('[globalSetup] Deleted invalid auth state file.');
    }
    throw err;
  } finally {
    await browser.close();
  }
}

/**
 * Simple sleep helper for retry delays.
 * @param {number} ms - Milliseconds to wait
 */
function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

module.exports = globalSetup;