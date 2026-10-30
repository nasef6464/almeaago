import { test, expect, type Page, type Route } from '@playwright/test';
import path from 'path';

const ARTIFACTS_DIR = 'C:/Users/nasef/.gemini/antigravity/brain/0ccfb08a-58bb-4c4b-b298-4bd5e2ebea66';

const adminUser = {
  id: 'admin-1',
  email: 'admin@example.com',
  name: 'مدير المنصة',
  status: 'active',
  avatarUrl: '',
  emailVerified: true,
  role: 'admin',
  roles: ['admin'],
};

function json(route: Route, body: unknown, status = 200) {
  return route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) });
}

async function mockAdminAuth(page: Page) {
  await page.route('**/api/v1/auth/me', (route) => json(route, { user: adminUser }));
  await page.route('**/api/v1/auth/csrf', (route) => json(route, { csrfToken: 'csrf-audit-token' }));
}

function mockTaxonomyData() {
  return {
    paths: [
      {
        id: 'p_qudrat',
        code: 'QUDRAT',
        name: 'القدرات العامة',
        parentPathId: '',
        description: 'تأسيس شامل وتدريب مكثف لاختبار القدرات العامة (كمي ولفظي)',
        sortOrder: 1,
        status: 'active',
        color: 'indigo',
        icon: '📚',
        showInNavbar: true,
        showSubjectCards: true,
        showMockExamCard: true,
        showPackageCard: true,
      },
      {
        id: 'p_tahsili',
        code: 'TAHSILI',
        name: 'التحصيلي العلمي',
        parentPathId: '',
        description: 'مقررات التحصيلي في الرياضيات والفيزياء والكيمياء والأحياء',
        sortOrder: 2,
        status: 'active',
        color: 'emerald',
        icon: '🔬',
        showInNavbar: true,
        showSubjectCards: true,
        showMockExamCard: true,
        showPackageCard: true,
      },
      {
        id: 'p_nafes',
        code: 'NAFES',
        name: 'اختبارات نافس الوطنية',
        parentPathId: '',
        description: 'المراحل الابتدائية والمتوسطة للاختبارات الوطنية القياسية',
        sortOrder: 3,
        status: 'active',
        color: 'purple',
        icon: '🎒',
        showInNavbar: true,
        showSubjectCards: true,
        showMockExamCard: true,
        showPackageCard: true,
      },
    ],
    levels: [
      {
        id: 'lvl_elem_3',
        pathId: 'p_nafes',
        code: 'ELEM_3',
        name: 'الصف الثالث الابتدائي',
        sortOrder: 1,
        status: 'active',
        icon: '🎒',
      },
    ],
    subjects: [
      {
        id: 'sub_quant',
        pathId: 'p_qudrat',
        levelId: '',
        code: 'QUANT',
        name: 'القدرات العامة - كمي',
        sortOrder: 1,
        status: 'active',
        color: 'indigo',
        icon: '🧮',
      },
      {
        id: 'sub_verbal',
        pathId: 'p_qudrat',
        levelId: '',
        code: 'VERBAL',
        name: 'القدرات العامة - لفظي',
        sortOrder: 2,
        status: 'active',
        color: 'teal',
        icon: '🪶',
      },
    ],
    skills: [
      {
        id: 'sk_alg',
        subjectId: 'sub_quant',
        parentSkillId: '',
        code: 'ALG',
        name: 'الجبر والمعادلات',
        description: 'المعادلات الخطية والتربيعية',
        kind: 'main',
        sortOrder: 1,
        status: 'active',
      },
    ],
  };
}

async function setupPathsManagerMocks(page: Page) {
  await mockAdminAuth(page);
  const data = mockTaxonomyData();

  await page.route('**/api/v1/taxonomy/admin/bootstrap', (route) => json(route, data));
  await page.route('**/api/v1/courses*', (route) =>
    json(route, {
      items: [
        {
          id: 'c-1',
          title: 'دورة التأسيس الشامل في القدرات كمي',
          pathId: 'p_qudrat',
          subjectId: 'sub_quant',
          isPublished: true,
        },
      ],
      page: 1,
      limit: 100,
      hasMore: false,
    }),
  );
  await page.route('**/api/v1/commerce/products*', (route) =>
    json(route, {
      items: [],
      page: 1,
      limit: 100,
      hasMore: false,
    }),
  );
  await page.route('**/api/v1/assessments*', (route) =>
    json(route, {
      items: [
        {
          id: 'a-1',
          code: 'ASSESS-QUDRAT-1',
          title: 'اختبار تجريبي في الجبر',
          subjectId: 'sub_quant',
          pathId: 'p_qudrat',
          isPublished: true,
        },
      ],
      page: 1,
      limit: 100,
      hasMore: false,
    }),
  );
  await page.route('**/api/v1/library*', (route) =>
    json(route, {
      items: [
        {
          id: 'lib-1',
          title: 'مذكرة قوانين الجبر السريعة',
          subjectId: 'sub_quant',
          pathId: 'p_qudrat',
          type: 'pdf',
          externalUrl: 'https://example.com/math.pdf',
        },
      ],
      page: 1,
      limit: 100,
      hasMore: false,
    }),
  );
}

test.describe('Learning Paths, Navigation & Taxonomy Full Visual Audit', () => {
  test('Audit 1: Qudrat Learning Path across viewports', async ({ page }) => {
    // 1. Desktop 1440px
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto('/category/qudrat');
    await page.waitForLoadState('networkidle');

    // Verify Header Elements
    const header = page.locator('header').first();
    await expect(header).toBeVisible();
    await expect(page.getByRole('button', { name: 'فتح البحث' })).toBeVisible();
    await expect(page.getByRole('link', { name: 'سلة المشتريات' }).or(page.locator('a[href="/cart"]'))).toBeVisible();

    // Verify Qudrat Hero & Path Cards
    await expect(page.getByRole('heading', { name: /القدرات/ })).toBeVisible();
    await expect(page.getByText('تأسيس شامل، تدريب مكثف، واختبارات محاكية')).toBeVisible();

    // Subject cards: الكمي, اللفظي
    await expect(page.getByRole('button', { name: /الكمي/ })).toBeVisible();
    await expect(page.getByRole('button', { name: /اللفظي/ })).toBeVisible();

    // Mock exams card & packages card
    await expect(page.locator('a[href*="tab=mock-exams"]').filter({ hasText: 'اختبارات محاكية' })).toBeVisible();
    await expect(page.locator('a[href*="tab=packages"]').filter({ hasText: 'عروض وباقات' })).toBeVisible();

    await page.screenshot({ path: path.join(ARTIFACTS_DIR, 'learning-qudrat-desktop-1440.png'), fullPage: true });

    // 2. Tablet 820px
    await page.setViewportSize({ width: 820, height: 1180 });
    await page.screenshot({ path: path.join(ARTIFACTS_DIR, 'learning-qudrat-tablet-820.png'), fullPage: true });

    // 3. Mobile 390px
    await page.setViewportSize({ width: 390, height: 844 });
    await page.screenshot({ path: path.join(ARTIFACTS_DIR, 'learning-qudrat-mobile-390.png'), fullPage: true });
  });

  test('Audit 2: Nafes Stage Selection and Stage Subjects Flow', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto('/category/nafes');
    await page.waitForLoadState('networkidle');

    // Verify Nafes Title & Stage Picker
    await expect(page.getByRole('heading', { name: /اختبارات نافس/ })).toBeVisible();
    await expect(page.getByText('اختر المرحلة الدراسية للبدء')).toBeVisible();

    // 3 Stages
    await expect(page.getByText(/المرحلة الابتدائية - الصف الثالث/)).toBeVisible();
    await expect(page.getByText(/المرحلة الابتدائية - الصف السادس/)).toBeVisible();
    await expect(page.getByText(/المرحلة المتوسطة - الصف الثالث متوسط/)).toBeVisible();

    // Mock exam and Package cards in stage screen
    await expect(page.locator('a[href*="tab=mock-exams"]').filter({ hasText: 'اختبارات محاكية' })).toBeVisible();
    await expect(page.locator('a[href*="tab=packages"]').filter({ hasText: 'عروض وباقات' })).toBeVisible();

    await page.screenshot({ path: path.join(ARTIFACTS_DIR, 'learning-nafes-stages-desktop-1440.png'), fullPage: true });

    // Click on Stage 3
    await page.getByText(/المرحلة الابتدائية - الصف الثالث/).click();
    await page.waitForTimeout(500);

    // Verify Stage Header & Subjects
    await expect(page.getByText('عودة لاختيار المرحلة')).toBeVisible();
    await expect(page.getByRole('heading', { name: /المرحلة الابتدائية - الصف الثالث/ })).toBeVisible();

    // Verify Stage Subjects
    await expect(page.getByRole('button', { name: /رياضيات/ })).toBeVisible();
    await expect(page.getByRole('button', { name: /علوم/ })).toBeVisible();
    await expect(page.getByRole('button', { name: /عربي/ })).toBeVisible();

    await page.screenshot({ path: path.join(ARTIFACTS_DIR, 'learning-nafes-subjects-desktop-1440.png'), fullPage: true });
  });

  test('Audit 3: Admin Paths & Curriculum Manager Workspace', async ({ page }) => {
    await setupPathsManagerMocks(page);
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto('/admin-dashboard/taxonomy');
    await page.waitForLoadState('networkidle');

    // Verify Admin Header
    await expect(page.getByRole('heading', { name: 'إدارة المسارات والمناهج' })).toBeVisible();

    // Verify Path tabs
    await expect(page.getByRole('button', { name: /المواد الدراسية/ })).toBeVisible();
    await expect(page.getByRole('button', { name: /المراحل التعليمية/ })).toBeVisible();
    await expect(page.getByRole('button', { name: /الاختبارات المحاكية/ })).toBeVisible();
    await expect(page.getByRole('button', { name: /العروض والباقات/ })).toBeVisible();
    await expect(page.getByRole('button', { name: /إعدادات وتجربة المسار/ })).toBeVisible();

    // Check Mock Exams tab
    await page.getByRole('button', { name: /الاختبارات المحاكية/ }).click();
    await expect(page.getByRole('button', { name: 'إنشاء اختبار محاكي' })).toBeVisible();
    await expect(page.getByPlaceholder('ابحث في الاختبارات المحاكية باسم الاختبار أو الكود...')).toBeVisible();

    // Check Subject Workspace
    await page.getByRole('button', { name: /المواد الدراسية/ }).click();
    const workspaceBtn = page.getByRole('button', { name: 'مساحة العمل' }).first();
    await expect(workspaceBtn).toBeVisible();
    await workspaceBtn.click();
    await page.waitForTimeout(500);

    // Verify 6 Subject Workspace Tabs
    await expect(page.getByRole('button', { name: 'الدورات التدريبية' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'شجرة المهارات' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'بنك الأسئلة والتدريب' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'الاختبارات والتقييمات' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'المكتبة والمراجع' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'إعدادات المادة' })).toBeVisible();

    // Check Questions tab
    await page.getByRole('button', { name: 'بنك الأسئلة والتدريب' }).click();
    await expect(page.getByRole('heading', { name: /بنوك الأسئلة والتدريبات/ })).toBeVisible();

    // Check Exams tab
    await page.getByRole('button', { name: 'الاختبارات والتقييمات' }).click();
    await expect(page.getByRole('heading', { name: /الاختبارات والتقييمات/ })).toBeVisible();

    // Check Library tab
    await page.getByRole('button', { name: 'المكتبة والمراجع' }).click();
    await expect(page.getByRole('heading', { name: /مكتبة ومراجع/ })).toBeVisible();

    // Check Settings tab
    await page.getByRole('button', { name: 'إعدادات المادة' }).click();
    await expect(page.getByRole('heading', { name: /التحكم بصفحة الطالب والعرض/ })).toBeVisible();
    await expect(page.getByRole('button', { name: 'أرشفة المادة' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'حفظ التعديلات' })).toBeVisible();

    await page.screenshot({ path: path.join(ARTIFACTS_DIR, 'admin-taxonomy-workspace-desktop-1440.png'), fullPage: true });
  });
});
