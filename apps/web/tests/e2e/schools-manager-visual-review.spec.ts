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

function json(route: Route, body: unknown, status = 200) {
  return route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) });
}

async function auth(page: Page) {
  await page.route('**/api/v1/auth/me', (route) => json(route, { user: admin }));
  await page.route('**/api/v1/auth/csrf', (route) => json(route, { csrfToken: 'csrf-schools-visual' }));
}

function mockSchoolsData() {
  const school1Id = '018f0000-0000-7000-8000-000000000010';
  return {
    schools: [
      {
        id: school1Id,
        code: 'SCH-M100-01',
        name: 'مدارس المئة النموذجية الأهلية',
        status: 'active',
        stats: {
          classesCount: 3,
          studentsCount: 3,
          teachersCount: 2,
          supervisorsCount: 1,
          activePackagesCount: 1,
          activeAccessCodesCount: 1,
          contractStatus: 'active',
        },
      },
      {
        id: '018f0000-0000-7000-8000-000000000020',
        code: 'SCH-RIYADH-02',
        name: 'مدارس الرياض العالمية',
        status: 'active',
        stats: {
          classesCount: 1,
          studentsCount: 10,
          teachersCount: 0,
          supervisorsCount: 0,
          activePackagesCount: 0,
          activeAccessCodesCount: 0,
          contractStatus: 'none',
        },
      },
      {
        id: '018f0000-0000-7000-8000-000000000030',
        code: 'SCH-JEDDAH-03',
        name: 'مدارس الفكر الواعد الحديثة',
        status: 'draft',
        stats: {
          classesCount: 0,
          studentsCount: 0,
          teachersCount: 0,
          supervisorsCount: 0,
          activePackagesCount: 0,
          activeAccessCodesCount: 0,
          contractStatus: 'none',
        },
      },
    ],
    classes: [
      {
        id: 'cls-1',
        schoolId: school1Id,
        code: 'CLS-10A',
        name: 'الصف الأول الثانوي / أ',
        status: 'active',
      },
      {
        id: 'cls-2',
        schoolId: school1Id,
        code: 'CLS-10B',
        name: 'الصف الأول الثانوي / ب',
        status: 'active',
      },
      {
        id: 'cls-3',
        schoolId: school1Id,
        code: 'CLS-11A',
        name: 'الصف الثاني الثانوي / علمي',
        status: 'active',
      },
    ],
    studentMembers: [
      { userId: 'st-1', name: 'عبدالله محمد الغامدي', email: 'a.ghamdi@school.edu.sa', status: 'active', roles: ['student'], classIds: ['cls-1'] },
      { userId: 'st-2', name: 'فيصل سعد الدوسري', email: 'f.dosari@school.edu.sa', status: 'active', roles: ['student'], classIds: ['cls-1'] },
      { userId: 'st-3', name: 'عمر خالد القرني', email: 'o.qarni@school.edu.sa', status: 'active', roles: ['student'], classIds: ['cls-2'] },
    ],
    teacherMembers: [
      { userId: 'tch-1', name: 'أ. أحمد الشمري', email: 'shammari@almeaa.edu.sa', status: 'active', roles: ['teacher'], classIds: ['cls-1'] },
      { userId: 'tch-2', name: 'أ. إبراهيم الزهراني', email: 'zahrani@almeaa.edu.sa', status: 'active', roles: ['teacher'], classIds: ['cls-2'] },
    ],
    supervisorMembers: [
      { userId: 'sup-1', name: 'أ. سعد العتيبي', email: 'supervisor@almeaa.edu.sa', status: 'active', roles: ['supervisor'], classIds: [] },
    ],
    assignments: [
      { id: 'asg-1', schoolId: school1Id, teacherId: 'tch-1', classId: 'cls-1', subjectId: 'sub-math', status: 'active' },
    ],
    products: [
      {
        id: 'pkg-school-1',
        code: 'PKG-QUDRAT-SCH',
        productType: 'package',
        name: 'باقة القدرات العامة للمدارس',
        description: 'باقة شاملة للمدارس',
        status: 'active',
        accessMode: 'paid',
        priceMinor: 15000,
        currency: 'SAR',
        courseId: '',
        isVisible: true,
        revision: 1,
        package: { id: 'pk-1', productId: 'pkg-school-1', packageKind: 'school', seatCapacity: 200, validityDays: 365 },
        createdAt: '2026-10-01T00:00:00Z',
        updatedAt: '2026-10-01T00:00:00Z',
      },
    ],
    accessCodes: [
      {
        id: 'code-1',
        code: 'SCHM100-ALPHA',
        productId: 'pkg-school-1',
        schoolId: school1Id,
        status: 'active',
        maxUses: 50,
        currentUses: 4,
        startsAt: '2026-10-01T00:00:00Z',
        expiresAt: '2027-06-30T00:00:00Z',
        revision: 1,
        createdAt: '2026-10-01T00:00:00Z',
        updatedAt: '2026-10-01T00:00:00Z',
      },
    ],
    contract: {
      id: 'contract-1',
      schoolId: school1Id,
      status: 'active',
      modules: ['SCHOOL_CORE', 'QUESTION_BANK', 'SCHOOL_ASSESSMENTS', 'SMART_CLASSROOM'],
      validFrom: '2026-09-01T00:00:00Z',
      validUntil: '2027-06-30T00:00:00Z',
      revision: 2,
    },
  };
}

async function setupSchoolsMock(page: Page) {
  const data = mockSchoolsData();
  const school1Id = '018f0000-0000-7000-8000-000000000010';
  let directorEndpointCalls = 0;

  await page.route('**/api/school-access/director/**', (route) => {
    directorEndpointCalls += 1;
    return json(route, { message: 'Forbidden' }, 403);
  });

  await page.route('**/api/v1/schools/?page=1&limit=100&status=active', (route) => {
    return json(route, {
      schools: data.schools,
      pagination: { page: 1, limit: 100, total: data.schools.length, totalPages: 1 },
    });
  });

  await page.route(`**/api/v1/schools/${school1Id}/classes*`, (route) => {
    return json(route, {
      classes: data.classes,
      pagination: { page: 1, limit: 100, total: data.classes.length, totalPages: 1 },
    });
  });

  await page.route(`**/api/v1/schools/${school1Id}/roster*`, (route) => {
    const url = new URL(route.request().url());
    const role = url.searchParams.get('role');
    const members =
      role === 'student'
        ? data.studentMembers
        : role === 'teacher'
          ? data.teacherMembers
          : role === 'supervisor'
            ? data.supervisorMembers
            : [...data.studentMembers, ...data.teacherMembers];
    return json(route, {
      members,
      pagination: { page: 1, limit: 100, total: members.length, totalPages: 1 },
    });
  });

  await page.route(`**/api/v1/schools/${school1Id}/assignments*`, (route) => {
    return json(route, {
      assignments: data.assignments,
      pagination: { page: 1, limit: 50, total: data.assignments.length, totalPages: 1 },
    });
  });

  await page.route(`**/api/v1/schools/${school1Id}/directors*`, (route) => {
    return json(route, { directors: [] });
  });

  await page.route(`**/api/v1/schools/${school1Id}/contract`, (route) => {
    return json(route, { contract: data.contract });
  });

  await page.route('**/api/v1/commerce/products*', (route) => {
    return json(route, { items: data.products, page: 1, limit: 50, hasMore: false });
  });

  await page.route('**/api/v1/commerce/admin/access-codes*', (route) => {
    if (route.request().method() === 'POST') {
      const payload = route.request().postDataJSON();
      const created = {
        id: 'code-new-1',
        code: payload.code,
        productId: payload.productId,
        schoolId: payload.schoolId,
        status: 'active',
        maxUses: payload.maxUses,
        currentUses: 0,
        startsAt: '2026-11-25T00:00:00Z',
        expiresAt: payload.expiresAt,
        revision: 1,
        createdAt: '2026-11-25T00:00:00Z',
        updatedAt: '2026-11-25T00:00:00Z',
      };
      data.accessCodes.unshift(created);
      return json(route, { accessCode: created }, 201);
    }
    return json(route, { items: data.accessCodes, page: 1, limit: 100, hasMore: false });
  });

  await page.route('**/api/v1/schools/', (route) => {
    if (route.request().method() === 'POST') {
      const payload = route.request().postDataJSON();
      return json(route, {
        school: {
          id: '018f0000-0000-7000-8000-000000000099',
          code: payload.code || 'SCH-NEW-99',
          name: payload.name || 'مدرسة جديدة',
          status: 'active',
        },
      });
    }
    return route.continue();
  });

  return { getDirectorEndpointCalls: () => directorEndpointCalls };
}

test.describe('Schools Management (تشغيل المدارس) - 100% Authentic Legacy Parity Review', () => {
  test('1440px Desktop: Visual verification of portfolio, workspace tabs, and modals', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await auth(page);
    const tracker = await setupSchoolsMock(page);

    await page.goto('/admin-dashboard/schools');

    // 1. Sidebar Verification: "تشغيل المدارس" is active
    const sidebarSchoolItem = page.locator('aside[data-testid="admin-dashboard-sidebar"]').getByRole('link', { name: 'تشغيل المدارس' });
    await expect(sidebarSchoolItem).toBeVisible();
    await expect(sidebarSchoolItem).toHaveClass(/border-amber-500/);

    // 2. Portfolio Header & KPI Verification
    await expect(page.getByText('محفظة المدارس والشراكات التعليمية')).toBeVisible();
    await expect(page.getByText('إجمالي المدارس')).toBeVisible();
    await expect(page.getByText('جاهزة تشغيلياً')).toBeVisible();

    // 3. School Cards Verification
    const demoCard = page.locator('div').filter({ hasText: 'مدارس المئة النموذجية الأهلية' }).first();
    await expect(demoCard).toBeVisible();

    // 4. Test New School Wizard Modal
    const addSchoolBtn = page.getByRole('button', { name: 'إضافة مدرسة جديدة' });
    await addSchoolBtn.click();
    await expect(page.getByText('إضافة مدرسة جديدة للشراكات')).toBeVisible();
    await page.getByRole('button', { name: 'إلغاء' }).click();

    // 5. Open Dedicated School Workspace
    const openWorkspaceBtn = page.getByRole('button', { name: 'فتح مساحة العمل التشغيلية' }).first();
    await openWorkspaceBtn.click();

    // 6. Verify Workspace Header & Tabs
    await expect(page.getByRole('button', { name: 'العودة لمحفظة المدارس' })).toBeVisible();
    await expect(page.getByRole('button', { name: '🏠 نظرة عامة والعمليات' })).toBeVisible();
    await expect(page.getByRole('button', { name: '🏫 الفصول وكشف الطلاب' })).toBeVisible();
    await expect(page.getByRole('button', { name: '📦 باقات الوصول والأكواد' })).toBeVisible();
    await expect(page.getByRole('button', { name: '👥 المجتمع المدرسي والعلاقات' })).toBeVisible();
    await expect(page.getByRole('button', { name: '📥 الاستيراد الجماعي' })).toBeVisible();
    await expect(page.getByRole('button', { name: '📊 تقارير التسليم والجاهزية' })).toBeVisible();
    await expect(page.getByRole('button', { name: '⚙️ العقد والإعدادات' })).toBeVisible();

    // 7. Test Classes & Students Tab
    await page.getByRole('button', { name: '🏫 الفصول وكشف الطلاب' }).click();
    await expect(page.getByText('إدارة الفصول الدراسية وكشف الطلاب')).toBeVisible();
    await expect(page.getByRole('button', { name: 'فصل جديد' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'إضافة طالب' })).toBeVisible();
    await expect(page.getByText('عبدالله محمد الغامدي')).toBeVisible();

    // 8. Test Packages & Access Codes Tab
    await page.getByRole('button', { name: '📦 باقات الوصول والأكواد' }).click();
    await expect(page.getByText('باقات الوصول ورموز التفعيل (B2B Access Codes)')).toBeVisible();
    await expect(page.getByRole('button', { name: 'توليد كود وصول جديد' })).toBeVisible();
    await expect(page.getByText('SCHM100-ALPHA')).toBeVisible();
    await expect(page.getByText('SCH-DEMO-PKG-01')).toHaveCount(0);

    // Generate new persisted code via Commerce endpoint
    await page.getByRole('button', { name: 'توليد كود وصول جديد' }).click();
    await expect(page.getByText('تم توليد كود وصول جديد')).toBeVisible();
    expect(tracker.getDirectorEndpointCalls()).toBe(0);

    // 9. Test Reports Tab
    await page.getByRole('button', { name: '📊 تقارير التسليم والجاهزية' }).click();
    await expect(page.getByText('تقارير التسليم والجاهزية التشغيلية (Handover)')).toBeVisible();
    await expect(page.getByText('بيانات المدرسة وحسابات القيادة المدرسية')).toBeVisible();

    // 10. Test Contract & Safety Tab
    await page.getByRole('button', { name: '⚙️ العقد والإعدادات' }).click();
    await expect(page.getByText('إعدادات العقد والوحدات المفعلة')).toBeVisible();
    await expect(page.getByText('وحدة الفصول الذكية (Smart Classroom)')).toBeVisible();

    // Back to overview and capture screenshot
    await page.getByRole('button', { name: '🏠 نظرة عامة والعمليات' }).click();
    await page.screenshot({
      path: 'test-results/schools-manager-desktop-1440.png',
      fullPage: true,
    });
  });

  test('820px Tablet: Visual verification and RTL overflow assertion', async ({ page }) => {
    await page.setViewportSize({ width: 820, height: 1180 });
    await auth(page);
    await setupSchoolsMock(page);

    await page.goto('/admin-dashboard/schools');
    await expect(page.getByText('محفظة المدارس والشراكات التعليمية')).toBeVisible();

    // Open School Workspace
    await page.getByRole('button', { name: 'فتح مساحة العمل التشغيلية' }).first().click();
    await expect(page.getByRole('button', { name: 'العودة لمحفظة المدارس' })).toBeVisible();

    // Check horizontal overflow
    const hasHorizontalOverflow = await page.evaluate(() => {
      const el = document.documentElement;
      return el.scrollWidth > el.clientWidth + 2;
    });
    expect(hasHorizontalOverflow).toBe(false);

    await page.screenshot({
      path: 'test-results/schools-manager-tablet-820.png',
      fullPage: true,
    });
  });

  test('390px Mobile: Visual verification, responsiveness, and zero horizontal scroll', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await auth(page);
    await setupSchoolsMock(page);

    await page.goto('/admin-dashboard/schools');
    await expect(page.getByText('محفظة المدارس والشراكات التعليمية')).toBeVisible();

    // Check mobile drawer or menu toggle exists
    const menuBtn = page.getByRole('button', { name: 'فتح قائمة الإدارة' });
    await expect(menuBtn).toBeVisible();

    // Open School Workspace
    await page.getByRole('button', { name: 'فتح مساحة العمل التشغيلية' }).first().click();
    await expect(page.getByRole('button', { name: 'العودة لمحفظة المدارس' })).toBeVisible();

    // Check horizontal overflow on mobile
    const hasHorizontalOverflow = await page.evaluate(() => {
      const el = document.documentElement;
      return el.scrollWidth > el.clientWidth + 2;
    });
    expect(hasHorizontalOverflow).toBe(false);

    await page.screenshot({
      path: 'test-results/schools-manager-mobile-390.png',
      fullPage: true,
    });
  });
});
