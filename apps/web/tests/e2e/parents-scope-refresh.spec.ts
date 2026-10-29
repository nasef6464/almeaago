import { expect, test, type Page, type Route } from '@playwright/test';

const parent = {
  id: 'parent-1', email: 'parent@example.com', name: 'ولي أمر',
  status: 'active', avatarUrl: '', emailVerified: true,
  role: 'parent', roles: ['parent'],
};
const result = (student: string, title: string) => ({
  attemptId: 'attempt-' + student, assessmentId: 'assessment-' + student,
  assessmentVersion: 1, title, attemptNumber: 1, score: 76,
  totalQuestions: 10, correctAnswers: 7, wrongAnswers: 2, unanswered: 1,
  passed: true, timeSpentSeconds: 600, finalizedAt: '2026-10-25T10:00:00Z',
});
const child = (id: string, name: string) => ({
  studentId: id, name, avatarUrl: '', schoolIds: [],
  weeklyStudyMinutes: 10, weeklyAssessmentCount: 1, weeklyAverageScore: 76,
  recentResults: [result(id, 'اختبار ' + name)], weakSkills: [], nextAction: '',
});
const children = [child('student-1', 'سارة'), child('student-2', 'أحمد')];
const dashboard = {
  children,
  summary: { totalChildren: 2, visibleChildren: 2, weeklyAssessmentCount: 2, weeklyAverageScore: 76, weakSkills: 0 },
  page: 1, limit: 20, hasMore: false,
};
function json(route: Route, body: unknown, status = 200) {
  return route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) });
}
async function auth(page: Page, roles = ['parent']) {
  await page.route('**/api/v1/auth/me', route => json(route, { user: { ...parent, role: roles[0], roles } }));
}

for (const width of [390, 820, 1440]) {
  test(`parent child results never retain another child's data on error and refresh at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await auth(page);
    await page.route('**/api/v1/parents/dashboard?**', route => json(route, dashboard));
    await page.route('**/api/v1/parents/children/student-1/results?**', route =>
      json(route, { items: [result('student-1', 'اختبار سارة')], page: 1, limit: 20, hasMore: false }));
    let secondCalls = 0;
    await page.route('**/api/v1/parents/children/student-2/results?**', route => {
      secondCalls += 1;
      return secondCalls === 1
        ? json(route, { message: 'تعذر تحميل نتائج أحمد' }, 503)
        : json(route, { items: [result('student-2', 'اختبار أحمد')], page: 1, limit: 20, hasMore: false });
    });

    await page.goto('/parent-dashboard');
    await page.getByRole('button', { name: 'نتائج الأبناء' }).click();
    await expect(page.getByText('اختبار سارة')).toBeVisible();
    await page.getByRole('button', { name: 'أحمد', exact: true }).click();
    await expect(page.getByRole('alert')).toContainText('تعذر تحميل نتائج أحمد');
    await expect(page.getByText('اختبار سارة')).toHaveCount(0);
    await expect(page.getByText('اختبار أحمد')).toHaveCount(0);

    await page.getByRole('button', { name: 'تحديث لوحة ولي الأمر' }).click();
    await expect(page.getByText('اختبار أحمد')).toBeVisible();
    await expect(page.getByText('اختبار سارة')).toHaveCount(0);
    expect(secondCalls).toBeGreaterThanOrEqual(2);
    await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await page.screenshot({ path: `test-results/parent-results-scope-${width}.png`, fullPage: true });
  });
}

test('non-parent role receives explicit forbidden UI and no parent API requests', async ({ page }) => {
  await auth(page, ['student']);
  let parentRequests = 0;
  page.on('request', request => {
    if (request.url().includes('/api/v1/parents/')) parentRequests += 1;
  });
  await page.goto('/parent-dashboard');
  await expect(page.getByText('هذه الصفحة مخصصة لولي الأمر.')).toBeVisible();
  expect(parentRequests).toBe(0);
});
