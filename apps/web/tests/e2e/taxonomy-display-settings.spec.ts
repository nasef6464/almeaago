import { expect, test, type Page, type Route } from '@playwright/test';

const admin = {
  id: 'admin-1', email: 'admin@example.com', name: 'مدير المنصة', status: 'active',
  avatarUrl: '', emailVerified: true, role: 'admin', roles: ['admin'],
};

function json(route: Route, body: unknown, status = 200) {
  return route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) });
}

async function setup(page: Page) {
  let releaseFirstPathSave!: () => void;
  const firstPathSaveGate = new Promise<void>(resolve => { releaseFirstPathSave = resolve; });
  let holdFirstPathSave = true;
  const state = {
    paths: [{
      id: 'path-1', code: 'QDR', name: 'القدرات', parentPathId: '',
      description: 'المسار الأساسي', sortOrder: 1, status: 'active',
      showInNavbar: true, showInHome: true,
      settings: { showSubjectCards: true, showMockExamCard: true, showPackageCard: true, studentTemplate: 'standard', stageSelection: 'auto' },
    }, {
      id: 'path-archived', code: 'OLD', name: 'مسار مؤرشف', parentPathId: '',
      description: 'لا يظهر في الموقع العام', sortOrder: 2, status: 'inactive',
      showInNavbar: true, showInHome: true,
      settings: {},
    }],
    levels: [],
    subjects: [{
      id: 'subject-1', pathId: 'path-1', code: 'QNT',
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
    if (holdFirstPathSave) {
      holdFirstPathSave = false;
      await firstPathSaveGate;
    }
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
    paths: state.paths.map(({ id, code, name, parentPathId, description, sortOrder, status, showInNavbar, showInHome, settings }) =>
      ({ id, code, name, parentPathId, description, sortOrder, isActive: status === 'active', showInNavbar, showInHome, settings })),
    levels: state.levels,
    subjects: state.subjects.map(({ id, pathId, levelId, code, name, sortOrder, icon, color }) =>
      ({ id, pathId, levelId, code, name, sortOrder, icon, color })),
    skills: [],
  }));
  return { state, writes, releaseFirstPathSave };
}

for (const width of [390, 820, 1440]) {
  test(`taxonomy display settings persist and reach public bootstrap at ${width}px`, async ({ page }) => {
    const { state, writes, releaseFirstPathSave } = await setup(page);
    await page.setViewportSize({ width, height: 960 });
    await page.goto('/');
    const initialHomePaths = page.getByTestId('public-home-paths');
    await expect(initialHomePaths.locator('a[href="/learning?pathId=path-1"]')).toHaveCount(1);
    await expect(initialHomePaths.locator('a[href="/learning?pathId=path-archived"]')).toHaveCount(0);
    await page.goto('/admin-dashboard/taxonomy');

    const editor = page.getByTestId('taxonomy-display-editor');
    await expect(editor).toBeVisible();
    await expect(editor.getByLabel('تسمية المرحلة')).toHaveValue('اختر مرحلتك');
    await expect(editor.getByLabel('إظهار المسار في القائمة العلوية')).toBeChecked();
    await editor.getByLabel('إظهار المسار في القائمة العلوية').uncheck();
    await editor.getByLabel('إظهار بطاقات المواد').uncheck();
    await editor.getByLabel('إظهار بطاقة الاختبارات المحاكية').uncheck();
    await editor.getByLabel('إظهار بطاقة الباقات').uncheck();
    await editor.getByLabel('قالب مساحة المسار').selectOption('simple');
    await editor.getByLabel('طريقة اختيار المرحلة').selectOption('none');
    await expect(editor.getByLabel('تسمية المرحلة')).toBeDisabled();
    await editor.getByLabel('طريقة اختيار المرحلة').selectOption('required');
    await expect(editor.getByLabel('تسمية المرحلة')).toBeEnabled();
    await expect(editor.getByText('أضف مرحلة قبل إتاحة تسجيل الطلاب. يمكنك حفظ الإعداد ثم إضافة المراحل من تبويب المراحل.')).toBeVisible();
    await editor.getByLabel('تسمية المرحلة').fill('');
    await expect(editor.getByLabel('تسمية المرحلة')).toHaveValue('');
    await editor.getByRole('button', { name: 'حفظ عرض المسار' }).click();
    await expect(editor.getByLabel('إظهار المسار في القائمة العلوية')).toBeDisabled();
    await expect(editor.getByLabel('قالب مساحة المسار')).toBeDisabled();
    releaseFirstPathSave();
    await expect(page.getByText('تم حفظ إعدادات عرض المسار.')).toBeVisible();

    await expect.poll(() => writes.some(x => x.path === 'path')).toBe(true);
    const pathWrite = writes.find(x => x.path === 'path')!;
    expect(pathWrite.csrf).toBe('csrf-display');
    expect(pathWrite.body).toMatchObject({
      showInNavbar: false,
      showInHome: true,
      settings: { showSubjectCards: false, showMockExamCard: false, showPackageCard: false, studentTemplate: 'simple', stageSelection: 'required', stageLabel: 'اختر مرحلتك' },
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
    await expect(editor.getByLabel('إظهار المسار في الصفحة الرئيسية')).toBeChecked();
    await expect(editor.getByLabel('إظهار بطاقات المواد')).not.toBeChecked();
    await expect(editor.getByLabel('إظهار بطاقة الاختبارات المحاكية')).not.toBeChecked();
    await expect(editor.getByLabel('إظهار بطاقة الباقات')).not.toBeChecked();
    await expect(editor.getByLabel('قالب مساحة المسار')).toHaveValue('simple');
    await expect(editor.getByLabel('طريقة اختيار المرحلة')).toHaveValue('required');
    await expect(editor.getByLabel('تسمية المرحلة')).toHaveValue('اختر مرحلتك');
    await expect(editor.getByLabel('أيقونة المادة')).toHaveValue('🧪');
    await expect(editor.getByLabel('لون المادة')).toHaveValue('#abcdef');

    const publicProjection = await page.evaluate(async () =>
      fetch('/api/v1/taxonomy/bootstrap?phase=core').then(response => response.json()));
    expect(publicProjection.paths.find((path: { id: string }) => path.id === 'path-archived')).toMatchObject({ isActive: false, showInHome: true });
    expect(publicProjection.paths[0]).toMatchObject({
      showInNavbar: false, showInHome: true,
      settings: { showSubjectCards: false, showMockExamCard: false, showPackageCard: false, studentTemplate: 'simple', stageSelection: 'required', stageLabel: 'اختر مرحلتك' },
    });
    expect(publicProjection.subjects[0]).toMatchObject({ icon: '🧪', color: '#abcdef' });
    await page.goto('/');
    const visibleHomePaths = page.getByTestId('public-home-paths');
    await expect(visibleHomePaths.locator('a[href="/learning?pathId=path-1"]')).toHaveCount(1);
    await expect(visibleHomePaths.locator('a[href="/learning?pathId=path-archived"]')).toHaveCount(0);
    await page.screenshot({ path: `test-results/taxonomy-display-navbar-hidden-home-visible-${width}.png`, fullPage: true });

    await page.goto('/admin-dashboard/taxonomy');
    await editor.getByLabel('إظهار المسار في الصفحة الرئيسية').uncheck();
    await editor.getByRole('button', { name: 'حفظ عرض المسار' }).click();
    await expect(page.getByText('تم حفظ إعدادات عرض المسار.')).toBeVisible();
    await expect.poll(() => writes.filter(x => x.path === 'path').length).toBe(2);
    expect(writes[1].body).toMatchObject({ showInNavbar: false, showInHome: false });
    await page.reload();
    await expect(editor.getByLabel('إظهار المسار في القائمة العلوية')).not.toBeChecked();
    await expect(editor.getByLabel('إظهار المسار في الصفحة الرئيسية')).not.toBeChecked();
    const hiddenProjection = await page.evaluate(async () =>
      fetch('/api/v1/taxonomy/bootstrap?phase=core').then(response => response.json()));
    expect(hiddenProjection.paths[0]).toMatchObject({ showInNavbar: false, showInHome: false });
    await page.goto('/');
    const updatedHomePaths = page.getByTestId('public-home-paths');
    await expect(updatedHomePaths.locator('a[href="/learning?pathId=path-1"]')).toHaveCount(0);
    await page.screenshot({ path: `test-results/taxonomy-display-public-${width}.png`, fullPage: true });
    expect(state.paths[0].showInNavbar).toBe(false);
    expect(state.paths[0].showInHome).toBe(false);
  });
}
