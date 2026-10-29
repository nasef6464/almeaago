import { expect, test } from '@playwright/test';

// Legacy pages/Landing.tsx sanitizes the saved homepage settings before
// rendering. This test preserves that contract for both HTTP reads and
// same-tab admin-save notifications without changing the original UI.
const savedPrefix = 'هوية عربية محفوظة';
const updatedPrefix = 'هوية عربية محدثة';
const mojibake = (value: string) => Buffer.from(value, 'utf8').toString('latin1');

for (const width of [390, 820, 1440]) {
  test(`public homepage decodes saved Arabic settings at ${width}px RTL and on refresh`, async ({ page }, testInfo) => {
    await page.setViewportSize({ width, height: 1000 });
    await page.route('**/api/v1/auth/me', (route) => route.fulfill({ json: { user: null } }));
    await page.route('**/api/v1/taxonomy/bootstrap?*', (route) =>
      route.fulfill({ json: { paths: [], subjects: [] } }),
    );
    await page.route('**/api/v1/content/homepage-settings', (route) =>
      route.fulfill({ json: { hero: { titlePrefix: mojibake(savedPrefix) } } }),
    );

    await page.goto('/');
    const heading = page.getByRole('heading', { level: 1 });
    await expect(heading).toContainText(savedPrefix);
    await expect(heading).not.toContainText(mojibake(savedPrefix));
    await expect(page.locator('main[data-testid="public-landing"]')).toHaveAttribute('dir', 'rtl');
    await page.screenshot({ path: testInfo.outputPath('saved-arabic-visitor.png'), fullPage: true });

    await page.evaluate(({ eventName, titlePrefix }) => {
      window.dispatchEvent(new CustomEvent(eventName, {
        detail: { hero: { titlePrefix } },
      }));
    }, { eventName: 'homepage-settings-updated', titlePrefix: mojibake(updatedPrefix) });
    await expect(heading).toContainText(updatedPrefix);
    await expect(heading).not.toContainText(mojibake(updatedPrefix));
    await page.screenshot({ path: testInfo.outputPath('updated-arabic-visitor.png'), fullPage: true });

    await page.reload();
    await expect(page.getByRole('heading', { level: 1 })).toContainText(savedPrefix);
    await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  });
}
