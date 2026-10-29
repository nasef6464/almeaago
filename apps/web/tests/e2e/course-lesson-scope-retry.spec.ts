import { expect, test, type Page, type Route } from '@playwright/test';

// A learner's progress and lesson body must never belong to a different selected lesson.
const student = {
  id: 'student-1', email: 'student@example.com', name: 'طالب',
  status: 'active', avatarUrl: '', emailVerified: true, role: 'student', roles: ['student'],
};
const course = {
  id: 'course-1', title: 'دورة اختبار التنقل', description: '', instructorName: '',
  durationMinutes: 20, level: 'beginner', thumbnailAssetId: '', dripContentEnabled: false,
  certificateEnabled: false, access: { allowed: true, configured: true, reason: 'free_product' },
  modules: [{
    id: 'module-1', title: 'الوحدة الأولى', description: '', sortOrder: 1,
    lessons: [
      { id: 'lesson-a', title: 'الدرس الأول', description: '', type: 'text', durationSeconds: 0, isLocked: false, isPreview: false, commerceLocked: false, sortOrder: 1 },
      { id: 'lesson-b', title: 'الدرس الثاني', description: '', type: 'text', durationSeconds: 0, isLocked: false, isPreview: false, commerceLocked: false, sortOrder: 2 },
    ],
  }],
};
const detail = (id: string) => ({
  id, title: id === 'lesson-a' ? 'الدرس الأول' : 'الدرس الثاني',
  description: '', type: 'text', durationSeconds: 0, isLocked: false,
  isPreview: false, commerceLocked: false, sortOrder: id === 'lesson-a' ? 1 : 2,
  contentText: id === 'lesson-a' ? 'نص الدرس الأول الحصري' : 'نص الدرس الثاني الحصري',
  videoUrl: '', videoSource: '',
});
const progress = (id: string, status = 'not_started', positionSeconds = 0) => ({
  lessonId: id, contextType: 'course', courseId: 'course-1', topicId: '',
  status, positionSeconds, completedAt: status === 'completed' ? '2026-10-29T00:00:00Z' : null,
  updatedAt: '2026-10-29T00:00:00Z',
});
function json(route: Route, body: unknown, status = 200) {
  return route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) });
}
async function setup(page: Page) {
  await page.route('**/api/v1/auth/me', route => json(route, { user: student }));
  await page.route('**/api/v1/auth/csrf', route => json(route, { csrfToken: 'csrf' }));
  await page.route('**/api/v1/learning-spaces/courses/course-1', route => json(route, { course }));
  await page.route('**/api/v1/learning-spaces/courses/course-1/lessons/lesson-a', route => json(route, { lesson: detail('lesson-a') }));
  await page.route('**/api/v1/learning-progress/lessons/*?**', route => {
    const id = new URL(route.request().url()).pathname.split('/').pop() || '';
    return json(route, { progress: progress(id) });
  });
}

for (const width of [390, 820, 1440]) {
  test(`course lesson switch keeps old content hidden, retries failed load and preserves selected lesson after reload at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await setup(page);
    let attempts = 0;
    await page.route('**/api/v1/learning-spaces/courses/course-1/lessons/lesson-b', async route => {
      attempts += 1;
      if (attempts === 1) {
        await new Promise(resolve => setTimeout(resolve, 200));
        return json(route, { message: 'تعذر تحميل الدرس التجريبي' }, 503);
      }
      return json(route, { lesson: detail('lesson-b') });
    });
    const completed: string[] = [];
    let persisted = false;
    await page.route('**/api/v1/learning-progress/lessons/lesson-b?**', route =>
      json(route, { progress: progress('lesson-b', persisted ? 'completed' : 'not_started') }),
    );
    await page.route('**/api/v1/learning-progress/lessons/*/complete', route => {
      completed.push(route.request().url().split('/').at(-2) || '');
      if (completed.length === 1) return json(route, { message: 'تعذر الحفظ مؤقتًا' }, 503);
      persisted = true;
      return json(route, { progress: progress('lesson-b', 'completed') });
    });

    await page.goto('/learning/courses/course-1');
    await expect(page.getByText('نص الدرس الأول الحصري')).toBeVisible();
    await page.getByRole('button', { name: /الدرس الثاني/ }).click();
    await expect(page.getByRole('heading', { name: 'الدرس الثاني' })).toBeVisible();
    await expect(page.getByText('نص الدرس الأول الحصري')).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'تحديد كمكتمل' })).toHaveCount(0);
    await expect(page.getByText('تعذر تحميل الدرس التجريبي')).toBeVisible();
    await page.getByRole('button', { name: 'إعادة محاولة تحميل الدرس' }).click();
    await expect(page.getByText('نص الدرس الثاني الحصري')).toBeVisible();
    await expect(page.getByRole('button', { name: 'تحديد كمكتمل' })).toBeEnabled();
    await page.getByRole('button', { name: 'تحديد كمكتمل' }).click();
    await expect(page.getByText('تعذر الحفظ مؤقتًا')).toBeVisible();
    await expect(page.getByRole('button', { name: 'تحديد كمكتمل' })).toBeEnabled();
    await expect(page.getByText('نص الدرس الثاني الحصري')).toBeVisible();
    await page.getByRole('button', { name: 'تحديد كمكتمل' }).click();
    await expect(page.getByText('تم تسجيل الدرس كمكتمل.')).toBeVisible();
    expect(completed).toEqual(['lesson-b', 'lesson-b']);
    await expect(page).toHaveURL(/lesson=lesson-b/);
    await page.screenshot({ path: `test-results/course-lesson-scope-${width}.png`, fullPage: true });
    await page.reload();
    await expect(page.getByText('نص الدرس الثاني الحصري')).toBeVisible();
    await expect(page.getByText('نص الدرس الأول الحصري')).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'تحديد كمكتمل' })).toBeDisabled();
  });
}

test('late video save from the previous lesson cannot replace the newly selected lesson progress', async ({ page }) => {
  await setup(page);
  const video = { ...detail('lesson-a'), type: 'video', durationSeconds: 120, videoUrl: '/media/test.mp4', videoSource: 'upload' };
  await page.route('**/api/v1/learning-spaces/courses/course-1/lessons/lesson-a', route => json(route, { lesson: video }));
  await page.route('**/media/test.mp4', route => route.fulfill({ status: 200, headers: { 'Content-Type': 'video/mp4' }, body: '' }));
  let releaseSave: (() => void) | undefined;
  await page.route('**/api/v1/learning-progress/lessons/lesson-a/video', async route => {
    await new Promise<void>(resolve => { releaseSave = resolve; });
    return json(route, { progress: progress('lesson-a', 'in_progress', 42) });
  });
  await page.route('**/api/v1/learning-spaces/courses/course-1/lessons/lesson-b', route => json(route, { lesson: detail('lesson-b') }));
  await page.goto('/learning/courses/course-1');
  const player = page.getByTestId('lesson-video');
  await expect(player).toBeVisible();
  await player.evaluate(node => {
    Object.defineProperty(node, 'currentTime', { configurable: true, writable: true, value: 42 });
    node.dispatchEvent(new Event('pause'));
  });
  await expect.poll(() => Boolean(releaseSave)).toBe(true);
  await page.getByRole('button', { name: /الدرس الثاني/ }).click();
  await expect(page.getByText('نص الدرس الثاني الحصري')).toBeVisible();
  releaseSave?.();
  await expect(page.getByRole('button', { name: 'تحديد كمكتمل' })).toBeEnabled();
  await expect(page.getByText(/آخر موضع 42 ثانية/)).toHaveCount(0);
  await expect(page.getByText('نص الدرس الأول الحصري')).toHaveCount(0);
});
