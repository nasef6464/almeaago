import { expect, test, type Page, type Route } from '@playwright/test';

// Source contract: almeaacodax/main dashboards/SchoolTeacherDashboard.tsx
// and components/DashboardSectionNav.tsx. These are RED acceptance tests:
// the implementation belongs to the existing teacher-workspace owner (#165).
const teacher = {
  id: 'teacher-parity', email: 'teacher-parity@example.com', name: 'معلم الرياضيات',
  status: 'active', avatarUrl: '', emailVerified: true, role: 'teacher', roles: ['teacher'],
};
const school = {
  schoolId: 'school-a', schoolName: 'مدرسة ألف', source: 'membership',
  assignments: [{ assignmentId: 'assignment-a', classId: 'class-a', className: 'الأول ألف',
    subjectId: 'subject-a', studentCount: 11 }],
};
function json(route: Route, body: unknown) {
  return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(body) });
}
async function openTeacher(page: Page, width: number) {
  await page.route('**/api/v1/auth/me', route => json(route, { user: teacher }));
  await page.route('**/api/v1/schools/teacher-workspace', route => json(route, {
    personas: { platformTrainer: false, schoolTeacher: true }, schools: [school],
  }));
  await page.setViewportSize({ width, height: width === 390 ? 844 : 1000 });
  await page.goto('/school-teacher-dashboard');
  await expect(page.getByTestId('teacher-workspace')).toBeVisible();
}

const sourceGroups = [
  'الرئيسية', 'الحصص وتحضير الأسئلة', 'الاختبارات والتكليفات',
  'المهارات والتقارير', 'الشهادات',
];
const sourceActions = [
  'نظرة عامة', 'إدارة الحصص والجدول', 'بنك التحضير المسبق',
  'اختباراتي وتكليفاتي', 'التعلم والجاهزية', 'مهارات الحصص',
  'تقارير الحصص', 'شهادات التقدير والتحفيز',
];

for (const width of [390, 820, 1440]) {
  test(`school teacher original grouped tabs and exact action order at ${width}px RTL (RED)`, async ({ page }) => {
    await openTeacher(page, width);
    await page.screenshot({ path: `test-results/schools-teacher-tabs-go-${width}.png`, fullPage: true });
    const nav = page.getByRole('navigation', { name: 'أقسام اللوحة' });
    await expect(nav).toBeVisible();
    expect((await nav.locator('summary').allTextContents()).map(text => text.trim())).toEqual(sourceGroups);
    expect((await nav.locator('button').allTextContents()).map(text => text.trim())).toEqual(sourceActions);
    await expect(page.getByText('رادار فجوات الفصول')).toHaveCount(0);
    await expect(page.getByText('تقارير الحصص والمهارات')).toHaveCount(0);
    await expect(page.getByText('اختبارات المدرسة', { exact: true })).toHaveCount(0);
    await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  });
}

test('school teacher keeps the original in-page assessment tab on reload and back (RED)', async ({ page }) => {
  await openTeacher(page, 820);
  const nav = page.getByRole('navigation', { name: 'أقسام اللوحة' });
  await nav.locator('summary').filter({ hasText: 'الاختبارات والتكليفات' }).click();
  await nav.getByRole('button', { name: 'اختباراتي وتكليفاتي' }).click();
  await expect(page).toHaveURL(/school-teacher-dashboard\?tab=assessments/);
  await page.reload();
  await expect(page.getByRole('navigation', { name: 'أقسام اللوحة' })
    .getByRole('button', { name: 'اختباراتي وتكليفاتي' })).toHaveAttribute('aria-current', 'page');
  await page.goBack();
  await expect(page).toHaveURL(/school-teacher-dashboard(?:\?|$)/);
  await expect(page.getByRole('navigation', { name: 'أقسام اللوحة' })
    .getByRole('button', { name: 'نظرة عامة' })).toHaveAttribute('aria-current', 'page');
});
