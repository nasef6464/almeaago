import { defineConfig, devices } from '@playwright/test';

// Opt-in escape hatch for restricted ephemeral environments where the Playwright
// browser CDN is unreachable. Normal CI runs keep using Playwright's pinned binary.
const localChromiumExecutable = process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH?.trim();
const disableGpuForExactParity = process.env.PLAYWRIGHT_CHROMIUM_DISABLE_GPU === '1';

export default defineConfig({
  testDir: './tests/e2e',
  timeout: 30_000,
  expect: { timeout: 5_000 },
  fullyParallel: false,
  retries: 0,
  reporter: [['list'], ['html', { outputFolder: 'playwright-report', open: 'never' }]],
  use: {
    baseURL: 'http://127.0.0.1:4173',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  projects: [
    {
      name: 'chromium',
      use: {
        ...devices['Desktop Chrome'],
        ...(localChromiumExecutable || disableGpuForExactParity
          ? {
              launchOptions: {
                ...(localChromiumExecutable ? { executablePath: localChromiumExecutable } : {}),
                ...(disableGpuForExactParity ? { args: ['--disable-gpu'] } : {}),
              },
            }
          : {}),
      },
    },
  ],
  webServer: {
    command: 'npm run dev -- --host 127.0.0.1 --port 4173',
    url: 'http://127.0.0.1:4173',
    reuseExistingServer: false,
    timeout: 60_000,
  },
});
