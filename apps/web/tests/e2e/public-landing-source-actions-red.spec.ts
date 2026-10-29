import { expect, test, type Page } from '@playwright/test';

/**
 * RED acceptance: source of truth is almeaacodax/main@bf7281fc.
 * pages/Landing.tsx uses /category/:id for OrganicCard, /courses for the
 * secondary and empty tertiary CTA, and renders no invented path cards.
 *
 * These tests deliberately do NOT rewrite the implementation owned by #166.
 * Do not weaken the assertions to make the Go layout pass.
 */
async function openPublicHome(page: Page, options: {
  paths?: Array<Record<string, unknown>>;
  hero?: Record<string, unknown>;
} = {}) {
  await page.route('**/api/v1/auth/me', route => route.fulfill({ json: { user: null } }));
  await page.route('**/api/v1/taxonomy/bootstrap?*', route => route.fulfill({
    json: { paths: options.paths ?? [], subjects: [] },
  }));
  await page.route('**/api/v1/content/homepage-settings', route => route.fulfill({
    json: { key: 'default', hero: options.hero ?? {}, featuredPathIds: [], featuredCourseIds: [] },
  }));
  await page.route('**/api/v1/courses?*', route => route.fulfill({ json: { items: [], hasMore: false } }));
  await page.route('**/api/v1/lessons?*', route => route.fulfill({ json: { items: [], hasMore: false } }));
  await page.goto('/');
  await expect(page.getByTestId('public-landing')).toBeVisible();
}

for (const width of [390, 820, 1440]) {
  test(`source secondary and tertiary hero actions at ${width}px RTL`, async ({ page }) => {
    await page.setViewportSize({ width, height: 1000 });
    await openPublicHome(page, { hero: { tertiaryCtaLabel: 'دوراتنا', tertiaryCtaLink: '' } });
    await expect(page.getByTestId('public-landing')).toHaveAttribute('dir', 'rtl');
    await page.screenshot({ path: `test-results/public-hero-source-contract-red-${width}.png`, animations: 'disabled' });
    // Legacy default: 'تصفح الدورات' -> /courses, never an invented learning label.
    await expect(page.getByRole('link', { name: 'تصفح الدورات', exact: true })).toHaveAttribute('href', '/courses');
    // Legacy empty tertiary target also falls back to /courses.
    await expect(page.getByRole('link', { name: 'دوراتنا', exact: true })).toHaveAttribute('href', '/courses');
  });

  test(`source path card opens its original category route at ${width}px RTL`, async ({ page }) => {
    await page.setViewportSize({ width, height: 1000 });
    await openPublicHome(page, { paths: [{
      id: 'p_qudrat', code: 'QUDRAT', name: 'القدرات العامة',
      description: 'قدرات كمي ولفظي', sortOrder: 1,
    }] });
    const card = page.locator('#paths').getByRole('link', { name: /القدرات العامة/ });
    await expect(card).toBeVisible();
    await page.screenshot({ path: `test-results/public-path-source-contract-red-${width}.png`, animations: 'disabled' });
    await expect(card).toHaveAttribute('href', '/category/p_qudrat');
    await card.click();
    await expect(page).toHaveURL(/\\/category\\/p_qudrat(?:[?#]|$)/);
  });

  test(`empty source taxonomy does not invent path cards at ${width}px RTL`, async ({ page }) => {
    await page.setViewportSize({ width, height: 1000 });
    await openPublicHome(page);
    const section = page.locator('#paths');
    await expect(section).toBeVisible();
    await page.screenshot({ path: `test-results/public-empty-paths-source-contract-red-${width}.png`, animations: 'disabled' });
    // Legacy maps an empty displayedHomepagePaths array to an empty grid.
    // Go must not show fake Qudrat/Tahsili/Mock cards or a loading placeholder
    // after the taxonomy endpoint has returned an empty successful response.
    await expect(section.getByText('يتم تحميل التصنيف من المصدر الخادمي.')).toHaveCount(0);
  });
}
