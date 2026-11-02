import { expect, test, type Route } from '@playwright/test';

const path = { id: 'path-a', name: 'القدرات', code: 'PATH_A', status: 'active', sortOrder: 1 };
const subject = { id: 'subject-a', pathId: path.id, name: 'الكمي', code: 'SUB_A', status: 'active', sortOrder: 1 };
const parent = { id: 'topic-parent', pathId: path.id, subjectId: subject.id, parentTopicId: '', title: 'الجبر الأساسي', code: 'ALGEBRA', status: 'active', sortOrder: 1, isVisible: true, isLocked: false, skillIds: ['skill-a'] };
const taxonomy = { paths: [path], levels: [], subjects: [subject], skills: [{ id: 'skill-a', pathId: path.id, subjectId: subject.id, name: 'حل المعادلات', code: 'EQUATIONS', status: 'active', sortOrder: 1 }] };
const json = (route: Route, body: unknown, status = 200) => route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) });

for (const width of [390, 820, 1440]) {
  test(`subtopic creation preserves clicked parent and scope at ${width}`, async ({ page }) => {
    test.setTimeout(60_000);
    await page.setViewportSize({ width, height: 900 });
    const topics = [parent];
    const writes: { body: typeof parent; csrf: string | undefined }[] = [];
    await page.route((url) => url.pathname.startsWith('/api/'), async (route) => {
      const request = route.request();
      const url = new URL(request.url());
      if (url.pathname === '/api/v1/auth/me') return json(route, { user: { id: 'admin-fixture', email: 'admin@example.test', name: 'مدير المنصة', status: 'active', roles: ['admin'] } });
      if (url.pathname === '/api/v1/auth/csrf') return json(route, { csrfToken: 'csrf-subtopic' });
      if (url.pathname.includes('/taxonomy/') && url.pathname.endsWith('/bootstrap')) return json(route, taxonomy);
      if (url.pathname === '/api/v1/foundation/topics') {
        if (request.method() === 'POST') {
          const body = request.postDataJSON() as typeof parent;
          writes.push({ body, csrf: request.headers()['x-csrf-token'] });
          const topic = { ...body, id: 'topic-child', revision: 1 };
          topics.push(topic);
          return json(route, { topic }, 201);
        }
        // The workspace knows this parent, but the editor's first 50 results may not include it.
        const outsidePickerPage = width === 820 && url.searchParams.get('limit') === '50';
        return json(route, { items: outsidePickerPage ? [] : topics, hasMore: outsidePickerPage, page: 1, limit: outsidePickerPage ? 50 : 100 });
      }
      if (request.method() === 'GET') return json(route, { items: [], hasMore: false });
      return json(route, { error: 'Unexpected synthetic mutation' }, 403);
    });
    await page.route((url) => !['127.0.0.1', 'localhost'].includes(url.hostname), (route) => route.abort());
    const route = '/admin-dashboard/taxonomy?path=path-a&subject=subject-a&subjectTab=foundation';
    await page.goto(route);
    await page.getByRole('button', { name: '+ موضوع فرعي', exact: true }).click();
    await expect(page.getByRole('heading', { name: 'إضافة موضوع تأسيس', exact: true })).toBeVisible();
    const parentSelect = page.getByPlaceholder('ابحث عن موضوع أب...').locator('..').locator('select');
    await expect(parentSelect).toHaveValue(parent.id);
    await expect(parentSelect.locator('option:checked')).toHaveText(parent.title);
    await page.getByLabel('الكود الثابت *', { exact: true }).fill('LINEAR');
    await page.getByLabel('العنوان *', { exact: true }).fill('المعادلات الخطية');
    await page.getByRole('checkbox', { name: 'حل المعادلات', exact: true }).check();
    await page.getByRole('button', { name: 'حفظ الموضوع', exact: true }).click();
    await expect(page.getByRole('heading', { name: 'إضافة موضوع تأسيس', exact: true })).toHaveCount(0);
    expect(writes).toHaveLength(1);
    expect(writes[0].csrf).toBe('csrf-subtopic');
    expect(writes[0].body).toMatchObject({ parentTopicId: parent.id, pathId: path.id, subjectId: subject.id, code: 'LINEAR', title: 'المعادلات الخطية', skillIds: ['skill-a'] });
    await page.reload();
    await expect(page.getByText('المعادلات الخطية', { exact: true })).toBeVisible();
    expect(topics.find((topic) => topic.id === 'topic-child')?.parentTopicId).toBe(parent.id);
    if (width === 820) {
      await page.getByRole('button', { name: '+ موضوع فرعي', exact: true }).click();
      await expect(parentSelect).toHaveValue(parent.id);
      await page.getByRole('combobox', { name: 'المادة *', exact: true }).selectOption('');
      await expect(parentSelect).toHaveValue('');
      await expect(parentSelect.locator(`option[value="${parent.id}"]`)).toHaveCount(0);
      await page.getByRole('combobox', { name: 'المادة *', exact: true }).selectOption(subject.id);
      await expect(parentSelect).toHaveValue('');
      await expect(parentSelect.locator('option:checked')).toHaveText('بدون أب');
      expect(writes).toHaveLength(1);
    }
  });
}
