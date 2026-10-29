import { expect, test } from '@playwright/test';

// Legacy pages/Landing.tsx sanitizes the saved homepage settings before
// rendering. This test preserves that contract for both HTTP reads and
// same-tab admin-save notifications without changing the original UI.
const savedPrefix = 'هوية عربية محفوظة';
const updatedPrefix = 'هوية عربية محدثة';
const partialPrefix = 'عنوان محفوظ بعد تحديث جزئي';
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

    // Admin may publish a partial event while the visitor is mounted. The
    // unrelated hero must survive a brand-only update (including on mobile).
    await page.evaluate(() => {
      window.dispatchEvent(new CustomEvent('homepage-settings-updated', {
        detail: { brand: { logoText: 'هوية الشعار فقط' } },
      }));
    });
    await expect(heading).toContainText(updatedPrefix);

    await page.evaluate((titlePrefix) => {
      window.dispatchEvent(new CustomEvent('homepage-settings-updated', {
        detail: { hero: { titlePrefix }, navigation: { showAutoPaths: false, items: [] } },
      }));
    }, mojibake(partialPrefix));
    await expect(heading).toContainText(partialPrefix);
    await expect(heading).not.toContainText(mojibake(partialPrefix));
    await page.screenshot({ path: testInfo.outputPath('partial-update-arabic-visitor.png'), fullPage: true });

    await page.reload();
    await expect(page.getByRole('heading', { level: 1 })).toContainText(savedPrefix);
    await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  });
}


for (const width of [390, 820, 1440]) {
  test(`public homepage retains saved fields when an admin update precedes a delayed GET at ${width}px RTL`, async ({ page }) => {
    await page.setViewportSize({ width, height: 1000 });
    await page.route('**/api/v1/auth/me', (route) => route.fulfill({ json: { user: null } }));
    await page.route('**/api/v1/taxonomy/bootstrap?*', (route) =>
      route.fulfill({ json: { paths: [], subjects: [] } }),
    );

    let releaseGet: (() => void) | undefined;
    let notifyGet: (() => void) | undefined;
    const heldGet = new Promise<void>((resolve) => { releaseGet = resolve; });
    const getStarted = new Promise<void>((resolve) => { notifyGet = resolve; });
    await page.route('**/api/v1/content/homepage-settings', async (route) => {
      notifyGet?.();
      await heldGet;
      await route.fulfill({
        json: {
          hero: {
            titlePrefix: mojibake('عنوان قديم من الخادم'),
            description: mojibake('وصف محفوظ من الخادم قبل التحديث'),
          },
        },
      });
    });

    await page.goto('/');
    await getStarted;
    await page.evaluate(() => {
      window.dispatchEvent(new CustomEvent('homepage-settings-updated', {
        detail: { hero: { titlePrefix: 'عنوان المدير الأحدث' } },
      }));
    });
    await expect(page.getByRole('heading', { level: 1 })).toContainText('عنوان المدير الأحدث');

    releaseGet?.();
    // The late response is older for titlePrefix, but it still contains
    // unrelated saved description that must not disappear from the visitor UI.
    await expect(page.getByText('وصف محفوظ من الخادم قبل التحديث')).toBeVisible();
    await expect(page.getByRole('heading', { level: 1 })).toContainText('عنوان المدير الأحدث');
    await expect(page.locator('main[data-testid="public-landing"]')).toHaveAttribute('dir', 'rtl');
  });
}
