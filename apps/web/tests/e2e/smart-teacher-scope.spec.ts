import { expect, test } from '@playwright/test';

for (const mode of ['result', 'review'] as const) {
  test(`smart teacher uses the authorized ${mode} reference`, async ({page}) => {
    await page.route('**/api/v1/auth/me', route => route.fulfill({json:{user:{id:'student-1',name:'طالب',roles:['student'],role:'student'}}}));
    await page.route('**/api/v1/auth/csrf', route => route.fulfill({json:{csrfToken:'test-csrf'}}));
    const payloads: Array<Record<string, unknown>> = [];
    await page.route('**/api/v1/ai/question-assistant', route => {
      payloads.push(route.request().postDataJSON());
      return route.fulfill({json:{result:{text:'شرح تجريبي'}}});
    });
    await page.goto(`/tests/e2e/fixtures/smart-teacher-scope.html?mode=${mode}`, {waitUntil:'domcontentloaded'});
    await expect(page.getByRole('dialog',{name:'المعلم الذكي والسبورة التفاعلية'})).toBeVisible({timeout:60_000});
    await expect.poll(() => payloads.length, {timeout:30_000}).toBeGreaterThan(0);
    for (const body of payloads) {
      if (mode === 'result') {
        expect(body).toMatchObject({questionId:'question-1',attemptId:'attempt-1',resultId:'attempt-1'});
        expect(body).not.toHaveProperty('reviewCardId');
      } else {
        expect(body).toMatchObject({questionId:'question-1',reviewCardId:'card-1'});
        expect(body.attemptId).toBe('');
      }
    }
  });
}
