// path: src/utils/allureHelper.js

/**
 * allureHelper — Complete Allure reporting integration.
 *
 * Phase 5 rewrites Phase 3's skeleton into a full library that:
 *
 * 1. STEPS       — wrap actions in named steps that appear in the report
 * 2. LABELS      — severity, feature, story, epic, owner, tag
 * 3. ATTACHMENTS — screenshots, JSON fixtures, plain text, HTML
 * 4. LINKS       — issue links, TMS (test management) links
 * 5. PARAMETERS  — data-driven test parameters shown in the report
 * 6. DESCRIPTION — markdown-formatted test description in the report
 *
 * ARCHITECTURE DECISION — why we wrap allure-js-commons:
 *
 * allure-playwright makes allure available as a global when the reporter
 * is active. allure-js-commons provides the same API for direct use.
 * We import from allure-js-commons because:
 *   a) It works regardless of whether allure-playwright reporter is active
 *   b) We get full TypeScript JSDoc type completions
 *   c) One import point — change it here, every test benefits
 *   d) We can add consistent error handling without touching test files
 *
 * GRACEFUL DEGRADATION:
 * If allure-js-commons is not installed or not configured, every function
 * degrades silently to a no-op. Tests still run and pass — they just
 * won't have rich Allure metadata. This prevents the Allure integration
 * from ever breaking the test suite.
 */

// We need the allure object from allure-js-commons.
// This is the same allure object allure-playwright uses internally.
let allureApi;

try {
  // allure-js-commons is a dependency of allure-playwright.
  // If allure-playwright is installed, this will always succeed.
  const allureModule = require('allure-js-commons');
  
  // In v2 of allure-js-commons, the API was under the `allure` property.
  // In v3, the API functions are exported directly from the module.
  allureApi = allureModule.allure || allureModule;

  // Ensure the API loaded properly before proceeding, else fallback
  if (typeof allureApi.label !== 'function') throw new Error('Allure API not found');
} catch {
  // Fallback: create a complete no-op stub with the same API surface.
  // Every method accepts any arguments and returns a resolved promise.
  // This means tests work even without allure-playwright installed.
  const noop = async () => {};
  const noopStep = async (_name, fn) => {
    if (typeof fn === 'function') return await fn();
  };

  allureApi = {
    step: noopStep,
    label: noop,
    attachment: noop,
    description: noop,
    descriptionHtml: noop,
    link: noop,
    issue: noop,
    tms: noop,
    epic: noop,
    feature: noop,
    story: noop,
    severity: noop,
    tag: noop,
    owner: noop,
    parameter: noop,
    testCaseId: noop,
  };
}

// ─────────────────────────────────────────────────────────────────
// CONSTANTS
// ─────────────────────────────────────────────────────────────────

/**
 * Allure severity levels — use these constants everywhere.
 * Never use raw strings like 'critical' in test files.
 *
 * Blocker  → App crash, data loss, security hole. Blocks release.
 * Critical → Core feature broken. User can't complete primary task.
 * Normal   → Feature degraded but workaround exists.
 * Minor    → UI glitch, cosmetic issue. Annoying but not blocking.
 * Trivial  → Typo, minor text issue. Won't affect users significantly.
 */
const Severity = Object.freeze({
  BLOCKER: 'blocker',
  CRITICAL: 'critical',
  NORMAL: 'normal',
  MINOR: 'minor',
  TRIVIAL: 'trivial',
});

/**
 * Allure link types — used with addLink() for issue/TMS references.
 */
const LinkType = Object.freeze({
  ISSUE: 'issue',
  TMS: 'tms',
  CUSTOM: 'link',
});

// ─────────────────────────────────────────────────────────────────
// STEP HELPERS
// ─────────────────────────────────────────────────────────────────

/**
 * Wrap a block of code as a named Allure step.
 *
 * Steps appear in the Allure report as a numbered, collapsible list
 * under each test. Each step shows: name, status (pass/fail), duration.
 * Nested steps are supported — call addStep inside another addStep.
 *
 * If the step function throws, the step is marked as FAILED in the
 * report and the error propagates to the test (causing the test to fail).
 *
 * USAGE:
 *   await addStep('Fill login form with valid credentials', async () => {
 *     await loginPage.fillUsername('standard_user');
 *     await loginPage.fillPassword('secret_sauce');
 *   });
 *
 * NAMING CONVENTION:
 *   Start with a verb: "Fill", "Click", "Navigate", "Verify", "Assert"
 *   Be specific: "Verify cart badge shows 3 items" not "Check cart"
 *   Include key data: "Add 'Sauce Labs Backpack' to cart"
 *
 * @param {string} name - Human-readable step name shown in the report
 * @param {() => Promise<any>} fn - Async function to execute as this step
 * @returns {Promise<any>} Return value of fn (pass-through)
 */
async function addStep(name, fn) {
  try {
    return await allureApi.step(name, fn);
  } catch (err) {
    // Re-throw — the step failure should fail the test.
    // The error is already recorded by Allure before this catch runs.
    throw err;
  }
}

// ─────────────────────────────────────────────────────────────────
// LABEL HELPERS
// ─────────────────────────────────────────────────────────────────

/**
 * Set the severity of the current test.
 * Appears in the Allure report and can be used to filter/sort tests.
 * Use the Severity constants — never raw strings.
 *
 * @param {string} level - One of Severity.BLOCKER through Severity.TRIVIAL
 */
async function setSeverity(level) {
  const validLevels = Object.values(Severity);
  if (!validLevels.includes(level)) {
    console.warn(
      `[allureHelper] Invalid severity: "${level}". ` +
        `Use one of: ${validLevels.join(', ')}`
    );
  }
  await allureApi.label('severity', level);
}

/**
 * Set the feature label — groups tests by product feature in Allure.
 * This becomes a navigation category in the Allure report's left sidebar.
 *
 * CONVENTION: Use consistent names across all tests.
 *   'Authentication', 'Shopping Cart', 'Inventory', 'Checkout', 'E2E'
 *
 * @param {string} featureName
 */
async function setFeature(featureName) {
  await allureApi.label('feature', featureName);
}

/**
 * Set the story label — sub-category within a feature.
 * Hierarchy in Allure: Epic → Feature → Story → Test
 *
 * @param {string} storyName - User story or scenario name
 */
async function setStory(storyName) {
  await allureApi.label('story', storyName);
}

/**
 * Set the epic — highest-level grouping, above feature.
 * Usually the product or module name.
 *
 * @param {string} epicName
 */
async function setEpic(epicName) {
  await allureApi.label('epic', epicName);
}

/**
 * Set the test owner label.
 * Appears in the report — useful when multiple engineers write tests.
 *
 * @param {string} ownerName - Engineer name or team name
 */
async function setOwner(ownerName) {
  await allureApi.label('owner', ownerName);
}

/**
 * Add a tag to the current test.
 * Tags appear as chips in the Allure report and support filtering.
 * Call multiple times to add multiple tags.
 *
 * @param {string} tagName - e.g., 'smoke', 'regression', 'data-driven'
 */
async function addTag(tagName) {
  await allureApi.label('tag', tagName);
}

/**
 * Set a custom label on the current test.
 * For any label type not covered by the specific helpers above.
 *
 * @param {string} name - Label key
 * @param {string} value - Label value
 */
async function setLabel(name, value) {
  await allureApi.label(name, value);
}

// ─────────────────────────────────────────────────────────────────
// DESCRIPTION HELPERS
// ─────────────────────────────────────────────────────────────────

/**
 * Set the test description using plain text or Markdown.
 * Appears below the test name in the Allure report.
 *
 * @param {string} text - Test description (supports Markdown)
 */
async function setDescription(text) {
  await allureApi.description(text);
}

/**
 * Set the test description using raw HTML.
 * Use when you need rich formatting that Markdown can't express.
 *
 * @param {string} html - HTML string
 */
async function setDescriptionHtml(html) {
  await allureApi.descriptionHtml(html);
}

// ─────────────────────────────────────────────────────────────────
// LINK HELPERS
// ─────────────────────────────────────────────────────────────────

/**
 * Add a link to the current test.
 * Links appear as clickable icons in the Allure report.
 *
 * @param {string} url - Full URL
 * @param {string} name - Link display text
 * @param {string} type - 'issue', 'tms', or 'link'
 */
async function addLink(url, name, type = LinkType.CUSTOM) {
  await allureApi.link(url, type, name);
}

/**
 * Link a GitHub Issue to the current test.
 * Adds a bug icon in the Allure report that links to the issue.
 *
 * Usage: await addIssueLink('https://github.com/user/repo/issues/42', 'GH-42')
 *
 * @param {string} url - Full GitHub issue URL
 * @param {string} name - Display name (e.g., 'GH-42' or 'Bug: Login fails')
 */
async function addIssueLink(url, name) {
  await allureApi.link(url, LinkType.ISSUE, name);
}

/**
 * Link a test case in a test management system (TMS) like Jira or TestRail.
 *
 * @param {string} url - Full TMS URL
 * @param {string} name - Display name (e.g., 'TC-123')
 */
async function addTmsLink(url, name) {
  await allureApi.link(url, LinkType.TMS, name);
}

// ─────────────────────────────────────────────────────────────────
// PARAMETER HELPERS
// ─────────────────────────────────────────────────────────────────

/**
 * Add a test parameter to the Allure report.
 *
 * Parameters appear in the report alongside the test result.
 * They're especially valuable for data-driven tests — they show
 * WHICH data set was used for each test run.
 *
 * In the Allure report, if multiple test runs have the same name but
 * different parameters, they appear as separate rows in the report,
 * each labeled with its parameter value.
 *
 * USAGE IN DATA-DRIVEN TESTS:
 *   for (const user of users) {
 *     test(`login as ${user.id}`, async ({ page }) => {
 *       await addParameter('username', user.username);
 *       await addParameter('expected_behavior', user.expectedBehavior);
 *       // ... test logic
 *     });
 *   }
 *
 * @param {string} name - Parameter name (e.g., 'username', 'browser')
 * @param {string|number|boolean} value - Parameter value
 * @param {{ excluded?: boolean, mode?: 'hidden'|'masked'|'default' }} options
 *   excluded: true → parameter excluded from test history grouping
 *   mode: 'hidden' → not shown in report, 'masked' → shown as ****
 */
async function addParameter(name, value, options = {}) {
  await allureApi.parameter(name, String(value), options);
}

// ─────────────────────────────────────────────────────────────────
// ATTACHMENT HELPERS
// ─────────────────────────────────────────────────────────────────

/**
 * Attach any file to the current test in the Allure report.
 * The attachment appears as a downloadable/viewable item in the report.
 *
 * @param {string} name - Display name for the attachment
 * @param {Buffer|string} content - File content
 * @param {string} contentType - MIME type
 *   Common values: 'image/png', 'application/json', 'text/plain',
 *                  'text/html', 'text/csv', 'application/xml'
 */
async function attachFile(name, content, contentType) {
  try {
    await allureApi.attachment(name, content, { contentType });
  } catch (err) {
    // Attachment failures should never fail the test itself
    console.warn(`[allureHelper] Failed to attach "${name}": ${err.message}`);
  }
}

/**
 * Attach a PNG screenshot to the current test.
 * Screenshots appear inline in the Allure report — click to expand.
 *
 * USAGE:
 *   const screenshot = await page.screenshot({ fullPage: true });
 *   await attachScreenshot('State after adding item to cart', screenshot);
 *
 * @param {string} name - Descriptive label for the screenshot
 * @param {Buffer} buffer - PNG data from page.screenshot()
 */
async function attachScreenshot(name, buffer) {
  await attachFile(name, buffer, 'image/png');
}

/**
 * Attach a JSON object to the current test as a formatted attachment.
 * The JSON is pretty-printed and displayed inline in the Allure report.
 *
 * PRIMARY USE CASE: Show the fixture data used in a test.
 * This makes reports self-documenting — a reader can see exactly
 * what input data the test ran with, without looking at fixture files.
 *
 * USAGE:
 *   await attachJSON('User fixture data', { username: 'standard_user', ... });
 *   await attachJSON('Products tested', products.slice(0, 3));
 *
 * @param {string} name - Display name for the attachment
 * @param {any} data - Any JSON-serializable value
 */
async function attachJSON(name, data) {
  try {
    const formatted = JSON.stringify(data, null, 2);
    await attachFile(name, formatted, 'application/json');
  } catch (err) {
    // JSON.stringify can fail for circular references
    await attachFile(
      name,
      `[Serialization error: ${err.message}]`,
      'text/plain'
    );
  }
}

/**
 * Attach a plain text string to the current test.
 *
 * @param {string} name - Display name for the attachment
 * @param {string} text - Plain text content
 */
async function attachText(name, text) {
  await attachFile(name, String(text), 'text/plain');
}

/**
 * Attach HTML content to the current test.
 * Rendered inline in the Allure report as a formatted HTML view.
 *
 * @param {string} name - Display name for the attachment
 * @param {string} html - HTML string
 */
async function attachHtml(name, html) {
  await attachFile(name, html, 'text/html');
}

/**
 * Take a page screenshot and attach it to the current test.
 * Convenience wrapper combining page.screenshot() + attachScreenshot().
 *
 * USAGE:
 *   await captureAndAttach(page, 'Cart after adding 3 items');
 *
 * @param {import('@playwright/test').Page} page - Playwright Page object
 * @param {string} name - Screenshot label
 * @param {boolean} fullPage - Capture full scrollable page (default: true)
 */
async function captureAndAttach(page, name, fullPage = true) {
  try {
    const screenshot = await page.screenshot({ fullPage });
    await attachScreenshot(name, screenshot);
  } catch (err) {
    console.warn(`[allureHelper] Screenshot capture failed for "${name}": ${err.message}`);
  }
}

// ─────────────────────────────────────────────────────────────────
// COMPOSITE HELPERS — combine multiple Allure calls into one
// ─────────────────────────────────────────────────────────────────

/**
 * Set up all common test metadata in one call.
 * Use at the start of every test to ensure consistent labeling.
 *
 * USAGE:
 *   await setupTest({
 *     epic: 'SauceDemo E-Commerce',
 *     feature: 'Checkout',
 *     story: 'Form validation',
 *     severity: Severity.NORMAL,
 *     description: 'Verifies that missing first name shows error.',
 *     tags: ['regression', 'data-driven'],
 *     owner: 'QA Team',
 *   });
 *
 * @param {Object} options
 * @param {string} [options.epic]
 * @param {string} [options.feature]
 * @param {string} [options.story]
 * @param {string} [options.severity]
 * @param {string} [options.description]
 * @param {string[]} [options.tags]
 * @param {string} [options.owner]
 */
async function setupTest({
  epic,
  feature,
  story,
  severity,
  description,
  tags = [],
  owner,
} = {}) {
  const tasks = [];

  if (epic) tasks.push(setEpic(epic));
  if (feature) tasks.push(setFeature(feature));
  if (story) tasks.push(setStory(story));
  if (severity) tasks.push(setSeverity(severity));
  if (description) tasks.push(setDescription(description));
  if (owner) tasks.push(setOwner(owner));
  for (const tag of tags) tasks.push(addTag(tag));

  // Run all label-setting calls in parallel — they're independent
  await Promise.all(tasks);
}

module.exports = {
  // Constants
  Severity,
  LinkType,

  // Steps
  addStep,

  // Labels
  setSeverity,
  setFeature,
  setStory,
  setEpic,
  setOwner,
  addTag,
  setLabel,

  // Descriptions
  setDescription,
  setDescriptionHtml,

  // Links
  addLink,
  addIssueLink,
  addTmsLink,

  // Parameters
  addParameter,

  // Attachments
  attachFile,
  attachScreenshot,
  attachJSON,
  attachText,
  attachHtml,
  captureAndAttach,

  // Composite
  setupTest,
};