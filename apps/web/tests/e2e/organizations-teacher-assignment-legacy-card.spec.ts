import { expect, test, type Page, type Route } from '@playwright/test';

// The assignment card is copied from the latest read-only Legacy
// dashboards/school-director/DirectorTeacherAssignments.tsx. The screen
// continues to use Go HTTP/DB contracts; no extra controls are introduced.
const director = {
  id: 'director-parity', email: 'director@ci.invalid', name: 'مدير المدرسة',
  status: 'active', avatarUrl: '', emailVerified: true,
  role: 'school_admin', roles: ['school_admin'],
};
const activeAssignment = {
  assignmentId: 'assignment-active', teacherId: 'teacher-1',
  classId: 'class-1', subjectId: 'subject-1', status: 'active',
};
const orphanAssignment = {
  assignmentId: 'assignment-orphan', teacherId: 'teacher-1',
  classId: 'class-archived', subjectId: 'subject-1', status: 'active',
};
const inactiveAssignment = {
  assignmentId: 'assignment-inactive', teacherId: 'teacher-1',
  classId: 'class-2', subjectId: 'subject-1', status: 'inactive',
};

function json(route: Route, body: unknown, status = 200) {
  return route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) });
}

async function setup(page: Page) {
  let assignments = [activeAssignment, orphanAssignment, inactiveAssignment];
  let failures = 1;
  const writes: { body: Record<string, string>; csrf: string }[] = [];
  await page.route('**/api/v1/auth/me', route => json(route, { user: director }));
  await page.route('**/api/v1/auth/csrf', route => json(route, { csrfToken: 'csrf-parity' }));
  await page.route('**/api/v1/taxonomy/bootstrap?phase=core', route => json(route, {
    paths: [{ id: 'path-1', name: 'القدرات' }],
    subjects: [{ id: 'subject-1', pathId: 'path-1', name: 'الرياضيات', code: 'MATH', sortOrder: 1 }],
  }));
  await page.route('**/api/v1/schools/context', route => json(route, { contexts: [{
    schoolId: 'school-1', schoolName: 'مدرسة الاختبار', role: 'school_admin',
    permissions: ['SCHOOL_TEACHERS_ASSIGN'], modules: ['SCHOOL_CORE'], source: 'membership',
  }] }));
  await page.route('**/api/v1/schools/school-1/classes*', route => json(route, {
    classes: [
      { id: 'class-1', schoolId: 'school-1', name: 'الأول أ', code: 'A1', status: 'active' },
      { id: 'class-2', schoolId: 'school-1', name: 'الأول ب', code: 'B1', status: 'active' },
    ], pagination: { page: 1, limit: 100, total: 2, totalPages: 1 },
  }));
  await page.route('**/api/school-access/director/schools/school-1/teachers', route => json(route, {
    teachers: [{ teacherId: 'teacher-1', name: 'المعلم الأول', email: 'teacher@ci.invalid', isActive: true }],
    assignments,
  }));
  await page.route('**/api/school-access/director/schools/school-1/assignments', route => {
    const body = route.request().postDataJSON() as Record<string, string>;
    writes.push({ body, csrf: route.request().headers()['x-csrf-token'] || '' });
    if (failures-- > 0) return json(route, { message: 'تعذر إيقاف التكليف' }, 503);
    assignments = assignments.map(row =>
      row.teacherId === body.teacherId && row.classId === body.classId &&
      row.subjectId === body.subjectId ? { ...row, status: body.status } : row,
    );
    return json(route, { assignment: { ...activeAssignment, ...body } });
  });
  return { writes };
}

for (const width of [390, 820, 1440]) {
  test(`director assignment card follows Legacy and preserves failed-stop retry at ${width}px RTL`, async ({ page }) => {
    await page.setViewportSize({ width, height: 950 });
    const { writes } = await setup(page);
    await page.goto('/school-director-dashboard');
    const card = page.getByRole('region', { name: 'تكليفات المعلم الحالية' });
    await page.getByLabel('المعلم', { exact: true }).selectOption('teacher-1');

    // Original: h4, exact spacing, white assignment rows, no invented actions.
    await expect(card.locator('h4')).toHaveText('تكليفات المعلم الحالية');
    await expect(card).toHaveClass(/pt-3/);
    await expect(card.locator('li')).toHaveCount(2);
    await expect(card.locator('li').first()).toHaveClass(/bg-white/);
    await expect(card).toContainText('الأول أ · الرياضيات');
    await expect(card).toContainText('فصل مسجل · الرياضيات');
    await expect(card).not.toContainText('الأول ب');
    await expect(card.getByRole('button', { name: 'إيقاف التكليف' })).toHaveCount(2);
    await expect(card.getByRole('button', { name: /حذف|تفاصيل|إعادة تعيين/ })).toHaveCount(0);

    // HTTP failure keeps the same assignment and its stop action for retry.
    await card.getByRole('button', { name: 'إيقاف التكليف' }).first().click();
    await expect(page.getByText('تعذر إيقاف التكليف')).toBeVisible();
    await expect(card.locator('li')).toHaveCount(2);
    await expect(card.getByRole('button', { name: 'إيقاف التكليف' }).first()).toBeEnabled();

    // A second attempt persists, refreshes from GET, and survives page reload.
    await card.getByRole('button', { name: 'إيقاف التكليف' }).first().click();
    await expect(page.getByText('تم إيقاف التكليف دون تغيير التقارير السابقة.')).toBeVisible();
    await expect(card.locator('li')).toHaveCount(1);
    expect(writes).toHaveLength(2);
    expect(writes.every(entry => entry.csrf === 'csrf-parity')).toBe(true);
    expect(writes.every(entry =>
      entry.body.teacherId === 'teacher-1' && entry.body.classId === 'class-1' &&
      entry.body.subjectId === 'subject-1' && entry.body.status === 'inactive',
    )).toBe(true);

    await page.reload();
    await page.getByLabel('المعلم', { exact: true }).selectOption('teacher-1');
    await expect(card.locator('li')).toHaveCount(1);
    await expect(card).toContainText('فصل مسجل · الرياضيات');
    await page.screenshot({ path: `test-results/school-teacher-assignment-${width}.png`, fullPage: true });
  });
}
