import { expect, test, type Page, type Route } from '@playwright/test';

// Classroom student scope: a valid school/class membership in session A must
// never be treated as proof of membership or readable questions in session B.
const student = {
  id: 'student-1', email: 'student@example.test', name: 'طالب الفصل',
  status: 'active', avatarUrl: '', emailVerified: true,
  role: 'student', roles: ['student'],
};

function json(route: Route, body: unknown, status = 200) {
  return route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) });
}

async function setup(page: Page) {
  await page.route('**/api/v1/auth/me', route => json(route, { user: student }));
  await page.route('**/api/v1/auth/csrf', route => json(route, { csrfToken: 'csrf-token' }));
  await page.routeWebSocket('**/api/v1/classroom/sessions/**/stream', () => {});
}

function state(sessionId: string, question: string) {
  return {
    state: {
      sessionId, status: 'live', publishedMode: 'single', activeBatchId: 'batch-1',
      activeQuestionOrdinal: 0, challenge: null,
      questions: [{
        ordinal: 0, questionId: sessionId + '-question', questionVersion: 1,
        text: question, imageAssetId: '', imageAlt: '', optionsEmbeddedInImage: false,
        options: [{ index: 0, text: 'أ', assetId: '' }, { index: 1, text: 'ب', assetId: '' }],
        difficulty: 'easy', revealed: false, correctOptionIndex: null,
        explanation: '', selectedOptionIndex: null,
      }],
    },
  };
}

// React Router client-side route change; a full page.goto() would remount the
// component and conceal the stale-state bug.
async function switchSession(page: Page, id: string) {
  await page.evaluate(next => {
    history.pushState({}, '', '/classroom/' + next);
    window.dispatchEvent(new PopStateEvent('popstate'));
  }, id);
  await expect.poll(() => new URL(page.url()).pathname).toBe('/classroom/' + id);
}

for (const width of [390, 820, 1440]) {
  test(`classroom join revocation clears old questions and retries join before reading another session at ${width} RTL`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await setup(page);
    let allowB = false, joinsB = 0, readsB = 0;
    await page.route('**/api/v1/classroom/sessions/session-a/join', route => json(route, { joined: true }));
    await page.route('**/api/v1/classroom/sessions/session-a/current', route => json(route, state('session-a', 'سؤال خاص بالجلسة أ')));
    await page.route('**/api/v1/classroom/sessions/session-b/join', route => {
      joinsB++;
      return allowB ? json(route, { joined: true }) : json(route, { message: 'لا تملك عضوية هذه الحصة' }, 403);
    });
    await page.route('**/api/v1/classroom/sessions/session-b/current', route => {
      readsB++;
      return json(route, state('session-b', 'سؤال خاص بالجلسة ب'));
    });

    await page.goto('/classroom/session-a');
    await expect(page.getByText('سؤال خاص بالجلسة أ')).toBeVisible();
    await switchSession(page, 'session-b');
    await expect(page.getByRole('alert')).toContainText('لا تملك عضوية');
    await expect(page.getByText('سؤال خاص بالجلسة أ')).toHaveCount(0);
    await expect(page.getByText('سؤال خاص بالجلسة ب')).toHaveCount(0);
    expect(readsB).toBe(0);
    allowB = true;
    await page.getByRole('button', { name: 'تحديث' }).click();
    await expect(page.getByText('سؤال خاص بالجلسة ب')).toBeVisible();
    expect(joinsB).toBeGreaterThanOrEqual(2);
    await expect(page.getByText('سؤال خاص بالجلسة أ')).toHaveCount(0);
    await page.screenshot({ path: `test-results/schools-classroom-rejoin-${width}.png`, fullPage: true });
  });

  test(`late previous classroom response cannot replace the newly joined session at ${width} RTL`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await setup(page);
    let releaseA!: () => void;
    let seenA!: () => void;
    const aStarted = new Promise<void>(resolve => { seenA = resolve; });
    const aRelease = new Promise<void>(resolve => { releaseA = resolve; });
    await page.route('**/api/v1/classroom/sessions/*/join', route => json(route, { joined: true }));
    await page.route('**/api/v1/classroom/sessions/session-a/current', async route => {
      seenA();
      await aRelease;
      await json(route, state('session-a', 'رد متأخر من الجلسة أ'));
    });
    await page.route('**/api/v1/classroom/sessions/session-b/current', route => json(route, state('session-b', 'سؤال الجلسة ب الجديد')));

    await page.goto('/classroom/session-a');
    await aStarted;
    await switchSession(page, 'session-b');
    await expect(page.getByText('سؤال الجلسة ب الجديد')).toBeVisible();
    releaseA();
    await expect(page.getByText('رد متأخر من الجلسة أ')).toHaveCount(0);
    await expect(page.getByText('سؤال الجلسة ب الجديد')).toBeVisible();
    await page.screenshot({ path: `test-results/schools-classroom-race-${width}.png`, fullPage: true });
  });

  test(`failed classroom refresh hides stale questions and retry restores server truth at ${width} RTL`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await setup(page);
    let failRead = false;
    await page.route('**/api/v1/classroom/sessions/session-a/join', route => json(route, { joined: true }));
    await page.route('**/api/v1/classroom/sessions/session-a/current', route =>
      failRead ? json(route, { message: 'تعذر تحديث حالة الحصة' }, 503) : json(route, state('session-a', 'سؤال قابل للحفظ')));
    await page.goto('/classroom/session-a');
    await expect(page.getByText('سؤال قابل للحفظ')).toBeVisible();
    failRead = true;
    await expect(page.getByRole('alert')).toContainText('تعذر تحديث حالة الحصة', { timeout: 12_000 });
    await expect(page.getByText('سؤال قابل للحفظ')).toHaveCount(0);
    await expect(page.getByTestId('classroom-answer-0-0')).toHaveCount(0);
    failRead = false;
    await page.getByRole('button', { name: 'تحديث' }).click();
    await expect(page.getByText('سؤال قابل للحفظ')).toBeVisible();
    await page.screenshot({ path: `test-results/schools-classroom-retry-${width}.png`, fullPage: true });
  });
}
