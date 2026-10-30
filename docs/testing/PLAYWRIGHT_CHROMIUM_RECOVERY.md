# ALMEAA — Playwright / Chromium in restricted local environments

## Why this exists

On 27 October 2026, the current ALMEAA migration notes documented a local Chromium download failure from the Playwright CDN. The same notes recorded a successful workaround using the Google Chrome for Testing `chrome-headless-shell` binary and successful local browser tests (95/95). GitHub Actions separately installs Chromium and must remain the authoritative merge gate.

This change does **not** disable E2E tests, mark failed tests green, update the browser/Playwright versions, or alter the GitHub workflow. It adds an opt-in executable override and a convenience command.

## Normal path (Linux/macOS)

```bash
cd apps/web
npm install
npm run e2e:local
```

The local helper downloads **only the Chromium headless shell** when needed instead of the full headed browser. It increases the download idle timeout to 120 seconds. Playwright's normal per-user browser cache is reused when the environment persists. On a machine without the browser's OS libraries, an administrator may first need `npx playwright install-deps chromium` (or `npx playwright install --with-deps --only-shell chromium`).

## CDN blocked: reuse a browser already present

If the CDN is inaccessible, provision a Chrome for Testing `chrome-headless-shell` compatible with the Playwright release, then set its **absolute executable path**:

```bash
cd apps/web
PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH=/absolute/path/to/chrome-headless-shell npm run e2e:local
```

The same override also works with `npx playwright test` directly. Explicitly opting in avoids silently using a mismatched system Chrome revision. If an executable is missing or cannot launch, fix the binary and Linux dependencies; do not skip test assertions.

## Ephemeral agent environments

- If the agent's outbound CDN is blocked, retrying the same download indefinitely will not fix it.
- Use a persistent pre-provisioned browser or run Playwright in a compatible Playwright Docker image, matched to the installed `@playwright/test` version.
- In fully locked ephemeral environments where neither binary provisioning nor Docker is allowed, run the **Frontend E2E GitHub Actions gate** and use its artifacts as evidence; record the local limitation once, not as a feature regression.
- Browser availability is separate from functional, authorization, data, and visual parity. Do not claim `PARITY_PROVEN` merely because browser tests pass.

## Diagnostics

```bash
cd apps/web
npx playwright --version
npx playwright install --list
DEBUG=pw:browser npm run e2e:local
```

See the [Playwright browser installation](https://playwright.dev/docs/browsers), [CI](https://playwright.dev/docs/ci), and [Docker](https://playwright.dev/docs/docker) documentation.

## Verified runtime proof — 27 October 2026

GitHub Actions [Frontend E2E run 40455027932](https://github.com/nasef6464/almeaago/actions/runs/40455027932) (commit `3b9a6b114bbad4a6d53400158dd051d2b775b706`) performed **both** browser paths:

- **Preinstalled-browser fallback:** `PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH` was set to the installed executable returned by `@playwright/test`; `npm run e2e:local` reported `Using preinstalled Chromium-compatible browser`. The real director workspace browser test passed **1/1** in 5.4 seconds.
- **Normal Playwright suite:** `npm run e2e` passed **101/101** browser tests in 1.7 minutes.
- Browser evidence upload finished successfully.

This confirms the fallback **when a compatible browser is available**. It does not imply the restricted agent can download the browser from a blocked network or that every runtime already has the compatible binary. Preserve the regular GitHub CI browser installation and the four acceptance gates.
