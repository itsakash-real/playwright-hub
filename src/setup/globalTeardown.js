// path: src/setup/globalTeardown.js

require('dotenv').config();

const fs = require('fs');
const path = require('path');

/**
 * globalTeardown — Runs ONCE after the entire test suite finishes.
 *
 * Phase 4 improvements over Phase 1:
 * 1. Full recursive results parser — handles Playwright's nested JSON structure
 * 2. FailureRegistry — a structured in-memory record of all failures
 *    with full context (test title, error, stack, browser, duration)
 * 3. Summary report written to disk — useful for downstream tooling
 * 4. Failure data written to a structured JSON file for Phase 6 GitHub integration
 * 5. Exit code awareness — if tests failed, teardown logs it clearly
 *
 * DATA FLOW:
 *   Playwright JSON reporter → results.json
 *   globalTeardown reads results.json → builds FailureRegistry
 *   FailureRegistry written to failures.json
 *   Phase 6: globalTeardown reads failures.json → creates GitHub Issues
 */
async function globalTeardown() {
  console.info('\n[globalTeardown] ──────────────────────────────────');
  console.info('[globalTeardown] Running post-suite teardown...');

  const resultsPath = path.resolve('results.json');
  const failuresOutputPath = path.resolve('failures.json');

  // ── Parse Results ──────────────────────────────────────────────
  const results = readResultsFile(resultsPath);
  if (!results) {
    console.warn('[globalTeardown] No results to process. Exiting teardown.');
    console.info('[globalTeardown] ──────────────────────────────────\n');
    return;
  }

  // ── Build Summary ──────────────────────────────────────────────
  const summary = buildSummary(results);

  // ── Log Summary Table ──────────────────────────────────────────
  logSummaryTable(summary);

  // ── Write failures.json for Phase 6 ───────────────────────────
  // This file is the input to the GitHub Issue creation step.
  // We write it even if there are no failures (empty array) so Phase 6
  // can always assume the file exists.
  writeFailuresFile(failuresOutputPath, summary);

  // ── Phase 6 Hook ──────────────────────────────────────────────
  // This is where we'll call githubClient.js in Phase 6.
  // The structure is set up so adding it requires minimal changes.
  if (summary.failed > 0 && process.env.GITHUB_TOKEN) {
    console.info(
      `[globalTeardown] ${summary.failed} failure(s) detected. ` +
        `GitHub Issue creation will be added in Phase 6.`
    );
    // Phase 6 adds: await createGithubIssues(summary.failures);
  } else if (summary.failed > 0) {
    console.warn(
      `[globalTeardown] ${summary.failed} failure(s) detected but ` +
        `GITHUB_TOKEN is not set — skipping issue creation.`
    );
  }

  console.info('[globalTeardown] ──────────────────────────────────\n');
}

// ─────────────────────────────────────────────────────────────────
// PRIVATE HELPER FUNCTIONS
// ─────────────────────────────────────────────────────────────────

/**
 * Read and parse the Playwright JSON results file.
 *
 * @param {string} filePath - Absolute path to results.json
 * @returns {Object|null} Parsed results object, or null if unreadable
 */
function readResultsFile(filePath) {
  if (!fs.existsSync(filePath)) {
    console.warn(`[globalTeardown] results.json not found at: ${filePath}`);
    console.warn('[globalTeardown] Was the JSON reporter active?');
    return null;
  }

  try {
    const raw = fs.readFileSync(filePath, 'utf-8');
    return JSON.parse(raw);
  } catch (err) {
    console.error(`[globalTeardown] Failed to parse results.json: ${err.message}`);
    return null;
  }
}

/**
 * Playwright JSON results have a deeply nested structure:
 *
 *   results
 *     .suites[]           ← spec files
 *       .suites[]         ← describe() blocks (can be nested)
 *         .specs[]        ← individual test() calls
 *           .tests[]      ← runs (one per project/browser)
 *             .results[]  ← attempts (one per retry)
 *
 * We recursively walk this tree to extract a flat list of test outcomes.
 *
 * @typedef {Object} TestResult
 * @property {string} title         - Short test name
 * @property {string} fullTitle     - Full path: Suite > Describe > Test
 * @property {string} status        - 'passed' | 'failed' | 'timedOut' | 'skipped'
 * @property {string} browser       - Browser project name (e.g., 'chromium')
 * @property {number} duration      - Test duration in milliseconds
 * @property {string|null} error    - Error message (if failed)
 * @property {string|null} stack    - Stack trace (if failed, truncated to 2000 chars)
 * @property {string} specFile      - The spec file path
 * @property {number} retries       - Number of retries before final result
 *
 * @param {Object} results - Raw Playwright JSON results object
 * @returns {{ passed: number, failed: number, skipped: number, failures: TestResult[] }}
 */
function buildSummary(results) {
  const allTests = [];

  /**
   * Recursively collect specs from a suite tree.
   * @param {Object[]} suites - Array of suite objects
   * @param {string} suitePath - Accumulated breadcrumb path
   * @param {string} specFile - The spec file this suite belongs to
   */
  function walkSuites(suites, suitePath = '', specFile = '') {
    for (const suite of suites || []) {
      // Build the current path breadcrumb
      const currentPath = suitePath
        ? `${suitePath} > ${suite.title}`
        : suite.title;

      // The spec file is the root suite's file property
      const currentSpecFile = suite.file || specFile;

      // Recurse into nested describe() blocks
      if (suite.suites && suite.suites.length > 0) {
        walkSuites(suite.suites, currentPath, currentSpecFile);
      }

      // Process specs (individual test() calls) in this suite
      for (const spec of suite.specs || []) {
        // Each spec can have multiple "tests" — one per project (browser)
        for (const testRun of spec.tests || []) {
          if (!testRun.results || testRun.results.length === 0) continue;

          // The last result is the definitive outcome after all retries
          const lastResult = testRun.results[testRun.results.length - 1];
          const retryCount = testRun.results.length - 1;

          // Extract error info if the test failed
          let errorMessage = null;
          let stackTrace = null;

          if (lastResult.error) {
            errorMessage = lastResult.error.message || 'Unknown error';
            // Truncate stack traces — they can be very long and we only
            // need the first 2000 chars for GitHub Issues
            stackTrace = lastResult.error.stack
              ? lastResult.error.stack.substring(0, 2000)
              : null;
          }

          allTests.push({
            title: spec.title,
            fullTitle: `${currentPath} > ${spec.title}`,
            status: lastResult.status, // 'passed' | 'failed' | 'timedOut' | 'skipped'
            browser: testRun.projectName || 'unknown',
            duration: lastResult.duration || 0,
            error: errorMessage,
            stack: stackTrace,
            specFile: currentSpecFile,
            retries: retryCount,
          });
        }
      }
    }
  }

  walkSuites(results.suites);

  // Categorize tests by status
  const passed = allTests.filter((t) => t.status === 'passed');
  const failed = allTests.filter(
    (t) => t.status === 'failed' || t.status === 'timedOut'
  );
  const skipped = allTests.filter((t) => t.status === 'skipped');
  // Flaky = passed but only after retries
  const flaky = allTests.filter((t) => t.status === 'passed' && t.retries > 0);

  return {
    total: allTests.length,
    passed: passed.length,
    failed: failed.length,
    skipped: skipped.length,
    flaky: flaky.length,
    failures: failed, // Full failure objects for GitHub Issue creation
    flakyTests: flaky,
    duration: results.stats?.duration || 0,
  };
}

/**
 * Print a formatted summary table to the console.
 * This appears in the CI logs after all tests finish.
 *
 * @param {ReturnType<typeof buildSummary>} summary
 */
function logSummaryTable(summary) {
  const durationSec = (summary.duration / 1000).toFixed(1);

  console.info('\n[globalTeardown] ════ TEST SUITE RESULTS ════');
  console.info(`[globalTeardown]  Total:   ${summary.total}`);
  console.info(`[globalTeardown]  Passed:  ${summary.passed} ✓`);
  console.info(`[globalTeardown]  Failed:  ${summary.failed} ${summary.failed > 0 ? '✗' : ''}`);
  console.info(`[globalTeardown]  Skipped: ${summary.skipped}`);
  console.info(`[globalTeardown]  Flaky:   ${summary.flaky} (passed after retry)`);
  console.info(`[globalTeardown]  Duration: ${durationSec}s`);
  console.info('[globalTeardown] ══════════════════════════════');

  if (summary.failures.length > 0) {
    console.info('\n[globalTeardown] ═══ FAILED TESTS ═══');
    summary.failures.forEach((f, i) => {
      console.info(`[globalTeardown]  ${i + 1}. ${f.fullTitle}`);
      console.info(`[globalTeardown]     Browser: ${f.browser}`);
      console.info(`[globalTeardown]     Status:  ${f.status}`);
      console.info(`[globalTeardown]     Error:   ${f.error?.split('\n')[0] || 'N/A'}`);
      if (f.retries > 0) {
        console.info(`[globalTeardown]     Retries: ${f.retries}`);
      }
    });
    console.info('[globalTeardown] ════════════════════════');
  }

  if (summary.flakyTests.length > 0) {
    console.info('\n[globalTeardown] ═══ FLAKY TESTS (passed after retry) ═══');
    summary.flakyTests.forEach((f) => {
      console.info(`[globalTeardown]  • ${f.fullTitle} (${f.retries} retries)`);
    });
  }
}

/**
 * Write the structured failure data to failures.json.
 * This file is consumed by Phase 6's GitHub Issue creation logic.
 *
 * @param {string} outputPath - Where to write failures.json
 * @param {ReturnType<typeof buildSummary>} summary
 */
function writeFailuresFile(outputPath, summary) {
  const output = {
    timestamp: new Date().toISOString(),
    runUrl: process.env.GITHUB_SERVER_URL && process.env.GITHUB_RUN_ID
      ? `${process.env.GITHUB_SERVER_URL}/${process.env.GITHUB_OWNER}/${process.env.GITHUB_REPO}/actions/runs/${process.env.GITHUB_RUN_ID}`
      : 'local',
    summary: {
      total: summary.total,
      passed: summary.passed,
      failed: summary.failed,
      skipped: summary.skipped,
      flaky: summary.flaky,
    },
    failures: summary.failures.map((f) => ({
      title: f.title,
      fullTitle: f.fullTitle,
      browser: f.browser,
      status: f.status,
      duration: f.duration,
      error: f.error,
      stack: f.stack,
      specFile: f.specFile,
      retries: f.retries,
      // Feature extraction: derive from the spec file path
      // e.g., 'tests/checkout/checkout.spec.js' → 'checkout'
      feature: extractFeature(f.specFile),
    })),
  };

  try {
    fs.writeFileSync(outputPath, JSON.stringify(output, null, 2), 'utf-8');
    console.info(`[globalTeardown] Failure data written to: ${outputPath}`);
  } catch (err) {
    console.error(`[globalTeardown] Failed to write failures.json: ${err.message}`);
  }
}

/**
 * Extract a feature name from a spec file path.
 * Used to auto-label GitHub Issues with the affected feature.
 *
 * Examples:
 *   'tests/checkout/checkout.spec.js' → 'checkout'
 *   'tests/auth/login.spec.js'        → 'auth'
 *   'tests/e2e/happyPath.spec.js'     → 'e2e'
 *
 * @param {string} specFile
 * @returns {string}
 */
function extractFeature(specFile) {
  if (!specFile) return 'unknown';
  const parts = specFile.replace(/\\/g, '/').split('/');
  // The feature is the directory name one level above the spec file
  // tests/checkout/checkout.spec.js → parts = ['tests', 'checkout', 'checkout.spec.js']
  // We want 'checkout' → parts[parts.length - 2]
  return parts.length >= 2 ? parts[parts.length - 2] : 'unknown';
}

module.exports = globalTeardown;