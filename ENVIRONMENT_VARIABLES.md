# 📋 Environment Variables Reference

To ensure secure execution without hardcoding restricted access credentials, **PlaywrightHub** dynamic runtime settings are injected via environmental parameters.

---

## 🔑 Base Configuration Parameters

The following variables dictate target application hosts and primary validation test user identities. These should be defined locally inside your `.env` workspace:

| Parameter | Type | Required | Default Value Reference | Description |
| :--- | :--- | :--- | :--- | :--- |
| `BASE_URL` | String | **Yes** | `https://www.saucedemo.com` | Base routing address for the System Under Test. |
| `SAUCE_USERNAME` | String | **Yes** | `standard_user` | Primary account handle utilized during global setup caching flows. |
| `SAUCE_PASSWORD` | String | **Yes** | `secret_sauce` | Cleartext passphrase or secret associated with the primary user role. |

> [!IMPORTANT]
> Never commit production environment files containing real private enterprise credentials directly to public source control repositories.

---

## ⚙️ Continuous Integration Engine Credentials

When running inside **GitHub Actions** pipelines, the framework teardown sequence requires administrative access tokens to generate or query active issue tracking systems.

| Parameter | Type | Context | Description |
| :--- | :--- | :--- | :--- |
| `GITHUB_TOKEN` | Secret | **CI Only** | Standard Personal Access Token (PAT) or automatically resolved Actions Token featuring `repo` read/write capabilities. |
| `GITHUB_OWNER` | String | **CI Only** | Target repository ownership entity (Organization scope or user workspace slug). |
| `GITHUB_REPO` | String | **CI Only** | Exact target destination project repository name (e.g., `playwright-hub`). |

---

## 🔔 Optional Enterprise Messaging Integrations

Configure downstream real-time notification hooks to alert operational channels on nightly pipeline metrics:

```env
# Optional Slack Webhook routing endpoints for CI summaries
SLACK_WEBHOOK_URL=https://hooks.slack.com/services/T000/B000/XXXXXX
```

---

## 📄 Example `.env` Template Structure

Your fully configured local environment file should mirror the following schema structure cleanly:

```env
# System Under Test Gateway Configuration
BASE_URL=https://www.saucedemo.com
SAUCE_USERNAME=standard_user
SAUCE_PASSWORD=secret_sauce

# GitHub API Communication Integration
GITHUB_TOKEN=ghp_exampleTokenStringHere123456789
GITHUB_OWNER=enterprise-qa
GITHUB_REPO=playwright-hub
```

---

⬅️ **[Back to CI/CD](CI_CD.md)** | ➡️ **[Next: Test Strategy](TEST_STRATEGY.md)**
