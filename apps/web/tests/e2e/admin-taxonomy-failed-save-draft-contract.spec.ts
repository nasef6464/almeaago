import { expect, test, type Page, type Route } from '@playwright/test';

// Contract-only RED tests: the owning PR #160 must fix the admin page.
// This file intentionally does not modify TaxonomyAdminPage or its owner branch.
const admin = {
  id: 'admin-draft-contract', email: 'admin@example.com', name: 'مدير المنصة',
  status: 'active', avatarUrl: '', emailVerified: true,
  role: 'admin', roles: ['admin'],
};

function respond(route: Route, body: unknown, status = 200) {
  return route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) });
}

function seed() {
  return {
    paths: [{ id: 'path-1', code: 'QDR', name: 'القدرات', parentPathId: '', description: 'المسار الأساسي', sortOrder: 1, status: 'active' }],
    levels: [{ id: 'level-1', pathId: 'path-1', code: 'L1', name: 'المرحلة الأولى', sortOrder: 1, status: 'active' }],
    subjects: [{ id: 'subject-1', pathId: 'path-1', levelId: 'level-1', code: 'QNT', name: 'الكمي', sortOrder: 1, status: 'active' }],
    skills: [],
  };
}

async function setup(page: Page, data: ReturnType<typeof seed>) {
  await page.route('**/api/v1/auth/me', route => respond(route, { user: admin }));
  await page.route('**/api/v1/auth/csrf', route => respond(route, { csrfToken: 'csrf-draft-contract' }));
  await page.route('**/api/v1/taxonomy/admin/bootstrap', route => respond(route, data));
  await page.goto('/admin-dashboard/taxonomy');
  await expect(page.getByLabel('كود المسار الجديد')).toBeVisible();
}

const temporaryFailure = { message: 'تعذر الحفظ مؤقتًا' };

for (const width of [390, 820, 1440]) {
  test(`admin path create retains draft on HTTP 503, then saves on explicit retry — RTL ${width}`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    const data = seed();
    await setup(page, data);
    let writes = 0;
    await page.route('**/api/v1/taxonomy/admin/paths', route => {
      writes++;
      if (writes === 1) return respond(route, temporaryFailure, 503);
      const body = route.request().postDataJSON() as { code: string; name: string; parentPathId: string; description: string; sortOrder: number };
      data.paths.push({ id: 'path-new', ...body, status: 'active' });
      return respond(route, { path: { id: 'path-new' } }, 201);
    });

    await page.getByLabel('كود المسار الجديد').fill('SAT');
    await page.getByLabel('اسم المسار الجديد').fill('التحصيلي');
    await page.getByLabel('وصف المسار الجديد').fill('مسودة مهمة');
    await page.getByRole('button', { name: 'إنشاء المسار' }).click();
    await expect(page.getByText(temporaryFailure.message)).toBeVisible();
    await expect(page.getByLabel('كود المسار الجديد')).toHaveValue('SAT');
    await expect(page.getByLabel('اسم المسار الجديد')).toHaveValue('التحصيلي');
    await expect(page.getByLabel('وصف المسار الجديد')).toHaveValue('مسودة مهمة');
    expect(writes).toBe(1);

    await page.getByRole('button', { name: 'إنشاء المسار' }).click();
    await expect(page.getByText('تم إنشاء المسار.')).toBeVisible();
    await expect(page.getByLabel('كود المسار الجديد')).toHaveValue('');
    await expect(page.getByText('التحصيلي')).toBeVisible();
    expect(writes).toBe(2);
    await page.reload();
    await expect(page.getByText('التحصيلي')).toBeVisible();
  });

  test(`admin subject create retains code/name/level after HTTP 503 — RTL ${width}`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    const data = seed();
    await setup(page, data);
    let writes = 0;
    await page.route('**/api/v1/taxonomy/admin/subjects', route => {
      writes++;
      if (writes === 1) return respond(route, temporaryFailure, 503);
      const body = route.request().postDataJSON() as { pathId: string; levelId: string; code: string; name: string; sortOrder: number };
      data.subjects.push({ id: 'subject-new', ...body, status: 'active' });
      return respond(route, { subject: { id: 'subject-new' } }, 201);
    });

    await page.getByLabel('كود المادة الجديدة').fill('MTH');
    await page.getByLabel('اسم المادة الجديدة').fill('رياضيات');
    await page.getByLabel('مرحلة المادة الجديدة').selectOption('level-1');
    await page.getByRole('button', { name: 'إنشاء المادة' }).click();
    await expect(page.getByText(temporaryFailure.message)).toBeVisible();
    await expect(page.getByLabel('كود المادة الجديدة')).toHaveValue('MTH');
    await expect(page.getByLabel('اسم المادة الجديدة')).toHaveValue('رياضيات');
    await expect(page.getByLabel('مرحلة المادة الجديدة')).toHaveValue('level-1');
    expect(writes).toBe(1);

    await page.getByRole('button', { name: 'إنشاء المادة' }).click();
    await expect(page.getByText('تم إنشاء المادة.')).toBeVisible();
    await expect(page.getByText('رياضيات')).toBeVisible();
    expect(writes).toBe(2);
    await page.reload();
    await expect(page.getByText('رياضيات')).toBeVisible();
  });

  test(`admin path edit remains open after HTTP 503 and retries without losing text — RTL ${width}`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    const data = seed();
    await setup(page, data);
    let writes = 0;
    await page.route('**/api/v1/taxonomy/admin/paths/path-1', route => {
      writes++;
      if (writes === 1) return respond(route, temporaryFailure, 503);
      const body = route.request().postDataJSON() as { name: string; description: string };
      data.paths[0].name = body.name;
      data.paths[0].description = body.description;
      return respond(route, { path: data.paths[0] });
    });

    await page.getByRole('button', { name: 'تعديل القدرات' }).click();
    await page.getByLabel('اسم المسار المعدل').fill('قدرات مطور');
    await page.getByLabel('وصف المسار المعدل').fill('وصف محفوظ بعد الإخفاق');
    await page.getByRole('button', { name: 'حفظ', exact: true }).click();
    await expect(page.getByText(temporaryFailure.message)).toBeVisible();
    await expect(page.getByLabel('اسم المسار المعدل')).toHaveValue('قدرات مطور');
    await expect(page.getByLabel('وصف المسار المعدل')).toHaveValue('وصف محفوظ بعد الإخفاق');
    expect(writes).toBe(1);

    await page.getByRole('button', { name: 'حفظ', exact: true }).click();
    await expect(page.getByText('تم حفظ التعديل.')).toBeVisible();
    expect(writes).toBe(2);
    await page.reload();
    await expect(page.getByRole('heading', { name: 'قدرات مطور' })).toBeVisible();
  });
}
