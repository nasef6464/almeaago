import { defineConfig, devices } from '@playwright/test';

// Opt-in escape hatch for restricted ephemeral environments where the Playwright
// browser CDN is unreachable. Normal CI runs keep using Playwright's pinned binary.
const localChromiumExecutable = process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH?.trim();
const webPort = process.env.E2E_WEB_PORT || '4173';
if (!/^\d{1,5}$/.test(webPort) || Number(webPort) < 1 || Number(webPort) > 65535) throw new Error('Invalid E2E_WEB_PORT');
const webURL = `http://127.0.0.1:${webPort}`;

export default defineConfig({
  testDir: './tests/e2e',
  timeout: 30_000,
  expect: { timeout: 5_000 },
  fullyParallel: false,
  retries: 0,
  reporter: [['list'], ['html', { outputFolder: 'playwright-report', open: 'never' }]],
  use: {
    baseURL: webURL,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  projects: [
    {
      name: 'chromium',
      use: {
        ...devices['Desktop Chrome'],
        ...(localChromiumExecutable
          ? { launchOptions: { executablePath: localChromiumExecutable } }
          : {}),
      },
    },
  ],
  webServer: {
    command: `npm run dev -- --host 127.0.0.1 --port ${webPort}`,
    url: webURL,
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
});
