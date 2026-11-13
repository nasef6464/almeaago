import { expect, test } from '@playwright/test';

test('يربط المسؤول السؤال بقسم من مادته ويزيل الربط', async ({ page }) => {
  test.setTimeout(600_000);
  let stored = '';
  await page.route('**/api/v1/questions/question1/section', route => {
    if (route.request().method() === 'PUT') {
      expect(route.request().headers()['x-csrf-token']).toBe('csrf');
      stored = route.request().postDataJSON().sectionId;
    }
    return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ sectionId: stored }) });
  });
  await page.goto('/tests/e2e/fixtures/question-section.html', { waitUntil: 'domcontentloaded', timeout: 240_000 });
  const select = page.getByLabel('قسم السؤال');
  await expect(select).toBeEnabled();
  await expect(select.locator('option')).toHaveCount(2);
  await select.selectOption('section1');
  await page.getByRole('button', { name: 'حفظ قسم السؤال' }).click();
  await expect(page.getByRole('status')).toContainText('حُفظ');
  expect(stored).toBe('section1');
  await select.selectOption('');
  await page.getByRole('button', { name: 'حفظ قسم السؤال' }).click();
  await expect.poll(() => stored).toBe('');
});

test('لا يسمح بتغيير قسم السؤال إذا فشل تحميله', async ({ page }) => {
  test.setTimeout(600_000);
  await page.route('**/api/v1/questions/question1/section', route => route.fulfill({ status: 500 }));
  await page.goto('/tests/e2e/fixtures/question-section.html', { waitUntil: 'domcontentloaded', timeout: 240_000 });
  await expect(page.getByRole('alert')).toContainText('تعذر تحميل');
  await expect(page.getByLabel('قسم السؤال')).toBeDisabled();
  await expect(page.getByRole('button', { name: 'حفظ قسم السؤال' })).toBeDisabled();
});
