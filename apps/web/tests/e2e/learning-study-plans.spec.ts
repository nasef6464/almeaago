import { expect, test, type Page, type Route } from '@playwright/test';

const student = {
  id: 'student-1',
  email: 'student@example.com',
  name: 'طالب',
  status: 'active',
  avatarUrl: '',
  emailVerified: true,
  role: 'student',
  roles: ['student'],
};

function json(route: Route, body: unknown, status = 200) {
  return route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) });
}

async function auth(page: Page) {
  await page.route('**/api/v1/auth/me', (route) => json(route, { user: student }));
  await page.route('**/api/v1/auth/csrf', (route) => json(route, { csrfToken: 'csrf-plan' }));
}

test('mobile student creates deterministic study plan and archives it with optimistic concurrency', async ({ page }) => {
  await auth(page);
  await page.setViewportSize({ width: 390, height: 844 });

  const taxonomy = {
    paths: [{ id: 'path-1', code: 'QDR', name: 'القدرات', description: '', sortOrder: 1 }],
    subjects: [{ id: 'subject-1', pathId: 'path-1', code: 'QNT', name: 'الكمي', sortOrder: 1 }],
  };
  await page.route('**/api/v1/taxonomy/bootstrap?phase=core', (route) => json(route, taxonomy));

  let plan: any = null;
  let createCalls = 0;
  let patchCalls = 0;
  let detailCalls = 0;
  let learningSpaceCalls = 0;

  await page.route('**/api/v1/learning-spaces/**', (route) => {
    learningSpaceCalls += 1;
    return json(route, {
      pathId: 'path-1',
      subjectId: 'subject-1',
      courses: { items: [{ id: 'course-1', title: 'دورة الكمي', description: '', instructorName: 'المدرب', durationMinutes: 60, level: 'beginner', thumbnailAssetId: '', dripContentEnabled: false, certificateEnabled: false }], hasMore: false },
      foundation: { items: [], hasMore: false },
      library: { items: [], hasMore: false },
    });
  });

  await page.route('**/api/v1/study-plans/plan-1', async (route) => {
    const request = route.request();
    if (request.method() === 'GET') {
      detailCalls += 1;
      return json(route, { plan });
    }
    expect(request.method()).toBe('PATCH');
    expect(request.headers()['x-csrf-token']).toBe('csrf-plan');
    const body = JSON.parse(request.postData() || '{}');
    expect(body.expectedUpdatedAt).toBe('2026-09-26T09:00:00Z');
    expect(body.status).toBe('archived');
    patchCalls += 1;
    plan = { ...plan, status: 'archived', updatedAt: '2026-09-26T09:05:00Z' };
    return json(route, { plan });
  });

  await page.route('**/api/v1/study-plans/**', async (route) => {
    const request = route.request();
    if (new URL(request.url()).pathname.endsWith('/study-plans/plan-1')) {
      return route.fallback();
    }
    if (request.method() === 'GET') {
      const url = new URL(request.url());
      expect(url.searchParams.get('pathId')).toBe('path-1');
      expect(url.searchParams.get('limit')).toBe('20');
      const visible = plan && plan.status === url.searchParams.get('status') ? [{
        id: plan.id,
        studentId: plan.studentId,
        name: plan.name,
        pathId: plan.pathId,
        startDate: plan.startDate,
        endDate: plan.endDate,
        skipCompletedQuizzes: plan.skipCompletedQuizzes,
        dailyMinutes: plan.dailyMinutes,
        preferredStartTime: plan.preferredStartTime,
        status: plan.status,
        itemCount: plan.items.length,
        createdAt: plan.createdAt,
        updatedAt: plan.updatedAt,
      }] : [];
      return json(route, { items: visible, page: 1, limit: 20, hasMore: false });
    }
    expect(request.method()).toBe('POST');
    expect(request.headers()['x-csrf-token']).toBe('csrf-plan');
    const body = JSON.parse(request.postData() || '{}');
    expect(body).toMatchObject({
      name: 'خطة الكمي',
      pathId: 'path-1',
      subjectIds: ['subject-1'],
      courseIds: ['course-1'],
      startDate: '2026-09-26',
      endDate: '2026-09-28',
      skipCompletedQuizzes: true,
      dailyMinutes: 60,
      preferredStartTime: '17:00',
      status: 'active',
    });
    createCalls += 1;
    plan = {
      id: 'plan-1',
      studentId: 'student-1',
      ...body,
      itemCount: 2,
      createdAt: '2026-09-26T09:00:00Z',
      updatedAt: '2026-09-26T09:00:00Z',
      items: [
        {
          id: 'item-lesson',
          subjectId: 'subject-1',
          itemType: 'lesson',
          lessonId: 'lesson-1',
          courseId: 'course-1',
          libraryItemId: '',
          assessmentPlacementId: '',
          scheduledDate: '2026-09-26',
          scheduledTime: '17:00',
          durationMinutes: 30,
          phase: 'foundation',
          sortOrder: 0,
          title: 'درس النسبة',
          externalUrl: '',
          completed: false,
          available: true,
          assessmentSlot: '',
        },
        {
          id: 'item-assessment',
          subjectId: 'subject-1',
          itemType: 'assessment',
          lessonId: '',
          courseId: '',
          libraryItemId: '',
          assessmentPlacementId: 'placement-1',
          scheduledDate: '2026-09-26',
          scheduledTime: '17:30',
          durationMinutes: 20,
          phase: 'practice',
          sortOrder: 1,
          title: 'تدريب النسبة',
          externalUrl: '',
          completed: false,
          available: true,
          assessmentSlot: 'tests',
        },
      ],
    };
    return json(route, { plan }, 201);
  });

  await page.goto('/plan');
  await expect(page.getByRole('heading', { name: 'خطتي الدراسية' })).toBeVisible();
  await expect(page.getByText('لا توجد خطة نشطة لهذا المسار بعد.')).toBeVisible();
  expect(learningSpaceCalls).toBe(0);

  await page.getByLabel('اسم الخطة').fill('خطة الكمي');
  await page.getByLabel('اختر مادة الكمي').check();
  expect(learningSpaceCalls).toBe(0);

  await page.getByLabel('مادة اختيار الدورات').selectOption('subject-1');
  await expect.poll(() => learningSpaceCalls).toBe(1);
  await page.getByLabel('اختر دورة دورة الكمي').check();

  await page.getByLabel('تاريخ البداية').fill('2026-09-26');
  await page.getByLabel('تاريخ النهاية').fill('2026-09-28');
  await page.getByLabel('الدقائق اليومية').fill('60');
  await page.getByLabel('وقت البدء').fill('17:00');
  await page.getByRole('button', { name: 'إنشاء الخطة' }).click();

  await expect.poll(() => createCalls).toBe(1);
  await expect(page.getByRole('heading', { name: 'خطة الكمي' })).toBeVisible();
  await page.getByRole('button', { name: 'الكل' }).click();
  await expect(page.getByText('درس النسبة')).toBeVisible();
  await expect(page.getByText('تدريب النسبة')).toBeVisible();
  await expect(page.getByText('17:00')).toBeVisible();
  await expect(page.getByText('17:30')).toBeVisible();

  // Reload after create must hydrate only the first bounded plan detail, not N details.
  await expect.poll(() => detailCalls).toBeGreaterThanOrEqual(1);
  expect(detailCalls).toBe(1);

  await page.getByRole('button', { name: 'أرشفة' }).click();
  await expect.poll(() => patchCalls).toBe(1);
  await expect(page.getByText('لا توجد خطة نشطة لهذا المسار بعد.')).toBeVisible();

  await page.screenshot({ path: 'test-results/learning-study-plan-mobile.png', fullPage: true });
});
