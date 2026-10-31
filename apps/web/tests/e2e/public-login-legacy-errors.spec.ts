import { expect, test } from '@playwright/test';

// Read-only source oracle: almeaacodax@bf7281f components/Header.tsx
// handleSmartLogin catch (Too many login attempts / authentication attempts / invalid credentials).
// HTTP is mocked only at the transport boundary: the real visitor modal, auth
// provider, retry state and navigation are exercised in the browser.
const scenarios = [
  {
    name: 'account lockout',
    backend: 'Too many login attempts',
    visitor: 'توقف الدخول مؤقتًا لحماية حسابك. انتظر 15 دقيقة، أو اضغط «نسيت كلمة المرور» لاستعادة الدخول.',
  },
  {
    name: 'network throttle',
    backend: 'Too many authentication attempts',
    visitor: 'محاولات دخول كثيرة من هذه الشبكة. انتظر قليلًا، أو استخدم «نسيت كلمة المرور» إذا نسيتها.',
  },
  {
    name: 'invalid credentials',
    backend: 'Invalid credentials',
    visitor: 'بيانات الدخول غير صحيحة. راجعها، وإذا نسيت كلمة المرور اضغط «نسيت كلمة المرور» بدل تكرار المحاولات.',
  },
  {
    name: 'unclassified failure',
    backend: 'تعذر الاتصال بالخادم',
    visitor: 'تعذر الاتصال بالخادم',
  },
] as const;

for (const width of [390, 820, 1440]) {
  for (const scenario of scenarios) {
    test(`public login ${scenario.name} source error and retry at ${width}px RTL`, async ({ page }) => {
      await page.setViewportSize({ width, height: 1000 });
      await page.route('**/api/v1/auth/me', route =>
        route.fulfill({ status: 401, json: { error: { message: 'unauthenticated' } } }));
      let calls = 0;
      await page.route('**/api/v1/auth/login', route => {
        calls += 1;
        if (calls === 1) {
          return route.fulfill({
            status: scenario.name === 'account lockout' || scenario.name === 'network throttle' ? 429 : 401,
            json: { error: { message: scenario.backend } },
          });
        }
        return route.fulfill({
          status: 200,
          json: {
            user: {
              id: 'source-parity-student', name: 'طالب', email: 'student@example.com',
              role: 'student', roles: ['student'], status: 'active', emailVerified: true,
            },
            csrfToken: 'fixture-csrf',
          },
        });
      });

      await page.goto('/login');
      const modal = page.getByRole('dialog');
      await expect(modal).toBeVisible();
      await expect(page.locator('html')).toHaveAttribute('dir', 'rtl');
      await page.locator('#smart-login-input').fill('student@example.com');
      await page.locator('#smart-login-password').fill('Password1');
      await page.locator('#smart-login-submit').click();
      await expect(page.locator('#login-error-banner')).toHaveText('⚠️' + scenario.visitor);
      await expect(page.locator('#smart-login-input')).toHaveValue('student@example.com');
      await expect(page.locator('#smart-login-password')).toHaveValue('Password1');
      await expect(page.locator('#smart-login-submit')).toBeEnabled();
      await expect(page.getByRole('link', { name: 'نسيت كلمة المرور؟' })).toHaveAttribute('href', '/forgot-password');
      await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
      await page.screenshot({ path: `test-results/public-login-error-${scenario.name.replaceAll(' ', '-')}-${width}.png`, animations: 'disabled' });
      await page.locator('#smart-login-submit').click();
      await expect(page).toHaveURL(/\/dashboard$/);
      expect(calls).toBe(2);
    });
  }
}
