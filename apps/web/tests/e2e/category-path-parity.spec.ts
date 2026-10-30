import { expect, test, type Page, type Route } from '@playwright/test';

function json(route: Route, body: unknown, status = 200) {
  return route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) });
}

const mockTaxonomy = {
  paths: [
    {
      id: 'path-qudrat',
      code: 'QUDRAT',
      name: 'القدرات العامة',
      sortOrder: 1,
      isActive: true,
      showInNavbar: true,
    },
    {
      id: 'path-nafes',
      code: 'NAFES',
      name: 'اختبارات نافس',
      sortOrder: 2,
      isActive: true,
      showInNavbar: true,
    },
  ],
  levels: [
    {
      id: 'lvl-elem-3',
      pathId: 'path-nafes',
      code: 'ELEM_3',
      name: 'المرحلة الابتدائية - الصف الثالث',
      sortOrder: 1,
      status: 'active',
    },
    {
      id: 'lvl-elem-6',
      pathId: 'path-nafes',
      code: 'ELEM_6',
      name: 'المرحلة الابتدائية - الصف السادس',
      sortOrder: 2,
      status: 'active',
    },
  ],
  subjects: [
    {
      id: 'sub-quant',
      pathId: 'path-qudrat',
      name: 'القدرات العامة - كمي',
      sortOrder: 1,
      status: 'active',
    },
    {
      id: 'sub-verbal',
      pathId: 'path-qudrat',
      name: 'القدرات العامة - لفظي',
      sortOrder: 2,
      status: 'active',
    },
    {
      id: 'sub-nafes-math',
      pathId: 'path-nafes',
      levelId: 'lvl-elem-3',
      name: 'رياضيات نافس (الصف الثالث)',
      sortOrder: 1,
      status: 'active',
    },
    {
      id: 'sub-nafes-science',
      pathId: 'path-nafes',
      levelId: 'lvl-elem-3',
      name: 'علوم نافس (الصف الثالث)',
      sortOrder: 2,
      status: 'active',
    },
  ],
};

async function setupMocks(page: Page, role: 'guest' | 'student' = 'student') {
  if (role === 'guest') {
    await page.route('**/api/v1/auth/me', (route) => json(route, { error: { message: 'unauthenticated' } }, 401));
  } else {
    await page.route('**/api/v1/auth/me', (route) =>
      json(route, {
        user: {
          id: 'user-std',
          email: 'student@example.test',
          name: 'طالب متميز',
          roles: ['student'],
          status: 'active',
        },
      }),
    );
  }

  await page.route('**/api/v1/learning/navigation-preferences', (route) =>
    json(route, {
      user: {
        id: 'user-std',
        enrolledPaths: ['path-qudrat', 'path-nafes'],
        pathStageSelections: [],
      },
    }),
  );
  await page.route('**/api/v1/taxonomy/bootstrap?phase=core', (route) => json(route, mockTaxonomy));
  await page.route('**/api/v1/taxonomy/bootstrap*', (route) => json(route, mockTaxonomy));
  await page.route('**/api/v1/content/homepage-settings', (route) => json(route, {}));
  await page.route('**/api/v1/courses/public*', (route) => json(route, { items: [] }));
}

test.describe('Category & Path Parity', () => {
  test('Qudrat path without levels renders authentic subject cards, mock exams card, and packages card', async ({
    page,
  }) => {
    await setupMocks(page, 'student');
    await page.goto('/category/path-qudrat');

    // Header title
    await expect(page.getByRole('heading', { name: 'القدرات العامة', exact: true })).toBeVisible();

    // Subject cards
    await expect(page.getByRole('button', { name: /القدرات العامة - كمي/ })).toBeVisible();
    await expect(page.getByRole('button', { name: /القدرات العامة - لفظي/ })).toBeVisible();

    // Mock exam and Package entry cards
    const main = page.getByRole('main');
    await expect(main.getByRole('link', { name: /اختبارات محاكية/ })).toBeVisible();
    await expect(main.getByRole('link', { name: /عروض وباقات/ })).toBeVisible();

    // Clicking a subject opens learning workspace with back button
    await page.getByRole('button', { name: /القدرات العامة - كمي/ }).click();
    await expect(page).toHaveURL(/subject=sub-quant/);
    await expect(page.getByRole('button', { name: 'عودة لصفحة المسار' })).toBeVisible();

    // Clicking back button returns to the path cards
    await page.getByRole('button', { name: 'عودة لصفحة المسار' }).click();
    await expect(page.getByRole('button', { name: /القدرات العامة - كمي/ })).toBeVisible();
  });

  test('Nafes path with stages divides into stages first, then stage subjects', async ({ page }) => {
    await setupMocks(page, 'student');
    await page.goto('/category/path-nafes');

    // Stage 1: Level selection screen
    await expect(page.getByRole('heading', { name: 'اختبارات نافس', exact: true })).toBeVisible();
    await expect(page.getByText('اختر المرحلة الدراسية للبدء')).toBeVisible();

    const stage3Button = page.getByRole('button', { name: /المرحلة الابتدائية - الصف الثالث/ });
    const stage6Button = page.getByRole('button', { name: /المرحلة الابتدائية - الصف السادس/ });
    await expect(stage3Button).toBeVisible();
    await expect(stage6Button).toBeVisible();

    // Clicking stage 3 opens its subjects
    await stage3Button.click();
    await expect(page).toHaveURL(/level=lvl-elem-3/);
    await expect(page.getByRole('heading', { name: 'المرحلة الابتدائية - الصف الثالث' })).toBeVisible();
    await expect(page.getByRole('button', { name: /رياضيات نافس/ })).toBeVisible();
    await expect(page.getByRole('button', { name: /علوم نافس/ })).toBeVisible();

    // Back button returns to stages
    await page.getByRole('button', { name: 'عودة لاختيار المرحلة' }).click();
    await expect(page.getByText('اختر المرحلة الدراسية للبدء')).toBeVisible();
  });

  test('Top Site Header user menu shows account, dashboard, courses, and logout', async ({ page }) => {
    await setupMocks(page, 'student');
    await page.goto('/');

    const userMenuButton = page.getByRole('button', { name: 'قائمة المستخدم' });
    await expect(userMenuButton).toBeVisible();
    await userMenuButton.click();

    // Dropdown items
    await expect(page.getByRole('link', { name: 'لوحة التحكم' })).toBeVisible();
    await expect(page.getByRole('link', { name: 'دوراتي' })).toBeVisible();
    await expect(page.getByRole('link', { name: 'اختباراتي' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'تسجيل الخروج' })).toBeVisible();
  });
});
