import { test, expect } from '@playwright/test';

test('assignment reports failure honestly and saves only explicitly selected class', async ({ page }) => {
  test.setTimeout(120_000);
  let writes = 0;
  let notifications = 0;
  let body: any;
  await page.route('**/api/v1/assessments?*', route => route.fulfill({ json: { items: [{ id: 'a1', code: 'A1', title: 'اختبار تجريبي', kind: 'normal', workflowStatus: 'approved', isPublished: true }] } }));
  await page.route('**/api/v1/auth/csrf', route => route.fulfill({ json: { csrfToken: 'csrf' } }));
  await page.route('**/api/v1/notifications/**', route => { notifications++; return route.fulfill({ status: 500 }); });
  await page.route('**/api/v1/assessments/a1/assignments', route => {
    writes++;
    body = route.request().postDataJSON();
    return route.fulfill(writes === 1 ? { status: 403, json: { message: 'غير مسموح' } } : { status: 201, json: {} });
  });
  await page.goto('/tests/e2e/fixtures/supervisor-assignment.html');
  await page.getByText('توجيه / إعدادات').first().click();
  await page.getByRole('button', { name: 'حفظ التكليف للطلاب' }).click();
  await expect(page.getByRole('alert')).toContainText('اختر مدرسة');
  expect(writes).toBe(0);
  await page.getByLabel('الفصل الأول').check();
  await page.getByRole('button', { name: 'حفظ التكليف للطلاب' }).click();
  await expect(page.getByRole('alert')).toContainText('غير مسموح');
  await page.getByRole('button', { name: 'حفظ التكليف للطلاب' }).click();
  await expect(page.getByText('تم حفظ تكليف اختبار', { exact: false })).toBeVisible();
  expect(body.schoolId).toBe('school-a');
  expect(body.classIds).toEqual(['class-a']);
  expect(body.userIds).toEqual([]);
  expect(writes).toBe(2);
  expect(notifications).toBe(0);
});

