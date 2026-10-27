#!/usr/bin/env bash
# Local Playwright bootstrap. CI deliberately keeps its existing pinned-browser flow.
set -euo pipefail
cd "$(dirname "${BASH_SOURCE[0]}")/.."

export PLAYWRIGHT_DOWNLOAD_CONNECTION_TIMEOUT="${PLAYWRIGHT_DOWNLOAD_CONNECTION_TIMEOUT:-120000}"

if [[ -n "${PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH:-}" ]]; then
  if [[ ! -x "$PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH" ]]; then
    echo "Browser not executable: $PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH" >&2
    exit 2
  fi
  echo "Using preinstalled Chromium-compatible browser: $PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH"
else
  echo "Ensuring Playwright's Chromium headless shell is installed..."
  if ! npx playwright install --only-shell chromium; then
    cat >&2 <<'HELP'
Playwright's browser CDN is unavailable from this environment.
Use a preinstalled compatible Chrome for Testing headless shell:
  PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH=/absolute/path/to/chrome-headless-shell npm run e2e:local
Or run the standard Frontend E2E workflow in GitHub Actions.
A plugin cannot override this environment's outbound network restrictions.
HELP
    exit 3
  fi
fi

exec npx playwright test "$@"
