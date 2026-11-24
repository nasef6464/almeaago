import { expect, test } from '@playwright/test';

test('الاختبار الذاتي يصل إلى النتيجة والتقارير', async ({ page }) => {
  test.skip(process.env.SELF_QUIZ_LIVE !== '1', 'requires isolated Go and PostgreSQL');
  test.setTimeout(180_000);
  const login = await page.request.post('/api/v1/auth/login', {
    data: { email: process.env.SELF_QUIZ_EMAIL, password: process.env.SELF_QUIZ_PASSWORD },
  });
  expect(login.status()).toBe(200);
  const params = new URLSearchParams({
    mode: 'self',
    pathId: '00000000-0000-0000-0000-000000000003',
    subjectId: '00000000-0000-0000-0000-000000000004',
    sectionId: '00000000-0000-0000-0000-000000009001',
    skillIds: '00000000-0000-0000-0000-000000000010',
    questionCount: '5',
    timeLimit: '30',
    evidenceType: 'remediation',
  });
  await page.goto(`/quiz?${params}`, { waitUntil: 'domcontentloaded' });
  const started = page.waitForResponse(response => response.url().endsWith('/assessment-attempts/self') && response.request().method() === 'POST');
  await page.getByRole('button', { name: 'ابدأ الاختبار الذاتي الآن' }).click();
  const response = await started;
  expect(response.status()).toBe(200);
  const attemptId = (await response.json()).attempt.id as string;
  await expect(page.getByText('first', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: /yes$/ }).click();
  await page.getByRole('button', { name: 'إنهاء الاختبار' }).click();
  await page.getByRole('button', { name: 'نعم، قم بالتسليم' }).click();
  await expect(page.getByText('درجتك', { exact: true })).toBeVisible();
  const history = await page.request.get('/api/v1/assessment-attempts/results?page=1&limit=20');
  expect((await history.json()).items).toEqual(expect.arrayContaining([expect.objectContaining({ attemptId })]));
  await page.goto('/reports', { waitUntil: 'domcontentloaded' });
  const report = page.getByRole('article').filter({ hasText: 'اختبار ذاتي' });
  await expect(report).toBeVisible();
  await report.getByRole('link').click();
  await expect(page).toHaveURL(new RegExp(`/assessment-results/${attemptId}`));
  await page.getByRole('button', { name: /مراجعة الأسئلة/ }).click();
  await expect(page.getByText('الإجابة الصحيحة', { exact: true })).toBeVisible();
});
