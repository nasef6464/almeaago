import { expect, test, type Page, type Route } from '@playwright/test';

const user = { id: 'student-attempt-save', email: 'student@example.com', name: 'طالب', status: 'active', avatarUrl: '', emailVerified: true, role: 'student', roles: ['student'] };
const attempt = {
  id: 'attempt-save-1', assessmentId: 'assessment-save-1', assessmentVersion: 1,
  attemptNumber: 1, status: 'in_progress', title: 'اختبار حفظ الإجابات',
  startedAt: '2026-10-29T10:00:00Z', expiresAt: null, submittedAt: null,
  showProgressBar: true, requireAnswerBeforeNext: true, allowQuestionReview: true,
  randomizeOptions: false,
  questions: [
    { id: 'q-1', version: 1, sectionId: '', sortOrder: 0, points: 1, type: 'mcq', text: 'السؤال الأول', imageAssetId: '', imageAlt: '', optionsEmbeddedInImage: false, videoUrl: '', difficulty: 'easy', options: [{ index: 0, text: 'أول', assetId: '' }, { index: 1, text: 'ثان', assetId: '' }] },
    { id: 'q-2', version: 1, sectionId: '', sortOrder: 1, points: 1, type: 'mcq', text: 'السؤال الثاني', imageAssetId: '', imageAlt: '', optionsEmbeddedInImage: false, videoUrl: '', difficulty: 'easy', options: [{ index: 0, text: 'أول', assetId: '' }, { index: 1, text: 'ثان', assetId: '' }] },
  ],
  answers: [],
};
const savedAttempt = { ...attempt, answers: [{ questionId: 'q-1', selectedOptionIndex: 1, textAnswer: '', timeSpentSeconds: 0, markedForReview: false, lastSavedAt: '2026-10-29T10:01:00Z' }] };
function json(route: Route, body: unknown, status = 200) {
  return route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) });
}
async function setup(page: Page) {
  await page.route('**/api/v1/auth/me', route => json(route, { user }));
  await page.route('**/api/v1/auth/csrf', route => json(route, { csrfToken: 'csrf' }));
  await page.route('**/api/v1/assessment-attempts/attempt-save-1', route => json(route, { attempt }));
  await page.route('**/api/v1/assessment-attempts/attempt-save-1/submit', route => json(route, { result: { attemptId: 'attempt-save-1', score: 50, totalQuestions: 2, correctAnswers: 1, wrongAnswers: 0, unanswered: 1, passed: true, timeSpentSeconds: 12, finalizedAt: '2026-10-29T10:02:00Z' } }));
}
for (const width of [390, 820, 1440]) {
  test(`student retains unsaved choice after HTTP 503 and retries safely at ${width}px RTL`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await setup(page);
    let saves = 0;
    await page.route('**/api/v1/assessment-attempts/attempt-save-1/answers/q-1', route => {
      saves += 1;
      return saves === 1 ? json(route, { message: 'تعذر حفظ الإجابة' }, 503) : json(route, { attempt: savedAttempt });
    });
    await page.goto('/assessment-attempts/attempt-save-1');
    await expect(page.getByRole('heading', { name: 'السؤال الأول' })).toBeVisible();
    const choice = page.getByRole('button', { name: /ثان/ });
    await choice.click();
    await expect(page.getByText('تعذر حفظ الإجابة')).toBeVisible();
    await expect(choice).toHaveClass(/border-amber-500/);
    await expect(page.getByRole('button', { name: 'تسليم الاختبار' })).toBeDisabled();
    await choice.click();
    await expect(page.getByRole('heading', { name: 'السؤال الثاني' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'تسليم الاختبار' })).toBeEnabled();
    expect(saves).toBe(2);
    await page.screenshot({ path: `test-results/student-attempt-save-${width}.png`, fullPage: true });
  });
}
test('student cannot submit while answer persistence is in flight', async ({ page }) => {
  await setup(page);
  let releaseSave: (() => void) | undefined;
  let requestStarted: (() => void) | undefined;
  const started = new Promise<void>(resolve => { requestStarted = resolve; });
  await page.route('**/api/v1/assessment-attempts/attempt-save-1/answers/q-1', async route => {
    requestStarted?.();
    await new Promise<void>(resolve => { releaseSave = resolve; });
    await json(route, { attempt: savedAttempt });
  });
  await page.goto('/assessment-attempts/attempt-save-1');
  await page.getByRole('button', { name: /ثان/ }).click();
  await started;
  await expect(page.getByRole('button', { name: 'تسليم الاختبار' })).toBeDisabled();
  releaseSave?.();
  await expect(page.getByRole('heading', { name: 'السؤال الثاني' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'تسليم الاختبار' })).toBeEnabled();
});

test('student keeps submitted answers and the same submission key after HTTP 503', async ({ page }) => {
  await setup(page);
  await page.route('**/api/v1/assessment-attempts/attempt-save-1/answers/q-1', route => json(route, { attempt: savedAttempt }));
  let submissions = 0;
  const keys: string[] = [];
  await page.unroute('**/api/v1/assessment-attempts/attempt-save-1/submit');
  await page.route('**/api/v1/assessment-attempts/attempt-save-1/submit', async route => {
    const body = route.request().postDataJSON() as { submissionKey: string };
    keys.push(body.submissionKey);
    submissions += 1;
    return submissions === 1
      ? json(route, { message: 'تعذر تسليم الاختبار' }, 503)
      : json(route, { result: { attemptId: 'attempt-save-1', score: 50, totalQuestions: 2, correctAnswers: 1, wrongAnswers: 0, unanswered: 1, passed: true, timeSpentSeconds: 12, finalizedAt: '2026-10-29T10:02:00Z' } });
  });
  await page.goto('/assessment-attempts/attempt-save-1');
  await page.getByRole('button', { name: /ثان/ }).click();
  await expect(page.getByRole('heading', { name: 'السؤال الثاني' })).toBeVisible();
  await page.getByRole('button', { name: 'تسليم الاختبار' }).click();
  await expect(page.getByText('تعذر تسليم الاختبار')).toBeVisible();
  await expect(page.getByRole('heading', { name: 'السؤال الثاني' })).toBeVisible();
  await page.getByRole('button', { name: 'تسليم الاختبار' }).click();
  await expect(page.getByRole('heading', { name: 'تم تسليم الاختبار' })).toBeVisible();
  expect(submissions).toBe(2);
  expect(keys[0]).toBeTruthy();
  expect(keys[1]).toBe(keys[0]);
});

test('reloading the attempt restores only server-confirmed answers', async ({ page }) => {
  await setup(page);
  let server: typeof attempt | typeof savedAttempt = attempt;
  await page.unroute('**/api/v1/assessment-attempts/attempt-save-1');
  await page.route('**/api/v1/assessment-attempts/attempt-save-1', route => json(route, { attempt: server }));
  await page.route('**/api/v1/assessment-attempts/attempt-save-1/answers/q-1', route => {
    server = savedAttempt;
    return json(route, { attempt: server });
  });
  await page.goto('/assessment-attempts/attempt-save-1');
  await page.getByRole('button', { name: /ثان/ }).click();
  await expect(page.getByRole('heading', { name: 'السؤال الثاني' })).toBeVisible();
  await page.reload();
  await expect(page.getByRole('heading', { name: 'السؤال الأول' })).toBeVisible();
  await expect(page.getByRole('button', { name: /ثان/ })).toHaveClass(/border-amber-500/);
});
