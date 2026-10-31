import { expect, test, type Page, type Route } from '@playwright/test';

// Student live-session scope must fail closed: an old verified session must never
// remain actionable after changing the URL code or after a failed new lookup.
const student = { id: 'student-1', email: 'student@example.com', name: 'طالب', status: 'active', avatarUrl: '', emailVerified: true, role: 'student', roles: ['student'] };
const live = (code: string) => ({ sessionId: 'session-' + code, assessmentId: 'assessment-1', assessmentVersion: 1, title: 'اختبار ' + code, sessionCode: code, opensAt: null, closesAt: null, attemptCount: 0, maxAttempts: 2, canStart: true });
const json = (route: Route, body: unknown, status = 200) => route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) });
async function auth(page: Page) {
  await page.route('**/api/v1/auth/me', route => json(route, { user: student }));
  await page.route('**/api/v1/auth/csrf', route => json(route, { csrfToken: 'csrf' }));
}

for (const width of [390, 820, 1440]) {
  test(`live join: failed second lookup cannot start stale first session at ${width}px RTL`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await auth(page);
    await page.route('**/api/v1/assessment-sessions/join/**', route => {
      const code = decodeURIComponent(new URL(route.request().url()).pathname.split('/').pop() || '');
      return code === 'live-b' ? json(route, { message: 'الجلسة غير متاحة' }, 503) : json(route, { session: live(code) });
    });
    let starts = 0;
    await page.route('**/api/v1/assessment-sessions/session-live-a/start', route => { starts++; return json(route, { message: 'stale start' }, 409); });
    await page.goto('/live-assessment?code=live-a');
    await expect(page.getByText('اختبار live-a')).toBeVisible();
    await page.getByLabel('رمز الجلسة المباشرة').fill('live-b');
    await page.getByRole('button', { name: 'تحقق' }).click();
    await expect(page.getByText('الجلسة غير متاحة')).toBeVisible();
    await expect(page.getByText('اختبار live-a')).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'ابدأ الاختبار' })).toHaveCount(0);
    expect(starts).toBe(0);
    await expect(page.locator('main')).toHaveAttribute('dir', 'rtl');
  });

  test(`live join: code switch blocks old session during pending GET, then starts new scope at ${width}px RTL`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await auth(page);
    let releaseB: (() => void) | undefined;
    const pendingB = new Promise<void>(resolve => { releaseB = resolve; });
    await page.route('**/api/v1/assessment-sessions/join/**', async route => {
      const code = decodeURIComponent(new URL(route.request().url()).pathname.split('/').pop() || '');
      if (code === 'live-b') await pendingB;
      return json(route, { session: live(code) });
    });
    const started: string[] = [];
    await page.route('**/api/v1/assessment-sessions/session-live-b/start', route => {
      started.push(JSON.parse(route.request().postData() || '{}').startKey || '');
      return json(route, { attempt: { id: 'attempt-b' } }, 201);
    });
    await page.goto('/live-assessment?code=live-a');
    await expect(page.getByText('اختبار live-a')).toBeVisible();
    await page.getByLabel('رمز الجلسة المباشرة').fill('live-b');
    await page.getByRole('button', { name: 'تحقق' }).click();
    await expect(page).toHaveURL(/code=live-b/);
    await expect(page.getByText('اختبار live-a')).toHaveCount(0, { timeout: 200 });
    releaseB?.();
    await expect(page.getByText('اختبار live-b')).toBeVisible();
    await page.getByRole('button', { name: 'ابدأ الاختبار' }).click();
    await expect(page).toHaveURL(/assessment-attempts\/attempt-b/);
    expect(started).toHaveLength(1);
    expect(started[0]).toBeTruthy();
  });

  test(`live join: browser Back restores URL code and matching verified session at ${width}px RTL`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await auth(page);
    await page.route('**/api/v1/assessment-sessions/join/**', route => {
      const code = decodeURIComponent(new URL(route.request().url()).pathname.split('/').pop() || '');
      return json(route, { session: live(code) });
    });
    await page.goto('/live-assessment?code=live-a');
    await expect(page.getByText('اختبار live-a')).toBeVisible();
    await page.getByLabel('رمز الجلسة المباشرة').fill('live-b');
    await page.getByRole('button', { name: 'تحقق' }).click();
    await expect(page.getByText('اختبار live-b')).toBeVisible();
    await page.goBack();
    await expect(page).toHaveURL(/code=live-a/);
    await expect(page.getByLabel('رمز الجلسة المباشرة')).toHaveValue('live-a');
    await expect(page.getByText('اختبار live-a')).toBeVisible();
    await expect(page.getByText('اختبار live-b')).toHaveCount(0);
  });
}
