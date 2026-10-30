import { expect, test, type Page, type Route } from '@playwright/test';

// Regression: the detail GET can finish before the full taxonomy GET.
// A missing taxonomy response must not erase the persisted skill links.
const admin = {
  id: 'admin-1',
  email: 'admin@example.com',
  name: 'مدير المنصة',
  status: 'active',
  avatarUrl: '',
  emailVerified: true,
  role: 'admin',
  roles: ['admin'],
};

const path = { id: 'path-1', code: 'QDR', name: 'القدرات', description: '', sortOrder: 1 };
const subject = { id: 'subject-1', pathId: 'path-1', code: 'QNT', name: 'الكمي', sortOrder: 1 };
const skill = { id: 'skill-1', subjectId: 'subject-1', code: 'NUM', name: 'الأعداد', description: '', kind: 'main', sortOrder: 1 };
const libraryRow = {
  id: 'library-1', pathId: path.id, subjectId: subject.id, title: 'ملخص الأعداد',
  type: 'link', ownerType: 'platform', ownerUserId: '', ownerSchoolId: '',
  assignedTeacherId: '', workflowStatus: 'draft', isVisible: true, isLocked: false,
  revision: 1, updatedAt: '2026-09-25T12:00:00Z',
};
const topicRow = {
  id: 'topic-1', pathId: path.id, subjectId: subject.id, parentTopicId: '',
  code: 'FOUND-NUM', title: 'تأسيس الأعداد', sortOrder: 1, status: 'active',
  isVisible: true, isLocked: false, revision: 1, updatedAt: '2026-09-25T12:00:00Z',
};

function json(route: Route, body: unknown, status = 200) {
  return route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) });
}

async function setup(page: Page) {
  let releaseTaxonomy!: () => void;
  const taxonomyGate = new Promise<void>((resolve) => { releaseTaxonomy = resolve; });
  await page.route('**/api/v1/auth/me', (route) => json(route, { user: admin }));
  await page.route('**/api/v1/auth/csrf', (route) => json(route, { csrfToken: 'csrf-test' }));
  await page.route('**/api/v1/taxonomy/bootstrap**', async (route) => {
    const phase = new URL(route.request().url()).searchParams.get('phase');
    if (phase === 'full') {
      await taxonomyGate;
      return json(route, { paths: [path], subjects: [subject], skills: [skill], levels: [] });
    }
    return json(route, { paths: [path], subjects: [subject] });
  });
  await page.route('**/api/v1/courses**', (route) =>
    json(route, { items: [], page: 1, limit: 50, hasMore: false }));
  await page.route('**/api/v1/lessons**', (route) =>
    json(route, { items: [], page: 1, limit: 50, hasMore: false }));
  return releaseTaxonomy;
}

for (const width of [390, 820, 1440]) {
  test(`library editor preserves skill links across delayed taxonomy, failed save, retry and reload (${width})`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    const releaseTaxonomy = await setup(page);
    let saved = { ...libraryRow, description: 'الوصف الأصلي', externalUrl: 'https://example.com/file', skillIds: [skill.id], primaryAssetId: '', revenueSharePercentage: null, createdBy: 'admin-1', approvedBy: '', approvedAt: null, reviewerNotes: '', createdAt: '2026-09-25T10:00:00Z' };
    let saves = 0;
    let lastSkills: string[] = [];
    await page.route('**/api/v1/library**', (route) => {
      const { pathname } = new URL(route.request().url());
      if (route.request().method() === 'GET' && pathname === '/api/v1/library') {
        return json(route, { items: [saved], page: 1, limit: 50, hasMore: false });
      }
      if (route.request().method() === 'GET' && pathname === '/api/v1/library/library-1') {
        return json(route, { item: saved });
      }
      if (route.request().method() === 'PUT' && pathname === '/api/v1/library/library-1') {
        const input = route.request().postDataJSON();
        lastSkills = input.skillIds;
        saves++;
        if (saves === 1) return json(route, { error: { message: 'تعذر الحفظ مؤقتًا' } }, 503);
        saved = { ...saved, ...input, revision: saved.revision + 1 };
        return json(route, { item: saved });
      }
      return json(route, { items: [], page: 1, limit: 50, hasMore: false });
    });

    await page.goto('/admin-dashboard/content');
    await page.getByRole('button', { name: 'المكتبة', exact: true }).click();
    await expect(page.getByText('ملخص الأعداد')).toBeVisible();
    await page.getByRole('button', { name: 'تعديل', exact: true }).click();
    await expect(page.getByRole('heading', { name: 'تعديل عنصر المكتبة' })).toBeVisible();

    // Detail has loaded while full taxonomy remains blocked.
    releaseTaxonomy();
    await expect(page.getByRole('checkbox', { name: 'الأعداد' })).toBeChecked();
    await page.getByRole('textbox', { name: 'الوصف' }).fill('وصف محفوظ بعد المحاولة الثانية');
    await page.getByRole('button', { name: 'حفظ', exact: true }).click();
    await expect(page.getByText('تعذر الحفظ مؤقتًا')).toBeVisible();
    await expect(page.getByRole('checkbox', { name: 'الأعداد' })).toBeChecked();
    await expect(page.getByRole('textbox', { name: 'الوصف' })).toHaveValue('وصف محفوظ بعد المحاولة الثانية');
    await page.getByRole('button', { name: 'حفظ', exact: true }).click();
    await expect(page.getByRole('heading', { name: 'إدارة المحتوى التعليمي' })).toBeVisible();
    expect(saves).toBe(2);
    expect(lastSkills).toEqual([skill.id]);

    await page.reload();
    await page.getByRole('button', { name: 'المكتبة', exact: true }).click();
    await page.getByRole('button', { name: 'تعديل', exact: true }).click();
    await expect(page.getByRole('checkbox', { name: 'الأعداد' })).toBeChecked();
    await expect(page.getByRole('textbox', { name: 'الوصف' })).toHaveValue('وصف محفوظ بعد المحاولة الثانية');
    await page.screenshot({ path: `test-results/admin-library-skill-hydration-${width}.png`, fullPage: true });
  });

  test(`foundation editor preserves skill links across delayed taxonomy, failed save, retry and back (${width})`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    const releaseTaxonomy = await setup(page);
    let saved = { ...topicRow, description: 'الوصف الأصلي', skillIds: [skill.id], createdBy: 'admin-1', createdAt: '2026-09-25T10:00:00Z' };
    let saves = 0;
    let lastSkills: string[] = [];
    await page.route('**/api/v1/foundation/topics**', (route) => {
      const { pathname } = new URL(route.request().url());
      if (route.request().method() === 'GET' && pathname === '/api/v1/foundation/topics') {
        return json(route, { items: [saved], page: 1, limit: 50, hasMore: false });
      }
      if (route.request().method() === 'GET' && pathname === '/api/v1/foundation/topics/topic-1/placements') {
        return json(route, { placements: { lessons: [], libraryItems: [] } });
      }
      if (route.request().method() === 'GET' && pathname === '/api/v1/foundation/topics/topic-1') {
        return json(route, { topic: saved });
      }
      if (route.request().method() === 'PUT' && pathname === '/api/v1/foundation/topics/topic-1') {
        const input = route.request().postDataJSON();
        lastSkills = input.skillIds;
        saves++;
        if (saves === 1) return json(route, { error: { message: 'فشل حفظ التأسيس مؤقتًا' } }, 503);
        saved = { ...saved, ...input, revision: saved.revision + 1 };
        return json(route, { topic: saved });
      }
      return json(route, { items: [], page: 1, limit: 50, hasMore: false });
    });
    await page.route('**/api/v1/library**', (route) =>
      json(route, { items: [], page: 1, limit: 50, hasMore: false }));

    await page.goto('/admin-dashboard/content');
    await page.getByRole('button', { name: 'التأسيس', exact: true }).click();
    await expect(page.getByText('تأسيس الأعداد')).toBeVisible();
    await page.getByRole('button', { name: 'تعديل / روابط' }).click();
    await expect(page.getByRole('heading', { name: 'تعديل موضوع التأسيس' })).toBeVisible();

    releaseTaxonomy();
    await expect(page.getByRole('checkbox', { name: 'الأعداد' })).toBeChecked();
    await page.getByRole('textbox', { name: 'الوصف' }).fill('شرح معدل لا يفقد المهارة');
    await page.getByRole('button', { name: 'حفظ الموضوع' }).click();
    await expect(page.getByText('فشل حفظ التأسيس مؤقتًا')).toBeVisible();
    await expect(page.getByRole('checkbox', { name: 'الأعداد' })).toBeChecked();
    await page.getByRole('button', { name: 'حفظ الموضوع' }).click();
    await expect(page.getByRole('heading', { name: 'إدارة المحتوى التعليمي' })).toBeVisible();
    expect(saves).toBe(2);
    expect(lastSkills).toEqual([skill.id]);

    await page.getByRole('button', { name: 'تعديل / روابط' }).click();
    await expect(page.getByRole('checkbox', { name: 'الأعداد' })).toBeChecked();
    await expect(page.getByRole('textbox', { name: 'الوصف' })).toHaveValue('شرح معدل لا يفقد المهارة');
    await page.getByRole('button', { name: 'رجوع' }).click();
    await expect(page.getByRole('heading', { name: 'إدارة المحتوى التعليمي' })).toBeVisible();
    await page.screenshot({ path: `test-results/admin-foundation-skill-hydration-${width}.png`, fullPage: true });
  });
}
