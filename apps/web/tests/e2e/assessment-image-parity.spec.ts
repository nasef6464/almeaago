import { expect, test, type Page, type Route } from '@playwright/test';

const student = { id: 'student-1', email: 'student@example.com', name: 'طالب', status: 'active', avatarUrl: '', emailVerified: true, role: 'student', roles: ['student'] };
const question = { id: 'q-1', version: 3, sectionId: '', sortOrder: 1, points: 1, type: 'mcq', text: 'اختر الشكل الصحيح', imageAssetId: '', imageAlt: '', optionsEmbeddedInImage: false, videoUrl: '', difficulty: 'easy', options: [{ index: 0, text: '', assetId: '' }, { index: 1, text: '', assetId: '' }] };
const attempt = { id: 'attempt-1', assessmentId: 'assessment-1', assessmentVersion: 2, attemptNumber: 1, status: 'in_progress', title: 'محاكي كمي', startedAt: '2026-09-26T10:00:00Z', expiresAt: null, submittedAt: null, showProgressBar: true, requireAnswerBeforeNext: false, allowQuestionReview: true, randomizeOptions: false, questions: [question], answers: [] };
const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVQIHWP4z8DwHwAFgAI/ScL/nwAAAABJRU5ErkJggg==', 'base64');
function json(route: Route, payload: unknown, status = 200) { return route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(payload) }); }
async function setup(page: Page, updatedQuestion: typeof question) {
  await page.route('**/api/v1/auth/me', route => json(route, { user: student }));
  await page.route('**/api/v1/auth/csrf', route => json(route, { csrfToken: 'csrf' }));
  await page.route('**/api/v1/assessments/assessment-1/attempts', route => json(route, { attempt: { ...attempt, questions: [updatedQuestion] } }));
  await page.route('**/api/v1/assessment-attempts/attempt-1/answers/q-1', route => json(route, { attempt: { ...attempt, questions: [updatedQuestion], answers: [{ questionId: 'q-1', selectedOptionIndex: 1, textAnswer: '', timeSpentSeconds: 0, markedForReview: false, lastSavedAt: '2026-09-26T10:01:00Z' }] } }));
}

test('separate choice images remain selectable at mobile, tablet and desktop widths', async ({ page }) => {
  const firstId = 'option-image-asset-a';
  const secondId = 'option-image-asset-b';
  const firstUrl = 'https://cdn.example.test/option-a.png';
  const secondUrl = 'https://cdn.example.test/option-b.png';
  await setup(page, { ...question, options: [{ index: 0, text: '', assetId: firstId }, { index: 1, text: '', assetId: secondId }] });
  await page.route('**/api/v1/media/assets/option-image-asset-a', route => json(route, { asset: { id: firstId, publicUrl: firstUrl, status: 'active', mimeType: 'image/png' } }));
  await page.route('**/api/v1/media/assets/option-image-asset-b', route => json(route, { asset: { id: secondId, publicUrl: secondUrl, status: 'active', mimeType: 'image/png' } }));
  await page.route(firstUrl, route => route.fulfill({ status: 200, contentType: 'image/png', body: png }));
  await page.route(secondUrl, route => route.fulfill({ status: 200, contentType: 'image/png', body: png }));
  for (const width of [390, 820, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    await page.goto('/assessments/assessment-1/start');
    await expect(page.getByRole('img', { name: 'صورة الاختيار أ' })).toBeVisible();
    await expect(page.getByRole('img', { name: 'صورة الاختيار ب' })).toBeVisible();
    await expect(page.getByRole('img', { name: 'صورة الاختيار أ' })).toHaveAttribute('src', firstUrl);
    await expect(page.getByRole('img', { name: 'صورة الاختيار ب' })).toHaveAttribute('src', secondUrl);
    await page.getByRole('button', { name: /صورة الاختيار ب/ }).click();
    await expect(page.getByRole('button', { name: /صورة الاختيار ب/ })).toHaveClass(/border-amber-500/);
  }
});

test('transient media API failure permits retry without leaving the attempt', async ({ page }) => {
  const imageId = 'question-retry-asset';
  const url = 'https://cdn.example.test/question-retry.png';
  await setup(page, { ...question, imageAssetId: imageId, imageAlt: 'صورة السؤال' });
  let lookups = 0;
  await page.route('**/api/v1/media/assets/question-retry-asset', route => {
    lookups += 1;
    return lookups === 1 ? json(route, { error: 'temporarily_unavailable' }, 503) : json(route, { asset: { id: imageId, publicUrl: url, status: 'active', mimeType: 'image/png' } });
  });
  await page.route(url, route => route.fulfill({ status: 200, contentType: 'image/png', body: png }));
  await page.goto('/assessments/assessment-1/start');
  await expect(page.getByText('تعذر تحميل صورة السؤال')).toBeVisible();
  await page.getByRole('button', { name: 'إعادة تحميل الصورة' }).click();
  await expect(page.getByRole('img', { name: 'صورة السؤال' })).toHaveAttribute('src', url);
  expect(lookups).toBe(2);
  await expect(page.getByRole('heading', { name: 'محاكي كمي' })).toBeVisible();
});
