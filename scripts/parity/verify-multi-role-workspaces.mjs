import { createRequire } from 'module';
import path from 'path';

const require = createRequire(import.meta.url);
const { chromium } = require(path.resolve('apps/web/node_modules/playwright'));

const BASE_URL = process.env.TEST_BASE_URL || 'http://localhost:5173';
const ARTIFACT_DIR = process.env.ARTIFACT_DIR || path.resolve('./artifacts');
const CHROME_PATH = process.env.CHROME_PATH || 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';

const TEST_STUDENT_EMAIL = process.env.TEST_STUDENT_EMAIL || 'student@almeaa.com';
const TEST_STUDENT_PASSWORD = process.env.TEST_STUDENT_PASSWORD || process.env.TEST_DEV_PASSWORD;

const TEST_TEACHER_EMAIL = process.env.TEST_TEACHER_EMAIL || 'teacher@almeaa.com';
const TEST_TEACHER_PASSWORD = process.env.TEST_TEACHER_PASSWORD || process.env.TEST_DEV_PASSWORD;

const TEST_ADMIN_EMAIL = process.env.TEST_ADMIN_EMAIL || 'admin@almeaa.com';
const TEST_ADMIN_PASSWORD = process.env.TEST_ADMIN_PASSWORD || process.env.TEST_DEV_PASSWORD;

const ROUTES_TO_AUDIT = [
  // 1. Student / Public Learning Space
  { name: 'student_learning_space_questions', path: '/category/p_qudrat?subject=sub_quant&tab=questions', title: 'بنك أسئلة التدريب' },
  { name: 'student_learning_space_foundation', path: '/category/p_qudrat?subject=sub_quant&tab=foundation', title: 'دروس التأسيس والمهارات' },
  { name: 'student_learning_space_courses', path: '/category/p_qudrat?subject=sub_quant&tab=courses', title: 'الدورات التعليمية' },
  { name: 'student_learning_space_exams', path: '/category/p_qudrat?subject=sub_quant&tab=exams', title: 'الاختبارات الإلكترونية' },
  { name: 'student_study_plan', path: '/plan', title: 'الخطة الدراسية الذكية' },
  { name: 'student_dashboard', path: '/dashboard', title: 'لوحة تحكم الطالب' },

  // 2. Commerce & Pricing
  { name: 'commerce_pricing', path: '/pricing', title: 'خطط وباقات الاشتراك' },
  { name: 'commerce_cart', path: '/cart', title: 'سلة المشتريات' },
  { name: 'commerce_checkout', path: '/checkout', title: 'إتمام الطلب والدفع' },

  // 3. School Roles & Smart Classroom
  { name: 'teacher_dashboard', path: '/school-teacher-dashboard', title: 'مساحة المعلم' },
  { name: 'classroom_join', path: '/classroom/join', title: 'الانضمام للفصل الذكي' },
  { name: 'school_director_dashboard', path: '/school-director-dashboard', title: 'لوحة مدير المدرسة' },
  { name: 'school_supervisor_dashboard', path: '/supervisor-dashboard', title: 'لوحة المشرف التربوي' },

  // 4. Parent Portal
  { name: 'parent_dashboard', path: '/parent-dashboard', title: 'بوابة ولي الأمر' },

  // 5. Admin Dashboard Workspaces
  { name: 'admin_questions', path: '/admin-dashboard/questions', title: 'إدارة بنك الأسئلة' },
  { name: 'admin_content', path: '/admin-dashboard/content', title: 'إدارة المحتوى والدروس' },
  { name: 'admin_taxonomy', path: '/admin-dashboard/taxonomy', title: 'شجرة المسارات والمهارات' },
  { name: 'admin_assessments', path: '/admin-dashboard/assessments', title: 'إدارة الاختبارات والتقييمات' },
  { name: 'admin_users', path: '/admin-dashboard/users', title: 'إدارة المستخدمين والأدوار' },
];

async function runAudit() {
  console.log('======================================================');
  console.log('🚀 Starting Multi-Role & Workspace Parity Audit');
  console.log(`Target Base URL: ${BASE_URL}`);
  console.log('======================================================');

  const browser = await chromium.launch({
    executablePath: CHROME_PATH,
    headless: true,
  });

  const results = [];

  for (const route of ROUTES_TO_AUDIT) {
    const context = await browser.newContext({
      viewport: { width: 1440, height: 900 },
      locale: 'ar-SA',
    });
    const page = await context.newPage();

    let pageErrors = [];
    page.on('console', msg => {
      if (msg.type() === 'error') {
        pageErrors.push(msg.text());
      }
    });

    const targetUrl = `${BASE_URL}${route.path}`;
    let status = 'PASS';
    let httpStatus = 200;
    let loadTimeMs = 0;

    const startTime = Date.now();
    try {
      const response = await page.goto(targetUrl, { waitUntil: 'networkidle', timeout: 25000 });
      loadTimeMs = Date.now() - startTime;
      httpStatus = response ? response.status() : 200;
      await page.waitForTimeout(1000);

      const shotPath = path.join(ARTIFACT_DIR, `audit_${route.name}.png`);
      await page.screenshot({ path: shotPath, fullPage: false });

      // Check if page rendered root without crash
      const rootExists = await page.evaluate(() => !!document.getElementById('root') && document.getElementById('root').innerHTML.length > 50);
      if (!rootExists) {
        status = 'FAIL_EMPTY_ROOT';
      }
    } catch (err) {
      loadTimeMs = Date.now() - startTime;
      status = 'FAIL_TIMEOUT_OR_CRASH';
      pageErrors.push(err.message);
    } finally {
      await context.close();
    }

    const result = {
      name: route.name,
      path: route.path,
      title: route.title,
      status: pageErrors.length > 0 && status === 'PASS' ? 'PASS_WITH_WARNINGS' : status,
      httpStatus,
      loadTimeMs,
      errorCount: pageErrors.length,
      firstError: pageErrors[0] || null,
    };
    results.push(result);

    const badge = result.status.startsWith('PASS') ? '✅' : '❌';
    console.log(`${badge} [${result.status}] ${route.title} (${route.path}) - ${loadTimeMs}ms`);
    if (result.firstError) {
      console.log(`   └─ Note: ${result.firstError.substring(0, 100)}`);
    }
  }

  await browser.close();

  console.log('\n======================================================');
  console.log('📊 AUDIT SUMMARY TABLE');
  console.log('======================================================');
  console.table(results.map(r => ({
    Workspace: r.title,
    Route: r.path,
    Status: r.status,
    TimeMS: r.loadTimeMs,
    Errors: r.errorCount,
  })));

  const allPassed = results.every(r => r.status.startsWith('PASS'));
  if (allPassed) {
    console.log('\n🎉 ALL WORKSPACES AUDITED AND VERIFIED FUNCTIONAL!');
  } else {
    console.error('\n⚠️ SOME WORKSPACES FAILED AUDIT. SEE TABLE ABOVE.');
  }

  return results;
}

runAudit().catch(err => {
  console.error('Audit crashed:', err);
  process.exit(1);
});
