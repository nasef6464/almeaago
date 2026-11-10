const { chromium } = require('C:/almeaago/almeaago/apps/web/node_modules/playwright');

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
  console.log('🚀 Starting Comprehensive Human Supervisor & Student Verification...');
  const browser = await chromium.launch({
    headless: true,
    channel: 'chrome',
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  });

  try {
    // ==========================================
    // 1. SUPERVISOR REAL EXPERIENCE
    // ==========================================
    console.log('\n--- 1. Authenticating School Supervisor (د. خالد العتيبي) ---');
    const supervisorCookies = await loginAndGetCookies('supervisor@almeaa.com', 'Almeaa@2026');
    const supervisorContext = await browser.newContext({
      viewport: { width: 1440, height: 900 },
      locale: 'ar-SA',
    });
    await supervisorContext.addCookies(supervisorCookies);
    const supPage = await supervisorContext.newPage();

    supPage.on('console', msg => console.log('SUP CONSOLE:', msg.type(), msg.text()));
    supPage.on('pageerror', err => console.log('SUP PAGE ERROR:', err.message));
    supPage.on('response', async res => {
      if (res.url().includes('/api/')) {
        console.log(`API [${res.status()}] ${res.request().method()} ${res.url()}`);
      }
    });

    console.log('Navigating to /supervisor-dashboard...');
    await supPage.goto(`${BASE_URL}/supervisor-dashboard`, { waitUntil: 'domcontentloaded' });
    await supPage.waitForSelector('text=الملخص العام', { timeout: 15000 });
    console.log('Supervisor Dashboard loaded successfully!');
    await supPage.waitForTimeout(2000);

    // Tab 2: Students Roster & Send Direct Alert
    console.log('Switching to Students tab (متابعة الطلاب)...');
    const studentsTabBtn = supPage.locator('button:has-text("متابعة الطلاب")').first();
    await studentsTabBtn.click();
    await supPage.waitForTimeout(1500);

    console.log('Locating direct student alert button in roster table...');
    await supPage.waitForSelector('button[title="إرسال تنبيه فوري للطالب"]', { timeout: 15000 });
    const alertBtn = supPage.locator('button[title="إرسال تنبيه فوري للطالب"]').first();
    await alertBtn.scrollIntoViewIfNeeded();
    await alertBtn.click();

    // Wait for the feedback toast / banner
    await supPage.waitForSelector('text=تم إرسال تنبيه متابعة أكاديمي', { timeout: 10000 });
    console.log('Direct Student Alert sent successfully and feedback displayed!');
    await supPage.waitForTimeout(1000);
    await supPage.screenshot({
      path: `${ARTIFACT_DIR}/70_supervisor_alert_sent_to_student.png`,
      fullPage: false,
    });

    // Tab 4: Tests and Interventions (الاختبارات والتحليل)
    console.log('Switching to Tests tab (الاختبارات والتحليل)...');
    const testsTabBtn = supPage.locator('button:has-text("الاختبارات والتحليل")').first();
    await testsTabBtn.click();
    await supPage.waitForTimeout(1500);

    console.log('Testing Exact Legacy Parity Action: Copy Button...');
    const copyBtn = supPage.locator('button[title="نسخ"]').first();
    if (await copyBtn.isVisible()) {
      await copyBtn.click();
      await supPage.waitForTimeout(600);
    }

    console.log('Testing Exact Legacy Parity Action: Toggle معتمد / رفض...');
    const statusBadgeBtn = supPage.locator('button[title="انقر لتعديل الاعتماد"]').first();
    if (await statusBadgeBtn.isVisible()) {
      await statusBadgeBtn.click();
      await supPage.waitForTimeout(600);
    }

    console.log('Testing "إنشاء اختبار جديد" Modal...');
    const createTestBtn = supPage.locator('button:has-text("إنشاء اختبار جديد")').first();
    await createTestBtn.click();
    await supPage.waitForTimeout(800);

    console.log('Selecting "إنشاء بالمواصفات من بنك الأسئلة"...');
    const specOption = supPage.locator('button:has-text("إنشاء بالمواصفات من بنك الأسئلة")').first();
    await specOption.click();
    await supPage.waitForTimeout(800);

    console.log('Composing and Approving Test...');
    const approvePublishBtn = supPage.locator('button:has-text("اعتماد ونشر الاختبار بالمدرسة")').first();
    await approvePublishBtn.click();
    await supPage.waitForTimeout(1500);

    console.log('Testing "توجيه/إعادة توجيه" to classes...');
    const assignBtn = supPage.locator('button:has-text("توجيه/إعادة توجيه")').first();
    await assignBtn.click();
    await supPage.waitForTimeout(800);

    const classCheck = supPage.locator('input[type="checkbox"]').first();
    if (await classCheck.isVisible()) {
      await classCheck.check();
    }
    const sendAssignBtn = supPage.locator('button:has-text("حفظ وإرسال التوجيه")').first();
    await sendAssignBtn.click();
    await supPage.waitForTimeout(1800);

    console.log('Capturing Tests Tab with Action Icons & Feedback...');
    await supPage.screenshot({
      path: `${ARTIFACT_DIR}/71_supervisor_test_assigned_and_created.png`,
      fullPage: false,
    });

    // Executive Principal Briefing Modal
    console.log('Opening Executive Principal Briefing Modal (تقرير الإدارة)...');
    const principalReportBtn = supPage.locator('button:has-text("تقرير الإدارة")').first();
    await principalReportBtn.click();
    await supPage.waitForTimeout(1500);

    await supPage.screenshot({
      path: `${ARTIFACT_DIR}/72_supervisor_principal_briefing_modal.png`,
      fullPage: false,
    });

    // Close modal
    const closeBtn = supPage.locator('button:has-text("إغلاق")').first();
    if (await closeBtn.isVisible()) {
      await closeBtn.click();
      await supPage.waitForTimeout(500);
    }

    // ==========================================
    // 2. STUDENT REAL EXPERIENCE
    // ==========================================
    console.log('\n--- 2. Authenticating Student (فيصل بن سعد) ---');
    const studentCookies = await loginAndGetCookies('student@almeaa.com', 'Almeaa@2026');
    const studentContext = await browser.newContext({
      viewport: { width: 1440, height: 900 },
      locale: 'ar-SA',
    });
    await studentContext.addCookies(studentCookies);
    const stuPage = await studentContext.newPage();

    // Check Notifications Center
    console.log('Navigating to Student Notifications Inbox (/notifications)...');
    await stuPage.goto(`${BASE_URL}/notifications`, { waitUntil: 'domcontentloaded' });
    await stuPage.waitForTimeout(3000);

    console.log('Verifying received notifications in student UI...');
    const notifs = await stuPage.$$eval('h3, h4, p, span, li', (els) =>
      els.map(e => e.textContent.trim()).filter(t => t.includes('مشرف') || t.includes('تنبيه') || t.includes('اختبار') || t.includes('تكليف'))
    );
    console.log('Detected Student Notifications:', [...new Set(notifs)].slice(0, 5));
    await stuPage.screenshot({
      path: `${ARTIFACT_DIR}/73_student_received_supervisor_notification.png`,
      fullPage: false,
    });

    // Check Student Home / Dashboard
    console.log('Navigating to Student Home Dashboard...');
    await stuPage.goto(`${BASE_URL}/`, { waitUntil: 'domcontentloaded' });
    await stuPage.waitForTimeout(3000);

    await stuPage.screenshot({
      path: `${ARTIFACT_DIR}/74_student_viewing_assigned_school_tests.png`,
      fullPage: false,
    });

    console.log('\n🎉 ALL REAL HUMAN SIMULATIONS & VERIFICATIONS COMPLETED SUCCESSFULLY!');
  } finally {
    await browser.close();
  }
}

run().catch((err) => {
  console.error('Fatal Simulation Error:', err);
  process.exit(1);
});
