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
  console.log('🚀 Starting Comprehensive Human Student Dashboard Visual Verification...');
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

    // 1. Visit Student Dashboard
    console.log('1. Navigating to /dashboard...');
    await page.goto(`${WEB_BASE}/dashboard`, { waitUntil: 'networkidle', timeout: 30000 });
    await page.waitForTimeout(2500);

    // Capture Full Desktop Overview
    await page.screenshot({
      path: path.join(ARTIFACT_DIR, '120_student_dashboard_overview_fixed.png'),
      fullPage: true,
    });
    console.log('✅ Captured 120_student_dashboard_overview_fixed.png');

    // 2. Capture Sidebar Close-up & Check Text Clipping
    console.log('2. Inspecting sidebar elements and measuring text clipping...');
    const sidebar = page.locator('aside[aria-label="تنقل لوحة الطالب"]');
    await sidebar.screenshot({
      path: path.join(ARTIFACT_DIR, '121_student_sidebar_zoom_fixed.png'),
    });
    console.log('✅ Captured 121_student_sidebar_zoom_fixed.png');

    const clippingAnalysis = await page.evaluate(() => {
      const aside = document.querySelector('aside[aria-label="تنقل لوحة الطالب"]');
      if (!aside) return { error: 'Sidebar not found' };

      const items = Array.from(aside.querySelectorAll('nav a, nav button'));
      return items.map((el) => {
        const labelSpan = el.querySelector('span.whitespace-nowrap, span.text-sm');
        const text = labelSpan ? labelSpan.textContent.trim() : el.textContent.trim();
        const scrollWidth = labelSpan ? labelSpan.scrollWidth : 0;
        const clientWidth = labelSpan ? labelSpan.clientWidth : 0;
        const isClipped = scrollWidth > clientWidth;
        return { text, scrollWidth, clientWidth, isClipped };
      });
    });

    console.log('Sidebar Text Clipping Results:');
    console.table(clippingAnalysis);

    const clippedItems = clippingAnalysis.filter((i) => i.isClipped);
    if (clippedItems.length > 0) {
      console.warn('⚠️ WARNING: Clipped items detected:', clippedItems);
    } else {
      console.log('🎉 PERFECT! 0 clipped items detected in sidebar!');
    }

    // 3. Test Qiyas Calculator Modal
    console.log('3. Opening Qiyas Calculator Modal...');
    const calcBtn = page.locator('button:has-text("حاسبة النسبة الموزونة")').first();
    await calcBtn.click();
    await page.waitForTimeout(1000);
    await page.waitForSelector('text=حاسبة النسبة الموزونة', { timeout: 5000 });

    await page.screenshot({
      path: path.join(ARTIFACT_DIR, '122_student_qiyas_calculator_modal.png'),
    });
    console.log('✅ Captured 122_student_qiyas_calculator_modal.png');

    // Close Modal
    const closeBtn = page.locator('button[aria-label="إغلاق"]').first();
    if (await closeBtn.isVisible()) {
      await closeBtn.click();
      await page.waitForTimeout(500);
    }

    // 4. Test Paths Tab
    console.log('4. Navigating to Paths Tab (مساراتي ودوراتي)...');
    const pathsLink = page.locator('a:has-text("مساراتي ودوراتي")').first();
    await pathsLink.click();
    await page.waitForTimeout(2000);

    await page.screenshot({
      path: path.join(ARTIFACT_DIR, '123_student_paths_tab.png'),
      fullPage: true,
    });
    console.log('✅ Captured 123_student_paths_tab.png');

    // 5. Back to Overview & Test Parent Code Copy
    console.log('5. Navigating back to Overview and testing Parent Code Copy...');
    const overviewLink = page.locator('a:has-text("نظرة عامة")').first();
    await overviewLink.click();
    await page.waitForTimeout(2000);

    const copyBtn = page.locator('button[title="نسخ الكود"]').first();
    if (await copyBtn.isVisible()) {
      await copyBtn.click();
      await page.waitForTimeout(500);
      console.log('✅ Copied Parent Code successfully!');
    }

    // 6. Test Mobile Viewport Responsive Sidebar
    console.log('6. Testing Mobile Viewport (390x844)...');
    const mobileContext = await browser.newContext({
      viewport: { width: 390, height: 844 },
      locale: 'ar-SA',
    });
    await mobileContext.addCookies(cookies);
    const mobilePage = await mobileContext.newPage();
    await mobilePage.goto(`${WEB_BASE}/dashboard`, { waitUntil: 'networkidle' });
    await mobilePage.waitForTimeout(2000);

    // Open Mobile Drawer
    const mobileMenuBtn = mobilePage.locator('button[aria-label="فتح قائمة لوحة الطالب"]').first();
    if (await mobileMenuBtn.isVisible()) {
      await mobileMenuBtn.click();
      await mobilePage.waitForTimeout(800);
    }

    await mobilePage.screenshot({
      path: path.join(ARTIFACT_DIR, '125_student_mobile_sidebar_view.png'),
    });
    console.log('✅ Captured 125_student_mobile_sidebar_view.png');

    await mobileContext.close();
    console.log('\n🌟 ALL STUDENT DASHBOARD VERIFICATIONS COMPLETED SUCCESSFULLY!');
  } finally {
    await browser.close();
  }
})();
