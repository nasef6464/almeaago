import { expect, test, type Page, type Route } from '@playwright/test';

// The archive action must report success only after the server has accepted
// the mutation. The browser contract is deliberately separate from the
// database/archive semantics, which require an isolated PostgreSQL test.
type Entity = 'path' | 'subject';

const admin = {
  id: 'admin-archive', name: 'مدير المنصة', email: 'admin@example.invalid',
  role: 'admin', roles: ['admin'], status: 'active',
  emailVerified: true, avatarUrl: '',
};

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
    if (path === '/api/v1/auth/me') return route.fulfill({ json: { user: admin } });
    if (path === '/api/v1/auth/csrf') return route.fulfill({ json: { csrfToken: 'csrf-archive' } });
    if (path === '/api/v1/taxonomy/admin/bootstrap') return route.fulfill({ json: data });
    if (path === '/api/v1/taxonomy/bootstrap') return route.fulfill({ json: data });
    if (path === '/api/v1/content/homepage-settings' || path === '/api/v1/content/platform-font-settings') {
      return route.fulfill({ json: {} });
    }
    if (route.request().method() !== 'GET') return route.fulfill({ status: 403, json: { message: 'Unexpected mutation' } });
    return route.fulfill({ json: { items: [], hasMore: false } });
  });
  await page.goto('/admin-dashboard/taxonomy', { waitUntil: 'domcontentloaded' });
  await expect(page.getByLabel('حالة القدرات')).toBeVisible();
}

const cases = [
  { entity: 'path', id: 'path-1', endpoint: 'paths', action: 'أرشفة المسار', name: 'المسار', statusLabel: 'حالة القدرات' },
  { entity: 'subject', id: 'subject-1', endpoint: 'subjects', action: 'أرشفة المادة', name: 'المادة', statusLabel: 'حالة الكمي' },
] as const;

for (const width of [390, 820, 1440]) {
  for (const scenario of cases) {
    test(`archive ${scenario.entity} reports 503 and permits safe retry at ${width}px`, async ({ page }) => {
      await page.setViewportSize({ width, height: 900 });
      const data = fixture();
      await setup(page, data);

      let writes = 0;
      const bodies: unknown[] = [];
      await page.route(`**/api/v1/taxonomy/admin/${scenario.endpoint}/${scenario.id}`, (route: Route) => {
        writes += 1;
        expect(route.request().method()).toBe('PATCH');
        expect(route.request().headers()['x-csrf-token']).toBe('csrf-archive');
        const body = route.request().postDataJSON();
        expect(body).toEqual({ status: 'archived' });
        bodies.push(body);
        if (writes === 1) return route.fulfill({ status: 503, json: null });
        if (scenario.entity === 'path') data.paths[0].status = 'archived';
        else data.subjects[0].status = 'archived';
        return route.fulfill({ json: { [scenario.entity]: scenario.entity === 'path' ? data.paths[0] : data.subjects[0] } });
      });

      const trigger = page.getByRole('button', { name: scenario.action, exact: true });
      await expect(trigger).toBeVisible();
      await trigger.click();
      const dialog = page.getByRole('dialog', { name: `تأكيد أرشفة ${scenario.name}` });
      await expect(dialog).toBeVisible();

      await dialog.getByRole('button', { name: 'تأكيد الأرشفة' }).click();
      await expect(dialog).toBeVisible();
      await expect(dialog.getByRole('alert')).toHaveText('تعذر تنفيذ طلب التصنيف');
      await expect(page.getByText(`تمت أرشفة ${scenario.name} بنجاح`)).toHaveCount(0);
      // The modal is aria-modal; inspect the immutable server fixture while it is open.
      expect(scenario.entity === 'path' ? data.paths[0].status : data.subjects[0].status).toBe('active');
      expect(writes).toBe(1);

      await dialog.getByRole('button', { name: 'تأكيد الأرشفة' }).click();
      await expect(dialog).toHaveCount(0);
      await expect(page.getByLabel(scenario.statusLabel)).toHaveValue('archived');
      expect(writes).toBe(2);
      expect(bodies[1]).toEqual(bodies[0]);

      await page.reload({ waitUntil: 'domcontentloaded' });
      await expect(page.getByLabel(scenario.statusLabel)).toHaveValue('archived');
    });
  }
}


test('archive confirmation disables duplicate submission until API completes', async ({ page }) => {
  const data = fixture();
  await setup(page, data);
  let writes = 0;
  let release: (() => void) | undefined;
  const gate = new Promise<void>(resolve => { release = resolve; });
  await page.route('**/api/v1/taxonomy/admin/paths/path-1', async route => {
    writes += 1;
    expect(route.request().method()).toBe('PATCH');
    await gate;
    data.paths[0].status = 'archived';
    await route.fulfill({ json: { path: data.paths[0] } });
  });
  await page.getByRole('button', { name: 'أرشفة المسار', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: 'تأكيد أرشفة المسار' });
  const confirm = dialog.getByRole('button', { name: 'تأكيد الأرشفة' });
  try {
    await confirm.click();
    await expect(confirm).toBeDisabled();
    await expect(dialog).toBeVisible();
    expect(writes).toBe(1);
  } finally {
    release?.();
  }
  await expect(dialog).toHaveCount(0);
  await expect(page.getByLabel('حالة القدرات')).toHaveValue('archived');
  expect(writes).toBe(1);
});


for (const scenario of cases) {
  test(`archive ${scenario.entity} denies forbidden mutation without changing state`, async ({ page }) => {
    const data = fixture();
    await setup(page, data);
    let rejectedWrites = 0;
    await page.route(`**/api/v1/taxonomy/admin/${scenario.endpoint}/${scenario.id}`, route => {
      rejectedWrites += 1;
      expect(route.request().method()).toBe('PATCH');
      expect(route.request().postDataJSON()).toEqual({ status: 'archived' });
      return route.fulfill({ status: 403, json: { message: 'Forbidden' } });
    });

    await page.getByRole('button', { name: scenario.action, exact: true }).click();
    const dialog = page.getByRole('dialog', { name: `تأكيد أرشفة ${scenario.name}` });
    await dialog.getByRole('button', { name: 'تأكيد الأرشفة' }).click();
    await expect(dialog).toBeVisible();
    await expect(dialog.getByRole('alert')).toBeVisible();
    await expect(page.getByLabel(scenario.statusLabel)).toHaveValue('active');
    expect(rejectedWrites).toBe(1);

    await page.reload({ waitUntil: 'domcontentloaded' });
    await expect(page.getByLabel(scenario.statusLabel)).toHaveValue('active');
    expect(rejectedWrites).toBe(1);
  });
}
