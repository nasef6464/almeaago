import { expect, test } from '@playwright/test';

// Source: almeaacodax/pages/Landing.tsx @ bf7281fc9fe34165a070e3d2d58f65f91b4a3ef7.
// Only existing Go routes are asserted here. /pricing and /mock-exams
// require their separately owned public-route implementation.
for (const width of [390, 820, 1440]) {
  test(`public showcase restores original navigable destinations at ${width}px RTL`, async ({ page }) => {
    await page.setViewportSize({ width, height: 1000 });
    await page.route('**/api/v1/auth/me', (route) =>
      route.fulfill({ status: 401, contentType: 'application/json', body: '{}' }),
    );
    await page.route('**/api/v1/taxonomy/bootstrap?phase=core', (route) =>
      route.fulfill({ json: { paths: [], subjects: [] } }),
    );
    await page.route('**/api/v1/content/homepage-settings', (route) =>
      route.fulfill({ json: { hero: {}, sections: {}, featuredPathIds: [] } }),
    );

    await page.goto('/');
    await expect(page.getByTestId('public-landing')).toBeVisible();
    await expect(page.getByRole('link', { name: 'ابدأ جلستك التدريبية', exact: true }))
      .toHaveAttribute('href', '/dashboard');
    await expect(page.getByRole('link', { name: 'ابدأ تدريب القدرات', exact: true }))
      .toHaveAttribute('href', '/category/p_qudrat');
    await expect(page.getByRole('link', { name: 'استكشف التحصيلي', exact: true }))
      .toHaveAttribute('href', '/category/p_tahsili');

    await page.getByRole('button', { name: /النمط السيبراني الليلي/ }).click();
    await expect(page.getByRole('heading', { name: 'بطل القدرات العامة' })).toBeVisible();
    await expect(page.getByRole('link', { name: 'ابدأ تدريب القدرات', exact: true }))
      .toHaveAttribute('href', '/category/p_qudrat');
    await expect(page.getByRole('link', { name: 'استكشف التحصيلي', exact: true }))
      .toHaveAttribute('href', '/category/p_tahsili');

    await page.getByRole('link', { name: 'ابدأ تدريب القدرات', exact: true }).click();
    await expect(page).toHaveURL(/\/category\/p_qudrat$/);
    await expect(page.getByText('سجّل الدخول لفتح مساحة التعلم.')).toBeVisible();
    await page.reload();
    await expect(page).toHaveURL(/\/category\/p_qudrat$/);
    await expect(page.getByText('سجّل الدخول لفتح مساحة التعلم.')).toBeVisible();
    await page.goBack();
    await expect(page).toHaveURL(/\/$/);
    await expect(page.getByTestId('public-landing')).toBeVisible();
    await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= innerWidth))
      .toBe(true);
    await page.screenshot({ path: `test-results/public-showcase-routes-${width}.png`, fullPage: true });
  });
}
