import { expect, test, type Page } from '@playwright/test';

/**
 * Source-backed RED acceptance for pages/Landing.tsx at
 * almeaacodax/main@bf7281fc9fe34165a070e3d2d58f65f91b4a3ef7.
 *
 * Legacy homepagePaths excludes showInHome === false and inactive paths for
 * ordinary visitors BEFORE applying featuredPathIds. If every featured ID is
 * hidden, Legacy falls back to all eligible visible paths, not the hidden ID.
 *
 * This file owns only acceptance evidence. The public landing UI belongs to
 * #166; the public taxonomy contract belongs to the taxonomy/header owners.
 * These mocks do NOT prove PostgreSQL visibility enforcement.
 */

const paths = [
  { id: 'public-one', code: 'PUBLIC1', name: 'المسار العام الأول', description: 'ظاهر للزائر', sortOrder: 1, showInHome: true, isActive: true },
  { id: 'hidden-one', code: 'HIDDEN1', name: 'المسار المخفي من الرئيسية', description: 'لا يعرض', sortOrder: 2, showInHome: false, isActive: true },
  { id: 'inactive-one', code: 'INACTIVE1', name: 'المسار غير النشط', description: 'لا يعرض', sortOrder: 3, showInHome: true, isActive: false },
  { id: 'public-two', code: 'PUBLIC2', name: 'المسار العام الثاني', description: 'ظاهر للزائر', sortOrder: 4, showInHome: true, isActive: true },
];

async function openAsGuest(page: Page, featuredPathIds: string[]) {
  await page.route('**/api/v1/auth/me', route =>
    route.fulfill({ status: 401, json: { error: { message: 'unauthenticated' } } }),
  );
  await page.route('**/api/v1/taxonomy/bootstrap?*', route =>
    route.fulfill({ json: { paths, subjects: [], levels: [] } }),
  );
  await page.route('**/api/v1/content/homepage-settings', route =>
    route.fulfill({ json: { key: 'default', hero: {}, sections: {}, featuredPathIds, featuredCourseIds: [] } }),
  );
  await page.goto('/');
  await expect(page.getByTestId('public-landing')).toBeVisible();
  const cards = page.locator('#paths');
  await expect(cards.getByRole('link', { name: /المسار العام الأول/ })).toBeVisible();
  return cards;
}

for (const width of [390, 820, 1440]) {
  test(`visitor homepage excludes hidden/inactive path cards at ${width}px RTL`, async ({ page }) => {
    await page.setViewportSize({ width, height: 1000 });
    const cards = await openAsGuest(page, []);
    await expect(page.getByTestId('public-landing')).toHaveAttribute('dir', 'rtl');
    await page.screenshot({ path: `test-results/homepage-path-visibility-red-${width}.png`, animations: 'disabled', fullPage: true });

    await expect(cards.getByRole('link', { name: /المسار العام الثاني/ })).toBeVisible();
    await expect(cards.getByText('المسار المخفي من الرئيسية')).toHaveCount(0);
    await expect(cards.getByText('المسار غير النشط')).toHaveCount(0);
    await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  });

  test(`hidden featured ID falls back to eligible homepage paths at ${width}px RTL`, async ({ page }) => {
    await page.setViewportSize({ width, height: 1000 });
    const cards = await openAsGuest(page, ['hidden-one']);
    await page.screenshot({ path: `test-results/homepage-hidden-featured-red-${width}.png`, animations: 'disabled', fullPage: true });

    await expect(cards.getByRole('link', { name: /المسار العام الأول/ })).toBeVisible();
    await expect(cards.getByRole('link', { name: /المسار العام الثاني/ })).toBeVisible();
    await expect(cards.getByText('المسار المخفي من الرئيسية')).toHaveCount(0);
    await expect(cards.getByText('المسار غير النشط')).toHaveCount(0);
  });
}
