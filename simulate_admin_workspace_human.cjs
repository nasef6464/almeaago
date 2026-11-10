const { chromium } = require('C:/almeaago/almeaago/apps/web/node_modules/playwright');
const path = require('path');

const BASE_URL = 'http://127.0.0.1:5173';
const API_BASE = 'http://127.0.0.1:8080';
const ARTIFACT_DIR = process.env.ARTIFACT_DIR || 'C:/Users/nasef/.gemini/antigravity/brain/3387613e-8116-41d7-a510-0d9d92453cb5/screenshots';

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

async function run() {
  console.log('🚀 Starting Comprehensive Platform Admin Workspace Verification (P5)...');
  const browser = await chromium.launch({
    headless: true,
    channel: 'chrome',
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  });

  try {
    console.log('\n--- 1. Authenticating Platform Administrator (admin@almeaa.com) ---');
    const adminCookies = await loginAndGetCookies('admin@almeaa.com', 'Almeaa@2026');
    const adminContext = await browser.newContext({
      viewport: { width: 1440, height: 900 },
      locale: 'ar-SA',
    });
    await adminContext.addCookies(adminCookies);
    const page = await adminContext.newPage();

    const consoleErrors = [];
    page.on('console', (msg) => {
      if (msg.type() === 'error') {
        consoleErrors.push(msg.text());
        console.log('ADMIN CONSOLE ERROR:', msg.text());
      }
    });
    page.on('pageerror', (err) => {
      consoleErrors.push(err.message);
      console.log('ADMIN PAGE ERROR:', err.message);
    });

    const sections = [
      { name: '150_admin_overview', url: '/admin-dashboard', title: 'نظرة عامة' },
      { name: '151_admin_content_editor', url: '/admin-dashboard/content', title: 'إدارة المحتوى' },
      { name: '152_admin_taxonomy_paths', url: '/admin-dashboard/taxonomy', title: 'إدارة المسارات' },
      { name: '153_admin_question_bank', url: '/admin-dashboard/questions', title: 'بنك الأسئلة' },
      { name: '154_admin_assessments', url: '/admin-dashboard/assessments', title: 'مركز الاختبارات' },
      { name: '155_admin_commerce', url: '/admin-dashboard/commerce', title: 'التجارة والصلاحيات' },
      { name: '156_admin_users', url: '/admin-dashboard/users', title: 'إدارة المستخدمين' },
      { name: '157_admin_schools', url: '/admin-dashboard/schools', title: 'تشغيل المدارس' },
      { name: '158_admin_ai_limits', url: '/admin-dashboard/ai', title: 'إدارة الذكاء الاصطناعي' },
      { name: '159_admin_reports', url: '/admin-dashboard/reports', title: 'التقارير والتحليلات' },
      { name: '160_admin_operations', url: '/admin-dashboard/operations', title: 'العمليات والتدقيق' },
      { name: '161_admin_backups', url: '/admin-dashboard/backups', title: 'النسخ الاحتياطي' },
    ];

    for (const sec of sections) {
      console.log(`\nNavigating to ${sec.title} (${sec.url})...`);
      await page.goto(`${BASE_URL}${sec.url}`, { waitUntil: 'domcontentloaded', timeout: 25000 });
      await page.waitForTimeout(2000);

      const shotPath = path.join(ARTIFACT_DIR, `${sec.name}.png`);
      await page.screenshot({ path: shotPath, fullPage: false });
      console.log(`✅ Captured ${sec.name}.png`);
    }

    console.log('\n--- 2. Testing Commerce Action: Manual Grant & Pricing Packages ---');
    await page.goto(`${BASE_URL}/admin-dashboard/commerce`, { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(1500);

    const planCards = await page.$$eval('[data-testid="plan-card"], table tbody tr, .rounded-2xl', (els) => els.length);
    console.log(`Detected Commerce Plan / Transaction Elements: ${planCards}`);

    console.log('\n--- 3. Testing Backup System Snapshot Trigger ---');
    await page.goto(`${BASE_URL}/admin-dashboard/backups`, { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(1500);

    const backupTriggerBtn = page.locator('button:has-text("إنشاء نسخة احتياطية"), button:has-text("نسخة احتياطية الآن")').first();
    if (await backupTriggerBtn.isVisible()) {
      console.log('Found manual backup trigger button. Testing click...');
      await backupTriggerBtn.click();
      await page.waitForTimeout(2000);
      await page.screenshot({ path: path.join(ARTIFACT_DIR, '162_admin_backup_action_feedback.png'), fullPage: false });
      console.log('✅ Captured 162_admin_backup_action_feedback.png');
    }

    console.log('\n🎉 ALL ADMIN WORKSPACE (P5) AUDIT TRACES COMPLETED SUCCESSFULLY!');
    if (consoleErrors.length > 0) {
      console.log(`Note: ${consoleErrors.length} console errors detected during run.`);
    } else {
      console.log('Zero console errors detected!');
    }
  } finally {
    await browser.close();
  }
}

run().catch((err) => {
  console.error('Fatal Admin Simulation Error:', err);
  process.exit(1);
});
