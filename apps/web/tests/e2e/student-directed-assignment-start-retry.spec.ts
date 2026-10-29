import { expect, test, type Route } from '@playwright/test';

const student = {
  id: 'student-directed-a',
  email: 'student@example.com',
  name: 'طالب',
  status: 'active',
  avatarUrl: '',
  emailVerified: true,
  role: 'student',
  roles: ['student'],
};
const assignment = (id = 'assignment-a') => ({
  assignmentId: id,
  assessmentId: 'assessment-a',
  assessmentVersion: 3,
  title: id === 'assignment-a' ? 'اختبار موجه' : 'اختبار آخر',
  schoolId: 'school-a',
  opensAt: null,
  closesAt: null,
  supervisorMessage: 'اختبار هذا الأسبوع',
  attemptCount: 0,
  maxAttempts: 3,
  canStart: true,
});
const respond = (route: Route, body: unknown, status = 200) =>
  route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) });

for (const width of [390, 820, 1440]) {
  test(`directed assessment retry preserves key, confirmed start rotates it, RTL ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await page.route('**/api/v1/auth/me', (route) => respond(route, { user: student }));
    await page.route('**/api/v1/auth/csrf', (route) => respond(route, { csrfToken: 'csrf' }));
    await page.route('**/api/v1/assessment-assignments/mine?**', (route) =>
      respond(route, { items: [assignment()], page: 1, limit: 30, hasMore: false }));
    const keys: string[] = [];
    await page.route('**/api/v1/assessment-assignments/assignment-a/start', (route) => {
      expect(route.request().headers()['x-csrf-token']).toBe('csrf');
      const key = JSON.parse(route.request().postData() || '{}').startKey as string;
      keys.push(key);
      if (keys.length === 1) return respond(route, { message: 'تعذر بدء التكليف' }, 503);
      return respond(route, { attempt: { id: `directed-attempt-${keys.length}` } }, 201);
    });
    await page.route('**/api/v1/assessment-attempts/**', (route) =>
      respond(route, { message: 'test attempt route' }, 404));

    await page.goto('/assessment-assignments');
    await expect(page.getByRole('heading', { name: 'الاختبارات الموجهة إليك' })).toBeVisible();
    await expect(page.getByText('DIRECTED ASSESSMENTS')).toHaveCount(0);
    await expect(page.getByText('v3', { exact: true })).toHaveCount(0);
    await page.getByRole('button', { name: 'ابدأ التكليف' }).click();
    await expect(page.getByRole('alert')).toContainText('تعذر بدء التكليف');
    await expect(page.getByRole('button', { name: 'ابدأ التكليف' })).toBeEnabled();
    await page.getByRole('button', { name: 'ابدأ التكليف' }).click();
    await expect(page).toHaveURL(/assessment-attempts\/directed-attempt-2/);
    expect(keys[0]).toBe(keys[1]);

    // Re-entering the same assignment after a confirmed start is a new
    // explicit attempt, never a replay of the previous idempotency key.
    await page.goto('/assessment-assignments');
    await page.getByRole('button', { name: 'ابدأ التكليف' }).click();
    await expect(page).toHaveURL(/assessment-attempts\/directed-attempt-3/);
    expect(keys[2]).not.toBe(keys[1]);
    await page.screenshot({ path: `test-results/directed-assignment-retry-${width}.png`, fullPage: true });
  });
}

test('failed inventory read shows error rather than a false empty state', async ({ page }) => {
  await page.route('**/api/v1/auth/me', (route) => respond(route, { user: student }));
  await page.route('**/api/v1/assessment-assignments/mine?**', (route) =>
    respond(route, { message: 'فشل جلب التكليفات' }, 503));
  await page.goto('/assessment-assignments');
  await expect(page.getByRole('alert')).toContainText('فشل جلب التكليفات');
  await expect(page.getByText('لا توجد تكليفات اختبار فعالة الآن.')).toHaveCount(0);
});

test('pending failed start key is scoped to the signed-in student', async ({ page }) => {
  let actorId = 'student-directed-a';
  await page.route('**/api/v1/auth/me', (route) =>
    respond(route, { user: { ...student, id: actorId } }));
  await page.route('**/api/v1/auth/csrf', (route) => respond(route, { csrfToken: 'csrf' }));
  await page.route('**/api/v1/assessment-assignments/mine?**', (route) =>
    respond(route, { items: [assignment()], page: 1, limit: 30, hasMore: false }));
  const keys: string[] = [];
  await page.route('**/api/v1/assessment-assignments/assignment-a/start', (route) => {
    keys.push(JSON.parse(route.request().postData() || '{}').startKey);
    return respond(route, { message: 'تعذر بدء التكليف' }, 503);
  });
  await page.goto('/assessment-assignments');
  await page.getByRole('button', { name: 'ابدأ التكليف' }).click();
  await expect(page.getByRole('alert')).toBeVisible();
  actorId = 'student-directed-b';
  await page.reload();
  await page.getByRole('button', { name: 'ابدأ التكليف' }).click();
  await expect(page.getByRole('alert')).toBeVisible();
  expect(keys).toHaveLength(2);
  expect(keys[1]).not.toBe(keys[0]);
});
