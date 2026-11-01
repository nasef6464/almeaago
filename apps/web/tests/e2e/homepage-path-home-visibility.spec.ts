import { expect, test } from '@playwright/test';

// Legacy Landing.tsx filters showInHome before applying featured IDs. A list
// containing only hidden/stale IDs falls back to the remaining homepage paths.
const paths = [
  { id: 'hidden-home', code: 'HIDDEN', name: 'مسار مخفي من الرئيسية', description: '', sortOrder: 1, showInHome: false, showInNavbar: true },
  { id: 'shown-home', code: 'SHOWN', name: 'مسار ظاهر صراحة', description: '', sortOrder: 3, showInHome: true, showInNavbar: true },
  { id: 'default-home', code: 'DEFAULT', name: 'مسار بظهور افتراضي', description: '', sortOrder: 2, showInNavbar: true },
];

for (const width of [390, 820, 1440]) {
  test(`homepage hides explicit false before featured selection and retains omitted default at ${width}px`, async ({ page }) => {
    test.setTimeout(90_000); // Three independent homepage loads and evidence captures.
    await page.setViewportSize({ width, height: 1000 });
    let featuredPathIds: string[] = [];
    await page.route(url => url.origin !== 'http://127.0.0.1:4173', route => route.abort('blockedbyclient'));
    await page.route(url => url.pathname.startsWith('/api/'), route => {
      const path = new URL(route.request().url()).pathname;
      if (path === '/api/v1/auth/me') return route.fulfill({ status: 401, json: { message: 'Guest fixture' } });
      if (path === '/api/v1/taxonomy/bootstrap') return route.fulfill({ json: { paths, levels: [], subjects: [], skills: [] } });
      if (path === '/api/v1/content/homepage-settings') return route.fulfill({ json: { featuredPathIds, hero: { autoRotateImages: false } } });
      if (path === '/api/v1/content/platform-font-settings') return route.fulfill({ json: {} });
      if (route.request().method() !== 'GET') return route.fulfill({ status: 403, json: { message: 'No writes expected' } });
      return route.fulfill({ json: { items: [], ads: [], announcements: [], unreadCount: 0, hasMore: false } });
    });
    for (const scenario of [
      { featured: [] as string[], names: ['مسار بظهور افتراضي', 'مسار ظاهر صراحة'] },
      { featured: ['hidden-home', 'shown-home'], names: ['مسار ظاهر صراحة'] },
      { featured: ['hidden-home', 'stale-id'], names: ['مسار بظهور افتراضي', 'مسار ظاهر صراحة'] },
    ]) {
      featuredPathIds = scenario.featured;
      await page.goto('/');
      const cards = page.locator('#paths');
      await expect(cards.getByRole('heading', { name: 'كل ما تحتاجه للتفوق', exact: true })).toBeVisible();
      await expect(cards.getByRole('heading', { name: 'مسار مخفي من الرئيسية', exact: true })).toHaveCount(0);
      await expect(cards.getByRole('heading', { level: 3 })).toHaveText(scenario.names);
      await expect(cards.getByRole('link')).toHaveCount(scenario.names.length);
      await page.screenshot({ path: test.info().outputPath(`homepage-paths-${width}-${scenario.featured.join('-') || 'default'}.png`), fullPage: true });
    }
  });
}
