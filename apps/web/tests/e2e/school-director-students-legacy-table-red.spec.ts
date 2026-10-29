import { expect, test, type Page, type Route } from '@playwright/test';

// RED contract only. Owner of the page: PR #172. Never change the page here.
// Source: almeaacodax/main@bf7281fc dashboards/SchoolDirectorDashboard.tsx
// (student section: original 4-column table + useDisplayLimit(12)).
const director = {
  id: 'director-roster-parity', email: 'director@school.test', name: 'مدير المدرسة',
  status: 'active', avatarUrl: '', emailVerified: true,
  role: 'school_admin', roles: ['school_admin'],
};
const students = Array.from({ length: 14 }, (_, index) => {
  const number = String(index + 1).padStart(2, '0');
  return {
    studentId: `student-${number}`, name: `طالب ${number}`,
    email: `student-${number}@school.test`, phone: '',
    isActive: true, classId: 'class-1', className: 'الأول أ',
  };
});
const permissions = [
  'SCHOOL_OVERVIEW_VIEW', 'SCHOOL_STUDENTS_VIEW', 'SCHOOL_STUDENTS_UPDATE_BASIC',
];

function json(route: Route, body: unknown) {
  return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(body) });
}
async function fixture(page: Page) {
  await page.route('**/api/v1/auth/me', route => json(route, { user: director }));
  await page.route('**/api/v1/auth/csrf', route => json(route, { csrfToken: 'csrf-roster-parity' }));
  await page.route('**/api/v1/schools/context', route => json(route, {
    contexts: [{
      schoolId: 'school-1', schoolName: 'مدرسة الفرسان',
      role: 'school_admin', source: 'membership',
      permissions, modules: ['SCHOOL_CORE'],
    }],
  }));
  await page.route('**/api/school-access/director/schools/school-1/overview', route => json(route, {
    school: { schoolId: 'school-1', schoolName: 'مدرسة الفرسان' },
    metrics: { students: 14, classes: 1, teachers: 0, supervisors: 0, schoolAssessments: 0, completedSmartClasses: 0 },
    classes: [{ classId: 'class-1', className: 'الأول أ' }],
  }));
  await page.route('**/api/school-access/director/schools/school-1/students*',
    route => json(route, { students, total: students.length }));
}
async function openStudents(page: Page) {
  await fixture(page);
  await page.goto('/school-director-dashboard');
  await page.getByRole('navigation', { name: 'أقسام لوحة مدير المدرسة' })
    .getByRole('button', { name: 'الطلاب', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'طلاب مدرسة الفرسان' })).toBeVisible();
}

for (const width of [390, 820, 1440]) {
  test(`Legacy director roster uses a four-column semantic table at ${width}px RTL`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await openStudents(page);
    await page.screenshot({ path: `test-results/school-students-table-red-${width}-rtl.png`, fullPage: true });
    const table = page.getByRole('table');
    await expect(table).toBeVisible();
    await expect(table.locator('thead th')).toHaveText(['الطالب', 'الحالة', 'الفصل', 'عمليات مفوضة']);
    await expect(page.getByText('عدد الطلاب في القائمة:', { exact: false })).toHaveCount(0);
    if (width === 390) {
      const hasHorizontalOverflow = await table.evaluate(el => {
        const scroller = el.closest('.overflow-x-auto');
        return Boolean(scroller && scroller.scrollWidth > scroller.clientWidth);
      });
      expect(hasHorizontalOverflow).toBe(true);
    }
  });

  test(`Legacy director roster starts at 12 rows and supports show more/less at ${width}px RTL`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await openStudents(page);
    const table = page.getByRole('table');
    await expect(table.locator('tbody tr')).toHaveCount(12);
    const controls = page.getByRole('group', { name: 'طلاب المدرسة' });
    await expect(controls).toContainText('عرض 12 من 14');
    await controls.getByRole('button', { name: 'عرض المزيد' }).click();
    await expect(table.locator('tbody tr')).toHaveCount(14);
    await expect(controls).toContainText('عرض 14 من 14');
    await controls.getByRole('button', { name: 'عرض أقل' }).click();
    await expect(table.locator('tbody tr')).toHaveCount(12);
  });

  test(`Legacy director inline edit stays inside the student table and cancel restores row at ${width}px RTL`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await openStudents(page);
    const table = page.getByRole('table');
    const first = table.locator('tbody tr').first();
    await expect(first).toContainText('طالب 01');
    await first.getByRole('button', { name: 'تعديل طالب 01' }).click();
    const name = first.getByRole('textbox').first();
    await expect(name).toHaveValue('طالب 01');
    await name.fill('مسودة لم تحفظ');
    await first.getByRole('button', { name: 'إلغاء' }).click();
    await expect(first).toContainText('طالب 01');
    await expect(first).not.toContainText('مسودة لم تحفظ');
  });
}
