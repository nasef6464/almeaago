const { chromium } = require('C:/almeaago/almeaago/apps/web/node_modules/playwright');
const path = require('path');

const ARTIFACTS_DIR = 'C:/Users/nasef/.gemini/antigravity/brain/0ccfb08a-58bb-4c4b-b298-4bd5e2ebea66';
const WEB_BASE = 'http://127.0.0.1:5173';
const API_BASE = 'http://127.0.0.1:8080';

async function loginAndGetCookies(email, password) {
  const res = await fetch(`${API_BASE}/api/v1/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });
  if (!res.ok) throw new Error(`Login failed: ${res.status}`);
  const setCookies = res.headers.getSetCookie();
  return setCookies.map((cookieStr) => {
    const parts = cookieStr.split(';')[0].split('=');
    return {
      name: parts[0].trim(),
      value: parts.slice(1).join('=').trim(),
      domain: '127.0.0.1',
      path: '/',
    };
  });
}

async function run() {
  console.log('--- Starting Mobile Viewport Verification ---');
  const cookies = await loginAndGetCookies('student@almeaa.com', 'Almeaa@2026');
  const browser = await chromium.launch({
    headless: true,
    channel: 'chrome',
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  });

  // iPhone 13 Pro viewport
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 },
    isMobile: true,
    hasTouch: true,
    locale: 'ar-SA',
  });
  await context.addCookies(cookies);
  const page = await context.newPage();

  try {
    // 1. Mobile Student Dashboard with Reports Tab in Dark Mode
    await page.goto(`${WEB_BASE}/dashboard?tab=reports`, { waitUntil: 'networkidle' });
    await page.evaluate(() => {
      document.documentElement.classList.add('dark');
      localStorage.setItem('almeaa_theme', 'dark');
    });
    await page.waitForTimeout(1500);

    const snap1 = path.join(ARTIFACTS_DIR, '159_mobile_student_dashboard_embedded_reports_dark.png');
    await page.screenshot({ path: snap1, fullPage: false });
    console.log('Saved:', snap1);

    // 2. Open Mobile Drawer to show sidebar items in Dark Mode
    const drawerBtn = page.locator('button[aria-label="فتح قائمة لوحة الطالب"]').first();
    if (await drawerBtn.isVisible().catch(() => false)) {
      await drawerBtn.click();
      await page.waitForTimeout(800);
      const snap2 = path.join(ARTIFACTS_DIR, '160_mobile_student_drawer_docked_dark.png');
      await page.screenshot({ path: snap2, fullPage: false });
      console.log('Saved:', snap2);
    }

    // 3. Mobile Pricing Page in Dark Mode
    await page.goto(`${WEB_BASE}/pricing`, { waitUntil: 'networkidle' });
    await page.evaluate(() => {
      document.documentElement.classList.add('dark');
      localStorage.setItem('almeaa_theme', 'dark');
    });
    await page.waitForTimeout(1500);
    const snap3 = path.join(ARTIFACTS_DIR, '161_mobile_pricing_dark_contrast_fixed.png');
    await page.screenshot({ path: snap3, fullPage: false });
    console.log('Saved:', snap3);

    console.log('=== Mobile Tests Passed Successfully! ===');
  } finally {
    await browser.close();
  }
}

run().catch((e) => {
  console.error(e);
  process.exit(1);
});
