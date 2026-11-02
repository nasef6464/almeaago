import { createRequire } from 'module';
import path from 'path';

const require = createRequire(import.meta.url);
const { chromium } = require(path.resolve('apps/web/node_modules/playwright'));

const BASE_URL = process.env.TEST_BASE_URL || 'http://localhost:5173';
const ARTIFACT_DIR = process.env.ARTIFACT_DIR || path.resolve('./artifacts');
const CHROME_PATH = process.env.CHROME_PATH || 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';

const ADMIN_EMAIL = process.env.TEST_ADMIN_EMAIL;
const ADMIN_PASSWORD = process.env.TEST_ADMIN_PASSWORD;

const VIEWPORTS = [
  { name: 'desktop', width: 1440, height: 900 },
  { name: 'tablet', width: 820, height: 1180 },
  { name: 'mobile', width: 390, height: 844 },
];

async function main() {
  if (!ADMIN_EMAIL || !ADMIN_PASSWORD) {
    console.error('Error: TEST_ADMIN_EMAIL and TEST_ADMIN_PASSWORD environment variables are required to run this verification.');
    console.error('Example: $env:TEST_ADMIN_EMAIL="admin@almeaa.com"; $env:TEST_ADMIN_PASSWORD="<secret>"; node scripts/parity/verify-admin-workspaces.mjs');
    process.exit(1);
  }

  console.log('--- Starting Admin Dashboard Multi-Viewport Verification ---');
  const browser = await chromium.launch({
    executablePath: CHROME_PATH,
    headless: true,
  });

  for (const vp of VIEWPORTS) {
    console.log(`\n========================================`);
    console.log(`Verifying Viewport: ${vp.name} (${vp.width}x${vp.height})`);
    console.log(`========================================`);

    const context = await browser.newContext({
      viewport: { width: vp.width, height: vp.height },
      locale: 'ar-SA',
    });
    const page = await context.newPage();

    // 1. Visit login and wait for network idle
    console.log(`[1] Visiting /login...`);
    await page.goto(`${BASE_URL}/login`, { waitUntil: 'networkidle' });

    // 2. Perform Smart Login with sanitized env credentials
    console.log(`[2] Authenticating admin user...`);
    await page.locator('#smart-login-input').first().fill(ADMIN_EMAIL);
    await page.locator('#smart-login-password').first().fill(ADMIN_PASSWORD);

    const [loginResponse] = await Promise.all([
      page.waitForResponse(res => res.url().includes('/api/v1/auth/login')),
      page.locator('#smart-login-submit').first().click(),
    ]);

    if (!loginResponse.ok()) {
      throw new Error(`Login failed with HTTP status: ${loginResponse.status()}`);
    }
    console.log(`✓ Admin authenticated successfully (HTTP ${loginResponse.status()})`);
    await page.waitForTimeout(1000);

    // 3. Question Bank Admin
    console.log(`[3] Navigating to /admin-dashboard/questions...`);
    await page.goto(`${BASE_URL}/admin-dashboard/questions`, { waitUntil: 'networkidle' });
    await page.waitForTimeout(2500);

    const questionsPath = path.join(ARTIFACT_DIR, `admin_questions_${vp.name}.png`);
    await page.screenshot({ path: questionsPath, fullPage: false });
    console.log(`✓ Saved screenshot: admin_questions_${vp.name}.png`);

    // 4. Content Admin
    console.log(`[4] Navigating to /admin-dashboard/content...`);
    await page.goto(`${BASE_URL}/admin-dashboard/content`, { waitUntil: 'networkidle' });
    await page.waitForTimeout(2500);

    const contentPath = path.join(ARTIFACT_DIR, `admin_content_${vp.name}.png`);
    await page.screenshot({ path: contentPath, fullPage: false });
    console.log(`✓ Saved screenshot: admin_content_${vp.name}.png`);

    await context.close();
  }

  await browser.close();
  console.log('\n========================================');
  console.log('✅ Admin Verification Completed Successfully');
  console.log('========================================');
}

main().catch((err) => {
  console.error('Admin verification failed:', err);
  process.exit(1);
});
