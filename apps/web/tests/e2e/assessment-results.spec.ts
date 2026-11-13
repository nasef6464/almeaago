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

test('review numbers the displayed first question and honors image-embedded choices from URLs', async ({ page }) => {
  test.setTimeout(120_000);
  await auth(page);
  await page.route('**/api/v1/assessment-attempts/attempt-1/review', route => json(route, { detail: {
    result: { attemptId: 'attempt-1', score: 100, totalQuestions: 1, correctAnswers: 1, wrongAnswers: 0, unanswered: 0, passed: true, timeSpentSeconds: 1, finalizedAt: new Date().toISOString() },
    assessmentId: '', assessmentVersion: 0, title: 'اختبار ذاتي', attemptNumber: 1, allowQuestionReview: true, showAnswers: true, showExplanations: true, showResultsReport: true,
    questions: [{ questionId: 'q1', questionVersion: 1, sectionId: '', sortOrder: 1, points: 1, type: 'mcq', text: '', imageAssetId: '', imageUrl: 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg"/>', imageAlt: 'صورة السؤال', optionsEmbeddedInImage: true, options: [{ index: 0, text: 'نص موجود داخل الصورة', assetId: '' }], selectedOptionIndex: 0, correctOptionIndex: 0, answered: true, correct: true, markedForReview: false, timeSpentSeconds: 1 }],
  } }));
  await page.goto('/assessment-results/attempt-1', { waitUntil: 'domcontentloaded' });
  await expect(page.getByText('سؤال 1 · 1 درجة')).toBeVisible({ timeout: 30000 });
  await expect(page.getByText('نص موجود داخل الصورة')).toHaveCount(0);
  await expect(page.getByRole('link', { name: 'اختبار جديد' })).toHaveAttribute('href', '/quiz?mode=self');
});

test('review hides AI text and choice text whenever the question has an image', async ({ page }) => {
  await auth(page);
  await page.route('**/api/v1/assessment-attempts/attempt-1/review', route => json(route, { detail: {
    result: { attemptId: 'attempt-1', score: 100, totalQuestions: 1, correctAnswers: 1, wrongAnswers: 0, unanswered: 0, passed: true, timeSpentSeconds: 1, finalizedAt: new Date().toISOString() },
    assessmentId: 'assessment-1', assessmentVersion: 1, title: 'اختبار', attemptNumber: 1, allowQuestionReview: true, showAnswers: true, showExplanations: true, showResultsReport: true,
    questions: [{ questionId: 'q1', questionVersion: 1, sectionId: '', sortOrder: 1, points: 1, type: 'mcq', text: 'نص للذكاء الاصطناعي', passage: 'قطعة للذكاء الاصطناعي', imageAssetId: '', imageUrl: 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg"/>', imageAlt: 'صورة السؤال', optionsEmbeddedInImage: false, learnerPresentation: {optionLabelStyle:'latin',showOptionText:true,showOptionLabels:false}, options: [{ index: 0, text: 'ثلاثون', assetId: '' }], selectedOptionIndex: 0, correctOptionIndex: 0, answered: true, correct: true, markedForReview: false, timeSpentSeconds: 1 }],
  } }));
  await page.goto('/assessment-results/attempt-1', { waitUntil: 'domcontentloaded' });
  await expect(page.getByRole('img', { name: 'صورة السؤال' })).toBeVisible();
  await expect(page.getByText('نص للذكاء الاصطناعي')).toHaveCount(0);
  await expect(page.getByText('قطعة للذكاء الاصطناعي')).toHaveCount(0);
  await expect(page.getByText('ثلاثون', { exact: true })).toHaveCount(0);
  await expect(page.getByText('A', { exact: true })).toBeVisible();
});

test('weak skill directs student to its own foundation and focused quiz', async ({ page }) => {
  test.setTimeout(120_000);
  await auth(page);
  const skill = { pathId:'path-1', subjectId:'subject-1', subjectName:'الكمي', skillId:'skill-1', skillName:'القسمة', questionCount:1, correctCount:0, mastery:0, status:'weak', foundationTopics:[{id:'topic-1',title:'قابلية القسمة',isLocked:false}] };
  await page.route('**/api/v1/assessment-attempts/attempt-1/review', route => json(route, { detail: {
    result:{attemptId:'attempt-1',score:0,totalQuestions:1,correctAnswers:0,wrongAnswers:1,unanswered:0,passed:false,timeSpentSeconds:5,finalizedAt:new Date().toISOString()},assessmentId:'assessment-1',assessmentVersion:1,title:'اختبار',attemptNumber:1,allowQuestionReview:false,showAnswers:false,showExplanations:false,showResultsReport:true,skillAnalysis:{complete:true,items:[skill]},
  } }));
  await page.goto('/assessment-results/attempt-1',{waitUntil:'domcontentloaded'});
  const link=page.getByRole('link',{name:'اختبار إضافي لهذه المهارة'});
  await expect(link).toBeVisible({timeout:30000});
  const href=await link.getAttribute('href');
  const url=new URL(href!,'http://local');
  expect(url.pathname).toBe('/quiz');
  expect(Object.fromEntries(url.searchParams)).toMatchObject({pathId:'path-1',subjectId:'subject-1',skillIds:'skill-1',evidenceType:'remediation'});
  await expect(page.getByRole('link',{name:'شرح التأسيس'})).toHaveAttribute('href',/topic=topic-1/);
  await expect(page.getByRole('link',{name:'تدريبات الموضوع'})).toHaveAttribute('href',/content=quizzes/);
});

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
  await page.setViewportSize({ width: 820, height: 1180 });
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
  await expect(page.getByRole('heading', { name: 'اختباراتي' })).toBeVisible();
  await expect(page.getByText('محاكي كمي')).toBeVisible();
  await page.screenshot({ path: 'test-results/assessment-results-history-tablet.png', fullPage: true });
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

test('review labels follow shuffled display positions while keeping answer identity', async ({ page }) => {
  test.setTimeout(90000);
  await page.goto('/tests/e2e/fixtures/result-review/', { waitUntil: 'domcontentloaded' });
  const selected = page.locator('div').filter({ hasText: /^أ\s*الخيار الثاني\s*اختيارك$/ }).last();
  const correct = page.locator('div').filter({ hasText: /^ب\s*الخيار الأول\s*الإجابة الصحيحة$/ }).last();
  await expect(selected).toBeVisible();
  await expect(correct).toBeVisible();
});
