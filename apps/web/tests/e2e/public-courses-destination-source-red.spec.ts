import { expect, test, type Page } from '@playwright/test';

/**
 * RED destination acceptance for Legacy pages/Courses.tsx and
 * app/AppRouteTree.tsx at almeaacodax/main@bf7281fc9fe34165a070e3d2d58f65f91b4a3ef7.
 *
 * This deliberately does NOT assert the homepage CTA label/href (#201 owner),
 * edit the shared router (#158 owner), or replace the original "دوراتي" screen
 * with a generic /learning destination. It verifies the *destination* itself.
 *
 * Browser mocks are for role isolation only; they are NOT proof of
 * Go/PostgreSQL entitlement, enrollment or progress persistence.
 */
const learner = {
  id: 'courses-route-learner',
  email: 'learner@example.test',
  name: 'طالب تجريبي',
  status: 'active',
  role: 'student',
  roles: ['student'],
};

async function setRole(page: Page, signedIn: boolean) {
  await page.route('**/api/v1/auth/me', route =>
    route.fulfill({ json: { user: signedIn ? learner : null } }),
  );
}

async function expectOriginalCoursesSurface(page: Page) {
  await expect(page).toHaveURL(/\/courses(?:[?#]|$)/);
  await expect(page.getByRole('heading', { name: 'دوراتي', exact: true })).toBeVisible();
  await expect(page.getByText('متابعة تقدمك في الدورات المسجلة', { exact: true })).toBeVisible();
  await expect(page.getByRole('textbox', { name: 'البحث في الدورات' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'خيارات فلترة الدورات' })).toBeVisible();
  for (const label of ['الدورات الملتحق بها', 'الدورات النشطة', 'الدورات المكتملة']) {
    await expect(page.getByRole('button', { name: new RegExp(label) })).toBeVisible();
  }
  await expect(page.getByRole('heading', { name: 'الصفحة غير موجودة' })).toHaveCount(0);
}

for (const width of [390, 820, 1440]) {
  test(`guest can open original /courses destination at ${width}px RTL`, async ({ page }) => {
    await page.setViewportSize({ width, height: 1000 });
    await setRole(page, false);
    await page.goto('/courses');
    await page.screenshot({ path: `test-results/public-courses-guest-red-${width}.png`, animations: 'disabled' });
    await expectOriginalCoursesSurface(page);
  });

  test(`student sees original enrolled/active/completed tabs at ${width}px RTL`, async ({ page }) => {
    await page.setViewportSize({ width, height: 1000 });
    await setRole(page, true);
    await page.goto('/courses');
    await page.screenshot({ path: `test-results/public-courses-student-red-${width}.png`, animations: 'disabled' });
    await expectOriginalCoursesSurface(page);
    await page.getByRole('textbox', { name: 'البحث في الدورات' }).fill('رياضيات');
    await expect(page.getByRole('textbox', { name: 'البحث في الدورات' })).toHaveValue('رياضيات');
  });

  test(`/courses deep link survives reload at ${width}px RTL`, async ({ page }) => {
    await page.setViewportSize({ width, height: 1000 });
    await setRole(page, true);
    await page.goto('/courses');
    await page.reload();
    await page.screenshot({ path: `test-results/public-courses-reload-red-${width}.png`, animations: 'disabled' });
    await expectOriginalCoursesSurface(page);
  });
}
