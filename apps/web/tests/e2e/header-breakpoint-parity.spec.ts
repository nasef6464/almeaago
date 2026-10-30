import { expect, test, type Page, type Route } from '@playwright/test';

function json(route: Route, body: unknown, status = 200) {
  return route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) });
}

async function prepareGuest(page: Page) {
  await page.route('**/api/v1/auth/me', (route) => json(route, { error: { message: 'unauthenticated' } }, 401));
  await page.route('**/api/v1/taxonomy/bootstrap?phase=core', (route) => json(route, {
    paths: [{ id: 'path-q', code: 'Q', name: 'قدرات', sortOrder: 1, isActive: true, showInNavbar: true }],
    levels: [],
    subjects: [],
  }));
  await page.route('**/api/v1/content/homepage-settings', (route) => json(route, {}));
}

test('public header keeps the original md breakpoint and mobile menu behavior', async ({ page }) => {
  await prepareGuest(page);

  for (const width of [390, 820, 1440]) {
    await page.setViewportSize({ width, height: 1000 });
    await page.goto('/');

    const header = page.locator('header').first();
    const desktopNavigation = page.getByRole('navigation', { name: 'التنقل الرئيسي', exact: true });
    const mobileToggle = page.getByRole('button', { name: 'فتح القائمة', exact: true });
    const mobileNavigation = page.getByRole('navigation', { name: 'التنقل الرئيسي للجوال', exact: true });

    if (width < 768) {
      await expect(desktopNavigation).toBeHidden();
      await expect(mobileToggle).toBeVisible();
      await mobileToggle.click();
      await expect(mobileNavigation).toBeVisible();
      await expect(mobileNavigation.getByRole('link', { name: 'قدرات', exact: true })).toBeVisible();
      await expect(desktopNavigation).toBeHidden();
    } else {
      await expect(desktopNavigation).toBeVisible();
      await expect(desktopNavigation.getByRole('link', { name: 'قدرات', exact: true })).toBeVisible();
      await expect(mobileToggle).toBeHidden();
      await expect(mobileNavigation).toHaveCount(0);
    }

    await expect.poll(() => header.evaluate((element) => element.scrollWidth <= element.clientWidth)).toBe(true);
    await header.screenshot({ path: `test-results/header-breakpoint-${width}.png` });
  }
});
