import { expect, test, type Page, type Route } from '@playwright/test';

// Legacy CourseView unmounts a previous course when its route changes and
// shows a recoverable error rather than displaying a different course's data.
const student = {
  id: 'student-course-route', email: 'student@example.com', name: 'طالب',
  status: 'active', avatarUrl: '', emailVerified: true, role: 'student', roles: ['student'],
};
const course = {
  id: 'course-a', title: 'الدورة الأولى الخاصة', description: '', instructorName: '',
  durationMinutes: 10, level: 'beginner', thumbnailAssetId: '', dripContentEnabled: false,
  certificateEnabled: false, access: { allowed: true, configured: true, reason: 'free_product' },
  modules: [{
    id: 'module-a', title: 'الوحدة الأولى', description: '', sortOrder: 1,
    lessons: [{
      id: 'lesson-a', title: 'الدرس الأول', description: '', type: 'text',
      durationSeconds: 0, isLocked: false, isPreview: false, commerceLocked: false, sortOrder: 1,
    }],
  }],
};
function json(route: Route, body: unknown, status = 200) {
  return route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) });
}
async function setup(page: Page) {
  await page.route('**/api/v1/auth/me', route => json(route, { user: student }));
  await page.route('**/api/v1/auth/csrf', route => json(route, { csrfToken: 'csrf' }));
  await page.route('**/api/v1/learning-spaces/courses/course-a', route => json(route, { course }));
  await page.route('**/api/v1/learning-spaces/courses/course-a/lessons/lesson-a', route =>
    json(route, { lesson: {
      ...course.modules[0].lessons[0], contentText: 'محتوى الدورة الأولى السري',
      videoUrl: '', videoSource: '',
    } }),
  );
  await page.route('**/api/v1/learning-progress/lessons/lesson-a?**', route =>
    json(route, { progress: {
      lessonId: 'lesson-a', contextType: 'course', courseId: 'course-a', topicId: '',
      status: 'not_started', positionSeconds: 0, completedAt: null, updatedAt: '2026-10-30T00:00:00Z',
    } }),
  );
  await page.route('**/api/v1/learning-spaces/courses/course-b', route =>
    json(route, { message: 'تعذر تحميل الدورة الجديدة' }, 503),
  );
}

for (const width of [390, 820, 1440]) {
  test(`course route switch fails closed and browser Back restores original course at ${width}px RTL`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await setup(page);
    await page.goto('/learning/courses/course-a');
    await expect(page.getByText('محتوى الدورة الأولى السري')).toBeVisible();

    // Same mounted React Router instance, not a hard navigation/remount.
    await page.evaluate(() => {
      window.history.pushState({}, '', '/learning/courses/course-b');
      window.dispatchEvent(new PopStateEvent('popstate'));
    });

    await expect(page.getByRole('heading', { name: 'لم نتمكن من فتح الدورة' })).toBeVisible();
    await expect(page.getByText('الدورة الأولى الخاصة')).toHaveCount(0);
    await expect(page.getByText('محتوى الدورة الأولى السري')).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'تحديد كمكتمل' })).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'العودة للخلف' })).toBeVisible();
    await page.screenshot({ path: `test-results/student-course-route-error-${width}.png`, fullPage: true });

    await page.getByRole('button', { name: 'العودة للخلف' }).click();
    await expect(page).toHaveURL(/\/learning\/courses\/course-a/);
    await expect(page.getByText('محتوى الدورة الأولى السري')).toBeVisible();
    await expect(page.getByText('الدورة الأولى الخاصة').first()).toBeVisible();
    await page.reload();
    await expect(page.getByText('محتوى الدورة الأولى السري')).toBeVisible();
  });
}

test('a successful HTTP response carrying another course is rejected before rendering lessons', async ({ page }) => {
  await setup(page);
  await page.route('**/api/v1/learning-spaces/courses/course-b', route => json(route, { course }));
  await page.goto('/learning/courses/course-b');
  await expect(page.getByRole('heading', { name: 'لم نتمكن من فتح الدورة' })).toBeVisible();
  await expect(page.getByText('تعذر التحقق من سياق الدورة. أعد المحاولة.')).toBeVisible();
  await expect(page.getByText('الدورة الأولى الخاصة')).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'تحديد كمكتمل' })).toHaveCount(0);
});
