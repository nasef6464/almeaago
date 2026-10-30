import { expect, test, type Page, type Route } from '@playwright/test';

// #160 owns the UI. #199 covers path/subject/edit; this file covers ONLY stage creation.
// The two failure modes are tested separately: real pointer hit-testing vs. draft state.
// dispatchEvent is used ONLY in the state-isolation test; it is not a UI-parity pass.
const admin = {
  id: 'admin-stage-draft', email: 'admin@example.test', name: 'مدير المنصة',
  status: 'active', avatarUrl: '', emailVerified: true,
  role: 'admin', roles: ['admin'],
};

type Stage = { id: string; pathId: string; code: string; name: string; sortOrder: number; status: string };
function respond(route: Route, body: unknown, status = 200) {
  return route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) });
}
function fixture() {
  return {
    paths: [{ id: 'path-1', code: 'QDR', name: 'القدرات', parentPathId: '', description: '', sortOrder: 1, status: 'active' }],
    levels: [{ id: 'level-1', pathId: 'path-1', code: 'L1', name: 'الأول', sortOrder: 1, status: 'active' }] as Stage[],
    subjects: [{ id: 'subject-1', pathId: 'path-1', levelId: 'level-1', code: 'QNT', name: 'الكمي', sortOrder: 1, status: 'active' }],
    skills: [],
  };
}
async function setup(page: Page, data: ReturnType<typeof fixture>) {
  await page.route('**/api/v1/auth/me', route => respond(route, { user: admin }));
  await page.route('**/api/v1/auth/csrf', route => respond(route, { csrfToken: 'csrf-stage' }));
  await page.route('**/api/v1/taxonomy/admin/bootstrap', route => respond(route, data));
  await page.goto('/admin-dashboard/taxonomy');
  await expect(page.getByLabel('كود المرحلة الجديدة')).toBeVisible();
}
async function stageFailureRoute(page: Page, data: ReturnType<typeof fixture>, failure: number) {
  let writes = 0;
  let lastBody: { pathId: string; code: string; name: string; sortOrder: number } | undefined;
  await page.route('**/api/v1/taxonomy/admin/levels', route => {
    writes++;
    lastBody = route.request().postDataJSON() as typeof lastBody;
    if (writes === 1) return respond(route, { message: 'تعذر حفظ المرحلة' }, failure);
    data.levels.push({ id: 'level-new', ...lastBody!, status: 'active' });
    return respond(route, { level: { id: 'level-new' } }, 201);
  });
  return { get writes() { return writes; }, get lastBody() { return lastBody; } };
}
async function fillStage(page: Page) {
  await page.getByLabel('كود المرحلة الجديدة').fill('L2');
  await page.getByLabel('اسم المرحلة الجديدة').fill('الثاني');
}
async function verifyStageDraftAndRetry(page: Page, data: ReturnType<typeof fixture>, observed: Awaited<ReturnType<typeof stageFailureRoute>>, dispatch: boolean) {
  await expect(page.getByText('تعذر حفظ المرحلة')).toBeVisible();
  await expect(page.getByLabel('كود المرحلة الجديدة')).toHaveValue('L2');
  await expect(page.getByLabel('اسم المرحلة الجديدة')).toHaveValue('الثاني');
  expect(observed.writes).toBe(1);
  expect(data.levels).toHaveLength(1);
  const button = page.getByRole('button', { name: 'إنشاء المرحلة' });
  if (dispatch) await button.dispatchEvent('click');
  else await button.click({ timeout: 8000 });
  await expect(page.getByText('تم إنشاء المرحلة.')).toBeVisible();
  expect(observed.writes).toBe(2);
  expect(observed.lastBody).toMatchObject({ pathId: 'path-1', code: 'L2', name: 'الثاني' });
  await expect(page.getByLabel('كود المرحلة الجديدة')).toHaveValue('');
  await page.reload();
  await expect(page.getByRole('button', { name: /الثاني/ })).toBeVisible();
}

for (const width of [390, 820, 1440]) {
  for (const failure of [503, 409]) {
    test(`stage submit is pointer-clickable and retains draft after HTTP ${failure} — RTL ${width}`, async ({ page }) => {
      await page.setViewportSize({ width, height: 900 });
      const data = fixture();
      await setup(page, data);
      const observed = await stageFailureRoute(page, data, failure);
      await fillStage(page);
      // Real pointer click MUST work: no overlay/sibling input may intercept it.
      await page.getByRole('button', { name: 'إنشاء المرحلة' }).click({ timeout: 8000 });
      await verifyStageDraftAndRetry(page, data, observed, false);
    });

    test(`stage draft state survives HTTP ${failure} independent of hit-testing — RTL ${width}`, async ({ page }) => {
      await page.setViewportSize({ width, height: 900 });
      const data = fixture();
      await setup(page, data);
      const observed = await stageFailureRoute(page, data, failure);
      await fillStage(page);
      // Synthetic event isolates draft loss from the separate overlapping-layout bug.
      // It is NOT evidence that the real button is clickable.
      await page.getByRole('button', { name: 'إنشاء المرحلة' }).dispatchEvent('click');
      await verifyStageDraftAndRetry(page, data, observed, true);
    });
  }
}
