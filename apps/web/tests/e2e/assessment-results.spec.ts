import { expect, test, type Page, type Route } from '@playwright/test';

const user = {
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
  await page.route('**/api/v1/auth/me', (route) => json(route, { user }));
  await page.route('**/api/v1/auth/csrf', (route) => json(route, { csrfToken: 'csrf' }));
}

const historyItem = {
  attemptId: 'attempt-1',
  assessmentId: 'assessment-1',
  assessmentVersion: 2,
  title: 'محاكي كمي',
  attemptNumber: 1,
  score: 50,
  totalQuestions: 2,
  correctAnswers: 0,
  wrongAnswers: 1,
  unanswered: 1,
  passed: false,
  timeSpentSeconds: 90,
  finalizedAt: '2026-09-26T10:02:00Z',
  showResultsReport: true,
};

test('learner history is bounded and disabled review exposes no question content', async ({ page }) => {
  await auth(page);
  await page.route('**/api/v1/assessment-attempts/results?**', (route) =>
    json(route, { items: [historyItem], page: 1, limit: 20, hasMore: false }),
  );
  await page.route('**/api/v1/assessment-attempts/attempt-1/review', (route) =>
    json(route, {
      detail: {
        result: historyItem,
        assessmentId: 'assessment-1',
        assessmentVersion: 2,
        title: 'محاكي كمي',
        attemptNumber: 1,
        allowQuestionReview: false,
        showAnswers: false,
        showExplanations: false,
        showResultsReport: true,
      },
    }),
  );

  await page.goto('/assessment-results');
  await expect(page.getByRole('heading', { name: 'سجل النتائج' })).toBeVisible();
  await expect(page.getByText('محاكي كمي')).toBeVisible();
  await page.getByRole('link', { name: 'عرض النتيجة' }).click();
  await expect(
    page.getByText('مراجعة الأسئلة غير متاحة لهذا الاختبار وفق إعدادات النسخة التي أجريت عليها المحاولة.'),
  ).toBeVisible();
  await expect(page.getByText('الإجابة الصحيحة')).toHaveCount(0);
});

test('mobile review filters wrong unanswered and marked questions without leaking hidden key', async ({ page }) => {
  await auth(page);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.route('**/api/v1/assessment-attempts/attempt-1/review', (route) =>
    json(route, {
      detail: {
        result: historyItem,
        assessmentId: 'assessment-1',
        assessmentVersion: 2,
        title: 'محاكي كمي',
        attemptNumber: 1,
        allowQuestionReview: true,
        showAnswers: false,
        showExplanations: false,
        showResultsReport: true,
        questions: [
          {
            questionId: 'q-1',
            questionVersion: 3,
            sectionId: '',
            sortOrder: 0,
            points: 1,
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
            selectedOptionIndex: 0,
            answered: true,
            correct: false,
            markedForReview: true,
            timeSpentSeconds: 30,
          },
          {
            questionId: 'q-2',
            questionVersion: 1,
            sectionId: '',
            sortOrder: 1,
            points: 1,
            type: 'mcq',
            text: '٥ + ٥ = ؟',
            imageAssetId: '',
            imageAlt: '',
            optionsEmbeddedInImage: false,
            videoUrl: '',
            difficulty: 'easy',
            options: [
              { index: 0, text: '٩', assetId: '' },
              { index: 1, text: '١٠', assetId: '' },
            ],
            selectedOptionIndex: null,
            answered: false,
            correct: false,
            markedForReview: false,
            timeSpentSeconds: 0,
          },
        ],
      },
    }),
  );

  await page.goto('/assessment-results/attempt-1');
  await expect(page.getByRole('heading', { name: 'محاكي كمي' })).toBeVisible();
  await page.getByRole('button', { name: 'أخطأت فيها' }).click();
  await expect(page.getByText('٢ + ٢ = ؟')).toBeVisible();
  await expect(page.getByText('٥ + ٥ = ؟')).toHaveCount(0);
  await expect(page.getByText('الإجابة الصحيحة')).toHaveCount(0);

  await page.getByRole('button', { name: 'بدون إجابة' }).click();
  await expect(page.getByText('٥ + ٥ = ؟')).toBeVisible();

  await page.getByRole('button', { name: 'للمراجعة', exact: true }).click();
  await expect(page.getByText('٢ + ٢ = ؟')).toBeVisible();
  await page.screenshot({ path: 'test-results/assessment-result-review-mobile.png', fullPage: true });
});
