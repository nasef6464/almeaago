import { expect, test } from '@playwright/test';

test('ينشئ المسؤول قسمًا ويربط المهارة ويؤرشفه ويستعيده', async ({ page }) => {
  test.setTimeout(600_000);
  const reply = (body: unknown) => ({ status: 200, contentType: 'application/json', body: JSON.stringify(body) });
  let section: { id: string; subjectId: string; name: string; sortOrder: number; status: string } | null = null;
  let skillSection = '';
  await page.route('**/api/v1/taxonomy/admin/bootstrap', route => route.fulfill(reply({ paths: [], levels: [], subjects: [], sections: section ? [section] : [], skills: [{ id: 'skill1', subjectId: 'subject1', sectionId: skillSection, kind: 'main', name: 'القسمة', status: 'active' }] })));
  await page.route('**/api/v1/taxonomy/admin/skill-sections', route => {
    expect(route.request().headers()['x-csrf-token']).toBe('csrf');
    const body = route.request().postDataJSON();
    expect(body.subjectId).toBe('subject1');
    section = { id: 'section1', subjectId: body.subjectId, name: body.name, sortOrder: body.sortOrder, status: 'active' };
    return route.fulfill(reply({ section }));
  });
  await page.route('**/api/v1/taxonomy/admin/skill-sections/section1', route => {
    expect(route.request().headers()['x-csrf-token']).toBe('csrf');
    section = { ...section!, ...route.request().postDataJSON() };
    return route.fulfill(reply({ section }));
  });
  await page.route('**/api/v1/taxonomy/admin/skills/skill1/section', route => {
    expect(route.request().headers()['x-csrf-token']).toBe('csrf');
    skillSection = route.request().postDataJSON().sectionId;
    return route.fulfill(reply({ skill: {} }));
  });
  await page.goto('/tests/e2e/fixtures/skill-sections.html', { waitUntil: 'domcontentloaded', timeout: 240_000 });
  await page.getByLabel('اسم قسم المهارات الجديد').fill('الأعداد');
  await page.getByRole('button', { name: 'إضافة قسم' }).click();
  await expect(page.getByText('الأعداد', { exact: true }).first()).toBeVisible();
  await page.getByLabel('قسم القسمة').selectOption('section1');
  await expect.poll(() => skillSection).toBe('section1');
  await page.getByRole('button', { name: 'أرشفة' }).click();
  await expect(page.getByText('(مؤرشف)', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'استعادة' }).click();
  await expect(page.getByRole('button', { name: 'أرشفة' })).toBeVisible();
});
