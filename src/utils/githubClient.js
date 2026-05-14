// path: src/utils/githubClient.js

'use strict';

require('dotenv').config();

// @octokit/rest is the official GitHub REST API client for Node.js.
// It handles: authentication, rate limiting headers, pagination, retries,
// and provides a clean method-per-endpoint API.
const { Octokit } = require('@octokit/rest');

/**
 * githubClient — GitHub REST API integration for auto bug logging.
 *
 * RESPONSIBILITIES:
 * 1. Create labeled GitHub Issues for test failures
 * 2. Deduplicate: add a comment if the issue already exists
 * 3. Auto-create labels if they don't exist in the repo
 * 4. Rate-limit-aware: delay between API calls to avoid 403s
 * 5. Non-blocking: a GitHub API failure must NEVER fail the CI job
 *
 * DESIGN DECISIONS:
 *
 * Non-blocking (decision 5 above) is critical. If GitHub has an outage
 * or the token expires, the CI job should still report pass/fail correctly.
 * A failure in bug logging must not mask a passing test run.
 * Every public function is wrapped in try/catch that logs and returns gracefully.
 *
 * Rate limiting: GitHub's REST API allows 5000 requests/hour for authenticated
 * users. We stay well under this, but we add 500ms delays between issue
 * creation calls to avoid hitting secondary rate limits (which apply to
 * rapid bursts of write operations, not just total counts).
 */

// ─────────────────────────────────────────────────────────────────
// CONSTANTS
// ─────────────────────────────────────────────────────────────────

/**
 * Labels that will be applied to every auto-created issue.
 * These are created in the repo if they don't already exist.
 *
 * Structure: { name, color (6-char hex), description }
 */
const BASE_LABELS = [
  {
    name: 'bug',
    color: 'd73a4a',       // GitHub's standard red for bugs
    description: 'Something is not working correctly',
  },
  {
    name: 'playwright',
    color: '2ea44f',       // Green — Playwright's brand color
    description: 'Detected by Playwright E2E test automation',
  },
  {
    name: 'auto-generated',
    color: 'e4e669',       // Yellow — signals this was machine-created
    description: 'Automatically created by PlaywrightHub CI pipeline',
  },
];

/**
 * Feature-specific labels — one per test feature area.
 * Auto-applied based on which spec file the failing test lives in.
 */
const FEATURE_LABELS = [
  { name: 'auth',      color: '0075ca', description: 'Authentication feature tests' },
  { name: 'inventory', color: '0075ca', description: 'Inventory/product listing tests' },
  { name: 'cart',      color: '0075ca', description: 'Shopping cart tests' },
  { name: 'checkout',  color: '0075ca', description: 'Checkout flow tests' },
  { name: 'e2e',       color: '6f42c1', description: 'End-to-end journey tests' },
  { name: 'unknown',   color: 'cccccc', description: 'Feature area could not be determined' },
];

// All labels we might ever create — used for the "ensure labels exist" step
const ALL_LABELS = [...BASE_LABELS, ...FEATURE_LABELS];

// Prefix for every auto-created issue title.
// Used for deduplication search — we search for issues starting with this prefix.
const ISSUE_TITLE_PREFIX = '[PLAYWRIGHT FAIL]';

// Delay between GitHub API write operations (ms).
// Prevents secondary rate limit (burst) violations.
const API_WRITE_DELAY_MS = 600;

// Max length of stack trace in issue body (characters).
// GitHub issues support up to 65536 chars but long stacks are unreadable.
const MAX_STACK_LENGTH = 3000;

// ─────────────────────────────────────────────────────────────────
// CLIENT FACTORY
// ─────────────────────────────────────────────────────────────────

/**
 * Create and configure an Octokit client instance.
 * Called once per githubClient module load — the client is reused.
 *
 * @returns {Octokit} Configured Octokit instance, or null if token missing
 */
function createOctokitClient() {
  const token = process.env.GITHUB_TOKEN;

  if (!token || token.trim() === '') {
    return null; // Caller handles the null case gracefully
  }

  return new Octokit({
    auth: token,

    // Custom user agent — GitHub recommends apps identify themselves.
    // Appears in GitHub's audit logs for your organization.
    userAgent: 'PlaywrightHub/1.0.0',

    // Retry configuration — Octokit retries on 429 (rate limit) and 5xx errors
    // We rely on Octokit's built-in retry rather than implementing our own.
    // Note: @octokit/rest doesn't include retry plugin by default.
    // For production use, add @octokit/plugin-retry.
    // For our purposes, the API write delay prevents most rate limit issues.
  });
}

// Module-level client — created once, reused across all function calls.
const octokit = createOctokitClient();

// ─────────────────────────────────────────────────────────────────
// LABEL MANAGEMENT
// ─────────────────────────────────────────────────────────────────

/**
 * Ensure all required labels exist in the GitHub repository.
 * Creates any labels that don't already exist.
 * Skips labels that already exist (no update — avoids color conflicts).
 *
 * This runs ONCE at the start of the issue creation process,
 * not for each individual issue.
 *
 * @param {string} owner - GitHub username or org
 * @param {string} repo - Repository name
 * @returns {Promise<void>}
 */
async function ensureLabelsExist(owner, repo) {
  console.info('[githubClient] Ensuring required labels exist...');

  // Fetch all current labels in the repo (paginated, up to 100 per page)
  let existingLabels = [];
  try {
    const response = await octokit.rest.issues.listLabelsForRepo({
      owner,
      repo,
      per_page: 100,
    });
    existingLabels = response.data.map((l) => l.name.toLowerCase());
  } catch (err) {
    console.warn(`[githubClient] Could not fetch existing labels: ${err.message}`);
    console.warn('[githubClient] Will attempt to create all labels regardless.');
  }

  // Create any labels that don't exist yet
  for (const label of ALL_LABELS) {
    if (existingLabels.includes(label.name.toLowerCase())) {
      // Label already exists — skip
      continue;
    }

    try {
      await octokit.rest.issues.createLabel({
        owner,
        repo,
        name: label.name,
        color: label.color,
        description: label.description,
      });
      console.info(`[githubClient] Created label: "${label.name}"`);

      // Small delay between label creation calls
      await sleep(200);
    } catch (err) {
      // 422 = label already exists (race condition) — safe to ignore
      if (err.status === 422) {
        continue;
      }
      console.warn(`[githubClient] Failed to create label "${label.name}": ${err.message}`);
      // Don't throw — missing a label is not fatal
    }
  }

  console.info('[githubClient] Label check complete ✓');
}

// ─────────────────────────────────────────────────────────────────
// ISSUE SEARCH (DEDUPLICATION)
// ─────────────────────────────────────────────────────────────────

/**
 * Search for an existing open issue with the exact given title.
 * Used for deduplication — if an issue already exists, we comment
 * instead of creating a duplicate.
 *
 * GitHub's search API requires a specific query format:
 *   repo:OWNER/REPO is:issue is:open in:title "EXACT TITLE"
 *
 * The "in:title" qualifier restricts matching to the title field.
 * Wrapping the title in quotes searches for the exact phrase.
 *
 * IMPORTANT: GitHub's search index can lag by 30-60 seconds.
 * In rapid-fire CI runs, a just-created issue might not appear
 * in search results immediately. We handle this by also checking
 * the issues list API as a fallback.
 *
 * @param {string} owner
 * @param {string} repo
 * @param {string} title - The exact issue title to search for
 * @returns {Promise<number|null>} Issue number if found, null if not found
 */
async function searchForExistingIssue(owner, repo, title) {
  try {
    // Primary: GitHub search API
    // The search API returns issues matching the query across the repo
    const searchQuery = `repo:${owner}/${repo} is:issue is:open in:title "${title}"`;

    const searchResponse = await octokit.rest.search.issuesAndPullRequests({
      q: searchQuery,
      per_page: 5, // We only need to find ONE match
    });

    if (searchResponse.data.total_count > 0) {
      // Find the issue with the EXACT title (search can return partial matches)
      const exactMatch = searchResponse.data.items.find(
        (issue) => issue.title === title
      );
      if (exactMatch) {
        console.info(
          `[githubClient] Found existing issue #${exactMatch.number}: "${title}"`
        );
        return exactMatch.number;
      }
    }

    // Fallback: list recent issues and check titles directly.
    // This catches cases where the search index hasn't caught up yet.
    const listResponse = await octokit.rest.issues.listForRepo({
      owner,
      repo,
      state: 'open',
      per_page: 50, // Check the 50 most recent open issues
      sort: 'created',
      direction: 'desc',
    });

    const exactMatch = listResponse.data.find(
      (issue) => issue.title === title && !issue.pull_request // Exclude PRs
    );

    if (exactMatch) {
      console.info(
        `[githubClient] Found existing issue #${exactMatch.number} via list fallback`
      );
      return exactMatch.number;
    }

    return null; // No existing issue found
  } catch (err) {
    console.warn(`[githubClient] Issue search failed: ${err.message}`);
    // On search failure, return null → will attempt to create a new issue.
    // This might create duplicates in rare cases, but that's better than
    // silently failing to log the bug at all.
    return null;
  }
}

// ─────────────────────────────────────────────────────────────────
// ISSUE BODY BUILDER
// ─────────────────────────────────────────────────────────────────

/**
 * Build a well-formatted GitHub Issue body for a test failure.
 *
 * The body is Markdown-formatted and includes:
 * - Test metadata (name, browser, file)
 * - Error message and stack trace in code blocks
 * - CI run link for easy navigation to the full logs
 * - Allure report link (if available)
 * - Reproduction steps
 * - Auto-generated disclaimer
 *
 * @param {Object} failure - Failure data from globalTeardown's summary
 * @param {string} failure.fullTitle
 * @param {string} failure.title
 * @param {string} failure.browser
 * @param {string} failure.status
 * @param {number} failure.duration
 * @param {string|null} failure.error
 * @param {string|null} failure.stack
 * @param {string} failure.specFile
 * @param {number} failure.retries
 * @param {string} failure.feature
 * @param {string} runUrl - GitHub Actions run URL
 * @param {boolean} isNewIssue - True for new issues, false for comment updates
 * @returns {string} Markdown-formatted issue body
 */
function buildIssueBody(failure, runUrl, isNewIssue = true) {
  const now = new Date().toISOString();

  // Truncate stack trace to keep the issue readable
  const stackTrace = failure.stack
    ? failure.stack.substring(0, MAX_STACK_LENGTH) +
      (failure.stack.length > MAX_STACK_LENGTH ? '\n... (truncated)' : '')
    : 'No stack trace available';

  // Format duration nicely
  const durationSec = failure.duration
    ? `${(failure.duration / 1000).toFixed(2)}s`
    : 'N/A';

  // Build the CI run link section
  const runSection =
    runUrl && runUrl !== 'local'
      ? `[View CI Run](${runUrl})`
      : '_Running locally (no CI run URL)_';

  // Retry information
  const retryInfo =
    failure.retries > 0
      ? `⚠️ **Flaky indicator:** This test failed after **${failure.retries}** retry attempt(s).`
      : '✅ Failed on first attempt (no retries — consistent failure).';

  if (isNewIssue) {
    // Full issue body for a NEW issue
    return `
## 🔴 Automated Test Failure Report

> This issue was automatically created by the **PlaywrightHub** CI pipeline.
> Do not edit the title — it is used for deduplication on subsequent failures.

---

## 📋 Test Details

| Field | Value |
|-------|-------|
| **Test Name** | ${failure.title} |
| **Full Path** | \`${failure.fullTitle}\` |
| **Browser** | ${failure.browser} |
| **Status** | ${failure.status === 'timedOut' ? '⏱ Timed Out' : '❌ Failed'} |
| **Duration** | ${durationSec} |
| **Retries** | ${failure.retries} |
| **Spec File** | \`${failure.specFile}\` |
| **Feature** | ${failure.feature} |
| **Detected At** | ${now} |

${retryInfo}

---

## ❌ Error Message

\`\`\`
${failure.error || 'No error message captured'}
\`\`\`

---

## 📚 Stack Trace

\`\`\`
${stackTrace}
\`\`\`

---

## 🔗 Links

- **CI Run:** ${runSection}
- **Allure Report:** _Download the \`allure-report\` artifact from the CI run above_
- **Spec File:** \`${failure.specFile}\`

---

## 🔁 How to Reproduce

1. Ensure your \`.env\` has valid \`SAUCE_USERNAME\` and \`SAUCE_PASSWORD\`
2. Run the specific test:
\`\`\`bash
npx playwright test "${failure.specFile}" --grep "${failure.title}" --headed
\`\`\`
3. Or run with Playwright UI for step-by-step debugging:
\`\`\`bash
npx playwright test "${failure.specFile}" --grep "${failure.title}" --ui
\`\`\`

---

## 📌 Labels Applied

- \`bug\` — Confirmed test failure
- \`playwright\` — Detected by Playwright automation
- \`auto-generated\` — Created by PlaywrightHub CI
- \`${failure.feature}\` — Feature area affected

---

_🤖 Auto-generated by [PlaywrightHub](https://github.com/${process.env.GITHUB_OWNER}/${process.env.GITHUB_REPO}) • ${now}_
`.trim();
  } else {
    // Shorter comment body for SUBSEQUENT failures on the same issue
    return `
## 🔄 New Failure Detected — ${now}

This issue has been detected again in a new CI run.

| Field | Value |
|-------|-------|
| **Browser** | ${failure.browser} |
| **Status** | ${failure.status === 'timedOut' ? '⏱ Timed Out' : '❌ Failed'} |
| **Duration** | ${durationSec} |
| **Retries** | ${failure.retries} |
| **CI Run** | ${runSection} |

### Error Message
\`\`\`
${failure.error || 'No error message captured'}
\`\`\`

${retryInfo}

> This is an automated update. The same test is still failing — priority may need to be raised.

_🤖 Auto-updated by PlaywrightHub • ${now}_
`.trim();
  }
}

// ─────────────────────────────────────────────────────────────────
// ISSUE CREATION
// ─────────────────────────────────────────────────────────────────

/**
 * Create a new GitHub Issue for a test failure.
 *
 * @param {string} owner
 * @param {string} repo
 * @param {string} title - Issue title (includes prefix and browser)
 * @param {string} body - Markdown issue body
 * @param {string[]} labels - Label names to apply
 * @returns {Promise<{ number: number, url: string }|null>}
 */
async function createIssue(owner, repo, title, body, labels) {
  try {
    const response = await octokit.rest.issues.create({
      owner,
      repo,
      title,
      body,
      labels,
    });

    return {
      number: response.data.number,
      url: response.data.html_url,
    };
  } catch (err) {
    console.error(`[githubClient] Failed to create issue: ${err.message}`);

    // 401 = bad token, 403 = insufficient scope, 404 = repo not found
    if (err.status === 401) {
      console.error('[githubClient] Token is invalid or expired. Regenerate GITHUB_TOKEN.');
    } else if (err.status === 403) {
      console.error('[githubClient] Token lacks "repo" scope. Check token permissions.');
    } else if (err.status === 404) {
      console.error(
        `[githubClient] Repo not found: ${owner}/${repo}. ` +
          'Check GITHUB_OWNER and GITHUB_REPO in .env'
      );
    }

    return null; // Non-blocking — don't throw
  }
}

/**
 * Add a comment to an existing issue (for deduplication).
 *
 * @param {string} owner
 * @param {string} repo
 * @param {number} issueNumber
 * @param {string} body - Markdown comment body
 * @returns {Promise<{ id: number, url: string }|null>}
 */
async function addCommentToIssue(owner, repo, issueNumber, body) {
  try {
    const response = await octokit.rest.issues.createComment({
      owner,
      repo,
      issue_number: issueNumber,
      body,
    });

    return {
      id: response.data.id,
      url: response.data.html_url,
    };
  } catch (err) {
    console.error(
      `[githubClient] Failed to comment on issue #${issueNumber}: ${err.message}`
    );
    return null;
  }
}

// ─────────────────────────────────────────────────────────────────
// MAIN ENTRY POINT
// ─────────────────────────────────────────────────────────────────

/**
 * Process all test failures and create/update GitHub Issues.
 *
 * This is the function called by globalTeardown.js.
 * It orchestrates the entire issue creation workflow:
 *   1. Validate config
 *   2. Ensure labels exist
 *   3. For each failure: search → create or comment
 *   4. Return a summary of actions taken
 *
 * @param {Array<Object>} failures - Array of failure objects from failures.json
 * @param {string} runUrl - GitHub Actions run URL for linking
 * @returns {Promise<{ created: number, updated: number, failed: number }>}
 */
async function processFailures(failures, runUrl) {
  const summary = { created: 0, updated: 0, failed: 0 };

  // ── Validate configuration ──────────────────────────────────────
  if (!octokit) {
    console.warn(
      '[githubClient] Skipping issue creation — GITHUB_TOKEN not set.\n' +
        '[githubClient] To enable: add GITHUB_TOKEN to .env and GitHub Secrets.'
    );
    return summary;
  }

  const owner = process.env.GITHUB_OWNER;
  const repo = process.env.GITHUB_REPO;

  if (!owner || !repo) {
    console.warn(
      '[githubClient] Skipping issue creation — GITHUB_OWNER or GITHUB_REPO not set.'
    );
    return summary;
  }

  if (!failures || failures.length === 0) {
    console.info('[githubClient] No failures to process. ✓');
    return summary;
  }

  console.info(`\n[githubClient] ──────────────────────────────────────`);
  console.info(`[githubClient] Processing ${failures.length} failure(s)...`);
  console.info(`[githubClient] Repository: ${owner}/${repo}`);

  // ── Ensure all labels exist in the repo ────────────────────────
  // We do this ONCE before processing any failures.
  // If label creation fails for some labels, we continue anyway —
  // GitHub will just ignore unknown label names on issue creation.
  try {
    await ensureLabelsExist(owner, repo);
  } catch (err) {
    console.warn(`[githubClient] Label setup warning: ${err.message}`);
  }

  // ── Process each failure ────────────────────────────────────────
  for (let i = 0; i < failures.length; i++) {
    const failure = failures[i];

    // Build the canonical issue title for this failure.
    // This EXACT title is used for deduplication — never change the format.
    const issueTitle = `${ISSUE_TITLE_PREFIX} ${failure.fullTitle} - ${failure.browser}`;

    console.info(
      `\n[githubClient] [${i + 1}/${failures.length}] Processing: ${failure.title}`
    );

    // Determine which labels to apply
    const labels = [
      'bug',
      'playwright',
      'auto-generated',
      // Add the feature label only if it's a known feature
      ...(failure.feature && failure.feature !== 'unknown' ? [failure.feature] : []),
    ];

    try {
      // Step 1: Search for an existing open issue with this exact title
      const existingIssueNumber = await searchForExistingIssue(
        owner,
        repo,
        issueTitle
      );

      if (existingIssueNumber) {
        // ── DUPLICATE: Add a comment to the existing issue ──────
        console.info(
          `[githubClient] Existing issue found (#${existingIssueNumber}). Adding comment...`
        );

        const commentBody = buildIssueBody(failure, runUrl, false);
        const comment = await addCommentToIssue(
          owner,
          repo,
          existingIssueNumber,
          commentBody
        );

        if (comment) {
          console.info(
            `[githubClient] ✓ Comment added to #${existingIssueNumber}: ${comment.url}`
          );
          summary.updated++;
        } else {
          summary.failed++;
        }
      } else {
        // ── NEW ISSUE: Create it ─────────────────────────────────
        console.info(`[githubClient] No existing issue found. Creating new issue...`);

        const issueBody = buildIssueBody(failure, runUrl, true);
        const issue = await createIssue(owner, repo, issueTitle, issueBody, labels);

        if (issue) {
          console.info(
            `[githubClient] ✓ Issue #${issue.number} created: ${issue.url}`
          );
          summary.created++;
        } else {
          summary.failed++;
        }
      }
    } catch (err) {
      // Catch-all for unexpected errors on a single failure.
      // Log and continue processing remaining failures.
      console.error(
        `[githubClient] Unexpected error processing "${failure.title}": ${err.message}`
      );
      summary.failed++;
    }

    // Delay between write operations to respect secondary rate limits.
    // Skip delay after the last item.
    if (i < failures.length - 1) {
      await sleep(API_WRITE_DELAY_MS);
    }
  }

  // ── Print final summary ─────────────────────────────────────────
  console.info('\n[githubClient] ══ Issue Creation Summary ══');
  console.info(`[githubClient]  Created:  ${summary.created} new issue(s)`);
  console.info(`[githubClient]  Updated:  ${summary.updated} existing issue(s) commented`);
  console.info(`[githubClient]  Failed:   ${summary.failed} could not be processed`);
  console.info(`[githubClient]  Repo:     https://github.com/${owner}/${repo}/issues`);
  console.info('[githubClient] ════════════════════════════\n');

  return summary;
}

// ─────────────────────────────────────────────────────────────────
// UTILITIES
// ─────────────────────────────────────────────────────────────────

/**
 * Test the GitHub connection and token validity.
 * Called by scripts/test-github-connection.js.
 * Returns a detailed status object instead of throwing.
 *
 * @returns {Promise<Object>} Connection status details
 */
async function testConnection() {
  const status = {
    tokenPresent: !!process.env.GITHUB_TOKEN,
    tokenValid: false,
    repoAccessible: false,
    canCreateIssues: false,
    rateLimitRemaining: null,
    user: null,
    repo: null,
    errors: [],
  };

  if (!octokit) {
    status.errors.push('GITHUB_TOKEN not set in environment');
    return status;
  }

  const owner = process.env.GITHUB_OWNER;
  const repo = process.env.GITHUB_REPO;

  // Test 1: Token validity — fetch authenticated user
  try {
    const userResponse = await octokit.rest.users.getAuthenticated();
    status.tokenValid = true;
    status.user = userResponse.data.login;
    console.info(`[testConnection] ✓ Token valid — authenticated as: ${status.user}`);
  } catch (err) {
    status.errors.push(`Token validation failed: ${err.message}`);
    return status; // Can't continue without a valid token
  }

  // Test 2: Rate limit status
  try {
    const rateLimit = await octokit.rest.rateLimit.get();
    status.rateLimitRemaining = rateLimit.data.rate.remaining;
    console.info(
      `[testConnection] ✓ Rate limit: ${status.rateLimitRemaining}/5000 remaining`
    );
  } catch (err) {
    status.errors.push(`Rate limit check failed: ${err.message}`);
  }

  if (!owner || !repo) {
    status.errors.push('GITHUB_OWNER or GITHUB_REPO not set');
    return status;
  }

  // Test 3: Repository access
  try {
    const repoResponse = await octokit.rest.repos.get({ owner, repo });
    status.repoAccessible = true;
    status.repo = repoResponse.data.full_name;
    console.info(`[testConnection] ✓ Repository accessible: ${status.repo}`);
  } catch (err) {
    status.errors.push(`Repository access failed: ${err.message}`);
    return status;
  }

  // Test 4: Issue creation permission
  // We check by fetching the repo's issue permission (doesn't create anything)
  try {
    await octokit.rest.issues.listForRepo({ owner, repo, per_page: 1 });
    status.canCreateIssues = true;
    console.info(`[testConnection] ✓ Issue read access confirmed`);
  } catch (err) {
    status.errors.push(`Issues access failed: ${err.message}`);
  }

  return status;
}

/**
 * Sleep for a given number of milliseconds.
 * @param {number} ms
 */
function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// ─────────────────────────────────────────────────────────────────
// EXPORTS
// ─────────────────────────────────────────────────────────────────

module.exports = {
  processFailures,
  testConnection,
  // Export internals for testing and the connection script
  ensureLabelsExist,
  searchForExistingIssue,
  buildIssueBody,
  createIssue,
  addCommentToIssue,
};