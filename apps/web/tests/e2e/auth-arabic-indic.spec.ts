import { expect, test } from '@playwright/test';

for (const viewport of [
  { name: 'mobile', width: 390, height: 844 },
  { name: 'tablet', width: 768, height: 1024 },
  { name: 'desktop', width: 1366, height: 768 },
]) {
  test(`Arabic-Indic national ID hint renders on ${viewport.name} RTL`, async ({ page }) => {
    await page.route('**/api/v1/auth/me', (route) =>
      route.fulfill({ status: 401, contentType: 'application/json', body: '{}' }),
    );
    await page.setViewportSize({ width: viewport.width, height: viewport.height });
    await page.goto('/login');
    await expect(page.locator('html')).toHaveAttribute('dir', 'rtl');
    await page.locator('#smart-login-input').fill('١٢٣٤٥٦٧٨٩٠');
    await expect(page.getByText('✓ رقم هوية وطنية معتمد (10 أرقام تبدأ بـ 1 أو 2)')).toBeVisible();
    await page.screenshot({
      path: `test-results/auth-arabic-indic-${viewport.name}.png`,
      fullPage: true,
    });
  });
}
