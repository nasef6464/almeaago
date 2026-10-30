import { expect, test, type Page, type Route } from '@playwright/test';

// Student learning API transport contract only. No UI or shared owner files changed.
// A failed HTTP save must retain its input, preserve the backend error message,
// and remain retryable without inventing a success state.
async function boot(page: Page, width: number) {
  await page.setViewportSize({ width, height: 900 });
  await page.route('**/api/v1/auth/me', (route) =>
    route.fulfill({ status: 401, contentType: 'application/json', body: '{"message":"Authentication required"}' }),
  );
  await page.goto('/login');
}

for (const width of [390, 820, 1440]) {
  test(`review read surfaces nested HTTP 503 message at ${width}px RTL`, async ({ page }) => {
    await boot(page, width);
    await page.route('**/api/v1/review/library?**', (route) =>
      route.fulfill({
        status: 503,
        contentType: 'application/json',
        body: JSON.stringify({ error: { message: 'تعذر تحميل المراجعة مؤقتًا' } }),
      }),
    );
    const message = await page.evaluate(async () => {
      const modulePath = '/src/features/learning/api/learning-client.ts';
      const { learningClient } = await import(/* @vite-ignore */ modulePath);
      try {
        await learningClient.reviewLibrary('saved', 'path-1', 'subject-1');
        return 'UNEXPECTED_SUCCESS';
      } catch (error) {
        return error instanceof Error ? error.message : String(error);
      }
    });
    expect(message).toBe('تعذر تحميل المراجعة مؤقتًا');
  });

  test(`study plan failed save with JSON null retains draft and retries at ${width}px RTL`, async ({ page }) => {
    await boot(page, width);
    let calls = 0;
    const payloads: unknown[] = [];
    await page.route('**/api/v1/study-plans/', async (route: Route) => {
      calls += 1;
      payloads.push(JSON.parse(route.request().postData() || '{}'));
      expect(route.request().headers()['x-csrf-token']).toBe('csrf-123');
      if (calls === 1) {
        return route.fulfill({ status: 503, contentType: 'application/json', body: 'null' });
      }
      return route.fulfill({ status: 201, contentType: 'application/json', body: JSON.stringify({ plan: { id: 'plan-1' } }) });
    });
    const result = await page.evaluate(async () => {
      const modulePath = '/src/features/learning/api/learning-client.ts';
      const { studyPlanClient } = await import(/* @vite-ignore */ modulePath);
      const draft = {
        name: 'خطة النسب', pathId: 'path-1', subjectIds: ['subject-1'], courseIds: [],
        startDate: '2026-11-01', endDate: '2026-11-14', skipCompletedQuizzes: true,
        offDays: [], dailyMinutes: 60, preferredStartTime: '17:00', status: 'active',
      };
      let failure = '';
      try {
        await studyPlanClient.create(draft, 'csrf-123');
      } catch (error) {
        failure = error instanceof Error ? error.message : String(error);
      }
      const success = await studyPlanClient.create(draft, 'csrf-123');
      return { failure, id: success.plan.id };
    });
    expect(result).toEqual({ failure: 'تعذر تنفيذ الطلب', id: 'plan-1' });
    expect(calls).toBe(2);
    expect(payloads[0]).toEqual(payloads[1]);
  });

  test(`lesson progress preserves top-level HTTP conflict message at ${width}px RTL`, async ({ page }) => {
    await boot(page, width);
    await page.route('**/api/v1/learning-progress/lessons/lesson-1/video', (route) =>
      route.fulfill({
        status: 409,
        contentType: 'application/json',
        body: JSON.stringify({ message: 'Learning state conflict' }),
      }),
    );
    const message = await page.evaluate(async () => {
      const modulePath = '/src/features/learning/api/learning-client.ts';
      const { lessonProgressClient } = await import(/* @vite-ignore */ modulePath);
      try {
        await lessonProgressClient.saveVideo(
          'lesson-1',
          { contextType: 'course', courseId: 'course-1', topicId: '' },
          45,
          'csrf-123',
        );
        return 'UNEXPECTED_SUCCESS';
      } catch (error) {
        return error instanceof Error ? error.message : String(error);
      }
    });
    expect(message).toBe('Learning state conflict');
  });
}
