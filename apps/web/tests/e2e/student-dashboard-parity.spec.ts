import { expect, test, type Page, type Route } from '@playwright/test';
import { installBaselineMocks } from './fixtures/mockBaseline';

const studentUser = {
  id: '018f0000-0000-7000-8000-000000000001',
  name: 'سلطان القحطاني',
  email: 'student@example.com',
  roles: ['student'],
  permissions: ['content:read', 'assessment:take'],
  avatarUrl: '',
};

function json(route: Route, data: unknown) {
  return route.fulfill({
    status: 200,
    contentType: 'application/json',
    body: JSON.stringify(data),
  });
}

for (const [width, height] of [[390, 844], [820, 1180], [1440, 900]]) {
  test(`original student navigation keeps each destination distinct at ${width}px`, async ({ page }, testInfo) => {
    test.setTimeout(120_000);
    await setupStudentMocks(page);
    await page.setViewportSize({ width, height });
    await page.goto('/dashboard', { waitUntil: 'domcontentloaded' });
    const menu = page.getByRole('navigation', { name: 'تنقل لوحة الطالب' });
    const openMenu = async () => {
      if (width < 1024) await page.getByRole('button', { name: 'فتح قائمة لوحة الطالب' }).click();
    };
    await openMenu();
    await expect(page.getByTestId('student-menu-group-exams').getByRole('link')).toHaveText([
      /الاختبارات السابقة/, /الاختبارات المدرسية/, /الاختبارات المحاكية/,
    ]);
    await expect(menu.getByRole('link', { name: 'أسئلتي للمراجعة' })).toHaveCount(1);
    await expect(page.getByTestId('student-menu-group-learning').getByRole('link')).toHaveText([
      'مساراتي', 'دوراتي', 'جلساتي',
    ]);
    await expect(page.getByTestId('student-menu-group-journey').getByRole('link')).toHaveText([
      'المسار الذكي', 'تقاريري', 'خططي',
    ]);
    await expect(page.getByTestId('student-today-focus')).toBeAttached();
    await expect(page.getByText('أساسيات التناظر اللفظي والعلاقات')).toHaveCount(0);
    await expect(page.getByRole('region', { name: 'اختصارات رحلة الطالب' })).toHaveCount(0);
    await expect(page.getByTestId('student-next-action-strip')).toHaveCount(1);
    await page.screenshot({ path: testInfo.outputPath('student-navigation.png') });

    const destinations = [
      { tab: 'quizzes', label: /الاختبارات السابقة/, heading: 'اختباراتي' },
      { tab: 'school-tests', label: /الاختبارات المدرسية/, heading: 'الاختبارات الموجهة لك' },
      { tab: 'mock-exams', label: /الاختبارات المحاكية/, heading: 'الاختبارات المحاكية' },
      { tab: 'reports', label: /تقاريري/, heading: 'تقارير الأداء' },
    ];
    for (const [index, destination] of destinations.entries()) {
      if (index > 0) await openMenu();
      await menu.getByRole('link', { name: destination.label }).click();
      await expect(page).toHaveURL(`/dashboard?tab=${destination.tab}`);
      await expect(page.getByRole('heading', { name: destination.heading, exact: true })).toBeVisible();
      await expect(page.locator('aside[aria-label="تنقل لوحة الطالب"] [aria-current="page"]')).toContainText(destination.label);
      if (destination.tab === 'quizzes') {
        await expect(page.getByRole('link', { name: /اختبارات متاحة للتدرب/ })).toHaveAttribute('href', '/dashboard?tab=platform-assessments');
      }
      await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
    }
    await page.reload();
    await expect(page.getByRole('heading', { name: 'تقارير الأداء', exact: true })).toBeVisible();
    await page.goBack();
    await expect(page.getByRole('heading', { name: 'الاختبارات المحاكية', exact: true })).toBeVisible();
  });
}

async function setupStudentMocks(page: Page) {
  await installBaselineMocks(page);
  await page.addInitScript(() => {
    sessionStorage.setItem('almeaa-dismissed-announcement-ads', JSON.stringify(['ad_welcome_offer', 'ad_qudrat_launch', 'ad_nafes_banner']));
  });

  await page.route('**/api/v1/auth/me', (route) => json(route, { user: studentUser }));
  await page.route('**/api/v1/auth/csrf', (route) => json(route, { csrfToken: 'csrf-student-token' }));
  await page.route('**/api/v1/notifications/me?*', (route) => json(route, { items: [], hasMore: false }));
  await page.route('**/api/v1/notifications/me/unread-count', (route) => json(route, { unreadCount: 0 }));
  await page.route('**/api/v1/notifications/stream', (route) => route.fulfill({ status: 204 }));
  await page.route('**/api/v1/assessment-attempts/results?**', (route) =>
    json(route, { items: [], page: 1, limit: 20, hasMore: false }),
  );

  await page.route('**/api/v1/taxonomy/bootstrap*', (route) =>
    json(route, {
      paths: [
        { id: 'path-1', code: 'QUDRAT', name: 'القدرات العامة', color: 'indigo' },
        { id: 'path-2', code: 'TAHSILI', name: 'التحصيلي', color: 'emerald' },
        { id: 'path-3', code: 'NAFES', name: 'نافس', color: 'amber' },
      ],
      levels: [],
      subjects: [],
    }),
  );

  await page.route('**/api/v1/assessment-assignments/mine*', (route) =>
    json(route, {
      items: [
        {
          assignmentId: 'asg-1',
          assessmentId: 'asm-1',
          assessmentVersion: 1,
          title: 'اختبار تجريبي: قياس اللفظي والكمي الموحد',
          schoolId: 'sch-1',
          opensAt: null,
          closesAt: null,
          supervisorMessage: 'يرجى إنهاء الاختبار لمراجعة نقاط القوة والضعف.',
          attemptCount: 1,
          maxAttempts: 3,
          canStart: true,
        },
      ],
      page: 1,
      limit: 10,
      hasMore: false,
    }),
  );
}

test.describe('Student Dashboard (P0.3) Authentic Parity Suite', () => {
  test('1. Student Dashboard Desktop (1440px): Greeting, Next Action, Paths & Calculator', async ({ page, context }, testInfo) => {
    test.setTimeout(120_000);
    await context.grantPermissions(['clipboard-read', 'clipboard-write']);
    await setupStudentMocks(page);
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto('/dashboard');

    // 1. Header greeting
    await expect(page.getByRole('heading', { name: /مرحباً يا بطل/ })).toBeVisible();

    // 2. Student Today Focus
    await expect(page.getByTestId('student-today-focus')).toBeVisible();
    await expect(page.getByRole('link', { name: 'افتح الاختبارات المدرسية' })).toHaveAttribute('href', '/dashboard?tab=school-tests');

    // 3. Parent link code
    await expect(page.getByText('كود ربط ولي الأمر')).toBeVisible();
    const copyButton = page.getByRole('button', { name: 'نسخ الكود' });
    await expect(copyButton).toBeVisible();
    await copyButton.click();
    await expect(page.getByText('تم النسخ ✓')).toBeVisible();

    // 5. My Paths Progress
    await expect(page.getByText('أكمل مساراتك التعليمية')).toBeVisible();
    await expect(page.getByRole('heading', { name: 'القدرات العامة' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'التحصيلي' })).toBeVisible();

    // 6. Assigned Quizzes
    await expect(page.getByText('الاختبارات والتكليفات الموجهة لك')).toBeVisible();
    await expect(page.getByRole('heading', { name: 'اختبار تجريبي: قياس اللفظي والكمي الموحد', level: 4 })).toBeVisible();

    // Capture main desktop screenshot
    await page.screenshot({ path: testInfo.outputPath('student-dashboard-desktop-1440.png'), fullPage: true });

    // 7. Qiyas Calculator Modal Interaction
    await page.getByText('حاسبة النسبة الموزونة').first().click();
    const calcModal = page.getByTestId('qiyas-calculator-modal');
    await expect(calcModal).toBeVisible();
    await expect(calcModal.getByRole('heading', { name: 'حاسبة النسبة الموزونة' })).toBeVisible();
    await expect(calcModal.getByText('نسبتك الموزونة التقريبية')).toBeVisible();

    // Change target university
    await calcModal.getByLabel('الجامعة المستهدفة').selectOption({ label: 'جامعة البترول والمعادن (KFUPM)' });

    // Capture calculator screenshot
    await page.screenshot({ path: testInfo.outputPath('student-dashboard-calculator-1440.png') });

    // Close calculator modal
    await calcModal.getByLabel('إغلاق').click();
    await expect(calcModal).not.toBeVisible();
  });

  test('2. Student Dashboard Mobile (390px): Responsive Layout & Side Navigation', async ({ page }, testInfo) => {
    test.setTimeout(120_000);
    await setupStudentMocks(page);
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/dashboard');

    // Verify elements are visible and mobile friendly
    await expect(page.getByRole('heading', { name: /مرحباً يا بطل/ })).toBeVisible();
    await expect(page.getByTestId('student-today-focus')).toBeVisible();

    // Open mobile sidebar
    const toggleButton = page.getByRole('button', { name: 'فتح قائمة لوحة الطالب' });
    await expect(toggleButton).toBeVisible();
    await toggleButton.click();

    await expect(page.getByTestId('student-menu-group-learning')).toBeVisible();
    await expect(page.getByTestId('student-menu-group-tools')).toBeVisible();

    // Capture mobile screenshot
    await page.screenshot({ path: testInfo.outputPath('student-dashboard-mobile-390.png') });
  });
});
