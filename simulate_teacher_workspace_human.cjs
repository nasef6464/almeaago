const { chromium } = require('C:/almeaago/almeaago/apps/web/node_modules/playwright');

const BASE_URL = 'http://127.0.0.1:5173';
const API_BASE = 'http://127.0.0.1:8080';
const ARTIFACT_DIR = 'C:/Users/nasef/.gemini/antigravity/brain/0ccfb08a-58bb-4c4b-b298-4bd5e2ebea66';

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

async function runTeacherSimulation() {
  console.log('🚀 Starting Comprehensive Human School Teacher Workspace & Smart Classroom Audit...');
  const browser = await chromium.launch({
    headless: true,
    channel: 'chrome',
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  });

  try {
    console.log('\n--- 1. Authenticating School Teacher (أ. فهد القحطاني) ---');
    const teacherCookies = await loginAndGetCookies('teacher@almeaa.com', 'Almeaa@2026');
    const teacherContext = await browser.newContext({
      viewport: { width: 1440, height: 900 },
      locale: 'ar-SA',
    });
    await teacherContext.addCookies(teacherCookies);
    const page = await teacherContext.newPage();

    page.on('console', (msg) => {
      if (msg.type() === 'error') console.log('TEACHER CONSOLE ERROR:', msg.text());
    });
    page.on('pageerror', (err) => console.log('TEACHER PAGE ERROR:', err.message));

    // ========================================================
    // TAB 1: OVERVIEW (نظرة عامة)
    // ========================================================
    console.log('\n--- 2. Navigating to /school-teacher-dashboard ---');
    await page.goto(`${BASE_URL}/school-teacher-dashboard`, { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('text=لوحة معلم المدرسة', { timeout: 15000 });
    console.log('Teacher Dashboard loaded successfully!');
    await page.waitForTimeout(2000);

    console.log('Capturing TAB 1: Overview...');
    await page.screenshot({
      path: `${ARTIFACT_DIR}/80_teacher_overview_tab.png`,
      fullPage: false,
    });

    // ========================================================
    // TAB 2: SMART CLASSROOM (إدارة الحصص والجدول)
    // ========================================================
    console.log('\n--- 3. Testing TAB 2: Smart Classroom (إدارة الحصص والجدول) ---');
    const smartTabBtn = page.locator('button:has-text("إدارة الحصص والجدول")').first();
    await smartTabBtn.click();
    await page.waitForTimeout(1500);

    console.log('Opening Smart Classroom Session Scheduler Modal...');
    const launchModalBtn = page.locator('button:has-text("إطلاق حصة الآن")').first();
    await launchModalBtn.click();
    await page.waitForTimeout(1200);

    console.log('Capturing Smart Classroom Scheduler Modal...');
    await page.screenshot({
      path: `${ARTIFACT_DIR}/81_teacher_smart_classroom_modal.png`,
      fullPage: false,
    });

    console.log('Launching Smart Live Session with Speed Challenge ⚡...');
    const startSessionBtn = page.locator('button:has-text("إطلاق الحصة الذكية الآن")').first();
    await startSessionBtn.click();
    await page.waitForTimeout(3000);

    console.log('Capturing Live Smart Classroom Teacher Console...');
    await page.screenshot({
      path: `${ARTIFACT_DIR}/82_teacher_live_session_console.png`,
      fullPage: false,
    });

    // Return to teacher dashboard to verify active session banner
    console.log('Returning to /school-teacher-dashboard to verify active session banner...');
    await page.goto(`${BASE_URL}/school-teacher-dashboard`, { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('text=لوحة معلم المدرسة', { timeout: 15000 });
    await page.waitForTimeout(2000);

    console.log('Capturing Dashboard with Active Session Banner...');
    await page.screenshot({
      path: `${ARTIFACT_DIR}/83_teacher_dashboard_active_session_banner.png`,
      fullPage: false,
    });

    // ========================================================
    // TAB 3: PREPARED QUESTIONS (بنك التحضير المسبق)
    // ========================================================
    console.log('\n--- 4. Testing TAB 3: Prepared Questions Bank ---');
    const prepTabBtn = page.locator('button:has-text("بنك التحضير المسبق")').first();
    await prepTabBtn.click();
    await page.waitForTimeout(2000);

    // Select questions
    const checkboxes = page.locator('input[type="checkbox"]');
    const cbCount = await checkboxes.count();
    if (cbCount > 0) {
      await checkboxes.first().click();
      await page.waitForTimeout(500);
    }

    console.log('Capturing TAB 3: Prepared Questions Bank with exact actions...');
    await page.screenshot({
      path: `${ARTIFACT_DIR}/84_teacher_prepared_questions_tab.png`,
      fullPage: false,
    });

    // Test previewing a question
    const previewEyeBtn = page.locator('button[title="معاينة السؤال"]').first();
    if (await previewEyeBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
      console.log('Opening Question Preview Modal in Tab 3...');
      await previewEyeBtn.click();
      await page.waitForTimeout(1000);
      await page.screenshot({
        path: `${ARTIFACT_DIR}/89_teacher_question_preview_modal.png`,
        fullPage: false,
      });
      // Close preview modal
      const closePreviewBtn = page.locator('button:has-text("إغلاق المعاينة")').first();
      await closePreviewBtn.click();
      await page.waitForTimeout(500);
    }

    // ========================================================
    // TAB 4: REPORTS (تقارير الحصص والمهارات)
    // ========================================================
    console.log('\n--- 5. Testing TAB 4: Smart Classroom Reports ---');
    const reportsTabBtn = page.locator('button:has-text("تقارير الحصص والمهارات")').first();
    await reportsTabBtn.click();
    await page.waitForTimeout(2000);

    console.log('Capturing TAB 4: Smart Classroom Reports...');
    await page.screenshot({
      path: `${ARTIFACT_DIR}/85_teacher_classroom_reports_tab.png`,
      fullPage: false,
    });

    // ========================================================
    // TAB 5: SKILLS RADAR (رادار فجوات الفصول)
    // ========================================================
    console.log('\n--- 6. Testing TAB 5: Class Skills Radar ---');
    const radarTabBtn = page.locator('button:has-text("رادار فجوات الفصول")').first();
    await radarTabBtn.click();
    await page.waitForTimeout(1500);

    console.log('Capturing TAB 5: Skills Radar...');
    await page.screenshot({
      path: `${ARTIFACT_DIR}/86_teacher_skills_radar_tab.png`,
      fullPage: false,
    });

    // ========================================================
    // TAB 6: ASSESSMENTS (اختباراتي وتكليفاتي)
    // ========================================================
    console.log('\n--- 7. Testing TAB 6: Assessments with Exact Legacy Parity Actions ---');
    const assessTabBtn = page.locator('button:has-text("اختباراتي وتكليفاتي")').first();
    await assessTabBtn.click();
    await page.waitForTimeout(1500);

    // Test Copy button
    const copyBtn = page.locator('button[title="نسخ"]').first();
    if (await copyBtn.isVisible()) {
      await copyBtn.click();
      await page.waitForTimeout(600);
    }

    // Test معتمد / رفض toggle
    const toggleBadge = page.locator('button[title="انقر لتعديل الاعتماد"]').first();
    if (await toggleBadge.isVisible()) {
      await toggleBadge.click();
      await page.waitForTimeout(600);
    }

    // Test remind button
    const remindBtn = page.locator('button:has-text("تذكير من لم يختبروا")').first();
    if (await remindBtn.isVisible()) {
      await remindBtn.click();
      await page.waitForTimeout(600);
    }

    console.log('Capturing TAB 6: Assessments Tab...');
    await page.screenshot({
      path: `${ARTIFACT_DIR}/87_teacher_assessments_tab.png`,
      fullPage: false,
    });

    // ========================================================
    // TAB 7: CERTIFICATES (شهادات التقدير والتحفيز)
    // ========================================================
    console.log('\n--- 8. Testing TAB 7: Appreciation Certificate Generator ---');
    const certTabBtn = page.locator('button:has-text("شهادات التقدير والتحفيز")').first();
    await certTabBtn.click();
    await page.waitForTimeout(1500);

    console.log('Opening Appreciation Certificate Modal...');
    const openCertModalBtn = page.locator('button:has-text("فتح مولد الشهادات الرسمي")').first();
    await openCertModalBtn.click();
    await page.waitForTimeout(1500);

    console.log('Capturing Appreciation Certificate Modal Canvas...');
    await page.screenshot({
      path: `${ARTIFACT_DIR}/88_teacher_appreciation_certificate_modal.png`,
      fullPage: false,
    });

    console.log('\n🎉 ALL TEACHER WORKSPACE & SMART CLASSROOM AUDITS COMPLETED SUCCESSFULLY!');
  } finally {
    await browser.close();
  }
}

runTeacherSimulation().catch((err) => {
  console.error('Fatal Teacher Simulation Error:', err);
  process.exit(1);
});
