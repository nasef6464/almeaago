import { expect, test, type Page, type Route } from '@playwright/test';

// Independent HTTP-client contract. The page and independent Skills Center
// remain owned by PR #160; this suite changes neither presentation nor RBAC.
const admin = {
  id: 'admin-taxonomy-error', email: 'admin@example.com', name: 'مدير المنصة',
  status: 'active', avatarUrl: '', emailVerified: true,
  role: 'admin', roles: ['admin'],
};

function fixture() {
  return {
    paths: [{ id: 'path-1', code: 'QDR', name: 'القدرات', parentPathId: '', description: '', sortOrder: 1, status: 'active' }],
    levels: [{ id: 'level-1', pathId: 'path-1', code: 'L1', name: 'الأولى', sortOrder: 1, status: 'active' }],
    subjects: [{ id: 'subject-1', pathId: 'path-1', levelId: 'level-1', code: 'QNT', name: 'الكمي', sortOrder: 1, status: 'active' }],
    skills: [{ id: 'skill-1', subjectId: 'subject-1', parentSkillId: '', code: 'NUM', name: 'الأعداد', description: '', kind: 'main', sortOrder: 1, status: 'active' }],
  };
}

function respond(route: Route, data: unknown, status = 200) {
  return route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(data) });
}

async function setup(page: Page, data: ReturnType<typeof fixture>) {
  await page.route('**/api/v1/auth/me', route => respond(route, { user: admin }));
  await page.route('**/api/v1/auth/csrf', route => respond(route, { csrfToken: 'csrf-error-contract' }));
  await page.route('**/api/v1/taxonomy/admin/bootstrap', route => respond(route, data));
  await page.goto('/admin-dashboard/taxonomy', { waitUntil: 'domcontentloaded' });
  await expect(page.getByLabel('حالة القدرات')).toBeVisible();
}

const scenarios = [
  { entity: 'path', id: 'path-1', label: 'حالة القدرات', url: '**/api/v1/taxonomy/admin/paths/path-1' },
  { entity: 'subject', id: 'subject-1', label: 'حالة الكمي', url: '**/api/v1/taxonomy/admin/subjects/subject-1' },
] as const;

for (const width of [390, 820, 1440]) {
  for (const scenario of scenarios) {
    test(`admin ${scenario.entity} HTTP 503 null body keeps original control, Arabic error and explicit retry — RTL ${width}`, async ({ page }) => {
      await page.setViewportSize({ width, height: 900 });
      const data = fixture();
      await setup(page, data);
      let writes = 0;
      await page.route(scenario.url, route => {
        writes += 1;
        expect(route.request().method()).toBe('PATCH');
        expect(route.request().headers()['x-csrf-token']).toBe('csrf-error-contract');
        expect(route.request().postDataJSON()).toEqual({ status: 'inactive' });
        if (writes === 1) return respond(route, null, 503);
        const rows = scenario.entity === 'path' ? data.paths : scenario.entity === 'subject' ? data.subjects : data.skills;
        const row = rows.find(item => item.id === scenario.id);
        if (!row) throw new Error('Fixture row missing');
        row.status = 'inactive';
        return respond(route, { [scenario.entity]: row });
      });

      const status = page.getByLabel(scenario.label);
      await status.selectOption('inactive');
      await expect(page.getByText('تعذر تنفيذ طلب التصنيف', { exact: true })).toBeVisible();
      await expect(status).toHaveValue('active');
      expect(writes).toBe(1);

      await status.selectOption('inactive');
      await expect(page.getByText('تم تحديث الحالة إلى «غير نشط».')).toBeVisible();
      await expect(status).toHaveValue('inactive');
      expect(writes).toBe(2);

      await page.reload({ waitUntil: 'domcontentloaded' });
      await expect(page.getByLabel(scenario.label)).toHaveValue('inactive');
    });
  }
}

for (const width of [390, 820, 1440]) {
  test(`admin skill edit HTTP 503 null body preserves original edit dialog and retries — RTL ${width}`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    const data = fixture();
    await setup(page, data);
    await page.goto('/admin-dashboard?tab=skills', { waitUntil: 'domcontentloaded' });
    await expect(page.getByRole('button', { name: 'تعديل المهارة الرئيسة الأعداد' })).toBeVisible();

    let writes = 0;
    await page.route('**/api/v1/taxonomy/admin/skills/skill-1', route => {
      writes += 1;
      expect(route.request().method()).toBe('PATCH');
      expect(route.request().headers()['x-csrf-token']).toBe('csrf-error-contract');
      expect(route.request().postDataJSON()).toMatchObject({ name: 'الأعداد المحدثة', description: '', sortOrder: 1 });
      if (writes === 1) return respond(route, null, 503);
      data.skills[0].name = 'الأعداد المحدثة';
      return respond(route, { skill: data.skills[0] });
    });

    await page.getByRole('button', { name: 'تعديل المهارة الرئيسة الأعداد' }).click();
    const dialog = page.getByRole('dialog', { name: 'تعديل المهارة' });
    await dialog.getByRole('textbox', { name: 'اسم المهارة' }).fill('الأعداد المحدثة');
    await dialog.getByRole('button', { name: 'حفظ المهارة' }).click();
    await expect(dialog.getByRole('alert')).toContainText('تعذر تنفيذ طلب التصنيف');
    await expect(dialog.getByRole('textbox', { name: 'اسم المهارة' })).toHaveValue('الأعداد المحدثة');
    expect(writes).toBe(1);

    await dialog.getByRole('button', { name: 'حفظ المهارة' }).click();
    await expect(dialog).toHaveCount(0);
    await expect(page.getByText('الأعداد المحدثة', { exact: true })).toBeVisible();
    expect(writes).toBe(2);
    await page.reload({ waitUntil: 'domcontentloaded' });
    await expect(page.getByText('الأعداد المحدثة', { exact: true })).toBeVisible();
    await expect(page.getByLabel('حالة المهارة الأعداد')).toHaveCount(0);
  });
}

test('admin taxonomy preserves a valid server-provided Arabic HTTP error', async ({ page }) => {
  const data = fixture();
  await setup(page, data);
  await page.route('**/api/v1/taxonomy/admin/paths/path-1', route => respond(route, { message: 'الحفظ غير متاح مؤقتًا' }, 503));
  await page.getByLabel('حالة القدرات').selectOption('inactive');
  await expect(page.getByText('الحفظ غير متاح مؤقتًا')).toBeVisible();
});

test('admin taxonomy malformed error response uses existing Arabic fallback', async ({ page }) => {
  const data = fixture();
  await setup(page, data);
  await page.route('**/api/v1/taxonomy/admin/paths/path-1', route => route.fulfill({
    status: 503, contentType: 'application/json', body: '{not-json',
  }));
  await page.getByLabel('حالة القدرات').selectOption('inactive');
  await expect(page.getByText('تعذر تنفيذ طلب التصنيف', { exact: true })).toBeVisible();
});
