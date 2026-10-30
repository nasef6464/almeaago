import { expect, test, type Page, type Route } from '@playwright/test';

const originalConfirmation =
  'إذا كان البريد مسجلًا، ستصلك تعليمات الاستعادة. تحقق من البريد الوارد والرسائل غير المرغوب فيها.';

function respond(route: Route, status: number, body: unknown) {
  return route.fulfill({
    status,
    contentType: 'application/json',
    body: JSON.stringify(body),
  });
}

async function guest(page: Page) {
  await page.route('**/api/v1/auth/me', (route) =>
    respond(route, 401, { error: { message: 'unauthenticated' } }),
  );
}

for (const width of [390, 820, 1440]) {
  test.describe(`original public recovery at ${width}px RTL`, () => {
    test.beforeEach(async ({ page }) => {
      await page.setViewportSize({ width, height: 900 });
      await guest(page);
    });

    test('submits trimmed email and shows the original non-enumerating confirmation', async ({ page }) => {
      const bodies: unknown[] = [];
      await page.route('**/api/v1/auth/forgot-password', (route) => {
        bodies.push(route.request().postDataJSON());
        return respond(route, 200, { message: originalConfirmation });
      });

      await page.goto('/forgot-password');
      const main = page.locator('main[dir="rtl"]');
      await expect(main.getByRole('heading', { name: 'استعادة كلمة المرور' })).toBeVisible();
      await main.locator('#forgot-email').fill('  student@example.com  ');
      await main.getByRole('button', { name: 'إرسال التعليمات' }).click();
      await expect(main.getByText(originalConfirmation, { exact: true })).toBeVisible();
      await expect(main.locator('#forgot-email')).toHaveValue('  student@example.com  ');
      expect(bodies).toEqual([{ email: 'student@example.com' }]);
      await page.screenshot({ path: test.info().outputPath('recovery-success.png'), fullPage: true });
    });

    test('HTTP 503 keeps the email and error; retry shows only the original success text', async ({ page }) => {
      let calls = 0;
      await page.route('**/api/v1/auth/forgot-password', (route) => {
        calls += 1;
        if (calls === 1) {
          return respond(route, 503, { error: { message: 'الخدمة غير متاحة الآن' } });
        }
        return respond(route, 200, { message: originalConfirmation });
      });

      await page.goto('/forgot-password');
      const main = page.locator('main[dir="rtl"]');
      await main.locator('#forgot-email').fill('student@example.com');
      await main.getByRole('button', { name: 'إرسال التعليمات' }).click();
      await expect(main.getByText('الخدمة غير متاحة الآن')).toBeVisible();
      await expect(main.locator('#forgot-email')).toHaveValue('student@example.com');
      await page.screenshot({ path: test.info().outputPath('recovery-failure.png'), fullPage: true });

      await main.getByRole('button', { name: 'إرسال التعليمات' }).click();
      await expect(main.getByText(originalConfirmation, { exact: true })).toBeVisible();
      await expect(main.getByText('الخدمة غير متاحة الآن')).toHaveCount(0);
      expect(calls).toBe(2);
    });

    test('browser back/forward and reload keep the original route and empty form state', async ({ page }) => {
      await page.goto('/');
      await page.goto('/forgot-password');
      await expect(page.getByRole('heading', { name: 'استعادة كلمة المرور' })).toBeVisible();
      await page.goBack();
      await expect(page).toHaveURL('/');
      await page.goForward();
      await expect(page).toHaveURL('/forgot-password');
      await page.reload();
      await expect(page.locator('#forgot-email')).toHaveValue('');
      await expect(page.getByRole('button', { name: 'إرسال التعليمات' })).toBeVisible();
    });
  });
}
