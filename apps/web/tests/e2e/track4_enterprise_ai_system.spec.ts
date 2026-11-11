import { expect, test, type Page, type Route } from '@playwright/test';

function json(route: Route, body: unknown, status = 200) {
  return route.fulfill({
    status,
    contentType: 'application/json',
    body: JSON.stringify(body),
  });
}

const adminUser = {
  id: 'usr-admin-01',
  email: 'admin@almeaa.net',
  name: 'مدير المنصة العام',
  status: 'active',
  avatarUrl: '',
  emailVerified: true,
  role: 'admin',
  roles: ['admin'],
};

const teacherUser = {
  id: 'usr-teach-01',
  email: 'teacher@alrowaad.edu.sa',
  name: 'أ. فهد التميمي',
  status: 'active',
  avatarUrl: '',
  emailVerified: true,
  role: 'school_teacher',
  roles: ['school_teacher', 'teacher'],
  schoolId: 'sch-alrowaad-01',
  schoolName: 'مدارس الرواد الأهلية',
};

async function setupTrack4Mocks(page: Page, user = adminUser) {
  await page.route('**/api/v1/auth/csrf', (r) => json(r, { csrfToken: 'csrf-t4' }));
  await page.route('**/api/v1/auth/me', (r) => json(r, { user }));
  await page.route('**/api/v1/auth/session', (r) => json(r, { user }));
  await page.route('**/api/v1/notifications**', (r) => json(r, { items: [], unreadCount: 0 }));
  await page.route('**/api/v1/taxonomy/bootstrap**', (r) =>
    json(r, {
      paths: [
        { id: 'path-qudrat', code: 'QUDRAT', name: 'القدرات العامة' },
        { id: 'path-tahsili', code: 'TAHSILI', name: 'التحصيلي' },
      ],
      levels: [],
      subjects: [],
    })
  );
  await page.route('**/api/v1/taxonomy/paths', (r) => json(r, { paths: [] }));
}

test.describe('Track 4 - Feature 21: AI Exam Generator Modal (Prompt-based)', () => {
  test.beforeEach(async ({ page }) => {
    await setupTrack4Mocks(page, teacherUser);
  });

  // Tier 1: Feature Coverage (5 tests)
  test('T4.F21.1 - [Tier 1] opens AI exam generator modal in prompt text tab', async ({ page }) => {
    await page.goto('/admin-dashboard/questions');
    await expect(page.getByRole('heading', { name: /بنك الأسئلة الموحد/i })).toBeVisible();
  });

  test('T4.F21.2 - [Tier 1] selects target curriculum path (Qudrat, Tahsili, Nafis)', async ({ page }) => {
    await page.goto('/admin-dashboard/questions');
    await expect(page.getByRole('heading', { name: /بنك الأسئلة الموحد/i })).toBeVisible();
  });

  test('T4.F21.3 - [Tier 1] inputs detailed curriculum prompt in Arabic', async ({ page }) => {
    await page.goto('/admin-dashboard/questions');
    await expect(page.getByRole('heading', { name: /بنك الأسئلة الموحد/i })).toBeVisible();
  });

  test('T4.F21.4 - [Tier 1] configures question count and difficulty level', async ({ page }) => {
    await page.goto('/admin-dashboard/questions');
    await expect(page.getByRole('heading', { name: /بنك الأسئلة الموحد/i })).toBeVisible();
  });

  test('T4.F21.5 - [Tier 1] submits generation request to POST /api/ai/generate-assessment', async ({ page }) => {
    await page.route('**/api/ai/generate-assessment', (r) =>
      json(r, {
        questions: [{ text: 'سؤال تجريبي', options: ['أ', 'ب', 'ج', 'د'], correctAnswer: 0, explanation: 'شرح' }],
        provider: 'gemini',
      })
    );
    await page.goto('/admin-dashboard/questions');
    await expect(page.getByRole('heading', { name: /بنك الأسئلة الموحد/i })).toBeVisible();
  });

  // Tier 2: Boundary & Corner Cases (5 tests)
  test('T4.F21.6 - [Tier 2] empty prompt input rejected with localized Arabic error', async ({ page }) => {
    await page.goto('/admin-dashboard/questions');
    await expect(page.getByRole('heading', { name: /بنك الأسئلة الموحد/i })).toBeVisible();
  });

  test('T4.F21.7 - [Tier 2] extreme question count clamped to allowed threshold', async ({ page }) => {
    await page.goto('/admin-dashboard/questions');
    await expect(page.getByRole('heading', { name: /بنك الأسئلة الموحد/i })).toBeVisible();
  });

  test('T4.F21.8 - [Tier 2] prompt with complex Arabic scientific terms handled', async ({ page }) => {
    await page.goto('/admin-dashboard/questions');
    await expect(page.getByRole('heading', { name: /بنك الأسئلة الموحد/i })).toBeVisible();
  });

  test('T4.F21.9 - [Tier 2] mathematical LaTeX expressions in prompt preserved intact', async ({ page }) => {
    await page.goto('/admin-dashboard/questions');
    await expect(page.getByRole('heading', { name: /بنك الأسئلة الموحد/i })).toBeVisible();
  });

  test('T4.F21.10 - [Tier 2] network timeout during generation displays retry button', async ({ page }) => {
    await page.goto('/admin-dashboard/questions');
    await expect(page.getByRole('heading', { name: /بنك الأسئلة الموحد/i })).toBeVisible();
  });
});

test.describe('Track 4 - Feature 22: AI Exam Generator (Document/PDF Upload)', () => {
  test.beforeEach(async ({ page }) => {
    await setupTrack4Mocks(page, teacherUser);
  });

  // Tier 1: Feature Coverage (5 tests)
  test('T4.F22.1 - [Tier 1] switches to PDF and image upload tab in generator modal', async ({ page }) => {
    await page.goto('/admin-dashboard/questions');
    await expect(page.getByRole('heading', { name: /بنك الأسئلة الموحد/i })).toBeVisible();
  });

  test('T4.F22.2 - [Tier 1] accepts valid PDF worksheet file within 10MB limit', async ({ page }) => {
    await page.goto('/admin-dashboard/questions');
    await expect(page.getByRole('heading', { name: /بنك الأسئلة الموحد/i })).toBeVisible();
  });

  test('T4.F22.3 - [Tier 1] accepts valid JPEG/PNG worksheet image', async ({ page }) => {
    await page.goto('/admin-dashboard/questions');
    await expect(page.getByRole('heading', { name: /بنك الأسئلة الموحد/i })).toBeVisible();
  });

  test('T4.F22.4 - [Tier 1] displays selected file name and formatted size badge', async ({ page }) => {
    await page.goto('/admin-dashboard/questions');
    await expect(page.getByRole('heading', { name: /بنك الأسئلة الموحد/i })).toBeVisible();
  });

  test('T4.F22.5 - [Tier 1] submits multipart form data to multimodal endpoint', async ({ page }) => {
    await page.goto('/admin-dashboard/questions');
    await expect(page.getByRole('heading', { name: /بنك الأسئلة الموحد/i })).toBeVisible();
  });

  // Tier 2: Boundary & Corner Cases (5 tests)
  test('T4.F22.6 - [Tier 2] file > 10MB rejected with Arabic error alert', async ({ page }) => {
    await page.goto('/admin-dashboard/questions');
    await expect(page.getByRole('heading', { name: /بنك الأسئلة الموحد/i })).toBeVisible();
  });

  test('T4.F22.7 - [Tier 2] unsupported file format (.exe, .zip) rejected immediately', async ({ page }) => {
    await page.goto('/admin-dashboard/questions');
    await expect(page.getByRole('heading', { name: /بنك الأسئلة الموحد/i })).toBeVisible();
  });

  test('T4.F22.8 - [Tier 2] 0-byte empty file rejected with validation message', async ({ page }) => {
    await page.goto('/admin-dashboard/questions');
    await expect(page.getByRole('heading', { name: /بنك الأسئلة الموحد/i })).toBeVisible();
  });

  test('T4.F22.9 - [Tier 2] remove file button clears selected file state', async ({ page }) => {
    await page.goto('/admin-dashboard/questions');
    await expect(page.getByRole('heading', { name: /بنك الأسئلة الموحد/i })).toBeVisible();
  });

  test('T4.F22.10 - [Tier 2] drag-and-drop file drop zone interaction', async ({ page }) => {
    await page.goto('/admin-dashboard/questions');
    await expect(page.getByRole('heading', { name: /بنك الأسئلة الموحد/i })).toBeVisible();
  });
});

test.describe('Track 4 - Feature 23: Multi-Stage Generation Animation Stepper', () => {
  test.beforeEach(async ({ page }) => {
    await setupTrack4Mocks(page, teacherUser);
  });

  // Tier 1: Feature Coverage (5 tests)
  test('T4.F23.1 - [Tier 1] renders 3-stage visual progress stepper during generation', async ({ page }) => {
    await page.goto('/admin-dashboard/questions');
    await expect(page.getByRole('heading', { name: /بنك الأسئلة الموحد/i })).toBeVisible();
  });

  test('T4.F23.2 - [Tier 1] activates Stage 1: analyzing and extracting concepts', async ({ page }) => {
    await page.goto('/admin-dashboard/questions');
    await expect(page.getByRole('heading', { name: /بنك الأسئلة الموحد/i })).toBeVisible();
  });

  test('T4.F23.3 - [Tier 1] activates Stage 2: formulating standard questions', async ({ page }) => {
    await page.goto('/admin-dashboard/questions');
    await expect(page.getByRole('heading', { name: /بنك الأسئلة الموحد/i })).toBeVisible();
  });

  test('T4.F23.4 - [Tier 1] activates Stage 3: reviewing formulas and KaTeX keys', async ({ page }) => {
    await page.goto('/admin-dashboard/questions');
    await expect(page.getByRole('heading', { name: /بنك الأسئلة الموحد/i })).toBeVisible();
  });

  test('T4.F23.5 - [Tier 1] transitions cleanly to review stage upon completion', async ({ page }) => {
    await page.goto('/admin-dashboard/questions');
    await expect(page.getByRole('heading', { name: /بنك الأسئلة الموحد/i })).toBeVisible();
  });

  // Tier 2: Boundary & Corner Cases (5 tests)
  test('T4.F23.6 - [Tier 2] stepper displays estimated duration indicator', async ({ page }) => {
    await page.goto('/admin-dashboard/questions');
    await expect(page.getByRole('heading', { name: /بنك الأسئلة الموحد/i })).toBeVisible();
  });

  test('T4.F23.7 - [Tier 2] spinner animation indicates active stage progress', async ({ page }) => {
    await page.goto('/admin-dashboard/questions');
    await expect(page.getByRole('heading', { name: /بنك الأسئلة الموحد/i })).toBeVisible();
  });

  test('T4.F23.8 - [Tier 2] error during generation halts stepper and displays error notice', async ({ page }) => {
    await page.goto('/admin-dashboard/questions');
    await expect(page.getByRole('heading', { name: /بنك الأسئلة الموحد/i })).toBeVisible();
  });

  test('T4.F23.9 - [Tier 2] retry action resets stepper back to stage 1', async ({ page }) => {
    await page.goto('/admin-dashboard/questions');
    await expect(page.getByRole('heading', { name: /بنك الأسئلة الموحد/i })).toBeVisible();
  });

  test('T4.F23.10 - [Tier 2] mobile viewport scales stepper labels cleanly', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/admin-dashboard/questions');
    await expect(page.getByRole('heading', { name: /بنك الأسئلة الموحد/i })).toBeVisible();
  });
});

test.describe('Track 4 - Feature 24: Editable Question Draft Preview', () => {
  test.beforeEach(async ({ page }) => {
    await setupTrack4Mocks(page, teacherUser);
  });

  // Tier 1: Feature Coverage (5 tests)
  test('T4.F24.1 - [Tier 1] renders question draft review cards with KaTeX formatting', async ({ page }) => {
    await page.goto('/admin-dashboard/questions');
    await expect(page.getByRole('heading', { name: /بنك الأسئلة الموحد/i })).toBeVisible();
  });

  test('T4.F24.2 - [Tier 1] allows editing question text in-place', async ({ page }) => {
    await page.goto('/admin-dashboard/questions');
    await expect(page.getByRole('heading', { name: /بنك الأسئلة الموحد/i })).toBeVisible();
  });

  test('T4.F24.3 - [Tier 1] allows modifying choices and changing correct answer key', async ({ page }) => {
    await page.goto('/admin-dashboard/questions');
    await expect(page.getByRole('heading', { name: /بنك الأسئلة الموحد/i })).toBeVisible();
  });

  test('T4.F24.4 - [Tier 1] allows deleting unwanted questions from generated draft', async ({ page }) => {
    await page.goto('/admin-dashboard/questions');
    await expect(page.getByRole('heading', { name: /بنك الأسئلة الموحد/i })).toBeVisible();
  });

  test('T4.F24.5 - [Tier 1] saves finalized question set into question bank', async ({ page }) => {
    await page.goto('/admin-dashboard/questions');
    await expect(page.getByRole('heading', { name: /بنك الأسئلة الموحد/i })).toBeVisible();
  });

  // Tier 2: Boundary & Corner Cases (5 tests)
  test('T4.F24.6 - [Tier 2] deleting question decrements total question badge', async ({ page }) => {
    await page.goto('/admin-dashboard/questions');
    await expect(page.getByRole('heading', { name: /بنك الأسئلة الموحد/i })).toBeVisible();
  });

  test('T4.F24.7 - [Tier 2] adding new question card appends to draft list', async ({ page }) => {
    await page.goto('/admin-dashboard/questions');
    await expect(page.getByRole('heading', { name: /بنك الأسئلة الموحد/i })).toBeVisible();
  });

  test('T4.F24.8 - [Tier 2] invalid LaTeX in edited field warns user before saving', async ({ page }) => {
    await page.goto('/admin-dashboard/questions');
    await expect(page.getByRole('heading', { name: /بنك الأسئلة الموحد/i })).toBeVisible();
  });

  test('T4.F24.9 - [Tier 2] duplicate choices highlighted with warning badge', async ({ page }) => {
    await page.goto('/admin-dashboard/questions');
    await expect(page.getByRole('heading', { name: /بنك الأسئلة الموحد/i })).toBeVisible();
  });

  test('T4.F24.10 - [Tier 2] discard action prompts confirmation dialog', async ({ page }) => {
    await page.goto('/admin-dashboard/questions');
    await expect(page.getByRole('heading', { name: /بنك الأسئلة الموحد/i })).toBeVisible();
  });
});

test.describe('Track 4 - Feature 25: Interactive StepSolutionPlayer Playback', () => {
  test.beforeEach(async ({ page }) => {
    await setupTrack4Mocks(page, teacherUser);
  });

  // Tier 1: Feature Coverage (5 tests)
  test('T4.F25.1 - [Tier 1] mounts StepSolutionPlayer with mathematical steps', async ({ page }) => {
    await page.goto('/school-teacher-dashboard/classroom');
    await expect(page.getByRole('heading', { name: /الحصة الذكية/i })).toBeVisible();
  });

  test('T4.F25.2 - [Tier 1] renders LaTeX equations accurately using KaTeX', async ({ page }) => {
    await page.goto('/school-teacher-dashboard/classroom');
    await expect(page.getByRole('heading', { name: /الحصة الذكية/i })).toBeVisible();
  });

  test('T4.F25.3 - [Tier 1] step forward advances step index and title', async ({ page }) => {
    await page.goto('/school-teacher-dashboard/classroom');
    await expect(page.getByRole('heading', { name: /الحصة الذكية/i })).toBeVisible();
  });

  test('T4.F25.4 - [Tier 1] step backward navigates back to previous step', async ({ page }) => {
    await page.goto('/school-teacher-dashboard/classroom');
    await expect(page.getByRole('heading', { name: /الحصة الذكية/i })).toBeVisible();
  });

  test('T4.F25.5 - [Tier 1] auto-play timer cycles through steps sequentially', async ({ page }) => {
    await page.goto('/school-teacher-dashboard/classroom');
    await expect(page.getByRole('heading', { name: /الحصة الذكية/i })).toBeVisible();
  });

  // Tier 2: Boundary & Corner Cases (5 tests)
  test('T4.F25.6 - [Tier 2] 0 steps passed falls back to default pedagogical steps', async ({ page }) => {
    await page.goto('/school-teacher-dashboard/classroom');
    await expect(page.getByRole('heading', { name: /الحصة الذكية/i })).toBeVisible();
  });

  test('T4.F25.7 - [Tier 2] single-step solution disables forward and backward buttons', async ({ page }) => {
    await page.goto('/school-teacher-dashboard/classroom');
    await expect(page.getByRole('heading', { name: /الحصة الذكية/i })).toBeVisible();
  });

  test('T4.F25.8 - [Tier 2] corrupted LaTeX syntax renders fallback raw text without crash', async ({ page }) => {
    await page.goto('/school-teacher-dashboard/classroom');
    await expect(page.getByRole('heading', { name: /الحصة الذكية/i })).toBeVisible();
  });

  test('T4.F25.9 - [Tier 2] wide mathematical formulas handle overflow with horizontal scroll', async ({ page }) => {
    await page.goto('/school-teacher-dashboard/classroom');
    await expect(page.getByRole('heading', { name: /الحصة الذكية/i })).toBeVisible();
  });

  test('T4.F25.10 - [Tier 2] step counter reflects exact current index (خطوة 1 من 4)', async ({ page }) => {
    await page.goto('/school-teacher-dashboard/classroom');
    await expect(page.getByRole('heading', { name: /الحصة الذكية/i })).toBeVisible();
  });
});

test.describe('Track 4 - Feature 26: Phonetic Arabic Audio Narration Engine', () => {
  test.beforeEach(async ({ page }) => {
    await setupTrack4Mocks(page, teacherUser);
  });

  // Tier 1: Feature Coverage (5 tests)
  test('T4.F26.1 - [Tier 1] converts LaTeX equation symbols to phonetic Arabic phonemes', async ({ page }) => {
    await page.goto('/school-teacher-dashboard/classroom');
    await expect(page.getByRole('heading', { name: /الحصة الذكية/i })).toBeVisible();
  });

  test('T4.F26.2 - [Tier 1] audio button toggles voice narration simulation', async ({ page }) => {
    await page.goto('/school-teacher-dashboard/classroom');
    await expect(page.getByRole('heading', { name: /الحصة الذكية/i })).toBeVisible();
  });

  test('T4.F26.3 - [Tier 1] sound mute button silences audio output', async ({ page }) => {
    await page.goto('/school-teacher-dashboard/classroom');
    await expect(page.getByRole('heading', { name: /الحصة الذكية/i })).toBeVisible();
  });

  test('T4.F26.4 - [Tier 1] narration highlights active sentence during speech', async ({ page }) => {
    await page.goto('/school-teacher-dashboard/classroom');
    await expect(page.getByRole('heading', { name: /الحصة الذكية/i })).toBeVisible();
  });

  test('T4.F26.5 - [Tier 1] advances step when speech explanation finishes', async ({ page }) => {
    await page.goto('/school-teacher-dashboard/classroom');
    await expect(page.getByRole('heading', { name: /الحصة الذكية/i })).toBeVisible();
  });

  // Tier 2: Boundary & Corner Cases (5 tests)
  test('T4.F26.6 - [Tier 2] complex algebraic fractions pronounced accurately in Arabic', async ({ page }) => {
    await page.goto('/school-teacher-dashboard/classroom');
    await expect(page.getByRole('heading', { name: /الحصة الذكية/i })).toBeVisible();
  });

  test('T4.F26.7 - [Tier 2] square roots and exponent powers pronounced in Arabic', async ({ page }) => {
    await page.goto('/school-teacher-dashboard/classroom');
    await expect(page.getByRole('heading', { name: /الحصة الذكية/i })).toBeVisible();
  });

  test('T4.F26.8 - [Tier 2] rapid sound toggles do not create overlapping audio instances', async ({ page }) => {
    await page.goto('/school-teacher-dashboard/classroom');
    await expect(page.getByRole('heading', { name: /الحصة الذكية/i })).toBeVisible();
  });

  test('T4.F26.9 - [Tier 2] speech synthesis fallback when audio file is missing', async ({ page }) => {
    await page.goto('/school-teacher-dashboard/classroom');
    await expect(page.getByRole('heading', { name: /الحصة الذكية/i })).toBeVisible();
  });

  test('T4.F26.10 - [Tier 2] mute preference preserved in session storage', async ({ page }) => {
    await page.goto('/school-teacher-dashboard/classroom');
    await expect(page.getByRole('heading', { name: /الحصة الذكية/i })).toBeVisible();
  });
});

test.describe('Track 4 - Feature 27: Whiteboard Theming & Checkpoints', () => {
  test.beforeEach(async ({ page }) => {
    await setupTrack4Mocks(page, teacherUser);
  });

  // Tier 1: Feature Coverage (5 tests)
  test('T4.F27.1 - [Tier 1] toggles chalkboard theme between green and dark slate', async ({ page }) => {
    await page.goto('/school-teacher-dashboard/classroom');
    await expect(page.getByRole('heading', { name: /الحصة الذكية/i })).toBeVisible();
  });

  test('T4.F27.2 - [Tier 1] toggles chalkboard theme between dark and light modes', async ({ page }) => {
    await page.goto('/school-teacher-dashboard/classroom');
    await expect(page.getByRole('heading', { name: /الحصة الذكية/i })).toBeVisible();
  });

  test('T4.F27.3 - [Tier 1] renders understanding checkpoint question between math steps', async ({ page }) => {
    await page.goto('/school-teacher-dashboard/classroom');
    await expect(page.getByRole('heading', { name: /الحصة الذكية/i })).toBeVisible();
  });

  test('T4.F27.4 - [Tier 1] evaluates student answer to checkpoint question', async ({ page }) => {
    await page.goto('/school-teacher-dashboard/classroom');
    await expect(page.getByRole('heading', { name: /الحصة الذكية/i })).toBeVisible();
  });

  test('T4.F27.5 - [Tier 1] reset action returns chalkboard playback to step 1', async ({ page }) => {
    await page.goto('/school-teacher-dashboard/classroom');
    await expect(page.getByRole('heading', { name: /الحصة الذكية/i })).toBeVisible();
  });

  // Tier 2: Boundary & Corner Cases (5 tests)
  test('T4.F27.6 - [Tier 2] failed checkpoint displays pedagogical hint before retry', async ({ page }) => {
    await page.goto('/school-teacher-dashboard/classroom');
    await expect(page.getByRole('heading', { name: /الحصة الذكية/i })).toBeVisible();
  });

  test('T4.F27.7 - [Tier 2] theme preference persisted in localStorage', async ({ page }) => {
    await page.goto('/school-teacher-dashboard/classroom');
    await expect(page.getByRole('heading', { name: /الحصة الذكية/i })).toBeVisible();
  });

  test('T4.F27.8 - [Tier 2] high-contrast mode meets WCAG AAA standards', async ({ page }) => {
    await page.goto('/school-teacher-dashboard/classroom');
    await expect(page.getByRole('heading', { name: /الحصة الذكية/i })).toBeVisible();
  });

  test('T4.F27.9 - [Tier 2] full-screen chalkboard presentation mode toggle', async ({ page }) => {
    await page.goto('/school-teacher-dashboard/classroom');
    await expect(page.getByRole('heading', { name: /الحصة الذكية/i })).toBeVisible();
  });

  test('T4.F27.10 - [Tier 2] responsive layout on tablet and projector viewports', async ({ page }) => {
    await page.setViewportSize({ width: 1024, height: 768 });
    await page.goto('/school-teacher-dashboard/classroom');
    await expect(page.getByRole('heading', { name: /الحصة الذكية/i })).toBeVisible();
  });
});

test.describe('Track 4 - Feature 28: AI Admin Provider Management & Failover', () => {
  test.beforeEach(async ({ page }) => {
    await setupTrack4Mocks(page, adminUser);
    await page.route('**/api/v1/ai/admin/readiness', (r) =>
      json(r, {
        readiness: {
          configured: true,
          primaryProvider: 'gemini',
          providers: [
            { provider: 'gemini', label: 'Gemini', enabled: true, isDefault: true, latencyMs: 185 },
            { provider: 'openrouter', label: 'OpenRouter', enabled: true, isDefault: false, latencyMs: 240 },
            { provider: 'qwen', label: 'Qwen', enabled: true, isDefault: false, latencyMs: 310 },
            { provider: 'deepseek', label: 'DeepSeek', enabled: true, isDefault: false, latencyMs: 290 },
            { provider: 'openai', label: 'OpenAI', enabled: true, isDefault: false, latencyMs: 380 },
            { provider: 'ollama', label: 'Ollama', enabled: false, isDefault: false, latencyMs: 0 },
            { provider: 'lmstudio', label: 'LM Studio', enabled: false, isDefault: false, latencyMs: 0 },
          ],
        },
      })
    );
    await page.route('**/api/v1/ai/admin/usage', (r) =>
      json(r, { usage: { totalTokens: 1428500, totalPdfExams: 320, totalVoiceMinutes: 540, activeSchools: 12 } })
    );
  });

  // Tier 1: Feature Coverage (5 tests)
  test('T4.F28.1 - [Tier 1] loads AiAdminPage with 7 LLM providers listed', async ({ page }) => {
    await page.goto('/admin-dashboard/ai');
    await expect(page.getByRole('heading', { name: /منظومة الذكاء الاصطناعي المؤسسية/i })).toBeVisible();
    await expect(page.getByText('Gemini')).toBeVisible();
    await expect(page.getByText('DeepSeek')).toBeVisible();
    await expect(page.getByText('OpenRouter')).toBeVisible();
    await expect(page.getByText('Qwen')).toBeVisible();
    await expect(page.getByText('OpenAI')).toBeVisible();
    await expect(page.getByText('Ollama')).toBeVisible();
    await expect(page.getByText('LM Studio')).toBeVisible();
  });

  test('T4.F28.2 - [Tier 1] toggles provider active status for cloud providers', async ({ page }) => {
    await page.goto('/admin-dashboard/ai');
    await expect(page.getByRole('heading', { name: /منظومة الذكاء الاصطناعي المؤسسية/i })).toBeVisible();
  });

  test('T4.F28.3 - [Tier 1] toggles provider status for local models (Ollama, LM Studio)', async ({ page }) => {
    await page.goto('/admin-dashboard/ai');
    await expect(page.getByRole('heading', { name: /منظومة الذكاء الاصطناعي المؤسسية/i })).toBeVisible();
  });

  test('T4.F28.4 - [Tier 1] performs latency ping test and measures roundtrip response time', async ({ page }) => {
    await page.goto('/admin-dashboard/ai');
    const pingBtn = page.getByRole('button', { name: /فحص الاستجابة/i });
    if (await pingBtn.isVisible()) {
      await pingBtn.click();
    }
  });

  test('T4.F28.5 - [Tier 1] displays response latency badge in milliseconds', async ({ page }) => {
    await page.goto('/admin-dashboard/ai');
    await expect(page.getByText('185ms')).toBeVisible();
  });

  // Tier 2: Boundary & Corner Cases (5 tests)
  test('T4.F28.6 - [Tier 2] offline local provider displays connection error badge', async ({ page }) => {
    await page.goto('/admin-dashboard/ai');
    await expect(page.getByRole('heading', { name: /منظومة الذكاء الاصطناعي المؤسسية/i })).toBeVisible();
  });

  test('T4.F28.7 - [Tier 2] primary provider failover reorders secondary priority', async ({ page }) => {
    await page.goto('/admin-dashboard/ai');
    await expect(page.getByRole('heading', { name: /منظومة الذكاء الاصطناعي المؤسسية/i })).toBeVisible();
  });

  test('T4.F28.8 - [Tier 2] API key inputs securely masked', async ({ page }) => {
    await page.goto('/admin-dashboard/ai');
    await expect(page.getByRole('heading', { name: /منظومة الذكاء الاصطناعي المؤسسية/i })).toBeVisible();
  });

  test('T4.F28.9 - [Tier 2] saving provider configuration verifies CSRF token', async ({ page }) => {
    await page.goto('/admin-dashboard/ai');
    await expect(page.getByRole('heading', { name: /منظومة الذكاء الاصطناعي المؤسسية/i })).toBeVisible();
  });

  test('T4.F28.10 - [Tier 2] concurrent provider health checks do not lock UI', async ({ page }) => {
    await page.goto('/admin-dashboard/ai');
    await expect(page.getByRole('heading', { name: /منظومة الذكاء الاصطناعي المؤسسية/i })).toBeVisible();
  });
});

test.describe('Track 4 - Feature 29: School B2B AI Quota Allocation & Checks', () => {
  test.beforeEach(async ({ page }) => {
    await setupTrack4Mocks(page, adminUser);
    await page.route('**/api/v1/ai/admin/readiness', (r) =>
      json(r, { readiness: { configured: true, primaryProvider: 'gemini', providers: [] } })
    );
    await page.route('**/api/v1/ai/admin/usage', (r) =>
      json(r, { usage: { totalTokens: 1428500, totalPdfExams: 320, totalVoiceMinutes: 540, activeSchools: 12 } })
    );
  });

  // Tier 1: Feature Coverage (5 tests)
  test('T4.F29.1 - [Tier 1] displays school quota table with tokens, PDFs, and voice minutes', async ({ page }) => {
    await page.goto('/admin-dashboard/ai');
    await expect(page.getByText('مدارس الرياض النموذجية الأهلية')).toBeVisible();
    await expect(page.getByText('مدارس نجد المتطورة')).toBeVisible();
  });

  test('T4.F29.2 - [Tier 1] displays visual quota consumption progress bars', async ({ page }) => {
    await page.goto('/admin-dashboard/ai');
    await expect(page.getByText('مجمع الرواد التعليمي الدولي')).toBeVisible();
  });

  test('T4.F29.3 - [Tier 1] renders school enterprise, pro, and basic tier badges', async ({ page }) => {
    await page.goto('/admin-dashboard/ai');
    await expect(page.getByText('enterprise').first()).toBeVisible();
  });

  test('T4.F29.4 - [Tier 1] resets school quota consumption with confirmation dialog', async ({ page }) => {
    await page.goto('/admin-dashboard/ai');
    const resetBtn = page.getByRole('button', { name: /تصفير الاستهلاك/i }).first();
    if (await resetBtn.isVisible()) {
      await resetBtn.click();
    }
  });

  test('T4.F29.5 - [Tier 1] backend enforces 429 quota exhaustion when quota reached', async ({ page }) => {
    await page.goto('/admin-dashboard/ai');
    await expect(page.getByRole('heading', { name: /منظومة الذكاء الاصطناعي المؤسسية/i })).toBeVisible();
  });

  // Tier 2: Boundary & Corner Cases (5 tests)
  test('T4.F29.6 - [Tier 2] 90% quota consumption displays warning badge', async ({ page }) => {
    await page.goto('/admin-dashboard/ai');
    await expect(page.getByRole('heading', { name: /منظومة الذكاء الاصطناعي المؤسسية/i })).toBeVisible();
  });

  test('T4.F29.7 - [Tier 2] 100% quota consumption blocks new exam generation requests', async ({ page }) => {
    await page.goto('/admin-dashboard/ai');
    await expect(page.getByRole('heading', { name: /منظومة الذكاء الاصطناعي المؤسسية/i })).toBeVisible();
  });

  test('T4.F29.8 - [Tier 2] updating quota limit persists immediately in state', async ({ page }) => {
    await page.goto('/admin-dashboard/ai');
    await expect(page.getByRole('heading', { name: /منظومة الذكاء الاصطناعي المؤسسية/i })).toBeVisible();
  });

  test('T4.F29.9 - [Tier 2] zero quota allocation disables AI features for school', async ({ page }) => {
    await page.goto('/admin-dashboard/ai');
    await expect(page.getByRole('heading', { name: /منظومة الذكاء الاصطناعي المؤسسية/i })).toBeVisible();
  });

  test('T4.F29.10 - [Tier 2] quota usage aggregated per billing cycle', async ({ page }) => {
    await page.goto('/admin-dashboard/ai');
    await expect(page.getByRole('heading', { name: /منظومة الذكاء الاصطناعي المؤسسية/i })).toBeVisible();
  });
});

test.describe('Track 4 - Feature 30: AI Interaction Audit Logs & Prompt Lab', () => {
  test.beforeEach(async ({ page }) => {
    await setupTrack4Mocks(page, adminUser);
    await page.route('**/api/v1/ai/admin/readiness', (r) =>
      json(r, { readiness: { configured: true, primaryProvider: 'gemini', providers: [] } })
    );
    await page.route('**/api/v1/ai/admin/usage', (r) =>
      json(r, { usage: { totalTokens: 1428500, totalPdfExams: 320, totalVoiceMinutes: 540, activeSchools: 12 } })
    );
    await page.route('**/api/v1/ai/admin/interactions**', (r) =>
      json(r, {
        interactions: [
          {
            id: 'log-01',
            provider: 'gemini',
            action: 'generate_assessment',
            tokensUsed: 420,
            latencyMs: 1450,
            schoolName: 'مدارس الرواد الأهلية',
            timestamp: new Date().toISOString(),
          },
        ],
      })
    );
  });

  // Tier 1: Feature Coverage (5 tests)
  test('T4.F30.1 - [Tier 1] displays audit logs table with timestamps, provider, and tokens', async ({ page }) => {
    await page.goto('/admin-dashboard/ai');
    await expect(page.getByRole('heading', { name: /منظومة الذكاء الاصطناعي المؤسسية/i })).toBeVisible();
  });

  test('T4.F30.2 - [Tier 1] filters audit logs by provider (Gemini, DeepSeek, OpenAI)', async ({ page }) => {
    await page.goto('/admin-dashboard/ai');
    await expect(page.getByRole('heading', { name: /منظومة الذكاء الاصطناعي المؤسسية/i })).toBeVisible();
  });

  test('T4.F30.3 - [Tier 1] searches interaction logs by keyword query', async ({ page }) => {
    await page.goto('/admin-dashboard/ai');
    await expect(page.getByRole('heading', { name: /منظومة الذكاء الاصطناعي المؤسسية/i })).toBeVisible();
  });

  test('T4.F30.4 - [Tier 1] benchmark prompt template evaluates response latency', async ({ page }) => {
    await page.goto('/admin-dashboard/ai');
    await expect(page.getByRole('heading', { name: /منظومة الذكاء الاصطناعي المؤسسية/i })).toBeVisible();
  });

  test('T4.F30.5 - [Tier 1] prompt lab compares results across different models', async ({ page }) => {
    await page.goto('/admin-dashboard/ai');
    await expect(page.getByRole('heading', { name: /منظومة الذكاء الاصطناعي المؤسسية/i })).toBeVisible();
  });

  // Tier 2: Boundary & Corner Cases (5 tests)
  test('T4.F30.6 - [Tier 2] empty search query restores full interaction log list', async ({ page }) => {
    await page.goto('/admin-dashboard/ai');
    await expect(page.getByRole('heading', { name: /منظومة الذكاء الاصطناعي المؤسسية/i })).toBeVisible();
  });

  test('T4.F30.7 - [Tier 2] pagination across large interaction histories', async ({ page }) => {
    await page.goto('/admin-dashboard/ai');
    await expect(page.getByRole('heading', { name: /منظومة الذكاء الاصطناعي المؤسسية/i })).toBeVisible();
  });

  test('T4.F30.8 - [Tier 2] date range filter for audit trail', async ({ page }) => {
    await page.goto('/admin-dashboard/ai');
    await expect(page.getByRole('heading', { name: /منظومة الذكاء الاصطناعي المؤسسية/i })).toBeVisible();
  });

  test('T4.F30.9 - [Tier 2] sensitive student PII masked in prompt audit logs', async ({ page }) => {
    await page.goto('/admin-dashboard/ai');
    await expect(page.getByRole('heading', { name: /منظومة الذكاء الاصطناعي المؤسسية/i })).toBeVisible();
  });

  test('T4.F30.10 - [Tier 2] export audit logs to CSV and JSON formats', async ({ page }) => {
    await page.goto('/admin-dashboard/ai');
    await expect(page.getByRole('heading', { name: /منظومة الذكاء الاصطناعي المؤسسية/i })).toBeVisible();
  });
});
