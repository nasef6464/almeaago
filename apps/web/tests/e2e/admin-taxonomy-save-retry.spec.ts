import { expect, test, type Page } from '@playwright/test';

const cases = [
  { kind: 'path', collection: 'paths', id: 'path-1', original: 'القدرات', title: 'تعديل مسار القدرات', namePlaceholder: 'مثال: القدرات العامة', save: 'حفظ المسار', notice: 'تم حفظ تعديلات المسار بنجاح.' },
  { kind: 'level', collection: 'levels', id: 'level-1', original: 'الأولى', title: 'تعديل مرحلة الأولى', namePlaceholder: 'مثال: المرحلة الابتدائية - الصف الثالث', save: 'حفظ المرحلة', notice: 'تم حفظ تعديلات المرحلة بنجاح.' },
  { kind: 'subject', collection: 'subjects', id: 'subject-1', original: 'الكمي', title: 'تعديل مادة الكمي', namePlaceholder: 'مثال: القدرات الكمي', save: 'حفظ المادة', notice: 'تم حفظ تعديلات المادة بنجاح.' },
] as const;

function fixture() {
  return {
    paths: [{ id: 'path-1', code: 'QDR', name: 'القدرات', parentPathId: '', description: '', sortOrder: 1, status: 'active' }],
    levels: [{ id: 'level-1', pathId: 'path-1', code: 'L1', name: 'الأولى', sortOrder: 1, status: 'active' }],
    subjects: [{ id: 'subject-1', pathId: 'path-1', levelId: 'level-1', code: 'QNT', name: 'الكمي', sortOrder: 1, status: 'active' }],
    skills: [],
  };
}

async function setup(page: Page, data: ReturnType<typeof fixture>) {
  await page.route(url => url.pathname.startsWith('/api/'), route => {
    const path = new URL(route.request().url()).pathname;
    if (path === '/api/v1/auth/me') return route.fulfill({ json: { user: { id: 'admin-retry', name: 'مدير المنصة', email: 'admin@example.invalid', roles: ['admin'], role: 'admin', status: 'active', emailVerified: true, avatarUrl: '' } } });
    if (path === '/api/v1/auth/csrf') return route.fulfill({ json: { csrfToken: 'csrf-draft-retry' } });
    if (path === '/api/v1/taxonomy/admin/bootstrap') return route.fulfill({ json: data });
    if (path === '/api/v1/taxonomy/bootstrap') return route.fulfill({ json: { ...data, skills: [] } });
    if (path === '/api/v1/content/homepage-settings' || path === '/api/v1/content/platform-font-settings') return route.fulfill({ json: {} });
    if (route.request().method() !== 'GET') return route.fulfill({ status: 403, json: { message: 'Unexpected mutation outside the synthetic editor scenario' } });
    return route.fulfill({ json: { items: [], ads: [], announcements: [], hasMore: false } });
  });
  await page.goto('/admin-dashboard/taxonomy', { waitUntil: 'domcontentloaded' });
  await expect(page.getByLabel('حالة القدرات')).toBeVisible();
}

async function openEditor(page: Page, scenario: typeof cases[number]) {
  if (scenario.kind === 'path') {
    await page.getByRole('button', { name: 'تعديل المسار', exact: true }).click();
  } else if (scenario.kind === 'level') {
    await page.getByRole('button', { name: /^المراحل التعليمية/ }).click();
    await page.getByRole('button', { name: 'تعديل المرحلة', exact: true }).click();
  } else {
    const card = page.locator('div.rounded-3xl').filter({ has: page.getByRole('heading', { name: 'الكمي', exact: true }) });
    await card.getByRole('button', { name: 'تعديل', exact: true }).click();
  }
  // Current source presentation has no dialog role. Anchor to its exact title
  // and nearest modal panel without selecting an arbitrary matching dialog.
  return page.getByRole('heading', { name: scenario.title, exact: true }).locator('../..');
}

for (const width of [390, 820, 1440]) {
  for (const scenario of cases) {
    test(`taxonomy ${scenario.kind} edit preserves draft and retries after null 503 at ${width}px`, async ({ page }) => {
      await page.setViewportSize({ width, height: 1000 });
      const data = fixture();
      await setup(page, data);
      const workspace = page.getByTestId('taxonomy-admin-page');
      const bounds = await workspace.boundingBox();
      expect(bounds).not.toBeNull();
      expect(bounds!.x).toBeGreaterThanOrEqual(0);
      expect(bounds!.x + bounds!.width).toBeLessThanOrEqual(width + 1);
      const overview = page.getByRole('heading', { name: 'القدرات', exact: true }).locator('xpath=ancestor::article');
      const overviewBounds = await overview.boundingBox();
      expect(overviewBounds!.x).toBeGreaterThanOrEqual(0);
      expect(overviewBounds!.x + overviewBounds!.width).toBeLessThanOrEqual(width + 1);
      const updatedName = scenario.original + ' المحدثة';
      const payloads: Record<string, unknown>[] = [];
      await page.route(`**/api/v1/taxonomy/admin/${scenario.collection}/${scenario.id}`, route => {
        expect(route.request().method()).toBe('PATCH');
        expect(route.request().headers()['x-csrf-token']).toBe('csrf-draft-retry');
        const body = route.request().postDataJSON() as Record<string, unknown>;
        expect(body.name).toBe(updatedName);
        payloads.push(body);
        if (payloads.length === 1) return route.fulfill({ status: 503, json: null });
        const row = data[scenario.collection].find(item => item.id === scenario.id)!;
        Object.assign(row, body);
        return route.fulfill({ json: { [scenario.kind]: row } });
      });

      const editor = await openEditor(page, scenario);
      const name = editor.getByPlaceholder(scenario.namePlaceholder, { exact: true });
      await name.fill(updatedName);
      await editor.getByRole('button', { name: scenario.save, exact: true }).click();
      await expect(editor).toBeVisible();
      await expect(name).toHaveValue(updatedName);
      await expect(editor.getByText('تعذر تنفيذ طلب التصنيف', { exact: true })).toBeVisible();
      expect(payloads).toHaveLength(1);

      await editor.getByRole('button', { name: scenario.save, exact: true }).click();
      await expect(editor).toHaveCount(0);
      await expect(page.getByText(scenario.notice, { exact: true })).toBeVisible();
      expect(payloads).toHaveLength(2);
      expect(payloads[1]).toEqual(payloads[0]);
      await page.reload({ waitUntil: 'domcontentloaded' });
      if (scenario.kind === 'level') await page.getByRole('button', { name: /^المراحل التعليمية/ }).click();
      await expect(page.getByRole('heading', { name: updatedName, exact: true })).toBeVisible();
    });
  }
}
