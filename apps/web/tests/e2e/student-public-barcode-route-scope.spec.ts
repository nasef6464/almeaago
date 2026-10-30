import { expect, test, type Page, type Route } from '@playwright/test';

const widths = [390, 820, 1440] as const;
const question = {
  id: 'q-1', version: 1, sectionId: '', sortOrder: 0, points: 1, type: 'mcq',
  text: '٢ + ٢ = ؟', imageAssetId: '', imageAlt: '', optionsEmbeddedInImage: false,
  videoUrl: '', difficulty: 'easy',
  options: [{ index: 0, text: '٣', assetId: '' }, { index: 1, text: '٤', assetId: '' }],
};

function json(route: Route, body: unknown, status = 200) {
  return route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) });
}

function attempt(code: string) {
  return {
    attempt: {
      id: 'attempt-' + code, sessionId: 'session-' + code, sessionCode: code,
      assessmentId: 'assessment-1', assessmentVersion: 2, title: 'اختبار ' + code,
      attemptNumber: 1, status: 'in_progress', startedAt: '2026-10-30T00:00:00Z',
      expiresAt: null, showProgressBar: true, requireAnswerBeforeNext: false,
      optionLayout: 'auto', questions: [question],
    },
  };
}

async function setup(page: Page, width: number) {
  await page.setViewportSize({ width, height: 850 });
  await page.route('**/api/v1/auth/me', (route) => json(route, { message: 'Authentication required' }, 401));
  await page.route('**/api/v1/public-assessments/code-a/start', (route) => json(route, attempt('code-a'), 201));
}

async function switchCode(page: Page, code: string) {
  await page.evaluate((next) => {
    window.history.pushState({}, '', '/barcode-test/' + next);
    window.dispatchEvent(new PopStateEvent('popstate'));
  }, code);
  await expect(page).toHaveURL(new RegExp('/barcode-test/' + code + '$'));
}

for (const width of widths) {
  test(`public barcode: failed code B never retains code A attempt at ${width}px RTL`, async ({ page }) => {
    await setup(page, width);
    await page.route('**/api/v1/public-assessments/code-b/start', (route) =>
      json(route, { message: 'الجلسة B غير متاحة' }, 503));
    await page.goto('/barcode-test/code-a');
    await expect(page.getByRole('heading', { name: 'اختبار code-a' })).toBeVisible();
    await switchCode(page, 'code-b');
    await expect(page.getByText('الجلسة B غير متاحة')).toBeVisible();
    await expect(page.getByRole('heading', { name: 'اختبار code-a' })).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'إرسال الاختبار' })).toHaveCount(0);
  });

  test(`public barcode: pending code B hides code A questions immediately at ${width}px RTL`, async ({ page }) => {
    await setup(page, width);
    await page.route('**/api/v1/public-assessments/code-b/start', async (route) => {
      await new Promise((resolve) => setTimeout(resolve, 1200));
      await json(route, attempt('code-b'), 201);
    });
    await page.goto('/barcode-test/code-a');
    await expect(page.getByRole('heading', { name: 'اختبار code-a' })).toBeVisible();
    await switchCode(page, 'code-b');
    await expect(page.getByRole('heading', { name: 'اختبار code-a' })).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'إرسال الاختبار' })).toHaveCount(0);
    await expect(page.getByRole('heading', { name: 'اختبار code-b' })).toBeVisible();
  });

  test(`public barcode: route switch and Back reset participant draft and answers at ${width}px RTL`, async ({ page }) => {
    await setup(page, width);
    await page.route('**/api/v1/public-assessments/code-b/start', (route) => json(route, attempt('code-b'), 201));
    await page.goto('/barcode-test/code-a');
    await expect(page.getByRole('heading', { name: 'اختبار code-a' })).toBeVisible();
    await page.getByLabel('اسم المشارك').fill('طالب أ');
    await page.getByRole('button', { name: '٤' }).click();
    await switchCode(page, 'code-b');
    await expect(page.getByRole('heading', { name: 'اختبار code-b' })).toBeVisible();
    await expect(page.getByLabel('اسم المشارك')).toHaveValue('');
    await expect(page.getByText('التقدم 0 / 1')).toBeVisible();
    await page.goBack();
    await expect(page.getByRole('heading', { name: 'اختبار code-a' })).toBeVisible();
    await expect(page.getByLabel('اسم المشارك')).toHaveValue('');
    await expect(page.getByText('التقدم 0 / 1')).toBeVisible();
  });
}

for (const width of widths) {
  test(`public barcode: 503 submit retains draft and reuses idempotency key at ${width}px RTL`, async ({ page }) => {
    await setup(page, width);
    const submissionKeys: string[] = [];
    await page.route('**/api/v1/public-assessments/code-a/submit', async (route) => {
      const body = JSON.parse(route.request().postData() || '{}');
      submissionKeys.push(body.submissionKey);
      expect(body.participantName).toBe('طالب أ');
      expect(body.answers).toEqual([{ questionId: 'q-1', selectedOptionIndex: 1 }]);
      if (submissionKeys.length === 1) return json(route, { message: 'فشل الحفظ مؤقتًا' }, 503);
      return json(route, {
        resultVisible: true,
        result: { attemptId: 'attempt-code-a', score: 100, totalQuestions: 1, correctAnswers: 1,
          wrongAnswers: 0, unanswered: 0, passed: true, timeSpentSeconds: 1, finalizedAt: '2026-10-30T00:01:00Z' },
      });
    });
    await page.goto('/barcode-test/code-a');
    await expect(page.getByRole('heading', { name: 'اختبار code-a' })).toBeVisible();
    await page.getByLabel('اسم المشارك').fill('طالب أ');
    await page.getByRole('button', { name: '٤' }).click();
    await page.getByRole('button', { name: 'إرسال الاختبار' }).click();
    await expect(page.getByText('فشل الحفظ مؤقتًا')).toBeVisible();
    await expect(page.getByLabel('اسم المشارك')).toHaveValue('طالب أ');
    await expect(page.getByText('التقدم 1 / 1')).toBeVisible();
    await page.getByRole('button', { name: 'إرسال الاختبار' }).click();
    await expect(page.getByRole('heading', { name: 'تم إرسال الاختبار' })).toBeVisible();
    expect(submissionKeys).toHaveLength(2);
    expect(submissionKeys[0]).toBe(submissionKeys[1]);
  });

  test(`public barcode: stale submit response from A never replaces B at ${width}px RTL`, async ({ page }) => {
    await setup(page, width);
    await page.route('**/api/v1/public-assessments/code-b/start', (route) => json(route, attempt('code-b'), 201));
    let submitCalls = 0;
    await page.route('**/api/v1/public-assessments/code-a/submit', async (route) => {
      submitCalls += 1;
      await new Promise((resolve) => setTimeout(resolve, 1000));
      await json(route, {
        resultVisible: true,
        result: { attemptId: 'attempt-code-a', score: 100, totalQuestions: 1, correctAnswers: 1,
          wrongAnswers: 0, unanswered: 0, passed: true, timeSpentSeconds: 1, finalizedAt: '2026-10-30T00:01:00Z' },
      });
    });
    await page.goto('/barcode-test/code-a');
    await expect(page.getByRole('heading', { name: 'اختبار code-a' })).toBeVisible();
    await page.getByLabel('اسم المشارك').fill('طالب أ');
    await page.getByRole('button', { name: '٤' }).click();
    await page.getByRole('button', { name: 'إرسال الاختبار' }).click();
    await expect.poll(() => submitCalls).toBe(1);
    await switchCode(page, 'code-b');
    await expect(page.getByRole('heading', { name: 'اختبار code-b' })).toBeVisible();
    await page.waitForTimeout(1200);
    await expect(page.getByRole('heading', { name: 'اختبار code-b' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'تم إرسال الاختبار' })).toHaveCount(0);
  });
}
