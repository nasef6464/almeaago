import { expect, test, type Page, type Route } from '@playwright/test';

const student = {
  id: 'student-dashboard-parity',
  email: 'student@example.com',
  name: 'طالب المئة',
  status: 'active',
  avatarUrl: '',
  emailVerified: true,
  role: 'student',
  roles: ['student'],
};

const groups = [
  ['learning', ['مساراتي', 'دوراتي', 'جلساتي']],
  ['journey', ['المسار الذكي', 'خططي', 'تقاريري']],
  ['exams', ['الاختبارات السابقة', 'الاختبارات المدرسية', 'الاختبارات المحاكية']],
  ['tools', ['أسئلتي للمراجعة', 'بطاقات التذكر']],
  ['support', ['سؤال وجواب', 'طلباتي']],
] as const;

function json(route: Route, body: unknown, status = 200) {
  return route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) });
}

async function auth(page: Page) {
  await page.route('**/api/v1/auth/me', (route) => json(route, { user: student }));
  await page.route('**/api/v1/auth/csrf', (route) => json(route, { csrfToken: 'student-csrf' }));
}

for (const width of [390, 820, 1440]) {
  test('original student dashboard menu, order and no invented cards at ' + width, async ({ page }) => {
    await auth(page);
    await page.setViewportSize({ width, height: 900 });
    await page.goto('/dashboard');

    if (width < 1024) {
      await page.getByRole('button', { name: 'فتح قائمة لوحة الطالب' }).click();
    }

    const nav = page.getByRole('navigation', { name: 'تنقل لوحة الطالب' });
    await expect(nav).toBeVisible();
    await expect(page.getByTestId('student-menu-overview')).toContainText('نظرة عامة');
    for (const [group, labels] of groups) {
      const section = page.getByTestId('student-menu-group-' + group);
      await expect(section).toBeVisible();
      const rows = section.locator('[data-testid^="student-menu-item-"]');
      await expect(rows).toHaveCount(labels.length);
      expect(await rows.allTextContents()).toEqual(labels);
    }

    await expect(page.getByTestId('student-menu-group-learning')).not.toContainText('التعلم');
    await expect(page.getByTestId('student-menu-group-journey')).toContainText('رحلتي التعليمية');
    await expect(page.getByTestId('student-menu-group-support')).toContainText('الدعم');
    await expect(page.getByTestId('student-menu-item-smart-path')).toHaveAttribute('aria-disabled', 'true');
    await expect(page.getByTestId('student-menu-item-flashcards')).toHaveAttribute('aria-disabled', 'true');
    await expect(page.getByTestId('student-menu-item-school-tests')).toHaveAttribute('href', '/assessment-assignments');
    await expect(page.getByTestId('student-menu-item-quizzes')).toHaveAttribute('href', '/assessment-results');
    await expect(nav.locator('a[href="/classroom/join"]')).toHaveCount(0);
    await expect(nav.locator('a[href="/notifications"]')).toHaveCount(0);
    await expect(page.getByText('لا نعرض أرقامًا أو توصيات مختلقة هنا')).toHaveCount(0);
    await expect(page.getByRole('heading', { name: 'ابدأ بقياس قصير' })).toBeVisible();
    await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
    await page.screenshot({ path: 'test-results/student-dashboard-original-menu-' + width + '.png', fullPage: true });
  });
}

test('student logout uses authenticated Go endpoint, preserves screen on failure, retries', async ({ page }) => {
  await auth(page);
  let attempts = 0;
  await page.route('**/api/v1/auth/logout', (route) => {
    expect(route.request().method()).toBe('POST');
    expect(route.request().headers()['x-csrf-token']).toBe('student-csrf');
    attempts += 1;
    return attempts === 1 ? json(route, { message: 'temporary error' }, 503) : route.fulfill({ status: 204 });
  });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/dashboard');
  await page.getByRole('button', { name: 'فتح قائمة لوحة الطالب' }).click();
  const logout = page.locator('[data-logout-explicit="true"]');
  await logout.click();
  await expect(page.getByRole('alert')).toHaveText('تعذر تسجيل الخروج، حاول مرة أخرى.');
  await expect(logout).toBeEnabled();
  await logout.click();
  await expect.poll(() => attempts).toBe(2);
  await expect(page).toHaveURL(/auth=login/);
});
