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

async function auth(page: Page) {
  await page.route('**/api/v1/auth/me', (route) => json(route, { user: admin }));
  await page.route('**/api/v1/auth/csrf', (route) => json(route, { csrfToken: 'csrf-users-visual' }));
}

function mockUsersData() {
  return {
    users: [
      {
        id: 'usr-1',
        email: 'ahmed.student@example.com',
        name: 'أحمد محمود',
        status: 'active',
        avatarUrl: '',
        nationalId: '1098765432',
        phone: '0501234567',
        emailVerified: true,
        role: 'student',
        roles: ['student'],
        isActive: true,
        createdAt: '2026-01-10T10:00:00Z',
        updatedAt: '2026-01-10T10:00:00Z',
      },
      {
        id: 'usr-2',
        email: 'khalid.trainer@example.com',
        name: 'أ. خالد التميمي',
        status: 'active',
        avatarUrl: '',
        nationalId: '1087654321',
        phone: '0555123456',
        emailVerified: true,
        role: 'teacher',
        roles: ['teacher'],
        isActive: true,
        managedPathIds: ['018f0000-0000-7000-8000-000000000030'],
        createdAt: '2026-01-11T11:00:00Z',
        updatedAt: '2026-01-11T11:00:00Z',
      },
      {
        id: 'usr-3',
        email: 'school.teacher@example.com',
        name: 'أ. سارة القحطاني',
        status: 'active',
        avatarUrl: '',
        phone: '0544987654',
        emailVerified: true,
        role: 'teacher',
        roles: ['teacher'],
        isActive: true,
        schoolId: 'sch-1',
        createdAt: '2026-01-12T12:00:00Z',
        updatedAt: '2026-01-12T12:00:00Z',
      },
      {
        id: 'usr-4',
        email: 'parent.fahad@example.com',
        name: 'فهد العتيبي (ولي أمر)',
        status: 'active',
        avatarUrl: '',
        nationalId: '1076543210',
        phone: '0566778899',
        emailVerified: true,
        role: 'parent',
        roles: ['parent'],
        isActive: true,
        linkedStudentIds: ['usr-1'],
        createdAt: '2026-01-13T13:00:00Z',
        updatedAt: '2026-01-13T13:00:00Z',
      },
      {
        id: 'usr-5',
        email: 'inactive.user@example.com',
        name: 'مستخدم متوقف',
        status: 'inactive',
        avatarUrl: '',
        phone: '0511223344',
        emailVerified: false,
        role: 'student',
        roles: ['student'],
        isActive: false,
        createdAt: '2026-01-14T14:00:00Z',
        updatedAt: '2026-01-14T14:00:00Z',
      },
    ],
    pagination: {
      page: 1,
      limit: 25,
      total: 5,
      totalPages: 1,
    },
  };
}

function mockUsersSummary() {
  return {
    total: 5,
    inactive: 1,
    byRole: {
      student: 2,
      teacher: 2,
      parent: 1,
      admin: 1,
    },
    platformTrainers: 1,
  };
}

async function setupMocks(page: Page) {
  await auth(page);
  await page.route('**/api/v1/auth/admin/users*', (route) => json(route, mockUsersData()));
  await page.route('**/api/v1/auth/admin/users/summary', (route) => json(route, mockUsersSummary()));
  await page.route('**/api/v1/schools*', (route) =>
    json(route, {
      schools: [{ id: 'sch-1', code: 'SCH-01', name: 'مدارس المجد النموذجية', status: 'active' }],
      pagination: { page: 1, limit: 100, total: 1, totalPages: 1 },
    }),
  );
  await page.route('**/api/v1/taxonomy/core*', (route) =>
    json(route, {
      paths: [{ id: '018f0000-0000-7000-8000-000000000030', code: 'QUDRAT', name: 'القدرات العامة' }],
      subjects: [],
    }),
  );
}

test.describe('Users and Trainers Management Workspace Suite', () => {
  test('Desktop (1440px): Metrics, Search, Filters, Users Table, and Create Modal', async ({ page }) => {
    await setupMocks(page);
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto('/admin-dashboard/users');
    await page.waitForLoadState('networkidle');

    // 1. Header Verification
    await expect(page.getByRole('heading', { name: 'إدارة المستخدمين' })).toBeVisible();
    await expect(page.getByText('USER & ROLE MANAGEMENT')).toBeVisible();

    // 2. Metrics Verification
    await expect(page.getByText('إجمالي الحسابات')).toBeVisible();
    await expect(page.getByText('المعلمون والمدربون')).toBeVisible();
    await expect(page.getByText('حسابات متوقفة')).toBeVisible();

    // 3. Table Rows Verification
    await expect(page.getByText('أحمد محمود')).toBeVisible();
    await expect(page.getByText('أ. خالد التميمي')).toBeVisible();
    await expect(page.getByText('أ. سارة القحطاني')).toBeVisible();
    await expect(page.getByText('فهد العتيبي (ولي أمر)')).toBeVisible();
    await expect(page.getByText('مستخدم متوقف')).toBeVisible();

    // 4. Badges Verification
    await expect(page.getByText('مدرب منصة')).toBeVisible();
    await expect(page.getByText('معلم مدرسة')).toBeVisible();
    await expect(page.getByText('ولي أمر', { exact: true })).toBeVisible();

    // 5. Test Create Modal
    await page.getByRole('button', { name: 'إضافة مستخدم جديد' }).click();
    await expect(page.getByRole('heading', { name: 'إضافة مستخدم جديد' })).toBeVisible();
    await expect(page.getByPlaceholder('محمد أحمد...')).toBeVisible();
    await page.getByRole('button', { name: 'إلغاء' }).click();

    await page.screenshot({ path: path.join(ARTIFACTS_DIR, 'users-manager-desktop-1440.png'), fullPage: true });
  });

  test('Trainers Workspace view (/admin-dashboard/trainers)', async ({ page }) => {
    page.on('console', (msg) => console.log('PAGE LOG:', msg.text()));
    page.on('pageerror', (err) => console.log('PAGE ERROR:', err.message));
    await setupMocks(page);
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto('/admin-dashboard/trainers');
    await page.waitForLoadState('networkidle');

    await expect(page.getByRole('heading', { name: 'إدارة المدربين والمعلمين' })).toBeVisible();
  });

  test('Tablet (820px) and Mobile (390px) responsive screenshots', async ({ page }) => {
    await setupMocks(page);

    // Tablet
    await page.setViewportSize({ width: 820, height: 1180 });
    await page.goto('/admin-dashboard/users');
    await page.waitForLoadState('networkidle');
    await expect(page.getByRole('heading', { name: 'إدارة المستخدمين' })).toBeVisible();
    await page.screenshot({ path: path.join(ARTIFACTS_DIR, 'users-manager-tablet-820.png'), fullPage: true });

    // Mobile
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/admin-dashboard/users');
    await page.waitForLoadState('networkidle');
    await expect(page.getByRole('heading', { name: 'إدارة المستخدمين' })).toBeVisible();
    await page.screenshot({ path: path.join(ARTIFACTS_DIR, 'users-manager-mobile-390.png'), fullPage: true });
  });
});
