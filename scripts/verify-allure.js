// path: scripts/verify-allure.js

/**
 * verify-allure.js — Verify Allure results integrity.
 *
 * Run after 'npx playwright test' to confirm:
 * 1. allure-results/ directory was created
 * 2. Result files were generated (one per test)
 * 3. Each result file is valid JSON with required fields
 * 4. Attachment files referenced in results actually exist
 * 5. Summary: how many tests passed/failed according to Allure data
 *
 * This runs as part of 'npm run report:verify' and in CI before
 * uploading the artifact (catches corrupt data before upload).
 */

'use strict';

const fs = require('fs');
const path = require('path');

const ALLURE_RESULTS = path.resolve('allure-results');

console.log('\n[verify-allure] ───────────────────────────────────');
console.log('[verify-allure] Verifying Allure results integrity...\n');

// ── Check directory exists ──────────────────────────────────────
if (!fs.existsSync(ALLURE_RESULTS)) {
  console.error('[verify-allure] FAIL: allure-results/ directory not found.');
  console.error('[verify-allure] Run "npx playwright test" first.');
  process.exit(1);
}

// ── Find all result files ───────────────────────────────────────
const allFiles = fs.readdirSync(ALLURE_RESULTS);
const resultFiles = allFiles.filter(f => f.endsWith('-result.json'));
const attachmentFiles = new Set(allFiles.filter(f => !f.endsWith('-result.json')));

if (resultFiles.length === 0) {
  console.error('[verify-allure] FAIL: No result files found in allure-results/');
  process.exit(1);
}

console.log(`[verify-allure] Found ${resultFiles.length} result files and ${attachmentFiles.size} attachment files.\n`);

// ── Validate each result file ───────────────────────────────────
const stats = { valid: 0, invalid: 0, passed: 0, failed: 0, broken: 0, skipped: 0 };
const issues = [];

for (const file of resultFiles) {
  const filePath = path.join(ALLURE_RESULTS, file);

  let result;
  try {
    const raw = fs.readFileSync(filePath, 'utf-8');
    result = JSON.parse(raw);
  } catch (err) {
    stats.invalid++;
    issues.push(`INVALID JSON: ${file} — ${err.message}`);
    continue;
  }

  // Check required fields
  const requiredFields = ['uuid', 'name', 'status', 'stage'];
  const missingFields = requiredFields.filter(f => !result[f]);

  if (missingFields.length > 0) {
    stats.invalid++;
    issues.push(`MISSING FIELDS in ${file}: ${missingFields.join(', ')}`);
    continue;
  }

  // Count by status
  stats.valid++;
  const status = result.status?.toLowerCase();
  if (status === 'passed') stats.passed++;
  else if (status === 'failed') stats.failed++;
  else if (status === 'broken') stats.broken++;
  else if (status === 'skipped') stats.skipped++;

  // Check that referenced attachments exist
  for (const attachment of result.attachments || []) {
    if (attachment.source && !attachmentFiles.has(attachment.source)) {
      issues.push(`MISSING ATTACHMENT: ${attachment.name} (${attachment.source}) in ${file}`);
    }
  }
}

// ── Print results ───────────────────────────────────────────────
console.log('[verify-allure] ═══ ALLURE RESULTS SUMMARY ═══');
console.log(`[verify-allure]  Valid result files:   ${stats.valid}`);
console.log(`[verify-allure]  Invalid result files: ${stats.invalid}`);
console.log(`[verify-allure]  Passed:  ${stats.passed}`);
console.log(`[verify-allure]  Failed:  ${stats.failed}`);
console.log(`[verify-allure]  Broken:  ${stats.broken}`);
console.log(`[verify-allure]  Skipped: ${stats.skipped}`);
console.log('[verify-allure] ════════════════════════════════\n');

if (issues.length > 0) {
  console.warn('[verify-allure] Issues found:');
  issues.forEach(issue => console.warn(`  • ${issue}`));
  console.warn('');
}

// ── Check key files ─────────────────────────────────────────────
const keyFiles = [
  { name: 'categories.json',          required: false },
  { name: 'environment.properties',   required: false },
];

for (const { name, required } of keyFiles) {
  const exists = fs.existsSync(path.join(ALLURE_RESULTS, name));
  const status = exists ? '✓' : (required ? '✗ MISSING (required)' : '○ not present (optional)');
  console.log(`[verify-allure]  ${name}: ${status}`);
}

// ── Final verdict ───────────────────────────────────────────────
console.log('');
if (stats.invalid > 0) {
  console.error('[verify-allure] FAIL: Invalid result files detected.');
  process.exit(1);
} else if (stats.valid === 0) {
  console.error('[verify-allure] FAIL: No valid result files.');
  process.exit(1);
} else {
  console.log(`[verify-allure] PASS: All ${stats.valid} result files are valid. ✓`);
  console.log('[verify-allure] ───────────────────────────────────\n');
  process.exit(0);
}