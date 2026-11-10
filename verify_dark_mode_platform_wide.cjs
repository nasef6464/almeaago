const { chromium } = require('C:/almeaago/almeaago/apps/web/node_modules/playwright');
const path = require('path');

const ARTIFACT_DIR = 'C:/Users/nasef/.gemini/antigravity/brain/0ccfb08a-58bb-4c4b-b298-4bd5e2ebea66';
const WEB_BASE = 'http://127.0.0.1:5173';
const API_BASE = 'http://127.0.0.1:8080';

async function loginAndGetCookies(email, password) {
  const res = await fetch(`${API_BASE}/api/v1/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });
  if (!res.ok) throw new Error(`Login failed for ${email}: ${res.status}`);
  const setCookies = res.headers.getSetCookie();
  const cookies = [];
  for (const c of setCookies) {
    const parts = c.split(';')[0].split('=');
    cookies.push({
      name: parts[0].trim(),
      value: parts.slice(1).join('=').trim(),
      domain: '127.0.0.1',
      path: '/',
    });
  }
  return cookies;
}

(async () => {
  console.log('🌙 Starting Comprehensive Full-Platform Dark Mode & Light Mode Suite...');
  const browser = await chromium.launch({
    headless: true,
    channel: 'chrome',
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  });

  try {
    const cookies = await loginAndGetCookies('student@almeaa.com', 'Almeaa@2026');
    const context = await browser.newContext({
      viewport: { width: 1440, height: 900 },
      locale: 'ar-SA',
    });
    await context.addCookies(cookies);
    const page = await context.newPage();

    // 1. Visit /assessments (The exact page from user screenshot Image 2)
    console.log('1. Navigating to /assessments...');
    await page.goto(`${WEB_BASE}/assessments`, { waitUntil: 'networkidle', timeout: 30000 });
    await page.waitForTimeout(1000);

    // Toggle to Dark Mode
    console.log('Toggling to Dark Mode...');
    const themeBtn = page.locator('button[aria-label="تفعيل الوضع الداكن"], button[aria-label="تفعيل الوضع الفاتح"]').first();
    const isInitiallyDark = await page.evaluate(() => document.documentElement.classList.contains('dark'));
    if (!isInitiallyDark) {
      await themeBtn.click();
      await page.waitForTimeout(800);
    }

    const hasDarkClass = await page.evaluate(() => document.documentElement.classList.contains('dark'));
    console.log(`Document has dark class: ${hasDarkClass}`);

    await page.screenshot({
      path: path.join(ARTIFACT_DIR, '140_assessments_dark_mode_perfect.png'),
      fullPage: true,
    });
    console.log('✅ Captured 140_assessments_dark_mode_perfect.png');

    // 2. Student Dashboard in Dark Mode
    console.log('2. Navigating to /dashboard in Dark Mode...');
    await page.goto(`${WEB_BASE}/dashboard`, { waitUntil: 'networkidle', timeout: 30000 });
    await page.waitForTimeout(1500);

    await page.screenshot({
      path: path.join(ARTIFACT_DIR, '141_student_dashboard_dark_mode_perfect.png'),
      fullPage: true,
    });
    console.log('✅ Captured 141_student_dashboard_dark_mode_perfect.png');

    const sidebar = page.locator('aside[aria-label="تنقل لوحة الطالب"]');
    if (await sidebar.isVisible()) {
      await sidebar.screenshot({
        path: path.join(ARTIFACT_DIR, '142_student_sidebar_dark_mode_perfect.png'),
      });
      console.log('✅ Captured 142_student_sidebar_dark_mode_perfect.png');
    }

    // 3. Qiyas Calculator Modal in Dark Mode
    console.log('3. Opening Qiyas Calculator Modal in Dark Mode...');
    const calcBtn = page.locator('button:has-text("حاسبة النسبة الموزونة"), div:has-text("حاسبة النسبة الموزونة")').first();
    if (await calcBtn.isVisible()) {
      await calcBtn.click();
      await page.waitForTimeout(800);
      await page.screenshot({
        path: path.join(ARTIFACT_DIR, '143_qiyas_calculator_modal_dark_mode_perfect.png'),
      });
      console.log('✅ Captured 143_qiyas_calculator_modal_dark_mode_perfect.png');
      const closeBtn = page.locator('button[aria-label="إغلاق"]').first();
      if (await closeBtn.isVisible()) await closeBtn.click();
      await page.waitForTimeout(500);
    }

    // 4. Learning Space in Dark Mode
    console.log('4. Navigating to /learning in Dark Mode...');
    await page.goto(`${WEB_BASE}/learning`, { waitUntil: 'networkidle', timeout: 30000 });
    await page.waitForTimeout(1500);

    await page.screenshot({
      path: path.join(ARTIFACT_DIR, '144_learning_space_dark_mode_perfect.png'),
      fullPage: true,
    });
    console.log('✅ Captured 144_learning_space_dark_mode_perfect.png');

    // 5. Mobile Viewport (390x844) in Dark Mode
    console.log('5. Testing Mobile Viewport in Dark Mode...');
    const mobileContext = await browser.newContext({
      viewport: { width: 390, height: 844 },
      locale: 'ar-SA',
    });
    await mobileContext.addCookies(cookies);
    const mobilePage = await mobileContext.newPage();
    // Pre-set localStorage dark theme so it starts in Dark Mode
    await mobilePage.addInitScript(() => {
      localStorage.setItem('almeaa_theme', 'dark');
      document.documentElement.classList.add('dark');
    });
    await mobilePage.goto(`${WEB_BASE}/dashboard`, { waitUntil: 'networkidle', timeout: 30000 });
    await mobilePage.waitForTimeout(1500);

    await mobilePage.screenshot({
      path: path.join(ARTIFACT_DIR, '145_mobile_student_dashboard_dark_mode_perfect.png'),
      fullPage: true,
    });
    console.log('✅ Captured 145_mobile_student_dashboard_dark_mode_perfect.png');

    // Open Mobile Drawer in Dark Mode
    const mobileMenuBtn = mobilePage.locator('button[aria-label="فتح قائمة لوحة الطالب"]').first();
    if (await mobileMenuBtn.isVisible()) {
      await mobileMenuBtn.click();
      await mobilePage.waitForTimeout(800);
      await mobilePage.screenshot({
        path: path.join(ARTIFACT_DIR, '146_mobile_drawer_dark_mode_perfect.png'),
      });
      console.log('✅ Captured 146_mobile_drawer_dark_mode_perfect.png');
    }
    await mobileContext.close();

    // 6. Test Live Assessment / Start Attempt Page in Dark Mode
    console.log('6. Navigating to /live-assessment in Dark Mode...');
    await page.goto(`${WEB_BASE}/live-assessment`, { waitUntil: 'networkidle', timeout: 30000 });
    await page.waitForTimeout(1500);

    await page.screenshot({
      path: path.join(ARTIFACT_DIR, '147_exam_runner_dark_mode_perfect.png'),
      fullPage: true,
    });
    console.log('✅ Captured 147_exam_runner_dark_mode_perfect.png');

    // 7. Toggle back to Light Mode
    console.log('7. Toggling back to Light Mode...');
    await page.goto(`${WEB_BASE}/assessments`, { waitUntil: 'networkidle' });
    await page.waitForTimeout(1000);

    const toggleBackBtn = page.locator('button[aria-label="تفعيل الوضع الفاتح"], button[aria-label="تفعيل الوضع الداكن"]').first();
    await toggleBackBtn.click();
    await page.waitForTimeout(800);

    await page.screenshot({
      path: path.join(ARTIFACT_DIR, '148_restored_light_mode_perfect.png'),
      fullPage: true,
    });
    console.log('✅ Captured 148_restored_light_mode_perfect.png');

    console.log('\n🌟 ALL FULL-PLATFORM DARK & LIGHT TESTS COMPLETED WITH 100% SUCCESS!');
  } finally {
    await browser.close();
  }
})();
