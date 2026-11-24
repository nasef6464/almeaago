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
  await page.setViewportSize({ width: 820, height: 1180 });
  await page.addInitScript(() => Object.defineProperty(navigator, 'share', { configurable: true, value: undefined }));
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
  const fallback = page.getByRole('link', { name: 'شارك نتيجتك وتحدّ أصدقاءك' });
  const shareURL = new URL((await fallback.getAttribute('href'))!);
  expect(shareURL.origin).toBe('https://wa.me');
  expect(shareURL.searchParams.get('text')).toContain('حققت 50% في اختبار محاكي كمي');
  expect(shareURL.searchParams.get('text')).not.toContain(user.email);
});

test('mobile review filters wrong unanswered and correct questions without leaking hidden key', async ({ page }) => {
  await auth(page);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.addInitScript(() => {
    Object.defineProperty(navigator, 'share', { configurable: true, value: async (data: ShareData) => {
      document.body.dataset.sharedScorecard = data.text;
    } });
  });
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
        subjectResults: [
          { subjectId: 'math', subjectName: 'الرياضيات', total: 1, correct: 0, wrong: 1, unanswered: 0, score: 0 },
        ],
      },
    }),
  );

  await page.goto('/assessment-results/attempt-1');
  await expect(page.getByRole('heading', { name: 'محاكي كمي' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'نتيجة الاختبار' })).toBeVisible();
  await expect(page.getByText('ملخص النتيجة')).toBeVisible();
  const subjects = page.getByRole('region', { name: 'أداؤك لكل مادة' });
  await expect(subjects.getByText('تفصيل المواد غير مكتمل؛ الأسئلة المصنفة 1 من 2.')).toBeVisible();
  await expect(subjects.getByRole('progressbar', { name: 'درجة الرياضيات' })).toHaveAttribute('aria-valuenow', '0');
  const share = page.getByRole('button', { name: 'شارك نتيجتك وتحدّ أصدقاءك' });
  await share.click();
  await expect(page.locator('body')).toHaveAttribute('data-shared-scorecard', /حققت 50% في اختبار محاكي كمي/);
  for (const width of [390, 820, 1440]) {
    await page.setViewportSize({ width, height: 915 });
    await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width);
    await page.screenshot({ path: 'test-results/assessment-result-summary-' + width + '.png', fullPage: true });
  }
  await page.setViewportSize({ width: 390, height: 844 });
  await expect(page.getByRole('button', { name: 'تحميل PDF' })).toBeVisible();
  await expect(page.getByText('٢ + ٢ = ؟')).toHaveCount(0);
  await page.getByRole('button', { name: 'عرض التقرير الكامل' }).click();
  await expect(page.getByRole('button', { name: 'العودة للملخص البسيط' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'ملخص سريع لولي الأمر أو المعلم' })).toBeVisible();
  for (const width of [390, 820, 1440]) {
    await page.setViewportSize({ width, height: 915 });
    await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width);
    await page.screenshot({ path: `test-results/assessment-result-full-${width}.png`, fullPage: true });
  }
  await page.setViewportSize({ width: 390, height: 844 });
  await page.getByRole('button', { name: 'العودة للملخص البسيط' }).click();
  await expect(page.getByRole('heading', { name: 'ملخص سريع لولي الأمر أو المعلم' })).toHaveCount(0);
  await page.getByRole('button', { name: 'مراجعة الأسئلة (2)' }).click();
  await expect(share).toHaveCount(0);
  await page.getByRole('button', { name: /لوحة الأسئلة/ }).click();
  await page.getByRole('button', { name: /الأخطاء فقط/ }).click();
  await expect(page.getByText('٢ + ٢ = ؟')).toBeVisible();
  await expect(page.getByText('٥ + ٥ = ؟')).toHaveCount(0);
  await expect(page.getByText('الإجابة الصحيحة')).toHaveCount(0);
  await page.getByRole('button', { name: 'إظهار الملاحظات' }).click();
  await expect(page.getByRole('region', { name: 'ملاحظات السؤال' })).toContainText('الشرح التحريري غير متاح');
  await expect(page.getByText('الإجابة الصحيحة')).toHaveCount(0);

  await page.getByRole('button', { name: 'بدون إجابة' }).click();
  await expect(page.getByText('٥ + ٥ = ؟')).toBeVisible();

  await page.getByRole('button', { name: /^الصحيحة/ }).click();
  await expect(page.getByText('لا توجد أسئلة في هذا التصنيف.')).toBeVisible();
  await page.getByRole('button', { name: /^الكل/ }).click();
  await expect(page.getByText('٢ + ٢ = ؟')).toBeVisible();
  for (const width of [390, 820, 1440]) {
    await page.setViewportSize({ width, height: 915 });
    await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width);
    await page.screenshot({ path: 'test-results/assessment-result-review-' + width + '.png', fullPage: true });
  }
});

test('subject skills nest only under a measured main skill in the same subject', async ({ page }) => {
  await auth(page);
  const baseSkill = { pathId: 'path-1', subjectId: 'math', subjectName: 'الرياضيات', questionCount: 1, correctCount: 0, mastery: 0, status: 'weak' };
  await page.route('**/api/v1/assessment-attempts/attempt-1/review', route => json(route, {
    detail: {
      result: historyItem, assessmentId: 'assessment-1', assessmentVersion: 2, title: 'محاكي كمي', attemptNumber: 1,
      allowQuestionReview: false, showAnswers: false, showExplanations: false, showResultsReport: true,
      subjectResults: [
        { subjectId: 'math', subjectName: 'الرياضيات', total: 1, correct: 0, wrong: 1, unanswered: 0, score: 0 },
        { subjectId: 'science', subjectName: 'العلوم', total: 1, correct: 0, wrong: 0, unanswered: 1, score: 0 },
      ],
      skillAnalysis: { complete: true, items: [
        { ...baseSkill, skillId: 'child', skillName: 'قسمة الكسور', level: 'sub', parentSkillId: 'parent' },
        { ...baseSkill, skillId: 'parent', skillName: 'الكسور', level: 'main' },
        { ...baseSkill, skillId: 'orphan', skillName: 'تحويل الوحدات', level: 'sub', parentSkillId: 'unmeasured' },
        { ...baseSkill, skillId: 'foreign-child', skillName: 'التقريب', level: 'sub', parentSkillId: 'foreign-parent' },
        { ...baseSkill, skillId: 'historic', skillName: 'الجبر', foundationTopics: [] },
        { ...baseSkill, subjectId: 'science', subjectName: 'العلوم', skillId: 'foreign-parent', skillName: 'الحركة', level: 'main' },
      ] },
    },
  }));
  await page.goto('/assessment-results/attempt-1', { waitUntil: 'domcontentloaded' });
  const math = page.getByRole('region', { name: 'أداؤك في مادة الرياضيات' });
  await math.getByText('تفاصيل المهارات (5)').click();
  const children = math.getByRole('group', { name: 'المهارات الفرعية ضمن الكسور' });
  await expect(children.getByRole('progressbar', { name: 'قسمة الكسور' })).toBeVisible();
  await expect(math.getByRole('progressbar', { name: 'تحويل الوحدات' })).toBeVisible();
  await expect(math.getByRole('progressbar', { name: 'التقريب' })).toBeVisible();
  await expect(math.getByRole('progressbar', { name: 'الجبر' })).toBeVisible();
  await expect(math.getByRole('group', { name: /^المهارات الفرعية ضمن/ })).toHaveCount(1);
  await expect(math.getByRole('progressbar', { name: 'الحركة' })).toHaveCount(0);
});
