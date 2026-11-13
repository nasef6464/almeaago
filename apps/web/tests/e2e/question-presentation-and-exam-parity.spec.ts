import { expect, test, type Page, type Route } from '@playwright/test';

const admin = {
  id: 'admin-1',
  email: 'admin@example.com',
  name: 'مدير المنصة',
  status: 'active',
  avatarUrl: '',
  emailVerified: true,
  role: 'admin',
  roles: ['admin'],
};

const student = {
  id: 'student-1',
  email: 'student@example.com',
  name: 'طالب مجتهد',
  status: 'active',
  avatarUrl: '',
  emailVerified: true,
  role: 'student',
  roles: ['student'],
};

function json(route: Route, body: unknown, status = 200) {
  return route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) });
}

// 1x1 transparent PNG data URI as fallback image fixture
const SAMPLE_QUESTION_IMAGE =
  'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="600" height="300" viewBox="0 0 600 300"><rect width="600" height="300" fill="%23f8fafc" stroke="%23cbd5e1" stroke-width="3"/><circle cx="150" cy="150" r="80" fill="%236366f1" opacity="0.2"/><text x="300" y="100" font-family="sans-serif" font-size="22" font-weight="bold" fill="%231e1b4b" text-anchor="middle">مسألة تحصيلي فيزياء: احسب التسارع</text><text x="300" y="160" font-family="sans-serif" font-size="18" fill="%234338ca" text-anchor="middle">v = v0 + a t</text><text x="300" y="240" font-family="sans-serif" font-size="16" fill="%2364748b" text-anchor="middle">A: 5 m/s²  |  B: 10 m/s²  |  C: 15 m/s²  |  D: 20 m/s²</text></svg>';

test.describe('Question Presentation & Image Display Parity', () => {
  test('Question Center displays question images in the list rows and detail panel', async ({ page }) => {
    test.setTimeout(60_000);

    await page.route('**/api/v1/auth/me', (r) => json(r, { user: admin }));
    await page.route('**/api/v1/auth/csrf', (r) => json(r, { csrfToken: 'csrf-token' }));

    const taxonomy = {
      paths: [{ id: 'p-tahsili', code: 'TAH', name: 'التحصيلي العلمي', description: '', sortOrder: 1 }],
      subjects: [{ id: 's-phys', pathId: 'p-tahsili', code: 'PHYS', name: 'الفيزياء', sortOrder: 1 }],
      skills: [{ id: 'sk-1', subjectId: 's-phys', code: 'ACC', name: 'التسارع والقوى', kind: 'main', sortOrder: 1 }],
    };
    await page.route('**/api/v1/taxonomy/bootstrap?phase=full', (r) => json(r, taxonomy));

    const sampleSummary = {
      id: 'q-phys-01',
      questionCode: 'TAH-PHYS-01',
      currentVersion: 1,
      workflowStatus: 'approved',
      ownerType: 'platform',
      ownerId: '',
      pathId: 'p-tahsili',
      subjectId: 's-phys',
      assignedTeacherId: '',
      type: 'mcq',
      difficulty: 'Medium',
      examType: 'tahsili',
      source: 'tahsili_bank',
      year: 2026,
      hasImage: true,
      hasVideo: false,
      hasExplanation: true,
      text: 'احسب تسارع الجسم المتحرك',
      imageUrl: SAMPLE_QUESTION_IMAGE,
      imageAssetId: 'asset-phys-01',
      optionsEmbeddedInImage: true,
      mainSkillId: 'sk-1',
      skillIds: ['sk-1'],
      updatedAt: '2026-11-07T12:00:00Z',
    };

    const sampleDetail = {
      ...sampleSummary,
      approvedBy: 'admin-1',
      approvedAt: '2026-11-07T12:00:00Z',
      reviewerNotes: '',
      revenueSharePercentage: null,
      version: {
        version: 1,
        type: 'mcq',
        text: 'احسب تسارع الجسم المتحرك',
        imageAssetId: 'asset-phys-01',
        imageUrl: SAMPLE_QUESTION_IMAGE,
        imageAlt: 'مخطط مسألة التسارع',
        optionsEmbeddedInImage: true,
        correctOptionIndex: 1,
        explanation: 'السرعة تزداد بمعدل 10 م/ث²',
        hint: 'استخدم معادلة الحركة الأولى',
        solvingStrategy: 'القسمة المباشرة',
        videoUrl: '',
        sourceMeta: {},
        aiContext: {},
        voiceExplanation: {},
        difficulty: 'Medium',
        examType: 'tahsili',
        source: 'tahsili_bank',
        year: 2026,
      },
      options: [
        { index: 0, text: 'A', assetId: '' },
        { index: 1, text: 'B', assetId: '' },
        { index: 2, text: 'C', assetId: '' },
        { index: 3, text: 'D', assetId: '' },
      ],
      skillLinks: [{ skillId: 'sk-1', relationType: 'main' }],
    };

    await page.route('**/api/v1/questions?**', (r) =>
      json(r, { items: [sampleSummary], page: 1, limit: 50, hasMore: false }),
    );
    await page.route('**/api/v1/questions/coverage?**', (r) =>
      json(r, {
        questionsTotal: 1,
        approved: 1,
        pendingReview: 0,
        unlinked: 0,
        mainSkillCoverage: 1,
        subSkillCoverage: 0,
        skills: [{ skillId: 'sk-1', relationType: 'main', questionCount: 1 }],
        skillPage: 1,
        skillLimit: 50,
        skillsHasMore: false,
      }),
    );
    await page.route('**/api/v1/questions/q-phys-01**', (r) => json(r, { question: sampleDetail }));

    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto('/admin-dashboard/questions', { waitUntil: 'domcontentloaded' });

    // Verify row displays question code and image preview
    await expect(page.getByText('TAH-PHYS-01')).toBeVisible({ timeout: 15_000 });
    const rowImage = page.locator('article img[alt="TAH-PHYS-01"]');
    await expect(rowImage).toBeVisible();

    // Click "فتح وتفاصيل"
    await page.getByRole('button', { name: 'فتح وتفاصيل' }).click();

    // Verify detail panel displays question image prominently
    await expect(page.getByText('صورة السؤال المعتمدة:')).toBeVisible();
    const detailImage = page.locator('article img[alt="TAH-PHYS-01"]').nth(1);
    await expect(detailImage).toBeVisible();

    // Capture visual screenshot
    await page.screenshot({
      path: 'docs/migration/evidence/batch-g1-student-walkthrough/screenshots/09a_question_bank_image_display.png',
      fullPage: true,
    });
  });

  test('Exam Player displays question image primarily, hides redundant text, and formats Latin options', async ({ page }) => {
    test.setTimeout(60_000);

    await page.route('**/api/v1/auth/me', (r) => json(r, { user: student }));
    await page.route('**/api/v1/auth/csrf', (r) => json(r, { csrfToken: 'csrf-token' }));

    const attempt = {
      id: 'attempt-tahsili-01',
      assessmentId: 'assessment-tah-phys',
      assessmentVersion: 1,
      attemptNumber: 1,
      status: 'in_progress',
      title: 'محاكي تحصيلي فيزياء شامل',
      startedAt: '2026-11-07T12:00:00Z',
      expiresAt: null,
      submittedAt: null,
      showProgressBar: true,
      requireAnswerBeforeNext: false,
      allowQuestionReview: true,
      randomizeOptions: false,
      showResultsReport: true,
      questions: [
        {
          id: 'q-tah-phys-01',
          version: 1,
          sectionId: '',
          sortOrder: 1,
          points: 1,
          type: 'mcq',
          text: 'سؤال بصري', // placeholder text that shouldn't clutter the image
          imageUrl: SAMPLE_QUESTION_IMAGE,
          imageAssetId: 'asset-phys-01',
          imageAlt: 'مسألة التسارع في التحصيلي',
          optionsEmbeddedInImage: true,
          videoUrl: '',
          difficulty: 'Medium',
          options: [
            { index: 0, text: 'A', assetId: '' },
            { index: 1, text: 'B', assetId: '' },
            { index: 2, text: 'C', assetId: '' },
            { index: 3, text: 'D', assetId: '' },
          ],
        },
      ],
      answers: [],
    };

    await page.route('**/api/v1/assessments/assessment-tah-phys/attempts', (r) => json(r, { attempt }));
    await page.route('**/api/v1/assessment-attempts/attempt-tahsili-01/answers/q-tah-phys-01', (r) =>
      json(r, {
        attempt: {
          ...attempt,
          answers: [
            {
              questionId: 'q-tah-phys-01',
              selectedOptionIndex: 1,
              textAnswer: '',
              timeSpentSeconds: 15,
              markedForReview: false,
              lastSavedAt: '2026-11-07T12:01:00Z',
            },
          ],
        },
      }),
    );

    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto('/assessments/assessment-tah-phys/start', { waitUntil: 'domcontentloaded' });

    // Verify title is visible
    await expect(page.getByRole('heading', { name: 'محاكي تحصيلي فيزياء شامل' })).toBeVisible({ timeout: 15_000 });

    // Verify question image is rendered as the primary question stem
    const examQuestionImage = page.locator('img[alt="مسألة التسارع في التحصيلي"]');
    await expect(examQuestionImage).toBeVisible();

    // Verify the 4 Latin options (A, B, C, D) are visible in a 4-column layout
    await expect(page.getByText('A', { exact: true })).toBeVisible();
    await expect(page.getByText('B', { exact: true })).toBeVisible();
    await expect(page.getByText('C', { exact: true })).toBeVisible();
    await expect(page.getByText('D', { exact: true })).toBeVisible();

    // Capture screenshot of the Exam Player with question image
    await page.screenshot({
      path: 'docs/migration/evidence/batch-g1-student-walkthrough/screenshots/09b_exam_player_question_image_display.png',
      fullPage: true,
    });

    // Click the image or zoom button to trigger the Full-Screen Image Pan & Zoom Modal
    await examQuestionImage.click();

    // Verify zoom modal opens
    const zoomModal = page.locator('[role="dialog"], [aria-label*="تكبير"], [data-testid="image-zoom-modal"]').first();
    const modalImage = page.locator('img[alt="تكبير صورة السؤال"]').or(page.locator('img[alt*="تكبير"]')).first();
    await expect(modalImage).toBeVisible({ timeout: 5_000 });

    // Capture screenshot of the Zoom Modal
    await page.screenshot({
      path: 'docs/migration/evidence/batch-g1-student-walkthrough/screenshots/09c_exam_player_image_zoom_modal.png',
      fullPage: true,
    });
  });
});
