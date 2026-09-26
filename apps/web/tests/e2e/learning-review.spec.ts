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
  await page.route('**/api/v1/auth/csrf', (route) => json(route, { csrfToken: 'csrf-token' }));
}

const result = {
  attemptId: 'attempt-1',
  score: 50,
  totalQuestions: 1,
  correctAnswers: 0,
  wrongAnswers: 1,
  unanswered: 0,
  passed: false,
  timeSpentSeconds: 30,
  finalizedAt: '2026-09-26T03:10:00Z',
};

test('student saves a result question into the canonical review card', async ({ page }) => {
  await auth(page);
  await page.route('**/api/v1/assessment-attempts/attempt-1/review', (route) =>
    json(route, {
      detail: {
        result,
        assessmentId: 'assessment-1',
        assessmentVersion: 2,
        title: 'اختبار كمي',
        attemptNumber: 1,
        allowQuestionReview: true,
        showAnswers: true,
        showExplanations: true,
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
            correctOptionIndex: 1,
            answered: true,
            correct: false,
            markedForReview: false,
            timeSpentSeconds: 30,
            explanation: 'نجمع العددين.',
            hint: '',
            solvingStrategy: '',
          },
        ],
      },
    }),
  );

  let saveCalls = 0;
  await page.route('**/api/v1/review/questions/q-1/saved', async (route) => {
    expect(route.request().method()).toBe('PUT');
    expect(route.request().headers()['x-csrf-token']).toBe('csrf-token');
    saveCalls += 1;
    return json(route, { success: true });
  });

  await page.goto('/assessment-results/attempt-1');
  await expect(page.getByRole('heading', { name: 'اختبار كمي' })).toBeVisible();
  await page.getByRole('button', { name: 'حفظ للمراجعة' }).click();
  await expect(page.getByRole('button', { name: 'تم الحفظ' })).toBeVisible();
  expect(saveCalls).toBe(1);
});

test('mobile review library shows mistake, mastery next action and toggles saved reason', async ({ page }) => {
  await auth(page);
  await page.setViewportSize({ width: 390, height: 844 });

  await page.route('**/api/v1/taxonomy/bootstrap?phase=core', (route) =>
    json(route, {
      paths: [{ id: 'path-1', code: 'QDR', name: 'القدرات', description: '', sortOrder: 1 }],
      subjects: [{ id: 'subject-1', pathId: 'path-1', code: 'QNT', name: 'الكمي', sortOrder: 1 }],
    }),
  );

  await page.route('**/api/v1/review/library?**', (route) => {
    const url = new URL(route.request().url());
    expect(url.searchParams.get('pathId')).toBe('path-1');
    expect(url.searchParams.get('limit')).toBe('20');
    return json(route, {
      items: [
        {
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
            nextReviewAt: '2026-09-27T03:10:00Z',
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
            correctOptionIndex: 1,
            explanation: 'نجمع العددين.',
            hint: '',
            solvingStrategy: '',
          },
        },
      ],
      page: 1,
      limit: 20,
      hasMore: false,
    });
  });

  await page.route('**/api/v1/mastery/progress?**', (route) =>
    json(route, {
      items: [
        {
          pathId: 'path-1',
          subjectId: 'subject-1',
          skillId: 'skill-1',
          mastery: 40,
          status: 'weak',
          attempts: 2,
          evidenceCount: 3,
          lastEvidenceAt: '2026-09-26T03:10:00Z',
          recommendedAction: 'خطة علاج عاجلة: شرح + تدريب + اختبار موجه',
        },
      ],
      page: 1,
      limit: 8,
      hasMore: false,
    }),
  );

  await page.route('**/api/v1/mastery/next-action?**', (route) =>
    json(route, {
      item: {
        pathId: 'path-1',
        subjectId: 'subject-1',
        skillId: 'skill-1',
        mastery: 40,
        status: 'weak',
        attempts: 2,
        evidenceCount: 3,
        lastEvidenceAt: '2026-09-26T03:10:00Z',
        recommendedAction: 'خطة علاج عاجلة: شرح + تدريب + اختبار موجه',
      },
    }),
  );

  let saveCalls = 0;
  await page.route('**/api/v1/review/questions/q-1/saved', async (route) => {
    expect(route.request().method()).toBe('PUT');
    saveCalls += 1;
    return json(route, { success: true });
  });

  await page.goto('/review');
  await page.getByLabel('مسار المراجعة').selectOption('path-1');
  await page.getByLabel('مادة المراجعة').selectOption('subject-1');

  await expect(page.getByRole('heading', { name: 'أسئلتي للمراجعة' })).toBeVisible();
  await expect(page.getByText('٢ + ٢ = ؟')).toBeVisible();
  await expect(page.getByText('خطأ سابق')).toBeVisible();
  await expect(page.getByText('خطة علاج عاجلة: شرح + تدريب + اختبار موجه')).toBeVisible();
  await expect(page.getByText('الإجابة الصحيحة')).toBeVisible();

  const saveRequest = page.waitForRequest(
    (request) =>
      request.url().includes('/api/v1/review/questions/q-1/saved') &&
      request.method() === 'PUT',
  );
  await page.getByRole('button', { name: 'حفظ للمراجعة' }).click();
  await saveRequest;
  await expect.poll(() => saveCalls).toBe(1);

  await page.screenshot({ path: 'test-results/learning-review-mobile.png', fullPage: true });
});
