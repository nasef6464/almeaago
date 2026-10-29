import { expect, test, type Route } from '@playwright/test';

/**
 * RED contract: exact original SkillsTreeManager presentation, not a new dashboard.
 * Source: almeaacodax@bf7281fc9fe34165a070e3d2d58f65f91b4a3ef7
 * dashboards/admin/SkillsTreeManager.tsx lines 473-500 and 515-540, 608-616.
 * Target base: almeaago PR #160 @9a8e0692da0d8b579c8c91334b47c8768dd42e30.
 * The source's delete actions are presence-only here; no destructive writes.
 */
const admin = {
  id: 'admin-skills-parity', email: 'admin@example.com', name: 'مدير المنصة',
  role: 'admin', roles: ['admin'], status: 'active', emailVerified: true,
};
const taxonomy = {
  paths: [{ id: 'p1', code: 'QDR', name: 'القدرات', sortOrder: 0, status: 'active', description: '' }],
  levels: [],
  subjects: [{ id: 's1', pathId: 'p1', code: 'MATH', name: 'الكمي', sortOrder: 0, status: 'active' }],
  skills: [
    { id: 'm1', subjectId: 's1', code: 'ALG', name: 'الجبر', kind: 'main', sortOrder: 0, status: 'active', description: '' },
    { id: 'sub1', subjectId: 's1', parentSkillId: 'm1', code: 'LIN', name: 'المعادلات', kind: 'sub', sortOrder: 1, status: 'active', description: '' },
  ],
};
function json(route: Route, body: unknown) {
  return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(body) });
}
async function openSkills(page: import('@playwright/test').Page, width: number) {
  await page.setViewportSize({ width, height: 900 });
  await page.route('**/api/v1/auth/me', (route) => json(route, { user: admin }));
  await page.route('**/api/v1/auth/csrf', (route) => json(route, { csrfToken: 'parity-csrf' }));
  await page.route('**/api/v1/taxonomy/admin/bootstrap', (route) => json(route, taxonomy));
  await page.goto('/admin-dashboard?tab=skills');
  const center = page.getByTestId('admin-skills-center');
  await expect(center).toBeVisible();
  await expect(center).toHaveAttribute('dir', 'rtl');
  await expect(page.getByTestId('skills-counter-main')).toContainText('1');
  await expect(page.getByTestId('skills-counter-sub')).toContainText('1');
  return center;
}

for (const width of [390, 820, 1440]) {
  test(`Legacy Skills Center has all SIX original summary counters at ${width}px RTL`, async ({ page }) => {
    const center = await openSkills(page, width);
    const counters = center.getByRole('region', { name: 'إحصاءات المهارات' });
    await expect(counters).toBeVisible();
    // Legacy shows six original counters; Go PR #160 currently shows only two.
    for (const label of ['الدروس المرتبطة', 'الأسئلة المرتبطة', 'الاختبارات المرتبطة', 'ملفات المراجعة']) {
      await expect.soft(counters.getByText(label, { exact: true }), `Original summary counter missing: ${label}`).toBeVisible();
    }
    await expect.soft(counters.locator(':scope > div'), 'Legacy has exactly six counters').toHaveCount(6);
  });

  test(`Legacy main-skill row retains the scoped question count at ${width}px RTL`, async ({ page }) => {
    await openSkills(page, width);
    const main = page.getByRole('button', { name: 'فتح المهارة الرئيسة الجبر' });
    await expect(main).toBeVisible();
    // Legacy shows: N مهارات فرعية · Q سؤال · المادة · المسار.
    // When coverage is unavailable Legacy renders an em dash, never silently drops "سؤال".
    await expect(main).toContainText(/مهارات فرعية\s*·\s*(?:\d+|—)\s*سؤال\s*·\s*الكمي\s*·\s*القدرات/);
  });

  test(`Legacy main and subskill delete controls remain discoverable at ${width}px RTL`, async ({ page }) => {
    await openSkills(page, width);
    await expect.soft(page.getByRole('button', { name: 'حذف المهارة الرئيسة الجبر' })).toBeVisible();
    await page.getByRole('button', { name: 'فتح المهارة الرئيسة الجبر' }).click();
    await expect(page.getByRole('button', { name: 'فتح المهارة الفرعية المعادلات' })).toBeVisible();
    await expect.soft(page.getByRole('button', { name: 'حذف المهارة الفرعية المعادلات' })).toBeVisible();
    // Do NOT click delete: source deletion semantics and server authorization require
    // a separately reviewed safety contract before any mutation is implemented.
  });
}
