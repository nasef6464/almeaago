import { expect, test, type Page, type Route } from '@playwright/test';

// Legacy source: pages/Dashboard.tsx, assignedQuizzes cards: Arabic heading and type badge;
// a failed request is not a verified empty inventory. No invented English technical labels/version badges.
const student = { id: 'student-1', email: 'student@example.com', name: 'طالب', status: 'active', avatarUrl: '', emailVerified: true, role: 'student', roles: ['student'] };
const assignment = { assignmentId: 'assignment-1', assessmentId: 'assessment-1', assessmentVersion: 3, title: 'اختبار موجه', schoolId: 'school-1', opensAt: null, closesAt: null, supervisorMessage: 'اختبار هذا الأسبوع', attemptCount: 0, maxAttempts: 2, canStart: true };
const attempt = { id: 'directed-attempt-1', assessmentId: 'assessment-1', assessmentVersion: 3, attemptNumber: 1, status: 'in_progress', title: 'اختبار موجه', startedAt: '2026-10-30T00:00:00Z', expiresAt: null, submittedAt: null, showProgressBar: true, requireAnswerBeforeNext: false, allowQuestionReview: true, randomizeOptions: false, questions: [], answers: [] };
function json(route: Route, body: unknown, status = 200) {
  return route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) });
}
async function auth(page: Page) {
  await page.route('**/api/v1/auth/me', (route) => json(route, { user: student }));
  await page.route('**/api/v1/auth/csrf', (route) => json(route, { csrfToken: 'csrf' }));
}

for (const width of [390, 820, 1440]) {
  test(`directed assignments failed GET is error, never empty inventory at ${width}px RTL`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await auth(page);
    await page.route('**/api/v1/assessment-assignments/mine?**', (route) =>
      json(route, { message: 'تعذر تحميل التكليفات' }, 503));
    await page.goto('/assessment-assignments');
    await expect(page.getByText('تعذر تحميل التكليفات')).toBeVisible();
    await expect(page.getByText('لا توجد تكليفات اختبار فعالة الآن.')).toHaveCount(0);
    await expect(page.locator('main')).toHaveAttribute('dir', 'rtl');
  });

  test(`directed assignment removes source-absent technical labels at ${width}px RTL`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await auth(page);
    await page.route('**/api/v1/assessment-assignments/mine?**', (route) =>
      json(route, { items: [assignment], page: 1, limit: 30, hasMore: false }));
    await page.goto('/assessment-assignments');
    await expect(page.getByText('اختبار موجه')).toBeVisible();
    await expect(page.getByText('DIRECTED ASSESSMENTS')).toHaveCount(0);
    await expect(page.getByText('v3', { exact: true })).toHaveCount(0);
    await expect(page.locator('main')).toHaveAttribute('dir', 'rtl');
  });

  test(`directed assignment failed start retains action and idempotent retry at ${width}px RTL`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await auth(page);
    await page.route('**/api/v1/assessment-assignments/mine?**', (route) =>
      json(route, { items: [assignment], page: 1, limit: 30, hasMore: false }));
    const keys: string[] = [];
    await page.route('**/api/v1/assessment-assignments/assignment-1/start', (route) => {
      const payload = JSON.parse(route.request().postData() || '{}') as { startKey?: string };
      keys.push(payload.startKey || '');
      return keys.length === 1
        ? json(route, { message: 'تعذر بدء التكليف' }, 503)
        : json(route, { attempt }, 201);
    });
    await page.route('**/api/v1/assessment-attempts/directed-attempt-1', (route) => json(route, { attempt }));
    await page.goto('/assessment-assignments');
    const button = page.getByRole('button', { name: 'ابدأ التكليف' });
    await button.click();
    await expect(page.getByText('تعذر بدء التكليف')).toBeVisible();
    await expect(button).toBeEnabled();
    await button.click();
    await expect(page).toHaveURL(/assessment-attempts\/directed-attempt-1/);
    expect(keys).toHaveLength(2);
    expect(keys[0]).toBeTruthy();
    expect(keys[1]).toBe(keys[0]);
  });
}
