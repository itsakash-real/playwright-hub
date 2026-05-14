// path: scripts/generate-report.js

/**
 * generate-report.js — Smart Allure report generation.
 *
 * Why a script instead of just running 'allure generate'?
 *
 * 1. Pre-flight checks: validates allure-results has data before generating
 * 2. Environment file: writes environment.properties to allure-results
 *    (Allure reads this file during generation, not from playwright.config.js)
 * 3. Categories file: copies categories.json to allure-results if missing
 * 4. History preservation: copies allure-report/history to allure-results/history
 *    before generating, so the new report shows historical trend data
 * 5. Post-generation summary: logs the report path and file count
 *
 * HISTORY TREND EXPLAINED:
 * Allure's "Trend" charts show pass rates over time. This requires
 * the previous run's history data to be present when generating the
 * new report. We copy allure-report/history → allure-results/history
 * before each generation. In CI, we achieve this by:
 *   1. Downloading the previous Allure report artifact
 *   2. Copying its /history folder into allure-results/
 *   3. Running allure generate
 * The workflow in Phase 7 handles this automatically.
 */

'use strict';

require('dotenv').config();

const { execSync, spawnSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const ALLURE_RESULTS = path.resolve('allure-results');
const ALLURE_REPORT  = path.resolve('allure-report');
const CATEGORIES_SRC = path.resolve('allure-results', 'categories.json');

// ─────────────────────────────────────────────────────────────────
// STEP 1: Validate allure-results has data
// ─────────────────────────────────────────────────────────────────
console.log('\n[generate-report] ──────────────────────────────────');
console.log('[generate-report] Preparing Allure report generation...\n');

if (!fs.existsSync(ALLURE_RESULTS)) {
  console.error('[generate-report] ERROR: allure-results/ directory not found.');
  console.error('[generate-report] Run "npx playwright test" first to generate results.');
  process.exit(1);
}

const resultFiles = fs.readdirSync(ALLURE_RESULTS)
  .filter(f => f.endsWith('-result.json'));

if (resultFiles.length === 0) {
  console.error('[generate-report] ERROR: No result files found in allure-results/');
  console.error('[generate-report] Ensure tests ran with allure-playwright reporter active.');
  process.exit(1);
}

console.log(`[generate-report] Found ${resultFiles.length} result file(s) to process.`);

// ─────────────────────────────────────────────────────────────────
// STEP 2: Write environment.properties
// ─────────────────────────────────────────────────────────────────
// Allure reads environment.properties from allure-results/ at generation time.
// This is SEPARATE from the environmentInfo in playwright.config.js —
// allure-playwright writes the config values to a JSON file, but the
// environment.properties format is what Allure uses for the Environment widget.
// We write both for maximum compatibility.

const envProperties = [
  `App_URL=${process.env.BASE_URL || 'https://www.saucedemo.com'}`,
  `Node_Version=${process.version}`,
  `Platform=${process.platform}`,
  `Environment=${process.env.CI ? 'CI / GitHub Actions' : 'Local Development'}`,
  `Branch=${process.env.GITHUB_REF_NAME || 'local'}`,
  `Commit_SHA=${process.env.GITHUB_SHA ? process.env.GITHUB_SHA.substring(0, 7) : 'local'}`,
  `Run_ID=${process.env.GITHUB_RUN_ID || 'local'}`,
  `Test_Suite=PlaywrightHub E2E Suite`,
  `Generated_At=${new Date().toISOString()}`,
].join('\n');

const envPropertiesPath = path.join(ALLURE_RESULTS, 'environment.properties');
fs.writeFileSync(envPropertiesPath, envProperties, 'utf-8');
console.log('[generate-report] environment.properties written ✓');

// ─────────────────────────────────────────────────────────────────
// STEP 3: Ensure categories.json is in allure-results/
// ─────────────────────────────────────────────────────────────────
const categoriesSrc = path.resolve('allure-results', 'categories.json');

// If categories.json is not in allure-results/, copy it there.
// This handles the case where it was deleted or never existed.
if (!fs.existsSync(categoriesSrc)) {
  // Try to copy from the project-level file we created
  const projectCategories = path.resolve('allure-results', 'categories.json');
  if (fs.existsSync(projectCategories)) {
    fs.copyFileSync(projectCategories, path.join(ALLURE_RESULTS, 'categories.json'));
    console.log('[generate-report] categories.json copied to allure-results/ ✓');
  } else {
    console.warn('[generate-report] WARNING: categories.json not found — using Allure defaults.');
  }
} else {
  console.log('[generate-report] categories.json present ✓');
}

// ─────────────────────────────────────────────────────────────────
// STEP 4: Preserve history for trend charts
// ─────────────────────────────────────────────────────────────────
// If a previous report exists, copy its history into allure-results/
// so the new report can show historical trends.
const prevHistoryDir = path.join(ALLURE_REPORT, 'history');
const newHistoryDir  = path.join(ALLURE_RESULTS, 'history');

if (fs.existsSync(prevHistoryDir)) {
  // Remove any existing history in allure-results (stale from last run)
  if (fs.existsSync(newHistoryDir)) {
    fs.rmSync(newHistoryDir, { recursive: true });
  }
  // Copy previous report's history into allure-results
  fs.cpSync(prevHistoryDir, newHistoryDir, { recursive: true });
  console.log('[generate-report] Previous history preserved for trend charts ✓');
} else {
  console.log('[generate-report] No previous report found — trend chart will start fresh.');
}

// ─────────────────────────────────────────────────────────────────
// STEP 5: Run allure generate
// ─────────────────────────────────────────────────────────────────
console.log('\n[generate-report] Running: allure generate...');

// Check if allure CLI is available
const allureCheck = spawnSync('allure', ['--version'], { encoding: 'utf-8' });
const allureVersion = allureCheck.stdout?.trim();

if (allureCheck.error || !allureVersion) {
  console.error('[generate-report] ERROR: allure CLI not found.');
  console.error('[generate-report] Install it with: npm install -g allure-commandline');
  console.error('[generate-report] Or use: npx allure generate (slower but no global install needed)');
  process.exit(1);
}

console.log(`[generate-report] Allure CLI version: ${allureVersion}`);

try {
  // --clean removes the old report before generating the new one.
  // Without --clean, old test data can bleed into the new report.
  execSync(
    `allure generate "${ALLURE_RESULTS}" -o "${ALLURE_REPORT}" --clean`,
    {
      stdio: 'inherit', // Stream allure's output directly to our terminal
      encoding: 'utf-8',
    }
  );
} catch (err) {
  console.error('[generate-report] allure generate failed:', err.message);
  process.exit(1);
}

// ─────────────────────────────────────────────────────────────────
// STEP 6: Post-generation summary
// ─────────────────────────────────────────────────────────────────
const reportIndex = path.join(ALLURE_REPORT, 'index.html');

if (fs.existsSync(reportIndex)) {
  // Count generated files as a proxy for report completeness
  const reportFiles = fs.readdirSync(ALLURE_REPORT).length;

  console.log('\n[generate-report] ──────────────────────────────────');
  console.log('[generate-report] Report generated successfully! ✓');
  console.log(`[generate-report] Location: ${ALLURE_REPORT}`);
  console.log(`[generate-report] Files:    ${reportFiles} files generated`);
  console.log('[generate-report] Open with: npm run report:open');
  console.log('[generate-report] ──────────────────────────────────\n');
} else {
  console.error('[generate-report] ERROR: index.html not found after generation.');
  console.error('[generate-report] The allure generate command may have failed silently.');
  process.exit(1);
}