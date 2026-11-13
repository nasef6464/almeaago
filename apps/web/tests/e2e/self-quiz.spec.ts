import { expect, test } from '@playwright/test';

test('اختبار موجه يرسل نطاقه ويفتح المحاولة', async ({ page }) => {
  test.setTimeout(240_000);
  const path = '11111111-1111-4111-8111-111111111111';
  const subject = '22222222-2222-4222-8222-222222222222';
  const skill = '33333333-3333-4333-8333-333333333333';
  const reply = (body: unknown) => ({ status: 200, contentType: 'application/json', body: JSON.stringify(body) });
  await page.route('**/api/v1/auth/me', r => r.fulfill(reply({ user: { id: 'student', name: 'طالب', role: 'student', roles: ['student'], status: 'active' } })));
  await page.route('**/api/v1/auth/csrf', r => r.fulfill(reply({ csrfToken: 'csrf' })));
  await page.route('**/api/v1/taxonomy/bootstrap?phase=full', r => r.fulfill(reply({ paths: [{ id: path, name: 'القدرات' }], subjects: [{ id: subject, pathId: path, name: 'الكمي' }], skills: [{ id: skill, subjectId: subject, name: 'القسمة' }] })));
  const attempt = { id: 'attempt-1', assessmentId: '', assessmentVersion: 0, attemptNumber: 1, status: 'in_progress', title: 'اختبار ذاتي', startedAt: new Date().toISOString(), expiresAt: null, submittedAt: null, showProgressBar: true, requireAnswerBeforeNext: false, allowQuestionReview: true, randomizeOptions: false, questions: [{ id: 'q1', version: 1, sectionId: '', sortOrder: 1, points: 1, type: 'mcq', text: 'كم يساوي ٤ ÷ ٢؟', imageAssetId: '', imageAlt: '', optionsEmbeddedInImage: false, videoUrl: '', difficulty: 'easy', options: [{ index: 0, text: '٢', assetId: '' }] }], answers: [] };
  let firstKey = '';
  await page.route('**/api/v1/assessment-attempts/self', async r => {
    const payload = r.request().postDataJSON();
    expect(payload).toMatchObject({ pathId: path, subjectId: subject, skillIds: [skill], evidenceType: 'remediation', questionCount: 5 });
    expect(payload.startKey).toBeTruthy();
    if (!firstKey) { firstKey = payload.startKey; await r.abort(); return; }
    expect(payload.startKey).toBe(firstKey);
    await r.fulfill(reply({ attempt }));
  });
  await page.route('**/api/v1/assessment-attempts/attempt-1', r => r.fulfill(reply({ attempt })));
  await page.route('**/api/v1/assessment-attempts/self/current', r => r.fulfill(reply({ attempt })));
  await page.route('**/api/v1/assessment-attempts/attempt-1/answers/q1', r => {
    expect(r.request().postDataJSON()).toMatchObject({ selectedOptionIndex: null, markedForReview: true });
    return r.fulfill(reply({ attempt: { ...attempt, answers: [{ questionId: 'q1', selectedOptionIndex: null, textAnswer: '', timeSpentSeconds: 0, markedForReview: true, lastSavedAt: new Date().toISOString() }] } }));
  });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/quiz?mode=self', { waitUntil: 'domcontentloaded' });
  await expect(page.getByText('اختبار ذاتي بمواصفاتك')).toBeVisible({ timeout: 30000 });
  await expect(page.getByText('القسمة', { exact: false }).first()).toBeVisible({ timeout: 30000 });
  await expect(page.getByRole('button', { name: 'فتح المساعد الذكي' })).toHaveCount(0);
  await page.screenshot({ path: 'test-results/self-quiz-mobile-default.png' });
  await page.goto(`/quiz?mode=self&pathId=${path}&subjectId=${subject}&skillIds=${skill}&evidenceType=remediation&questionCount=5`, { waitUntil: 'domcontentloaded' });
  await expect(page.getByText('القسمة', { exact: false }).first()).toBeVisible({ timeout: 30000 });
  await page.screenshot({ path: 'test-results/self-quiz-mobile.png', fullPage: true });
  await page.getByRole('button', { name: 'ابدأ الاختبار الذاتي الآن' }).click();
  await expect(page.getByRole('alert')).toContainText('تعذر بدء الاختبار');
  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.getByRole('button', { name: 'ابدأ الاختبار الذاتي الآن' }).click();
  await expect(page).toHaveURL(/\/assessment-attempts\/attempt-1/);
  await expect(page.getByText('كم يساوي ٤ ÷ ٢؟')).toBeVisible();
  await page.getByRole('button', { name: 'مراجعة لاحقاً' }).click();
  await expect(page.getByRole('button', { name: 'معلّم للمراجعة' })).toBeVisible();
  await page.goto('/quiz?mode=self', { waitUntil: 'domcontentloaded' });
  await expect(page.getByText('يوجد تقدم محفوظ')).toBeVisible({ timeout: 30000 });
  await page.getByRole('link', { name: 'استعادة التقدم' }).click();
  await expect(page).toHaveURL(/\/assessment-attempts\/attempt-1/);
});
