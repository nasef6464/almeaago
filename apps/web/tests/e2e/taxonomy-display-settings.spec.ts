import { expect, test, type Page, type Route } from '@playwright/test';

const admin = {
  id: 'admin-1', email: 'admin@example.com', name: 'مدير المنصة', status: 'active',
  avatarUrl: '', emailVerified: true, role: 'admin', roles: ['admin'],
};

function json(route: Route, body: unknown, status = 200) {
  return route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) });
}

async function setup(page: Page) {
  const state = {
    paths: [{
      id: 'path-1', code: 'QDR', name: 'القدرات', parentPathId: '',
      description: 'المسار الأساسي', sortOrder: 1, status: 'active',
      showInNavbar: true, showInHome: true,
      settings: { showMockExamCard: true, stageSelection: 'auto', stageLabel: 'المرحلة' },
    }],
    levels: [{ id: 'level-1', pathId: 'path-1', code: 'L1', name: 'المرحلة الأولى', sortOrder: 1, status: 'active' }],
    subjects: [{
      id: 'subject-1', pathId: 'path-1', levelId: 'level-1', code: 'QNT',
      name: 'الكمي', sortOrder: 1, status: 'active', icon: '📘', color: '#4f46e5',
    }],
    skills: [],
  };
  const writes: Array<{ path: string; body: Record<string, unknown>; csrf: string }> = [];
  await page.route('**/api/v1/auth/me', route => json(route, { user: admin }));
  await page.route('**/api/v1/auth/csrf', route => json(route, { csrfToken: 'csrf-display' }));
  await page.route('**/api/v1/taxonomy/admin/bootstrap', route => json(route, state));
  await page.route('**/api/v1/taxonomy/admin/paths/path-1', async route => {
    const body = route.request().postDataJSON() as Record<string, unknown>;
    writes.push({ path: 'path', body, csrf: route.request().headers()['x-csrf-token'] || '' });
    const row = state.paths[0];
    if (typeof body.showInNavbar === 'boolean') row.showInNavbar = body.showInNavbar;
    if (typeof body.showInHome === 'boolean') row.showInHome = body.showInHome;
    if (body.settings && typeof body.settings === 'object') {
      row.settings = { ...row.settings, ...(body.settings as Record<string, unknown>) };
    }
    return json(route, { path: row });
  });
  await page.route('**/api/v1/taxonomy/admin/subjects/subject-1', async route => {
    const body = route.request().postDataJSON() as Record<string, unknown>;
    writes.push({ path: 'subject', body, csrf: route.request().headers()['x-csrf-token'] || '' });
    Object.assign(state.subjects[0], body);
    return json(route, { subject: state.subjects[0] });
  });
  await page.route('**/api/v1/taxonomy/bootstrap?phase=core', route => json(route, {
    paths: state.paths.map(({ id, code, name, parentPathId, description, sortOrder, showInNavbar, showInHome, settings }) =>
      ({ id, code, name, parentPathId, description, sortOrder, isActive: true, showInNavbar, showInHome, settings })),
    levels: state.levels,
    subjects: state.subjects.map(({ id, pathId, levelId, code, name, sortOrder, icon, color }) =>
      ({ id, pathId, levelId, code, name, sortOrder, icon, color })),
    skills: [],
  }));
  return { state, writes };
}

for (const width of [390, 820, 1440]) {
  test(`taxonomy display settings persist and reach public bootstrap at ${width}px`, async ({ page }) => {
    const { state, writes } = await setup(page);
    await page.setViewportSize({ width, height: 960 });
    await page.goto('/admin-dashboard/taxonomy');

    const editor = page.getByTestId('taxonomy-display-editor');
    await expect(editor).toBeVisible();
    await expect(editor.getByLabel('إظهار المسار في القائمة العلوية')).toBeChecked();
    await editor.getByLabel('إظهار المسار في القائمة العلوية').uncheck();
    await editor.getByLabel('إظهار المسار في الصفحة الرئيسية').uncheck();
    await editor.getByLabel('إظهار بطاقة الاختبارات المحاكية').uncheck();
    await editor.getByLabel('طريقة اختيار المرحلة').selectOption('required');
    await editor.getByLabel('تسمية المرحلة').fill('');
    await editor.getByRole('button', { name: 'حفظ عرض المسار' }).click();
    await expect(page.getByText('تم حفظ إعدادات عرض المسار.')).toBeVisible();

    await expect.poll(() => writes.some(x => x.path === 'path')).toBe(true);
    const pathWrite = writes.find(x => x.path === 'path')!;
    expect(pathWrite.csrf).toBe('csrf-display');
    expect(pathWrite.body).toMatchObject({
      showInNavbar: false,
      showInHome: false,
      settings: { showMockExamCard: false, stageSelection: 'required', stageLabel: '' },
    });

    await editor.getByLabel('أيقونة المادة').fill('🧪');
    await editor.getByLabel('لون المادة').fill('#abcdef');
    await editor.getByRole('button', { name: 'حفظ مظهر المادة' }).click();
    await expect(page.getByText('تم حفظ مظهر المادة.')).toBeVisible();
    const subjectWrite = writes.find(x => x.path === 'subject')!;
    expect(subjectWrite.csrf).toBe('csrf-display');
    expect(subjectWrite.body).toEqual({ icon: '🧪', color: '#abcdef' });

    await page.reload();
    await expect(editor.getByLabel('إظهار المسار في القائمة العلوية')).not.toBeChecked();
    await expect(editor.getByLabel('إظهار المسار في الصفحة الرئيسية')).not.toBeChecked();
    await expect(editor.getByLabel('إظهار بطاقة الاختبارات المحاكية')).not.toBeChecked();
    await expect(editor.getByLabel('طريقة اختيار المرحلة')).toHaveValue('required');
    await expect(editor.getByLabel('تسمية المرحلة')).toHaveValue('');
    await expect(editor.getByLabel('أيقونة المادة')).toHaveValue('🧪');
    await expect(editor.getByLabel('لون المادة')).toHaveValue('#abcdef');

    const publicProjection = await page.evaluate(async () =>
      fetch('/api/v1/taxonomy/bootstrap?phase=core').then(response => response.json()));
    expect(publicProjection.paths[0]).toMatchObject({
      showInNavbar: false, showInHome: false,
      settings: { showMockExamCard: false, stageSelection: 'required', stageLabel: '' },
    });
    expect(publicProjection.subjects[0]).toMatchObject({ icon: '🧪', color: '#abcdef' });
    await page.screenshot({ path: `test-results/taxonomy-display-${width}.png`, fullPage: true });
    expect(state.paths[0].showInNavbar).toBe(false);
  });
}
