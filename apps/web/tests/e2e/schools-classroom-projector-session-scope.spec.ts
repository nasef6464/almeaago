import { expect, test, type Page, type Route } from '@playwright/test';

// Source: almeaacodax/main pages/ClassroomProjectorView.tsx.
// A projector is bound to a single session; a failed/new session must never
// render a previous session's question, aggregate or challenge state.
const teacher = {
  id: 'teacher-projector', email: 'teacher-projector@example.com',
  name: 'معلم الفصل', status: 'active', avatarUrl: '',
  emailVerified: true, role: 'teacher', roles: ['teacher'],
};

function projection(id: string, question: string) {
  return {
    presentation: {
      sessionId: id, status: 'live', publishedMode: 'single',
      activeBatchId: 'batch-' + id, activeQuestionOrdinal: 0,
      questions: [{
        ordinal: 0, questionId: 'question-' + id, questionVersion: 1,
        text: question, imageAssetId: '', imageAlt: '',
        optionsEmbeddedInImage: false,
        options: [{ index: 0, text: 'أ', assetId: '' }],
        difficulty: 'medium', revealed: false,
        correctOptionIndex: null, explanation: '', selectedOptionIndex: null,
      }],
      aggregate: {
        sessionId: id, status: 'live', activeBatchId: 'batch-' + id,
        activeQuestionOrdinal: 0, joinedCount: 1,
        questions: [{ ordinal: 0, questionId: 'question-' + id,
          responseCount: 0, correctCount: 0, distribution: {} }],
      },
      challenge: null,
    },
  };
}
function json(route: Route, body: unknown, status = 200) {
  return route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) });
}
async function setup(page: Page, width: number) {
  await page.setViewportSize({ width, height: width === 390 ? 844 : 1000 });
  await page.route('**/api/v1/auth/me', route => json(route, { user: teacher }));
  await page.routeWebSocket('**/api/v1/classroom/sessions/**/stream', () => {});
}
async function switchSession(page: Page, id: string) {
  await page.evaluate((nextId) => {
    window.history.pushState({}, '', '/classroom/' + nextId + '/projector');
    window.dispatchEvent(new PopStateEvent('popstate'));
  }, id);
  await expect(page).toHaveURL(new RegExp('/classroom/' + id + '/projector$'));
}

for (const width of [390, 820, 1440]) {
  test('projector hides prior session on new session HTTP 503 and reload at ' + width + 'px RTL', async ({ page }) => {
    await setup(page, width);
    await page.route('**/api/v1/classroom/sessions/session-a/presentation',
      route => json(route, projection('session-a', 'سؤال الجلسة الأولى')));
    let failed = true;
    await page.route('**/api/v1/classroom/sessions/session-b/presentation',
      route => failed
        ? json(route, { message: 'تعذر تحميل الجلسة الجديدة' }, 503)
        : json(route, projection('session-b', 'سؤال الجلسة الثانية')));
    await page.goto('/classroom/session-a/projector');
    await expect(page.getByText('سؤال الجلسة الأولى')).toBeVisible();
    await switchSession(page, 'session-b');
    await expect(page.getByRole('alert')).toContainText('تعذر تحميل الجلسة الجديدة');
    await expect(page.getByText('سؤال الجلسة الأولى')).toHaveCount(0);
    await page.screenshot({ path: 'test-results/schools-projector-failure-' + width + '.png', fullPage: true });
    failed = false;
    await page.reload();
    await expect(page.getByText('سؤال الجلسة الثانية')).toBeVisible();
    await expect(page.getByText('سؤال الجلسة الأولى')).toHaveCount(0);
    await expect(page.getByRole('alert')).toHaveCount(0);
  });

  test('projector rejects a cross-session HTTP 200 projection at ' + width + 'px RTL', async ({ page }) => {
    await setup(page, width);
    await page.route('**/api/v1/classroom/sessions/session-b/presentation',
      route => json(route, projection('session-a', 'بيانات جلسة غير مصرح بها')));
    await page.goto('/classroom/session-b/projector');
    await expect(page.getByRole('alert')).toContainText('تعذر تحميل شاشة العرض');
    await expect(page.getByText('بيانات جلسة غير مصرح بها')).toHaveCount(0);
    await page.screenshot({ path: 'test-results/schools-projector-cross-session-' + width + '.png', fullPage: true });
  });
}

test('late previous-session response cannot replace current projector', async ({ page }) => {
  await setup(page, 820);
  let releasePrevious: (() => void) | undefined;
  await page.route('**/api/v1/classroom/sessions/session-a/presentation', async route => {
    await new Promise<void>(resolve => { releasePrevious = resolve; });
    await json(route, projection('session-a', 'إجابة قديمة وصلت متأخرة'));
  });
  await page.route('**/api/v1/classroom/sessions/session-b/presentation',
    route => json(route, projection('session-b', 'السؤال الحالي للجلسة الثانية')));
  await page.goto('/classroom/session-a/projector');
  await expect.poll(() => Boolean(releasePrevious)).toBe(true);
  await switchSession(page, 'session-b');
  await expect(page.getByText('السؤال الحالي للجلسة الثانية')).toBeVisible();
  releasePrevious?.();
  await expect(page.getByText('إجابة قديمة وصلت متأخرة')).toHaveCount(0);
  await expect(page.getByText('السؤال الحالي للجلسة الثانية')).toBeVisible();
});
