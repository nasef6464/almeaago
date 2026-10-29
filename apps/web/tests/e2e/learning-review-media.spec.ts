import { expect, test, type Page, type Route } from '@playwright/test';

const student = {
  id: 'student-1', email: 'student@example.com', name: 'طالب', status: 'active',
  avatarUrl: '', emailVerified: true, role: 'student', roles: ['student'],
};
const question = {
  id: 'q-image', version: 2, type: 'mcq', text: 'اختر الشكل الصحيح',
  imageAssetId: 'img-question', imageAlt: 'صورة السؤال', optionsEmbeddedInImage: false,
  videoUrl: '', difficulty: 'easy',
  options: [{ index: 0, text: 'الخيار الأول', assetId: 'img-option' }, { index: 1, text: 'الخيار الثاني', assetId: '' }],
  correctOptionIndex: 0, explanation: 'شرح السؤال', hint: '', solvingStrategy: '',
};
const card = {
  cardId: 'card-image', questionId: 'q-image', questionVersion: 2, pathId: 'path-1',
  subjectId: 'subject-1', reviewType: 'saved_review', savedForReview: true,
  savedAt: '2026-10-28T00:00:00Z', hasMistake: false, nextReviewAt: '2026-10-28T00:00:00Z',
  skillIds: ['skill-1'], updatedAt: '2026-10-28T00:00:00Z',
};
const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAIAAAACCAIAAAD91JpzAAAAFklEQVR4nGNkmBbAwMDAxMDAwMDAAAAKogDqW4cpSgAAAABJRU5ErkJggg==', 'base64');

function json(route: Route, body: unknown, status = 200) {
  return route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) });
}
async function mockStudent(page: Page) {
  await page.route('**/api/v1/auth/me', route => json(route, { user: student }));
  await page.route('**/api/v1/auth/csrf', route => json(route, { csrfToken: 'csrf' }));
  await page.route('**/api/v1/taxonomy/bootstrap?phase=core', route => json(route, {
    paths: [{ id: 'path-1', name: 'القدرات', code: 'QDR', sortOrder: 1 }],
    subjects: [{ id: 'subject-1', pathId: 'path-1', name: 'الكمي', code: 'QNT', sortOrder: 1 }],
  }));
  await page.route('**/api/v1/mastery/progress?**', route => json(route, { items: [], page: 1, limit: 8, hasMore: false }));
  await page.route('**/api/v1/mastery/next-action?**', route => json(route, { item: null }));
  await page.route('**/api/v1/mastery/readiness?**', route => json(route, { readiness: null }));
  await page.route('**/api/v1/mastery/goals?**', route => json(route, { items: [], page: 1, limit: 20, hasMore: false }));
  await page.route('https://cdn.example.test/**', route => route.fulfill({ status: 200, contentType: 'image/png', body: png }));
}
async function mockMedia(page: Page, failFirst = false) {
  let attempts = 0;
  const attemptsById = new Map<string, number>();
  await page.route('**/api/v1/media/assets/*', route => {
    attempts += 1;
    const id = route.request().url().split('/').pop() || '';
    const count = (attemptsById.get(id) || 0) + 1;
    attemptsById.set(id, count);
    if (failFirst && id === 'img-question' && count === 1) {
      return json(route, { message: 'Media temporarily unavailable' }, 503);
    }
    return json(route, { asset: { id, publicUrl: `https://cdn.example.test/${id}.png`, status: 'active', mimeType: 'image/png' } });
  });
  return () => attempts;
}

for (const width of [390, 820, 1440]) {
  test(`saved review renders canonical question and option media at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 1000 });
    await mockStudent(page);
    const calls = await mockMedia(page);
    await page.route('**/api/v1/review/library?**', route => json(route, {
      items: [{ card, question }], page: 1, limit: 20, hasMore: false,
    }));
    await page.goto('/review?pathId=path-1&subjectId=subject-1&tab=saved');
    await expect(page.getByRole('img', { name: 'صورة السؤال' })).toBeVisible();
    await expect(page.getByRole('img', { name: 'صورة الخيار أ' })).toBeVisible();
    await expect(page.getByText('اختر الشكل الصحيح')).toBeVisible();
    await expect(page.getByText('الإجابة الصحيحة')).toHaveCount(0);
    expect(calls()).toBeGreaterThanOrEqual(2);
    await page.getByRole('img', { name: 'صورة السؤال' }).scrollIntoViewIfNeeded();
    await expect.poll(() => page.getByRole('img', { name: 'صورة السؤال' }).evaluate(node => (node as HTMLImageElement).naturalWidth)).toBeGreaterThan(0);
    await page.getByRole('img', { name: 'صورة الخيار أ' }).scrollIntoViewIfNeeded();
    await expect.poll(() => page.getByRole('img', { name: 'صورة الخيار أ' }).evaluate(node => (node as HTMLImageElement).naturalWidth)).toBeGreaterThan(0);
    await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await page.screenshot({ path: `test-results/review-media-${width}.png`, fullPage: true });
  });
}

test('review practice displays embedded-option question image before answering', async ({ page }) => {
  await mockStudent(page);
  await mockMedia(page);
  await page.route('**/api/v1/review/practice?**', route => json(route, {
    items: [{ card, question: { ...question, optionsEmbeddedInImage: true } }],
    page: 1, limit: 20, hasMore: false,
  }));
  await page.goto('/review/practice?pathId=path-1&subjectId=subject-1&tab=saved');
  await expect(page.getByRole('img', { name: 'صورة السؤال' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'أ', exact: true })).toBeVisible();
  await expect(page.getByText('الإجابة الصحيحة')).toHaveCount(0);
});

test('failed media lookup preserves review and retries without losing the question', async ({ page }) => {
  await mockStudent(page);
  await mockMedia(page, true);
  await page.route('**/api/v1/review/library?**', route => json(route, {
    items: [{ card, question: { ...question, options: question.options.map(option => ({ ...option, assetId: '' })) } }],
    page: 1, limit: 20, hasMore: false,
  }));
  await page.goto('/review?pathId=path-1&subjectId=subject-1');
  await expect(page.getByText('تعذر تحميل صورة السؤال')).toBeVisible();
  await expect(page.getByText('اختر الشكل الصحيح')).toBeVisible();
  await page.getByRole('button', { name: 'إعادة تحميل الصورة' }).click();
  await expect(page.getByRole('img', { name: 'صورة السؤال' })).toBeVisible();
  await page.reload();
  await expect(page.getByRole('img', { name: 'صورة السؤال' })).toBeVisible();
});
