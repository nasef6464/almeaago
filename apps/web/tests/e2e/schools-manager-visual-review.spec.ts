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
  return {
    schools: [
      {
        id: '018f0000-0000-7000-8000-000000000010',
        code: 'SCH-DEMO-01',
        name: 'مدارس المئة النموذجية الأهلية',
        status: 'active',
      },
      {
        id: '018f0000-0000-7000-8000-000000000020',
        code: 'SCH-RIYADH-02',
        name: 'مدارس الرياض العالمية',
        status: 'active',
      },
      {
        id: '018f0000-0000-7000-8000-000000000030',
        code: 'SCH-JEDDAH-03',
        name: 'مدارس الفكر الواعد الحديثة',
        status: 'draft',
      },
    ],
    classes: [
      {
        id: 'cls-1',
        schoolId: '018f0000-0000-7000-8000-000000000010',
        code: 'CLS-10A',
        name: 'الصف الأول الثانوي / أ',
        status: 'active',
      },
      {
        id: 'cls-2',
        schoolId: '018f0000-0000-7000-8000-000000000010',
        code: 'CLS-10B',
        name: 'الصف الأول الثانوي / ب',
        status: 'active',
      },
      {
        id: 'cls-3',
        schoolId: '018f0000-0000-7000-8000-000000000010',
        code: 'CLS-11A',
        name: 'الصف الثاني الثانوي / علمي',
        status: 'active',
      },
    ],
    students: [
      {
        studentId: 'st-1',
        name: 'عبدالله محمد الغامدي',
        email: 'a.ghamdi@school.edu.sa',
        phone: '0551234567',
        isActive: true,
        classId: 'cls-1',
        className: 'الصف الأول الثانوي / أ',
      },
      {
        studentId: 'st-2',
        name: 'فيصل سعد الدوسري',
        email: 'f.dosari@school.edu.sa',
        phone: '0552345678',
        isActive: true,
        classId: 'cls-1',
        className: 'الصف الأول الثانوي / أ',
      },
      {
        studentId: 'st-3',
        name: 'عمر خالد القرني',
        email: 'o.qarni@school.edu.sa',
        phone: '0553456789',
        isActive: true,
        classId: 'cls-2',
        className: 'الصف الأول الثانوي / ب',
      },
    ],
    teachers: [
      {
        teacherId: 'tch-1',
        name: 'أ. أحمد الشمري',
        email: 'shammari@almeaa.edu.sa',
        isActive: true,
      },
      {
        teacherId: 'tch-2',
        name: 'أ. إبراهيم الزهراني',
        email: 'zahrani@almeaa.edu.sa',
        isActive: true,
      },
    ],
    contract: {
      status: 'active',
      modules: ['smart_classroom', 'assessments', 'parent_portal', 'supervisors'],
    },
  };
}

async function setupSchoolsMock(page: Page) {
  const data = mockSchoolsData();

  await page.route('**/api/v1/schools/?page=1&limit=100&status=active', (route) => {
    return json(route, {
      schools: data.schools,
      pagination: { page: 1, limit: 100, total: data.schools.length, totalPages: 1 },
    });
  });

  await page.route('**/api/v1/schools/018f0000-0000-7000-8000-000000000010/classes*', (route) => {
    return json(route, {
      classes: data.classes,
      pagination: { page: 1, limit: 100, total: data.classes.length, totalPages: 1 },
    });
  });

  await page.route('**/api/school-access/director/schools/018f0000-0000-7000-8000-000000000010/students*', (route) => {
    return json(route, {
      students: data.students,
      total: data.students.length,
    });
  });

  await page.route('**/api/school-access/director/schools/018f0000-0000-7000-8000-000000000010/teachers', (route) => {
    return json(route, {
      teachers: data.teachers,
      assignments: [],
    });
  });

  await page.route('**/api/v1/school-contracts/018f0000-0000-7000-8000-000000000010', (route) => {
    return json(route, {
      contract: data.contract,
    });
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
}

test.describe('Schools Management (تشغيل المدارس) - 100% Authentic Legacy Parity Review', () => {
  test('1440px Desktop: Visual verification of portfolio, workspace tabs, and modals', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await auth(page);
    await setupSchoolsMock(page);

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
    await expect(page.getByText('SCH-DEMO-PKG-01')).toBeVisible();

    // Generate new code
    await page.getByRole('button', { name: 'توليد كود وصول جديد' }).click();
    await expect(page.getByText('تم توليد كود وصول جديد')).toBeVisible();

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
