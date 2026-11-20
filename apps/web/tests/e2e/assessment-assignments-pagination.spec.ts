import { expect, test } from '@playwright/test';

test('student can page through assignments, retry a failed page, and see its deadline', async ({ page }) => {
  const student = { id: 'student-1', email: 'student@example.com', name: 'طالب', status: 'active', role: 'student', roles: ['student'] };
  await page.route('**/api/v1/auth/me', route => route.fulfill({ json: { user: student } }));
  await page.route('**/api/v1/assessment-assignments/mine?**', route => {
    const pageNo = Number(new URL(route.request().url()).searchParams.get('page'));
    if (pageNo === 2 && !failed) { failed = true; return route.fulfill({ status: 503, json: { message: 'تعذر تحميل التكليفات' } }); }
    return route.fulfill({ json: { items: [{ assignmentId: `a${pageNo}`, assessmentId: `e${pageNo}`, title: `اختبار ${pageNo}`, attemptCount: 0, maxAttempts: 1, canStart: true, closesAt: pageNo === 2 ? '2026-11-23T12:00:00Z' : null }], page: pageNo, limit: 30, hasMore: pageNo === 1 } });
  });
  let failed = false;
  await page.goto('/assessment-assignments');
  await expect(page.getByRole('heading', { name: 'اختبار 1' })).toBeVisible();
  await page.getByRole('button', { name: 'الصفحة التالية للتكليفات' }).click();
  await expect(page.getByRole('alert')).toContainText('تعذر تحميل التكليفات');
  await page.getByRole('button', { name: 'إعادة محاولة تحميل التكليفات' }).click();
  await expect(page.getByRole('heading', { name: 'اختبار 2' })).toBeVisible();
  await expect(page.getByText('آخر موعد:', { exact: false })).toBeVisible();
  await expect(page.getByRole('button', { name: 'الصفحة التالية للتكليفات' })).toBeDisabled();
  await page.getByRole('button', { name: 'الصفحة السابقة للتكليفات' }).click();
  await expect(page.getByRole('heading', { name: 'اختبار 1' })).toBeVisible();
});
