import { expect, test, type Page, type Route } from '@playwright/test';

// Legacy reference: components/DashboardSectionNav.tsx with collapsible=true,
// dashboards/school-director/directorNavigation.ts. This tests presentation
// parity only; HTTP responses here are deliberately mocked.
const director = {
  id: 'director-nav', email: 'director@example.com', name: 'مدير المدرسة',
  status: 'active', avatarUrl: '', emailVerified: true,
  role: 'school_admin', roles: ['school_admin'],
};
function json(route: Route, body: unknown) {
  return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(body) });
}
async function fixture(page: Page) {
  await page.route('**/api/v1/auth/me', route => json(route, { user: director }));
  await page.route('**/api/v1/auth/csrf', route => json(route, { csrfToken: 'csrf-nav' }));
  await page.route('**/api/v1/schools/context', route => json(route, { contexts: [{
    schoolId: 'school-nav', schoolName: 'مدرسة التجربة', role: 'school_admin',
    permissions: ['SCHOOL_OVERVIEW_VIEW', 'SCHOOL_STUDENTS_VIEW', 'SCHOOL_CLASSES_MANAGE'],
    modules: ['SCHOOL_CORE'], source: 'membership',
  }] }));
  await page.route('**/api/v1/schools/school-nav/classes*', route => json(route, {
    classes: [{ id: 'class-nav', schoolId: 'school-nav', code: '1', name: 'الأول', status: 'active' }],
    pagination: { page: 1, limit: 100, total: 1, totalPages: 1 },
  }));
  await page.route('**/api/school-access/director/schools/school-nav/students*', route => json(route, {
    students: [], total: 0,
  }));
  await page.route('**/api/school-access/director/schools/school-nav/overview', route => json(route, {
    school: { schoolId: 'school-nav', schoolName: 'مدرسة التجربة' },
    metrics: { students: 0, classes: 1, teachers: 0, supervisors: 0, schoolAssessments: 0, completedSmartClasses: 0 },
    classes: [{ classId: 'class-nav', className: 'الأول' }],
  }));
}

for (const width of [390, 820, 1440]) {
  test(`school director nav follows Legacy single-expanded-group behavior at ${width}px RTL`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await fixture(page);
    await page.goto('/school-director-dashboard');
    const nav = page.getByRole('navigation', { name: 'أقسام لوحة مدير المدرسة' });
    const home = nav.locator('details').filter({ has: page.locator('summary', { hasText: 'البداية' }) });
    const management = nav.locator('details').filter({ has: page.locator('summary', { hasText: 'إدارة المدرسة' }) });
    await expect(nav).toHaveAttribute('dir', 'rtl');
    await expect(home).toHaveAttribute('open', '');
    await expect(management).not.toHaveAttribute('open', '');
    await expect(nav.getByRole('button', { name: 'الطلاب', exact: true })).toBeHidden();

    await management.locator('summary').click();
    await expect(management).toHaveAttribute('open', '');
    await expect(home).not.toHaveAttribute('open', '');
    await nav.getByRole('button', { name: 'الطلاب', exact: true }).click();
    await expect(nav.getByRole('button', { name: 'الطلاب', exact: true })).toHaveAttribute('aria-current', 'page');
    await expect(management).toHaveAttribute('open', '');

    await management.locator('summary').click();
    await expect(management).not.toHaveAttribute('open', '');
    await home.locator('summary').click();
    await nav.getByRole('button', { name: 'الملخص العام', exact: true }).click();
    await expect(home).toHaveAttribute('open', '');
    await expect(management).not.toHaveAttribute('open', '');
    await expect(nav.getByRole('button', { name: 'المعلمون والتكليفات' })).toHaveCount(0);
    await page.screenshot({ path: `test-results/school-director-nav-${width}-rtl.png`, fullPage: true });
  });
}
