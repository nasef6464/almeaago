import { expect, test, type Page, type Route } from '@playwright/test';
import path from 'path';

const ARTIFACTS_DIR = 'C:/Users/nasef/.gemini/antigravity/brain/0ccfb08a-58bb-4c4b-b298-4bd5e2ebea66';

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

async function setupStudentMocks(page: Page) {
  await page.addInitScript(() => {
    sessionStorage.setItem('almeaa-dismissed-announcement-ads', JSON.stringify(['ad_welcome_offer', 'ad_qudrat_launch', 'ad_nafes_banner']));
  });

  await page.route('**/api/v1/auth/me', (route) => json(route, { user: studentUser }));
  await page.route('**/api/v1/auth/csrf', (route) => json(route, { csrfToken: 'csrf-student-token' }));

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
  test('1. Student Dashboard Desktop (1440px): Greeting, Streak, Tools, Smart Path, Paths & Calculator', async ({ page, context }) => {
    await context.grantPermissions(['clipboard-read', 'clipboard-write']);
    await setupStudentMocks(page);
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto('/dashboard');
    await page.waitForLoadState('networkidle');

    // 1. Header greeting & streak
    await expect(page.getByRole('heading', { name: /مرحباً يا بطل/ })).toBeVisible();
    await expect(page.getByText('شريط الاستمرارية')).toBeVisible();
    await expect(page.getByText('5 أيام متتالية')).toBeVisible();

    // 2. Student Today Focus
    await expect(page.getByTestId('student-today-focus')).toBeVisible();
    await expect(page.getByRole('link', { name: 'افتح مساحة التعلم' })).toBeVisible();

    // 3. Parent link code
    await expect(page.getByText('كود ربط ولي الأمر')).toBeVisible();
    const copyButton = page.getByRole('button', { name: 'نسخ الكود' });
    await expect(copyButton).toBeVisible();
    await copyButton.click();
    await expect(page.getByText('تم النسخ ✓')).toBeVisible();

    // 4. Smart Learning Path Widget
    await expect(page.getByTestId('student-smart-path')).toBeVisible();
    await expect(page.getByText('المسار الذكي التكيفي')).toBeVisible();
    await expect(page.getByText('أساسيات التناظر اللفظي والعلاقات')).toBeVisible();
    await expect(page.getByRole('link', { name: 'ابدأ التدريب الآن' })).toBeVisible();

    // 5. My Paths Progress
    await expect(page.getByText('أكمل مساراتك التعليمية')).toBeVisible();
    await expect(page.getByRole('heading', { name: 'القدرات العامة' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'التحصيلي' })).toBeVisible();

    // 6. Assigned Quizzes
    await expect(page.getByText('الاختبارات والتكليفات الموجهة لك')).toBeVisible();
    await expect(page.getByText('اختبار تجريبي: قياس اللفظي والكمي الموحد')).toBeVisible();

    // Capture main desktop screenshot
    await page.screenshot({ path: path.join(ARTIFACTS_DIR, 'student-dashboard-desktop-1440.png'), fullPage: true });

    // 7. Qiyas Calculator Modal Interaction
    await page.getByText('حاسبة النسبة الموزونة').first().click();
    const calcModal = page.getByTestId('qiyas-calculator-modal');
    await expect(calcModal).toBeVisible();
    await expect(calcModal.getByRole('heading', { name: 'حاسبة النسبة الموزونة' })).toBeVisible();
    await expect(calcModal.getByText('نسبتك الموزونة التقريبية')).toBeVisible();

    // Change target university
    await calcModal.getByLabel('الجامعة المستهدفة').selectOption({ label: 'جامعة البترول والمعادن (KFUPM)' });

    // Capture calculator screenshot
    await page.screenshot({ path: path.join(ARTIFACTS_DIR, 'student-dashboard-calculator-1440.png') });

    // Close calculator modal
    await calcModal.getByLabel('إغلاق').click();
    await expect(calcModal).not.toBeVisible();
  });

  test('2. Student Dashboard Mobile (390px): Responsive Layout & Side Navigation', async ({ page }) => {
    await setupStudentMocks(page);
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/dashboard');
    await page.waitForLoadState('networkidle');

    // Verify elements are visible and mobile friendly
    await expect(page.getByRole('heading', { name: /مرحباً يا بطل/ })).toBeVisible();
    await expect(page.getByText('5 أيام متتالية')).toBeVisible();
    await expect(page.getByTestId('student-smart-path')).toBeVisible();

    // Open mobile sidebar
    const toggleButton = page.getByRole('button', { name: 'فتح قائمة لوحة الطالب' });
    await expect(toggleButton).toBeVisible();
    await toggleButton.click();

    await expect(page.getByTestId('student-menu-group-learning')).toBeVisible();
    await expect(page.getByTestId('student-menu-group-tools')).toBeVisible();

    // Capture mobile screenshot
    await page.screenshot({ path: path.join(ARTIFACTS_DIR, 'student-dashboard-mobile-390.png') });
  });
});
