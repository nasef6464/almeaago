import { expect, test } from '@playwright/test';

// Source oracle: almeaacodax/main pages/Landing.tsx lines 586-609.
// It accepts galleryImages only when Array.isArray; individual entries must be
// nonempty strings. Go must not crash when persisted/older settings are malformed.
for (const width of [390, 820, 1440]) {
  for (const scenario of [
    { name: 'non-array gallery falls back to original presets', gallery: 'stale-string', fallback: true },
    { name: 'mixed gallery ignores non-string entries', gallery: [null, 42, '', '/images/smart-learning-tablet.webp'], fallback: false },
    { name: 'valid saved gallery preserves source order', gallery: ['/images/smart-learning-tablet.webp'], fallback: false },
  ]) {
    test(`public hero ${scenario.name} at ${width}px RTL`, async ({ page }) => {
      await page.setViewportSize({ width, height: 1000 });
      await page.route('**/api/v1/auth/me', route =>
        route.fulfill({ status: 401, json: { error: { message: 'unauthenticated' } } }));
      await page.route('**/api/v1/taxonomy/bootstrap?phase=core', route =>
        route.fulfill({ json: { paths: [], subjects: [] } }));
      await page.route('**/api/v1/content/homepage-settings', route =>
        route.fulfill({ json: {
          hero: {
            imageUrl: '/images/homepage-hero-boy-platform.webp',
            imageAlt: 'طالب يستخدم منصة المئة',
            galleryImages: scenario.gallery,
            autoRotateImages: false,
          },
        } }));

      const errors: string[] = [];
      page.on('pageerror', error => errors.push(error.message));
      await page.goto('/');
      const landing = page.getByTestId('public-landing');
      await expect(landing).toBeVisible();
      await expect(page.getByRole('heading', { level: 1 })).toContainText('حقق');
      await expect(page.getByRole('button', { name: 'الصورة التالية' })).toBeVisible();
      await expect(page.getByRole('button', { name: 'الصورة 2', exact: true })).toBeVisible();
      if (scenario.fallback) {
        await expect(page.getByRole('button', { name: 'الصورة 3', exact: true })).toBeVisible();
      } else {
        await expect(page.getByRole('button', { name: 'الصورة 3', exact: true })).toHaveCount(0);
      }

      await page.getByRole('button', { name: 'الصورة التالية' }).click();
      await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
      await page.screenshot({
        path: `test-results/public-hero-gallery-${scenario.fallback ? 'fallback' : 'saved'}-${width}.png`,
        animations: 'disabled',
      });
      await page.reload();
      await expect(page.getByRole('button', { name: 'الصورة 2', exact: true })).toBeVisible();
      await page.goto('/about');
      await page.goBack();
      await expect(landing).toBeVisible();
      expect(errors, 'persisted gallery must not crash visitor rendering').toEqual([]);
    });
  }
}
