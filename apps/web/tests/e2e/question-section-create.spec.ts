import { expect, test } from '@playwright/test';

test('question creation clears a section when the subject changes and sends the selected section', async ({ page }) => {
  const pageErrors: string[] = [];
  page.on('pageerror', error => pageErrors.push(error.message));
  const json = (route: any, data: unknown) => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(data) });
  await page.route('**/api/v1/auth/me', r => json(r, { user: { id: 'admin', role: 'admin', roles: ['admin'], status: 'active' } }));
  await page.route('**/api/v1/auth/csrf', r => json(r, { csrfToken: 'csrf' }));
  await page.route('**/api/v1/taxonomy/bootstrap?phase=full', r => json(r, {
    paths: [{ id: 'p', name: 'المسار' }],
    subjects: [{ id: 's1', pathId: 'p', name: 'الأولى' }, { id: 's2', pathId: 'p', name: 'الثانية' }],
    sections: [{ id: 'sec1', subjectId: 's1', name: 'قسم الأولى' }, { id: 'sec2', subjectId: 's2', name: 'قسم الثانية' }],
    skills: [{ id: 'sk2', subjectId: 's2', name: 'مهارة', kind: 'main' }],
  }));
  await page.route('**/api/v1/questions/coverage?**', r => json(r, {}));
  await page.route('**/api/v1/questions?**', r => json(r, { items: [], total: 0, page: 1, pageSize: 20 }));
  let payload: any;
  await page.route('**/api/v1/questions/', r => { payload = r.request().postDataJSON(); return json(r, { question: { id: 'created', subjectId: 's2', currentVersion: 1, options: [], version: {} } }); });
  await page.goto('/admin-dashboard/questions', { waitUntil: 'domcontentloaded' });
  await page.getByRole('button', { name: 'سؤال جديد' }).click();
  await page.getByLabel('كود السؤال الجديد').fill('TEST-SECTION');
  await page.getByLabel('نوع السؤال الجديد').selectOption('essay');
  await page.getByLabel('مسار السؤال الجديد').selectOption('p');
  await page.getByLabel('مادة السؤال الجديد').selectOption('s1');
  const section = page.getByLabel('قسم السؤال الجديد');
  await section.selectOption('sec1');
  await page.getByLabel('مادة السؤال الجديد').selectOption('s2');
  await expect(section).toHaveValue('');
  await expect(section.locator('option[value="sec1"]')).toHaveCount(0);
  await section.selectOption('sec2');
  await page.getByLabel('المهارة الرئيسية للسؤال').selectOption('sk2');
  await page.getByLabel('نص السؤال الجديد').fill('سؤال تجريبي');
  await page.getByRole('button', { name: 'حفظ السؤال كمسودة' }).click();
  await expect.poll(() => payload?.sectionId).toBe('sec2');
  expect(payload.version.subjectId).toBe('s2');
  await expect(page.getByText('تم حفظ السؤال الجديد كمسودة معتمدة.')).toBeVisible();
  expect(pageErrors).toEqual([]);
});
