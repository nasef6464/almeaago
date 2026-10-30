import { expect, test, type Page, type Route } from '@playwright/test';

// Source oracle: almeaacodax/main services/api.ts request() preserves plain-text
// failures and JSON error strings instead of replacing them with a generic error.
const originalRecoveryConfirmation =
  'إذا كان البريد مسجلًا، ستصلك تعليمات الاستعادة. تحقق من البريد الوارد والرسائل غير المرغوب فيها.';

function json(route: Route, status: number, body: unknown) {
  return route.fulfill({
    status,
    contentType: 'application/json',
    body: JSON.stringify(body),
  });
}

async function guest(page: Page) {
  await page.route('**/api/v1/auth/me', (route) =>
    json(route, 401, { error: { message: 'unauthenticated' } }),
  );
}

for (const width of [390, 820, 1440]) {
  test.describe(`public auth error contract at ${width}px RTL`, () => {
    test.beforeEach(async ({ page }) => {
      await page.setViewportSize({ width, height: 900 });
      await guest(page);
    });

    test('recovery preserves original plain-text 503 and retries without losing email', async ({ page }) => {
      let calls = 0;
      await page.route('**/api/v1/auth/forgot-password', (route) => {
        calls += 1;
        if (calls === 1) {
          return route.fulfill({
            status: 503,
            contentType: 'text/plain; charset=utf-8',
            body: 'خدمة الاستعادة غير متاحة مؤقتًا',
          });
        }
        return json(route, 200, { message: originalRecoveryConfirmation });
      });

      await page.goto('/forgot-password');
      const main = page.locator('main[dir="rtl"]');
      await main.locator('#forgot-email').fill('student@example.com');
      await main.getByRole('button', { name: 'إرسال التعليمات' }).click();
      await expect(main.getByText('خدمة الاستعادة غير متاحة مؤقتًا', { exact: true })).toBeVisible();
      await expect(main.locator('#forgot-email')).toHaveValue('student@example.com');
      await page.screenshot({ path: test.info().outputPath('recovery-503.png'), fullPage: true });

      await main.getByRole('button', { name: 'إرسال التعليمات' }).click();
      await expect(main.getByText(originalRecoveryConfirmation, { exact: true })).toBeVisible();
      await expect(main.getByText('خدمة الاستعادة غير متاحة مؤقتًا')).toHaveCount(0);
      expect(calls).toBe(2);
    });

    test('reset preserves JSON string error and token/password for retry', async ({ page }) => {
      let calls = 0;
      const requests: unknown[] = [];
      await page.route('**/api/v1/auth/reset-password', (route) => {
        calls += 1;
        requests.push(route.request().postDataJSON());
        if (calls === 1) {
          return json(route, 503, { error: 'تعذر تحديث كلمة المرور مؤقتًا' });
        }
        return json(route, 200, { message: 'تم تحديث كلمة المرور. يمكنك تسجيل الدخول الآن.' });
      });

      await page.goto('/reset-password?token=token-123');
      const main = page.locator('main[dir="rtl"]');
      const inputs = main.locator('input');
      await expect(inputs.nth(0)).toHaveValue('token-123');
      await inputs.nth(1).fill('NewPassword1');
      await main.getByRole('button', { name: 'حفظ كلمة المرور' }).click();
      await expect(main.getByText('تعذر تحديث كلمة المرور مؤقتًا', { exact: true })).toBeVisible();
      await expect(inputs.nth(0)).toHaveValue('token-123');
      await expect(inputs.nth(1)).toHaveValue('NewPassword1');
      await page.screenshot({ path: test.info().outputPath('reset-503.png'), fullPage: true });

      await main.getByRole('button', { name: 'حفظ كلمة المرور' }).click();
      await expect(main.getByText('تم تحديث كلمة المرور. يمكنك تسجيل الدخول الآن.')).toBeVisible();
      await expect(inputs.nth(1)).toHaveValue('');
      expect(requests).toEqual([
        { token: 'token-123', password: 'NewPassword1' },
        { token: 'token-123', password: 'NewPassword1' },
      ]);
    });

    test('verification keeps manual token on plain-text 503 and retries successfully', async ({ page }) => {
      let calls = 0;
      await page.route('**/api/v1/auth/email/verify', (route) => {
        calls += 1;
        if (calls === 1) {
          return route.fulfill({
            status: 503,
            contentType: 'text/plain; charset=utf-8',
            body: 'تعذر تأكيد البريد مؤقتًا',
          });
        }
        return json(route, 200, { message: 'تم تأكيد البريد بنجاح.', user: { id: 'test' } });
      });

      await page.goto('/verify-email');
      const main = page.locator('main[dir="rtl"]');
      await main.locator('input').fill('verify-123');
      await main.getByRole('button', { name: 'تأكيد البريد' }).click();
      await expect(main.getByText('تعذر تأكيد البريد مؤقتًا', { exact: true })).toBeVisible();
      await expect(main.locator('input')).toHaveValue('verify-123');
      await page.screenshot({ path: test.info().outputPath('verify-503.png'), fullPage: true });

      await main.getByRole('button', { name: 'تأكيد البريد' }).click();
      await expect(main.getByText('تم تأكيد البريد بنجاح.')).toBeVisible();
      await expect(main.getByText('تعذر تأكيد البريد مؤقتًا')).toHaveCount(0);
      expect(calls).toBe(2);
    });
  });
}
