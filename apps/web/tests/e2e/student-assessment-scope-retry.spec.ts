import { expect, test, type Page, type Route } from '@playwright/test';

const student = { id: 'student-1', email: 'student@example.com', name: 'طالب', status: 'active', avatarUrl: '', emailVerified: true, role: 'student', roles: ['student'] };
const taxonomy = {
  paths: [
    { id: 'path-1', code: 'QDR', name: 'القدرات', description: '', sortOrder: 1 },
    { id: 'path-2', code: 'TAH', name: 'التحصيلي', description: '', sortOrder: 2 },
  ],
  subjects: [
    { id: 'subject-1', pathId: 'path-1', code: 'QNT', name: 'الكمي', sortOrder: 1 },
    { id: 'subject-2', pathId: 'path-2', code: 'MTH', name: 'الرياضيات', sortOrder: 1 },
  ],
};
const placement = (title: string, id = 'placement-1') => ({
  placementId: id, assessmentId: 'assessment-1', assessmentVersion: 1,
  assessmentKind: 'normal', title, slot: 'tests', pathId: 'path-1',
  subjectId: 'subject-1', courseId: '', lessonId: '', topicId: '',
  sortOrder: 0, attemptCount: 0, maxAttempts: 2, accessType: 'free',
  baseAccessType: 'free', accessAllowed: true, accessReason: 'free_assessment', canStart: true,
});
const attempt = (id: string) => ({
  id, assessmentId: 'assessment-1', assessmentVersion: 1, attemptNumber: 1,
  status: 'in_progress', title: 'اختبار الكمي', startedAt: '2026-10-29T10:00:00Z',
  expiresAt: null, submittedAt: null, showProgressBar: true,
  requireAnswerBeforeNext: false, allowQuestionReview: true,
  randomizeOptions: false, questions: [], answers: [],
});
function json(route: Route, body: unknown, status = 200) {
  return route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) });
}
async function setup(page: Page) {
  await page.route('**/api/v1/auth/me', (r) => json(r, { user: student }));
  await page.route('**/api/v1/auth/csrf', (r) => json(r, { csrfToken: 'csrf' }));
  await page.route('**/api/v1/taxonomy/bootstrap?phase=core', (r) => json(r, taxonomy));
}
async function choose(page: Page, path = 'path-1', subject = 'subject-1') {
  await page.getByLabel('المسار').selectOption(path);
  await page.getByLabel('المادة').selectOption(subject);
}

test('failed new learning scope never displays tests from the previous scope', async ({ page }) => {
  await setup(page);
  await page.route('**/api/v1/assessment-placements/available?**', (r) => {
    const u = new URL(r.request().url());
    if (u.searchParams.get('pathId') === 'path-2') {
      return json(r, { message: 'تعذر تحميل نطاق الرياضيات' }, 503);
    }
    return json(r, { items: [placement('اختبار القدرات القديم')], page: 1, limit: 30, hasMore: false });
  });
  await page.goto('/assessments');
  await choose(page);
  await expect(page.getByText('اختبار القدرات القديم')).toBeVisible();
  await choose(page, 'path-2', 'subject-2');
  await expect(page.getByText('تعذر تحميل نطاق الرياضيات')).toBeVisible();
  await expect(page.getByText('اختبار القدرات القديم')).not.toBeVisible();
  await expect(page.getByText('لا توجد اختبارات مطلوبة هنا الآن')).not.toBeVisible();
  await page.screenshot({ path: 'test-results/student-assessment-scope-error-390.png', fullPage: true });
});

test('changing path and subject clears course placement context before any new request', async ({ page }) => {
  await setup(page);
  const invalidRequests: string[] = [];
  await page.route('**/api/v1/learning-spaces/*/subjects/*?**', (r) => {
    const path = new URL(r.request().url()).pathname;
    const course = path.includes('/path-2/') ? 'course-2' : 'course-1';
    return json(r, { courses: { items: [{ id: course, title: course }], hasMore: false },
      foundation: { items: [], hasMore: false } });
  });
  await page.route('**/api/v1/assessment-placements/available?**', (r) => {
    const u = new URL(r.request().url());
    if (u.searchParams.get('pathId') === 'path-2' && u.searchParams.get('courseId') === 'course-1') {
      invalidRequests.push(u.toString());
    }
    return json(r, { items: [], page: 1, limit: 30, hasMore: false });
  });
  await page.goto('/assessments');
  await page.getByLabel('نوع مكان التعلم').selectOption('course');
  await choose(page);
  await expect(page.getByLabel('الدورة').locator('option[value="course-1"]')).toHaveCount(1);
  await page.getByLabel('الدورة').selectOption('course-1');
  await choose(page, 'path-2', 'subject-2');
  await expect(page.getByLabel('الدورة')).toHaveValue('');
  expect(invalidRequests).toEqual([]);
});

test('confirmed start rotates placement idempotency key for a later attempt', async ({ page }) => {
  await setup(page);
  const keys: string[] = [];
  await page.route('**/api/v1/assessment-placements/available?**', (r) =>
    json(r, { items: [placement('اختبار الكمي')], page: 1, limit: 30, hasMore: false }));
  await page.route('**/api/v1/assessment-placements/placement-1/start', (r) => {
    const body = JSON.parse(r.request().postData() || '{}') as { startKey: string };
    keys.push(body.startKey);
    return json(r, { attempt: attempt('attempt-' + keys.length) }, 201);
  });
  await page.route('**/api/v1/assessment-attempts/attempt-*', (r) => json(r, { attempt: attempt('attempt-1') }));
  for (let n = 1; n <= 2; n++) {
    await page.goto('/assessments');
    await choose(page);
    await expect(page.getByRole('button', { name: 'ابدأ الاختبار' })).toBeEnabled();
    await page.getByRole('button', { name: 'ابدأ الاختبار' }).click();
    await expect(page).toHaveURL(new RegExp('/assessment-attempts/attempt-' + n + '$'));
  }
  expect(keys).toHaveLength(2);
  expect(keys[0]).not.toBe(keys[1]);
});
