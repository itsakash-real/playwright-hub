<div align="center">

<!-- Animated title using SVG -->
<img src="https://readme-typing-svg.demolab.com?font=Fira+Code&weight=700&size=40&duration=3000&pause=1000&color=1A56DB&center=true&vCenter=true&multiline=true&width=800&height=120&lines=PlaywrightHub;E2E+Test+Automation+Framework" alt="PlaywrightHub" />

<br/>

<!-- Badges row 1 -->
[![PR Tests](https://github.com/YOUR_USERNAME/playwright-hub/actions/workflows/playwright.yml/badge.svg)](https://github.com/YOUR_USERNAME/playwright-hub/actions/workflows/playwright.yml)
[![Playwright](https://img.shields.io/badge/Playwright-1.44+-2ea44f?logo=playwright&logoColor=white)](https://playwright.dev)
[![Node](https://img.shields.io/badge/Node.js-20+-339933?logo=nodedotjs&logoColor=white)](https://nodejs.org)
[![JavaScript](https://img.shields.io/badge/JavaScript-ES2022-F7DF1E?logo=javascript&logoColor=black)](https://developer.mozilla.org/en-US/docs/Web/JavaScript)

<!-- Badges row 2 -->
[![Allure](https://img.shields.io/badge/Reports-Allure-orange?logo=data:image/png;base64,iVBORw0KGgo=)](https://allurereport.org)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](./LICENSE)
[![PRs Welcome](https://img.shields.io/badge/PRs-welcome-brightgreen.svg)](./CONTRIBUTING.md)
[![Tests](https://img.shields.io/badge/Tests-33%20passing-2ea44f)](https://github.com/YOUR_USERNAME/playwright-hub/actions)

<br/>

```text
╔══════════════════════════════════════════════════════════════════╗
║                                                                  ║
║   Production-grade Playwright framework that automatically       ║
║   DETECTS bugs → LOGS them → TRACKS them → REPORTS them.         ║
║                                                                  ║
║   The moment a test fails in CI, a GitHub Issue appears.         ║
║   No human involvement. Zero.                                    ║
║                                                                  ║
╚══════════════════════════════════════════════════════════════════╝
```
</div>

---

## 📚 Documentation Hub

Explore our detailed documentation modules to get the most out of **PlaywrightHub**:

* 🚀 **[Setup Guide](SETUP.md)** — Step-by-step local setup, browser installation, and UI mode.
* 🏗️ **[Framework Architecture](FRAMEWORK_ARCHITECTURE.md)** — In-depth overview of the Page Object Model, custom utilities, and data flow.
* ⚙️ **[CI/CD Pipeline](CI_CD.md)** — Sharded parallel GitHub Actions configuration and automated workflows.
* 📋 **[Environment Variables](ENVIRONMENT_VARIABLES.md)** — Required credentials, access tokens, and base configurations.
* 🧪 **[Test Strategy & Coverage](TEST_STRATEGY.md)** — Matrix of our test suites, priorities, and data-driven spreadsheet approaches.
* 🤝 **[Contributing Guidelines](CONTRIBUTING.md)** — Code style, pull request workflows, and framework standard practices.
* 🔒 **[Security Policy](SECURITY.md)** — Responsible vulnerability disclosure and secret management.

---

## 🎯 What Makes This Different

> [!NOTE]
> **Most test suites simply execute test files. PlaywrightHub acts as an automated QA Engineer.**

| Typical Test Suite | PlaywrightHub |
| :--- | :--- |
| **Manual Triaging** | Tests fail → **GitHub Issue auto-created** with reproduction steps & logs |
| **Brittle Selectors** | **Strict Page Object Model** — central selector governance |
| **Hardcoded Data** | **External Fixtures** (JSON/CSV) optimized for non-engineers |
| **Serial Execution** | **Parallel Sharding** across 4 isolated VM environments |
| **Basic Logs** | **Allure Rich Reports** with screenshots, step tracing, and historical trends |
| **Redundant Bugs** | **Intelligent Deduplication** prevents duplicate GitHub issue creation |

---

## ✨ Feature Showcase

### 🏗️ 1. Page Object Model (POM) Architecture
Every UI page maps directly to a decoupled class. Selectors are maintained in a singular source of truth, making broad UI refactors seamless.

```javascript
// Spec files remain perfectly clean and readable
test('User can checkout successfully', async ({ page }) => {
  await inventoryPage.addItemToCart('Sauce Labs Backpack');
  await inventoryPage.openCart();
  await cartPage.proceedToCheckout();
});
```

### 📊 2. Data-Driven Testing via Fixtures
Test scenarios scale horizontally without writing new code blocks. Add test cases by simply updating a spreadsheet or JSON document.

```javascript
// Executes dynamically across multiple credential scenarios from users.json
for (const credential of invalidCredentials) {
  test(`Login validation: ${credential.id}`, async ({ page }) => {
    await loginPage.login(credential.username, credential.password);
    await loginPage.assertErrorMessage(credential.expectedError);
  });
}
```

### ⚡ 3. Parallel CI Sharding
By distributing the workload across multiple concurrent runners, total test suite execution drops dramatically.

```yaml
# Runs across 4 dedicated GitHub Actions runners simultaneously
strategy:
  matrix:
    shard: [1, 2, 3, 4]
```

### 🐛 4. Autonomous Bug Logging
When a failure occurs in CI, the teardown hook connects to the GitHub REST API to post actionable engineering bug tickets automatically.

```text
[PLAYWRIGHT FAIL] Cart: should start with an empty cart - chromium
Labels: bug, playwright, cart, auto-generated
Body: Includes error trace, line mapping, screenshot references, and direct CI commit links.
```

### 🔒 5. Authentication State Preservation
Session tokens are generated once during global setup and injected into browser contexts across all parallel shards, saving valuable execution overhead.

---

## 🚀 Quick Start

### 1. Clone and Install
```bash
git clone https://github.com/itsakash-real/playwright-hub.git
cd playwright-hub
npm install
npx playwright install
```

### 2. Configure Environment
```bash
cp .env.example .env
```
> [!TIP]
> Fill in the variables inside `.env`. Default public credentials for **SauceDemo** are pre-populated in `.env.example` for immediate evaluation.

### 3. Execute the Suite
```bash
npm test
```

### 4. Render Rich Allure Analytics
```bash
npm run report:full
```

---

## 🧪 Comprehensive Run Commands

Execute tests precisely tailored to your immediate workflow needs:

```bash
# Run the complete validated suite
npm test

# Launch the rich graphical UI Trace Explorer
npm run test:ui

# Watch execution live in headed browsers
npm run test:headed

# Target dedicated browser engines
npm run test:chromium
npm run test:firefox
npm run test:webkit

# Execute targeted functional modules
npm run test:auth
npm run test:e2e
```

---

## 🔮 Future Roadmap

* [ ] Visual regression assertion layers using `toHaveScreenshot()`
* [ ] Native API testing layer integration via Playwright `request` contexts
* [ ] Containerized execution environment using Docker
* [ ] Enterprise ChatOps integration (Slack/Microsoft Teams webhooks)
* [ ] Dynamic Cloud Execution grid integration (BrowserStack / LambdaTest)

---

## 👤 Author & Support

**PlaywrightHub** is engineered to establish production-grade continuous testing standards.

[![GitHub](https://img.shields.io/badge/GitHub-Profile-100000?style=for-the-badge&logo=github&logoColor=white)](https://github.com/itsakash-real)
[![LinkedIn](https://img.shields.io/badge/LinkedIn-Connect-0077B5?style=for-the-badge&logo=linkedin&logoColor=white)](https://linkedin.com/in/akmry/)

<div align="center">

*If this reference architecture empowers your test automation strategy, please consider giving the repository a ⭐*

</div>
