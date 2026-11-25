import { expect, test } from '@playwright/test';
import { reviewVideoFixture } from './fixtures/review-video';

test('تصنيف السؤال المنشور يبقى ثابتًا بعد تعديل بنك الأسئلة وإعادة التسليم', async ({ page }) => {
  test.skip(process.env.PREPARED_QUIZ_LIVE !== '1' || process.env.PREPARED_SKILL_VERSION_TEST !== '1', 'requires a dedicated isolated database run');
  test.setTimeout(180_000);
  const questionId = '00000000-0000-0000-0000-000000000005';
  const originalSkillId = '00000000-0000-0000-0000-000000000021';
  const updatedSkillId = '00000000-0000-0000-0000-000000000097';
  const pathId = '00000000-0000-4000-8000-000000000003';
  const subjectId = '00000000-0000-4000-8000-000000000004';
  const assessmentId = process.env.PREPARED_ASSESSMENT_ID!;
  const login = async (email: string) => {
    const response = await page.request.post('/api/v1/auth/login', {
      data: { email, password: process.env.PREPARED_PASSWORD },
    });
    expect(response.status()).toBe(200);
  };
  const csrfHeaders = async () => {
    const response = await page.request.get('/api/v1/auth/csrf');
    expect(response.status()).toBe(200);
    return { 'X-CSRF-Token': (await response.json()).csrfToken as string };
  };

  // The Go fixture publishes the test with question version 1 before the
  // author changes the current question's skill and correct answer in v2.
  await login(process.env.PREPARED_ADMIN_EMAIL!);
  const reopenedQuestion = await page.request.patch(`/api/v1/questions/${questionId}/workflow`, {
    headers: await csrfHeaders(),
    data: { expectedCurrentVersion: 1, status: 'rejected' },
  });
  expect(reopenedQuestion.status(), await reopenedQuestion.text()).toBe(200);
  const updatedQuestion = await page.request.post(`/api/v1/questions/${questionId}/versions`, {
    headers: await csrfHeaders(),
    data: {
      expectedCurrentVersion: 1,
      version: {
        pathId,
        subjectId,
        type: 'mcq',
        text: 'السؤال المحدّث في بنك الأسئلة',
        correctOptionIndex: 1,
        options: [{ text: 'نعم' }, { text: 'لا' }],
        skillLinks: [{ skillId: updatedSkillId, relationType: 'main' }],
      },
    },
  });
  expect(updatedQuestion.status(), await updatedQuestion.text()).toBe(200);
  expect((await updatedQuestion.json()).question).toMatchObject({
    currentVersion: 2,
    skillLinks: [{ skillId: updatedSkillId, relationType: 'main' }],
  });

  await login(process.env.PREPARED_OWNER_EMAIL!);
  const started = page.waitForResponse(response =>
    response.url().endsWith(`/assessments/${assessmentId}/attempts`) && response.request().method() === 'POST');
  await page.goto(`/assessments/${assessmentId}/start`);
  const { attempt } = await (await started).json();
  const attemptPath = `/api/v1/assessment-attempts/${attempt.id}`;
  await expect(page.getByText('سؤال تجريبي', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: /نعم$/ }).click();
  await page.getByRole('button', { name: 'إنهاء الاختبار' }).click();
  const submitted = page.waitForResponse(response =>
    response.url().endsWith(`${attemptPath}/submit`) && response.request().method() === 'POST');
  await page.getByRole('button', { name: 'نعم، قم بالتسليم' }).click();
  const first = await submitted;
  expect(first.status(), await first.text()).toBe(200);
  expect((await first.json()).result.score).toBe(100);
  await expect(page.getByText('درجتك', { exact: true }).locator('..').getByText('100%', { exact: true })).toBeVisible();

  const replay = await page.request.post(`${attemptPath}/submit`, {
    headers: await csrfHeaders(),
    data: first.request().postDataJSON(),
  });
  expect(replay.status(), await replay.text()).toBe(200);
  expect(await replay.json()).toEqual(await first.json());
  const review = await page.request.get(`${attemptPath}/review`);
  expect(review.status(), await review.text()).toBe(200);
  expect((await review.json()).detail.skillAnalysis).toEqual({
    complete: true,
    items: [expect.objectContaining({ skillId: originalSkillId, questionCount: 1, correctCount: 1 })],
  });
  const progress = await page.request.get(`/api/v1/mastery/progress?pathId=${pathId}&subjectId=${subjectId}`);
  expect(progress.status(), await progress.text()).toBe(200);
  expect((await progress.json()).items).toEqual([
    expect.objectContaining({ skillId: originalSkillId, evidenceCount: 1 }),
  ]);

  await page.goto('/reports');
  const attemptLink = page.locator(`article a[href="/assessment-results/${attempt.id}"]`);
  await expect(attemptLink).toHaveCount(1);
  await attemptLink.click();
  await page.reload();
  await expect(page.getByRole('heading', { name: 'نتيجة الاختبار', exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'تفاصيل أكثر' }).click();
  const analysis = page.getByRole('dialog', { name: 'تحليل المهارات' });
  await expect(analysis.getByText('مهارة فرعية تجريبية', { exact: true })).toBeVisible();
  await expect(analysis.getByText('مهارة التصنيف الجديد', { exact: true })).toHaveCount(0);
  for (const width of [390, 820, 1440]) {
    await page.setViewportSize({ width, height: 915 });
    await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width);
    await page.screenshot({ path: `test-results/assessment-version-taxonomy-${width}.png`, fullPage: true });
  }
  await page.keyboard.press('Escape');
  await expect(analysis).toBeHidden();
  await page.getByRole('button', { name: /^مراجعة الأسئلة/ }).click();
  await expect(page.getByText('سؤال تجريبي', { exact: true })).toBeVisible();

  await login(process.env.PREPARED_OTHER_EMAIL!);
  expect([403, 404]).toContain((await page.request.get(`${attemptPath}/review`)).status());
});

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
  await expect(page.getByRole('heading', { name: 'نتيجة الاختبار', exact: true })).toBeVisible();
  await expect(page.getByText('درجتك', { exact: true }).locator('..').getByText('100%', { exact: true })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'اختبار تجريبي جاهز' })).toBeVisible();
  await page.getByRole('button', { name: /^مراجعة الأسئلة/ }).click();
  await expect(page.getByText('سؤال تجريبي', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'إظهار الملاحظات' }).click();
  await expect(page.getByRole('region', { name: 'ملاحظات السؤال' })).toBeVisible();
  await page.getByRole('button', { name: 'إنهاء المراجعة', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'نتيجة الاختبار', exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'المحاولات السابقة' }).click();
  await expect(page.getByRole('heading', { name: 'محاولاتك السابقة' })).toBeVisible();
  await page.getByRole('button', { name: /اختبار تجريبي جاهز/ }).click();
  await expect(page.getByRole('link', { name: 'تحليل', exact: true }).first()).toBeVisible();
  await page.getByRole('link', { name: 'مراجعة', exact: true }).first().click();
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
  await expect(page.getByRole('heading', { name: 'نتيجة الاختبار', exact: true })).toBeVisible();
  await expect(page.getByText('درجتك', { exact: true }).locator('..').getByText('100%', { exact: true })).toBeVisible();
  const subjects = page.getByRole('region', { name: 'أداؤك لكل مادة' });
  for (const subject of ['مادة تجريبية', 'المادة الثانية']) {
    await expect(subjects.getByRole('progressbar', { name: `درجة ${subject}` })).toHaveAttribute('aria-valuenow', '100');
  }
  await page.reload({ waitUntil: 'domcontentloaded' });
  for (const width of [390, 820, 1440]) {
    await page.setViewportSize({ width, height: 915 });
    await expect(subjects.getByRole('progressbar')).toHaveCount(2);
    await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width);
    await subjects.screenshot({ path: `test-results/assessment-live-subject-results-${width}.png` });
  }
  const firstSubject = page.getByRole('region', { name: 'أداؤك في مادة مادة تجريبية' });
  const secondSubject = page.getByRole('region', { name: 'أداؤك في مادة المادة الثانية' });
  await firstSubject.getByText('تفاصيل المهارات (1)').click();
  await expect(firstSubject.getByRole('progressbar', { name: 'مهارة فرعية تجريبية' })).toHaveAttribute('aria-valuenow', '100');
  await expect(firstSubject.getByRole('group', { name: /^المهارات الفرعية ضمن/ })).toHaveCount(0);
  await secondSubject.getByText('تفاصيل المهارات (2)').click();
  const subskills = secondSubject.getByRole('group', { name: 'المهارات الفرعية ضمن الهندسة' });
  await expect(subskills.getByRole('progressbar', { name: 'المساحة' })).toHaveAttribute('aria-valuenow', '100');
  await expect(secondSubject.getByRole('progressbar', { name: 'الهندسة' })).toHaveAttribute('aria-valuenow', '100');
  for (const width of [390, 820, 1440]) {
    await page.setViewportSize({ width, height: 915 });
    await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width);
    await subjects.screenshot({ path: `test-results/assessment-live-subject-skills-${width}.png` });
  }
  const sections = page.getByRole('region', { name: 'تفاصيل أقسام الاختبار' });
  await expect(sections.getByRole('heading', { name: 'القسم الأول' })).not.toBeVisible();
  await sections.getByText('تفاصيل الأقسام (2)', { exact: true }).click();
  await expect(sections.getByRole('heading')).toHaveText(['القسم الأول', 'القسم الثاني']);
  await expect(sections.getByText('1 أسئلة · 1 صحيح · 0 خطأ · 0 دون إجابة')).toHaveCount(2);
  for (const width of [390, 820, 1440]) {
    await page.setViewportSize({ width, height: 915 });
    await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width);
    await sections.screenshot({ path: `test-results/assessment-live-section-results-${width}.png` });
  }
  await page.getByRole('button', { name: 'تفاصيل أكثر' }).click();
  const analysis = page.getByRole('dialog', { name: 'تحليل المهارات' });
  await expect(analysis.getByText('من الاختبار • 3 مهارات')).toBeVisible();
  await analysis.getByRole('button', { name: 'مادة تجريبية', exact: true }).click();
  await expect(analysis.getByRole('heading', { level: 3 })).toHaveText('مهارة فرعية تجريبية');
  await expect(analysis.getByRole('link', { name: 'فيديو' })).toHaveAttribute('href', /topic=00000000-0000-0000-0000-000000000022.*content=lessons/);
  await expect(analysis.getByRole('link', { name: 'تدريب' })).toHaveAttribute('href', /topic=00000000-0000-0000-0000-000000000022.*content=quizzes/);
  await analysis.getByRole('button', { name: 'الكل' }).click();
  for (const width of [390, 820, 1440]) {
    await page.setViewportSize({ width, height: 915 });
    await expect.poll(() => analysis.evaluate(dialog => dialog.scrollWidth)).toBeLessThanOrEqual(width);
    await analysis.screenshot({ path: `test-results/assessment-live-skill-analysis-${width}.png` });
  }
  await page.keyboard.press('Escape');
  await expect(analysis).not.toBeVisible();
  const clip = await reviewVideoFixture(page);
  await page.route('**/review-fixture.webm', route => route.fulfill({ body: clip, contentType: 'video/webm' }));
  await page.getByRole('button', { name: /^مراجعة الأسئلة/ }).click();
  const play = page.getByRole('button', { name: 'تشغيل شرح الفيديو' });
  await play.click();
  const video = page.getByRole('dialog', { name: 'شرح السؤال 1' });
  const media = video.locator('video');
  await expect.poll(() => media.evaluate(element => (element as HTMLVideoElement).readyState)).toBeGreaterThanOrEqual(2);
  for (const width of [390, 820, 1440]) {
    await page.setViewportSize({ width, height: 915 });
    await expect.poll(() => video.evaluate(dialog => dialog.getBoundingClientRect().width)).toBeLessThan(width);
    await page.screenshot({ path: `test-results/assessment-review-video-${width}.png` });
  }
  await video.getByRole('button', { name: 'إغلاق مشغل الفيديو' }).click();
  await expect(video).toHaveCount(0);
  await expect(page.getByText('سؤال تجريبي', { exact: true })).toBeVisible();
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
  await expect(page.getByRole('heading', { name: 'نتيجة الاختبار', exact: true })).toBeVisible({ timeout: 30_000 });
  await expect(page.getByText('درجتك', { exact: true }).locator('..').getByText('50%', { exact: true })).toBeVisible();
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
  await expect(page.getByRole('heading', { name: 'نتيجة الاختبار', exact: true })).toBeVisible();
  await expect(page.getByText('درجتك', { exact: true }).locator('..').getByText('100%', { exact: true })).toBeVisible();
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
  await expect(page.getByRole('heading', { name: 'نتيجة الاختبار', exact: true })).toBeVisible({ timeout: 30_000 });
  await expect(page.getByText('درجتك', { exact: true }).locator('..').getByText('100%', { exact: true })).toBeVisible();
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
  await expect(page.getByRole('heading', { name: 'نتيجة الاختبار', exact: true })).toBeVisible();
  await expect(page.getByText('درجتك', { exact: true }).locator('..').getByText('50%', { exact: true })).toBeVisible();
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
  await expect(page.getByText('درجتك', { exact: true }).locator('..').getByText('0%', { exact: true })).toBeVisible({ timeout: 30_000 });
  await expect(page.getByText('يحتاج مراجعة', { exact: true })).toBeVisible();
  const journey = page.getByRole('heading', { name: 'مسار ما بعد الاختبار' }).locator('..');
  await expect(journey.getByText('راجع موضع الخطأ', { exact: true })).toBeVisible();
  await expect(journey.getByRole('link', { name: /بدء التدريب/ })).toHaveAttribute('href', /topic=00000000-0000-0000-0000-000000000022&content=quizzes$/);
  await expect(page.getByRole('link', { name: /فتح الدرس.*ابدأ بالشرح المرتبط/ })).toHaveAttribute('href', /topic=00000000-0000-0000-0000-000000000022&content=lessons$/);
  await expect(page.getByRole('link', { name: /فتح الملف.*راجع الملف الداعم/ })).toHaveAttribute('href', /topic=00000000-0000-0000-0000-000000000022&content=support$/);
  await page.evaluate(() => { window.print = () => { document.documentElement.dataset.printCalled = 'yes'; }; });
  await page.getByRole('button', { name: 'تحميل PDF' }).click();
  await expect(page.locator('html')).toHaveAttribute('data-print-called', 'yes');
  const historyResponse = await page.request.get('/api/v1/assessment-attempts/results?page=1&limit=20');
  expect(historyResponse.status()).toBe(200);
  expect((await historyResponse.json()).items).toEqual(expect.arrayContaining([expect.objectContaining({ attemptId })]));
  const reportResponse = await page.request.get('/api/v1/reports/results?pathId=00000000-0000-4000-8000-000000000003&subjectId=00000000-0000-4000-8000-000000000004&page=1&limit=50');
  expect(reportResponse.status()).toBe(200);
  expect((await reportResponse.json()).items).toEqual(expect.arrayContaining([expect.objectContaining({ attemptId })]));
  const progressResponse = await page.request.get('/api/v1/mastery/progress?pathId=00000000-0000-4000-8000-000000000003&subjectId=00000000-0000-4000-8000-000000000004&page=1&limit=100');
  expect(progressResponse.status()).toBe(200);
  expect((await progressResponse.json()).items).toEqual(expect.arrayContaining([
    expect.objectContaining({ skillId: '00000000-0000-0000-0000-000000000021' }),
  ]));
  await journey.getByRole('link', { name: /فتح التقرير/ }).click();
  await expect(page.getByLabel('مسار التقرير')).toHaveValue('00000000-0000-4000-8000-000000000003');
  await expect(page.getByLabel('مادة التقرير')).toHaveValue('00000000-0000-4000-8000-000000000004');
  const reportEntry = page.getByRole('article').filter({ hasText: 'اختبار تجريبي جاهز' });
  await expect(reportEntry).toBeVisible();
  for (const width of [390, 820, 1440]) {
    await page.setViewportSize({ width, height: 915 });
    await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width);
    await page.screenshot({ path: `test-results/student-report-live-${width}.png`, fullPage: true });
  }
  await reportEntry.getByRole('link').click();
  await expect(page).toHaveURL(new RegExp(`/assessment-results/${attemptId}`));
  await page.getByRole('button', { name: /مراجعة الأسئلة/ }).click();
  await expect(page.getByText('الإجابة الصحيحة', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'اسأل المساعد النصي 💡' }).click();
  const assistant = page.getByTestId('question-assistant');
  const assistResponse = page.waitForResponse(response => response.url().endsWith('/api/v1/ai/question-assistant') && response.request().method() === 'POST');
  await assistant.getByRole('button', { name: 'تلميح', exact: true }).click();
  expect((await assistResponse).status()).toBe(200);
  await expect(assistant.getByText('شرح موثوق احتياطي')).toBeVisible();
  const saved = page.waitForResponse(response => response.url().endsWith('/review/questions/00000000-0000-0000-0000-000000000005/saved') && response.request().method() === 'PUT');
  await page.getByRole('button', { name: 'حفظ للمراجعة' }).click();
  expect((await saved).status()).toBe(200);
  await expect(page.getByRole('button', { name: 'تم الحفظ' })).toBeVisible();
  const savedLibrary = await page.request.get('/api/v1/review/library?tab=saved&pathId=00000000-0000-4000-8000-000000000003&page=1&limit=20');
  expect(savedLibrary.status()).toBe(200);
  expect((await savedLibrary.json()).items).toEqual(expect.arrayContaining([
    expect.objectContaining({ card: expect.objectContaining({ questionId: '00000000-0000-0000-0000-000000000005', savedForReview: true }) }),
  ]));
  await page.getByRole('button', { name: 'إنهاء المراجعة والعودة للملخص' }).click();
  await expect(page.getByRole('region', { name: 'أين كنت قويًا؟ وأين تحتاج دعم؟' }).getByText('مهارة فرعية تجريبية', { exact: true })).toBeVisible();
  await expect(page.getByText('موضوع تأسيس تجريبي').first()).toBeVisible();
  const explanation = await page.getByRole('link', { name: 'شرح التأسيس' }).getAttribute('href');
  const practice = await page.getByRole('link', { name: 'تدريبات الموضوع' }).getAttribute('href');
  expect(explanation).toContain('topic=00000000-0000-0000-0000-000000000022');
  expect(explanation).toContain('content=lessons');
  expect(practice).toContain('topic=00000000-0000-0000-0000-000000000022');
  expect(practice).toContain('content=quizzes');
  await page.screenshot({ path: 'test-results/weak-skill-live-result.png', fullPage: true });
  const fullReport = page.getByRole('button', { name: 'عرض التقرير الكامل' });
  const followUp = page.getByRole('region', { name: 'مهارات تحتاج متابعة' });
  const review = page.waitForResponse(response => response.url().endsWith(`/assessment-attempts/${attemptId}/review`));
  await page.reload({ waitUntil: 'domcontentloaded' });
  const reviewResponse = await review;
  expect(reviewResponse.status()).toBe(200);
  const { detail } = await reviewResponse.json();
  expect(detail.skillAnalysis.items).toEqual(expect.arrayContaining([
    expect.objectContaining({ foundationTopics: expect.arrayContaining([
      expect.objectContaining({ id: '00000000-0000-0000-0000-000000000022', hasLesson: true, hasPractice: true }),
    ]) }),
  ]));
  await fullReport.click();
  await expect(followUp.getByText('شرح مرتبط', { exact: true })).toBeVisible();
  await expect(followUp.getByText('تدريب قصير', { exact: true })).toBeVisible();
  for (const width of [390, 820, 1440]) {
    await page.setViewportSize({ width, height: 915 });
    await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width);
    await followUp.screenshot({ path: `test-results/assessment-live-follow-up-${width}.png` });
  }
  const videoFixture = await reviewVideoFixture(page);
  await page.route('**/review-fixture.webm', route => route.fulfill({ body: videoFixture, contentType: 'video/webm' }));
  const videoTrigger = followUp.getByRole('button', { name: 'شاهد الفيديو' });
  const selectedLesson = page.waitForResponse(response => response.url().includes('/learning-spaces/foundation/') && response.url().endsWith('/lessons/00000000-0000-0000-0000-000000000024'));
  await videoTrigger.click();
  expect((await selectedLesson).status()).toBe(200);
  const skillVideo = page.getByRole('dialog', { name: 'شرح مهارة مهارة فرعية تجريبية' });
  const clipMedia = skillVideo.locator('video');
  await expect.poll(() => clipMedia.evaluate(video => (video as HTMLVideoElement).readyState)).toBeGreaterThanOrEqual(2);
  expect(await clipMedia.evaluate(video => (video as HTMLVideoElement).paused)).toBe(true);
  for (const width of [390, 820, 1440]) {
    await page.setViewportSize({ width, height: 915 });
    await expect.poll(() => skillVideo.evaluate(dialog => dialog.getBoundingClientRect().width)).toBeLessThan(width);
    await page.screenshot({ path: `test-results/assessment-live-follow-up-video-${width}.png` });
  }
  await skillVideo.getByRole('button', { name: 'Play', exact: true }).first().click();
  await expect.poll(() => clipMedia.evaluate(video => (video as HTMLVideoElement).currentTime)).toBeGreaterThan(0);
  await page.keyboard.press('Escape');
  await expect(skillVideo).not.toBeVisible();
  await expect(videoTrigger).toBeFocused();
  const topicDialog = page.getByTestId('foundation-topic-dialog');
  await followUp.getByRole('link', { name: 'ملف داعم' }).click();
  await expect(topicDialog.getByRole('heading', { name: 'ملف دعم المهارة التجريبي' })).toBeVisible();
  await expect(topicDialog.getByRole('link', { name: 'فتح الملف' })).toHaveAttribute('href', 'https://example.invalid/foundation.pdf');
  await page.goBack({ waitUntil: 'domcontentloaded' });
  await fullReport.click();
  await followUp.getByRole('link', { name: 'راجع الشرح' }).click();
  await expect(topicDialog.getByRole('dialog', { name: 'الدرس المحدد' })).toHaveCount(0);
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
  await fullReport.click();
  await followUp.getByRole('link', { name: 'تدريب مناسب' }).click();
  await expect(topicDialog.getByRole('heading', { name: 'تدريب الموضوع التجريبي', exact: true })).toBeVisible({ timeout: 30_000 });
  await topicDialog.getByRole('button', { name: 'بدء التدريب: تدريب الموضوع التجريبي' }).click();
  await expect(page.getByText('سؤال تجريبي', { exact: true })).toBeVisible({ timeout: 30_000 });
  await login(process.env.PREPARED_OTHER_EMAIL!);
  const otherReview = await page.request.get(`/api/v1/assessment-attempts/${attemptId}/review`);
  expect([403, 404]).toContain(otherReview.status());
  const otherCsrf = await page.request.get('/api/v1/auth/csrf');
  const otherAssist = await page.request.post('/api/v1/ai/question-assistant', {
    headers: { 'X-CSRF-Token': (await otherCsrf.json()).csrfToken },
    data: { attemptId, questionId: '00000000-0000-0000-0000-000000000005', helpLevel: 'hint', message: '' },
  });
  expect([403, 404]).toContain(otherAssist.status());
  const otherReport = await page.request.get('/api/v1/reports/results?pathId=00000000-0000-4000-8000-000000000003&subjectId=00000000-0000-4000-8000-000000000004&page=1&limit=50');
  expect(otherReport.status()).toBe(200);
  expect((await otherReport.json()).items).not.toEqual(expect.arrayContaining([expect.objectContaining({ attemptId })]));
});

test('الطالب ينفذ اختبار المدرسة ويرى نتيجته', async ({ page }) => {
  test.skip(process.env.PREPARED_QUIZ_LIVE !== '1' || process.env.PREPARED_SCHOOL_ASSIGNMENT !== '1', 'requires isolated school assignment');
  test.setTimeout(180_000);
  const login = async (email: string) => {
    const response = await page.request.post('/api/v1/auth/login', { data: { email, password: process.env.PREPARED_PASSWORD } });
    expect(response.status()).toBe(200);
  };
  await login(process.env.PREPARED_OWNER_EMAIL!);
  await page.goto('/dashboard', { waitUntil: 'domcontentloaded' });
  const studentNav = page.getByRole('navigation', { name: 'تنقل لوحة الطالب' });
  await studentNav.getByRole('link', { name: /الاختبارات المدرسية/ }).click();
  await expect(page).toHaveURL('/dashboard?tab=school-tests');
  await expect(page.getByText('اختبار تجريبي جاهز', { exact: true })).toBeVisible();
  const started = page.waitForResponse(response => response.url().endsWith('/assessment-assignments/00000000-0000-4000-8000-000000000091/start') && response.request().method() === 'POST');
  await page.getByRole('button', { name: 'ابدأ التكليف' }).click();
  const response = await started;
  expect(response.status()).toBe(201);
  const attemptId = (await response.json()).attempt.id as string;
  await expect(page.getByText('سؤال تجريبي', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: /لا$/ }).click();
  await page.getByRole('button', { name: 'إنهاء الاختبار' }).click();
  await page.getByRole('button', { name: 'نعم، قم بالتسليم' }).click();
  await expect(page.getByText('درجتك', { exact: true })).toBeVisible();
  const history = await page.request.get('/api/v1/assessment-attempts/results?page=1&limit=20');
  expect((await history.json()).items).toEqual(expect.arrayContaining([expect.objectContaining({ attemptId })]));
  await page.getByRole('button', { name: /مراجعة الأسئلة/ }).click();
  await expect(page.getByText('الإجابة الصحيحة', { exact: true })).toBeVisible();
  await page.goto('/dashboard', { waitUntil: 'domcontentloaded' });
  await studentNav.getByRole('link', { name: /الاختبارات السابقة/ }).click();
  await expect(page).toHaveURL('/dashboard?tab=quizzes');
  await expect(page.getByRole('heading', { name: 'اختبار تجريبي جاهز', exact: true })).toBeVisible();
  await login(process.env.PREPARED_OTHER_EMAIL!);
  const review = await page.request.get(`/api/v1/assessment-attempts/${attemptId}/review`);
  expect([403, 404]).toContain(review.status());
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
  await expect(page.getByText('درجتك', { exact: true }).locator('..').getByText('100%', { exact: true })).toBeVisible();
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
  let startRequests = 0;
  page.on('request', request => { if (request.url().endsWith(`/public-assessments/${code}/start`) && request.method() === 'POST') startRequests++; });
  const started = page.waitForResponse(response => response.url().endsWith(`/public-assessments/${code}/start`) && response.request().method() === 'POST');
  await page.goto(`/barcode-test/${code}`, { waitUntil: 'domcontentloaded', timeout: 90_000 });
  const initial = await (await started).json();
  expect(initial.attempt.questions[0].options.map((option: {index:number}) => option.index)).toEqual([0, 1, 2, 3]);
  expect(startRequests).toBe(1);
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

test('تقدم الدورة محفوظ لكل طالب على قاعدة محلية', async ({ page }) => {
  test.skip(process.env.PREPARED_QUIZ_LIVE !== '1' || process.env.PREPARED_COURSE_PROGRESS !== '1', 'requires isolated course and local database');
  test.setTimeout(180_000);
  const courseId = '00000000-0000-0000-0000-000000000031';
  const firstLesson = '00000000-0000-0000-0000-000000000033';
  async function login(email: string) {
    const response = await page.request.post('/api/v1/auth/login', {data:{email,password:process.env.PREPARED_PASSWORD}});
    expect(response.status()).toBe(200);
  }
  await login(process.env.PREPARED_OWNER_EMAIL!);
  await page.goto(`/learning/courses/${courseId}?lesson=${firstLesson}`, {waitUntil:'domcontentloaded'});
  await expect(page.getByText('محتوى الدرس الأول')).toBeVisible({timeout:30000});
  await page.getByRole('button',{name:'الشهادة والإنجاز'}).click();
  await expect(page.getByText('0%',{exact:true})).toBeVisible();
  await page.getByRole('button',{name:'تحديد كمكتمل'}).click();
  await expect(page.getByText('50%',{exact:true})).toBeVisible();
  const response = await page.request.get(`/api/v1/learning-progress/courses/${courseId}/completed`);
  expect(response.status()).toBe(200);
  expect((await response.json()).completedLessonIds).toEqual([firstLesson]);
  await page.reload();
  await page.getByRole('button',{name:'الشهادة والإنجاز'}).click();
  await expect(page.getByText('50%',{exact:true})).toBeVisible();
  await login(process.env.PREPARED_OTHER_EMAIL!);
  await page.reload();
  await page.getByRole('button',{name:'الشهادة والإنجاز'}).click();
  await expect(page.getByText('0%',{exact:true})).toBeVisible();
  const other = await page.request.get(`/api/v1/learning-progress/courses/${courseId}/completed`);
  expect((await other.json()).completedLessonIds).toEqual([]);
});


test('اختبار الدرس والنتيجة والمراجعة والعودة بقاعدة محلية', async ({ page }) => {
  test.skip(process.env.PREPARED_QUIZ_LIVE !== '1' || process.env.PREPARED_COURSE_PROGRESS !== '1', 'requires isolated course and local database');
  test.setTimeout(240_000);
  page.setDefaultTimeout(45_000);
  const courseId = '00000000-0000-0000-0000-000000000031';
  const lessonId = '00000000-0000-0000-0000-000000000033';
  const destination = `/learning/courses/${courseId}?lesson=${lessonId}`;
  const login = await page.request.post('/api/v1/auth/login', {data:{email:process.env.PREPARED_OWNER_EMAIL,password:process.env.PREPARED_PASSWORD}});
  expect(login.status()).toBe(200);
  await page.goto(destination, {waitUntil:'domcontentloaded'});
  await expect(page.getByText('محتوى الدرس الأول')).toBeVisible();
  await expect(page.getByRole('heading',{name:'اختبار تجريبي جاهز'})).toBeVisible();
  await page.getByRole('button',{name:'بدء الاختبار',exact:true}).click();
  await expect(page).toHaveURL(/assessment-attempts\//);
  await expect(page.getByRole('heading',{name:'سؤال تجريبي'})).toBeVisible();
  await expect(page.getByRole('link',{name:'العودة إلى الدرس'})).toHaveAttribute('href',destination);
  await page.getByRole('button',{name:'أ نعم',exact:true}).click();
  await page.getByRole('button',{name:'إنهاء الاختبار',exact:true}).click();
  await page.getByRole('button',{name:'نعم، قم بالتسليم'}).click();
  await expect(page.getByRole('heading',{name: 'نتيجة الاختبار', exact: true})).toBeVisible();
  await expect(page).toHaveURL(/assessment-results\//);
  await expect(page.getByRole('heading',{name:'اختبار تجريبي جاهز'})).toBeVisible();
  await expect(page.getByRole('link',{name:'العودة إلى الدرس'})).toHaveAttribute('href',destination);
  await page.reload({waitUntil:'domcontentloaded'});
  await expect(page.getByRole('link',{name:'العودة إلى الدرس'})).toHaveAttribute('href',destination);
  await page.getByRole('link',{name:'العودة إلى الدرس'}).click();
  await expect(page.getByRole('heading',{name:'الدرس التجريبي الأول',level:2})).toBeVisible();
  await expect(page.getByText('محتوى الدرس الأول')).toBeVisible();
});


test('شراء باقة الدورات يفتح اختبار الدرس بعد المراجعة محليًا', async ({ page }) => {
  test.skip(process.env.PREPARED_QUIZ_LIVE !== '1' || process.env.PREPARED_COURSE_PURCHASE !== '1', 'requires isolated checkout and database');
  test.setTimeout(300_000);
  page.setDefaultTimeout(45_000);
  const courseId='00000000-0000-0000-0000-000000000031';
  const lessonId='00000000-0000-0000-0000-000000000033';
  const pathId='00000000-0000-4000-8000-000000000003';
  const destination=`/learning/courses/${courseId}?lesson=${lessonId}`;
  async function login(email:string) {
    const response=await page.request.post('/api/v1/auth/login',{data:{email,password:process.env.PREPARED_PASSWORD}});
    expect(response.status()).toBe(200); return (await response.json()).csrfToken as string;
  }
  await login(process.env.PREPARED_OWNER_EMAIL!);
  await page.goto(destination,{waitUntil:'domcontentloaded'});
  await expect(page.getByRole('heading',{name:'اختبار تجريبي جاهز'})).toBeVisible();
  await page.getByRole('link',{name:'فتح الباقة'}).click();
  await expect(page).toHaveURL(url => url.pathname === `/category/${pathId}` && url.searchParams.get('tab') === 'packages');
  const card=page.getByTestId('path-package-card').filter({hasText:'باقة الدورات التجريبية'});
  await expect(card).toBeVisible();
  await card.getByRole('button',{name:'اشترك الآن'}).click();
  const modal=page.getByTestId('payment-modal-shell');
  await modal.getByTestId('payment-continue-purchase').click();
  await modal.getByRole('button',{name:/تحويل بنكي/}).click();
  await modal.getByPlaceholder('اسم صاحب الحساب المحول منه (اختياري)').fill('طالب تجريبي');
  await modal.getByPlaceholder('اسم البنك المحوّل منه (اختياري)').fill('بنك تجريبي');
  await modal.getByPlaceholder('رقم مرجع التحويل (اختياري)').fill('LIVE-REF-123');
  await modal.getByPlaceholder('رابط إيصال HTTPS (اختياري)').fill('https://example.invalid/receipt');
  const submitted=page.waitForResponse(r=>r.url().endsWith('/api/v1/commerce/checkout/requests')&&r.request().method()==='POST');
  await modal.getByRole('button',{name:'إنشاء طلب شراء'}).click();
  const response=await submitted; expect(response.status()).toBe(201);
  const payment=(await response.json()).request;
  expect(payment).toMatchObject({productId:process.env.PREPARED_PACKAGE_ID,transferSenderName:'طالب تجريبي',transferSenderBank:'بنك تجريبي',transferReference:'LIVE-REF-123',transferReceiptUrl:'https://example.invalid/receipt',status:'pending'});
  await expect(modal.getByText('تم تسجيل الطلب بنجاح')).toBeVisible();
  await page.goto(destination,{waitUntil:'domcontentloaded'});
  await expect(page.getByRole('link',{name:'فتح الباقة'})).toBeVisible();
  const adminCsrf=await login(process.env.PREPARED_ADMIN_EMAIL!);
  const approved=await page.request.patch(`/api/v1/commerce/admin/payment-requests/${payment.id}/review`,{headers:{'X-CSRF-Token':adminCsrf},data:{expectedRevision:payment.revision,status:'paid',approvalEvidence:'local test transfer'}});
  expect(approved.status()).toBe(200);
  await login(process.env.PREPARED_OWNER_EMAIL!);
  await page.goto(destination,{waitUntil:'domcontentloaded'});
  await expect(page.getByRole('button',{name:'بدء الاختبار',exact:true})).toBeVisible();
  await page.getByRole('button',{name:'بدء الاختبار',exact:true}).click();
  await expect(page.getByRole('heading',{name:'سؤال تجريبي'})).toBeVisible();
});
