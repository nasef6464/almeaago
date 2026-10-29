import { expect, test } from '@playwright/test';

// Source: almeaacodax/app/AppRouteTree.tsx wraps all these routes in MainLayout;
// almeaacodax/components/MainLayout.tsx renders the shared five-link footer.
const legacyFooterRoutes = [
  '/verify-email',
  '/checkout',
  '/category/public-path-fixture',
  '/course/public-course-fixture',
];

for (const width of [390, 820, 1440]) {
  test(`public layout footer survives route entry, reload and return at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await page.route('**/api/v1/auth/me', route => route.fulfill({
      status: 401,
      contentType: 'application/json',
      body: '{}',
    }));

    for (const route of legacyFooterRoutes) {
      await page.goto(route);
      const footer = page.getByRole('contentinfo');
      await expect(footer).toHaveCount(1);
      await expect(footer.getByRole('link')).toHaveCount(5);
      await expect(footer.getByRole('link', { name: 'من نحن', exact: true })).toHaveAttribute('href', '/about');

      await page.reload();
      await expect(page.getByRole('contentinfo')).toHaveCount(1);

      await footer.getByRole('link', { name: 'من نحن', exact: true }).click();
      await expect(page).toHaveURL(/\/about$/);
      await page.goBack();
      await expect(page).toHaveURL(new RegExp(`${route.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`));
      await expect(page.getByRole('contentinfo')).toHaveCount(1);
      await page.getByRole('contentinfo').screenshot({
        path: `test-results/public-layout-footer-${width}-${route.slice(1).replace(/\//g, '-')}.png`,
      });
    }
  });
}
