# PlaywrightHub — E2E Test Automation Framework

---

## 🎬 Demo

https://github.com/user-attachments/assets/20260610-1113-42.2614845.mp4

---

## 📌 Overview

PlaywrightHub is a **Playwright + JavaScript** automation framework designed to test critical user flows of a web application (SauceDemo).

The framework automates:

- User Login (valid & invalid scenarios)
- Product Inventory browsing
- Add to Cart & Cart Management
- Checkout Process
- Autonomous Bug Logging to GitHub Issues

---

## 🛠️ Tech Stack

- **Playwright** — Browser automation
- **JavaScript (ES2022)** — Test scripting language
- **Node.js** — Runtime environment
- **GitHub Actions** — CI/CD pipeline
- **Allure Reports** — Rich test reporting

---

## 🗂️ Framework Structure

```
playwright-hub/
├── pages/          # Page Object Model classes
├── tests/          # Test spec files
├── fixtures/       # Test data (JSON/CSV)
├── utils/          # Helper utilities & bug logger
├── reports/        # Allure report output
└── .github/
    └── workflows/  # CI/CD pipeline config
```

---

## ✨ Features

- ✅ Page Object Model (POM) architecture
- ✅ Screenshot & trace capture on failure
- ✅ Allure Reports integration with historical trends
- ✅ Data-driven testing via JSON fixtures
- ✅ Parallel sharded execution across 4 CI runners
- ✅ Autonomous GitHub Issue creation on test failure
- ✅ Authentication state reuse across test sessions

---

## 🧪 Automated Test Scenarios

| # | Test Scenario | Status |
|---|---------------|--------|
| 1 | Verify successful login with valid credentials | ✅ |
| 2 | Verify login blocked with invalid credentials | ✅ |
| 3 | Verify login blocked for locked-out user | ✅ |
| 4 | Verify product inventory loads after login | ✅ |
| 5 | Verify adding a product to cart | ✅ |
| 6 | Verify cart item count updates correctly | ✅ |
| 7 | Verify cart starts empty for new session | ✅ |
| 8 | Verify removing a product from cart | ✅ |
| 9 | Verify full checkout process end-to-end | ✅ |
| 10 | Verify order confirmation after checkout | ✅ |

---

## 📊 Test Reports

> *(Add your Allure report screenshot and CI execution screenshot here)*

![Allure Report Screenshot](#)
![CI Execution Screenshot](#)

---

## ▶️ How to Run

```bash
# 1. Clone the repository
git clone https://github.com/itsakash-real/playwright-hub.git
cd playwright-hub

# 2. Install dependencies
npm install
npx playwright install

# 3. Configure environment
cp .env.example .env

# 4. Run the full test suite
npm test

# 5. Generate Allure report
npm run report:full
```

---

## 👤 Author

[![GitHub](https://img.shields.io/badge/GitHub-Profile-100000?style=for-the-badge&logo=github&logoColor=white)](https://github.com/itsakash-real)
[![LinkedIn](https://img.shields.io/badge/LinkedIn-Connect-0077B5?style=for-the-badge&logo=linkedin&logoColor=white)](https://linkedin.com/in/YOUR_PROFILE)
