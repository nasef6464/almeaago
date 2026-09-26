import { expect, test, type Page, type Route } from '@playwright/test';

const student = {
  id: 'student-1',
  email: 'student@example.com',
  name: 'طالب',
  status: 'active',
  avatarUrl: '',
  emailVerified: true,
  role: 'student',
  roles: ['student'],
};

function json(route: Route, body: unknown, status = 200) {
  return route.fulfill({
    status,
    contentType: 'application/json',
    body: JSON.stringify(body),
  });
}

async function auth(page: Page) {
  await page.route('**/api/v1/auth/me', (route) => json(route, { user: student }));
  await page.route('**/api/v1/auth/csrf', (route) => json(route, { csrfToken: 'csrf-review' }));
}

test('mobile due review hides answer key until server-scored submission and advances SM2', async ({ page }) => {
  await auth(page);
  await page.setViewportSize({ width: 390, height: 844 });

  await page.route('**/api/v1/review/practice?**', (route) => {
    const url = new URL(route.request().url());
    expect(url.searchParams.get('pathId')).toBe('path-1');
    expect(url.searchParams.get('subjectId')).toBe('subject-1');
    expect(url.searchParams.get('tab')).toBe('mistakes');
    expect(url.searchParams.get('limit')).toBe('20');
    return json(route, {
      items: [{
        card: {
          cardId: 'card-1',
          questionId: 'q-1',
          questionVersion: 3,
          pathId: 'path-1',
          subjectId: 'subject-1',
          reviewType: 'error_recovery',
          savedForReview: false,
          savedAt: null,
          hasMistake: true,
          nextReviewAt: '2026-09-25T03:10:00Z',
          skillIds: ['skill-1'],
          updatedAt: '2026-09-26T03:10:00Z',
        },
        question: {
          id: 'q-1',
          version: 3,
          type: 'mcq',
          text: '٢ + ٢ = ؟',
          imageAssetId: '',
          imageAlt: '',
          optionsEmbeddedInImage: false,
          videoUrl: '',
          difficulty: 'easy',
          options: [
            { index: 0, text: '٣', assetId: '' },
            { index: 1, text: '٤', assetId: '' },
          ],
        },
      }],
      page: 1,
      limit: 20,
      hasMore: false,
    });
  });

  let answerCalls = 0;
  await page.route('**/api/v1/review/cards/card-1/answer', async (route) => {
    expect(route.request().method()).toBe('POST');
    expect(route.request().headers()['x-csrf-token']).toBe('csrf-review');
    const body = JSON.parse(route.request().postData() || '{}');
    expect(body.expectedUpdatedAt).toBe('2026-09-26T03:10:00Z');
    expect(body.selectedOptionIndex).toBe(0);
    expect(typeof body.submissionKey).toBe('string');
    expect(body.submissionKey.length).toBeGreaterThanOrEqual(8);
    answerCalls += 1;
    return json(route, {
      result: {
        submissionId: 'submission-1',
        cardId: 'card-1',
        questionId: 'q-1',
        questionVersion: 3,
        selectedOptionIndex: 0,
        correct: false,
        evidenceType: 'remediation',
        quality: 2,
        correctOptionIndex: 1,
        explanation: 'نجمع العددين فنحصل على أربعة.',
        hint: '',
        solvingStrategy: 'جمع مباشر',
        reviewTypeAfter: 'error_recovery',
        nextReviewAt: '2026-09-27T03:10:00Z',
      },
    });
  });

  await page.goto('/review/practice?pathId=path-1&subjectId=subject-1&tab=mistakes');
  await expect(page.getByRole('heading', { name: 'جلسة المراجعة' })).toBeVisible();
  await expect(page.getByText('٢ + ٢ = ؟')).toBeVisible();
  await expect(page.getByText('الإجابة الصحيحة')).toHaveCount(0);
  await expect(page.getByText('نجمع العددين فنحصل على أربعة.')).toHaveCount(0);

  await page.getByRole('button', { name: /٣/ }).click();
  await page.getByRole('button', { name: 'تحقق من الإجابة' }).click();

  await expect.poll(() => answerCalls).toBe(1);
  await expect(page.getByText('إجابة غير صحيحة')).toBeVisible();
  await expect(page.getByText('الإجابة الصحيحة')).toBeVisible();
  await expect(page.getByText('نجمع العددين فنحصل على أربعة.')).toBeVisible();
  await expect(page.getByText(/المراجعة التالية/)).toBeVisible();

  await page.screenshot({ path: 'test-results/learning-remediation-mobile.png', fullPage: true });
  await page.getByRole('button', { name: 'التالي' }).click();
  await expect(page.getByRole('heading', { name: 'اكتملت دفعة المراجعة' })).toBeVisible();
});
