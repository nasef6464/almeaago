import { createRequire } from 'module';
import path from 'path';

const require = createRequire(import.meta.url);
const { chromium } = require('c:/almeaago/almeaago/apps/web/node_modules/playwright');

const BASE_URL = 'http://localhost:5173';
const ARTIFACT_DIR = 'C:/Users/nasef/.gemini/antigravity/brain/0ccfb08a-58bb-4c4b-b298-4bd5e2ebea66';

const VIEWPORTS = [
  { name: 'desktop', width: 1440, height: 900 },
  { name: 'tablet', width: 820, height: 1180 },
  { name: 'mobile', width: 390, height: 844 },
];

async function main() {
  console.log('--- Starting Admin Dashboard Multi-Viewport Verification ---');
  const browser = await chromium.launch({
    executablePath: 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
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

    // 2. Perform Smart Login
    console.log(`[2] Authenticating admin@almeaa.com...`);
    await page.locator('#smart-login-input').first().fill('admin@almeaa.com');
    await page.locator('#smart-login-password').first().fill('Almeaa@2026');

    const [loginResponse] = await Promise.all([
      page.waitForResponse(res => res.url().includes('/api/v1/auth/login')),
      page.locator('#smart-login-submit').first().click(),
    ]);

    if (!loginResponse.ok()) {
      throw new Error(`Login failed with status: ${loginResponse.status()}`);
    }
    console.log(`✓ Admin authenticated (HTTP ${loginResponse.status()})`);
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
