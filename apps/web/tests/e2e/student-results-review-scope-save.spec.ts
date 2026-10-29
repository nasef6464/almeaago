import { expect, test, type Page, type Route } from '@playwright/test';

const student = { id: 'student-1', email: 'student@example.com', name: 'طالب', status: 'active', avatarUrl: '', emailVerified: true, role: 'student', roles: ['student'] };
const result = (attemptId: string) => ({
  attemptId, assessmentId: 'assessment-1', assessmentVersion: 1, title: attemptId,
  attemptNumber: 1, score: 50, totalQuestions: 1, correctAnswers: 0,
  wrongAnswers: 1, unanswered: 0, passed: false, timeSpentSeconds: 30,
  finalizedAt: '2026-10-29T10:00:00Z', showResultsReport: true,
});
const question = {
  questionId: 'shared-question', questionVersion: 1, sectionId: '', sortOrder: 0,
  points: 1, type: 'mcq', text: 'سؤال مشترك بين محاولتين',
  imageAssetId: '', imageAlt: '', optionsEmbeddedInImage: false,
  videoUrl: '', difficulty: 'easy',
  options: [{ index: 0, text: 'أ', assetId: '' }, { index: 1, text: 'ب', assetId: '' }],
  selectedOptionIndex: 0, answered: true, correct: false, markedForReview: false,
  timeSpentSeconds: 30,
};
function json(route: Route, body: unknown, status = 200) {
  return route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) });
}
async function setup(page: Page) {
  await page.route('**/api/v1/auth/me', route => json(route, { user: student }));
  await page.route('**/api/v1/auth/csrf', route => json(route, { csrfToken: 'csrf' }));
  await page.route('**/api/v1/assessment-attempts/results?**', route => json(route, {
    items: [result('attempt-1'), result('attempt-2')], page: 1, limit: 20, hasMore: false,
  }));
  await page.route('**/api/v1/assessment-attempts/attempt-*/review', route => {
    const id = new URL(route.request().url()).pathname.split('/').at(-2) || '';
    return json(route, { detail: {
      result: result(id), assessmentId: 'assessment-1', assessmentVersion: 1,
      title: id, attemptNumber: 1, allowQuestionReview: true, showAnswers: false,
      showExplanations: false, showResultsReport: true, questions: [question],
    } });
  });
}

test('failed save preserves the review and supports retry and reload', async ({ page }) => {
  await setup(page);
  let writes = 0;
  await page.route('**/api/v1/review/questions/shared-question/saved', route => {
    writes += 1;
    return json(route, writes === 1 ? { message: 'تعذر الحفظ مؤقتًا' } : { success: true }, writes === 1 ? 503 : 200);
  });
  await page.goto('/assessment-results/attempt-1');
  await expect(page.getByText(question.text)).toBeVisible();
  await page.getByRole('button', { name: 'حفظ للمراجعة' }).click();
  await expect(page.getByText('تعذر الحفظ مؤقتًا')).toBeVisible();
  await expect(page.getByText(question.text)).toBeVisible();
  await expect(page.getByRole('button', { name: 'حفظ للمراجعة' })).toBeEnabled();
  await page.getByRole('button', { name: 'حفظ للمراجعة' }).click();
  await expect(page.getByRole('button', { name: 'تم الحفظ' })).toBeDisabled();
  expect(writes).toBe(2);
  await page.reload();
  await expect(page.getByText(question.text)).toBeVisible();
});

test('saved review state belongs to the active attempt, not another attempt', async ({ page }) => {
  await setup(page);
  await page.route('**/api/v1/review/questions/shared-question/saved', route => json(route, { success: true }));
  await page.goto('/assessment-results');
  await page.getByRole('link', { name: 'عرض النتيجة' }).first().click();
  await expect(page.getByRole('heading', { name: 'attempt-1' })).toBeVisible();
  await page.getByRole('button', { name: 'حفظ للمراجعة' }).click();
  await expect(page.getByRole('button', { name: 'تم الحفظ' })).toBeDisabled();
  await page.getByRole('link', { name: 'العودة لسجل النتائج' }).click();
  await page.getByRole('link', { name: 'عرض النتيجة' }).nth(1).click();
  await expect(page.getByRole('heading', { name: 'attempt-2' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'حفظ للمراجعة' })).toBeEnabled();
});

for (const width of [390, 820, 1440]) {
  test(`review save failure retains RTL content at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await setup(page);
    await page.route('**/api/v1/review/questions/shared-question/saved', route => json(route, { message: 'تعذر الحفظ مؤقتًا' }, 503));
    await page.goto('/assessment-results/attempt-1');
    await page.getByRole('button', { name: 'حفظ للمراجعة' }).click();
    await expect(page.getByText(question.text)).toBeVisible();
    await expect(page.getByText('تعذر الحفظ مؤقتًا')).toBeVisible();
    await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await page.screenshot({ path: `test-results/student-results-save-failure-${width}.png`, fullPage: true });
  });
}
