import { expect, test } from './fixtures/header-test';

for (const width of [390, 820, 1440]) {
  test(`unknown public route restores the original 404 and both destinations at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 1000 });
    await page.route('**/api/v1/auth/me', route => route.fulfill({ status: 401, contentType: 'application/json', body: '{}' }));
    await page.route('**/api/v1/taxonomy/bootstrap?phase=core', route => route.fulfill({
      contentType: 'application/json',
      body: JSON.stringify({ paths: [], levels: [], subjects: [] }),
    }));

    await page.goto('/definitely-missing');
    const code = page.getByText('404', { exact: true });
    const surface = code.locator('xpath=..');
    await expect(surface).toHaveClass(/min-h-\[60vh\]/);
    await expect(surface).toHaveClass(/flex-col/);
    await expect(page.getByRole('heading', { name: 'الصفحة غير موجودة', exact: true })).toBeVisible();
    await expect(page.getByText('عذراً، الصفحة التي تبحث عنها غير موجودة أو تم نقلها.', { exact: true })).toBeVisible();

    const actions = surface.getByRole('link');
    await expect(actions).toHaveCount(2);
    await expect(actions.nth(0)).toHaveText('العودة للرئيسية');
    await expect(actions.nth(0)).toHaveAttribute('href', '/');
    await expect(actions.nth(1)).toHaveText('لوحة التحكم');
    await expect(actions.nth(1)).toHaveAttribute('href', '/dashboard');
    await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await page.screenshot({ path: `test-results/original-not-found-${width}.png`, fullPage: true });

    await actions.nth(0).click();
    await expect(page).toHaveURL(/\/$/);
    await page.goBack();
    await expect(page).toHaveURL(/\/definitely-missing$/);
    await expect(page.getByText('عذراً، الصفحة التي تبحث عنها غير موجودة أو تم نقلها.', { exact: true })).toBeVisible();
    await page.reload();
    await expect(page.getByRole('heading', { name: 'الصفحة غير موجودة', exact: true })).toBeVisible();
    await page.getByRole('link', { name: 'لوحة التحكم', exact: true }).click();
    await expect(page).toHaveURL(/\/dashboard$/);
    await expect(page.getByText('عذراً، الصفحة التي تبحث عنها غير موجودة أو تم نقلها.', { exact: true })).toHaveCount(0);
  });
}
