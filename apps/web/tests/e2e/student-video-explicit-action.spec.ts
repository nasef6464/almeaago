import { expect, test, type Page, type Route } from '@playwright/test';

// Scope: original student video is opt-in. This is a browser contract, not a
// Legacy↔Go screenshot certificate or a real PostgreSQL persistence test.
const student = {
  id: 'student-1', email: 'student@example.com', name: 'طالب',
  status: 'active', avatarUrl: '', emailVerified: true, role: 'student', roles: ['student'],
};
const course = {
  id: 'course-1', title: 'دورة اختبار الفيديو', description: '', instructorName: '',
  durationMinutes: 5, level: 'beginner', thumbnailAssetId: '', dripContentEnabled: false,
  certificateEnabled: false, access: { allowed: true, configured: true, reason: 'free_product' },
  modules: [{ id: 'module-1', title: 'الوحدة', description: '', sortOrder: 1,
    lessons: [{ id: 'lesson-1', title: 'درس الفيديو', description: '', type: 'video',
      durationSeconds: 120, isLocked: false, isPreview: false, commerceLocked: false, sortOrder: 1 }],
  }],
};
const lesson = {
  id: 'lesson-1', title: 'درس الفيديو', description: '', type: 'video', durationSeconds: 120,
  isLocked: false, isPreview: false, commerceLocked: false, sortOrder: 1,
  videoUrl: '/media/test-video.mp4', videoSource: 'upload', contentText: '',
};
function json(route: Route, body: unknown, status = 200) {
  return route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) });
}
async function setup(page: Page, writes: string[]) {
  await page.route('**/api/v1/auth/me', route => json(route, { user: student }));
  await page.route('**/api/v1/auth/csrf', route => json(route, { csrfToken: 'csrf' }));
  await page.route('**/api/v1/learning-spaces/courses/course-1', route => json(route, { course }));
  await page.route('**/api/v1/learning-spaces/courses/course-1/lessons/lesson-1', route => json(route, { lesson }));
  await page.route('**/api/v1/learning-progress/lessons/lesson-1?**', route =>
    json(route, { progress: { lessonId: 'lesson-1', contextType: 'course', courseId: 'course-1',
      topicId: '', status: 'not_started', positionSeconds: 0 } }),
  );
  await page.route('**/api/v1/learning-progress/lessons/lesson-1/video', route => {
    writes.push('video');
    return json(route, { message: 'Unexpected automatic video write' }, 500);
  });
  await page.route('**/api/v1/learning-progress/lessons/lesson-1/complete', route => {
    writes.push('complete');
    expect(route.request().headers()['x-csrf-token']).toBe('csrf');
    return json(route, { progress: { lessonId: 'lesson-1', contextType: 'course', courseId: 'course-1',
      topicId: '', status: 'completed', positionSeconds: 0 } });
  });
  await page.route('**/media/test-video.mp4', route =>
    route.fulfill({ status: 200, contentType: 'video/mp4', body: '' }),
  );
}

for (const width of [390, 820, 1440]) {
  test(`video does not autoplay or persist completion without student action at ${width}px RTL`, async ({ page }) => {
    const writes: string[] = [];
    await page.setViewportSize({ width, height: 900 });
    await setup(page, writes);
    await page.goto('/learning/courses/course-1?lesson=lesson-1');
    const player = page.getByTestId('lesson-video');
    await expect(player).toBeVisible();
    await expect(player).not.toHaveAttribute('autoplay', /.+/);
    expect(await player.evaluate((node: HTMLVideoElement) => node.paused)).toBe(true);
    await expect(page.getByRole('button', { name: 'تحديد كمكتمل' })).toBeEnabled();
    expect(writes).toEqual([]);
    await page.screenshot({ path: `test-results/student-video-explicit-action-${width}.png`, fullPage: true });
    await page.reload();
    await expect(player).toBeVisible();
    expect(await player.evaluate((node: HTMLVideoElement) => node.paused)).toBe(true);
    expect(writes).toEqual([]);
    await page.getByRole('button', { name: 'تحديد كمكتمل' }).click();
    await expect(page.getByText('تم تسجيل الدرس كمكتمل.')).toBeVisible();
    expect(writes).toEqual(['complete']);
  });
}
