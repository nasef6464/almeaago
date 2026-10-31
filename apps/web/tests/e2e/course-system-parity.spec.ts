import { expect, test, type Page, type Route } from '@playwright/test';
import path from 'path';

const ARTIFACTS_DIR = 'C:/Users/nasef/.gemini/antigravity/brain/0ccfb08a-58bb-4c4b-b298-4bd5e2ebea66';

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

const adminUser = {
  id: '018f0000-0000-7000-8000-000000000099',
  name: 'مدير المنصة',
  email: 'admin@almeaa.com',
  status: 'active',
  emailVerified: true,
  role: 'admin',
  roles: ['admin'],
  permissions: ['content:write', 'content:publish', 'admin:access'],
  avatarUrl: '',
};

function json(route: Route, data: unknown) {
  return route.fulfill({
    status: 200,
    contentType: 'application/json',
    body: JSON.stringify(data),
  });
}

const mockCourseId = 'course-101';
const mockCourseData = {
  course: {
    id: mockCourseId,
    title: 'دورة التأسيس الشاملة في القدرات العامة',
    description: 'الدورة المعيارية الذهبية لاجتياز اختبار القدرات العامة (القسمين الكمي واللفظي) خطوة بخطوة مع تدريبات مكثفة وتجميعات حصرية.',
    instructorName: 'أ. فهد التميمي',
    durationMinutes: 180,
    level: 'beginner',
    thumbnailAssetId: 'asset-thumb-1',
    dripContentEnabled: false,
    certificateEnabled: true,
    modules: [
      {
        id: 'mod-1',
        title: 'القسم الأول: أساسيات الحساب والكسور العشرية',
        description: 'شرح مهارات العمليات الحسابية والكسور',
        sortOrder: 1,
        lessons: [
          {
            id: 'les-1',
            title: 'مقدمة واستراتيجيات الحل السريع',
            description: 'فهم معايير قياس وطرق إدارة الوقت',
            type: 'video',
            durationSeconds: 900,
            isLocked: false,
            isPreview: true,
            commerceLocked: false,
            sortOrder: 1,
          },
          {
            id: 'les-2',
            title: 'قوانين الأسس والجذور وتطبيقاتها',
            description: 'تبسيط المعادلات الأسية والجذور المربعة',
            type: 'video',
            durationSeconds: 1200,
            isLocked: false,
            isPreview: false,
            commerceLocked: false,
            sortOrder: 2,
          },
        ],
      },
      {
        id: 'mod-2',
        title: 'القسم الثاني: التناظر اللفظي واستيعاب المقروء',
        description: 'مهارات القسم اللفظي والعلاقات المنطقية',
        sortOrder: 2,
        lessons: [
          {
            id: 'les-3',
            title: 'أنماط التناظر اللفظي وكشف الفخاخ',
            description: 'تحليل دقيق لأشهر علاقات التناظر في قياس',
            type: 'video',
            durationSeconds: 1100,
            isLocked: false,
            isPreview: true,
            commerceLocked: false,
            sortOrder: 1,
          },
        ],
      },
    ],
    access: {
      allowed: true,
      configured: true,
      reason: 'enrolled',
      productId: 'prod-course-101',
      entitlementId: 'ent-1',
      entitlementSource: 'subscription',
    },
  },
};

const mockLessonDetail = {
  id: 'les-1',
  title: 'مقدمة واستراتيجيات الحل السريع',
  description: 'فهم معايير قياس وطرق إدارة الوقت',
  lessonType: 'video',
  durationSeconds: 900,
  isLocked: false,
  isPreview: true,
  commerceLocked: false,
  sortOrder: 1,
  contentText: 'أهلاً بكم في أولى جلسات التأسيس للقدرات العامة. ركز في هذه الجلسة على استراتيجيات التجريب والحل بالاستبعاد.',
  videoUrl: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4',
  videoSource: 'upload',
};

async function setupCourseMocks(page: Page, asAdmin = false) {
  await page.addInitScript(() => {
    sessionStorage.setItem(
      'almeaa-dismissed-announcement-ads',
      JSON.stringify(['ad_welcome_offer', 'ad_qudrat_launch', 'ad_nafes_banner']),
    );
    localStorage.setItem(
      'almeaa-dismissed-announcement-ads',
      JSON.stringify(['ad_welcome_offer', 'ad_qudrat_launch', 'ad_nafes_banner']),
    );
  });

  const currentUser = asAdmin ? adminUser : studentUser;

  await page.route('**/api/v1/auth/me', (route) => json(route, { user: currentUser }));
  await page.route('**/api/v1/auth/csrf', (route) => json(route, { csrfToken: 'csrf-test-token' }));

  await page.route('**/api/v1/taxonomy/bootstrap*', (route) =>
    json(route, {
      paths: [
        { id: 'path-1', code: 'QUDRAT', name: 'القدرات العامة', color: 'indigo' },
        { id: 'path-2', code: 'TAHSILI', name: 'التحصيلي', color: 'emerald' },
        { id: 'path-3', code: 'NAFES', name: 'نافس', color: 'amber' },
      ],
      levels: [],
      subjects: [
        { id: 'sub-1', pathId: 'path-1', code: 'QUANT', name: 'القدرات كمي' },
        { id: 'sub-2', pathId: 'path-1', code: 'VERB', name: 'القدرات لفظي' },
      ],
      skills: [
        { id: 'skl-1', subjectId: 'sub-1', code: 'FRACTIONS', name: 'الكسور والأعداد العشرية' },
        { id: 'skl-2', subjectId: 'sub-2', code: 'ANALOGY', name: 'التناظر اللفظي' },
      ],
    }),
  );

  await page.route('**/api/v1/taxonomy/core*', (route) =>
    json(route, {
      paths: [{ id: 'path-1', code: 'QUDRAT', name: 'القدرات العامة' }],
      subjects: [
        { id: 'sub-1', pathId: 'path-1', code: 'QUANT', name: 'القدرات كمي' },
        { id: 'sub-2', pathId: 'path-1', code: 'VERB', name: 'القدرات لفظي' },
      ],
    }),
  );

  await page.route('**/api/v1/taxonomy/full*', (route) =>
    json(route, {
      paths: [{ id: 'path-1', code: 'QUDRAT', name: 'القدرات العامة' }],
      subjects: [
        { id: 'sub-1', pathId: 'path-1', code: 'QUANT', name: 'القدرات كمي' },
        { id: 'sub-2', pathId: 'path-1', code: 'VERB', name: 'القدرات لفظي' },
      ],
      skills: [
        { id: 'skl-1', subjectId: 'sub-1', code: 'FRACTIONS', name: 'الكسور والأعداد العشرية' },
        { id: 'skl-2', subjectId: 'sub-2', code: 'ANALOGY', name: 'التناظر اللفظي' },
      ],
    }),
  );

  await page.route((url) => url.pathname.includes('/learning-spaces/courses/course-101/lessons/'), (route) =>
    json(route, { lesson: mockLessonDetail }),
  );

  await page.route((url) => url.pathname.includes('/learning-spaces/courses/course-101'), (route) =>
    json(route, mockCourseData),
  );

  await page.route((url) => url.pathname.startsWith('/api/v1/courses'), (route) => {
    const pathname = route.request().url();
    if (pathname.includes('/courses/public')) {
      return json(route, {
        items: [
          {
            id: mockCourseId,
            title: 'دورة التأسيس الشاملة في القدرات العامة',
            instructorName: 'أ. فهد التميمي',
            thumbnailUrl: 'https://images.unsplash.com/photo-1516321318423-f06f85e504b3?w=800',
          },
        ],
      });
    }
    if (pathname.includes('/course-101/modules')) {
      return json(route, {
        modules: [
          {
            id: 'mod-1',
            courseId: mockCourseId,
            title: 'القسم الأول: أساسيات الحساب والكسور العشرية',
            sortOrder: 1,
            status: 'active',
            lessons: [{ lessonId: 'les-1', sortOrder: 1, isPreview: true }],
          },
        ],
      });
    }
    if (pathname.includes('/course-101')) {
      return json(route, {
        course: {
          id: mockCourseId,
          pathId: 'path-1',
          subjectId: 'sub-1',
          title: 'دورة التأسيس الشاملة في القدرات العامة',
          description: 'الدورة المعيارية الذهبية لاجتياز اختبار القدرات العامة خطوة بخطوة.',
          instructorName: 'أ. فهد التميمي',
          durationMinutes: 180,
          level: 'beginner',
          ownerType: 'platform',
          workflowStatus: 'approved',
          isVisible: true,
          isPublished: true,
          revision: 1,
          skillIds: ['skl-1'],
          presentation: {
            price: 150,
            originalPrice: 250,
            currency: 'ر.س',
            files: [
              { id: 'f-1', title: 'حقيبة التأسيس الشاملة.pdf', size: '5.2 ميجابايت', access: 'free_preview' },
            ],
            assessments: [
              { id: 'asm-1', title: 'اختبار تحديد المستوى القبلي', phase: 'pre_course', durationMinutes: 25, questionsCount: 20, access: 'free_preview' },
            ],
          },
        },
      });
    }
    return json(route, {
      items: [
        {
          id: mockCourseId,
          pathId: 'path-1',
          subjectId: 'sub-1',
          title: 'دورة التأسيس الشاملة في القدرات العامة',
          instructorName: 'أ. فهد التميمي',
          thumbnailUrl: 'https://images.unsplash.com/photo-1516321318423-f06f85e504b3?w=800',
          durationMinutes: 180,
          level: 'beginner',
          ownerType: 'platform',
          workflowStatus: 'approved',
          isVisible: true,
          isPublished: true,
          revision: 1,
          updatedAt: new Date().toISOString(),
        },
      ],
      page: 1,
      limit: 50,
      hasMore: false,
    });
  });

  await page.route((url) => url.pathname.startsWith('/api/v1/lessons'), (route) =>
    json(route, {
      items: [
        {
          id: 'les-1',
          pathId: 'path-1',
          subjectId: 'sub-1',
          title: 'مقدمة واستراتيجيات الحل السريع',
          type: 'video',
          durationSeconds: 900,
        },
      ],
      hasMore: false,
    }),
  );
}

test.describe('ALMEAA Course System Parity: Creation to Student Display', () => {
  test('1. Student and Visitor Course View: Hero Showcase, 5 Tabs, Sticky Sidebar, and Player Transition', async ({ page }) => {
    await setupCourseMocks(page, false);
    await page.setViewportSize({ width: 1440, height: 900 });

    // 1. Visit /course/course-101
    await page.goto('/course/course-101');
    await page.waitForLoadState('networkidle');

    // 2. Verify Hero Showcase Card
    const heroTitle = page.getByRole('heading', { name: 'دورة التأسيس الشاملة في القدرات العامة', level: 1 });
    await expect(heroTitle).toBeVisible();
    await expect(page.getByText('جديد ومحدّث')).toBeVisible();
    await expect(page.getByText('شهادة إتمام معتمدة')).toBeVisible();
    await expect(page.getByText('أ. فهد التميمي')).toBeVisible();
    await expect(page.getByText('4.9')).toBeVisible();

    // 3. Verify Sticky Sidebar & Price
    await expect(page.getByText('تفاصيل الدورة')).toBeVisible();
    await expect(page.getByRole('button', { name: /ابدأ التعلم الآن|متابعة التعلم/ })).toBeVisible();

    // 4. Verify Syllabus Tab is active by default
    await expect(page.getByText('القسم الأول: أساسيات الحساب والكسور العشرية')).toBeVisible();
    await expect(page.getByText('مقدمة واستراتيجيات الحل السريع')).toBeVisible();

    // Take screenshot of Course Overview
    await page.screenshot({
      path: path.join(ARTIFACTS_DIR, 'course-overview-desktop-1440.png'),
      fullPage: true,
    });

    // 5. Test Description Tab
    await page.getByRole('button', { name: 'وصف الدورة' }).click();
    await expect(page.getByText('ماذا ستتعلم في هذه الدورة؟')).toBeVisible();
    await expect(page.getByText('مميزات الدورة')).toBeVisible();

    // 6. Test Tests Tab
    await page.getByRole('button', { name: /الاختبارات/ }).click();
    await expect(page.getByText('تشمل الدورة حزمة اختبارات محاكية')).toBeVisible();
    await expect(page.getByRole('button', { name: /بدء الاختبار/ }).first()).toBeVisible();

    // 7. Test QA Tab
    await page.getByRole('button', { name: /سؤال وجواب/ }).click();
    await expect(page.getByText('هذه المساحة مخصصة للاستفسار عن محتوى الدورة')).toBeVisible();
    await expect(page.getByPlaceholder('اكتب سؤالك أو استفسارك')).toBeVisible();

    // 8. Test Files Tab
    await page.getByRole('button', { name: /ملفات الدورة/ }).click();
    await expect(page.getByText('يمكنك تحميل مذكرات الشرح والملخصات المعتمدة')).toBeVisible();

    // 9. Click on Start Learning button to transition into interactive player (?learn=1)
    await page.getByRole('button', { name: /ابدأ التعلم الآن|متابعة التعلم/ }).click();
    await page.waitForURL((url) => url.searchParams.get('learn') === '1');

    // 10. Verify inside Course Player
    await expect(page.getByTestId('legacy-course-player')).toBeVisible();
    await expect(page.getByRole('button', { name: 'الرجوع لتفاصيل الدورة' })).toBeVisible();

    // Take screenshot of Course Player
    await page.screenshot({
      path: path.join(ARTIFACTS_DIR, 'course-player-desktop-1440.png'),
      fullPage: true,
    });

    // 11. Click Back button to return to Course Overview
    await page.getByRole('button', { name: 'الرجوع لتفاصيل الدورة' }).click();
    await page.waitForURL((url) => !url.searchParams.has('learn'));
    await expect(heroTitle).toBeVisible();
  });

  test('2. Public Courses Catalog: Card Display, Accordion Preview, and Direct Links', async ({ page }) => {
    await setupCourseMocks(page, false);
    await page.setViewportSize({ width: 1440, height: 900 });

    await page.goto('/courses');
    await page.waitForLoadState('networkidle');

    await expect(page.getByRole('heading', { name: 'دوراتي' })).toBeVisible();
    await expect(page.getByPlaceholder('ابحث في دوراتي...')).toBeVisible();

    // Verify course card
    const courseCard = page.getByText('دورة التأسيس الشاملة في القدرات العامة').first();
    await expect(courseCard).toBeVisible();
    await expect(page.getByText('4.9 تقييم')).toBeVisible();

    // Click to expand accordion preview
    await courseCard.click();
    await expect(page.getByText('محتوى الدورة المعتمد:')).toBeVisible();

    // Take screenshot of Courses Catalog
    await page.screenshot({
      path: path.join(ARTIFACTS_DIR, 'courses-catalog-desktop-1440.png'),
      fullPage: true,
    });

    // Click "عرض تفاصيل الدورة"
    await page.getByRole('link', { name: 'عرض تفاصيل الدورة' }).first().click();
    await page.waitForURL('**/course/course-101');
    await expect(page.getByRole('heading', { name: 'دورة التأسيس الشاملة في القدرات العامة' })).toBeVisible();
  });

  test('3. Admin Courses Management: Readiness Checks, Preview Modal, and Course Editor Tabs', async ({ page }) => {
    await setupCourseMocks(page, true);
    await page.setViewportSize({ width: 1440, height: 900 });

    await page.goto('/admin-dashboard/content?tab=courses');
    await page.waitForLoadState('networkidle');

    // Verify table has course and readiness badge
    await expect(page.getByRole('heading', { name: 'إدارة المحتوى التعليمي' })).toBeVisible();
    await expect(page.getByText('دورة التأسيس الشاملة في القدرات العامة')).toBeVisible();
    await expect(page.getByText('جاهز للطالب')).toBeVisible();

    // Click "معاينة" to open preview modal
    const previewBtn = page.getByRole('button', { name: 'معاينة' }).first();
    await previewBtn.click();

    // Verify Preview Modal
    await expect(page.getByText('معاينة الدورة (LMS)')).toBeVisible();
    await expect(page.getByText('جاهزية العرض: جاهز للطالب')).toBeVisible();
    await expect(page.getByRole('link', { name: 'فتح صفحة الدورة كطالب' })).toBeVisible();

    // Close preview modal
    await page.getByRole('button', { name: 'إغلاق', exact: true }).click();
    await expect(page.getByText('معاينة الدورة (LMS)')).not.toBeVisible();

    // Click "تعديل / المنهج" to open CourseEditorPanel
    await page.getByRole('button', { name: 'تعديل / المنهج' }).first().click();

    // Verify Master Builder Header & Readiness Banner
    await expect(page.getByText('تعديل الدورة (Master Builder)')).toBeVisible();
    await expect(page.getByText('الدورة جاهزة للعرض على الطالب بالكامل')).toBeVisible();
    await expect(page.getByText('معاينة صفحة الطالب ↗')).toBeVisible();

    // Verify 5 tabs in Builder
    await expect(page.getByRole('button', { name: /المنهج/ })).toBeVisible();
    await expect(page.getByRole('button', { name: 'إعدادات الدورة' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'الأسعار والتجارة' })).toBeVisible();
    await expect(page.getByRole('button', { name: /ملفات الدورة/ })).toBeVisible();
    await expect(page.getByRole('button', { name: /الاختبارات المرتبطة/ })).toBeVisible();

    // Test switching to Pricing tab
    await page.getByRole('button', { name: 'الأسعار والتجارة' }).click();
    await expect(page.getByText('الأسعار والتجارة (Commerce & Pricing)')).toBeVisible();

    // Test switching to Files tab
    await page.getByRole('button', { name: /ملفات الدورة/ }).click();
    await expect(page.getByText('ملفات ومذكرات الدورة (Course Files)')).toBeVisible();

    // Take screenshot of Admin Course Builder
    await page.screenshot({
      path: path.join(ARTIFACTS_DIR, 'admin-course-builder-desktop-1440.png'),
      fullPage: true,
    });
  });
});
