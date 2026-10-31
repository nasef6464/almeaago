import { expect, test, type Page, type Route } from '@playwright/test';
import path from 'path';

const ARTIFACTS_DIR = 'C:/Users/nasef/.gemini/antigravity/brain/0ccfb08a-58bb-4c4b-b298-4bd5e2ebea66';

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

function json(route: Route, body: unknown, status = 200) {
  return route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) });
}

async function setupMocks(page: Page) {
  await page.addInitScript(() => {
    sessionStorage.setItem('almeaa-dismissed-announcement-ads', JSON.stringify(['ad_welcome_offer', 'ad_qudrat_launch', 'ad_nafes_banner']));
  });
  await page.route('**/api/v1/auth/me', (route) => json(route, { user: admin }));
  await page.route('**/api/v1/auth/csrf', (route) => json(route, { csrfToken: 'csrf-admin-complete' }));
  await page.route('**/api/v1/schools*', (route) =>
    json(route, {
      schools: [{ id: 'sch-1', code: 'SCH-01', name: 'مدارس المجد النموذجية', status: 'active' }],
      pagination: { page: 1, limit: 100, total: 1, totalPages: 1 },
    }),
  );
  await page.route('**/api/v1/taxonomy/admin/bootstrap', (route) =>
    json(route, {
      paths: [
        {
          id: '018f0000-0000-7000-8000-000000000030',
          code: 'QUDRAT',
          name: 'القدرات العامة',
          description: 'مسار قياس لاختبار القدرات العامة للقسمين العلمي والأدبي.',
          sortOrder: 0,
          status: 'active',
          color: 'indigo',
          icon: '📐',
        },
      ],
      levels: [],
      subjects: [
        {
          id: '018f0000-0000-7000-8000-000000000031',
          pathId: '018f0000-0000-7000-8000-000000000030',
          code: 'VERBAL',
          name: 'اللفظي',
          sortOrder: 0,
          status: 'active',
          color: 'teal',
          icon: '📖',
          settings: {
            showCourses: true,
            showSkills: true,
            lockSkillsForNonSubscribers: false,
            showBanks: true,
            lockBanksForNonSubscribers: false,
            showTests: true,
            lockTestsForNonSubscribers: false,
            showLibrary: true,
            lockLibraryForNonSubscribers: false,
          },
        },
      ],
      skills: [
        {
          id: 'sk-1',
          subjectId: '018f0000-0000-7000-8000-000000000031',
          code: 'SK-01',
          name: 'التناظر اللفظي',
          description: 'إدراك العلاقات بين المفردات',
          kind: 'main',
          sortOrder: 0,
          status: 'active',
        },
      ],
    }),
  );
  await page.route('**/api/v1/taxonomy/bootstrap*', (route) =>
    json(route, {
      paths: [
        {
          id: '018f0000-0000-7000-8000-000000000030',
          code: 'QUDRAT',
          name: 'القدرات العامة',
          color: 'indigo',
        },
      ],
      levels: [],
      subjects: [
        {
          id: '018f0000-0000-7000-8000-000000000031',
          pathId: '018f0000-0000-7000-8000-000000000030',
          code: 'VERBAL',
          name: 'اللفظي',
          color: 'teal',
          settings: {
            showCourses: true,
            showSkills: true,
            lockSkillsForNonSubscribers: false,
            showBanks: true,
            lockBanksForNonSubscribers: false,
            showTests: true,
            lockTestsForNonSubscribers: false,
            showLibrary: true,
            lockLibraryForNonSubscribers: false,
          },
        },
      ],
      skills: [],
    }),
  );
  await page.route('**/api/v1/learning-spaces/**', (route) =>
    json(route, {
      pathId: '018f0000-0000-7000-8000-000000000030',
      subjectId: '018f0000-0000-7000-8000-000000000031',
      courses: {
        items: [
          {
            id: 'crs-1',
            title: 'دورة تأسيس اللفظي الشاملة',
            description: 'شرح مفصل لكافة استراتيجيات استيعاب المقروء والتناظر والخطأ السياقي.',
            level: 'تأسيس',
            instructor: 'أ. خالد التميمي',
            duration: '14 ساعة',
            enrolledCount: 320,
          },
        ],
      },
      foundation: {
        items: [
          {
            id: 'fnd-1',
            title: 'إتقان التناظر اللفظي',
            description: 'العلاقات العشر الأكثر تكراراً في اختبارات قياس المحوسبة والورقية.',
            isLocked: false,
            lessonsCount: 6,
            quizzesCount: 2,
            supportFilesCount: 1,
            lessons: [{ id: 'les-1', title: 'علاقة الجزء بالكل والسببية', duration: '12:40' }],
            quizzes: [{ id: 'q-1', title: 'اختبار قصير: 10 مسائل تناظر' }],
            supportFiles: [{ id: 'f-1', title: 'ملخص جداول علاقات التناظر PDF' }],
          },
        ],
      },
      questions: { items: [] },
      exams: { items: [] },
      library: {
        items: [
          {
            id: 'lib-1',
            title: 'حقيبة تجميعات 1445 اللفظي',
            description: 'ملف PDF يحتوي على أحدث النماذج المنقحة مع مفاتيح الإجابة.',
            type: 'pdf',
            isLocked: false,
          },
        ],
      },
    }),
  );
  await page.route('**/api/v1/learning-spaces/foundation/*', (route) =>
    json(route, {
      topic: {
        id: 'fnd-1',
        parentTopicId: '',
        title: 'إتقان التناظر اللفظي',
        description: 'العلاقات العشر الأكثر تكراراً في اختبارات قياس المحوسبة والورقية.',
        sortOrder: 1,
        isLocked: false,
        lessons: [
          {
            id: 'les-1',
            title: 'علاقة الجزء بالكل والسببية',
            description: 'شرح مفصل مع أمثلة وتطبيقات عملية',
            type: 'video',
            durationSeconds: 760,
            isLocked: false,
            isPreview: false,
            commerceLocked: false,
            sortOrder: 1,
          },
        ],
        libraryItems: [
          {
            id: 'lib-fnd-1',
            title: 'ملخص جداول علاقات التناظر PDF',
            description: 'ملخص للقواعد الأساسية',
            type: 'pdf',
            isLocked: false,
          },
        ],
      },
    }),
  );
}

test.describe('Complete Admin Departments and Learning Space Parity Suite', () => {
  test('1. Subject Settings in Taxonomy Admin Page (/admin-dashboard/taxonomy)', async ({ page }) => {
    await setupMocks(page);
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto('/admin-dashboard/taxonomy?tab=subjects&subject=018f0000-0000-7000-8000-000000000031&subjectTab=settings');
    await page.waitForLoadState('networkidle');

    // 1. Check Subject Settings Title & Controls
    await expect(page.getByRole('heading', { name: /التحكم بما يظهر للطالب في صفحة التعلم/ })).toBeVisible();
    await expect(page.getByText('تبويب "الدورات والباقات"')).toBeVisible();
    await expect(page.getByText('تبويب "التأسيس والمهارات"')).toBeVisible();
    await expect(page.getByText('قفل التأسيس لغير المشتركين')).toBeVisible();
    await expect(page.getByText('تبويب "التدريب وبنك الأسئلة"')).toBeVisible();
    await expect(page.getByText('تبويب "الاختبارات والتقييم"')).toBeVisible();
    await expect(page.getByText('تبويب "المكتبة والمراجع"')).toBeVisible();

    await page.screenshot({ path: path.join(ARTIFACTS_DIR, 'admin-subject-settings-desktop-1440.png'), fullPage: true });
  });

  test('2. Student Learning Space (/learning): Full 5 Tabs and Content Breakdown', async ({ page }) => {
    await setupMocks(page);
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto('/learning?pathId=018f0000-0000-7000-8000-000000000030&subjectId=018f0000-0000-7000-8000-000000000031&tab=courses');
    await page.waitForLoadState('networkidle');

    // Check header
    await expect(page.getByRole('heading', { name: /القدرات العامة \(اللفظي\)/ })).toBeVisible();

    // Check Courses tab content
    await expect(page.getByText('دورة تأسيس اللفظي الشاملة')).toBeVisible();

    // Check Foundation tab
    await page.getByRole('button', { name: 'التأسيس' }).click();
    await expect(page.getByText('إتقان التناظر اللفظي')).toBeVisible();

    // Open Foundation breakdown dialog
    await page.getByRole('button', { name: /إتقان التناظر اللفظي/ }).click();
    await expect(page.getByTestId('foundation-topic-dialog').getByRole('heading', { name: 'إتقان التناظر اللفظي' })).toBeVisible();
    await expect(page.getByText('علاقة الجزء بالكل والسببية')).toBeVisible();

    // Close Dialog
    await page.keyboard.press('Escape');

    await page.screenshot({ path: path.join(ARTIFACTS_DIR, 'learning-space-verbal-desktop-1440.png'), fullPage: true });
  });

  test('3. Announcement Ads Workspace (/admin-dashboard/announcements)', async ({ page }) => {
    await setupMocks(page);
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto('/admin-dashboard/announcements');
    await page.waitForLoadState('networkidle');

    await expect(page.getByRole('heading', { name: 'الإعلانات العائمة والتنبيهات الترويجية' })).toBeVisible();
    await expect(page.getByText('قوالب إعلانية جاهزة للمنصة')).toBeVisible();
    await expect(page.getByText('معرض صور المنصة الجاهزة')).toBeVisible();
    await expect(page.getByText('المعاينة التقريبية')).toBeVisible();

    await page.screenshot({ path: path.join(ARTIFACTS_DIR, 'admin-announcements-desktop-1440.png'), fullPage: true });
  });

  test('4. Platform Integrations Workspace (/admin-dashboard/integrations)', async ({ page }) => {
    await setupMocks(page);
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto('/admin-dashboard/integrations');
    await page.waitForLoadState('networkidle');

    await expect(page.getByRole('heading', { name: 'إدارة التكاملات وبوابة التسجيل' })).toBeVisible();
    await expect(page.getByText('السماح بالتسجيل الذاتي')).toBeVisible();

    // Check Providers tab
    await page.getByRole('button', { name: 'مزودو الفصول والبث المباشر' }).click();
    await expect(page.getByText('Google Meet')).toBeVisible();
    await expect(page.getByText('Zoom Meetings')).toBeVisible();
    await expect(page.getByText('Microsoft Teams')).toBeVisible();

    await page.screenshot({ path: path.join(ARTIFACTS_DIR, 'admin-integrations-desktop-1440.png'), fullPage: true });
  });

  test('5. Backups and Recovery Workspace (/admin-dashboard/backups)', async ({ page }) => {
    await setupMocks(page);
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto('/admin-dashboard/backups');
    await page.waitForLoadState('networkidle');

    await expect(page.getByRole('heading', { name: 'مركز النسخ الاحتياطي والاستعادة' })).toBeVisible();
    await expect(page.getByText('إنشاء وتنزيل نسخة احتياطية')).toBeVisible();
    await expect(page.getByText('استعادة من ملف احتياطي')).toBeVisible();
    await expect(page.getByText('سجل النسخ الاحتياطية والتصدير الأخير')).toBeVisible();

    await page.screenshot({ path: path.join(ARTIFACTS_DIR, 'admin-backups-desktop-1440.png'), fullPage: true });
  });
});
