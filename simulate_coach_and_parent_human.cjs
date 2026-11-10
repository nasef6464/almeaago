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

async function run() {
  console.log('🚀 Starting Comprehensive Human Coach & Parent Verification...');
  const browser = await chromium.launch({
    headless: true,
    channel: 'chrome',
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  });

  try {
    // ========================================================
    // 1. COACH / PLATFORM TRAINER (أ. طارق المحمدي)
    // ========================================================
    console.log('\n--- 1. Authenticating Platform Coach (أ. طارق المحمدي) ---');
    const coachCookies = await loginAndGetCookies('coach@almeaa.com', 'Almeaa@2026');
    const coachContext = await browser.newContext({
      viewport: { width: 1440, height: 900 },
      locale: 'ar-SA',
    });
    await coachContext.addCookies(coachCookies);
    const coachPage = await coachContext.newPage();

    console.log('Navigating to /instructor-dashboard...');
    await coachPage.goto(`${BASE_URL}/instructor-dashboard`, { waitUntil: 'domcontentloaded' });
    await coachPage.waitForSelector('text=لوحة مدرب المنصة', { timeout: 15000 });
    console.log('Coach Dashboard loaded successfully!');
    await coachPage.waitForTimeout(2000);

    // Tab 1: Overview
    console.log('Capturing TAB 1: Coach Overview...');
    await coachPage.screenshot({
      path: `${ARTIFACT_DIR}/90_coach_overview_tab.png`,
      fullPage: false,
    });

    // Tab 2: Courses
    console.log('Switching to TAB 2: Courses...');
    const coursesTab = coachPage.locator('button:has-text("دوراتي ومساراتي")').first();
    await coursesTab.click();
    await coachPage.waitForTimeout(1500);

    console.log('Capturing TAB 2: Courses...');
    await coachPage.screenshot({
      path: `${ARTIFACT_DIR}/91_coach_courses_tab.png`,
      fullPage: false,
    });

    // Open Create Course Modal
    console.log('Opening Create Course Modal...');
    const addCourseBtn = coachPage.locator('button:has-text("إضافة دورة تدريبية")').first();
    await addCourseBtn.click();
    await coachPage.waitForTimeout(1000);

    console.log('Capturing Create Course Modal...');
    await coachPage.screenshot({
      path: `${ARTIFACT_DIR}/92_coach_create_course_modal.png`,
      fullPage: false,
    });

    // Close Modal
    const cancelModalBtn = coachPage.locator('button:has-text("إلغاء")').first();
    await cancelModalBtn.click();
    await coachPage.waitForTimeout(500);

    // Tab 3: Live Sessions
    console.log('Switching to TAB 3: Live Sessions...');
    const liveTab = coachPage.locator('button:has-text("اللقاءات المباشرة")').first();
    await liveTab.click();
    await coachPage.waitForTimeout(1500);

    console.log('Capturing TAB 3: Live Sessions...');
    await coachPage.screenshot({
      path: `${ARTIFACT_DIR}/93_coach_live_sessions_tab.png`,
      fullPage: false,
    });

    // Tab 4: Quizzes with Exact Legacy Actions
    console.log('Switching to TAB 4: Quizzes...');
    const quizzesTab = coachPage.locator('button:has-text("الاختبارات والتقييمات")').first();
    await quizzesTab.click();
    await coachPage.waitForTimeout(1500);

    // Test toggle status on first quiz
    const quizStatusBtn = coachPage.locator('button[title*="حالة الاعتماد"]').first();
    if (await quizStatusBtn.isVisible()) {
      await quizStatusBtn.click();
      await coachPage.waitForTimeout(1000);
    }

    console.log('Capturing TAB 4: Quizzes...');
    await coachPage.screenshot({
      path: `${ARTIFACT_DIR}/94_coach_quizzes_tab.png`,
      fullPage: false,
    });

    // Tab 5: Questions Bank
    console.log('Switching to TAB 5: Questions Bank...');
    const questionsTab = coachPage.locator('button:has-text("بنك الأسئلة والتمارين")').first();
    await questionsTab.click();
    await coachPage.waitForTimeout(1500);

    console.log('Capturing TAB 5: Questions Bank...');
    await coachPage.screenshot({
      path: `${ARTIFACT_DIR}/95_coach_questions_tab.png`,
      fullPage: false,
    });

    // Tab 6: Skills Radar
    console.log('Switching to TAB 6: Skills Radar...');
    const skillsTab = coachPage.locator('button:has-text("رادار إتقان المتدربين")').first();
    await skillsTab.click();
    await coachPage.waitForTimeout(1500);

    console.log('Capturing TAB 6: Skills Radar...');
    await coachPage.screenshot({
      path: `${ARTIFACT_DIR}/96_coach_skills_radar_tab.png`,
      fullPage: false,
    });

    // Tab 7: Q&A
    console.log('Switching to TAB 7: Q&A...');
    const qaTab = coachPage.locator('button:has-text("استفسارات الطلاب")').first();
    await qaTab.click();
    await coachPage.waitForTimeout(1500);

    console.log('Capturing TAB 7: Q&A...');
    await coachPage.screenshot({
      path: `${ARTIFACT_DIR}/97_coach_qa_tab.png`,
      fullPage: false,
    });

    await coachContext.close();

    // ========================================================
    // 2. PARENT (سعد بن ناصر - ولي أمر)
    // ========================================================
    console.log('\n--- 2. Authenticating Parent (سعد بن ناصر) ---');
    const parentCookies = await loginAndGetCookies('parent@almeaa.com', 'Almeaa@2026');
    const parentContext = await browser.newContext({
      viewport: { width: 1440, height: 900 },
      locale: 'ar-SA',
    });
    await parentContext.addCookies(parentCookies);
    const parentPage = await parentContext.newPage();

    console.log('Navigating to /parent-dashboard...');
    await parentPage.goto(`${BASE_URL}/parent-dashboard`, { waitUntil: 'domcontentloaded' });
    await parentPage.waitForSelector('text=متابعة الأبناء', { timeout: 15000 });
    console.log('Parent Dashboard loaded successfully!');
    await parentPage.waitForTimeout(2000);

    // Tab 1: Overview
    console.log('Capturing TAB 1: Parent Overview...');
    await parentPage.screenshot({
      path: `${ARTIFACT_DIR}/100_parent_overview_tab.png`,
      fullPage: false,
    });

    // Tab 2: Results
    console.log('Switching to TAB 2: Results...');
    const resultsTab = parentPage.locator('button:has-text("نتائج الاختبارات")').first();
    await resultsTab.click();
    await parentPage.waitForTimeout(2000);

    console.log('Capturing TAB 2: Results...');
    await parentPage.screenshot({
      path: `${ARTIFACT_DIR}/101_parent_results_tab.png`,
      fullPage: false,
    });

    // Tab 3: Skills
    console.log('Switching to TAB 3: Skills...');
    const parentSkillsTab = parentPage.locator('button:has-text("المهارات والفجوات")').first();
    await parentSkillsTab.click();
    await parentPage.waitForTimeout(2000);

    console.log('Capturing TAB 3: Skills...');
    await parentPage.screenshot({
      path: `${ARTIFACT_DIR}/102_parent_skills_tab.png`,
      fullPage: false,
    });

    // Tab 4: Weekly Report
    console.log('Switching to TAB 4: Weekly Report...');
    const reportTab = parentPage.locator('button:has-text("تقرير الأسبوع")').first();
    await reportTab.click();
    await parentPage.waitForTimeout(2000);

    console.log('Capturing TAB 4: Weekly Report...');
    await parentPage.screenshot({
      path: `${ARTIFACT_DIR}/103_parent_weekly_report_tab.png`,
      fullPage: false,
    });

    // Tab 5: Link Child
    console.log('Switching to TAB 5: Link Child...');
    const linkTab = parentPage.locator('button:has-text("ربط ابن جديد")').first();
    await linkTab.click();
    await parentPage.waitForTimeout(1500);

    console.log('Capturing TAB 5: Link Child...');
    await parentPage.screenshot({
      path: `${ARTIFACT_DIR}/104_parent_link_child_tab.png`,
      fullPage: false,
    });

    // Tab 6: Approvals
    console.log('Switching to TAB 6: Approvals...');
    const approvalsTab = parentPage.locator('button:has-text("الموافقات")').first();
    await approvalsTab.click();
    await parentPage.waitForTimeout(1500);

    console.log('Capturing TAB 6: Approvals...');
    await parentPage.screenshot({
      path: `${ARTIFACT_DIR}/105_parent_approvals_tab.png`,
      fullPage: false,
    });

    await parentContext.close();

    console.log('\n🎉 ALL COACH & PARENT WORKSPACES AUDITED AND CAPTURED SUCCESSFULLY!');
  } catch (err) {
    console.error('Audit failed with error:', err);
    process.exit(1);
  } finally {
    await browser.close();
  }
}

run();
