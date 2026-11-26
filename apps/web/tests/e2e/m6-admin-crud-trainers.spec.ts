import { expect, test, type Page, type Route } from '@playwright/test';

const adminUser = {
  id: 'admin-m6',
  email: 'admin@example.com',
  name: 'مدير المنصة',
  role: 'admin',
  roles: ['admin'],
  status: 'active',
  emailVerified: true,
};

const trainerUser = {
  id: 'trainer-m6',
  email: 'trainer@example.com',
  name: 'مدرب المنصة',
  role: 'teacher',
  roles: ['teacher'],
  status: 'active',
  emailVerified: true,
};

const taxonomy = {
  paths: [{ id: 'p1', code: 'QDR', name: 'القدرات', sortOrder: 0, status: 'active', description: '' }],
  levels: [],
  subjects: [{ id: 's1', pathId: 'p1', code: 'MATH', name: 'الكمي', sortOrder: 0, status: 'active' }],
  skills: [
    { id: 'm1', subjectId: 's1', code: 'ALG', name: 'الجبر', kind: 'main', sortOrder: 0, status: 'active', description: '' },
    { id: 'm2', subjectId: 's1', code: 'GEO', name: 'الهندسة', kind: 'main', sortOrder: 1, status: 'active', description: '' },
  ],
};

function json(route: Route, body: unknown, status = 200) {
  return route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) });
}

async function assertNoHorizontalOverflow(page: Page) {
  for (const width of [390, 820, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    expect(overflow, `horizontal overflow at width ${width}`).toBeLessThanOrEqual(2);
  }
  await page.setViewportSize({ width: 1440, height: 900 });
}

test('admin can single-delete and bulk-delete skills in Skills Center', async ({ page }) => {
  await page.route('**/api/v1/auth/me', (route) => json(route, { user: adminUser }));
  await page.route('**/api/v1/auth/csrf', (route) => json(route, { csrfToken: 'csrf-m6' }));
  let currentSkills = [...taxonomy.skills];
  await page.route('**/api/v1/taxonomy/admin/bootstrap', (route) => json(route, { ...taxonomy, skills: currentSkills }));

  await page.route('**/api/v1/taxonomy/admin/skills/*', async (route) => {
    if (route.request().method() === 'DELETE') {
      const id = route.request().url().split('/').pop()!;
      currentSkills = currentSkills.filter((s) => s.id !== id);
      return json(route, { deleted: true });
    }
    return route.fallback();
  });

  await page.route('**/api/v1/taxonomy/admin/bulk-delete/skill', async (route) => {
    const body = route.request().postDataJSON() as { ids: string[] };
    currentSkills = currentSkills.filter((s) => !body.ids.includes(s.id));
    return json(route, { deletedIds: body.ids, blocked: [] });
  });

  await page.setViewportSize({ width: 1440, height: 900 });
  page.on('dialog', (dialog) => dialog.accept());

  await page.goto('/admin-dashboard?tab=skills');
  await expect(page.getByTestId('admin-skills-center')).toBeVisible();
  await expect(page.getByTestId('skills-counter-main')).toContainText('2');

  await page.getByRole('button', { name: 'حذف المهارة الرئيسة الجبر' }).click();
  await expect(page.getByTestId('skills-counter-main')).toContainText('1');

  await page.getByRole('checkbox', { name: 'تحديد المهارة الرئيسة الهندسة' }).check();
  await page.getByRole('button', { name: /حذف المحدد \(1\)/ }).click();
  await expect(page.getByTestId('skills-counter-main')).toContainText('0');
  await assertNoHorizontalOverflow(page);
});

test('admin can bulk-delete courses in ContentAdminPage and assessments in AssessmentAdminPage', async ({ page }) => {
  await page.route('**/api/v1/auth/me', (route) => json(route, { user: adminUser }));
  await page.route('**/api/v1/auth/csrf', (route) => json(route, { csrfToken: 'csrf-m6' }));
  await page.route('**/api/v1/taxonomy/bootstrap?phase=core', (route) => json(route, { paths: taxonomy.paths, subjects: taxonomy.subjects }));

  let courses = [
    {
      id: 'c1', pathId: 'p1', subjectId: 's1', title: 'دورة أولى', instructorName: 'أحمد',
      durationMinutes: 60, level: 'beginner', ownerType: 'platform', ownerUserId: '',
      ownerSchoolId: '', assignedTeacherId: '', workflowStatus: 'draft', isVisible: true,
      isPublished: false, revision: 1, updatedAt: '2026-11-26T00:00:00Z',
    },
  ];
  await page.route('**/api/v1/courses?**', (route) => json(route, { items: courses, page: 1, limit: 50, hasMore: false }));
  await page.route('**/api/v1/courses/bulk-delete', async (route) => {
    const body = route.request().postDataJSON() as { ids: string[] };
    courses = courses.filter((c) => !body.ids.includes(c.id));
    return json(route, { deletedIds: body.ids, blocked: [] });
  });

  let assessments = [
    {
      id: 'a1', code: 'A-1', title: 'اختبار تجريبي', pathId: 'p1', subjectId: 's1',
      kind: 'normal', normalMode: 'practice', workflowStatus: 'draft', ownerType: 'platform',
      revision: 1, currentVersion: 1, isPublished: false, updatedAt: '2026-11-26T00:00:00Z',
    },
  ];
  await page.route('**/api/v1/assessments?**', (route) => json(route, { items: assessments, page: 1, limit: 50, hasMore: false }));
  await page.route('**/api/v1/assessments/a1', async (route) => {
    if (route.request().method() === 'DELETE') {
      assessments = [];
      return json(route, { deleted: true });
    }
    return route.fallback();
  });

  await page.setViewportSize({ width: 1440, height: 900 });
  page.on('dialog', (dialog) => dialog.accept());

  await page.goto('/admin-dashboard/content');
  await expect(page.getByText('دورة أولى')).toBeVisible();
  await page.getByRole('checkbox', { name: 'تحديد دورة أولى' }).check();
  await page.getByRole('button', { name: /حذف المحدد \(1\)/ }).click();
  await expect(page.getByText('دورة أولى')).toHaveCount(0);

  await page.goto('/admin-dashboard/assessments');
  await expect(page.getByRole('heading', { name: 'اختبار تجريبي' })).toBeVisible();
  await page.getByRole('button', { name: 'حذف' }).first().click();
  await expect(page.getByRole('heading', { name: 'اختبار تجريبي' })).toHaveCount(0);
  await expect(page.getByText('تم حذف الاختبار «اختبار تجريبي» بنجاح.')).toBeVisible();
  await assertNoHorizontalOverflow(page);
});

test('trainer dashboard displays scoped permissions and management links', async ({ page }) => {
  await page.route('**/api/v1/auth/me', (route) => json(route, { user: trainerUser }));
  await page.route('**/api/v1/auth/csrf', (route) => json(route, { csrfToken: 'csrf-m6' }));
  await page.route('**/api/v1/content/trainer-scopes/me', (route) =>
    json(route, {
      scope: {
        userId: trainerUser.id,
        pathIds: ['p1'],
        subjectIds: ['s1'],
        permissions: {
          manageTaxonomy: false,
          manageSkills: true,
          manageFoundation: false,
          manageCourses: true,
          manageLessons: true,
          manageLibrary: false,
          manageQuestions: true,
          manageAssessments: true,
          canDelete: true,
          canPublish: false,
        },
      },
    }),
  );

  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('/trainer-dashboard');
  await expect(page.getByText('صلاحياتي ونطاق عملي المصرح به')).toBeVisible();
  await expect(page.getByRole('link', { name: 'إدارة المحتوى والدورات' })).toBeVisible();
  await expect(page.getByRole('link', { name: 'بنك الأسئلة' })).toBeVisible();
  await expect(page.getByRole('link', { name: 'الاختبارات' })).toBeVisible();
  await expect(page.getByRole('link', { name: 'المهارات' })).toBeVisible();
  await expect(page.getByRole('link', { name: 'المسارات والمواد' })).toHaveCount(0);
  await assertNoHorizontalOverflow(page);
});
