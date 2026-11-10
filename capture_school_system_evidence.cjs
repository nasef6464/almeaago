const { chromium } = require('C:/almeaago/almeaago/apps/web/node_modules/playwright');
const fs = require('fs');
const path = require('path');

const API_BASE = 'http://127.0.0.1:8080';
const WEB_BASE = 'http://127.0.0.1:5173';
const SCREENSHOTS_DIR = 'C:/Users/nasef/.gemini/antigravity/brain/3387613e-8116-41d7-a510-0d9d92453cb5/screenshots';

if (!fs.existsSync(SCREENSHOTS_DIR)) {
  fs.mkdirSync(SCREENSHOTS_DIR, { recursive: true });
}

async function getAuthCookies(email, password) {
  const res = await fetch(`${API_BASE}/api/v1/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });
  if (!res.ok) throw new Error(`Login failed for ${email}`);
  const setCookies = res.headers.getSetCookie();
  const cookies = [];
  for (const c of setCookies) {
    const parts = c.split(';')[0].split('=');
    const name = parts[0].trim();
    const value = parts.slice(1).join('=').trim();
    cookies.push({
      name,
      value,
      domain: '127.0.0.1',
      path: '/',
      httpOnly: false,
      secure: false,
      sameSite: 'Lax',
    });
  }
  return cookies;
}

async function run() {
  console.log('Starting Playwright with Chrome channel...');
  const browser = await chromium.launch({
    headless: true,
    channel: 'chrome',
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  });

  // 1. Admin Context: School Contract Configurator
  console.log('[1/3] Capturing Admin School Contract Configurator...');
  const adminCookies = await getAuthCookies('admin@almeaa.com', 'Almeaa@2026');
  const adminCtx = await browser.newContext({ viewport: { width: 1440, height: 900 }, locale: 'ar-SA' });
  await adminCtx.addCookies(adminCookies);
  const adminPage = await adminCtx.newPage();

  await adminPage.goto(`${WEB_BASE}/admin/schools`, { waitUntil: 'domcontentloaded', timeout: 30000 });
  await adminPage.waitForTimeout(2000);

  // Click on the school card
  const schoolCard = adminPage.locator('text=مدارس المئة النموذجية الأهلية').first();
  if (await schoolCard.isVisible()) {
    await schoolCard.click();
    await adminPage.waitForTimeout(1500);
  }

  // Click on the Contract tab
  const contractTab = adminPage.locator('button:has-text("العقد والوحدات")').first();
  if (await contractTab.isVisible()) {
    await contractTab.click();
    await adminPage.waitForTimeout(1500);
  }

  const ss1 = path.join(SCREENSHOTS_DIR, '301_admin_school_contract_configurator.png');
  await adminPage.screenshot({ path: ss1, fullPage: true });
  console.log('  ✅ Saved:', ss1);
  await adminCtx.close();

  // 2. Director Context: School Director Dashboard with Logo
  console.log('[2/3] Capturing School Director Dashboard with Logo...');
  const directorCookies = await getAuthCookies('director@almeaa.com', 'Almeaa@2026');
  const dirCtx = await browser.newContext({ viewport: { width: 1440, height: 900 }, locale: 'ar-SA' });
  await dirCtx.addCookies(directorCookies);
  const dirPage = await dirCtx.newPage();

  await dirPage.goto(`${WEB_BASE}/schools/director`, { waitUntil: 'domcontentloaded', timeout: 30000 });
  await dirPage.waitForTimeout(2000);

  const ss2 = path.join(SCREENSHOTS_DIR, '302_school_director_dashboard_with_logo.png');
  await dirPage.screenshot({ path: ss2, fullPage: true });
  console.log('  ✅ Saved:', ss2);
  await dirCtx.close();

  // 3. Teacher Context: Teacher Workspace & Royal Certificate
  console.log('[3/3] Capturing Teacher Certificate Modal...');
  const teacherCookies = await getAuthCookies('teacher@almeaa.com', 'Almeaa@2026');
  const teacherCtx = await browser.newContext({ viewport: { width: 1440, height: 900 }, locale: 'ar-SA' });
  await teacherCtx.addCookies(teacherCookies);
  const teacherPage = await teacherCtx.newPage();

  await teacherPage.goto(`${WEB_BASE}/teacher/workspace`, { waitUntil: 'domcontentloaded', timeout: 30000 });
  await teacherPage.waitForTimeout(2000);

  // Look for certificate button
  const certBtn = teacherPage.locator('button:has-text("شهادة"), button:has-text("شهادات")').first();
  if (await certBtn.isVisible()) {
    await certBtn.click();
    await teacherPage.waitForTimeout(1000);
  }

  const ss3 = path.join(SCREENSHOTS_DIR, '303_teacher_workspace_school_context.png');
  await teacherPage.screenshot({ path: ss3, fullPage: true });
  console.log('  ✅ Saved:', ss3);
  await teacherCtx.close();

  await browser.close();
  console.log('🎉 All 3 school verification screenshots captured successfully!');
}

run().catch((err) => {
  console.error('Error during capture:', err);
  process.exit(1);
});
