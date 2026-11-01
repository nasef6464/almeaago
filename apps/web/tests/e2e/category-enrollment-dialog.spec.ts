import { expect, test } from '@playwright/test';
import { mockHeaderNavigation } from './fixtures/header-navigation';

const student = { id: 'category-enrollment-student', name: 'طالب التجربة', email: 'category@example.invalid', role: 'student', roles: ['student'], status: 'active', avatarUrl: '', emailVerified: true };
const catalog = {
  paths: [
    { id: 'registered-path', name: 'مساري المسجل', isActive: true, showInHome: true, showInNavbar: true, sortOrder: 1, settings: { stageSelection: 'none' } },
    { id: 'target-path', name: 'المسار المطلوب', isActive: true, showInHome: true, showInNavbar: true, sortOrder: 2, settings: { stageSelection: 'required', stageLabel: 'اختر مرحلتك' } },
  ],
  levels: [{ id: 'target-level', pathId: 'target-path', name: 'مرحلة المسار المطلوب', sortOrder: 1 }],
  subjects: [],
};

for (const width of [390, 820, 1440]) {
  test(`restricted category opens one enrollment dialog and retains failed draft before persistent retry at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 1000 });
    await page.route(url => url.origin !== 'http://127.0.0.1:4173', route => route.abort('blockedbyclient'));
    await page.route(url => url.pathname.startsWith('/api/'), route => {
      const path = new URL(route.request().url()).pathname;
      if (path === '/api/v1/auth/me') return route.fulfill({ json: { user: student } });
      if (path === '/api/v1/auth/csrf') return route.fulfill({ json: { csrfToken: 'category-enrollment-csrf' } });
      if (path === '/api/v1/content/homepage-settings') return route.fulfill({ json: { studentExperience: { visibilityMode: 'enrolled', promptEnrollment: true } } });
      if (path === '/api/v1/content/platform-font-settings') return route.fulfill({ json: {} });
      if (route.request().method() !== 'GET') return route.fulfill({ status: 403, json: { message: 'Unexpected synthetic mutation' } });
      return route.fulfill({ json: { items: [], ads: [], announcements: [], unreadCount: 0, hasMore: false } });
    });
    const fixture = await mockHeaderNavigation(page, {
      actor: () => student,
      catalog,
      saved: { [student.id]: { enrolledPaths: ['registered-path'], pathStageSelections: [] } },
    });
    const writes: Array<{ body: unknown; csrf: string }> = [];
    page.on('request', request => {
      if (new URL(request.url()).pathname === '/api/v1/learning/navigation-preferences' && request.method() === 'PATCH') {
        writes.push({ body: request.postDataJSON(), csrf: request.headers()['x-csrf-token'] });
      }
    });

    await page.goto('/category/target-path');
    const prompt = page.getByRole('heading', { name: 'هذا المحتوى خارج مسارك أو مرحلتك الحالية', exact: true });
    await expect(prompt).toBeVisible();
    await page.getByRole('button', { name: 'اختيار المسار أو المرحلة: المسار المطلوب', exact: true }).click();
    const dialog = page.getByRole('dialog', { name: 'اختر مسارك التعليمي', exact: true });
    await expect(dialog).toHaveCount(1);
    await expect(dialog).toBeVisible();
    await expect(page.getByRole('dialog')).toHaveCount(1);
    await expect(dialog.getByLabel('المسار التعليمي', { exact: true })).toHaveValue('target-path');
    await dialog.getByLabel('اختر مرحلتك', { exact: true }).selectOption('target-level');
    fixture.failNextSave('تعذر حفظ التسجيل التجريبي');
    await dialog.getByRole('button', { name: 'تأكيد التسجيل', exact: true }).click();
    await expect(dialog.getByRole('alert')).toHaveText('تعذر حفظ التسجيل التجريبي');
    await expect(dialog.getByLabel('المسار التعليمي', { exact: true })).toHaveValue('target-path');
    await expect(dialog.getByLabel('اختر مرحلتك', { exact: true })).toHaveValue('target-level');
    expect(fixture.records.get(student.id)).toEqual({ enrolledPaths: ['registered-path'], pathStageSelections: [] });
    expect(writes).toHaveLength(1);

    await dialog.getByRole('button', { name: 'تأكيد التسجيل', exact: true }).click();
    await expect(dialog).toHaveCount(0);
    await expect(prompt).toHaveCount(0);
    const expected = { enrolledPaths: ['registered-path', 'target-path'], pathStageSelections: [{ pathId: 'target-path', levelId: 'target-level' }] };
    expect(fixture.records.get(student.id)).toEqual(expected);
    expect(writes).toEqual([{ body: expected, csrf: 'category-enrollment-csrf' }, { body: expected, csrf: 'category-enrollment-csrf' }]);
    await expect(page.getByLabel('مساري الحالي', { exact: true })).toHaveValue('target-path');
    await expect(page).toHaveURL(/\/category\/target-path$/);
    await page.reload();
    await expect(prompt).toHaveCount(0);
    await expect(page.getByLabel('مساري الحالي', { exact: true })).toHaveValue('target-path');
    await expect(page.getByRole('dialog')).toHaveCount(0);
    expect(writes).toHaveLength(2);
  });
}
