import { expect, test } from '@playwright/test';

test('اختيار قسم المهارات يحدد مهاراته في الاختبار الذاتي', async ({ page }) => {
  test.setTimeout(240_000);
  const reply = (body: unknown) => ({ status: 200, contentType: 'application/json', body: JSON.stringify(body) });
  await page.route('**/api/v1/auth/me', route => route.fulfill(reply({ user: { id: 'student', name: 'طالب', role: 'student', roles: ['student'], status: 'active' } })));
  await page.route('**/api/v1/auth/csrf', route => route.fulfill(reply({ csrfToken: 'csrf' })));
  await page.route('**/api/v1/assessment-attempts/self/current', route => route.fulfill({ status: 404 }));
  await page.route('**/api/v1/taxonomy/bootstrap?phase=full', route => route.fulfill(reply({ paths: [{ id: 'path', name: 'قدرات' }], subjects: [{ id: 'subject', pathId: 'path', name: 'كمي' }], sections: [{ id: 'section', subjectId: 'subject', name: 'الأعداد', sortOrder: 1 }], skills: [{ id: 'skill1', subjectId: 'subject', sectionId: 'section', name: 'القسمة' }, { id: 'skill2', subjectId: 'subject', sectionId: 'section', name: 'الضرب' }, { id: 'skill3', subjectId: 'subject', name: 'أخرى' }] })));
  let requestBody: { skillIds: string[] } | undefined;
  await page.route('**/api/v1/assessment-attempts/self', async route => {
    requestBody = route.request().postDataJSON();
    await route.fulfill({ status: 400, contentType: 'application/json', body: JSON.stringify({ message: 'test' }) });
  });
  await page.goto('/quiz?mode=self', { waitUntil: 'domcontentloaded', timeout: 120_000 });
  await page.getByRole('button', { name: 'الأعداد (2)' }).click();
  await expect(page.getByLabel('القسمة')).toBeChecked();
  await expect(page.getByLabel('الضرب')).toBeChecked();
  await expect(page.getByLabel('أخرى')).not.toBeChecked();
  await page.getByRole('button', { name: 'ابدأ الاختبار الذاتي الآن' }).click();
  await expect.poll(() => requestBody?.skillIds).toEqual(['skill1', 'skill2']);
});

test('يحافظ رابط القسم على فلتر الأسئلة حتى يزيله الطالب', async ({ page }) => {
  test.setTimeout(240_000);
  const reply = (body: unknown) => ({ status: 200, contentType: 'application/json', body: JSON.stringify(body) });
  await page.route('**/api/v1/auth/me', route => route.fulfill(reply({ user: { id: 'student', name: 'طالب', role: 'student', roles: ['student'], status: 'active' } })));
  await page.route('**/api/v1/auth/csrf', route => route.fulfill(reply({ csrfToken: 'csrf' })));
  await page.route('**/api/v1/assessment-attempts/self/current', route => route.fulfill({ status: 404 }));
  await page.route('**/api/v1/taxonomy/bootstrap?phase=full', route => route.fulfill(reply({ paths: [], subjects: [], sections: [{ id: 'section', subjectId: 'subject', name: 'الأعداد', sortOrder: 1 }], skills: [] })));
  const sent: string[] = [];
  await page.route('**/api/v1/assessment-attempts/self', async route => {
    sent.push(route.request().postDataJSON().sectionId);
    await route.fulfill({ status: 400, contentType: 'application/json', body: JSON.stringify({ message: 'test' }) });
  });
  await page.goto('/quiz?mode=self&sectionId=section', { waitUntil: 'domcontentloaded', timeout: 120_000 });
  await expect(page.getByText('القسم: الأعداد')).toBeVisible();
  await page.getByRole('button', { name: 'ابدأ الاختبار الذاتي الآن' }).click();
  await expect.poll(() => sent.length).toBe(1);
  await page.getByRole('button', { name: 'إزالة تحديد القسم' }).click();
  await page.getByRole('button', { name: 'ابدأ الاختبار الذاتي الآن' }).click();
  await expect.poll(() => sent.length).toBe(2);
  expect(sent).toEqual(['section', '']);
});
