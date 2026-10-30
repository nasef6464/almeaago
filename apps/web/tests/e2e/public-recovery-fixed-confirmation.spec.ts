import { expect, test, type Page, type Route } from '@playwright/test';

// Oracle: almeaacodax/main pages/ForgotPassword.tsx.
// Legacy deliberately ignores the server's success message and always shows
// the same non-enumerating Arabic confirmation after a successful request.
const originalConfirmation =
  'إذا كان البريد مسجلًا، ستصلك تعليمات الاستعادة. تحقق من البريد الوارد والرسائل غير المرغوب فيها.';

async function signedOut(page: Page) {
  await page.route('**/api/v1/auth/me', (route) =>
    route.fulfill({
      status: 401,
      contentType: 'application/json',
      body: JSON.stringify({ error: { message: 'unauthenticated' } }),
    }),
  );
}

function json(route: Route, status: number, body: unknown) {
  return route.fulfill({
    status,
    contentType: 'application/json',
    body: JSON.stringify(body),
  });
}

for (const width of [390, 820, 1440]) {
  test.describe('Legacy recovery success copy at ' + width + 'px RTL', () => {
    test.beforeEach(async ({ page }) => {
      await page.setViewportSize({ width, height: 900 });
      await signedOut(page);
    });

    test('ignores an arbitrary server success message and preserves the original text', async ({ page }) => {
      const requests: unknown[] = [];
      await page.route('**/api/v1/auth/forgot-password', (route) => {
        requests.push(route.request().postDataJSON());
        return json(route, 200, { message: 'Account found. A link was sent.' });
      });

      await page.goto('/forgot-password');
      const main = page.locator('main[dir="rtl"]');
      await main.locator('#forgot-email').fill('student@example.com');
      await main.getByRole('button', { name: 'إرسال التعليمات' }).click();
      await expect(main.getByText(originalConfirmation, { exact: true })).toBeVisible();
      await expect(main.getByText('Account found. A link was sent.')).toHaveCount(0);
      await expect(main.locator('#forgot-email')).toHaveValue('student@example.com');
      expect(requests).toEqual([{ email: 'student@example.com' }]);
      await page.screenshot({ path: test.info().outputPath('recovery-original-success.png'), fullPage: true });
    });

    test('empty success payload uses the original confirmation, not invented fallback', async ({ page }) => {
      await page.route('**/api/v1/auth/forgot-password', (route) => json(route, 200, {}));
      await page.goto('/forgot-password');
      const main = page.locator('main[dir="rtl"]');
      await main.locator('#forgot-email').fill('student@example.com');
      await main.getByRole('button', { name: 'إرسال التعليمات' }).click();
      await expect(main.getByText(originalConfirmation, { exact: true })).toBeVisible();
    });

    test('503 retains the email; successful retry replaces the error with original copy', async ({ page }) => {
      let calls = 0;
      await page.route('**/api/v1/auth/forgot-password', (route) => {
        calls += 1;
        return calls === 1
          ? json(route, 503, { error: { message: 'الخدمة غير متاحة الآن' } })
          : json(route, 200, { message: 'A different success message' });
      });

      await page.goto('/forgot-password');
      const main = page.locator('main[dir="rtl"]');
      await main.locator('#forgot-email').fill('student@example.com');
      await main.getByRole('button', { name: 'إرسال التعليمات' }).click();
      await expect(main.getByText('الخدمة غير متاحة الآن', { exact: true })).toBeVisible();
      await expect(main.locator('#forgot-email')).toHaveValue('student@example.com');
      await page.screenshot({ path: test.info().outputPath('recovery-retry-503.png'), fullPage: true });
      await main.getByRole('button', { name: 'إرسال التعليمات' }).click();
      await expect(main.getByText(originalConfirmation, { exact: true })).toBeVisible();
      await expect(main.getByText('الخدمة غير متاحة الآن')).toHaveCount(0);
      expect(calls).toBe(2);
    });
  });
}
