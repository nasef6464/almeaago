import { expect, test, type Route } from '@playwright/test';

const student = {
  id: 'student-1',
  email: 'student@example.com',
  name: 'طالب',
  status: 'active',
  avatarUrl: '',
  emailVerified: true,
  role: 'student',
  roles: ['student'],
};

const taxonomy = {
  paths: [{ id: 'path-1', code: 'QDR', name: 'القدرات', description: '', sortOrder: 1 }],
  subjects: [{ id: 'subject-1', pathId: 'path-1', code: 'QNT', name: 'الكمي', sortOrder: 1 }],
};

const overview = {
  scope: {
    kind: 'student',
    studentCount: 1,
    sampledStudentCount: 1,
    isTruncated: false,
    limits: { students: 500, results: 2000, attempts: 3000 },
    canDetail: true,
    canExport: false,
  },
  assessment: {
    resultCount: 2,
    sampledResultCount: 2,
    resultsTruncated: false,
    attemptCount: 2,
    sampledAttemptCount: 2,
    attemptsTruncated: false,
    averageScore: 62,
    passed: 1,
    failed: 1,
    passRate: 50,
  },
  weakestSkills: [
    { skillId: 'skill-1', skillName: 'النسبة والتناسب', evidenceCount: 5, affectedStudents: 1, mastery: 40 },
    { skillId: 'skill-2', skillName: 'المعادلات الخطية', evidenceCount: 4, affectedStudents: 1, mastery: 55 },
  ],
};

const results = {
  items: [],
  page: 1,
  limit: 20,
  total: 0,
  hasMore: false,
};

function json(route: Route, body: unknown, status = 200) {
  return route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) });
}

for (const width of [390, 820, 1440]) {
  test(`student report focuses requested skillId from URL and clears focus cleanly at ${width}px RTL`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await page.route('**/api/v1/auth/me', (route) => json(route, { user: student }));
    await page.route('**/api/v1/taxonomy/bootstrap?phase=core', (route) => json(route, taxonomy));
    await page.route('**/api/v1/reports/overview**', (route) => json(route, overview));
    await page.route('**/api/v1/reports/results?**', (route) => json(route, results));

    await page.goto('/reports?pathId=path-1&subjectId=subject-1&skillId=skill-2');
    const focused = page.getByTestId('focused-skill-card');
    await expect(focused).toBeVisible();
    await expect(focused).toContainText('المهارة المحددة');
    await expect(focused).toContainText('المعادلات الخطية');

    await page.getByRole('button', { name: 'عرض كل المهارات' }).click();
    await expect(page.getByTestId('focused-skill-card')).toHaveCount(0);
    await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  });
}

test('student report shows honest notice when requested skillId is not in weakestSkills', async ({ page }) => {
  await page.route('**/api/v1/auth/me', (route) => json(route, { user: student }));
  await page.route('**/api/v1/taxonomy/bootstrap?phase=core', (route) => json(route, taxonomy));
  await page.route('**/api/v1/reports/overview**', (route) => json(route, overview));
  await page.route('**/api/v1/reports/results?**', (route) => json(route, results));

  await page.goto('/reports?pathId=path-1&subjectId=subject-1&skillId=skill-unknown');
  await expect(page.getByTestId('focused-skill-missing')).toBeVisible();
});
