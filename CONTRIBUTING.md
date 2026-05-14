# 🤝 Contributing Guidelines

First off, thank you for considering contributing to **PlaywrightHub**! It's people like you who help establish production-grade continuous testing standards for the engineering community.

---

## 🧭 Code of Conduct

By participating in this project, you agree to maintain a welcoming, inclusive, and professional environment. We expect all contributors to follow standard open-source collaboration behaviors, focusing on constructive peer reviews and technical excellence.

---

## 🌿 Branching Strategy & Pull Requests

We utilize standard feature branching to maintain repository stability. Please adhere to the following routing rules:

1. **Fork & Branch**: Create a dedicated fork of the project repository and check out a clearly labeled feature branch off `main`:
   ```bash
   git checkout -b feature/add-checkout-assertions
   ```
   *Prefix options*: `feature/*`, `fix/*`, `docs/*`, `refactor/*`.

2. **Commit Standard**: Write concise, descriptive commit messages describing exactly what state changes occurred:
   ```text
   feat(checkout): implement tax total boundary assertions
   ```

3. **Pull Request Submissions**: Target your merges against the base `main` branch. Ensure the description body outlines replication contexts, new fixture data payloads, and screen trace references if applicable.

---

## 📐 Code Style & Formatting Standards

To prevent code review overhead on formatting preferences, the codebase enforces strict formatting checks via **ESLint** and **Prettier**.

### Automatic Validation Commands
Before pushing commits upstream, ensure your local changes pass all static code quality rules:

```bash
# Validate code formatting syntax rules across the repository
npm run lint

# Auto-format target files to adhere strictly to Prettier formatting guidelines
npx prettier --write .
```

> [!IMPORTANT]
> The automated GitHub Actions validation pipeline blocks merging any pull requests featuring lingering lint errors or unformatted specifications.

---

## 🏛️ Architectural Standards Checklist

When contributing new automated verification tests, ensure your design abides by our defined structural blueprints:

* [ ] **Zero Selector Bleeding**: All UI locating selectors must reside completely inside targeted Page Object Model classes. Never write raw locator strings inside `.spec.js` blocks.
* [ ] **Externalized Fixtures**: If validating custom inputs, append test scenarios into corresponding CSV spreadsheets or JSON arrays inside `fixtures/`.
* [ ] **Idempotent Isolation**: Every spec must run completely isolated from peer test results. Do not create tests dependent on the state left behind by an earlier spec execution.

---

⬅️ **[Back to Test Strategy](TEST_STRATEGY.md)** | ➡️ **[Next: Security Policy](SECURITY.md)**
