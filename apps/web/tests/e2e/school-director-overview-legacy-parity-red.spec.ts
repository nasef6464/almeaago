import { expect, test, type Page, type Route } from '@playwright/test';

// Source contract: almeaacodax/main dashboards/SchoolDirectorDashboard.tsx.
// These assertions intentionally fail until the owning page PR #172 restores
// the original overview/header without inventing UI. Mocked browser only.
const user = {
  id: 'director-parity', email: 'director@example.test', name: 'مدير المدرسة',
  status: 'active', avatarUrl: '', emailVerified: true,
  role: 'school_admin', roles: ['school_admin'],
};
const originalDescription = 'رؤية تنفيذية وعمليات الطلاب داخل المدارس المصرح بها فقط.';
const goExtraDescription = 'رؤية تشغيلية وعمليات طلاب وفصول ومعلمين داخل المدارس المصرح بها فقط.';
function json(route: Route, body: unknown) {
  return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(body) });
}
async function fixture(page: Page) {
  await page.route('**/api/v1/auth/me', route => json(route, { user }));
  await page.route('**/api/v1/auth/csrf', route => json(route, { csrfToken: 'csrf-parity' }));
  await page.route('**/api/v1/schools/context', route => json(route, {
    contexts: [{
      schoolId: 'school-parity', schoolName: 'مدرسة الفرسان',
      role: 'school_admin', source: 'membership',
      permissions: ['SCHOOL_OVERVIEW_VIEW', 'SCHOOL_STUDENTS_VIEW'],
      modules: ['SCHOOL_CORE'],
    }],
  }));
  await page.route('**/api/school-access/director/schools/school-parity/overview', route => json(route, {
    school: { schoolId: 'school-parity', schoolName: 'مدرسة الفرسان' },
    metrics: { students: 1, classes: 1, teachers: 0, supervisors: 0, schoolAssessments: 0, completedSmartClasses: 0 },
    classes: [{ classId: 'class-parity', className: 'الأول' }],
  }));
  await page.route('**/api/school-access/director/schools/school-parity/students*', route => json(route, {
    students: [{ studentId: 'student-1', name: 'طالب تجريبي', email: 'student@example.test', phone: '', isActive: true, classId: 'class-parity', className: 'الأول' }],
    total: 1,
  }));
}
for (const width of [390, 820, 1440]) {
  test(`director overview uses the exact Legacy description at ${width}px RTL`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await fixture(page);
    await page.goto('/school-director-dashboard');
    await expect(page.getByRole('heading', { name: 'لوحة مدير المدرسة' })).toBeVisible();
    await expect(page.getByText(originalDescription, { exact: true })).toBeVisible();
    await expect(page.getByText(goExtraDescription, { exact: true })).toHaveCount(0);
  });

  test(`director overview does not invent an academic operations placeholder at ${width}px RTL`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await fixture(page);
    await page.goto('/school-director-dashboard');
    await expect(page.getByRole('region', { name: 'مؤشرات المدرسة' })).toBeVisible();
    await page.screenshot({ path: `test-results/school-overview-extra-${width}-rtl.png`, fullPage: true });
    await expect(page.getByRole('region', { name: 'مركز تشغيل مدير المدرسة' })).toHaveCount(0);
  });

  test(`director header description disappears outside overview at ${width}px RTL`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await fixture(page);
    await page.goto('/school-director-dashboard');
    await page.getByRole('navigation', { name: 'أقسام لوحة مدير المدرسة' })
      .getByRole('button', { name: 'الطلاب', exact: true }).click();
    await expect(page.getByRole('heading', { name: 'طلاب مدرسة الفرسان' })).toBeVisible();
    await page.screenshot({ path: `test-results/school-students-header-${width}-rtl.png`, fullPage: true });
    await expect(page.getByText(goExtraDescription, { exact: true })).toHaveCount(0);
    await expect(page.getByText(originalDescription, { exact: true })).toHaveCount(0);
  });
}
