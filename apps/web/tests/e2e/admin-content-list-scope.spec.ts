import { expect, test, type Page, type Route } from '@playwright/test';

const admin = {
  id: 'admin-scope', email: 'admin@example.com', name: 'مدير المنصة',
  status: 'active', avatarUrl: '', emailVerified: true, role: 'admin', roles: ['admin'],
};

const course = {
  id: 'course-a', pathId: 'path-a', subjectId: 'subject-a', title: 'دورة المسار الأول',
  instructorName: 'فريق المنصة', durationMinutes: 60, level: 'beginner',
  ownerType: 'platform', ownerUserId: '', ownerSchoolId: '', assignedTeacherId: '',
  workflowStatus: 'draft', isVisible: true, isPublished: false, revision: 1,
  updatedAt: '2026-10-29T10:00:00Z',
};
const lesson = {
  id: 'lesson-b', pathId: 'path-b', subjectId: 'subject-b', title: 'درس المسار الثاني',
  type: 'video', durationSeconds: 300, ownerType: 'platform', ownerUserId: '',
  ownerSchoolId: '', assignedTeacherId: '', workflowStatus: 'draft',
  isVisible: true, isLocked: false, revision: 1, updatedAt: '2026-10-29T10:00:00Z',
};

function json(route: Route, body: unknown, status = 200) {
  return route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) });
}

async function setup(page: Page) {
  await page.route('**/api/v1/auth/me', route => json(route, { user: admin }));
  await page.route('**/api/v1/auth/csrf', route => json(route, { csrfToken: 'csrf-admin' }));
  await page.route('**/api/v1/taxonomy/bootstrap**', route => json(route, {
    paths: [
      { id: 'path-a', code: 'A', name: 'المسار الأول', description: '', sortOrder: 1 },
      { id: 'path-b', code: 'B', name: 'المسار الثاني', description: '', sortOrder: 2 },
    ],
    subjects: [
      { id: 'subject-a', pathId: 'path-a', code: 'A1', name: 'المادة الأولى', sortOrder: 1 },
      { id: 'subject-b', pathId: 'path-b', code: 'B1', name: 'المادة الثانية', sortOrder: 1 },
    ],
  }));
  await page.route('**/api/v1/courses?**', route => json(route, {
    items: [course], page: 1, limit: 50, hasMore: false,
  }));
}

function shownCount(page: Page) {
  return page.getByText('المعروض', { exact: true }).locator('..').locator('div').last();
}

for (const width of [390, 820, 1440]) {
  test(`admin content does not count previous tab while new scope is pending at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await setup(page);
    let requested!: () => void;
    const lessonRequested = new Promise<void>(resolve => { requested = resolve; });
    let release!: () => void;
    const gate = new Promise<void>(resolve => { release = resolve; });
    await page.route('**/api/v1/lessons?**', async route => {
      requested();
      await gate;
      await json(route, { items: [lesson], page: 1, limit: 50, hasMore: false }).catch(() => {});
    });

    await page.goto('/admin-dashboard/content');
    await expect(page.getByText(course.title)).toBeVisible();
    await expect(shownCount(page)).toHaveText('١');

    await page.getByRole('button', { name: 'الدروس', exact: true }).click();
    await lessonRequested;
    // A slow list request must not make a previous course look like a lesson.
    await expect(shownCount(page)).toHaveText('٠');
    await expect(page.getByText(course.title)).toHaveCount(0);
    release();
    await expect(page.getByText(lesson.title)).toBeVisible();
    await expect(shownCount(page)).toHaveText('١');
  });

  test(`admin content clears previous scope when the next list fails at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await setup(page);
    await page.route('**/api/v1/library?**', route => json(route, { message: 'تعذر تحميل المكتبة' }, 503));
    await page.goto('/admin-dashboard/content');
    await expect(page.getByText(course.title)).toBeVisible();

    await page.getByRole('button', { name: 'المكتبة', exact: true }).click();
    await expect(page.getByText('تعذر تحميل المكتبة')).toBeVisible();
    await expect(shownCount(page)).toHaveText('٠');
    await expect(page.getByText(course.title)).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'تعديل / المنهج' })).toHaveCount(0);
  });
}

for (const width of [390, 820, 1440]) {
  test(`admin content path change does not retain prior path counts at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await setup(page);
    await page.unroute('**/api/v1/courses?**');

    let requested!: () => void;
    const pathBRequested = new Promise<void>(resolve => { requested = resolve; });
    let release!: () => void;
    const gate = new Promise<void>(resolve => { release = resolve; });
    await page.route('**/api/v1/courses?**', async route => {
      const path = new URL(route.request().url()).searchParams.get('pathId');
      if (path === 'path-b') {
        requested();
        await gate;
        await json(route, {
          items: [{ ...course, id: 'course-b', pathId: 'path-b', subjectId: 'subject-b', title: 'دورة المسار الثاني' }],
          page: 1, limit: 50, hasMore: false,
        }).catch(() => {});
        return;
      }
      await json(route, { items: [course], page: 1, limit: 50, hasMore: false });
    });

    await page.goto('/admin-dashboard/content');
    await expect(page.getByText(course.title)).toBeVisible();
    await page.locator('select').first().selectOption('path-b');
    await pathBRequested;
    await expect(shownCount(page)).toHaveText('٠');
    await expect(page.getByText(course.title)).toHaveCount(0);
    release();
    await expect(page.getByText('دورة المسار الثاني')).toBeVisible();
    await expect(page.getByText(course.title)).toHaveCount(0);
    await expect(shownCount(page)).toHaveText('١');
  });
}
