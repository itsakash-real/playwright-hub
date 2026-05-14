# ⚙️ Continuous Integration & Delivery (CI/CD)

**PlaywrightHub** automates quality checks and bug tracking natively via **GitHub Actions**. Our pipeline architecture focuses on high-speed concurrent sharding, immutable trace archiving, and real-time failure triage loops.

---

## 🚀 Pipeline Topology

Every Pull Request and primary branch merge triggers a highly coordinated execution graph across containerized worker environments:

```text
┌────────────────────────────────────────────────────────────────────────┐
│                        GitHub Actions Workflow                         │
├────────────────────────────────────────────────────────────────────────┤
│                                                                        │
│  [Code Quality Check] ──► ESLint + Prettier Verification               │
│         │                                                              │
│         ▼ (Proceeds only on clean static pass)                         │
│  [Parallel Matrix Executions]                                          │
│   ├── Shard 1/4: Authentication & Happy Path                           │
│   ├── Shard 2/4: Inventory Sorting & Views                             │
│   ├── Shard 3/4: Shopping Cart Lifecycle                               │
│   └── Shard 4/4: Multi-step Checkout Validation                        │
│         │                                                              │
│         ▼                                                              │
│  [Artifact Consolidation] ──► Merges JSON execution dumps              │
│         │                                                              │
│         ├─► Tests Passed? ──► Publishes Allure Report Summary          │
│         └─► Tests Failed? ──► Triggers Autonomous Issue Logging Hook   │
└────────────────────────────────────────────────────────────────────────┘
```

---

## ⚡ Parallel Matrix Sharding Deep Dive

Running heavy UI browser tests serially introduces deployment bottlenecks. PlaywrightHub resolves this by sharding test execution across 4 concurrent runner virtual machines.

### Strategy Implementation
Inside `.github/workflows/playwright.yml`, the runner matrix provisions virtual compute nodes dynamically:

```yaml
name: Playwright Continuous Integration

on:
  pull_request:
    branches: [ main ]
  push:
    branches: [ main ]

jobs:
  test:
    name: Shard Execution (${{ matrix.shard }}/${{ strategy.job-total }})
    runs-on: ubuntu-latest
    strategy:
      fail-fast: false
      matrix:
        shard: [1, 2, 3, 4]
    
    steps:
      - name: Checkout Code Repository
        uses: actions/checkout@v4

      - name: Provision Node.js Runtime
        uses: actions/setup-node@v4
        with:
          node-version: 20

      - name: Install NPM Packages
        run: npm ci

      - name: Install Playwright Webkit & Chrome Engines
        run: npx playwright install --with-deps

      - name: Execute Sharded Suite
        run: npx playwright test --shard=${{ matrix.shard }}/4
        env:
          CI: true
```

> [!TIP]
> By leveraging `--shard=N/M`, Playwright calculates spec weight automatically to balance execution timelines symmetrically across all participating runner machines.

---

## 🐛 Autonomous Bug Reporting Pipeline

When any shard reports a non-zero exit code due to test failure, a dependent post-run job retrieves the consolidated test run output.

### Execution Workflow:
1. **Trace Download**: Merges individual test output fragments into a coherent results tree.
2. **REST Invocation**: Authenticates via `GITHUB_TOKEN` to interrogate active project issues.
3. **Deduplication Validation**: Searches existing open tickets matching the exact browser and spec metadata signature.
   * If **Found**: Appends a fresh stack trace comment to track persistent occurrences.
   * If **Missing**: Generates a pristine labeled bug ticket complete with video attachment links and commit tracking.

---

## ⏰ Nightly Smoke Matrix

A dedicated scheduled execution pipeline (`nightly.yml`) executes daily at `02:00 UTC` to validate cross-browser compliance across latest upstream browser releases:

* **Target Engines**: `chromium`, `firefox`, `webkit`.
* **Alerting**: Pushes test summary statistics directly to integrated messaging workspaces (Slack/Teams).

---

⬅️ **[Back to Architecture](FRAMEWORK_ARCHITECTURE.md)** | ➡️ **[Next: Environment Variables](ENVIRONMENT_VARIABLES.md)**
