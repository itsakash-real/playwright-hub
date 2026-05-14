# 🔒 Security Policy & Vulnerability Disclosure

Security is a primary priority for **PlaywrightHub**. This policy outlines supported framework iterations, continuous dependency vulnerability monitoring, and procedures for reporting potential vulnerabilities responsibly.

---

## 🛡️ Supported Versions

We apply proactive security patches and framework updates primarily to active main line iterations. Ensure your localized automation setups utilize supported release tracks:

| Framework Line Iteration | Continuous Upstream Monitoring | Target Security Patch Threshold |
| :--- | :--- | :--- |
| **`v1.x` (Current Main)** | ✅ Fully Supported | Immediate triage & hotfix patching |
| **`v0.x` (Legacy Pre-POM)**| ❌ End of Life | Unmaintained |

---

## 🚨 Reporting a Vulnerability

If you discover a security vulnerability within the test framework execution engine, private token leakage parameters, or internal dependency pipelines, please follow our coordinated disclosure timeline.

### Reporting Channel
Do not open public GitHub Issues or Pull Requests detailing sensitive security vulnerabilities. Instead, forward a comprehensive private disclosure brief directly to the core engineering maintenance group:

* **Email Route**: `security@example.com`
* **Subject Format**: `[SECURITY DISCLOSURE] PlaywrightHub Automation Framework`

### Required Submission Details
To assist our engineering triage efforts, please include the following diagnostic parameters inside your brief:
1. **Affected Modules**: Detailed file paths or continuous integration workflows targeted.
2. **Replication Mechanics**: Step-by-step instructions or trace code snippets confirming the attack vector.
3. **Impact Boundary Scope**: Potential unauthorized escalation routes or secret extraction parameters.

We aim to acknowledge receipt of all legitimate vulnerability disclosure submissions within **48 hours** and provide remediation timelines proactively.

---

## 🔐 Secret Management Best Practices

To prevent unintended credential extraction during public automated testing runs:

* **Environment Encapsulation**: Maintain all target passphrases, tokens, and webhooks completely inside untracked local `.env` variables or encrypted continuous integration engine vault configurations.
* **Trace Masking**: Ensure debug assertion loggers or screenshot wrappers do not output real raw private enterprise tokens inside visible HTML trace viewer payloads.

---

⬅️ **[Back to Contributing](CONTRIBUTING.md)** | 🏠 **[Return to Documentation Hub](README.md)**
