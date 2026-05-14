<!-- path: SETUP.md -->

# Setup Guide — PlaywrightHub

Complete local setup from zero to running tests.

---

## Prerequisites

| Requirement | Version | Check |
|---|---|---|
| Node.js | 20 LTS or higher | `node --version` |
| npm | 9+ (comes with Node 20) | `npm --version` |
| Git | Any recent version | `git --version` |
| Internet access | — | Required for SauceDemo |

**Install Node.js 20:**
- [Download from nodejs.org](https://nodejs.org/en/download)
- Or use [nvm](https://github.com/nvm-sh/nvm): `nvm install 20 && nvm use 20`

---

## Installation

### Step 1 — Clone the repository

```bash
git clone https://github.com/YOUR_USERNAME/playwright-hub.git
cd playwright-hub
```

### Step 2 — Install npm dependencies

```bash
npm install
```

This installs:
- `@playwright/test` — core test runner
- `allure-playwright` — Allure reporter
- `@octokit/rest` — GitHub API client
- `csv-parse` — CSV fixture parsing
- `dotenv` — environment variable loading
- `eslint` + `prettier` — code quality tools

### Step 3 — Install Playwright browsers

```bash
npx playwright install
```

Downloads Chromium, Firefox, and WebKit browser binaries.
**Size:** ~300MB. Cached after first install.

For CI environments with system dependencies missing:
```bash
npx playwright install --with-deps
```

### Step 4 — Configure environment

```bash
cp .env.example .env
```

Open `.env` and verify the values. For running tests, you only
need the SauceDemo section:

```env
BASE_URL=https://www.saucedemo.com
SAUCE_USERNAME=standard_user
SAUCE_PASSWORD=secret_sauce
```

The GitHub section (`GITHUB_TOKEN`, etc.) is only needed for
auto-issue creation in CI. Skip it for local test runs.

### Step 5 — Verify the setup

```bash
# Test SauceDemo is reachable
curl -s -o /dev/null -w "%{http_code}" https://www.saucedemo.com
# Expected: 200

# Test auth state creation
node -e "require('./src/setup/globalSetup.js')()"
# Expected:
#   [globalSetup] Logging in as: standard_user
#   [globalSetup] Login successful in X.XXs
#   [globalSetup] Auth state saved to .auth/user.json
#   [globalSetup] Auth state verification passed ✓

# Verify the auth file exists
ls -la .auth/user.json
# Expected: file exists with recent timestamp
```

### Step 6 — Run the test suite

```bash
npm test
```

Expected output:
Running 33 tests using 4 workers
✓ Authentication: Login › should login successfully (2.1s)
✓ Authentication: Login › should show error for locked_out_user (1.8s)
... (30 more tests)
33 passed (28.4s)

---

## Install Allure CLI

Required for generating the HTML report:

```bash
npm install -g allure-commandline
allure --version
# Expected: 2.x.x
```

Then generate and open the report:
```bash
npm run report:full
```

---

## GitHub Integration Setup (Optional)

Only needed for the auto-issue creation feature.

### Step 1 — Create a Personal Access Token

1. Go to: https://github.com/settings/tokens/new
2. Token name: `playwright-hub-ci`
3. Expiration: 90 days
4. Scopes: ✅ `repo` (full control of private repositories)
5. Click **Generate token**
6. **Copy the token immediately** — you won't see it again

### Step 2 — Add to .env

```env
GITHUB_TOKEN=ghp_your_token_here
GITHUB_OWNER=your-github-username
GITHUB_REPO=playwright-hub
```

### Step 3 — Verify the connection

```bash
node scripts/test-github-connection.js
```

Expected:
✓ Token valid — authenticated as: your-username
✓ Rate limit: 4998/5000 remaining
✓ Repository accessible: your-username/playwright-hub
✓ Issue read access confirmed
✓ All labels are ready
✅ All checks passed!

### Step 4 — Add secrets to GitHub Actions

In your repository: **Settings → Secrets and variables → Actions**

Add these repository secrets:
- `SAUCE_USERNAME` = `standard_user`
- `SAUCE_PASSWORD` = `secret_sauce`
- `GH_TOKEN` = your GitHub token (note: `GH_TOKEN`, not `GITHUB_TOKEN`)
- `GITHUB_OWNER` = your GitHub username
- `GITHUB_REPO` = `playwright-hub`

---

## Verifying Each Phase

```bash
# Phase 1: Config is valid
npx playwright test --list
# Expected: Lists all 33 tests, 0 errors

# Phase 2: Page Objects load
node -e "
  ['LoginPage','InventoryPage','CartPage','CheckoutPage','OrderConfirmPage']
    .forEach(n => {
      require('./src/pages/' + n + '.js');
      console.log(n + ' ✓');
    });
"

# Phase 3: Tests run
npx playwright test --reporter=list
# Expected: 33 passed

# Phase 4: Sharding works
npx playwright test --shard=1/4 --reporter=list
# Expected: ~8-9 tests run

# Phase 5: Allure results generated
npm test && ls allure-results/*.json | wc -l
# Expected: 33 result files

# Phase 6: GitHub connection works
node scripts/test-github-connection.js
# Expected: ✅ All checks passed!
```

---

## Common Setup Issues

### `node: command not found`
Node.js is not installed or not in PATH.
```bash
# Install via nvm:
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.0/install.sh | bash
source ~/.bashrc
nvm install 20
nvm use 20
```

### `Error: browserType.launch: Executable doesn't exist`
Playwright browsers not installed.
```bash
npx playwright install
```

### `[globalSetup] Login failed: Timeout 10000ms exceeded`
Either credentials are wrong or SauceDemo is unreachable.
```bash
# Test SauceDemo
curl -I https://www.saucedemo.com
# Should return: HTTP/2 200

# Verify .env
cat .env | grep -E "SAUCE_(USERNAME|PASSWORD)"
# Should show: standard_user / secret_sauce
```

### `allure: command not found`
Allure CLI not installed globally.
```bash
npm install -g allure-commandline
# Or use npx:
npx allure generate allure-results -o allure-report --clean
```

### `Cannot find module '@octokit/rest'`
Dependencies not fully installed.
```bash
rm -rf node_modules package-lock.json
npm install
```

