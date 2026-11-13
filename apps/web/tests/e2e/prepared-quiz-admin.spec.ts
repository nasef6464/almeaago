import { expect, test } from '@playwright/test';

test('يحفظ المسؤول جمهور الاختبار ثم يتحكم في إتاحته', async ({ page }) => {
  test.setTimeout(600_000);
  const reply = (body: unknown) => ({ status: 200, contentType: 'application/json', body: JSON.stringify(body) });
  await page.route('**/api/v1/assessments/prepared-groups', route => route.fulfill(reply({ groups: [{ id: 'group1', name: 'مجموعة أولى', groupType: 'PRIVATE_GROUP', memberCount: 2 }] })));
  await page.route('**/api/v1/auth/admin/users?**', route => route.fulfill(reply({ users: [{ id: 'student1', name: 'أحمد', email: 'student@example.invalid' }], pagination: { page: 1, limit: 50, total: 1, totalPages: 1 } })));
  let saved: { audienceType: string; userIds: string[]; groupIds: string[] } | undefined;
  await page.route('**/api/v1/assessments/assessment/prepared-staging', route => {
    if (route.request().method() === 'GET') return route.fulfill({ status: 404 });
    saved = route.request().postDataJSON();
    expect(route.request().headers()['x-csrf-token']).toBe('csrf');
    return route.fulfill(reply({ staged: true, active: false }));
  });
  const states: boolean[] = [];
  await page.route('**/api/v1/assessments/assessment/prepared-staging/status', route => {
    const enabled = route.request().postDataJSON().enabled as boolean;
    states.push(enabled);
    expect(route.request().headers()['x-csrf-token']).toBe('csrf');
    return route.fulfill(reply({ enabled }));
  });
  await page.goto('/tests/e2e/fixtures/prepared-admin.html', { waitUntil: 'domcontentloaded', timeout: 240_000 });
  await page.getByLabel('الجمهور').selectOption('targeted');
  await page.getByLabel('مجموعة أولى (2)').check();
  await page.getByPlaceholder('ابحث باسم الطالب أو بريده').fill('أحمد');
  await page.getByRole('button', { name: 'بحث', exact: true }).click();
  await page.getByLabel('أحمد — student@example.invalid').check();
  await page.screenshot({ path: 'test-results/prepared-quiz-admin-audience.png', fullPage: true });
  await page.getByRole('button', { name: 'حفظ الإعدادات' }).click();
  await expect(page.getByRole('status')).toContainText('حُفظت');
  expect(saved).toMatchObject({ audienceType: 'targeted', userIds: ['student1'], groupIds: ['group1'] });
  await page.getByRole('button', { name: 'إتاحة الاختبار', exact: true }).click();
  await expect(page.getByText('الحالة: متاح')).toBeVisible();
  await expect(page.getByLabel('الجمهور')).toBeDisabled();
  await page.getByRole('button', { name: 'إيقاف الإتاحة' }).click();
  await expect(page.getByText('الحالة: غير متاح')).toBeVisible();
  expect(states).toEqual([true, false]);
});

test('لا يسمح بتعديل إعدادات غير محمّلة عند فشل الاتصال', async ({ page }) => {
  test.setTimeout(240_000);
  await page.route('**/api/v1/assessments/prepared-groups', route => route.fulfill({ status: 200, contentType: 'application/json', body: '{"groups":[]}' }));
  await page.route('**/api/v1/assessments/assessment/prepared-staging', route => route.fulfill({ status: 500 }));
  await page.goto('/tests/e2e/fixtures/prepared-admin.html', { waitUntil: 'domcontentloaded', timeout: 120_000 });
  await expect(page.getByRole('alert')).toContainText('تعذر تحميل');
  await expect(page.getByRole('button', { name: 'حفظ الإعدادات' })).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'إعادة المحاولة' })).toBeVisible();
});

test('يظهر اسم الطالب المحدد بعد إعادة فتح الإعدادات', async ({ page }) => {
  test.setTimeout(240_000);
  const reply = (body: unknown) => ({ status: 200, contentType: 'application/json', body: JSON.stringify(body) });
  await page.route('**/api/v1/assessments/prepared-groups', route => route.fulfill(reply({ groups: [] })));
  await page.route('**/api/v1/assessments/assessment/prepared-staging', route => route.fulfill(reply({ stage: { mode: 'saher', audienceType: 'targeted', userIds: ['student1'], groupIds: [] }, active: false, targetUsers: [{ id: 'student1', name: 'أحمد', email: 'student@example.invalid' }] })));
  await page.goto('/tests/e2e/fixtures/prepared-admin.html', { waitUntil: 'domcontentloaded', timeout: 120_000 });
  const selected = page.getByRole('button', { name: 'أحمد — student@example.invalid ×' });
  await expect(selected).toBeEnabled();
  await selected.click();
  await expect(selected).toHaveCount(0);
});

test('ينشئ المسؤول مجموعة ويضيف طالبًا ويحذفه منها', async ({ page }) => {
  test.setTimeout(240_000);
  const reply = (body: unknown) => ({ status: 200, contentType: 'application/json', body: JSON.stringify(body) });
  let created = false;
  let isMember = false;
  const group = () => ({ id: 'group1', name: 'طلاب ساهر', groupType: 'PRIVATE_GROUP', memberCount: isMember ? 1 : 0 });
  await page.route('**/api/v1/assessments/prepared-groups', route => {
    if (route.request().method() === 'POST') { created = true; return route.fulfill(reply({ group: group() })); }
    return route.fulfill(reply({ groups: created ? [group()] : [] }));
  });
  await page.route('**/api/v1/assessments/assessment/prepared-staging', route => route.fulfill({ status: 404 }));
  await page.route('**/api/v1/assessments/prepared-groups/group1/members', route => route.fulfill(reply({ userIds: isMember ? ['student1'] : [], members: isMember ? [{ id: 'student1', name: 'أحمد', email: 'student@example.invalid' }] : [] })));
  await page.route('**/api/v1/assessments/prepared-groups/group1/members/student1', route => {
    isMember = route.request().method() === 'PUT';
    expect(route.request().headers()['x-csrf-token']).toBe('csrf');
    return route.fulfill(reply({ ok: true }));
  });
  await page.route('**/api/v1/auth/admin/users?**', route => route.fulfill(reply({ users: [{ id: 'student1', name: 'أحمد', email: 'student@example.invalid' }], pagination: { page: 1, limit: 50, total: 1, totalPages: 1 } })));
  await page.goto('/tests/e2e/fixtures/prepared-admin.html', { waitUntil: 'domcontentloaded', timeout: 120_000 });
  await page.getByRole('button', { name: 'إدارة مجموعات الاختبارات' }).click();
  await page.getByLabel('اسم المجموعة الجديدة').fill('طلاب ساهر');
  await page.getByRole('button', { name: 'إنشاء', exact: true }).click();
  await expect(page.getByText('الأعضاء (0)')).toBeVisible();
  await page.getByLabel('البحث عن طالب للمجموعة').fill('أحمد');
  await page.getByRole('button', { name: 'بحث', exact: true }).click();
  await page.getByRole('button', { name: 'أحمد — student@example.invalid +' }).click();
  await expect(page.getByText('الأعضاء (1)')).toBeVisible();
  await page.getByRole('button', { name: 'أحمد — student@example.invalid ×' }).click();
  await expect(page.getByText('الأعضاء (0)')).toBeVisible();
});
