import { expect, test, type Page, type Route } from '@playwright/test';

// Legacy source: dashboards/admin/PathsManager.tsx, path workspace -> levels tab.
// The original stage action opens a modal with name/icon/cancel/add, not an
// invented inline code/name grid. This acceptance file never edits owner #160 UI.
const admin = {
  id: 'admin-legacy-stage', email: 'admin@example.test', name: 'مدير المنصة',
  status: 'active', avatarUrl: '', emailVerified: true,
  role: 'admin', roles: ['admin'],
};
function respond(route: Route, body: unknown, status = 200) {
  return route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) });
}
function seed() {
  return {
    paths: [{ id: 'path-1', code: 'QDR', name: 'القدرات', parentPathId: '', description: '', sortOrder: 1, status: 'active' }],
    levels: [{ id: 'level-1', pathId: 'path-1', code: 'L1', name: 'الأول', sortOrder: 1, status: 'active' }],
    subjects: [{ id: 'subject-1', pathId: 'path-1', levelId: 'level-1', code: 'QNT', name: 'الكمي', sortOrder: 1, status: 'active' }],
    skills: [],
  };
}
async function setup(page: Page, data: ReturnType<typeof seed>) {
  await page.route('**/api/v1/auth/me', route => respond(route, { user: admin }));
  await page.route('**/api/v1/auth/csrf', route => respond(route, { csrfToken: 'csrf-stage-modal' }));
  await page.route('**/api/v1/taxonomy/admin/bootstrap', route => respond(route, data));
  await page.goto('/admin-dashboard/taxonomy');
  await expect(page.getByTestId('taxonomy-admin-page')).toBeVisible();
}
async function openOriginalStageModal(page: Page) {
  await page.getByRole('button', { name: 'إضافة مرحلة دراسية' }).click();
  await expect(page.getByRole('heading', { name: 'إضافة مرحلة دراسية' })).toBeVisible();
  await expect(page.getByText('اسم المرحلة', { exact: true })).toBeVisible();
  await expect(page.getByText('أيقونة المرحلة الدراسية')).toBeVisible();
}

for (const width of [390, 820, 1440]) {
  test(`original stage action is in path workspace without invented inline code form — RTL ${width}`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await setup(page, seed());
    // Source PathsManager.tsx: levels tab shows the exact action label.
    await expect(page.getByRole('button', { name: 'إضافة مرحلة دراسية' })).toBeVisible();
    // These Go-only controls are not in the original path workspace.
    await expect(page.getByLabel('كود المرحلة الجديدة')).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'إنشاء المرحلة' })).toHaveCount(0);
  });

  test(`original stage modal has name, icon, cancel and add actions — RTL ${width}`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await setup(page, seed());
    await openOriginalStageModal(page);
    await expect(page.getByRole('button', { name: 'إلغاء' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'إضافة', exact: true })).toBeVisible();
    await page.getByRole('button', { name: 'إلغاء' }).click();
    await expect(page.getByRole('heading', { name: 'إضافة مرحلة دراسية' })).toHaveCount(0);
  });

  test(`original stage modal retains name/icon on failed save, retries and reloads — RTL ${width}`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    const data = seed();
    await setup(page, data);
    let writes = 0;
    await page.route('**/api/v1/taxonomy/admin/levels', route => {
      writes++;
      if (writes === 1) return respond(route, { message: 'تعذر حفظ المرحلة' }, 503);
      const body = route.request().postDataJSON() as { pathId: string; code: string; name: string; sortOrder: number };
      data.levels.push({ id: 'level-new', pathId: body.pathId, code: body.code, name: body.name, sortOrder: body.sortOrder, status: 'active' });
      return respond(route, { level: { id: 'level-new' } }, 201);
    });
    await openOriginalStageModal(page);
    const input = page.getByRole('textbox', { name: 'اسم المرحلة' });
    await input.fill('الثاني');
    await page.getByRole('button', { name: 'إضافة', exact: true }).click();
    await expect(page.getByText('تعذر حفظ المرحلة')).toBeVisible();
    await expect(page.getByRole('heading', { name: 'إضافة مرحلة دراسية' })).toBeVisible();
    await expect(input).toHaveValue('الثاني');
    expect(writes).toBe(1);
    expect(data.levels).toHaveLength(1);
    await page.getByRole('button', { name: 'إضافة', exact: true }).click();
    await expect(page.getByRole('heading', { name: 'إضافة مرحلة دراسية' })).toHaveCount(0);
    expect(writes).toBe(2);
    await page.reload();
    await expect(page.getByText('الثاني', { exact: true })).toBeVisible();
  });
}
