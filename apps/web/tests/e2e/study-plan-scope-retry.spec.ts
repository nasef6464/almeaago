import { expect, test, type Page, type Route } from '@playwright/test';

const student = {
  id: 'student-1', email: 'student@example.com', name: 'طالب', status: 'active',
  avatarUrl: '', emailVerified: true, role: 'student', roles: ['student'],
};
const paths = [
  { id: 'path-1', code: 'QDR', name: 'القدرات', description: '', sortOrder: 1 },
  { id: 'path-2', code: 'TAH', name: 'التحصيلي', description: '', sortOrder: 2 },
];
const taxonomy = { paths, subjects: [] };

function json(route: Route, body: unknown, status = 200) {
  return route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) });
}
async function setup(page: Page) {
  await page.route('**/api/v1/auth/me', route => json(route, { user: student }));
  await page.route('**/api/v1/auth/csrf', route => json(route, { csrfToken: 'csrf-plan' }));
  await page.route('**/api/v1/taxonomy/bootstrap?phase=core', route => json(route, taxonomy));
  await page.route('**/api/v1/interventions/mine?*', route => json(route, { items: [], page: 1, limit: 20, hasMore: false }));
}
function plan(id: string, name: string, status: 'active' | 'archived') {
  return {
    id, studentId: student.id, name, pathId: 'path-1', subjectIds: [], courseIds: [],
    startDate: '2026-10-29', endDate: '2026-11-05', skipCompletedQuizzes: true,
    dailyMinutes: 90, preferredStartTime: '17:00', status, offDays: [], items: [],
    itemCount: 0, createdAt: '2026-10-29T10:00:00Z', updatedAt: '2026-10-29T10:00:00Z',
  };
}
const active = plan('plan-active', 'الخطة النشطة القديمة', 'active');
const archived = plan('plan-archived', 'الخطة المؤرشفة الصحيحة', 'archived');

for (const width of [390, 820, 1440]) {
  test(`study plan status scope never displays stale active plan after failed archived read and supports retry at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await setup(page);
    let archivedReads = 0;
    await page.route('**/api/v1/study-plans/**', route => {
      const url = new URL(route.request().url());
      if (url.pathname.endsWith('/plan-active')) return json(route, { plan: active });
      if (url.pathname.endsWith('/plan-archived')) return json(route, { plan: archived });
      if (route.request().method() !== 'GET') throw new Error('Unexpected mutation');
      const status = url.searchParams.get('status');
      if (status === 'archived') {
        archivedReads += 1;
        if (archivedReads === 1) return json(route, { message: 'فشل تحميل الخطط' }, 503);
      }
      const selected = status === 'archived' ? archived : active;
      return json(route, { items: [selected], page: 1, limit: 20, hasMore: false });
    });
    await page.goto('/plan');
    await expect(page.getByRole('heading', { name: active.name })).toBeVisible();
    await page.getByRole('button', { name: 'مؤرشفة' }).click();
    await expect(page.getByText('فشل تحميل الخطط')).toBeVisible();
    await expect(page.getByRole('heading', { name: active.name })).toHaveCount(0);
    await expect(page.getByText('لا توجد خطط مؤرشفة.')).toHaveCount(0);
    await page.getByRole('button', { name: 'إعادة تحميل الخطط' }).click();
    await expect(page.getByRole('heading', { name: archived.name })).toBeVisible();
    await expect(page.getByRole('heading', { name: active.name })).toHaveCount(0);
    expect(archivedReads).toBe(2);
    await page.screenshot({ path: `test-results/study-plan-scope-${width}.png`, fullPage: true });
  });
}

test('failed study plan save retains draft, permits retry and reloads persisted result', async ({ page }) => {
  await page.setViewportSize({ width: 820, height: 1000 });
  await setup(page);
  let saved: ReturnType<typeof plan> | null = null;
  let writes = 0;
  await page.route('**/api/v1/study-plans/**', route => {
    const url = new URL(route.request().url());
    if (url.pathname.endsWith('/plan-saved')) return json(route, { plan: saved });
    if (route.request().method() === 'GET') {
      return json(route, { items: saved ? [saved] : [], page: 1, limit: 20, hasMore: false });
    }
    if (route.request().method() === 'POST') {
      writes += 1;
      if (writes === 1) return json(route, { message: 'تعذر حفظ الخطة مؤقتًا' }, 503);
      const input = JSON.parse(route.request().postData() || '{}');
      saved = { ...plan('plan-saved', input.name, 'active'), ...input };
      return json(route, { plan: saved }, 201);
    }
    throw new Error('Unexpected study plan request');
  });
  await page.goto('/plan');
  await expect(page.getByText('لا توجد خطة نشطة لهذا المسار بعد.')).toBeVisible();
  await page.getByLabel('اسم الخطة').fill('خطة قابلة للاسترجاع');
  await page.getByRole('button', { name: 'إنشاء الخطة الدراسية' }).click();
  await expect(page.getByText('تعذر حفظ الخطة مؤقتًا')).toBeVisible();
  await expect(page.getByLabel('اسم الخطة')).toHaveValue('خطة قابلة للاسترجاع');
  await page.getByRole('button', { name: 'إنشاء الخطة الدراسية' }).click();
  await expect(page.getByRole('heading', { name: 'خطة قابلة للاسترجاع' })).toBeVisible();
  await page.reload();
  await expect(page.getByRole('heading', { name: 'خطة قابلة للاسترجاع' })).toBeVisible();
  expect(writes).toBe(2);
});
