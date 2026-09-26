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

async function auth(page: Page) {
  await page.route('**/api/v1/auth/me', (route) => json(route, { user: student }));
  await page.route('**/api/v1/auth/csrf', (route) => json(route, { csrfToken: 'csrf-goal' }));
}

test('mobile student creates and achieves a bounded self-owned mastery goal', async ({ page }) => {
  await auth(page);
  await page.setViewportSize({ width: 390, height: 844 });

  await page.route('**/api/v1/taxonomy/bootstrap?phase=core', (route) =>
    json(route, {
      paths: [{ id: 'path-1', code: 'QDR', name: 'القدرات', description: '', sortOrder: 1 }],
      subjects: [{ id: 'subject-1', pathId: 'path-1', code: 'QNT', name: 'الكمي', sortOrder: 1 }],
    }),
  );
  await page.route('**/api/v1/review/library?**', (route) =>
    json(route, { items: [], page: 1, limit: 20, hasMore: false }),
  );
  await page.route('**/api/v1/mastery/progress?**', (route) =>
    json(route, { items: [], page: 1, limit: 8, hasMore: false }),
  );
  await page.route('**/api/v1/mastery/next-action?**', (route) =>
    json(route, { item: null }),
  );

  let goals: any[] = [];
  let createCalls = 0;
  let patchCalls = 0;
  let subjectScopedReads = 0;

  await page.route('**/api/v1/mastery/goals/goal-1', async (route) => {
    expect(route.request().method()).toBe('PATCH');
    expect(route.request().headers()['x-csrf-token']).toBe('csrf-goal');
    const body = JSON.parse(route.request().postData() || '{}');
    expect(body.expectedUpdatedAt).toBe('2026-09-26T08:00:00Z');
    expect(body.status).toBe('achieved');
    patchCalls += 1;
    goals = [];
    return json(route, {
      goal: {
        id: 'goal-1',
        studentId: 'student-1',
        createdByUserId: 'student-1',
        createdByRole: 'student',
        pathId: 'path-1',
        subjectId: 'subject-1',
        targetType: 'path',
        targetId: 'path-1',
        title: 'هدف قصير لمسار القدرات',
        targetMastery: 90,
        horizon: 'short',
        dueDate: '2026-10-10',
        status: 'achieved',
        createdAt: '2026-09-26T08:00:00Z',
        updatedAt: '2026-09-26T08:05:00Z',
      },
    });
  });

  await page.route('**/api/v1/mastery/goals**', async (route) => {
    const request = route.request();
    if (request.method() === 'GET') {
      const url = new URL(request.url());
      expect(url.searchParams.get('pathId')).toBe('path-1');
      expect(url.searchParams.get('status')).toBe('active');
      expect(url.searchParams.get('limit')).toBe('20');
      const requestedSubject = url.searchParams.get('subjectId');
      expect([null, 'subject-1']).toContain(requestedSubject);
      if (requestedSubject === 'subject-1') subjectScopedReads += 1;
      return json(route, { items: goals, page: 1, limit: 20, hasMore: false });
    }
    expect(request.method()).toBe('POST');
    expect(request.headers()['x-csrf-token']).toBe('csrf-goal');
    const body = JSON.parse(request.postData() || '{}');
    expect(body).toMatchObject({
      pathId: 'path-1',
      subjectId: 'subject-1',
      targetType: 'path',
      targetId: 'path-1',
      targetMastery: 90,
      horizon: 'short',
    });
    expect(body.dueDate).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    createCalls += 1;
    const goal = {
      id: 'goal-1',
      studentId: 'student-1',
      createdByUserId: 'student-1',
      createdByRole: 'student',
      pathId: 'path-1',
      subjectId: 'subject-1',
      targetType: 'path',
      targetId: 'path-1',
      title: 'هدف قصير لمسار القدرات',
      targetMastery: 90,
      horizon: 'short',
      dueDate: body.dueDate,
      status: 'active',
      createdAt: '2026-09-26T08:00:00Z',
      updatedAt: '2026-09-26T08:00:00Z',
    };
    goals = [goal];
    return json(route, { goal }, 201);
  });

  await page.goto('/review');
  await page.getByLabel('مسار المراجعة').selectOption('path-1');
  await page.getByLabel('مادة المراجعة').selectOption('subject-1');

  await expect(page.getByRole('heading', { name: 'هدف قريب وهدف للمسار' })).toBeVisible();
  await expect.poll(() => subjectScopedReads).toBeGreaterThan(0);
  await page.getByRole('button', { name: 'هدف قصير' }).click();
  await expect(page.getByRole('heading', { name: 'هدف قصير لمسار القدرات' })).toBeVisible();
  await expect.poll(() => createCalls).toBe(1);

  await page.getByRole('button', { name: 'تحقق' }).click();
  await expect(page.getByRole('heading', { name: 'هدف قصير لمسار القدرات' })).toHaveCount(0);
  await expect.poll(() => patchCalls).toBe(1);

  await page.screenshot({ path: 'test-results/learning-mastery-goals-mobile.png', fullPage: true });
});
