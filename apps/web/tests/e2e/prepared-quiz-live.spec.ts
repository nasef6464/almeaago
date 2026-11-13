import { expect, test } from '@playwright/test';

test('رحلة الاختبار الجاهز بين الإدارة والطالب بقاعدة محلية', async ({ page }) => {
  test.skip(process.env.PREPARED_QUIZ_LIVE !== '1', 'requires isolated Go and PostgreSQL');
  test.setTimeout(600_000);
  page.setDefaultTimeout(60_000);
  page.setDefaultNavigationTimeout(120_000);
  let id = process.env.PREPARED_ASSESSMENT_ID!;
  const password = process.env.PREPARED_PASSWORD!;
  const login = async (email: string) => {
    const response = await page.request.post('/api/v1/auth/login', { data: { email, password } });
    expect(response.status()).toBe(200);
  };
  const csrf = async () => {
    const response = await page.request.get('/api/v1/auth/csrf');
    expect(response.status()).toBe(200);
    return (await response.json()).csrfToken as string;
  };

  await login(process.env.PREPARED_ADMIN_EMAIL!);
  await page.goto('/tests/e2e/fixtures/assessment-save-workflow.html?live=1', { waitUntil: 'domcontentloaded' });
  await page.getByPlaceholder('مثال: EXAM-TAH-PHYS-01 أو MOCK-QUD-01').fill('LIVE-EDITOR');
  await page.getByPlaceholder('مثال: الاختبار المحاكي الشامل للقدرات العامة — النموذج التجريبي 1').fill('اختبار تجريبي جاهز');
  await page.getByRole('navigation', { name: 'أقسام منشئ الاختبارات' }).getByRole('button', { name: 'الأسئلة', exact: true }).click();
  await page.getByRole('button', { name: 'إضافة السؤال LIVE-Q' }).click();
  await page.getByRole('navigation', { name: 'أقسام منشئ الاختبارات' }).getByRole('button', { name: 'الإعدادات', exact: true }).click();
  await page.locator('label').filter({ hasText: 'الحد الأقصى للمحاولات' }).locator('..').locator('input').fill('10');
  const published = page.waitForResponse(response => response.url().includes('/publication') && response.request().method() === 'POST');
  await page.getByRole('button', { name: 'حفظ ونشر الاختبار الآن' }).click();
  const publication = await published;
  expect(publication.status()).toBe(200);
  id = (await publication.json()).assessment.id;
  await expect(page.getByText('تم التسليم للقائمة')).toBeVisible();
  await page.goto(`/tests/e2e/fixtures/prepared-admin-live.html?assessmentId=${id}`, { waitUntil: 'domcontentloaded' });
  await page.getByLabel('الجمهور').selectOption('targeted');
  await page.getByPlaceholder('ابحث باسم الطالب أو بريده').fill('prepared-owner');
  await page.getByRole('button', { name: 'بحث', exact: true }).click();
  await page.getByLabel(/prepared-owner@example.invalid/).check();
  await page.getByRole('button', { name: 'حفظ الإعدادات' }).click();
  await expect(page.getByText('حُفظت إعدادات الاختبار الجاهز.')).toBeVisible();
  await page.getByRole('button', { name: 'إتاحة الاختبار' }).click();
  await expect(page.getByText('الحالة: متاح')).toBeVisible();

  await login(process.env.PREPARED_OWNER_EMAIL!);
  await page.goto('/quiz?mode=prepared', { waitUntil: 'domcontentloaded' });
  await expect(page.getByText('اختبار تجريبي جاهز', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'ابدأ الاختبار', exact: true }).click();
  await expect(page.getByText('سؤال تجريبي', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: /نعم/ }).click();
  await expect(page.getByRole('button', { name: /نعم/ })).toHaveAttribute('aria-pressed', 'true');
  await page.getByRole('button', { name: 'إنهاء الاختبار' }).click();
  await page.getByRole('button', { name: 'نعم، قم بالتسليم' }).click();
  await expect(page.getByRole('heading', { name: 'تم تسليم الاختبار' })).toBeVisible();
  await expect(page.getByText('100.0%')).toBeVisible();
  await expect(page.getByRole('link', { name: 'عرض النتيجة والمراجعة' })).toBeVisible();
  await page.getByRole('link', { name: 'عرض النتيجة والمراجعة' }).click();
  await expect(page.getByRole('heading', { name: 'اختبار تجريبي جاهز' })).toBeVisible();
  await expect(page.getByText('سؤال تجريبي', { exact: true })).toBeVisible();

  await login(process.env.PREPARED_OTHER_EMAIL!);
  const [otherList] = await Promise.all([
    page.waitForResponse(response => response.url().includes('/api/v1/assessments/prepared-available') && response.status() === 200, { timeout: 120_000 }),
    page.goto('/quiz?mode=prepared', { waitUntil: 'domcontentloaded' }),
  ]);
  expect((await otherList.json()).quizzes.some((quiz: { id: string }) => quiz.id === id)).toBe(false);
  await expect(page.getByText('اختبار تجريبي جاهز', { exact: true })).toHaveCount(0);
  const forbidden = await page.request.post(`/api/v1/assessments/${id}/attempts`, { headers: { 'X-CSRF-Token': await csrf() }, data: { startKey: 'prepared-other-live-attempt' } });
  expect(forbidden.status()).toBe(403);

  await login(process.env.PREPARED_ADMIN_EMAIL!);
  await page.goto(`/tests/e2e/fixtures/prepared-admin-live.html?assessmentId=${id}`, { waitUntil: 'domcontentloaded' });
  await page.getByRole('button', { name: 'إيقاف الإتاحة' }).click();
  await expect(page.getByText('الحالة: غير متاح')).toBeVisible();
  await login(process.env.PREPARED_OWNER_EMAIL!);
  const disabled = await page.request.post(`/api/v1/assessments/${id}/attempts`, { headers: { 'X-CSRF-Token': await csrf() }, data: { startKey: 'prepared-owner-after-disable' } });
  expect(disabled.status()).toBe(403);
  const [disabledList] = await Promise.all([
    page.waitForResponse(response => response.url().includes('/api/v1/assessments/prepared-available') && response.status() === 200, { timeout: 120_000 }),
    page.goto('/quiz?mode=prepared', { waitUntil: 'domcontentloaded' }),
  ]);
  expect((await disabledList.json()).quizzes.some((quiz: { id: string }) => quiz.id === id)).toBe(false);
  await expect(page.getByText('اختبار تجريبي جاهز', { exact: true })).toHaveCount(0);
});

test('محاكي صارم بمادتين من الدخول إلى النتيجة على قاعدة محلية', async ({ page }) => {
  test.skip(process.env.PREPARED_QUIZ_LIVE !== '1', 'requires isolated Go and PostgreSQL');
  test.setTimeout(180_000);
  page.setDefaultTimeout(30_000);
  const id = process.env.PREPARED_MOCK_ID!;
  const login = async (email: string) => {
    const response = await page.request.post('/api/v1/auth/login', { data: { email, password: process.env.PREPARED_PASSWORD } });
    expect(response.status()).toBe(200);
  };
  await login(process.env.PREPARED_OWNER_EMAIL!);
  const started = page.waitForResponse(response => response.url().endsWith(`/assessments/${id}/attempts`) && response.request().method() === 'POST');
  await page.goto(`/assessments/${id}/start`, { waitUntil: 'domcontentloaded', timeout: 90_000 });
  const startResponse = await started;
  expect(startResponse.status()).toBe(201);
  const attemptId = (await startResponse.json()).attempt.id as string;
  const csrfResponse = await page.request.get('/api/v1/auth/csrf');
  const headers = { 'X-CSRF-Token': (await csrfResponse.json()).csrfToken as string };
  const answer = { selectedOptionIndex: 0, textAnswer: '', timeSpentSeconds: 0, markedForReview: false };
  await expect(page.getByText('سؤال تجريبي', { exact: true })).toBeVisible();
  await expect(page.getByText('سؤال القسم الثاني', { exact: true })).toHaveCount(0);
  const early = await page.request.put(`/api/v1/assessment-attempts/${attemptId}/answers/00000000-0000-0000-0000-000000000008`, { headers, data: answer });
  expect(early.status()).toBe(409);
  await page.goto(`/assessment-attempts/${attemptId}`, { waitUntil: 'domcontentloaded', timeout: 90_000 });
  await expect(page.getByText('سؤال تجريبي', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: /نعم/ }).click();
  await page.getByRole('button', { name: 'إنهاء القسم والانتقال' }).click();
  await page.getByRole('button', { name: 'تأكيد الانتقال' }).click();
  await expect(page.getByText('سؤال القسم الثاني', { exact: true })).toBeVisible();
  const nextCsrf = await page.request.get('/api/v1/auth/csrf');
  const locked = await page.request.put(`/api/v1/assessment-attempts/${attemptId}/answers/00000000-0000-0000-0000-000000000005`, { headers: { 'X-CSRF-Token': (await nextCsrf.json()).csrfToken }, data: answer });
  expect(locked.status()).toBe(409);
  await page.goto(`/assessment-attempts/${attemptId}`, { waitUntil: 'domcontentloaded', timeout: 90_000 });
  await expect(page.getByText('سؤال القسم الثاني', { exact: true })).toBeVisible();
  await expect(page.getByText('سؤال تجريبي', { exact: true })).toHaveCount(0);
  await page.getByRole('button', { name: /صحيح/ }).click();
  await page.getByRole('button', { name: 'إنهاء القسم والانتقال' }).click();
  await page.getByRole('button', { name: 'تأكيد الانتقال' }).click();
  await expect(page.getByRole('heading', { name: 'تم تسليم الاختبار' })).toBeVisible();
  await expect(page.getByText('100.0%')).toBeVisible();
});

test('انتهاء وقت قسم المحاكي يحفظ غير المجاب وينتقل للقسم التالي', async ({ page }) => {
  test.skip(process.env.PREPARED_QUIZ_LIVE !== '1' || process.env.PREPARED_MOCK_TIMED !== '1', 'requires timed isolated mock');
  test.setTimeout(180_000);
  const login = await page.request.post('/api/v1/auth/login', { data: { email: process.env.PREPARED_OWNER_EMAIL, password: process.env.PREPARED_PASSWORD } });
  expect(login.status()).toBe(200);
  await page.goto(`/assessments/${process.env.PREPARED_MOCK_ID}/start`, { waitUntil: 'domcontentloaded', timeout: 90_000 });
  await expect(page.getByText('سؤال القسم الثاني', { exact: true })).toBeVisible({ timeout: 45_000 });
  await expect(page.getByText('سؤال تجريبي', { exact: true })).toHaveCount(0);
  await page.getByRole('button', { name: /صحيح/ }).click();
  await page.getByRole('button', { name: 'إنهاء القسم والانتقال' }).click();
  await page.getByRole('button', { name: 'تأكيد الانتقال' }).click();
  await expect(page.getByRole('heading', { name: 'تم تسليم الاختبار' })).toBeVisible({ timeout: 30_000 });
  await expect(page.getByText('50.0%')).toBeVisible();
});

test('محاكي مرن يستعيد الإجابة بعد انقطاع حفظ مؤقت', async ({ page }) => {
  test.skip(process.env.PREPARED_QUIZ_LIVE !== '1' || process.env.PREPARED_MOCK_FLEXIBLE !== '1', 'requires isolated flexible mock');
  test.setTimeout(180_000);
  const login = await page.request.post('/api/v1/auth/login', { data: { email: process.env.PREPARED_OWNER_EMAIL, password: process.env.PREPARED_PASSWORD } });
  expect(login.status()).toBe(200);
  const id = process.env.PREPARED_MOCK_ID!;
  const started = page.waitForResponse(response => response.url().endsWith(`/assessments/${id}/attempts`) && response.request().method() === 'POST');
  await page.goto(`/assessments/${id}/start`, { waitUntil: 'domcontentloaded', timeout: 90_000 });
  const attemptId = (await (await started).json()).attempt.id as string;
  await expect(page.getByText('سؤال تجريبي', { exact: true })).toBeVisible();
  await page.route('**/api/v1/assessment-attempts/*/answers/00000000-0000-0000-0000-000000000005', route => route.abort('failed'), { times: 1 });
  await page.getByRole('button', { name: /نعم/ }).click();
  await expect(page.getByRole('alert')).toBeVisible();
  await expect(page.getByRole('button', { name: 'التالي' })).toBeDisabled();
  await page.getByRole('button', { name: /نعم/ }).click();
  await expect(page.getByRole('button', { name: 'التالي' })).toBeEnabled();
  await page.goto(`/assessment-attempts/${attemptId}`, { waitUntil: 'domcontentloaded', timeout: 90_000 });
  await expect(page.getByRole('button', { name: /نعم/ })).toHaveAttribute('aria-pressed', 'true');
  await page.getByRole('button', { name: 'التالي' }).click();
  await expect(page.getByText('سؤال القسم الثاني', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: /صحيح/ }).click();
  await page.getByRole('button', { name: 'السابق' }).click();
  await expect(page.getByText('سؤال تجريبي', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'إنهاء الاختبار' }).click();
  await page.getByRole('button', { name: 'نعم، قم بالتسليم' }).click();
  await expect(page.getByRole('heading', { name: 'تم تسليم الاختبار' })).toBeVisible();
  await expect(page.getByText('100.0%')).toBeVisible();
});

test('انقطاع الشبكة الفعلي ثم استعادتها أثناء المحاكي المرن', async ({ page, context }) => {
  test.skip(process.env.PREPARED_QUIZ_LIVE !== '1' || process.env.PREPARED_MOCK_FLEXIBLE !== '1', 'requires isolated flexible mock');
  test.setTimeout(180_000);
  const login = await page.request.post('/api/v1/auth/login', { data: { email: process.env.PREPARED_OWNER_EMAIL, password: process.env.PREPARED_PASSWORD } });
  expect(login.status()).toBe(200);
  await page.goto(`/assessments/${process.env.PREPARED_MOCK_ID}/start`, { waitUntil: 'domcontentloaded', timeout: 90_000 });
  await expect(page.getByText('سؤال تجريبي', { exact: true })).toBeVisible();
  await context.setOffline(true);
  try {
    await page.getByRole('button', { name: /نعم/ }).click();
    await expect(page.getByRole('alert')).toBeVisible();
    await expect(page.getByRole('button', { name: 'التالي' })).toBeDisabled();
  } finally {
    await context.setOffline(false);
  }
  await page.getByRole('button', { name: /نعم/ }).click();
  await expect(page.getByRole('button', { name: 'التالي' })).toBeEnabled();
  await page.getByRole('button', { name: 'التالي' }).click();
  await expect(page.getByText('سؤال القسم الثاني', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: /صحيح/ }).click();
  await page.getByRole('button', { name: 'إنهاء الاختبار' }).click();
  await page.getByRole('button', { name: 'نعم، قم بالتسليم' }).click();
  await expect(page.getByRole('heading', { name: 'تم تسليم الاختبار' })).toBeVisible({ timeout: 30_000 });
  await expect(page.getByText('100.0%')).toBeVisible();
});

test('فقد رد التسليم لا ينشئ نتيجة ثانية عند إعادة المحاولة', async ({ page }) => {
  test.skip(process.env.PREPARED_QUIZ_LIVE !== '1' || process.env.PREPARED_MOCK_FLEXIBLE !== '1', 'requires isolated flexible mock');
  test.setTimeout(180_000);
  const login = await page.request.post('/api/v1/auth/login', { data: { email: process.env.PREPARED_OWNER_EMAIL, password: process.env.PREPARED_PASSWORD } });
  expect(login.status()).toBe(200);
  await page.goto(`/assessments/${process.env.PREPARED_MOCK_ID}/start`, { waitUntil: 'domcontentloaded', timeout: 90_000 });
  await expect(page.getByText('سؤال تجريبي', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: /نعم/ }).click();
  const keys: string[] = [];
  await page.route('**/api/v1/assessment-attempts/*/submit', async route => {
    keys.push(route.request().postDataJSON().submissionKey);
    if (keys.length === 1) {
      const serverResponse = await route.fetch();
      expect(serverResponse.status()).toBe(200);
      await route.abort('failed');
    } else await route.continue();
  });
  await page.getByRole('button', { name: 'إنهاء الاختبار' }).click();
  await page.getByRole('button', { name: 'نعم، قم بالتسليم' }).click();
  await expect(page.getByRole('alert')).toBeVisible();
  await page.getByRole('button', { name: 'إنهاء الاختبار' }).click();
  await page.getByRole('button', { name: 'نعم، قم بالتسليم' }).click();
  await expect(page.getByRole('heading', { name: 'تم تسليم الاختبار' })).toBeVisible();
  await expect(page.getByText('50.0%')).toBeVisible();
  expect(keys).toHaveLength(2);
  expect(keys[0]).toBeTruthy();
  expect(keys[1]).toBe(keys[0]);
});

test('المهارة الضعيفة ترتبط بموضوع تأسيسها وتحمي النتيجة من طالب آخر', async ({ page }) => {
  test.skip(process.env.PREPARED_QUIZ_LIVE !== '1', 'requires isolated Go and PostgreSQL');
  test.setTimeout(180_000);
  const login = async (email: string) => {
    const response = await page.request.post('/api/v1/auth/login', { data: { email, password: process.env.PREPARED_PASSWORD } });
    expect(response.status()).toBe(200);
  };
  await login(process.env.PREPARED_OWNER_EMAIL!);
  const assessmentId = process.env.PREPARED_ASSESSMENT_ID!;
  const started = page.waitForResponse(response => response.url().endsWith(`/assessments/${assessmentId}/attempts`) && response.request().method() === 'POST');
  await page.goto(`/assessments/${assessmentId}/start`, { waitUntil: 'domcontentloaded', timeout: 90_000 });
  const attemptId = (await (await started).json()).attempt.id as string;
  await expect(page.getByText('سؤال تجريبي', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: /لا$/ }).click();
  await page.getByRole('button', { name: 'إنهاء الاختبار' }).click();
  await page.getByRole('button', { name: 'نعم، قم بالتسليم' }).click();
  await expect(page.getByText('0.0%')).toBeVisible({ timeout: 30_000 });
  await page.getByRole('link', { name: 'عرض النتيجة والمراجعة' }).click();
  await expect(page.getByText('يحتاج تدريب', { exact: true })).toBeVisible();
  await expect(page.getByText('مهارة فرعية تجريبية')).toBeVisible();
  await expect(page.getByText('موضوع تأسيس تجريبي')).toBeVisible();
  const explanation = await page.getByRole('link', { name: 'شرح التأسيس' }).getAttribute('href');
  const practice = await page.getByRole('link', { name: 'تدريبات الموضوع' }).getAttribute('href');
  expect(explanation).toContain('topic=00000000-0000-0000-0000-000000000022');
  expect(explanation).toContain('content=lessons');
  expect(practice).toContain('topic=00000000-0000-0000-0000-000000000022');
  expect(practice).toContain('content=quizzes');
  await page.screenshot({ path: 'test-results/weak-skill-live-result.png', fullPage: true });
  await page.getByRole('link', { name: 'شرح التأسيس' }).click();
  const topicDialog = page.getByTestId('foundation-topic-dialog');
  await expect(topicDialog.getByText('موضوع تأسيس تجريبي', { exact: true })).toBeVisible({ timeout: 30_000 });
  await expect(topicDialog.getByText('مقطع شرح تجريبي أول', { exact: true })).toBeVisible();
  await expect(topicDialog.getByText('مقطع شرح تجريبي ثان', { exact: true })).toBeVisible();
  await topicDialog.getByRole('button', { name: 'فتح الدرس: مقطع شرح تجريبي أول' }).click();
  await expect(topicDialog.getByRole('dialog', { name: 'الدرس المحدد' }).getByRole('heading', { name: 'مقطع شرح تجريبي أول' })).toBeVisible();
  await topicDialog.getByRole('button', { name: 'إغلاق مشغل الفيديو' }).click();
  await topicDialog.getByRole('button', { name: 'فتح الدرس: مقطع شرح تجريبي ثان' }).click();
  await expect(topicDialog.getByRole('dialog', { name: 'الدرس المحدد' }).getByRole('heading', { name: 'مقطع شرح تجريبي ثان' })).toBeVisible();
  await topicDialog.getByRole('button', { name: 'إغلاق مشغل الفيديو' }).click();
  await page.goBack({ waitUntil: 'domcontentloaded' });
  await page.getByRole('link', { name: 'تدريبات الموضوع' }).click();
  await expect(topicDialog.getByRole('heading', { name: 'تدريب الموضوع التجريبي', exact: true })).toBeVisible({ timeout: 30_000 });
  await topicDialog.getByRole('button', { name: 'بدء التدريب: تدريب الموضوع التجريبي' }).click();
  await expect(page.getByText('سؤال تجريبي', { exact: true })).toBeVisible({ timeout: 30_000 });
  await login(process.env.PREPARED_OTHER_EMAIL!);
  const otherReview = await page.request.get(`/api/v1/assessment-attempts/${attemptId}/review`);
  expect([403, 404]).toContain(otherReview.status());
});

test('السؤال المصور يعرض الصورة والحروف فقط من قاعدة حقيقية', async ({ page }) => {
  test.skip(process.env.PREPARED_QUIZ_LIVE !== '1' || process.env.PREPARED_IMAGE_QUIZ !== '1', 'requires isolated image question');
  test.setTimeout(180_000);
  const login = await page.request.post('/api/v1/auth/login', { data: { email: process.env.PREPARED_OWNER_EMAIL, password: process.env.PREPARED_PASSWORD } });
  expect(login.status()).toBe(200);
  const started = page.waitForResponse(response => response.url().endsWith(`/assessments/${process.env.PREPARED_ASSESSMENT_ID}/attempts`) && response.request().method() === 'POST');
  await page.goto(`/assessments/${process.env.PREPARED_ASSESSMENT_ID}/start`, { waitUntil: 'domcontentloaded', timeout: 90_000 });
  const initial = await (await started).json();
  expect(initial.attempt.questions[0].options.map((option: {index:number}) => option.index)).toEqual([0, 1, 2, 3]);
  await expect(page.getByRole('img', { name: 'صورة السؤال الكاملة' })).toBeVisible({ timeout: 30_000 });
  await expect(page.getByText('نص خاص بسياق الذكاء')).toHaveCount(0);
  await expect(page.getByText('قطعة خاصة بسياق الذكاء')).toHaveCount(0);
  await expect(page.getByText('نعم', { exact: true })).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'A', exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'B', exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'C', exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'D', exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'A', exact: true }).click();
  await page.getByRole('button', { name: 'إنهاء الاختبار' }).click();
  await page.getByRole('button', { name: 'نعم، قم بالتسليم' }).click();
  await expect(page.getByText('100.0%')).toBeVisible();
  await page.getByRole('link', { name: 'عرض النتيجة والمراجعة' }).click();
  const review = await page.request.get(`/api/v1/assessment-attempts/${initial.attempt.id}/review`);
  expect(review.status()).toBe(200);
  expect((await review.json()).detail.questions[0].options.map((option: {index:number}) => option.index)).toEqual([0, 1, 2, 3]);
  await expect(page.getByRole('img', { name: 'صورة السؤال الكاملة' })).toBeVisible();
  await expect(page.getByText('نص خاص بسياق الذكاء')).toHaveCount(0);
  await expect(page.getByText('قطعة خاصة بسياق الذكاء')).toHaveCount(0);
  await expect(page.getByText('نعم', { exact: true })).toHaveCount(0);
  await expect(page.getByText('A', { exact: true })).toBeVisible();
  await expect(page.getByText('B', { exact: true })).toBeVisible();
});

test('اختبار باركود يعرض صورة السؤال وحروفه ويصحح الإجابة', async ({ page }) => {
  test.skip(process.env.PREPARED_QUIZ_LIVE !== '1' || process.env.PREPARED_IMAGE_QUIZ !== '1', 'requires isolated image session');
  test.setTimeout(180_000);
  const code = process.env.PREPARED_PUBLIC_CODE!;
  const started = page.waitForResponse(response => response.url().endsWith(`/public-assessments/${code}/start`) && response.request().method() === 'POST');
  await page.goto(`/barcode-test/${code}`, { waitUntil: 'domcontentloaded', timeout: 90_000 });
  const initial = await (await started).json();
  expect(initial.attempt.questions[0].options.map((option: {index:number}) => option.index)).toEqual([0, 1, 2, 3]);
  await expect(page.getByRole('img', { name: 'صورة السؤال الكاملة' })).toBeVisible({ timeout: 30_000 });
  await page.getByRole('img', { name: 'صورة السؤال الكاملة' }).click();
  const zoom = page.getByRole('dialog', { name: 'تكبير صورة السؤال' });
  await expect(zoom).toBeVisible();
  await zoom.getByRole('button', { name: 'إغلاق' }).click();
  await expect(zoom).toHaveCount(0);
  await expect(page.getByText('نص خاص بسياق الذكاء')).toHaveCount(0);
  await expect(page.getByText('نعم', { exact: true })).toHaveCount(0);
  await page.getByLabel('اسم المشارك').fill('طالب تجريبي');
  const labels = process.env.PREPARED_IMAGE_ARABIC === '1' ? ['أ', 'ب', 'ج', 'د'] : ['A', 'B', 'C', 'D'];
  for (const label of labels) await expect(page.getByRole('button', { name: label, exact: true })).toBeVisible();
  await page.getByRole('button', { name: labels[0], exact: true }).click();
  await page.getByRole('button', { name: 'إرسال الاختبار' }).click();
  await expect(page.getByText('100.0%')).toBeVisible({ timeout: 30_000 });
});
