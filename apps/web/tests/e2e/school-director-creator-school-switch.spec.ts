import { expect, test, type Page, type Route } from '@playwright/test';

// Regression guard for an original school-bound workspace invariant.
// Legacy SchoolDirectorDashboard mounts SchoolDirectorAcademicCenter with
// key={selectedSchool.schoolId+section}; a new school visit starts a closed
// assessment creator. Go resets showAssessmentCreator via its selectedSchoolId effect. No production data is used.
const director = {
  id: 'director-switch', email: 'director@example.test', name: 'مدير المدرسة',
  status: 'active', avatarUrl: '', emailVerified: true,
  role: 'school_admin', roles: ['school_admin'],
};

function json(route: Route, body: unknown, status = 200) {
  return route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) });
}

async function setup(page: Page, schoolBHasAssessments: boolean) {
  const context = (id: string, assessments: boolean) => ({
    schoolId: id, schoolName: id === 'school-a' ? 'مدرسة ألف' : 'مدرسة باء',
    role: 'school_admin', source: 'membership',
    permissions: ['SCHOOL_OVERVIEW_VIEW', ...(assessments ? ['SCHOOL_ASSESSMENTS_MANAGE'] : [])],
    modules: ['SCHOOL_CORE', ...(assessments ? ['SCHOOL_ASSESSMENTS'] : [])],
  });
  await page.route('**/api/v1/auth/me', route => json(route, { user: director }));
  await page.route('**/api/v1/auth/csrf', route => json(route, { csrfToken: 'csrf-switch' }));
  await page.route('**/api/v1/schools/context', route => json(route, {
    contexts: [context('school-a', true), context('school-b', schoolBHasAssessments)],
  }));
  await page.route('**/api/v1/taxonomy/bootstrap?phase=core', route => json(route, {
    paths: [{ id: 'path-1', name: 'قدرات' }],
    subjects: [{ id: 'subject-1', pathId: 'path-1', name: 'رياضيات', code: 'MATH', sortOrder: 1 }],
  }));
  await page.route('**/api/school-access/director/schools/*/overview', route => {
    const id = route.request().url().includes('/school-a/') ? 'school-a' : 'school-b';
    return json(route, {
      school: { schoolId: id, schoolName: id === 'school-a' ? 'مدرسة ألف' : 'مدرسة باء' },
      metrics: { students: 0, classes: 1, teachers: 0, supervisors: 0, schoolAssessments: 0, completedSmartClasses: 0 },
      classes: [{ classId: 'class-' + id, className: 'الأول' }],
    });
  });
  await page.route('**/api/school-access/director/schools/*/academic/assessments', route => {
    const id = route.request().url().includes('/school-a/') ? 'school-a' : 'school-b';
    return json(route, {
      assessments: [],
      classes: [{ classId: 'class-' + id, className: 'الأول' }],
    });
  });
}

async function openAssessmentCreator(page: Page) {
  const nav = page.getByRole('navigation', { name: 'أقسام لوحة مدير المدرسة' });
  await nav.getByRole('button', { name: 'اختبارات المدرسة', exact: true }).click();
  await expect(page.getByText('لا توجد اختبارات موجهة لهذه المدرسة حاليًا.')).toBeVisible();
  await page.getByRole('button', { name: 'إنشاء اختبار', exact: true }).click();
  const form = page.locator('form[aria-label="نموذج إنشاء اختبار مدرسي"]');
  await expect(form).toBeVisible();
  await form.getByLabel('عنوان الاختبار المدرسي').fill('مسودة خاصة بمدرسة ألف');
  return form;
}

for (const width of [390, 820, 1440]) {
  test(`school A creator is closed when switching to equally entitled school B at ${width}px RTL`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await setup(page, true);
    await page.goto('/school-director-dashboard');
    await openAssessmentCreator(page);
    await page.getByLabel('المدرسة', { exact: true }).selectOption('school-b');
    const nav = page.getByRole('navigation', { name: 'أقسام لوحة مدير المدرسة' });
    await nav.getByRole('button', { name: 'اختبارات المدرسة', exact: true }).click();
    await expect(page.getByText('لا توجد اختبارات موجهة لهذه المدرسة حاليًا.')).toBeVisible();
    await page.screenshot({ path: `test-results/school-creator-switch-b-${width}-rtl.png`, fullPage: true });
    await expect(page.locator('form[aria-label="نموذج إنشاء اختبار مدرسي"]')).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'إنشاء اختبار', exact: true })).toBeVisible();
  });

  test(`creator stays closed after A to unauthorized B and return to A at ${width}px RTL`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await setup(page, false);
    await page.goto('/school-director-dashboard');
    await openAssessmentCreator(page);
    await page.getByLabel('المدرسة', { exact: true }).selectOption('school-b');
    const nav = page.getByRole('navigation', { name: 'أقسام لوحة مدير المدرسة' });
    await expect(nav.getByRole('button', { name: 'اختبارات المدرسة', exact: true })).toHaveCount(0);
    await expect(page.locator('form[aria-label="نموذج إنشاء اختبار مدرسي"]')).toHaveCount(0);
    await page.getByLabel('المدرسة', { exact: true }).selectOption('school-a');
    await nav.getByRole('button', { name: 'اختبارات المدرسة', exact: true }).click();
    await expect(page.getByText('لا توجد اختبارات موجهة لهذه المدرسة حاليًا.')).toBeVisible();
    await page.screenshot({ path: `test-results/school-creator-return-a-${width}-rtl.png`, fullPage: true });
    await expect(page.locator('form[aria-label="نموذج إنشاء اختبار مدرسي"]')).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'إنشاء اختبار', exact: true })).toBeVisible();
  });
}
