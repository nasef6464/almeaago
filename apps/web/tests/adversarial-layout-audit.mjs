import { chromium } from '@playwright/test';
import fs from 'fs';
import path from 'path';

const SCREENSHOTS_DIR = 'C:/almeaago/.agents/teamwork/m1_challenger_1/screenshots';
fs.mkdirSync(SCREENSHOTS_DIR, { recursive: true });

const studentUser = {
  id: '018f0000-0000-7000-8000-000000000001',
  name: 'سلطان القحطاني',
  email: 'student@example.com',
  status: 'active',
  emailVerified: true,
  role: 'student',
  roles: ['student'],
  permissions: ['content:read', 'assessment:take'],
  avatarUrl: '',
};

const mockCourseId = 'course-101';
const mockCourseData = {
  course: {
    id: mockCourseId,
    title: 'دورة التأسيس الشاملة في القدرات العامة',
    description: 'الدورة المعيارية الذهبية لاجتياز اختبار القدرات العامة خطوة بخطوة مع تدريبات مكثفة.',
    instructorName: 'أ. فهد التميمي',
    durationMinutes: 180,
    level: 'beginner',
    thumbnailAssetId: 'asset-thumb-1',
    dripContentEnabled: false,
    certificateEnabled: true,
    modules: [
      {
        id: 'mod-1',
        title: 'القسم الأول: أساسيات الحساب والكسور العشرية',
        description: 'شرح مهارات العمليات الحسابية والكسور',
        sortOrder: 1,
        lessons: [
          {
            id: 'les-1',
            title: 'مقدمة واستراتيجيات الحل السريع',
            description: 'فهم معايير قياس وطرق إدارة الوقت',
            type: 'video',
            durationSeconds: 900,
            isLocked: false,
            isPreview: true,
            commerceLocked: false,
            sortOrder: 1,
          },
          {
            id: 'les-2',
            title: 'قوانين الأسس والجذور وتطبيقاتها',
            description: 'تبسيط المعادلات الأسية والجذور المربعة',
            type: 'video',
            durationSeconds: 1200,
            isLocked: false,
            isPreview: false,
            commerceLocked: false,
            sortOrder: 2,
          },
        ],
      },
    ],
    access: {
      allowed: true,
      configured: true,
      reason: 'enrolled',
      productId: 'prod-course-101',
      entitlementId: 'ent-1',
      entitlementSource: 'subscription',
    },
  },
};

const mockLessonDetail = {
  id: 'les-1',
  title: 'مقدمة واستراتيجيات الحل السريع',
  description: 'فهم معايير قياس وطرق إدارة الوقت',
  lessonType: 'video',
  type: 'video',
  durationSeconds: 900,
  isLocked: false,
  isPreview: true,
  commerceLocked: false,
  sortOrder: 1,
  contentText: 'أهلاً بكم في أولى جلسات التأسيس للقدرات العامة.',
  videoUrl: '',
  videoSource: 'upload',
};

const VIEWPORTS = [
  { name: '320px (ultra-small mobile)', width: 320, height: 568, isDesktop: false },
  { name: '390px (standard mobile)', width: 390, height: 844, isDesktop: false },
  { name: '768px (tablet portrait)', width: 768, height: 1024, isDesktop: false },
  { name: '820px (tablet landscape)', width: 820, height: 1180, isDesktop: false },
  { name: '1024px (desktop transition)', width: 1024, height: 768, isDesktop: true },
  { name: '1440px (standard desktop)', width: 1440, height: 900, isDesktop: true },
  { name: '1920px (full HD wide desktop)', width: 1920, height: 1080, isDesktop: true },
  { name: '2560px (2K / QHD)', width: 2560, height: 1440, isDesktop: true },
  { name: '3840px (ultra-wide/4K)', width: 3840, height: 2160, isDesktop: true },
];

async function setupPageMocks(page) {
  await page.addInitScript(() => {
    sessionStorage.setItem('almeaa-dismissed-announcement-ads', JSON.stringify(['ad_welcome_offer', 'ad_qudrat_launch', 'ad_nafes_banner']));
    localStorage.setItem('almeaa-dismissed-announcement-ads', JSON.stringify(['ad_welcome_offer', 'ad_qudrat_launch', 'ad_nafes_banner']));
  });

  await page.route('**/api/v1/auth/me', (route) =>
    route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ user: studentUser }) })
  );
  await page.route('**/api/v1/auth/csrf', (route) =>
    route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ csrfToken: 'csrf-token' }) })
  );
  await page.route('**/api/v1/taxonomy/bootstrap*', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        paths: [
          { id: 'path-1', code: 'QUDRAT', name: 'القدرات العامة', color: 'indigo' },
          { id: 'path-2', code: 'TAHSILI', name: 'التحصيلي', color: 'emerald' },
        ],
        levels: [],
        subjects: [],
      }),
    })
  );
  await page.route('**/api/v1/assessment-assignments/mine*', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        items: [
          {
            assignmentId: 'asg-1',
            assessmentId: 'asm-1',
            assessmentVersion: 1,
            title: 'اختبار تجريبي: قياس اللفظي والكمي الموحد',
            attemptCount: 1,
            maxAttempts: 3,
            canStart: true,
          },
        ],
        page: 1,
        limit: 10,
        hasMore: false,
      }),
    })
  );
  await page.route('**/api/v1/learning-spaces/courses/course-101/lessons/*', (route) =>
    route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ lesson: mockLessonDetail }) })
  );
  await page.route('**/api/v1/learning-spaces/courses/course-101', (route) =>
    route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ course: mockCourseData.course }) })
  );
  await page.route('**/api/v1/courses/course-101*', (route) =>
    route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(mockCourseData) })
  );
  await page.route('**/api/v1/content/public-contact-widget*', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        enabled: true,
        channel: 'whatsapp',
        whatsappNumber: '+966500000000',
        whatsappMessage: 'مرحبا',
        openInNewTab: true,
        showOnPublicPages: true,
        showOnDashboardPages: true,
      }),
    })
  );
}

async function runAudit() {
  console.log('=== STARTING EMPIRICAL ADVERSARIAL LAYOUT AUDIT ===\n');

  const browser = await chromium.launch({
    headless: true,
    executablePath: 'C:\\Users\\nasef\\AppData\\Local\\ms-playwright\\chromium-1248\\chrome-win64\\chrome.exe',
  });

  const results = {
    dashboard: [],
    courseLearning: [],
    drawerStress: [],
    summary: { totalTests: 0, passedTests: 0, failedTests: 0, failures: [] },
  };

  const context = await browser.newContext();
  const page = await context.newPage();
  await setupPageMocks(page);

  // Test 1: Student Dashboard Page across all viewports
  console.log('--- AUDITING STUDENT DASHBOARD PAGE (/dashboard) ---');
  for (const vp of VIEWPORTS) {
    await page.setViewportSize({ width: vp.width, height: vp.height });
    await page.goto('http://127.0.0.1:4173/dashboard');
    await page.waitForLoadState('networkidle');
    await page.waitForSelector('#overview');

    const evalData = await page.evaluate(() => {
      const doc = document.documentElement;
      const scrollWidth = doc.scrollWidth;
      const clientWidth = doc.clientWidth;
      const innerWidth = window.innerWidth;
      const hasHorizontalOverflow = scrollWidth > clientWidth;

      // Sidebar checks
      const sidebar = document.querySelector('aside[aria-label="تنقل لوحة الطالب"]');
      let sidebarRect = null;
      if (sidebar) {
        const r = sidebar.getBoundingClientRect();
        sidebarRect = {
          left: r.left,
          right: r.right,
          width: r.width,
          height: r.height,
          rightDiffFromWindow: Math.abs(r.right - innerWidth),
        };
      }

      // Max-w-5xl container checks
      const container5xl = document.querySelector('#overview > div.max-w-5xl, #overview .max-w-5xl');
      let container5xlRect = null;
      if (container5xl) {
        const r = container5xl.getBoundingClientRect();
        container5xlRect = {
          width: r.width,
          maxWidthCss: window.getComputedStyle(container5xl).maxWidth,
        };
      }

      // Check for any max-w-[1500px] occurrences in DOM
      const elementsWith1500 = Array.from(document.querySelectorAll('*')).filter((el) =>
        el.className && typeof el.className === 'string' && el.className.includes('1500px')
      ).map((el) => ({ tag: el.tagName, className: el.className }));

      return {
        scrollWidth,
        clientWidth,
        innerWidth,
        hasHorizontalOverflow,
        sidebarRect,
        container5xlRect,
        elementsWith1500,
      };
    });

    const checks = {
      viewport: vp.name,
      width: vp.width,
      scrollWidth: evalData.scrollWidth,
      clientWidth: evalData.clientWidth,
      overflowPass: !evalData.hasHorizontalOverflow,
      sidebarRightDocked: true,
      sidebarDiff: null,
      container5xlPass: true,
      max1500Absent: evalData.elementsWith1500.length === 0,
      errors: [],
    };

    if (evalData.hasHorizontalOverflow) {
      checks.errors.push(`Horizontal overflow detected! scrollWidth (${evalData.scrollWidth}) > clientWidth (${evalData.clientWidth})`);
    }

    if (vp.isDesktop) {
      if (!evalData.sidebarRect) {
        checks.sidebarRightDocked = false;
        checks.errors.push('Sidebar element not found on desktop viewport');
      } else {
        checks.sidebarDiff = evalData.sidebarRect.rightDiffFromWindow;
        if (evalData.sidebarRect.rightDiffFromWindow > 1.0) {
          checks.sidebarRightDocked = false;
          checks.errors.push(`Sidebar rect.right (${evalData.sidebarRect.right}) does not align with innerWidth (${evalData.innerWidth}), diff: ${evalData.sidebarRect.rightDiffFromWindow}px`);
        }
      }
    }

    if (evalData.container5xlRect) {
      if (evalData.container5xlRect.width > 1025) {
        checks.container5xlPass = false;
        checks.errors.push(`Inner container width (${evalData.container5xlRect.width}px) exceeds max-w-5xl (1024px)`);
      }
    }

    if (!checks.max1500Absent) {
      checks.errors.push(`max-w-[1500px] found on elements: ${JSON.stringify(evalData.elementsWith1500)}`);
    }

    const testPassed = checks.overflowPass && checks.sidebarRightDocked && checks.container5xlPass && checks.max1500Absent;
    results.summary.totalTests++;
    if (testPassed) {
      results.summary.passedTests++;
      console.log(`  ✓ Dashboard @ ${vp.name}: PASS (scrollWidth: ${evalData.scrollWidth}, clientWidth: ${evalData.clientWidth}, sidebarDiff: ${checks.sidebarDiff !== null ? checks.sidebarDiff.toFixed(2) + 'px' : 'N/A'})`);
    } else {
      results.summary.failedTests++;
      results.summary.failures.push({ page: 'Dashboard', viewport: vp.name, errors: checks.errors });
      console.log(`  ✗ Dashboard @ ${vp.name}: FAIL -> ${checks.errors.join('; ')}`);
    }

    results.dashboard.push(checks);

    const screenshotPath = path.join(SCREENSHOTS_DIR, `dashboard-${vp.width}px.png`);
    await page.screenshot({ path: screenshotPath, fullPage: false });
  }

  // Test 2: Course Learning Page across all viewports
  console.log('\n--- AUDITING COURSE LEARNING PAGE (/course/course-101?learn=1) ---');
  for (const vp of VIEWPORTS) {
    await page.setViewportSize({ width: vp.width, height: vp.height });
    await page.goto('http://127.0.0.1:4173/course/course-101?learn=1');
    await page.waitForLoadState('networkidle');
    await page.waitForSelector('[data-testid="legacy-course-player"]');

    const evalData = await page.evaluate(() => {
      const doc = document.documentElement;
      const scrollWidth = doc.scrollWidth;
      const clientWidth = doc.clientWidth;
      const innerWidth = window.innerWidth;
      const hasHorizontalOverflow = scrollWidth > clientWidth;

      const player = document.querySelector('[data-testid="legacy-course-player"]');
      const aside = player ? player.querySelector('aside') : null;
      let sidebarRect = null;
      if (aside) {
        const r = aside.getBoundingClientRect();
        sidebarRect = {
          left: r.left,
          right: r.right,
          width: r.width,
          height: r.height,
          rightDiffFromWindow: Math.abs(r.right - innerWidth),
        };
      }

      const container5xl = player ? player.querySelector('section .max-w-5xl') : null;
      let container5xlRect = null;
      if (container5xl) {
        const r = container5xl.getBoundingClientRect();
        container5xlRect = {
          width: r.width,
          maxWidthCss: window.getComputedStyle(container5xl).maxWidth,
        };
      }

      const elementsWith1500 = Array.from(document.querySelectorAll('*')).filter((el) =>
        el.className && typeof el.className === 'string' && el.className.includes('1500px')
      ).map((el) => ({ tag: el.tagName, className: el.className }));

      return {
        scrollWidth,
        clientWidth,
        innerWidth,
        hasHorizontalOverflow,
        sidebarRect,
        container5xlRect,
        elementsWith1500,
      };
    });

    const checks = {
      viewport: vp.name,
      width: vp.width,
      scrollWidth: evalData.scrollWidth,
      clientWidth: evalData.clientWidth,
      overflowPass: !evalData.hasHorizontalOverflow,
      sidebarRightDocked: true,
      sidebarDiff: null,
      container5xlPass: true,
      max1500Absent: evalData.elementsWith1500.length === 0,
      errors: [],
    };

    if (evalData.hasHorizontalOverflow) {
      checks.errors.push(`Horizontal overflow detected! scrollWidth (${evalData.scrollWidth}) > clientWidth (${evalData.clientWidth})`);
    }

    if (vp.isDesktop) {
      if (!evalData.sidebarRect) {
        checks.sidebarRightDocked = false;
        checks.errors.push('Course player sidebar not found on desktop viewport');
      } else {
        checks.sidebarDiff = evalData.sidebarRect.rightDiffFromWindow;
        if (evalData.sidebarRect.rightDiffFromWindow > 1.0) {
          checks.sidebarRightDocked = false;
          checks.errors.push(`Course player sidebar rect.right (${evalData.sidebarRect.right}) does not align with innerWidth (${evalData.innerWidth}), diff: ${evalData.sidebarRect.rightDiffFromWindow}px`);
        }
      }
    }

    if (evalData.container5xlRect) {
      if (evalData.container5xlRect.width > 1025) {
        checks.container5xlPass = false;
        checks.errors.push(`Inner container width (${evalData.container5xlRect.width}px) exceeds max-w-5xl (1024px)`);
      }
    }

    if (!checks.max1500Absent) {
      checks.errors.push(`max-w-[1500px] found on elements: ${JSON.stringify(evalData.elementsWith1500)}`);
    }

    const testPassed = checks.overflowPass && checks.sidebarRightDocked && checks.container5xlPass && checks.max1500Absent;
    results.summary.totalTests++;
    if (testPassed) {
      results.summary.passedTests++;
      console.log(`  ✓ CoursePlayer @ ${vp.name}: PASS (scrollWidth: ${evalData.scrollWidth}, clientWidth: ${evalData.clientWidth}, sidebarDiff: ${checks.sidebarDiff !== null ? checks.sidebarDiff.toFixed(2) + 'px' : 'N/A'})`);
    } else {
      results.summary.failedTests++;
      results.summary.failures.push({ page: 'CoursePlayer', viewport: vp.name, errors: checks.errors });
      console.log(`  ✗ CoursePlayer @ ${vp.name}: FAIL -> ${checks.errors.join('; ')}`);
    }

    results.courseLearning.push(checks);

    const screenshotPath = path.join(SCREENSHOTS_DIR, `course-player-${vp.width}px.png`);
    await page.screenshot({ path: screenshotPath, fullPage: false });
  }

  // Test 3: Adversarial Mobile Drawer Stress Tests
  console.log('\n--- ADVERSARIAL STRESS TEST: MOBILE DRAWER EXPANSION & HORIZONTAL OVERFLOW ---');
  for (const mWidth of [320, 390]) {
    // 3A. Dashboard mobile drawer
    await page.setViewportSize({ width: mWidth, height: 800 });
    await page.goto('http://127.0.0.1:4173/dashboard');
    await page.waitForSelector('#overview');

    const dbToggle = page.getByRole('button', { name: 'فتح قائمة لوحة الطالب' });
    if (await dbToggle.isVisible()) {
      await dbToggle.click();
      await page.waitForTimeout(400);

      const dbDrawerState = await page.evaluate(() => {
        const doc = document.documentElement;
        return {
          scrollWidth: doc.scrollWidth,
          clientWidth: doc.clientWidth,
          hasOverflow: doc.scrollWidth > doc.clientWidth,
        };
      });

      results.summary.totalTests++;
      const dbDrawerPass = !dbDrawerState.hasOverflow;
      if (dbDrawerPass) {
        results.summary.passedTests++;
        console.log(`  ✓ Dashboard Mobile Drawer Open @ ${mWidth}px: PASS (scrollWidth: ${dbDrawerState.scrollWidth}, clientWidth: ${dbDrawerState.clientWidth})`);
      } else {
        results.summary.failedTests++;
        results.summary.failures.push({
          page: 'Dashboard Mobile Drawer',
          viewport: `${mWidth}px`,
          errors: [`Horizontal overflow when mobile drawer open: scrollWidth ${dbDrawerState.scrollWidth} > clientWidth ${dbDrawerState.clientWidth}`],
        });
        console.log(`  ✗ Dashboard Mobile Drawer Open @ ${mWidth}px: FAIL (overflow: ${dbDrawerState.scrollWidth} > ${dbDrawerState.clientWidth})`);
      }
      results.drawerStress.push({ page: 'Dashboard', width: mWidth, ...dbDrawerState, pass: dbDrawerPass });
    }

    // 3B. Course Player mobile drawer
    await page.goto('http://127.0.0.1:4173/course/course-101?learn=1');
    await page.waitForSelector('[data-testid="legacy-course-player"]');

    // On mobile (< 1024), course player has toggle button
    const playerToggle = page.getByRole('button', { name: /المحتوى|قائمة الدروس|فهرس الدورة/ });
    const altToggle = page.locator('button:has(svg.lucide-menu), button:has(svg.lucide-panel-right), button:has(svg.lucide-sidebar)').first();
    const btnToClick = (await playerToggle.count()) > 0 ? playerToggle : altToggle;

    if ((await btnToClick.count()) > 0 && await btnToClick.isVisible()) {
      await btnToClick.click();
      await page.waitForTimeout(400);

      const cpDrawerState = await page.evaluate(() => {
        const doc = document.documentElement;
        return {
          scrollWidth: doc.scrollWidth,
          clientWidth: doc.clientWidth,
          hasOverflow: doc.scrollWidth > doc.clientWidth,
        };
      });

      results.summary.totalTests++;
      const cpDrawerPass = !cpDrawerState.hasOverflow;
      if (cpDrawerPass) {
        results.summary.passedTests++;
        console.log(`  ✓ CoursePlayer Mobile Drawer Open @ ${mWidth}px: PASS (scrollWidth: ${cpDrawerState.scrollWidth}, clientWidth: ${cpDrawerState.clientWidth})`);
      } else {
        results.summary.failedTests++;
        results.summary.failures.push({
          page: 'CoursePlayer Mobile Drawer',
          viewport: `${mWidth}px`,
          errors: [`Horizontal overflow when course player drawer open: scrollWidth ${cpDrawerState.scrollWidth} > clientWidth ${cpDrawerState.clientWidth}`],
        });
        console.log(`  ✗ CoursePlayer Mobile Drawer Open @ ${mWidth}px: FAIL (overflow: ${cpDrawerState.scrollWidth} > ${cpDrawerState.clientWidth})`);
      }
      results.drawerStress.push({ page: 'CoursePlayer', width: mWidth, ...cpDrawerState, pass: cpDrawerPass });
    }
  }

  const auditJsonPath = 'C:/almeaago/.agents/teamwork/m1_challenger_1/audit-results.json';
  fs.writeFileSync(auditJsonPath, JSON.stringify(results, null, 2));

  console.log('\n=== AUDIT SUMMARY ===');
  console.log(`Total Scenarios Tested: ${results.summary.totalTests}`);
  console.log(`Passed: ${results.summary.passedTests}`);
  console.log(`Failed: ${results.summary.failedTests}`);
  console.log(`Verdict: ${results.summary.failedTests === 0 ? 'APPROVE' : 'REJECT'}`);

  try {
    await browser.close();
  } catch (e) {
    // ignore
  }
  process.exit(results.summary.failedTests === 0 ? 0 : 1);
}

runAudit().catch((err) => {
  console.error('Fatal error in audit execution:', err);
  process.exit(1);
});
