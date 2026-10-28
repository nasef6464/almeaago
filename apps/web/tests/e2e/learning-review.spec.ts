import { expect, test, type Page, type Route } from './fixtures/header-test';

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
    json(route, {levels:[],
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
        action: 'alternate_support_then_recheck',
        trend: 'declining',
        },
      ],
      page: 1,
      limit: 8,
      hasMore: false,
    }),
  );

  await page.route('**/api/v1/mastery/readiness?**', (route) => json(route,{readiness:{score:54,status:'building',mastery:40,coverage:1,evidenceConfidence:1,recency:1,totalSkills:1,reliableSkills:1,totalEvidence:3,explanation:'استمر في العلاج والتدريب قبل إعادة القياس.'}}));

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
        action: 'alternate_support_then_recheck',
        trend: 'declining',
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
  await expect(page.getByText('إتقان المهارة المختارة: 40.0%', { exact: false })).toBeVisible();
  await expect(page.getByText('اتجاه الأدلة: متراجع')).toBeVisible();
  await expect(page.getByTestId('mastery-readiness')).toContainText('54');
  await expect(page.getByTestId('mastery-readiness')).toContainText('نبني الجاهزية');
  await expect(page.getByTestId('mastery-readiness')).toContainText('التغطية');
  await expect(page.getByTestId('mastery-readiness')).toContainText('ثقة الأدلة');
  await expect(page.getByTestId('mastery-readiness')).toContainText('حداثة الأدلة');
  await expect(page.getByTestId('mastery-readiness')).toContainText('ليس توقعًا لدرجة اختبار خارجي');
  await expect(page.getByText('الإجابة الصحيحة')).toHaveCount(0);
  await page.getByRole('button', { name: 'إظهار الحل' }).click();
  await expect(page.getByText('الإجابة الصحيحة')).toBeVisible();
  await expect(page.getByText('نجمع العددين.')).toBeVisible();

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


test('legacy favorites alias preserves review-library shell and scoped V2 truth on tablet', async ({ page }) => {
  await auth(page);
  await page.setViewportSize({ width: 820, height: 1180 });
  await page.route('**/api/v1/taxonomy/bootstrap?phase=core', (route) =>
    json(route, {levels:[],
      paths: [{ id: 'path-1', code: 'QDR', name: 'القدرات', description: '', sortOrder: 1 }],
      subjects: [{ id: 'subject-1', pathId: 'path-1', code: 'QNT', name: 'الكمي', sortOrder: 1 }],
    }),
  );
  await page.route('**/api/v1/review/library?**', (route) =>
    json(route, {
      items: [{
        card: {
          cardId: 'card-legacy',
          questionId: 'q-legacy',
          questionVersion: 1,
          pathId: 'path-1',
          subjectId: 'subject-1',
          reviewType: 'saved_review',
          savedForReview: true,
          savedAt: '2026-09-29T08:00:00Z',
          hasMistake: false,
          nextReviewAt: '2026-09-30T08:00:00Z',
          skillIds: ['skill-1'],
          updatedAt: '2026-09-29T08:00:00Z',
        },
        question: {
          id: 'q-legacy',
          version: 1,
          type: 'mcq',
          text: 'سؤال المراجعة المحفوظ',
          imageAssetId: '',
          imageAlt: '',
          optionsEmbeddedInImage: false,
          videoUrl: '',
          difficulty: 'easy',
          options: [{ index: 0, text: 'أ', assetId: '' }, { index: 1, text: 'ب', assetId: '' }],
          correctOptionIndex: 1,
          explanation: 'شرح محفوظ',
          hint: '',
          solvingStrategy: '',
        },
      }],
      page: 1,
      limit: 20,
      hasMore: false,
    }),
  );
  await page.route('**/api/v1/mastery/progress?**', (route) =>
    json(route, { items: [], page: 1, limit: 8, hasMore: false }),
  );
  await page.route('**/api/v1/mastery/next-action?**', (route) => json(route, { item: null }));
  await page.route('**/api/v1/mastery/readiness?**', (route) =>
    json(route, { readiness: { score: 0, status: 'needs_measurement', mastery: 0, coverage: 0, evidenceConfidence: 0, recency: .5, totalSkills: 0, reliableSkills: 0, totalEvidence: 0, explanation: 'نحتاج أدلة أكثر.' } }),
  );
  await page.route('**/api/v1/mastery/goals?**', (route) =>
    json(route, { items: [], page: 1, limit: 20, hasMore: false }),
  );

  await page.goto('/favorites?pathId=path-1&subjectId=subject-1&mode=saved');
  await expect(page.getByTestId('legacy-review-library')).toBeVisible();
  await expect(page.getByRole('heading', { name: 'أسئلتي للمراجعة' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'حفظتها للمراجعة' })).toHaveClass(/bg-white/);
  await expect(page.getByText('سؤال المراجعة المحفوظ')).toBeVisible();
  await expect(page.getByText('الإجابة الصحيحة')).toHaveCount(0);
  await expect(page.getByRole('link', { name: 'تدرّب على هذه الأسئلة' })).toHaveAttribute('href', '/review/practice?pathId=path-1&subjectId=subject-1&tab=saved');
  await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  await page.screenshot({ path: 'test-results/learning-review-legacy-tablet.png', fullPage: true });
});

for (const width of [390, 820, 1440]) {
  test(`adaptive recommendation shows selected priority and clears old scope at ${width}`, async ({ page }) => {
    await auth(page);
    await page.setViewportSize({ width, height: 1000 });
    await page.route('**/api/v1/taxonomy/bootstrap?phase=core', route => json(route, {levels:[],
      paths: [{ id: 'path-1', code: 'QDR', name: 'القدرات', sortOrder: 1 }],
      subjects: [
        { id: 'subject-1', pathId: 'path-1', code: 'QNT', name: 'الكمي', sortOrder: 1 },
        { id: 'subject-2', pathId: 'path-1', code: 'VRB', name: 'اللفظي', sortOrder: 2 },
      ],
    }));
    await page.route('**/api/v1/review/library?**', route => json(route, { items: [], page: 1, limit: 20, hasMore: false }));
    await page.route('**/api/v1/mastery/progress?**', route => json(route, { items: [], page: 1, limit: 8, hasMore: false }));
    await page.route('**/api/v1/mastery/goals?**', route => json(route, { items: [], page: 1, limit: 20, hasMore: false }));
    await page.route('**/api/v1/mastery/readiness?**', route => json(route, { readiness: null }));
    let release: () => void = () => {};
    const pending = new Promise<void>(resolve => { release = resolve; });
    let slow = false;
    let calls = 0;
    await page.route('**/api/v1/mastery/next-action?**', async route => {
      const subjectId = new URL(route.request().url()).searchParams.get('subjectId');
      calls++;
      if (slow && subjectId === 'subject-2') await pending;
      return json(route, { item: {
        pathId: 'path-1', subjectId, skillId: `priority-${subjectId}`, mastery: subjectId === 'subject-1' ? 60 : 82,
        status: 'average', attempts: 3, evidenceCount: 3, lastEvidenceAt: '2026-10-28T00:00:00Z',
        action: subjectId === 'subject-1' ? 'alternate_support_then_recheck' : 'mastery_review',
        trend: subjectId === 'subject-1' ? 'declining' : 'stable',
        recommendedAction: subjectId === 'subject-1' ? 'دعم بديل ثم إعادة القياس' : 'مراجعة الإتقان',
      } });
    });
    await page.goto('/review?pathId=path-1&subjectId=subject-1');
    await expect(page.getByRole('heading', { name: 'دعم بديل ثم إعادة القياس' })).toBeVisible();
    await expect(page.getByText('إتقان المهارة المختارة: 60.0%', { exact: false })).toBeVisible();
    await expect(page.getByText('اتجاه الأدلة: متراجع')).toBeVisible();
    await expect(page.getByText('أقل إتقان حالي:', { exact: false })).toHaveCount(0);
    await page.screenshot({ path: `test-results/adaptive-priority-${width}.png`, fullPage: true });
    slow = true;
    const before = calls;
    await page.getByLabel('مادة المراجعة').selectOption('subject-2');
    await expect.poll(() => calls).toBeGreaterThan(before);
    // The old subject's recommendation must disappear while the new scope loads.
    await expect(page.getByRole('heading', { name: 'دعم بديل ثم إعادة القياس' })).toHaveCount(0);
    release();
    await expect(page.getByRole('heading', { name: 'مراجعة الإتقان' })).toBeVisible();
    await expect(page.getByText('إتقان المهارة المختارة: 82.0%', { exact: false })).toBeVisible();
    await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  });
}
