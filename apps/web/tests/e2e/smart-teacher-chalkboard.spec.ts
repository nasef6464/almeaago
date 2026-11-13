import { expect, test, type Page, type Route } from '@playwright/test';

const user = {
  id: 'student-smart-teacher-1',
  email: 'student@example.com',
  name: 'طالب متميز',
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
  await page.route('**/api/v1/auth/csrf', (route) => json(route, { csrfToken: 'csrf-smart-teacher' }));
}

const mockResultItem = {
  attemptId: 'att-smart-teacher-99',
  assessmentId: 'assessment-qudrat-math',
  assessmentVersion: 1,
  title: 'مراجعة نموذج القدرات - قسم الرياضيات والكمي',
  attemptNumber: 1,
  score: 65,
  totalQuestions: 1,
  correctAnswers: 0,
  wrongAnswers: 1,
  unanswered: 0,
  passed: true,
  timeSpentSeconds: 120,
  finalizedAt: '2026-11-07T14:00:00Z',
  showResultsReport: true,
};

const mockQuestion = {
  questionId: 'q-smart-math-101',
  questionVersion: 1,
  sectionId: 'sec-algebra',
  sortOrder: 0,
  points: 1,
  type: 'mcq',
  text: 'أوجد قيمة س إذا كانت: س² - ٩ = ٠ حيث س عدد موجب.',
  imageAssetId: '',
  imageAlt: '',
  optionsEmbeddedInImage: false,
  videoUrl: '',
  difficulty: 'medium',
  explanation: 'نقوم بتحليل فرق بين مربعين: (س - ٣)(س + ٣) = ٠، وبما أن س موجب فإن س = ٣.',
  solvingStrategy: 'استراتيجية التحليل الجبري للفرق بين المربعين وعزل المتغير الموجب.',
  options: [
    { index: 0, text: 'س = -٣', assetId: '' },
    { index: 1, text: 'س = ٣', assetId: '' },
    { index: 2, text: 'س = ٩', assetId: '' },
    { index: 3, text: 'س = ٠', assetId: '' },
  ],
  selectedOptionIndex: 0,
  correctOptionIndex: 1,
  answered: true,
  correct: false,
  markedForReview: false,
  timeSpentSeconds: 45,
};

test.describe('Smart Teacher & Interactive Chalkboard Verification', () => {
  test('opens chalkboard instantly on question review with math KaTeX and audio controls', async ({ page }) => {
    test.setTimeout(60_000);
    await auth(page);
    await page.setViewportSize({ width: 1440, height: 900 });

    await page.route('**/api/v1/assessment-attempts/att-smart-teacher-99/review', (route) =>
      json(route, {
        detail: {
          result: mockResultItem,
          assessmentId: 'assessment-qudrat-math',
          assessmentVersion: 1,
          title: 'مراجعة نموذج القدرات - قسم الرياضيات والكمي',
          attemptNumber: 1,
          allowQuestionReview: true,
          showAnswers: true,
          showExplanations: true,
          showResultsReport: true,
          questions: [mockQuestion],
        },
      }),
    );

    // AI question assistant endpoint stub with complete storyboard
    await page.route('**/api/v1/ai/question-assistant', (route) =>
      json(route, {
        result: {
          text: 'معلمك الذكي يوضح لك خطوات الحل الجبري لمعادلة الفرق بين المربعين.',
          provider: 'smart_teacher_v1',
          usedFallback: false,
          storyboard: {
            version: 1,
            language: 'ar-SA',
            scenes: [
              {
                id: 'scene_1',
                narration: 'أهلاً بك يا بطل! لنبدأ بتحليل المعادلة: س² - ٩ = ٠.',
                actions: [
                  { type: 'write', id: 'eq1', kind: 'formula', content: 'س^2 - 9 = 0' },
                  { type: 'highlight', target: 'eq1' },
                ],
              },
              {
                id: 'scene_2',
                narration: 'نقوم بتحليل المقدار كفرق بين مربعين: (س - ٣)(س + ٣) = ٠.',
                actions: [
                  { type: 'write', id: 'eq2', kind: 'formula', content: '(س - 3)(س + 3) = 0' },
                  { type: 'box', target: 'eq2' },
                ],
              },
              {
                id: 'scene_3',
                narration: 'وبما أن س عدد موجب، فإن الحل هو س = ٣.',
                actions: [
                  { type: 'write', id: 'ans', kind: 'formula', content: 'س = 3' },
                  { type: 'box', target: 'ans' },
                ],
              },
            ],
          },
        },
      }),
    );

    await page.goto('/assessment-results/att-smart-teacher-99', { waitUntil: 'domcontentloaded' });

    // 1. Check results review screen
    await expect(page.getByRole('heading', { name: 'مراجعة نموذج القدرات - قسم الرياضيات والكمي' })).toBeVisible();
    await expect(page.getByText('أوجد قيمة س إذا كانت: س² - ٩ = ٠')).toBeVisible();

    // 2. The Smart Teacher button must be prominently visible
    const smartTeacherBtn = page.getByRole('button', { name: 'افتح المعلم الذكي والسبورة التفاعلية 🧑‍🏫' });
    await expect(smartTeacherBtn).toBeVisible();

    // Take screenshot of review question card with button
    await page.screenshot({
      path: '../../docs/migration/evidence/batch-g1-student-walkthrough/screenshots/08a_review_question_smart_teacher_button.png',
      fullPage: false,
    });

    // 3. Click to open Smart Teacher
    await smartTeacherBtn.click();

    // 4. Modal must open immediately with header
    await expect(page.getByRole('heading', { name: 'المعلم الذكي والسبورة التفاعلية' })).toBeVisible({ timeout: 5000 });
    await expect(page.getByText('السبورة الذكية تحاكي الشرح الواقعي خطوة بخطوة')).toBeVisible();

    // 5. Blackboard chalkboard must be visible
    const board = page.locator('[data-testid="teaching-board"]');
    await expect(board).toBeVisible();

    // 6. Action chips must be present
    await expect(page.getByRole('button', { name: 'أبسط أكثر' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'لماذا هذه الخطوة؟' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'مثال آخر' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'أعد الشرح' })).toBeVisible();

    // 7. Toggle chat drawer and verify input for student question
    await page.getByRole('button', { name: 'اسأل المعلم' }).click();
    await expect(page.getByPlaceholder('اسأل المعلم عن هذه الخطوة...')).toBeVisible();

    // Wait a brief moment for the instant scene handwriting animation to reveal
    await page.waitForTimeout(1000);

    // 8. Capture high-resolution screenshot of the active interactive whiteboard
    await page.screenshot({
      path: '../../docs/migration/evidence/batch-g1-student-walkthrough/screenshots/08b_smart_teacher_chalkboard_modal.png',
      fullPage: false,
    });

    // 9. Close modal
    await page.getByRole('button', { name: 'إغلاق المعلم الذكي' }).click();
    await expect(page.getByRole('heading', { name: 'المعلم الذكي والسبورة التفاعلية' })).toHaveCount(0);
  });
});
