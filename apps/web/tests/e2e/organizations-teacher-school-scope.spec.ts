import { expect, test, type Page, type Route } from '@playwright/test';

const teacher = {
  id: 'teacher-1', email: 'teacher@example.com', name: 'معلم الرياضيات',
  status: 'active', avatarUrl: '', emailVerified: true, role: 'teacher', roles: ['teacher'],
};
const schools = [
  { schoolId: 'school-a', schoolName: 'مدرسة ألف', source: 'membership', assignments: [
    { assignmentId: 'assign-a', classId: 'class-a', className: 'الأول ألف', subjectId: 'math-a', studentCount: 11 },
  ] },
  { schoolId: 'school-b', schoolName: 'مدرسة باء', source: 'membership', assignments: [
    { assignmentId: 'assign-b', classId: 'class-b', className: 'الثاني باء', subjectId: 'math-b', studentCount: 23 },
  ] },
];

function json(route: Route, body: unknown, status = 200) {
  return route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) });
}
async function auth(page: Page, user: typeof teacher | null = teacher) {
  await page.route('**/api/v1/auth/me', route => json(route, { user }));
}

test('teacher keeps the selected authorized school and original overview on back/reload at 390, 820, 1440', async ({ page }) => {
  await auth(page);
  await page.route('**/api/v1/schools/teacher-workspace', route => json(route, {
    personas: { platformTrainer: false, schoolTeacher: true }, schools,
  }));
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/school-teacher-dashboard?schoolId=school-b');
  await expect(page.getByTestId('teacher-workspace')).toBeVisible();
  await expect(page.getByLabel('المدرسة الحالية')).toHaveValue('school-b');
  await expect(page.getByText('الثاني باء')).toBeVisible();
  await expect(page.getByText('الأول ألف')).toHaveCount(0);
  await expect(page.getByRole('navigation', { name: 'تنقل لوحة معلم المدرسة' })).toContainText('التعلم والجاهزية');
  await expect(page.getByRole('navigation', { name: 'تنقل لوحة معلم المدرسة' })).toContainText('اختباراتي وتكليفاتي');
  await expect(page.getByRole('link', { name: 'بدء حصة ذكية لهذا الفصل' })).toHaveAttribute('href', /schoolId=school-b.*assignmentId=assign-b/);
  await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  await page.screenshot({ path: 'test-results/teacher-school-b-390.png', fullPage: true });

  await page.getByLabel('المدرسة الحالية').selectOption('school-a');
  await expect(page).toHaveURL(/schoolId=school-a/);
  await expect(page.getByText('الأول ألف')).toBeVisible();
  await expect(page.getByText('الثاني باء')).toHaveCount(0);
  await page.setViewportSize({ width: 820, height: 900 });
  await page.reload();
  await expect(page.getByLabel('المدرسة الحالية')).toHaveValue('school-a');
  await expect(page.getByText('الأول ألف')).toBeVisible();
  await page.screenshot({ path: 'test-results/teacher-school-a-820.png', fullPage: true });

  await page.goBack();
  await expect(page.getByLabel('المدرسة الحالية')).toHaveValue('school-b');
  await expect(page.getByText('الثاني باء')).toBeVisible();
  await expect(page.getByText('الأول ألف')).toHaveCount(0);
  await page.setViewportSize({ width: 1440, height: 1000 });
  await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  await page.screenshot({ path: 'test-results/teacher-school-b-1440.png', fullPage: true });
});

test('teacher workspace fails closed, retries the same school, and never falls back to an unassigned school', async ({ page }) => {
  await auth(page);
  let unavailable = true;
  await page.route('**/api/v1/schools/teacher-workspace', route =>
    unavailable ? json(route, { message: 'الخدمة غير متاحة' }, 503) : json(route, {
      personas: { platformTrainer: false, schoolTeacher: true }, schools: [schools[0]],
    }));
  await page.goto('/school-teacher-dashboard?schoolId=school-b');
  await expect(page.getByRole('alert')).toContainText('الخدمة غير متاحة');
  await expect(page.getByText('الأول ألف')).toHaveCount(0);
  unavailable = false;
  await page.getByRole('button', { name: 'إعادة المحاولة' }).click();
  await expect(page.getByText('المدرسة المحددة لم تعد ضمن تكليفاتك')).toBeVisible();
  await expect(page.getByText('الأول ألف')).toHaveCount(0);
  await expect(page.getByText('الثاني باء')).toHaveCount(0);
});

test('non-teacher role never requests teacher workspace', async ({ page }) => {
  await auth(page, { ...teacher, role: 'student', roles: ['student'] });
  let reads = 0;
  await page.route('**/api/v1/schools/teacher-workspace', route => {
    reads += 1;
    return json(route, { personas: { platformTrainer: false, schoolTeacher: false }, schools });
  });
  await page.goto('/school-teacher-dashboard?schoolId=school-b');
  await expect(page.getByText('هذه المساحة للمعلم المخول.')).toBeVisible();
  expect(reads).toBe(0);
});

test('classroom entry consumes the authorized school/assignment and never inherits another school session', async ({ page }) => {
  await auth(page);
  await page.route('**/api/v1/schools/teacher-workspace', route => json(route, {
    personas: { platformTrainer: false, schoolTeacher: true }, schools,
  }));
  await page.route('**/api/v1/taxonomy/bootstrap?phase=core', route => json(route, {
    paths: [{ id: 'path-1', code: 'PATH', name: 'قدرات' }],
    subjects: [{ id: 'math-a', pathId: 'path-1', code: 'MA', name: 'رياضيات أ' }, { id: 'math-b', pathId: 'path-1', code: 'MB', name: 'رياضيات ب' }],
  }));
  await page.route('**/api/v1/classroom/teacher/sessions', route => json(route, { sessions: [{
    id: 'other-school-session', schoolId: 'school-a', classId: 'class-a', subjectId: 'math-a',
    teacherId: 'teacher-1', status: 'draft', day: '', period: null, publishedMode: 'single',
    activeBatchId: '', activeQuestionOrdinal: null, pinExpiresAt: '', revision: 1,
    startedAt: null, endedAt: null, createdAt: '', updatedAt: '',
  }] }));
  const requestedSchools: string[] = [];
  await page.route('**/api/v1/classroom/questions*', route => {
    const url = new URL(route.request().url());
    requestedSchools.push(url.searchParams.get('schoolId') || '');
    return json(route, { items: [], page: 1, limit: 30, hasMore: false });
  });
  await page.route('**/api/v1/schools/*/roster?*', route => json(route, {
    members: [], pagination: { page: 1, limit: 100, total: 0, totalPages: 1 },
  }));
  await page.goto('/school-teacher-dashboard/classroom?schoolId=school-b&assignmentId=assign-b');
  await expect(page.getByRole('heading', { name: 'نطاق التدريس' })).toBeVisible();
  await expect(page.getByRole('button', { name: /مدرسة باء · الثاني باء/ })).toHaveClass(/border-indigo-500/);
  await expect(page.getByText('الحصة الحالية')).toHaveCount(0);
  await expect.poll(() => requestedSchools).toContain('school-b');
  expect(requestedSchools).not.toContain('school-a');

  await page.getByRole('button', { name: /مدرسة ألف · الأول ألف/ }).click();
  await expect(page).toHaveURL(/schoolId=school-a&assignmentId=assign-a/);
  await expect(page.getByRole('button', { name: /مدرسة ألف · الأول ألف/ })).toHaveClass(/border-indigo-500/);
  await expect.poll(() => requestedSchools).toContain('school-a');
  await page.goBack();
  await expect(page.getByRole('button', { name: /مدرسة باء · الثاني باء/ })).toHaveClass(/border-indigo-500/);
  await page.reload();
  await expect(page.getByRole('button', { name: /مدرسة باء · الثاني باء/ })).toHaveClass(/border-indigo-500/);
});

test('classroom rejects a revoked school assignment instead of silently choosing another class', async ({ page }) => {
  await auth(page);
  await page.route('**/api/v1/schools/teacher-workspace', route => json(route, {
    personas: { platformTrainer: false, schoolTeacher: true }, schools: [schools[0]],
  }));
  await page.route('**/api/v1/taxonomy/bootstrap?phase=core', route => json(route, { paths: [], subjects: [] }));
  await page.route('**/api/v1/classroom/teacher/sessions', route => json(route, { sessions: [] }));
  let questionRequests = 0;
  await page.route('**/api/v1/classroom/questions*', route => {
    questionRequests += 1;
    return json(route, { items: [], page: 1, limit: 30, hasMore: false });
  });
  await page.goto('/school-teacher-dashboard/classroom?schoolId=school-b&assignmentId=assign-b');
  await expect(page.getByRole('alert')).toContainText('النطاق المحدد لم يعد ضمن تكليفاتك');
  expect(questionRequests).toBe(0);
  await expect(page.getByText('الحصة الحالية')).toHaveCount(0);
});
