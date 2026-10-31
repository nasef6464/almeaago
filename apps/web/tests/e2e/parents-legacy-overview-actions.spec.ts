import { expect, test } from '@playwright/test';

const parent = {
  id: 'parent-overview', email: 'parent@example.com', name: 'ولي أمر',
  status: 'active', avatarUrl: '', emailVerified: true,
  role: 'parent', roles: ['parent'],
};

for (const width of [390, 820, 1440]) {
  test(`parent overview keeps the original report action without invented quick navigation at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await page.route('**/api/v1/auth/me', route => route.fulfill({
      status: 200, contentType: 'application/json', body: JSON.stringify({ user: parent }),
    }));
    await page.route('**/api/v1/parents/dashboard?**', route => route.fulfill({
      status: 200, contentType: 'application/json',
      body: JSON.stringify({
        children: [], summary: {
          totalChildren: 0, visibleChildren: 0,
          weeklyAssessmentCount: 0, weeklyAverageScore: 0, weakSkills: 0,
        }, page: 1, limit: 20, hasMore: false,
      }),
    }));
    await page.route('**/api/v1/parents/weekly-report?**', route => route.fulfill({
      status: 200, contentType: 'application/json',
      body: JSON.stringify({
        periodStart: '2026-10-20T00:00:00Z',
        periodEnd: '2026-10-27T00:00:00Z',
        children: [], page: 1, limit: 20, hasMore: false,
      }),
    }));

    await page.goto('/parent-dashboard');
    const hero = page.locator('main[data-testid="parent-workspace"] > div > header');
    await expect(hero.getByRole('heading', { name: 'متابعة الأبناء ببساطة' })).toBeVisible();
    await expect(hero.getByText('درجة، مهارة تحتاج متابعة، وخطوة واحدة واضحة.', { exact: true })).toBeVisible();
    await expect(hero.getByRole('button', { name: 'تحديث لوحة ولي الأمر' })).toBeVisible();
    await expect(hero.getByRole('button', { name: 'التقرير', exact: true })).toBeVisible();
    await expect(page.getByRole('region', { name: 'وصول سريع لولي الأمر' })).toHaveCount(0);
    await expect(page.getByRole('link', { name: 'الإشعارات والملخصات' })).toHaveCount(0);
    await expect(page.getByRole('link', { name: 'الملف الشخصي' })).toHaveCount(0);
    await hero.getByRole('button', { name: 'التقرير', exact: true }).click();
    await expect(page.getByRole('button', { name: 'تقرير الأسبوع' })).toHaveClass(/bg-emerald-600/);
    await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await page.screenshot({ path: `test-results/parent-legacy-overview-actions-${width}.png`, fullPage: true });
  });
}
