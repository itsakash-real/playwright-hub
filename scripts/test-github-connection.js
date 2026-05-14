// path: scripts/test-github-connection.js

/**
 * test-github-connection.js — Manual GitHub API connection verifier.
 *
 * Run this BEFORE pushing to CI to verify:
 *   ✓ GITHUB_TOKEN is valid and not expired
 *   ✓ Token has 'repo' scope for issue creation
 *   ✓ GITHUB_OWNER/GITHUB_REPO point to an accessible repo
 *   ✓ Rate limit has headroom
 *
 * Usage:
 *   node scripts/test-github-connection.js
 *
 * What it does NOT do:
 *   - It does NOT create any issues
 *   - It does NOT modify anything in the repo
 *   - It only makes read-only API calls (except the dry-run test)
 */

'use strict';

require('dotenv').config();

const { testConnection, ensureLabelsExist } = require('../src/utils/githubClient');

async function main() {
  console.log('\n╔══════════════════════════════════════════════════╗');
  console.log('║     PlaywrightHub — GitHub Connection Test        ║');
  console.log('╚══════════════════════════════════════════════════╝\n');

  // ── Print current config (redact token) ────────────────────────
  const token = process.env.GITHUB_TOKEN || '';
  const redactedToken = token
    ? `${token.substring(0, 7)}...${token.substring(token.length - 4)}`
    : '(not set)';

  console.log('Configuration:');
  console.log(`  GITHUB_TOKEN:  ${redactedToken}`);
  console.log(`  GITHUB_OWNER:  ${process.env.GITHUB_OWNER || '(not set)'}`);
  console.log(`  GITHUB_REPO:   ${process.env.GITHUB_REPO  || '(not set)'}`);
  console.log('');

  // ── Run connection tests ────────────────────────────────────────
  console.log('Running connection tests...\n');
  const status = await testConnection();

  // ── Print results ───────────────────────────────────────────────
  console.log('\n── Results ──────────────────────────────────────────');
  console.log(`  Token present:       ${status.tokenPresent  ? '✓' : '✗'}`);
  console.log(`  Token valid:         ${status.tokenValid    ? '✓' : '✗'}`);
  console.log(`  Repo accessible:     ${status.repoAccessible ? '✓' : '✗'}`);
  console.log(`  Issue access:        ${status.canCreateIssues ? '✓' : '✗'}`);
  console.log(`  Authenticated as:    ${status.user || 'N/A'}`);
  console.log(`  Repository:          ${status.repo || 'N/A'}`);
  console.log(
    `  Rate limit:          ${
      status.rateLimitRemaining !== null
        ? `${status.rateLimitRemaining}/5000 remaining`
        : 'N/A'
    }`
  );

  if (status.errors.length > 0) {
    console.log('\n── Errors ───────────────────────────────────────────');
    status.errors.forEach((err) => console.log(`  ✗ ${err}`));
  }

  // ── Label setup dry run ─────────────────────────────────────────
  if (status.tokenValid && status.repoAccessible) {
    console.log('\n── Label Setup ──────────────────────────────────────');
    console.log('Ensuring required labels exist in the repo...');

    try {
      await ensureLabelsExist(
        process.env.GITHUB_OWNER,
        process.env.GITHUB_REPO
      );
      console.log('  ✓ All labels are ready');
    } catch (err) {
      console.log(`  ✗ Label setup failed: ${err.message}`);
    }
  }

  // ── Final verdict ───────────────────────────────────────────────
  console.log('\n── Verdict ──────────────────────────────────────────');

  const allPassed =
    status.tokenValid &&
    status.repoAccessible &&
    status.canCreateIssues;

  if (allPassed) {
    console.log('  ✅ All checks passed!');
    console.log(
      '  Auto GitHub Issue creation will work correctly in CI.\n'
    );
    process.exit(0);
  } else {
    console.log('  ❌ Some checks failed — review errors above.');
    console.log('  Issues will NOT be created until these are resolved.\n');
    process.exit(1);
  }
}

main().catch((err) => {
  console.error('\nUnexpected error running connection test:', err.message);
  process.exit(1);
});