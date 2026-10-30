import { expect, test, type Page, type Route } from '@playwright/test';

const admin = {
  id: 'admin-content-parity', email: 'admin@example.com', name: 'مدير المنصة',
  status: 'active', avatarUrl: '', emailVerified: true, role: 'admin', roles: ['admin'],
};
const taxonomy = {
  paths: [
    { id: 'path-1', code: 'P1', name: 'القدرات', sortOrder: 1 },
    { id: 'path-2', code: 'P2', name: 'التحصيلي', sortOrder: 2 },
  ],
  subjects: [],
};
function reply(route: Route, body: unknown, status = 200) {
  return route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) });
}
async function setup(page: Page) {
  await page.route('**/api/v1/auth/me', route => reply(route, { user: admin }));
  await page.route('**/api/v1/auth/csrf', route => reply(route, { csrfToken: 'csrf' }));
  await page.route('**/api/v1/taxonomy/bootstrap**', route => reply(route, taxonomy));
}

for (const width of [390, 820, 1440]) {
  test(`admin content has no migration banners or invented summary counters at ${width}px RTL`, async ({ page }) => {
    await setup(page);
    await page.route('**/api/v1/courses**', route => reply(route, {
      items: [], page: 1, limit: 50, hasMore: false,
    }));
    await page.setViewportSize({ width, height: 900 });
    await page.goto('/admin-dashboard/content');
    await expect(page.getByRole('heading', { name: 'إدارة المحتوى التعليمي' })).toBeVisible();
    await expect(page.getByText('Content Management', { exact: true })).toHaveCount(0);
    await expect(page.getByText(/نقل تدريجي لنفس تقسيم الواجهة المرجعية/)).toHaveCount(0);
    for (const label of ['المعروض', 'المعتمد', 'الظاهر', 'المغلق']) {
      await expect(page.getByText(label, { exact: true })).toHaveCount(0);
    }
    await expect(page.getByRole('button', { name: 'إنشاء دورة جديدة' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'الدروس' })).toBeVisible();
  });
}

test('admin changing path clears stale content before next scoped response, then retries after failure', async ({ page }) => {
  await setup(page);
  let release: (() => void) | undefined;
  const held = new Promise<void>(resolve => { release = resolve; });
  let path2Requests = 0;
  await page.route('**/api/v1/courses**', async route => {
    const url = new URL(route.request().url());
    if (url.pathname !== '/api/v1/courses') return reply(route, {});
    if (url.searchParams.get('pathId') === 'path-2') {
      path2Requests += 1;
      if (path2Requests === 1) {
        await held;
        return reply(route, { message: 'Temporary failure' }, 503);
      }
      return reply(route, { items: [{ id: 'course-2', pathId: 'path-2', subjectId: '',
        title: 'دورة التحصيلي', workflowStatus: 'draft', isVisible: true, isPublished: false,
        revision: 1 }], page: 1, limit: 50, hasMore: false });
    }
    return reply(route, { items: [{ id: 'course-1', pathId: 'path-1', subjectId: '',
      title: 'دورة القدرات', workflowStatus: 'draft', isVisible: true, isPublished: false,
      revision: 1 }], page: 1, limit: 50, hasMore: false });
  });

  await page.goto('/admin-dashboard/content');
  await expect(page.getByText('دورة القدرات')).toBeVisible();
  await page.locator('select').first().selectOption('path-2');
  try {
    await expect(page.getByText('دورة القدرات')).toHaveCount(0);
  } finally {
    release?.();
  }
  await expect(page.getByText(/Temporary failure/)).toBeVisible();
  await page.getByRole('button', { name: 'تحديث' }).last().click();
  await expect(page.getByText('دورة التحصيلي')).toBeVisible();
  await expect(page.getByText('دورة القدرات')).toHaveCount(0);
});
