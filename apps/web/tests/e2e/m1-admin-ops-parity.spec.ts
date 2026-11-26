import { expect, test, type Page, type Route } from '@playwright/test';
import { installBaselineMocks } from './fixtures/mockBaseline';

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
  return route.fulfill({
    status,
    contentType: 'application/json',
    body: JSON.stringify(body),
  });
}

async function setupAdminBase(page: Page) {
  await installBaselineMocks(page);
  await page.route('**/api/v1/auth/me*', (r) => json(r, { user: admin }));
  await page.route('**/api/v1/auth/csrf*', (r) => json(r, { csrfToken: 'csrf-m1-parity' }));
}

test.describe('Milestone M1 Admin Ops, Backup, Shell & School Contract Parity', () => {
  test('PlatformIntegrationsAdminPage persists auth/SEO/contact settings across reload and propagates save error', async ({ page }) => {
    await setupAdminBase(page);

    let stored = {
      settings: {
        auth: {
          allowSelfRegistration: true,
          allowEmailPassword: true,
          requireEmailVerification: false,
          requireAdminApproval: false,
          defaultRole: 'student',
          registrationTitle: 'انضم إلى مجتمع المئة التعليمي',
          registrationSubtitle: 'سجّل حسابك للوصول إلى كافة شروحات وتدريبات قياس',
          termsLink: '/terms',
          privacyLink: '/privacy',
          maxAccountsPerDevice: 3,
        },
        providers: {
          googleMeet: { enabled: true, mode: 'oauth', note: 'مربوط للاجتماعات الفردية والجماعية' },
          zoom: { enabled: false, mode: 'oauth', note: 'غير مفعل' },
          teams: { enabled: false, mode: 'oauth', note: 'غير مفعل' },
          youtubeLive: { enabled: false, mode: 'api', note: 'بث الحصص العامة' },
          googleOAuth: { enabled: true, mode: 'oauth', note: 'تسجيل الدخول السريع عبر Google' },
          whatsappOTP: { enabled: false, mode: 'otp', note: 'التحقق عبر الواتساب' },
        },
        seo: {
          siteName: 'منصة المئة',
          defaultTitle: 'منصة المئة',
          defaultDescription: 'وصف افتراضي',
          canonicalBaseUrl: 'https://almeaa.com',
          googleAnalyticsId: '',
          googleTagManagerId: '',
          robotsIndexing: true,
        },
        contactWidget: {
          enabled: true,
          channel: 'whatsapp',
          whatsappNumber: '+966500000000',
          whatsappMessage: 'مرحبا',
          openInNewTab: true,
          showOnPublicPages: true,
          showOnDashboardPages: true,
        },
      },
      revision: 1,
      updatedAt: '2026-11-25T10:00:00Z',
      runtimeStatus: {
        google_oauth: { configured: true, detail: 'Google OAuth client credentials' },
        whatsapp: { configured: false, detail: 'WhatsApp provider' },
      },
    };

    let forceConflict = false;
    await page.route('**/api/v1/operations/integrations', async (route) => {
      if (route.request().method() === 'GET') {
        return json(route, stored);
      }
      expect(route.request().headers()['x-csrf-token']).toBe('csrf-m1-parity');
      if (forceConflict) {
        return json(route, { message: 'Operations state conflict' }, 409);
      }
      const patch = route.request().postDataJSON();
      expect(patch.expectedRevision).toBe(stored.revision);
      stored = {
        ...stored,
        revision: stored.revision + 1,
        settings: {
          ...stored.settings,
          ...(patch.auth ? { auth: patch.auth } : {}),
          ...(patch.providers ? { providers: patch.providers } : {}),
          ...(patch.seo ? { seo: patch.seo } : {}),
          ...(patch.contactWidget ? { contactWidget: patch.contactWidget } : {}),
        },
      };
      return json(route, stored);
    });

    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto('/admin-dashboard/integrations');
    await expect(page.getByRole('heading', { name: 'إدارة التكاملات وبوابة التسجيل' })).toBeVisible();
    await expect(page.getByText(/REV 1/)).toBeVisible();

    await page.getByLabel('الدور الافتراضي للتسجيل الجديد').selectOption('parent');
    await page.getByRole('button', { name: 'ودجت الدعم المباشر' }).click();
    await page.getByPlaceholder('+9665XXXXXXXX').fill('+966599998888');
    await page.getByRole('button', { name: 'حفظ كافة الإعدادات' }).click();

    await expect(page.getByText('تم حفظ إعدادات التكاملات والتسجيل في قاعدة البيانات بنجاح.')).toBeVisible();
    await expect(page.getByText(/REV 2/)).toBeVisible();

    // Reload and verify PostgreSQL-backed settings persist
    await page.reload();
    await expect(page.getByText(/REV 2/)).toBeVisible();
    await expect(page.getByLabel('الدور الافتراضي للتسجيل الجديد')).toHaveValue('parent');

    // Error propagation check (never fakes success)
    forceConflict = true;
    await page.getByRole('button', { name: 'حفظ كافة الإعدادات' }).click();
    await expect(page.getByRole('alert')).toContainText('Operations state conflict');

    // Check RTL and zero horizontal overflow at 390, 820, 1440
    for (const vp of [
      { width: 390, height: 844 },
      { width: 820, height: 1180 },
      { width: 1440, height: 900 },
    ]) {
      await page.setViewportSize(vp);
      const ok = await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1);
      expect(ok, `overflow at ${vp.width}px`).toBe(true);
    }
  });

  test('BackupAdminPage shows honest empty state (no snap-1/snap-2) and persists 10-collection exports', async ({ page }) => {
    await setupAdminBase(page);

    const history: Array<Record<string, unknown>> = [];
    await page.route('**/api/v1/operations/backups', (route) =>
      json(route, { items: history, total: history.length }),
    );
    await page.route('**/api/v1/operations/backups/export', (route) => {
      expect(route.request().method()).toBe('POST');
      expect(route.request().headers()['x-csrf-token']).toBe('csrf-m1-parity');
      const rec = {
        id: 'exp-1',
        title: 'تصدير كامل للمنصة (10 عنصر)',
        scope: 'full',
        schemaVersion: 1,
        summary: {
          paths: 1, levels: 1, subjects: 1, skills: 1, courses: 1,
          lessons: 1, questions: 1, quizzes: 1, library: 1, schools: 1,
        },
        totalRecords: 10,
        createdBy: 'admin-1',
        createdByEmail: 'admin@example.com',
        createdAt: '2026-11-25T10:15:00Z',
      };
      history.unshift(rec);
      return json(route, {
        exportRecord: rec,
        payload: {
          kind: 'almeaa-platform-backup',
          schemaVersion: 1,
          createdAt: rec.createdAt,
          summary: rec.summary,
          collections: {
            paths: [{}], levels: [{}], subjects: [{}], skills: [{}], courses: [{}],
            lessons: [{}], questions: [{}], quizzes: [{}], library: [{}], schools: [{}],
          },
        },
      });
    });

    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto('/admin-dashboard/backups');
    await expect(page.getByRole('heading', { name: 'مركز النسخ الاحتياطي والاستعادة' })).toBeVisible();
    await expect(page.getByText('لا توجد عمليات تصدير مسجلة في قاعدة البيانات بعد')).toBeVisible();
    await expect(page.getByText('1450')).toHaveCount(0);

    await page.getByRole('button', { name: 'تصدير نسخة احتياطية كاملة' }).click();
    await expect(page.getByText(/تم تصدير وتنزيل النسخة الاحتياطية بنجاح \(10 عنصر\)/)).toBeVisible();
    await expect(page.getByText('تصدير كامل للمنصة (10 عنصر)')).toBeVisible();

    await page.reload();
    await expect(page.getByText('تصدير كامل للمنصة (10 عنصر)')).toBeVisible();

    for (const vp of [
      { width: 390, height: 844 },
      { width: 820, height: 1180 },
      { width: 1440, height: 900 },
    ]) {
      await page.setViewportSize(vp);
      const ok = await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1);
      expect(ok, `overflow at ${vp.width}px`).toBe(true);
    }
  });

  test('AdminDashboardShell wires ThemeToggle, SearchModal, Cart link, NotificationBell and removes static role pill', async ({ page }) => {
    await setupAdminBase(page);
    await page.route('**/api/v1/operations/readiness', (r) =>
      json(r, {
        checkedAt: '2026-11-25T10:00:00Z',
        status: 'ready_with_notes',
        dependencies: { postgres: true, redis: true },
        integrations: [],
        counts: { notificationPending: 0, notificationRetrying: 0, notificationFailed: 0, auditBlocked24h: 0, auditFailed24h: 0, liveClassrooms: 0, enabledAiProviders: 0 },
        releaseIdentity: { environment: 'local', commitSha: '', deploymentProvider: '', proof: 'external_proof_required', detail: '' },
        releaseEvidence: [],
        releaseDecision: 'internal_ready_external_evidence_pending',
        backupRestoreProof: 'external_proof_required',
        backupRestoreDetail: '',
      }),
    );

    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto('/admin-dashboard');
    await expect(page.getByText('تغيير الدور')).toHaveCount(0);

    // Theme toggle switches html.dark and localStorage.almeaa_theme
    const themeBtn = page.getByRole('button', { name: /تفعيل الوضع الداكن|تفعيل الوضع الفاتح/ });
    await themeBtn.click();
    await expect.poll(() => page.evaluate(() => document.documentElement.classList.contains('dark'))).toBe(true);
    await expect.poll(() => page.evaluate(() => window.localStorage.getItem('almeaa_theme'))).toBe('dark');

    // Search modal opens
    await page.getByRole('button', { name: 'بحث' }).click();
    await expect(page.getByLabel('Search query')).toBeVisible();
    await page.getByRole('button', { name: 'Close search' }).click();

    // Cart link points to /cart and NotificationBell opens
    await expect(page.getByRole('link', { name: 'السلة' })).toHaveAttribute('href', '/cart');
    await page.getByRole('button', { name: 'الإشعارات' }).click();
    await expect(page.getByText('لا توجد إشعارات')).toBeVisible();
  });

  test('SchoolsAdminPage distinguishes 404 (new contract) from 500 error without fabricating 6 modules', async ({ page }) => {
    await setupAdminBase(page);

    const school404 = '018f0000-0000-7000-8000-000000000404';
    const school500 = '018f0000-0000-7000-8000-000000000500';
    await page.route('**/api/v1/schools?page=1&limit=100&status=active', (r) =>
      json(r, {
        schools: [
          { id: school404, code: 'SCH-404', name: 'مدرسة بدون عقد', status: 'active', stats: { classesCount: 0, studentsCount: 0, teachersCount: 0, supervisorsCount: 0, activePackagesCount: 0, activeAccessCodesCount: 0, contractStatus: 'none' } },
          { id: school500, code: 'SCH-500', name: 'مدرسة خطأ خادم', status: 'active', stats: { classesCount: 0, studentsCount: 0, teachersCount: 0, supervisorsCount: 0, activePackagesCount: 0, activeAccessCodesCount: 0, contractStatus: 'none' } },
        ],
        pagination: { page: 1, limit: 100, total: 2, totalPages: 1 },
      }),
    );
    await page.route('**/api/v1/schools/*/classes*', (r) => json(r, { classes: [], pagination: { page: 1, limit: 100, total: 0, totalPages: 1 } }));
    await page.route('**/api/v1/schools/*/roster*', (r) => json(r, { members: [], pagination: { page: 1, limit: 100, total: 0, totalPages: 1 } }));
    await page.route('**/api/v1/schools/*/assignments*', (r) => json(r, { assignments: [], pagination: { page: 1, limit: 50, total: 0, totalPages: 1 } }));
    await page.route('**/api/v1/schools/*/directors*', (r) => json(r, { directors: [] }));
    await page.route('**/api/v1/commerce/products*', (r) => json(r, { items: [], page: 1, limit: 50, hasMore: false }));
    await page.route('**/api/v1/commerce/admin/access-codes*', (r) => json(r, { items: [], page: 1, limit: 100, hasMore: false }));

    await page.route(`**/api/v1/schools/${school404}/contract`, (r) => json(r, { message: 'Not found' }, 404));
    await page.route(`**/api/v1/school-contracts/${school404}`, (r) => json(r, { message: 'Not found' }, 404));
    await page.route(`**/api/v1/schools/${school500}/contract`, (r) => json(r, { message: 'Internal error' }, 500));

    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto('/admin-dashboard/schools');

    // Open 404 school -> Contract tab -> only SCHOOL_CORE enabled, clear notice, save enabled
    await page.getByRole('button', { name: 'العقد والباقة' }).first().click();
    await expect(page.getByText('لا يوجد عقد محفوظ بعد. سيُنشأ عند الحفظ الأول.')).toBeVisible();
    await expect(page.getByText('مفعل: 1 من 11')).toBeVisible();
    await expect(page.getByRole('button', { name: 'حفظ واعتماد بنود العقد' })).toBeEnabled();

    // Return to portfolio & open 500 school -> Contract tab -> error message, 0 modules, save disabled
    await page.getByRole('button', { name: 'العودة لمحفظة المدارس' }).click();
    await page.getByRole('button', { name: 'العقد والباقة' }).nth(1).click();
    await expect(page.getByText('تعذر قراءة العقد من الخادم. لم يتم تغيير أي بيانات محليًا.')).toBeVisible();
    await expect(page.getByText('مفعل: 0 من 11')).toBeVisible();
    await expect(page.getByRole('button', { name: 'حفظ واعتماد بنود العقد' })).toBeDisabled();
  });
});
