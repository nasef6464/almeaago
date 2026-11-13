import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { chromium } from '../apps/web/node_modules/playwright/index.mjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const OUTPUT_DIR = process.env.OUTPUT_DIR || path.resolve(__dirname, '../docs/migration/evidence/batch-g1-student-walkthrough/screenshots');
if (!fs.existsSync(OUTPUT_DIR)) {
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });
}

const TARGET_URL = process.env.TARGET_URL || 'http://127.0.0.1:5173';

function getChromiumExecutable() {
  const candidates = [
    process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH,
    'C:/Users/nasef/AppData/Local/ms-playwright/chromium-1248/chrome-win64/chrome.exe',
    'C:/Users/nasef/AppData/Local/ms-playwright/chromium_headless_shell-1248/chrome-headless-shell-win64/chrome-headless-shell.exe',
    'C:/Program Files/Google/Chrome/Application/chrome.exe',
    'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
  ].filter(Boolean);

  for (const candidate of candidates) {
    if (fs.existsSync(candidate)) {
      return candidate;
    }
  }
  return undefined;
}

// Synthetic learner profile for deterministic layout & visual parity verification
const studentUser = {
  id: '018f0000-0000-7000-8000-000000000001',
  name: 'سلطان القحطاني',
  email: 'student@example.com',
  status: 'active',
  emailVerified: true,
  role: 'student',
  roles: ['student'],
  permissions: ['content:read', 'assessment:take'],
  avatarUrl: '',
};

const mockPaths = [
  {
    id: 'path-qudrat',
    code: 'QUDRAT',
    name: 'مسار القدرات العامة (علمي وأدبي)',
    description: 'تأهيل شامل وتدريب مكثف على المهارات الكمية واللفظية لتحقيق أعلى الدرجات في قياس.',
    sortOrder: 1,
    enrollmentCount: 1420,
    enrolled: true,
  },
  {
    id: 'path-tahsili',
    code: 'TAHSILI',
    name: 'مسار التحصيلي (علمي)',
    description: 'شرح وتدريبات لمواد الرياضيات والفيزياء والكيمياء والأحياء للثانوي.',
    sortOrder: 2,
    enrollmentCount: 890,
    enrolled: false,
  },
];

const mockSubjects = [
  {
    id: 'subj-quant',
    pathId: 'path-qudrat',
    name: 'القسم الكمي',
    description: 'أساسيات الحساب، الجبر، الهندسة، الإحصاء والاحتمالات، والمسائل الحياتية.',
    sortOrder: 1,
    color: '#4f46e5',
  },
  {
    id: 'subj-verbal',
    pathId: 'path-qudrat',
    name: 'القسم اللفظي',
    description: 'استيعاب المقروء، التناظر اللفظي، إكمال الجمل، والخطأ السياقي.',
    sortOrder: 2,
    color: '#0d9488',
  },
];

const mockLearningSpace = {
  pathId: 'path-qudrat',
  subjectId: 'subj-quant',
  courses: {
    items: [
      {
        id: 'course-101',
        title: 'دورة التأسيس الشاملة في القدرات العامة (كمي)',
        description: 'الدورة المعيارية الذهبية لاجتياز اختبار القدرات العامة خطوة بخطوة بأحدث استراتيجيات الحل السريع.',
        instructorName: 'أ. فهد التميمي',
        durationMinutes: 180,
        level: 'beginner',
        thumbnailAssetId: 'asset-thumb-1',
        dripContentEnabled: false,
        certificateEnabled: true,
      },
    ],
    hasMore: false,
  },
  foundation: {
    items: [
      {
        id: 'topic-arithmetic',
        parentTopicId: '',
        title: 'أساسيات الحساب والعمليات الأربع السريعة',
        description: 'إتقان الجمع والضرب والقسمة السريعة وقواعد قابلية القسمة والأسس والجذور.',
        sortOrder: 1,
        isLocked: false,
      },
      {
        id: 'topic-fractions',
        parentTopicId: '',
        title: 'الكسور الاعتيادية والعشرية والنسب المئوية',
        description: 'مقارنة الكسور، تحويل الكسور، وحساب النسب والربح والخسارة والتدرج المنتظم.',
        sortOrder: 2,
        isLocked: false,
      },
      {
        id: 'topic-geometry',
        parentTopicId: '',
        title: 'الهندسة: الزوايا والمثلثات والمساحات والحجوم',
        description: 'قوانين فيثاغورس، زوايا المثلث، الدائرة، وتطبيقات الأشكال الرباعية.',
        sortOrder: 3,
        isLocked: false,
      },
    ],
    hasMore: false,
  },
  library: {
    items: [],
    hasMore: false,
  },
};

const mockCourseId = 'course-101';
const mockCourseData = {
  course: {
    id: mockCourseId,
    title: 'دورة التأسيس الشاملة في القدرات العامة (كمي)',
    description: 'الدورة المعيارية الذهبية لاجتياز اختبار القدرات العامة خطوة بخطوة بأحدث استراتيجيات الحل السريع.',
    instructorName: 'أ. فهد التميمي',
    durationMinutes: 180,
    level: 'beginner',
    thumbnailAssetId: 'asset-thumb-1',
    dripContentEnabled: false,
    certificateEnabled: true,
    modules: [
      {
        id: 'mod-1',
        title: 'القسم الأول: أساسيات الحساب والكسور العشرية والنسبة المئوية',
        description: 'شرح مهارات العمليات الحسابية والكسور والنسب واستراتيجيات التدرج المنتظم',
        sortOrder: 1,
        lessons: [
          {
            id: 'les-1',
            title: 'مقدمة واستراتيجيات الحل السريع وإدارة الوقت',
            description: 'فهم معايير قياس وطرق إدارة الوقت والتخلص من المشتتات',
            type: 'video',
            durationSeconds: 900,
            sortOrder: 1,
            isLocked: false,
            isPreview: true,
            commerceLocked: false,
          },
          {
            id: 'les-2',
            title: 'العمليات الحسابية الأساسية والمقارنات',
            description: 'الجمع والطرح والضرب والقسمة السريعة وقوانين الأسس والجذور',
            type: 'video',
            durationSeconds: 1200,
            sortOrder: 2,
            isLocked: false,
            isPreview: false,
            commerceLocked: false,
          },
        ],
      },
    ],
    access: {
      allowed: true,
      configured: true,
      reason: 'enrolled',
      productId: 'prod-101',
      entitlementId: 'ent-1',
      entitlementSource: 'subscription',
    },
  },
};

const mockLessonDetail = {
  lesson: {
    id: 'les-1',
    title: 'مقدمة واستراتيجيات الحل السريع وإدارة الوقت',
    description: 'فهم معايير قياس وطرق إدارة الوقت والتخلص من المشتتات',
    type: 'video',
    durationSeconds: 900,
    sortOrder: 1,
    isLocked: false,
    isPreview: true,
    commerceLocked: false,
    videoUrl: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4',
    contentText: JSON.stringify({}),
  },
};

const mockLessonProgress = {
  progress: {
    lessonId: 'les-1',
    contextType: 'course',
    courseId: mockCourseId,
    status: 'in_progress',
    positionSeconds: 120,
    completedAt: null,
    updatedAt: new Date().toISOString(),
  },
};

const mockResultDetail = {
  result: {
    attemptId: 'att-mock-99',
    score: 85,
    totalQuestions: 20,
    correctAnswers: 17,
    wrongAnswers: 2,
    unanswered: 1,
    passed: true,
    timeSpentSeconds: 1800,
    finalizedAt: new Date().toISOString(),
  },
  assessmentId: 'asm-101',
  assessmentVersion: 2,
  title: 'الاختبار التجريبي الشامل الأول لمسار القدرات العامة',
  attemptNumber: 1,
  allowQuestionReview: true,
  showAnswers: true,
  showExplanations: true,
  showResultsReport: true,
  skillAnalysis: {
    complete: true,
    items: [
      {
        pathId: 'path-qudrat',
        subjectId: 'subj-quant',
        subjectName: 'القسم الكمي',
        skillId: 'sk-1',
        skillName: 'العمليات الحسابية والكسور',
        questionCount: 8,
        correctCount: 8,
        mastery: 100,
        status: 'strong',
      },
      {
        pathId: 'path-qudrat',
        subjectId: 'subj-quant',
        subjectName: 'القسم الكمي',
        skillId: 'sk-4',
        skillName: 'الزوايا والمثلثات والمضلعات',
        questionCount: 6,
        correctCount: 5,
        mastery: 83,
        status: 'average',
      },
      {
        pathId: 'path-qudrat',
        subjectId: 'subj-verbal',
        subjectName: 'القسم اللفظي',
        skillId: 'sk-verbal-1',
        skillName: 'استيعاب المقروء والتناظر اللفظي',
        questionCount: 6,
        correctCount: 4,
        mastery: 66,
        status: 'weak',
        foundationTopics: [
          { id: 'top-reading', title: 'تأسيس استيعاب المقروء والعلاقات اللفظية', isLocked: false },
        ],
      },
    ],
  },
  questions: [
    {
      questionId: 'q-101',
      questionVersion: 1,
      sectionId: 'sec-1',
      sortOrder: 1,
      points: 5,
      type: 'multiple_choice',
      text: 'إذا كان س + ص = 10 و س - ص = 4، فما قيمة س² - ص²؟',
      imageAssetId: '',
      imageAlt: '',
      optionsEmbeddedInImage: false,
      videoUrl: 'https://example.com/video-solution-1',
      difficulty: 'medium',
      options: [
        { index: 0, text: '14', assetId: '' },
        { index: 1, text: '40', assetId: '' },
        { index: 2, text: '24', assetId: '' },
        { index: 3, text: '60', assetId: '' },
      ],
      selectedOptionIndex: 1,
      correctOptionIndex: 1,
      answered: true,
      correct: true,
      markedForReview: false,
      timeSpentSeconds: 45,
      explanation: 'المتطابقة الشهيرة للفرق بين مربعين: س² - ص² = (س + ص)(س - ص) = 10 × 4 = 40.',
      solvingStrategy: 'التعويض المباشر بضرب المجموع في الفرق دون الحاجة لإيجاد قيمة س وص منفصلين.',
    },
    {
      questionId: 'q-102',
      questionVersion: 1,
      sectionId: 'sec-2',
      sortOrder: 2,
      points: 5,
      type: 'multiple_choice',
      text: 'تناظر لفظي: رئة : تنفس',
      imageAssetId: '',
      imageAlt: '',
      optionsEmbeddedInImage: false,
      videoUrl: 'https://example.com/video-solution-2',
      difficulty: 'medium',
      options: [
        { index: 0, text: 'عين : ضوء', assetId: '' },
        { index: 1, text: 'قلب : ضخ', assetId: '' },
        { index: 2, text: 'رجل : حذاء', assetId: '' },
        { index: 3, text: 'يد : كتابة', assetId: '' },
      ],
      selectedOptionIndex: 0,
      correctOptionIndex: 1,
      answered: true,
      correct: false,
      markedForReview: true,
      timeSpentSeconds: 60,
      explanation: 'العلاقة وظيفية حيوية أصيلة: الرئة وظيفتها التنفس، والقلب وظيفته الضخ.',
      solvingStrategy: 'تحديد نوع العلاقة بدقة وصياغة جملة مفيدة: (العضو وظيفته الأساسية...).',
    },
  ],
};

async function setupMocks(page) {
  await page.route('**/api/**', async (route) => {
    const url = route.request().url();

    if (url.includes('/api/v1/auth/csrf')) {
      return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ csrfToken: 'valid-csrf-token' }) });
    }
    if (url.includes('/api/v1/auth/me') || url.includes('/api/v1/auth/session')) {
      return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ user: studentUser }) });
    }
    if (url.includes('/api/v1/learning/navigation-preferences')) {
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          user: {
            id: studentUser.id,
            enrolledPaths: ['path-qudrat'],
            pathStageSelections: [],
          },
        }),
      });
    }
    if (url.includes('/api/v1/taxonomy/bootstrap')) {
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          paths: mockPaths,
          levels: [],
          subjects: mockSubjects,
        }),
      });
    }
    if (url.includes('/api/v1/taxonomy/paths')) {
      return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ paths: mockPaths }) });
    }
    if (url.includes('/api/v1/courses/public')) {
      return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ items: [] }) });
    }
    if (url.includes('/api/v1/learning-spaces/') && url.includes('/subjects/')) {
      return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(mockLearningSpace) });
    }
    if (url.includes('/api/v1/learning-spaces/courses/') && url.includes('/lessons/')) {
      return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(mockLessonDetail) });
    }
    if (url.includes('/api/v1/learning-spaces/courses/')) {
      return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(mockCourseData) });
    }
    if (url.includes('/api/v1/learning-progress/')) {
      return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(mockLessonProgress) });
    }
    if (url.includes('/api/v1/assessment-placements/available')) {
      return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ items: [], total: 0, hasMore: false }) });
    }
    if (url.includes('/api/v1/assessment-attempts/') && url.includes('/review')) {
      return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ detail: mockResultDetail }) });
    }
    if (url.includes('/api/v1/assessment-attempts/results')) {
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          items: [
            {
              attemptId: 'att-mock-99',
              assessmentId: 'asm-101',
              assessmentVersion: 2,
              title: 'الاختبار التجريبي الشامل الأول لمسار القدرات العامة',
              attemptNumber: 1,
              showResultsReport: true,
              score: 85,
              totalQuestions: 20,
              correctAnswers: 17,
              wrongAnswers: 2,
              unanswered: 1,
              passed: true,
              timeSpentSeconds: 1800,
              finalizedAt: new Date().toISOString(),
            },
          ],
          page: 1,
          limit: 20,
          hasMore: false,
        }),
      });
    }
    if (url.includes('/api/v1/notifications')) {
      return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ items: [], unreadCount: 0 }) });
    }
    if (url.includes('/api/v1/ai/question-assistant')) {
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          answer: 'أهلاً بك يا سلطان! بالنسبة لهذا السؤال حول التناظر اللفظي (رئة : تنفس)، العلاقة هنا هي علاقة العضو بوظيفته الأساسية والحيوية المستمرة. لذلك (قلب : ضخ) هي الإجابة المتطابقة تماماً لأن وظيفة القلب المستمرة هي ضخ الدم.',
          tokensUsed: 120,
        }),
      });
    }
    return route.continue();
  });
}

async function runLiveStudentWalkthrough() {
  console.log('================================================================================');
  console.log('🚀 RUNNING FINAL VISUAL VERIFICATION ACROSS ALL STUDENT SCREENS');
  console.log('================================================================================');

  const executablePath = getChromiumExecutable();
  const browser = await chromium.launch({
    headless: true,
    ...(executablePath ? { executablePath } : {}),
  });

  const viewports = [
    { label: 'desktop_1440', width: 1440, height: 900 },
    { label: 'tablet_820', width: 820, height: 1180 },
    { label: 'mobile_390', width: 390, height: 844 },
  ];

  for (const vp of viewports) {
    console.log(`\n--- Viewport: ${vp.label} (${vp.width}x${vp.height}) ---`);
    const page = await browser.newPage({ locale: 'ar-SA' });
    await page.setViewportSize({ width: vp.width, height: vp.height });
    await setupMocks(page);

    // 1. Dashboard Overview
    console.log(`[${vp.label}] 1. Student Dashboard Overview...`);
    await page.goto(`${TARGET_URL}/dashboard`, { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(1000);
    await page.screenshot({ path: `${OUTPUT_DIR}/02_student_dashboard_${vp.label}.png`, fullPage: false });

    // 2. My Tracks
    console.log(`[${vp.label}] 2. My Tracks Tab...`);
    await page.goto(`${TARGET_URL}/dashboard?tab=paths`, { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(1000);
    await page.screenshot({ path: `${OUTPUT_DIR}/03_my_tracks_${vp.label}.png`, fullPage: false });

    // 3. Category Workspace - Subjects Selection
    console.log(`[${vp.label}] 3. Category Workspace Subjects...`);
    await page.goto(`${TARGET_URL}/category/path-qudrat`, { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(1200);
    await page.screenshot({ path: `${OUTPUT_DIR}/04a_category_subjects_${vp.label}.png`, fullPage: false });

    // 4. Learning Space - Foundation Topics (التأسيس)
    console.log(`[${vp.label}] 4. Learning Space Foundation Topics...`);
    await page.goto(`${TARGET_URL}/category/path-qudrat?subject=subj-quant&tab=foundation`, { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(1500);
    await page.screenshot({ path: `${OUTPUT_DIR}/04b_foundation_topics_${vp.label}.png`, fullPage: false });

    // 5. Course Player 16:9
    console.log(`[${vp.label}] 5. Course Player 16:9...`);
    await page.goto(`${TARGET_URL}/learning/courses/${mockCourseId}?learn=1`, { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(1500);
    await page.screenshot({ path: `${OUTPUT_DIR}/05_course_player_${vp.label}.png`, fullPage: false });

    // 6. Post-Exam Results & Weak Skills
    console.log(`[${vp.label}] 6. Post-Exam Results...`);
    await page.goto(`${TARGET_URL}/assessment-results/att-mock-99`, { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(1500);
    await page.screenshot({ path: `${OUTPUT_DIR}/06_post_exam_results_${vp.label}.png`, fullPage: false });

    await page.close();
  }

  await browser.close();
  console.log('\n================================================================================');
  console.log('🎉 ALL SCREENSHOTS REFRESHED AND CAPTURED PERFECTLY!');
  console.log('================================================================================');
}

runLiveStudentWalkthrough().catch((err) => {
  console.error('WALKTHROUGH ERROR:', err);
  process.exit(1);
});
