import { expect, test } from '@playwright/test';

for (const slot of ['questions', 'exams'] as const) {
  test(`learner can retry a failed ${slot} list without seeing a false empty message`, async ({ page }) => {
    const user = { id: 'student-1', name: 'طالب', email: 'student@example.test', role: 'student', roles: ['student'], status: 'active' };
    await page.route(url => url.pathname.startsWith('/api/'), route => {
      const url = new URL(route.request().url());
      if (url.pathname === '/api/v1/auth/me') return route.fulfill({ json: { user } });
      if (url.pathname === '/api/v1/learning/navigation-preferences') return route.fulfill({ json: { user: { id: user.id, enrolledPaths: ['p1'], pathStageSelections: [] } } });
      if (url.pathname === '/api/v1/taxonomy/bootstrap') return route.fulfill({ json: { paths: [{ id: 'p1', code: 'P1', name: 'قدرات', sortOrder: 1 }], subjects: [{ id: 's1', pathId: 'p1', code: 'S1', name: 'كمي', sortOrder: 1 }], levels: [], skills: [] } });
      if (url.pathname === '/api/v1/learning-spaces/p1/subjects/s1') return route.fulfill({ json: { pathId: 'p1', subjectId: 's1', courses: { items: [], hasMore: false }, foundation: { items: [], hasMore: false }, library: { items: [], hasMore: false } } });
      return route.fulfill({ json: { items: [], ads: [], unreadCount: 0, hasMore: false } });
    });
    let requests = 0;
    await page.route('**/api/v1/assessment-placements/available?**', route => {
      requests++;
      if (requests === 1) return route.fulfill({ status: 503, json: { message: 'خطأ مؤقت' } });
      return route.fulfill({ json: { items: [], page: 1, limit: 50, hasMore: false } });
    });
    await page.goto(`/category/p1?subject=s1&tab=${slot}`);
    await expect(page.getByRole('alert').filter({ hasText: 'تعذر تحميل' })).toBeVisible();
    await expect(page.getByText('لا توجد اختبارات منشورة لهذه المادة حالياً')).toHaveCount(0);
    await page.getByRole('button', { name: 'إعادة المحاولة', exact: true }).click();
    await expect.poll(() => requests).toBe(2);
    await expect(page.getByRole('alert').filter({ hasText: 'تعذر تحميل' })).toHaveCount(0);
  });
}

test('switching subjects hides previous placements while the new subject is loading', async ({ page }) => {
  const user = { id: 'student-1', name: 'طالب', email: 'student@example.test', role: 'student', roles: ['student'], status: 'active' };
  await page.route(url => url.pathname.startsWith('/api/'), route => {
    const u = new URL(route.request().url());
    if (u.pathname === '/api/v1/auth/me') return route.fulfill({ json: { user } });
    if (u.pathname === '/api/v1/learning/navigation-preferences') return route.fulfill({ json: { user: { id: user.id, enrolledPaths: ['p1'], pathStageSelections: [] } } });
    if (u.pathname === '/api/v1/taxonomy/bootstrap') return route.fulfill({ json: { paths: [{ id: 'p1', code: 'P1', name: 'قدرات', sortOrder: 1 }], subjects: [{ id: 's1', pathId: 'p1', code: 'S1', name: 'كمي', sortOrder: 1 }, { id: 's2', pathId: 'p1', code: 'S2', name: 'لفظي', sortOrder: 2 }], levels: [], skills: [] } });
    if (u.pathname.startsWith('/api/v1/learning-spaces/p1/subjects/')) return route.fulfill({ json: { pathId: 'p1', subjectId: u.pathname.split('/').at(-1), courses: { items: [], hasMore: false }, foundation: { items: [], hasMore: false }, library: { items: [], hasMore: false } } });
    return route.fulfill({ json: { items: [], ads: [], unreadCount: 0, hasMore: false } });
  });
  let release!: () => void;
  const blocked = new Promise<void>(resolve => { release = resolve; });
  await page.route('**/api/v1/assessment-placements/available?**', async route => {
    const subject = new URL(route.request().url()).searchParams.get('subjectId');
    if (subject === 's2') { await blocked; return route.fulfill({ json: { items: [], page: 1, limit: 50, hasMore: false } }).catch(() => {}); }
    return route.fulfill({ json: { items: [{ placementId: 'old', title: 'تدريب المادة الأولى', accessAllowed: true, canStart: true, attemptCount: 0, maxAttempts: 1, assessmentVersion: 1 }], page: 1, limit: 50, hasMore: false } });
  });
  await page.goto('/learning?pathId=p1&subjectId=s1&tab=questions');
  await expect(page.getByRole('heading', { name: 'تدريب المادة الأولى' })).toBeVisible();
  await page.getByLabel('المادة', { exact: true }).selectOption('s2');
  await expect(page.getByRole('heading', { name: 'تدريب المادة الأولى' })).toHaveCount(0);
  release();
  await expect(page.getByText('جاري تحميل تدريبات وبنوك الأسئلة...')).toHaveCount(0);
  await expect(page.getByRole('heading', { name: 'تدريب المادة الأولى' })).toHaveCount(0);
});

test('leaving the learning page ignores a late start response and exposes remaining placements', async ({ page }) => {
  const user = { id: 'student-1', name: 'طالب', email: 'student@example.test', role: 'student', roles: ['student'], status: 'active' };
  await page.route(url => url.pathname.startsWith('/api/'), route => {
    const u = new URL(route.request().url());
    if (u.pathname === '/api/v1/auth/me') return route.fulfill({ json: { user } });
    if (u.pathname === '/api/v1/auth/csrf') return route.fulfill({ json: { csrfToken: 'csrf-test' } });
    if (u.pathname === '/api/v1/learning/navigation-preferences') return route.fulfill({ json: { user: { id: user.id, enrolledPaths: ['p1'], pathStageSelections: [] } } });
    if (u.pathname === '/api/v1/taxonomy/bootstrap') return route.fulfill({ json: { paths: [{ id: 'p1', code: 'P1', name: 'قدرات', sortOrder: 1 }], subjects: [{ id: 's1', pathId: 'p1', code: 'S1', name: 'كمي', sortOrder: 1 }], levels: [], skills: [] } });
    if (u.pathname === '/api/v1/learning-spaces/p1/subjects/s1') return route.fulfill({ json: { pathId: 'p1', subjectId: 's1', courses: { items: [], hasMore: false }, foundation: { items: [], hasMore: false }, library: { items: [], hasMore: false } } });
    if (u.pathname === '/api/v1/assessment-placements/available') return route.fulfill({ json: { items: [{ placementId: 'p-old', title: 'تدريب للاختبار', accessAllowed: true, canStart: true, attemptCount: 0, maxAttempts: 1, assessmentVersion: 1 }], page: 1, limit: 50, hasMore: true } });
    return route.fulfill({ json: { items: [], ads: [], unreadCount: 0, hasMore: false } });
  });
  let release!: () => void;
  const held = new Promise<void>(resolve => { release = resolve; });
  let received = false;
  let completed = false;
  await page.route('**/api/v1/assessment-placements/p-old/start', async route => {
    received = true;
    await held;
    await route.fulfill({ json: { attempt: { id: 'old-attempt' } } }).catch(() => {});
    completed = true;
  });
  await page.goto('/learning?pathId=p1&subjectId=s1&tab=questions');
  await expect(page.getByRole('heading', { name: 'تدريب للاختبار' })).toBeVisible();
  await expect(page.getByRole('link', { name: 'عرض المزيد' })).toHaveAttribute('href', '/assessments?pathId=p1&subjectId=s1&slot=training');
  await page.getByRole('button', { name: 'ابدأ التدريب', exact: true }).click();
  await expect.poll(() => received).toBe(true);
  await page.getByRole('button', { name: 'عودة لصفحة المسار', exact: true }).click();
  await expect(page).toHaveURL(/\/category\/p1/);
  release();
  await expect.poll(() => completed).toBe(true);
  await expect(page).toHaveURL(/\/category\/p1/);
});
