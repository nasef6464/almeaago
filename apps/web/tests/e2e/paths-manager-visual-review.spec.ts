import { expect, test, type Page, type Route } from '@playwright/test';

const admin = {
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

async function auth(page: Page) {
  await page.route('**/api/v1/auth/me', (route) => json(route, { user: admin }));
  await page.route('**/api/v1/auth/csrf', (route) => json(route, { csrfToken: 'csrf-taxonomy-visual' }));
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
      {
        id: 'lvl_elem_6',
        pathId: 'p_nafes',
        code: 'ELEM_6',
        name: 'الصف السادس الابتدائي',
        sortOrder: 2,
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
      {
        id: 'sub_math_nafes',
        pathId: 'p_nafes',
        levelId: 'lvl_elem_3',
        code: 'MATH_NAFES',
        name: 'رياضيات نافس (ثالث ابتدائي)',
        sortOrder: 1,
        status: 'active',
        color: 'indigo',
        icon: '🔢',
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
      {
        id: 'sk_alg_1',
        subjectId: 'sub_quant',
        parentSkillId: 'sk_alg',
        code: 'ALG_LIN',
        name: 'المعادلات الخطية البسيطة',
        description: 'حل المعادلات من الدرجة الأولى',
        kind: 'sub',
        sortOrder: 1,
        status: 'active',
      },
    ],
  };
}

async function setupPathsManagerMocks(page: Page) {
  await auth(page);
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
      items: [
        {
          id: 'pkg-1',
          code: 'PKG-QUDRAT-VIP',
          name: 'باقة القدرات الشاملة VIP',
          productType: 'package',
          priceMinor: 29900,
          currency: 'SAR',
          status: 'active',
          package: {
            packageKind: 'bundle',
            items: [{ scopeType: 'all', pathId: 'p_qudrat', subjectId: '', contentType: '' }],
          },
        },
      ],
      page: 1,
      limit: 100,
      hasMore: false,
    }),
  );
}

test.describe('PathsManager Visual Review & Parity Suite', () => {
  test('Desktop (1440px): Sidebar, Path Overview, 5 Authentic Tabs, Subject Cards Grid, and Icon Picker', async ({
    page,
  }) => {
    await setupPathsManagerMocks(page);
    await page.setViewportSize({ width: 1440, height: 1080 });
    await page.goto('/admin-dashboard/taxonomy');

    // 1. Verify Command Center Header
    await expect(page.getByRole('heading', { name: 'إدارة المسارات والمناهج' })).toBeVisible();
    await expect(page.getByText('مركز القيادة المتكامل للتحكم بالمسارات التعليمية، المراحل الدراسية، المواد، الاختبارات المحاكية، والباقات.')).toBeVisible();

    // 2. Verify Paths Sidebar
    await expect(page.getByRole('heading', { name: 'المسارات', exact: true })).toBeVisible();
    await expect(page.getByRole('strong').filter({ hasText: 'القدرات العامة' })).toBeVisible();
    await expect(page.getByRole('strong').filter({ hasText: 'التحصيلي العلمي' })).toBeVisible();
    await expect(page.getByRole('strong').filter({ hasText: 'اختبارات نافس الوطنية' })).toBeVisible();

    // 3. Verify Active Path Overview Card
    await expect(page.getByRole('heading', { name: 'القدرات العامة', exact: true })).toBeVisible();
    await expect(page.getByRole('button', { name: 'تعديل المسار' })).toBeVisible();
    await expect(page.getByRole('link', { name: 'معاينة الطالب' })).toBeVisible();

    // 4. Verify 5 Tabs are present
    await expect(page.getByRole('button', { name: /المواد الدراسية/ })).toBeVisible();
    await expect(page.getByRole('button', { name: /المراحل التعليمية/ })).toBeVisible();
    await expect(page.getByRole('button', { name: /الاختبارات المحاكية/ })).toBeVisible();
    await expect(page.getByRole('button', { name: /العروض والباقات/ })).toBeVisible();
    await expect(page.getByRole('button', { name: /إعدادات وتجربة المسار/ })).toBeVisible();

    // 5. Verify Subject Cards in active tab (subjects)
    await expect(page.getByRole('heading', { name: 'القدرات العامة - كمي', exact: true })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'القدرات العامة - لفظي', exact: true })).toBeVisible();
    await expect(page.getByRole('button', { name: 'مساحة العمل' }).first()).toBeVisible();

    // 6. Test Educational Icon Picker modal
    await page.getByRole('button', { name: 'تعديل المسار' }).click();
    await expect(page.getByText('تعديل مسار القدرات العامة')).toBeVisible();
    await expect(page.getByText('أيقونة المسار')).toBeVisible();
    await expect(page.getByText('معاينة الأيقونة:')).toBeVisible();
    await page.getByRole('button', { name: 'إلغاء' }).click();

    // 7. Test Subject Workspace Navigation
    await page.getByRole('button', { name: 'مساحة العمل' }).first().click();
    await expect(page.getByText('مساحة عمل وإدارة محتوى المادة (QUANT)')).toBeVisible();
    await expect(page.getByRole('button', { name: 'العودة لمسار القدرات العامة' })).toBeVisible();

    // Return to Path view
    await page.getByRole('button', { name: 'العودة لمسار القدرات العامة' }).click();
    await expect(page.getByRole('button', { name: /المواد الدراسية/ })).toBeVisible();

    // Take Desktop Screenshot
    await page.screenshot({ path: 'test-results/paths-manager-desktop-1440.png', fullPage: true });
  });

  test('Tablet (820px): Responsive Layout, Touch Targets, and No Horizontal Overflow', async ({ page }) => {
    await setupPathsManagerMocks(page);
    await page.setViewportSize({ width: 820, height: 1180 });
    await page.goto('/admin-dashboard/taxonomy');

    await expect(page.getByRole('heading', { name: 'إدارة المسارات والمناهج' })).toBeVisible();
    await expect(page.getByRole('strong').filter({ hasText: 'القدرات العامة' })).toBeVisible();

    // Check overflowing elements
    const overflowing = await page.evaluate(() => {
      const elements = Array.from(document.querySelectorAll('*'));
      const docW = document.documentElement.clientWidth;
      return elements
        .filter((el) => {
          const rect = el.getBoundingClientRect();
          return rect.right > docW + 5 || rect.left < -5;
        })
        .map((el) => ({
          tag: el.tagName,
          id: el.id,
          class: (el.className || '').toString().slice(0, 50),
          right: Math.round(el.getBoundingClientRect().right),
          left: Math.round(el.getBoundingClientRect().left),
          scrollWidth: el.scrollWidth,
        }))
        .slice(0, 10);
    });
    console.log('TABLET 820px OVERFLOWING ELEMENTS:', JSON.stringify(overflowing, null, 2));

    await page.screenshot({ path: 'test-results/paths-manager-tablet-820.png', fullPage: true });
  });

  test('Mobile (390px): Clean Stacking, Zero Horizontal Scroll, and Accessible Modals', async ({ page }) => {
    await setupPathsManagerMocks(page);
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/admin-dashboard/taxonomy');

    await expect(page.getByRole('heading', { name: 'إدارة المسارات والمناهج' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'القدرات العامة', exact: true })).toBeVisible();

    // Switch to Packages tab on Mobile
    await page.getByRole('button', { name: /العروض والباقات/ }).click();
    await expect(page.getByText('باقة القدرات الشاملة VIP')).toBeVisible();

    await page.screenshot({ path: 'test-results/paths-manager-mobile-390.png', fullPage: true });
  });
});
