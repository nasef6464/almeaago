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
  return route.fulfill({
    status,
    contentType: 'application/json',
    body: JSON.stringify(body),
  });
}

async function auth(page: Page, user: typeof admin | typeof student) {
  await page.route('**/api/v1/auth/me', (route) => json(route, { user }));
  await page.route('**/api/v1/auth/csrf', (route) => json(route, { csrfToken: 'csrf-token' }));
}

const gemini = {
  provider: 'gemini',
  enabled: true,
  model: 'gemini-2.5-flash',
  baseUrl: 'https://generativelanguage.googleapis.com',
  priority: 10,
  maxOutputTokens: 800,
  revision: 2,
  secretConfigured: true,
  health: {
    consecutiveFailures: 0,
    openUntil: null,
    lastError: '',
    lastSuccessAt: '2026-09-27T06:00:00Z',
    lastFailureAt: null,
    updatedAt: '2026-09-27T06:00:00Z',
  },
  createdAt: '2026-09-27T05:00:00Z',
  updatedAt: '2026-09-27T06:00:00Z',
};

test('AI admin edits non-secret routing policy and runs a provider health test', async ({ page }) => {
  await auth(page, admin);

  let updateBody: Record<string, unknown> | null = null;
  let updateCSRF = '';
  let testCSRF = '';

  await page.route('**/api/v1/ai/admin/providers', (route) =>
    json(route, { items: [gemini] }),
  );
  await page.route('**/api/v1/ai/admin/interactions?**', (route) =>
    json(route, {
      items: [
        {
          id: 'interaction-1',
          userId: 'student-1',
          audience: 'student',
          endpoint: '/ai/question-assistant',
          capability: 'question_tutor',
          provider: 'gemini',
          model: 'gemini-2.5-flash',
          status: 'success',
          usedFallback: false,
          cacheHit: false,
          questionId: 'question-1',
          questionVersion: 3,
          reviewCardId: 'card-1',
          promptVersion: 'question_tutor.v1',
          latencyMs: 140,
          inputTokens: 100,
          outputTokens: 20,
          totalTokens: 120,
          usageEstimated: false,
          responseLength: 80,
          errorCategory: '',
          metadata: { helpLevel: 'hint' },
          retentionUntil: '2026-10-27T06:00:00Z',
          createdAt: '2026-09-27T06:00:00Z',
        },
      ],
      page: 1,
      limit: 50,
      hasMore: false,
    }),
  );
  await page.route('**/api/v1/ai/admin/providers/gemini', async (route) => {
    expect(route.request().method()).toBe('PATCH');
    updateCSRF = route.request().headers()['x-csrf-token'] || '';
    updateBody = route.request().postDataJSON();
    return json(route, {
      provider: {
        ...gemini,
        ...(updateBody || {}),
        revision: 3,
      },
    });
  });
  await page.route('**/api/v1/ai/admin/providers/gemini/test', (route) => {
    expect(route.request().method()).toBe('POST');
    testCSRF = route.request().headers()['x-csrf-token'] || '';
    return json(route, {
      result: {
        text: 'OK',
        provider: 'gemini',
        model: 'gemini-2.5-flash',
        usage: { inputTokens: 4, outputTokens: 1, totalTokens: 5, cachedTokens: 0, estimated: false },
      },
    });
  });
  await page.route('**/api/v1/ai/admin/usage', (route) =>
    json(route, {
      usage: {
        today: { dayKey: '2026-09-28T00:00:00Z', scopeType: 'global', scopeId: '*', requestCount: 4, inputTokens: 80, outputTokens: 20, totalTokens: 100, cachedTokens: 10, fallbackCount: 0, errorCount: 0, updatedAt: '2026-09-28T08:00:00Z' },
        last24h: 4, fallback24h: 0, error24h: 0, cacheHit24h: 1, inputTokens24h: 80, outputTokens24h: 20, totalTokens24h: 100, cachedTokens24h: 10, byProvider: [],
      },
    }),
  );
  await page.route('**/api/v1/ai/admin/readiness', (route) =>
    json(route, {
      readiness: {
        checkedAt: '2026-09-28T08:00:00Z', status: 'ready', enabledProviders: 1, configuredProviders: 1, openCircuits: [],
        todayRequests: 4, globalDailyLimit: 800, userDailyLimit: 80, fallback24h: 0, error24h: 0,
        notes: ['Runtime configured لا يساوي live-provider certification؛ الدليل الحي يبقى deployment evidence منفصلًا.'],
      },
    }),
  );

  await page.goto('/admin-dashboard/ai');
  await expect(page.getByRole('heading', { name: 'إدارة المساعد الذكي' })).toBeVisible();
  await expect(page.getByText('Runtime configured',{exact:true})).toBeVisible();
  await expect(page.getByText('question_tutor')).toBeVisible();

  await page.getByLabel('حد إخراج Gemini').fill('900');
  await page.getByRole('button', { name: 'حفظ' }).click();

  await expect.poll(() => updateCSRF).toBe('csrf-token');
  expect(updateBody).toMatchObject({
    enabled: true,
    model: 'gemini-2.5-flash',
    baseUrl: 'https://generativelanguage.googleapis.com',
    priority: 10,
    maxOutputTokens: 900,
    expectedRevision: 2,
  });
  expect(updateBody).not.toHaveProperty('apiKey');
  expect(updateBody).not.toHaveProperty('secret');

  await page.getByRole('button', { name: 'اختبار المزود' }).click();
  await expect.poll(() => testCSRF).toBe('csrf-token');
  await expect(page.getByText(/اختبار Gemini نجح/)).toBeVisible();
});

test('student question assistant sends only review-card help intent and displays AI response', async ({ page }) => {
  await auth(page, student);
  await page.setViewportSize({ width: 390, height: 844 });

  await page.route('**/api/v1/review/practice?**', (route) =>
    json(route, {
      items: [
        {
          card: {
            cardId: 'card-1',
            questionId: 'question-1',
            questionVersion: 3,
            pathId: 'path-1',
            subjectId: 'subject-1',
            reviewType: 'error_recovery',
            savedForReview: false,
            savedAt: null,
            hasMistake: true,
            nextReviewAt: '2026-09-27T03:10:00Z',
            skillIds: ['skill-1'],
            updatedAt: '2026-09-26T03:10:00Z',
          },
          question: {
            id: 'question-1',
            version: 3,
            type: 'mcq',
            text: 'ما ناتج ٢ + ٢؟',
            imageAssetId: '',
            imageAlt: '',
            optionsEmbeddedInImage: false,
            videoUrl: '',
            difficulty: 'easy',
            options: [
              { index: 0, text: '٣', assetId: '' },
              { index: 1, text: '٤', assetId: '' },
            ],
          },
        },
      ],
      page: 1,
      limit: 20,
      hasMore: false,
    }),
  );

  let assistBody: Record<string, unknown> | null = null;
  let assistCSRF = '';
  await page.route('**/api/v1/ai/question-assistant', (route) => {
    expect(route.request().method()).toBe('POST');
    assistCSRF = route.request().headers()['x-csrf-token'] || '';
    assistBody = route.request().postDataJSON();
    return json(route, {
      result: {
        text: 'فكر في معنى الجمع قبل اختيار الإجابة.',
        helpLevel: 'hint',
        provider: 'gemini',
        model: 'gemini-2.5-flash',
        usedFallback: false,
        cacheHit: false,
        promptVersion: 'question_tutor.v1',
      },
    });
  });

  await page.goto('/review/practice?pathId=path-1&subjectId=subject-1&tab=mistakes');

  await expect(page.getByText('السؤال 1 من 1')).toBeVisible();
  await expect(page.getByTestId('question-assistant')).toBeVisible();
  await page.getByRole('button', { name: 'تلميح', exact: true }).click();

  await expect.poll(() => assistCSRF).toBe('csrf-token');
  expect(assistBody).toEqual({
    reviewCardId: 'card-1',
    helpLevel: 'hint',
    message: '',
  });
  expect(assistBody).not.toHaveProperty('questionText');
  expect(assistBody).not.toHaveProperty('correctOptionIndex');
  expect(assistBody).not.toHaveProperty('studentHistory');

  await expect(page.getByText('AI · gemini')).toBeVisible();
  await expect(page.getByText('فكر في معنى الجمع قبل اختيار الإجابة.')).toBeVisible();
  await page.screenshot({ path: 'test-results/ai-question-assistant-mobile.png', fullPage: true });
});
