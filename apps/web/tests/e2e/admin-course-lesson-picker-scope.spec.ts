import { expect, test, type Page, type Route } from '@playwright/test';

const admin = {
  id: 'admin-1', email: 'admin@example.com', name: 'مدير المنصة',
  status: 'active', avatarUrl: '', emailVerified: true, role: 'admin', roles: ['admin'],
};
const path = { id: 'path-1', code: 'QDR', name: 'القدرات', description: '', sortOrder: 1, status: 'active' };
const subject = { id: 'subject-1', pathId: 'path-1', code: 'QNT', name: 'الكمي', sortOrder: 1, status: 'active' };
const skill = { id: 'skill-1', subjectId: 'subject-1', code: 'NUM', name: 'الأعداد', description: '', kind: 'main', sortOrder: 1, status: 'active' };
const initialCourse = {
  id: 'course-1', pathId: path.id, subjectId: subject.id, title: 'دورة الكمي',
  description: 'وصف أصلي', instructorName: 'فريق المنصة', durationMinutes: 60,
  level: 'beginner', ownerType: 'platform', ownerUserId: '', ownerSchoolId: '',
  assignedTeacherId: '', workflowStatus: 'draft', isVisible: false,
  isPublished: false, dripContentEnabled: false, certificateEnabled: false,
  thumbnailAssetId: '', presentation: {}, skillIds: [skill.id], revision: 3,
  updatedAt: '2026-10-29T10:00:00Z',
};
const lesson = (id: string, title: string) => ({
  id, pathId: path.id, subjectId: subject.id, title, type: 'video',
  durationSeconds: 300, ownerType: 'platform', workflowStatus: 'draft',
  isVisible: true, isLocked: false, revision: 1,
  updatedAt: '2026-10-29T10:00:00Z',
});
function json(route: Route, body: unknown, status = 200) {
  return route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) });
}

async function setup(page: Page) {
  let course = { ...initialCourse };
  let patchAttempts = 0;
  const payloads: unknown[] = [];
  const lessonSearches: string[] = [];
  await page.route('**/api/v1/auth/me', (route) => json(route, { user: admin }));
  await page.route('**/api/v1/auth/csrf', (route) => json(route, { csrfToken: 'csrf-course' }));
  await page.route('**/api/v1/taxonomy/bootstrap**', (route) => json(route, {
    paths: [path], subjects: [subject], levels: [], skills: [skill],
  }));
  await page.route('**/api/v1/courses**', (route) => {
    const pathname = new URL(route.request().url()).pathname;
    if (pathname === '/api/v1/courses' && route.request().method() === 'GET') {
      return json(route, { items: [course], page: 1, limit: 50, hasMore: false });
    }
    if (pathname === '/api/v1/courses/course-1/modules') {
      return json(route, { modules: [{
        id: 'module-1', courseId: course.id, title: 'القسم الأول',
        description: '', sortOrder: 1, status: 'active', lessons: [],
      }] });
    }
    if (pathname === '/api/v1/courses/course-1' && route.request().method() === 'PUT') {
      patchAttempts += 1;
      payloads.push(route.request().postDataJSON());
      if (patchAttempts === 1) return json(route, { message: 'تعذر حفظ التعديل' }, 503);
      const input = route.request().postDataJSON() as Partial<typeof course>;
      course = { ...course, ...input, revision: course.revision + 1 };
      return json(route, { course });
    }
    if (pathname === '/api/v1/courses/course-1') return json(route, { course });
    return json(route, { message: 'unexpected route' }, 404);
  });
  await page.route('**/api/v1/lessons**', (route) => {
    const url = new URL(route.request().url());
    if (url.pathname !== '/api/v1/lessons') return json(route, { message: 'not found' }, 404);
    const search = url.searchParams.get('search') || '';
    lessonSearches.push(search);
    if (search.includes('فشل')) return json(route, { message: 'تعذر تحميل دروس المادة.' }, 503);
    return json(route, {
      items: search ? [lesson('lesson-b', 'درس ب')] : [lesson('lesson-a', 'درس أ')],
      page: 1, limit: 50, hasMore: false,
    });
  });
  return { get payloads() { return payloads; }, get patchAttempts() { return patchAttempts; }, get lessonSearches() { return lessonSearches; } };
}

for (const width of [390, 820, 1440]) {
  test(`course lesson picker drops stale choices on failed search and recovers at ${width}px RTL`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    const state = await setup(page);
    await page.goto('/admin-dashboard/content');
    await page.getByRole('button', { name: 'تعديل / المنهج' }).click();
    await expect(page.getByRole('heading', { name: 'تعديل الدورة (Master Builder)' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'المناهج الدراسية' })).toBeVisible();
    await expect(page.getByText('Revision 3')).toHaveCount(0);
    const picker = page.locator('select:has(option[value="lesson-a"])');
    await expect(picker).toBeVisible();
    await picker.selectOption('lesson-a');
    await page.getByPlaceholder('اسم درس...').fill('فشل');
    await expect(page.getByText('تعذر تحميل دروس المادة.')).toBeVisible();
    await expect(page.locator('option[value="lesson-a"]')).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'ربط الدرس' })).toBeDisabled();
    await page.getByPlaceholder('اسم درس...').fill('درس ب');
    await expect(page.locator('option[value="lesson-b"]')).toHaveCount(1);
    await expect(page.locator('option[value="lesson-a"]')).toHaveCount(0);
    expect(state.lessonSearches.some((term) => term.includes('فشل'))).toBeTruthy();
    await page.screenshot({ path: `test-results/admin-course-lesson-search-${width}.png`, fullPage: true });
  });
}

test('failed course settings save keeps draft and skill links; retry persists on reload', async ({ page }) => {
  const state = await setup(page);
  await page.goto('/admin-dashboard/content');
  await page.getByRole('button', { name: 'تعديل / المنهج' }).click();
  await page.getByRole('button', { name: 'إعدادات الدورة' }).click();
  await page.getByLabel('اسم الدورة *').fill('دورة الكمي المعدلة');
  await page.getByRole('button', { name: 'حفظ الدورة' }).click();
  await expect(page.getByText('تعذر حفظ التعديل')).toBeVisible();
  await expect(page.getByLabel('اسم الدورة *')).toHaveValue('دورة الكمي المعدلة');
  await page.getByRole('button', { name: 'حفظ الدورة' }).click();
  await expect(page.getByText('تم حفظ إعدادات الدورة.')).toBeVisible();
  expect(state.patchAttempts).toBe(2);
  for (const input of state.payloads) {
    expect(input).toMatchObject({ skillIds: ['skill-1'], pathId: 'path-1', subjectId: 'subject-1' });
  }
  await page.reload();
  await page.getByRole('button', { name: 'تعديل / المنهج' }).click();
  await page.getByRole('button', { name: 'إعدادات الدورة' }).click();
  await expect(page.getByLabel('اسم الدورة *')).toHaveValue('دورة الكمي المعدلة');
});
