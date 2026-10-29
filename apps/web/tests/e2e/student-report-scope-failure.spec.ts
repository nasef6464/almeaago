import { expect, test, type Page, type Route } from '@playwright/test';

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

function json(route: Route, body: unknown, status = 200) {
  return route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) });
}

const taxonomy = {
  paths: [
    { id: 'path-1', code: 'QDR', name: 'القدرات', description: '', sortOrder: 1 },
    { id: 'path-2', code: 'TAH', name: 'التحصيلي', description: '', sortOrder: 2 },
  ],
  subjects: [
    { id: 'subject-1', pathId: 'path-1', code: 'QNT', name: 'الكمي', sortOrder: 1 },
    { id: 'subject-2', pathId: 'path-2', code: 'MTH', name: 'الرياضيات', sortOrder: 1 },
  ],
};

function overview(path: string) {
  return {
    scope: { kind: 'student', studentCount: 1, sampledStudentCount: 1, isTruncated: false,
      limits: { students: 500, results: 2000, attempts: 3000 }, canDetail: true, canExport: false },
    assessment: { resultCount: 1, sampledResultCount: 1, resultsTruncated: false,
      attemptCount: 1, sampledAttemptCount: 1, attemptsTruncated: false,
      averageScore: path === 'path-2' ? 92 : 48, passed: path === 'path-2' ? 1 : 0,
      failed: path === 'path-2' ? 0 : 1, passRate: path === 'path-2' ? 100 : 0 },
    weakestSkills: [{ skillId: path === 'path-2' ? 'skill-2' : 'skill-1',
      skillName: path === 'path-2' ? 'التفاضل' : 'النسبة والتناسب',
      evidenceCount: 5, affectedStudents: 1, mastery: path === 'path-2' ? 78 : 40 }],
  };
}

function results(path: string) {
  return {
    items: [{ attemptId: path === 'path-2' ? 'attempt-2' : 'attempt-1',
      studentId: 'student-1', studentName: 'طالب', assessmentId: 'assessment-1',
      assessmentVersion: 1, title: path === 'path-2' ? 'اختبار التحصيلي' : 'اختبار القدرات',
      pathId: path, subjectId: path === 'path-2' ? 'subject-2' : 'subject-1',
      score: path === 'path-2' ? 92 : 48, passed: path === 'path-2',
      correctAnswers: 5, wrongAnswers: 1, unanswered: 0,
      timeSpentSeconds: 240, finalizedAt: '2026-10-29T10:00:00Z' }],
    page: 1, limit: 20, total: 1, hasMore: false,
  };
}

for (const width of [390, 820, 1440]) {
  test(`student report hides stale path evidence on failed scope read and recovers at ${width}px RTL`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await page.route('**/api/v1/auth/me', route => json(route, { user: student }));
    await page.route('**/api/v1/taxonomy/bootstrap?phase=core', route => json(route, taxonomy));

    let failSecondPath = true;
    let secondPathOverviewCalls = 0;
    await page.route('**/api/v1/reports/overview**', route => {
      const path = new URL(route.request().url()).searchParams.get('pathId') || 'path-1';
      if (path === 'path-2') {
        secondPathOverviewCalls += 1;
        if (failSecondPath) return json(route, { message: 'تعذر تحميل التقرير الجديد' }, 503);
      }
      return json(route, overview(path));
    });
    await page.route('**/api/v1/reports/results?**', route => {
      const path = new URL(route.request().url()).searchParams.get('pathId') || 'path-1';
      if (path === 'path-2' && failSecondPath) {
        return json(route, { message: 'تعذر تحميل نتائج المسار' }, 503);
      }
      return json(route, results(path));
    });

    await page.goto('/reports');
    await expect(page.locator('main[dir="rtl"]')).toBeVisible();
    await expect(page.getByText('اختبار القدرات', { exact: true })).toBeVisible();
    await expect(page.getByText('النسبة والتناسب', { exact: true })).toBeVisible();

    await page.getByLabel('مسار التقرير').selectOption('path-2');
    await expect(page.getByRole('alert')).toContainText('تعذر تحميل التقرير الجديد');
    await expect(page.getByText('اختبار القدرات', { exact: true })).toHaveCount(0);
    await expect(page.getByText('النسبة والتناسب', { exact: true })).toHaveCount(0);
    await expect(page.getByText('اختبار التحصيلي', { exact: true })).toHaveCount(0);

    failSecondPath = false;
    await page.getByRole('button', { name: 'تحديث' }).click();
    await expect.poll(() => secondPathOverviewCalls).toBeGreaterThanOrEqual(2);
    await expect(page.getByRole('alert')).toHaveCount(0);
    await expect(page.getByText('اختبار التحصيلي', { exact: true })).toBeVisible();
    await expect(page.getByText('التفاضل', { exact: true })).toBeVisible();
    await expect(page.getByText('اختبار القدرات', { exact: true })).toHaveCount(0);
    await page.screenshot({ path: `test-results/student-report-scope-recovery-${width}.png`, fullPage: true });
  });
}
