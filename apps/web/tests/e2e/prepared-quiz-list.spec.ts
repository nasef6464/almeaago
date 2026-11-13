import { expect, test } from '@playwright/test';

test('يعرض الاختبارات الجاهزة المسموح بها ويختار الطالب اختبارًا لبدئه', async ({ page }) => {
  test.setTimeout(240_000);
  const reply = (body: unknown) => ({ status: 200, contentType: 'application/json', body: JSON.stringify(body) });
  await page.route('**/api/v1/auth/me', route => route.fulfill(reply({ user: { id: 'student', name: 'طالب', role: 'student', roles: ['student'], status: 'active' } })));
  await page.route('**/api/v1/auth/csrf', route => route.fulfill(reply({ csrfToken: 'csrf' })));
  await page.route('**/api/v1/taxonomy/bootstrap?phase=full', route => route.fulfill(reply({ paths: [], subjects: [], skills: [] })));
  await page.route('**/api/v1/assessment-attempts/self/current', route => route.fulfill({ status: 404 }));
  await page.route('**/api/v1/assessments/prepared-available', route => route.fulfill(reply({ quizzes: [{ id: 'q1', title: 'اختبار جاهز', mode: 'central', subjectName: 'الكمي', questionCount: 12 }, { id: 'q2', title: 'اختبار آخر', mode: 'saher', subjectName: '', questionCount: 8 }] })));
  const keys: string[] = [];
  await page.route('**/api/v1/assessments/q1/attempts', async route => {
    keys.push(route.request().postDataJSON().startKey);
    await new Promise(resolve => setTimeout(resolve, 1000));
    await route.fulfill({ status: 403, contentType: 'application/json', body: JSON.stringify({ message: 'Forbidden' }) });
  });
  await page.goto('/quiz?mode=prepared', { waitUntil: 'domcontentloaded', timeout: 120_000 });
  const start = page.getByRole('button', { name: 'ابدأ الاختبار' });
  await expect(page.getByText('اختبار جاهز', { exact: true })).toBeVisible();
  await expect(page.getByText('الكمي • 12 سؤال')).toBeVisible();
  await expect(page.locator('button[aria-pressed="true"]')).toContainText('اختبار جاهز');
  await expect(start).toBeEnabled();
  await start.click();
  await expect(page.getByRole('button', { name: /اختبار آخر/ })).toBeDisabled();
  await expect(page.getByRole('alert')).toContainText('تعذر بدء الاختبار');
  await start.click();
  await expect.poll(() => keys.length).toBe(2);
  expect(keys[0]).toBeTruthy();
  expect(keys[1]).toBe(keys[0]);
});
