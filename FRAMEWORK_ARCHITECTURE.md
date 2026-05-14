<!-- path: FRAMEWORK_ARCHITECTURE.md -->

# Framework Architecture — PlaywrightHub

This document explains every architectural decision in PlaywrightHub —
why each layer exists, how components connect, and how to extend the
framework when the application under test changes.

---

## High-Level Architecture
┌─────────────────────────────────────────────────────────────────┐
│                     Test Execution Layer                         │
│                   tests/**/.spec.js                             │
│  (What to test — test logic, assertions, Allure metadata)        │
└──────────────────────────┬──────────────────────────────────────┘
│ imports
┌──────────────────────────▼──────────────────────────────────────┐
│                   Page Object Layer                              │
│                   src/pages/.js                                 │
│  (How to interact — selectors, action methods, state queries)    │
└──────┬───────────────────┬───────────────────────────────────────┘
│ navigates to      │ uses
┌──────▼──────┐    ┌───────▼────────────────────────────────────┐ │
│  SauceDemo  │    │           Utility Layer                     │ │
│  (the AUT)  │    │           src/utils/                        │ │
└─────────────┘    │  allureHelper · csvParser · jsonLoader      │ │
│  githubClient · randomData                  │ │
└────────────────────────────────────────────┘ │
│
┌──────────────────────────────────────────────────────────────────┘
│                    Infrastructure Layer
│
│  playwright.config.js     ← Central config: browsers, workers, reporters
│  src/setup/globalSetup    ← Auth state creation (once per suite)
│  src/setup/globalTeardown ← Result parsing + GitHub Issue creation
│  fixtures/                ← External test data (JSON/CSV)
│  .github/workflows/       ← CI/CD pipeline definition
└──────────────────────────────────────────────────────────────────

---

## Layer Responsibilities

### Layer 1: Test Specs (`tests/`)

**Responsibility:** Orchestrate user journeys. Assert outcomes.

**What specs DO:**
- Import Page Objects
- Import fixtures via loaders
- Call Page Object methods (actions)
- Make assertions with `expect()`
- Attach Allure metadata

**What specs NEVER DO:**
- Touch DOM selectors
- Hardcode test data
- Contain business logic
- Import Playwright's `chromium`, `firefox`, etc. directly

**File per feature:**

tests/
├── auth/login.spec.js           # All authentication tests
├── inventory/inventory.spec.js  # Product listing + sorting
├── cart/cart.spec.js            # Cart management
├── checkout/checkout.spec.js    # Checkout flow
└── e2e/happyPath.spec.js        # Full user journeys

---

### Layer 2: Page Objects (`src/pages/`)

**Responsibility:** Encapsulate UI interaction. Be the single source of truth for selectors.

**Architecture: Inheritance**
BasePage (shared helpers)
│
├── LoginPage
├── InventoryPage
├── CartPage
├── CheckoutPage
└── OrderConfirmPage
**BasePage provides:**
- `navigate(path)` — go to a URL with domcontentloaded strategy
- `getTitle()` — page title
- `getCurrentURL()` — synchronous current URL
- `waitForURL(pattern)` — wait for navigation
- `takeScreenshot(name)` — capture and save
- `waitForNetworkIdle()` — wait for AJAX completion
- `isVisible(selector)` — boolean visibility check
- `getText(selector)` — trimmed text content

**Page Object rules:**
1. Constructor receives `page` (dependency injection)
2. All selectors defined in constructor as `this.elementName`
3. Methods return promises (async/await)
4. Action methods: `doSomething()` — perform UI actions
5. Query methods: `getSomething()` or `isSomething()` — return state
6. No assertions inside page objects (assertions belong in specs)

**Selector priority:**
1st choice: [data-test="..."]     — purpose-built for testing
2nd choice: [aria-label="..."]    — accessibility attributes (stable)
3rd choice: .stable-css-class     — only if explicitly maintained
Never use:  xpath, nth-child, text-based selectors

**Dynamic selectors (cart buttons):**
SauceDemo's Add-to-Cart buttons use product-name slugs in their
`data-test` attributes. `InventoryPage._nameToSlug()` converts a
display name to the correct slug:

```javascript
_nameToSlug('Sauce Labs Backpack') → 'sauce-labs-backpack'
// Used as: [data-test="add-to-cart-sauce-labs-backpack"]
```

---

### Layer 3: Utilities (`src/utils/`)

**Responsibility:** Shared, reusable functions used by both tests and setup.

| Utility | Purpose | Key Functions |
|---|---|---|
| `jsonLoader.js` | Load JSON fixture files | `loadFixture()`, `loadFixtureKey()` |
| `csvParser.js` | Parse CSV fixture files | `parseCSV()`, `parseCSVWithTypes()` |
| `allureHelper.js` | Allure reporting wrappers | `addStep()`, `setupTest()`, `attachJSON()`, `captureAndAttach()` |
| `githubClient.js` | GitHub API integration | `processFailures()`, `testConnection()` |

**allureHelper design decision:**
Wrapping `allure-js-commons` instead of calling it directly:
- Tests never import `allure-js-commons` directly
- If we swap Allure for another reporter, change one file
- Every function degrades gracefully if Allure isn't active
- Consistent error handling in one place

**csvParser type casting:**
CSV files have no types — everything is a string. `parseCSVWithTypes()`
accepts a list of column names to cast to numbers:

```javascript
const products = parseCSVWithTypes('fixtures/products.csv', ['price', 'sortPriorityAZ']);
// products[0].price is 29.99 (number), not "29.99" (string)
```

---

### Layer 4: Fixtures (`fixtures/`)

**Responsibility:** External test data, separate from test logic.

**Design principle:** A non-engineer should be able to add a new test
scenario by editing a fixture file — no JavaScript required.
fixtures/
├── users.json      # User accounts + expected behaviors
├── products.csv    # Product catalog + sort priorities
└── checkout.json   # Checkout form scenarios

**JSON structure convention:**
```json
{
  "validScenarios": [...],    // Happy path inputs
  "invalidScenarios": [...],  // Error case inputs with expectedError
}
```

**Deep copy on load:**
`jsonLoader.js` returns `JSON.parse(JSON.stringify(data))` — a deep copy.
This prevents one test from modifying fixture data that a subsequent
test will read. Each test gets a fresh, unmodified object.

---

### Layer 5: Infrastructure

#### `playwright.config.js` — The Brain

Central configuration for all test behavior:

| Setting | Value | Rationale |
|---|---|---|
| `fullyParallel` | `true` | Tests within files run in parallel |
| `retries` | 2 (CI) / 0 (local) | Catch flakes in CI, fail fast locally |
| `workers` | 2 (CI) / 4 (local) | Match CPU cores without over-subscribing |
| `timeout` | 30s per test | Enough for SauceDemo, not infinite |
| `actionTimeout` | 10s | Generous for SauceDemo's simple UI |
| `navigationTimeout` | 15s | Handles `performance_glitch_user` delay |

**Dual project setup:**

The most important config decision — two Playwright projects:

```javascript
projects: [
  {
    name: 'chromium',
    use: { storageState: '.auth/user.json' }, // Logged in
    testIgnore: ['**/auth/**'],                // Not for login tests
  },
  {
    name: 'no-auth',
    use: { storageState: undefined },          // Clean browser
    testMatch: ['**/auth/**'],                 // Login tests only
  },
]
```

Why: Auth tests must start at the login page (no stored session).
All other tests must start already logged in (no wasted login time).

#### `globalSetup.js` — Login Factory

Runs once before all workers start:
1. Validates environment variables
2. Checks auth state freshness (< 60 minutes → reuse)
3. Launches Chromium, navigates to SauceDemo, fills login form
4. Saves `context.storageState()` to `.auth/user.json`
5. Verifies saved state actually works (loads inventory page)
6. Closes browser

Result: All test workers load `.auth/user.json` → start logged in.
Time saved: `(number of tests) × ~2s login time` per run.

#### `globalTeardown.js` — Result Processor

Runs once after all workers finish:
1. Reads `results.json` (Playwright JSON reporter output)
2. Walks the nested suite/spec/test/result tree recursively
3. Categorizes tests: passed, failed, skipped, flaky
4. Writes `failures.json` with structured failure data
5. Calls `processFailures()` to create GitHub Issues

#### `.github/workflows/playwright.yml` — CI Orchestration

```yaml
jobs:
  lint:          # Fast check (~30s) — blocks if code quality fails
  test:          # Matrix: shard [1,2,3,4] → 4 parallel VMs
  merge-reports: # Downloads all shard artifacts, generates unified Allure
```

---

## Data Flow — Complete Picture
Developer pushes code
│
▼
GitHub Actions triggers playwright.yml
│
▼
Lint job runs (~30s)
│ passes
▼
4 shard jobs start simultaneously
Each shard:
├── npm ci (deps from cache)
├── Playwright browsers (from cache)
├── globalSetup runs ONCE per shard
│     └── Login → .auth/user.json
├── Tests run (8-9 tests per shard)
│     ├── Load fixture → Page Object → SauceDemo → Assert
│     └── Allure reporter → allure-results/
├── Upload allure-results artifact
└── On failure: (handled in globalTeardown)
│
▼
merge-reports job
├── Download all 4 shard artifacts
├── allure generate → allure-report/
└── Upload allure-report artifact
│
▼
globalTeardown (runs in each shard after tests)
├── Read results.json
├── Build failure summary
├── Write failures.json
└── For each failure:
├── Search GitHub Issues (exact title match)
├── Found → Add comment (deduplication)
└── Not found → Create new Issue
(title, labels, full diagnostic body)

---

## Extension Points

### Adding a New Page

1. Create `src/pages/YourNewPage.js` extending `BasePage`
2. Add selectors in constructor
3. Add action and query methods
4. Export: `module.exports = { YourNewPage }`
5. Import in spec files as needed

### Adding a New Test Feature

1. Create `tests/your-feature/your-feature.spec.js`
2. Add fixture data to `fixtures/` if needed
3. Playwright automatically discovers the new spec file
4. GitHub Actions runs it on the next PR — no config change needed

### Adding a New Fixture Column

1. Add the column to the CSV or JSON file
2. If numeric, add the column name to `parseCSVWithTypes()` call
3. Use the new field in test assertions

### Changing the Target Application

To point PlaywrightHub at a different app:
1. Update `BASE_URL` in `.env`
2. Rewrite the page classes in `src/pages/` for the new app's selectors
3. Update fixture data to match the new app's test data
4. Test logic in specs remains unchanged (they only call page methods)

This demonstrates the value of the POM layer — the test **logic** is
portable even when the UI changes.

---

## Why These Choices

**Playwright over Cypress:**
- True multi-browser support (Chromium, Firefox, WebKit)
- Better parallelism (workers + sharding)
- No iframe limitations
- Runs in any CI without special configuration
- Traces, video, screenshot built in

**JavaScript over TypeScript:**
- No build step — run files directly
- Accessible to more engineers
- Playwright's type safety is good enough via JSDoc
- Simpler CI pipeline

**Allure over Playwright's HTML reporter:**
- Step-level breakdown (not just pass/fail)
- Attachments: screenshots inline, JSON fixtures, videos
- Historical trend charts
- Epic/Feature/Story hierarchy for organization
- Better stakeholder communication

**GitHub Issues over JIRA/Linear for auto-logging:**
- Same platform as the code — no authentication setup
- Labelable, assignable, searchable
- Free for public repos
- Deduplication via title search is reliable

**SauceDemo as the AUT:**
- Always online (no infrastructure cost)
- Known, stable selectors
- Specifically designed for testing practice
- Realistic e-commerce user flows
