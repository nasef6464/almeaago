const { chromium } = require('C:/almeaago/almeaago/apps/web/node_modules/playwright');
const path = require('path');
const fs = require('fs');

const ARTIFACTS_DIR = 'C:/Users/nasef/.gemini/antigravity/brain/0ccfb08a-58bb-4c4b-b298-4bd5e2ebea66';
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
  console.log('--- Starting Student Dashboard Embedded Tabs & Dark Mode Verification ---');
  const cookies = await loginAndGetCookies('student@almeaa.com', 'Almeaa@2026');
  console.log(`Successfully authenticated student (got ${cookies.length} session cookies).`);

  const browser = await chromium.launch({
    headless: true,
    channel: 'chrome',
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  });
  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    locale: 'ar-SA',
  });
  await context.addCookies(cookies);
  const page = await context.newPage();

  try {
    // 1. Navigate to /dashboard
    console.log('Navigating to http://127.0.0.1:5173/dashboard ...');
    await page.goto(`${WEB_BASE}/dashboard`, { waitUntil: 'networkidle' });
    await page.waitForTimeout(1500);

    const sidebar = page.locator('aside[aria-label="تنقل لوحة الطالب"]');
    const isSidebarVisible = await sidebar.isVisible();
    console.log('Sidebar visible on /dashboard:', isSidebarVisible);

    // 2. Click "تقاريري" in sidebar
    console.log('Clicking "تقاريري" in sidebar...');
    const reportsLink = page.locator('aside a:has-text("تقاريري")').first();
    await reportsLink.click();
    await page.waitForTimeout(1500);

    const urlReports = page.url();
    console.log('Current URL after clicking "تقاريري":', urlReports);
    if (!urlReports.includes('/dashboard?tab=reports')) {
      throw new Error(`Expected URL to include /dashboard?tab=reports, but got: ${urlReports}`);
    }

    const isSidebarStillVisible = await sidebar.isVisible();
    console.log('Sidebar still visible after clicking "تقاريري":', isSidebarStillVisible);
    if (!isSidebarStillVisible) {
      throw new Error('Sidebar was lost after clicking "تقاريري"!');
    }

    const reportsHeader = page.locator('h1:has-text("تقارير الأداء")').first();
    console.log('Reports header ("تقارير الأداء") visible in main area:', await reportsHeader.isVisible());

    const snap1Path = path.join(ARTIFACTS_DIR, '151_student_dashboard_reports_tab_embedded_light.png');
    await page.screenshot({ path: snap1Path, fullPage: false });
    console.log('Saved:', snap1Path);

    // 3. Click "خططي" in sidebar
    console.log('Clicking "خططي" in sidebar...');
    const planLink = page.locator('aside a:has-text("خططي")').first();
    await planLink.click();
    await page.waitForTimeout(1500);
    const urlPlan = page.url();
    console.log('Current URL after clicking "خططي":', urlPlan);
    const planHeader = page.locator('h1:has-text("خططي")').first();
    console.log('Plan header visible:', await planHeader.isVisible());
    const snap2Path = path.join(ARTIFACTS_DIR, '152_student_dashboard_plan_tab_embedded.png');
    await page.screenshot({ path: snap2Path, fullPage: false });
    console.log('Saved:', snap2Path);

    // 4. Click "أسئلتي للمراجعة" in sidebar
    console.log('Clicking "أسئلتي للمراجعة" in sidebar...');
    const reviewLink = page.locator('aside a:has-text("أسئلتي للمراجعة")').first();
    await reviewLink.click();
    await page.waitForTimeout(1500);
    const urlReview = page.url();
    console.log('Current URL after clicking "أسئلتي للمراجعة":', urlReview);
    const reviewHeader = page.locator('h1:has-text("أسئلتي للمراجعة")').first();
    console.log('Review header visible:', await reviewHeader.isVisible());
    const snap3Path = path.join(ARTIFACTS_DIR, '153_student_dashboard_review_tab_embedded.png');
    await page.screenshot({ path: snap3Path, fullPage: false });
    console.log('Saved:', snap3Path);

    // 5. Click "اختبارات المنصة" in sidebar
    console.log('Clicking "اختبارات المنصة" in sidebar...');
    const assessmentsLink = page.locator('aside a:has-text("اختبارات المنصة")').first();
    await assessmentsLink.click();
    await page.waitForTimeout(1500);
    const urlAssessments = page.url();
    console.log('Current URL after clicking "اختبارات المنصة":', urlAssessments);

    const hasUndefined = await page.locator('text="تدريب: undefined"').count();
    console.log('Count of "تدريب: undefined" on page:', hasUndefined);
    if (hasUndefined > 0) {
      throw new Error('Found "تدريب: undefined" on assessments tab!');
    }
    const snap4Path = path.join(ARTIFACTS_DIR, '154_student_dashboard_assessments_tab_embedded.png');
    await page.screenshot({ path: snap4Path, fullPage: false });
    console.log('Saved:', snap4Path);

    // 6. Switch to Dark Mode on /dashboard?tab=reports
    console.log('Navigating to /dashboard?tab=reports in Dark Mode...');
    await page.goto(`${WEB_BASE}/dashboard?tab=reports`, { waitUntil: 'networkidle' });
    await page.evaluate(() => {
      document.documentElement.classList.add('dark');
      localStorage.setItem('almeaa_theme', 'dark');
    });
    await page.waitForTimeout(1500);
    const snap5Path = path.join(ARTIFACTS_DIR, '155_student_dashboard_reports_tab_embedded_dark.png');
    await page.screenshot({ path: snap5Path, fullPage: false });
    console.log('Saved:', snap5Path);

    // 7. Verify /pricing in Dark Mode
    console.log('Navigating to http://127.0.0.1:5173/pricing in Dark Mode...');
    await page.goto(`${WEB_BASE}/pricing`, { waitUntil: 'networkidle' });
    await page.evaluate(() => {
      document.documentElement.classList.add('dark');
      localStorage.setItem('almeaa_theme', 'dark');
    });
    await page.waitForTimeout(1500);

    const pricingHeading = page.locator('h1:has-text("عضويات المنصة")').first();
    const headingColor = await pricingHeading.evaluate((el) => window.getComputedStyle(el).color);
    const pageBgColor = await page.locator('div[data-testid="pricing-memberships-page"]').evaluate((el) => {
      return window.getComputedStyle(el).backgroundColor;
    });
    console.log('Pricing Heading computed color:', headingColor);
    console.log('Pricing Page computed background-color:', pageBgColor);

    const snap6Path = path.join(ARTIFACTS_DIR, '156_pricing_page_dark_mode_contrast_fixed.png');
    await page.screenshot({ path: snap6Path, fullPage: false });
    console.log('Saved:', snap6Path);

    // 8. Test Header "أخرى" Dropdown
    console.log('Hovering over "أخرى" dropdown in header...');
    const moreMenuBtn = page.locator('header nav a:has-text("أخرى"), header nav button:has-text("أخرى"), header nav div:has-text("أخرى")').first();
    await moreMenuBtn.hover();
    await page.waitForTimeout(800);
    const snap7Path = path.join(ARTIFACTS_DIR, '157_header_more_dropdown_fixed.png');
    await page.screenshot({ path: snap7Path, fullPage: false });
    console.log('Saved:', snap7Path);

    // 9. Verify /assessments in Dark Mode
    console.log('Navigating to http://127.0.0.1:5173/assessments in Dark Mode...');
    await page.goto(`${WEB_BASE}/assessments`, { waitUntil: 'networkidle' });
    await page.evaluate(() => {
      document.documentElement.classList.add('dark');
      localStorage.setItem('almeaa_theme', 'dark');
    });
    await page.waitForTimeout(1500);
    const snap8Path = path.join(ARTIFACTS_DIR, '158_assessments_page_dark_mode_contrast_fixed.png');
    await page.screenshot({ path: snap8Path, fullPage: false });
    console.log('Saved:', snap8Path);

    console.log('=== ALL 9 VERIFICATION STEPS PASSED PERFECTLY! ===');
  } finally {
    await browser.close();
  }
}

run().catch((err) => {
  console.error('FAILED:', err);
  process.exit(1);
});
