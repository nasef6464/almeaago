import { expect, test, type Page, type Route } from '@playwright/test';

const adminUser = {
  id: 'admin-1',
  email: 'admin@example.com',
  name: 'مدير المنصة',
  status: 'active',
  avatarUrl: '',
  emailVerified: true,
  role: 'admin',
  roles: ['admin'],
};

const teacherUser = {
  id: 'teacher-1',
  email: 'teacher@example.com',
  name: 'معلم المدرسة',
  status: 'active',
  avatarUrl: '',
  emailVerified: true,
  role: 'teacher',
  roles: ['teacher'],
};

const taxonomy = {
  paths: [{ id: 'path-1', code: 'QDR', name: 'القدرات', description: '', sortOrder: 1 }],
  subjects: [{ id: 'subject-1', pathId: 'path-1', code: 'QNT', name: 'الكمي', sortOrder: 1 }],
  skills: [{ id: 'skill-1', subjectId: 'subject-1', code: 'NUM', name: 'الأعداد', description: '', kind: 'main', sortOrder: 1 }],
  levels: [],
};

const courseSummary = {
  id: 'course-1',
  pathId: 'path-1',
  subjectId: 'subject-1',
  title: 'أساسيات الكمي',
  instructorName: 'فريق المنصة',
  durationMinutes: 120,
  level: 'beginner',
  ownerType: 'platform',
  ownerUserId: '',
  ownerSchoolId: '',
  assignedTeacherId: '',
  workflowStatus: 'draft',
  isVisible: false,
  isPublished: false,
  revision: 3,
  updatedAt: '2026-09-25T12:00:00Z',
};

const lessonSummary = {
  id: 'lesson-1',
  pathId: 'path-1',
  subjectId: 'subject-1',
  title: 'مدخل إلى الأعداد',
  type: 'video',
  durationSeconds: 600,
  ownerType: 'platform',
  ownerUserId: '',
  ownerSchoolId: '',
  assignedTeacherId: '',
  workflowStatus: 'draft',
  isVisible: true,
  isLocked: false,
  revision: 2,
  updatedAt: '2026-09-25T12:00:00Z',
};

const librarySummary = {
  id: 'library-1',
  pathId: 'path-1',
  subjectId: 'subject-1',
  title: 'ملخص الأعداد',
  type: 'link',
  ownerType: 'platform',
  ownerUserId: '',
  ownerSchoolId: '',
  assignedTeacherId: '',
  workflowStatus: 'draft',
  isVisible: true,
  isLocked: false,
  revision: 1,
  updatedAt: '2026-09-25T12:00:00Z',
};

const foundationSummary = {
  id: 'topic-1',
  pathId: 'path-1',
  subjectId: 'subject-1',
  parentTopicId: '',
  code: 'FOUND-NUM',
  title: 'تأسيس الأعداد',
  sortOrder: 1,
  status: 'active',
  isVisible: true,
  isLocked: false,
  revision: 1,
  updatedAt: '2026-09-25T12:00:00Z',
};

function json(route: Route, body: unknown, status = 200) {
  return route.fulfill({
    status,
    contentType: 'application/json',
    body: JSON.stringify(body),
  });
}

async function mockContentAPI(page: Page, user = adminUser) {
  await page.route('**/api/v1/auth/me', (route) => json(route, { user }));
  await page.route('**/api/v1/auth/csrf', (route) => json(route, { csrfToken: 'csrf-test' }));

  await page.route('**/api/v1/taxonomy/bootstrap**', (route) => {
    const url = new URL(route.request().url());
    return json(route, url.searchParams.get('phase') === 'core'
      ? { paths: taxonomy.paths, subjects: taxonomy.subjects }
      : taxonomy);
  });

  await page.route('**/api/v1/courses**', (route) => {
    const url = new URL(route.request().url());
    const path = url.pathname;
    if (route.request().method() === 'GET' && path === '/api/v1/courses') {
      return json(route, { items: [courseSummary], page: 1, limit: 50, hasMore: false });
    }
    if (route.request().method() === 'GET' && path === '/api/v1/courses/course-1') {
      return json(route, {
        course: {
          ...courseSummary,
          description: 'دورة تأسيسية',
          createdBy: 'admin-1',
          approvedBy: '',
          approvedAt: null,
          reviewerNotes: '',
          revenueSharePercentage: null,
          publishedBy: '',
          publishedAt: null,
          dripContentEnabled: false,
          certificateEnabled: true,
          thumbnailAssetId: '',
          presentation: {},
          skillIds: ['skill-1'],
          createdAt: '2026-09-25T10:00:00Z',
        },
      });
    }
    if (route.request().method() === 'GET' && path === '/api/v1/courses/course-1/modules') {
      return json(route, {
        modules: [{
          id: 'module-1',
          courseId: 'course-1',
          title: 'الوحدة الأولى',
          description: '',
          sortOrder: 1,
          status: 'active',
          lessons: [{ lessonId: 'lesson-1', sortOrder: 1, isPreview: true }],
          createdAt: '2026-09-25T10:00:00Z',
          updatedAt: '2026-09-25T10:00:00Z',
        }],
      });
    }
    return json(route, { course: courseSummary });
  });

  await page.route('**/api/v1/lessons**', (route) => {
    const url = new URL(route.request().url());
    if (route.request().method() === 'GET' && url.pathname === '/api/v1/lessons') {
      return json(route, { items: [lessonSummary], page: 1, limit: 50, hasMore: false });
    }
    if (route.request().method() === 'GET' && url.pathname === '/api/v1/lessons/lesson-1') {
      return json(route, {
        lesson: {
          ...lessonSummary,
          description: 'درس فيديو',
          contentText: '',
          videoUrl: 'https://example.com/video',
          videoSource: 'youtube',
          meetingUrl: '',
          meetingAt: null,
          recordingUrl: '',
          joinInstructions: '',
          showRecording: false,
          createdBy: 'admin-1',
          approvedBy: '',
          approvedAt: null,
          reviewerNotes: '',
          revenueSharePercentage: null,
          skillIds: ['skill-1'],
          assetIds: [],
          createdAt: '2026-09-25T10:00:00Z',
        },
      });
    }
    return json(route, { lesson: lessonSummary });
  });

  await page.route('**/api/v1/library**', (route) => {
    const url = new URL(route.request().url());
    if (route.request().method() === 'GET' && url.pathname === '/api/v1/library') {
      return json(route, { items: [librarySummary], page: 1, limit: 50, hasMore: false });
    }
    return json(route, { item: { ...librarySummary, description: '', externalUrl: 'https://example.com', createdBy: 'admin-1', approvedBy: '', approvedAt: null, reviewerNotes: '', revenueSharePercentage: null, skillIds: ['skill-1'], primaryAssetId: '', createdAt: '2026-09-25T10:00:00Z' } });
  });

  await page.route('**/api/v1/foundation/topics**', (route) => {
    const url = new URL(route.request().url());
    if (route.request().method() === 'GET' && url.pathname === '/api/v1/foundation/topics') {
      return json(route, { items: [foundationSummary], page: 1, limit: 50, hasMore: false });
    }
    if (route.request().method() === 'GET' && url.pathname === '/api/v1/foundation/topics/topic-1/placements') {
      return json(route, { placements: { lessons: [{ lessonId: 'lesson-1', sortOrder: 1 }], libraryItems: [{ libraryItemId: 'library-1', sortOrder: 1 }] } });
    }
    return json(route, { topic: { ...foundationSummary, description: '', createdBy: 'admin-1', skillIds: ['skill-1'], createdAt: '2026-09-25T10:00:00Z' } });
  });
}

test('admin content desktop renders bounded management and curriculum builder', async ({ page }) => {
  await mockContentAPI(page);
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto('/admin-dashboard/content');

  await expect(page.getByRole('heading', { name: 'إدارة المحتوى التعليمي' })).toBeVisible();
  await expect(page.getByText('أساسيات الكمي')).toBeVisible();
  await expect(page.getByRole('button', { name: 'الدورات' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'التأسيس' })).toBeVisible();

  await page.getByRole('button', { name: 'تعديل / المنهج' }).click();
  await expect(page.getByRole('heading', { name: 'أساسيات الكمي' })).toBeVisible();
  await expect(page.locator('input[value="الوحدة الأولى"]')).toBeVisible();
  await expect(page.getByText('مدخل إلى الأعداد')).toBeVisible();

  await page.screenshot({ path: 'test-results/content-desktop.png', fullPage: true });
});

test('admin content mobile keeps core actions reachable', async ({ page }) => {
  await mockContentAPI(page);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/admin-dashboard/content');

  await expect(page.getByRole('heading', { name: 'إدارة المحتوى التعليمي' })).toBeVisible();
  await page.getByRole('button', { name: 'الدروس' }).click();
  await expect(page.getByText('مدخل إلى الأعداد')).toBeVisible();
  await page.getByRole('button', { name: 'إضافة درس جديد' }).click();
  await expect(page.getByRole('heading', { name: 'إضافة درس جديد' })).toBeVisible();

  await page.screenshot({ path: 'test-results/content-mobile.png', fullPage: true });
});

test('teacher does not issue a broad content list before exact scope selection', async ({ page }) => {
  let courseListRequests = 0;
  await mockContentAPI(page, teacherUser);
  await page.route('**/api/v1/courses**', (route) => {
    const url = new URL(route.request().url());
    if (route.request().method() === 'GET' && url.pathname === '/api/v1/courses') {
      courseListRequests += 1;
      return json(route, { items: [courseSummary], page: 1, limit: 50, hasMore: false });
    }
    return json(route, { course: courseSummary });
  });

  await page.goto('/admin-dashboard/content');
  await expect(page.getByText(/اختر المسار ثم المادة/)).toBeVisible();
  expect(courseListRequests).toBe(0);

  await page.locator('select').nth(0).selectOption('path-1');
  await page.locator('select').nth(1).selectOption('subject-1');
  await expect(page.getByText('أساسيات الكمي')).toBeVisible();
  expect(courseListRequests).toBe(1);
});


test('admin Foundation editor resolves relational lesson and library placements', async ({ page }) => {
  await mockContentAPI(page);
  await page.goto('/admin-dashboard/content');

  await page.getByRole('button', { name: 'التأسيس' }).click();
  await expect(page.getByText('تأسيس الأعداد')).toBeVisible();
  await page.getByRole('button', { name: 'تعديل / روابط' }).click();

  await expect(page.getByRole('heading', { name: 'تعديل موضوع التأسيس' })).toBeVisible();
  await expect(page.getByText('روابط التأسيس')).toBeVisible();
  await expect(page.getByText('مدخل إلى الأعداد')).toBeVisible();
  await expect(page.getByText('ملخص الأعداد')).toBeVisible();
});
