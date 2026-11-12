# Test Infrastructure & E2E Architecture — Al-Mawrid Enterprise Platform

## 1. Overview & Principles

This document defines the End-to-End (E2E) testing infrastructure, architectural standards, runners, execution environments, and quality thresholds for the **Al-Mawrid (almeaago)** enterprise educational platform.

The testing methodology adheres to **strict opaque-box verification**:
- **Black-Box Observation**: Tests interact exclusively with visible UI elements (roles, headings, buttons, inputs, labels) and assert observable HTTP/network contracts. Internal component state is never monkey-patched.
- **Server Authoritative & Anti-Facade**: Access permissions, pricing totals, quota decrements, and license entitlements are never trusted from the browser alone; tests verify that frontend actions produce strict, schema-compliant backend requests and correctly reflect server-driven states.
- **Idempotency & Isolation**: Each test is completely isolated and self-contained, setting up its own network routes, authentication sessions, and storage contexts without cross-test leakage.

---

## 2. 4-Tier Test Framework

The enterprise test suite is organized into four systematic tiers covering all 30 features across Tracks 1–4:

### Tier 1: Feature Coverage (>= 5 tests per feature)
Verifies happy-path execution, core workflows, component rendering, user interactions, and standard data persistence for every single feature:
- **Track 1 (Features 1–5)**: Pitch landing, ROI calculations, Socratic audio whiteboard, AI PDF extraction demo, Proposal intake form.
- **Track 2 (Features 6–13)**: Contract configurator, 11-module matrix toggles, white-label logo propagation, Director cockpit navigation, Noor Excel roster import, Royal certificate customization, certificate print/QR verification, Go contract persistence.
- **Track 3 (Features 14–20)**: Unified hybrid entitlement evaluator, 4-tier packages catalog, Tap checkout session creation, Plyr interactive video checkpoints, checkpoint telemetry API, locked video overlay with CTA, B2B co-branding badge.
- **Track 4 (Features 21–30)**: Prompt AI exam generator, PDF worksheet extraction, multi-stage generation stepper, editable question draft preview, StepSolutionPlayer KaTeX equations, phonetic Arabic voice narration, whiteboard theme toggling, AI admin 7-provider management, B2B AI quota enforcement, interaction audit logging.

### Tier 2: Boundary & Corner Cases (>= 5 tests per feature)
Stresses the application boundaries with extreme, unexpected, or hostile inputs:
- **Scalability & Scale Extremes**: 1 student vs. 10,000+ students in ROI calculator; seat allocations exceeding contract quotas.
- **Billing Cycles**: Term (3 months, 15% discount) vs. Annual (12 months, 35% discount) rate adjustments.
- **Payload & Quotas**: 0 steps in math solutions; malformed LaTeX expressions (`\invalid{syntax}`); file size exceeding 10MB limits; empty text prompts; quota exhaustion (0 tokens / 0 PDF exams remaining).
- **Security & Authorization**: Inactive contracts; missing CSRF headers; spoofed client amounts during checkout.

### Tier 3: Cross-Feature Interactions
Tests systemic synergy across multiple independently developed domains:
- **Contract-to-Playback**: Active B2B school contract grant immediately unlocking interactive video checkpoints without requiring individual B2C payment.
- **Branding Propagation**: School logo set in contract administration appearing dynamically on the student video player badge and teacher royal appreciation certificate.
- **Quota Coupling**: AI assessment generation immediately decrementing the school's allocated monthly PDF/token quota in `AiAdminPage`.
- **Roster-to-Entitlement**: Noor Excel import creating student memberships that immediately inherit the school's contract modules.
- **Provider Failover**: AI service automatically falling back from primary provider (e.g., Gemini) to secondary (e.g., DeepSeek/OpenAI) on rate limiting or 503 errors.

### Tier 4: Real-World Institutional Scenarios
End-to-end multi-role institutional journeys mirroring actual school operational workflows:
- **Scenario A (Director Onboarding & Noor Ingestion)**: School Director signs in, reviews overview dashboard, configures classes, imports a 150-student Noor Excel sheet, and verifies the skills gap radar.
- **Scenario B (Teacher AI Exam & Royal Recognition)**: Teacher uploads a physics worksheet PDF, monitors the 3-stage generation stepper, reviews and edits math equations in KaTeX, launches a smart classroom session, and awards a Royal Appreciation Certificate with gold borders and QR code.
- **Scenario C (B2B Student Interactive Video Learning)**: Student accesses a paid course under school sponsorship (with institutional co-branding badge), watches video until a 02:25 checkpoint, answers correctly, receives instant feedback, and continues to completion.
- **Scenario D (Commercial Funnel to Enterprise Hybrid Activation)**: Principal discovers `/for-schools`, uses dynamic ROI calculator, submits proposal `SCH-2026-XXXXX`, redeems activation voucher in `/pricing`, and transitions to the active enterprise portal.

---

## 3. Runners, Environment & Tooling

| Component | Specification | Description |
|---|---|---|
| **E2E Test Runner** | Playwright (`@playwright/test` v1.63.0) | Multi-browser headless automation engine |
| **Browser Engine** | Chromium (pinned build `1248`) | Located at `C:\Users\nasef\AppData\Local\ms-playwright\chromium-1248\chrome-win64\chrome.exe` |
| **Development Web Server** | Vite v8.3.0 (`http://127.0.0.1:4173`) | Serves React 19 SPA with Tailwind CSS & KaTeX |
| **Mocking & Interception** | `page.route('**/api/**', ...)` | Server-authoritative contract mocking adhering to `PROJECT.md` |
| **Viewports Tested** | Desktop (1440x900), Tablet (820x1180), Mobile (390x844) | Validates responsive Arabic RTL layouts across screen sizes |
| **Assertion Framework** | Playwright `expect` with auto-retrying web assertions | Eliminates flaky waits; validates DOM accessibility and visibility |

---

## 4. Execution Commands

### Run Full Enterprise E2E Test Suite
From `c:\almeaago\almeaago\apps\web`:
```bash
npx playwright test tests/e2e/enterprise_b2b_journeys.spec.ts --project=chromium
```

Or using npm script:
```bash
npm run e2e -- tests/e2e/enterprise_b2b_journeys.spec.ts
```

### Run by Tier Tag
```bash
# Tier 1: Feature Coverage
npx playwright test tests/e2e/enterprise_b2b_journeys.spec.ts -g "@tier1"

# Tier 2: Boundary & Corner Cases
npx playwright test tests/e2e/enterprise_b2b_journeys.spec.ts -g "@tier2"

# Tier 3: Cross-Feature Interactions
npx playwright test tests/e2e/enterprise_b2b_journeys.spec.ts -g "@tier3"

# Tier 4: Real-World Institutional Scenarios
npx playwright test tests/e2e/enterprise_b2b_journeys.spec.ts -g "@tier4"
```

---

## 5. Thresholds & Quality Gates

1. **Passing Rate**: 100% test pass rate across all tiers. Zero flake tolerance.
2. **Execution Time**: Individual tests must complete within 10 seconds; full suite under 3 minutes in parallel headless mode.
3. **Accessibility**: All interactive elements must be discoverable by accessible roles (`role="button"`, `role="heading"`, `role="textbox"`).
4. **Localization**: Verification of Arabic RTL layout, Saudi Riyal currency formatting (`ر.س`), and standard Hijri/Gregorian date representations.
5. **Security**: Validation that unauthorized, unauthenticated, or quota-exceeded requests produce proper HTTP 401/403/429 responses and clear visual user feedback.
