import { expect, test } from '@playwright/test';

const question = { id: 'q1', questionCode: 'Q-1', currentVersion: 1, pathId: 'path-1', subjectId: 'subject-1', workflowStatus: 'approved', type: 'mcq', text: 'سؤال تجريبي', imageAssetId: '', difficulty: 'Easy' };
const pageResult = { items: [question], page: 1, limit: 100, hasMore: false };

async function openMockBuilder(page: import('@playwright/test').Page) {
  await page.route('**/api/v1/questions?**', route => route.fulfill({ json: pageResult }));
  await page.goto('/tests/e2e/fixtures/assessment-save-workflow.html', { waitUntil: 'domcontentloaded' });
  const nav = page.getByRole('navigation', { name: 'أقسام منشئ الاختبارات' });
  await page.getByRole('button', { name: 'محاكي قياس رسمي (أقسام ومؤقت)' }).click();
  await nav.getByRole('button', { name: 'الأقسام والمؤقت', exact: true }).click();
  await page.getByRole('button', { name: 'إضافة قسم مخصص' }).click();
  await nav.getByRole('button', { name: 'الأسئلة', exact: true }).click();
  await page.getByLabel('مادة البحث في بنك الأسئلة').selectOption('subject-1');
  await expect(page.getByRole('button', { name: 'إضافة السؤال Q-1' })).toBeVisible();
  return nav;
}

test('deleting the target section cancels an in-flight generation', async ({ page }) => {
  const nav = await openMockBuilder(page);
  let release!: () => void;
  let requested!: () => void;
  const requestStarted = new Promise<void>(resolve => { requested = resolve; });
  const paused = new Promise<void>(resolve => { release = resolve; });
  await page.route('**/api/v1/questions?**', async route => { requested(); await paused; await route.fulfill({ json: pageResult }).catch(() => {}); });
  await page.getByRole('button', { name: 'التوليد التلقائي للأسئلة من البنك' }).click();
  await page.getByText('تعيين للقسم').locator('..').locator('select').selectOption({ label: 'القسم 1' });
  await page.getByRole('button', { name: 'بدء التوليد والإضافة الآن' }).click();
  await requestStarted;
  await nav.getByRole('button', { name: 'الأقسام والمؤقت', exact: true }).click();
  await page.getByRole('button', { name: 'حذف القسم 1' }).click();
  release();
  await nav.getByRole('button', { name: 'الأسئلة', exact: true }).click();
  await expect(page.getByText('لم تتم إضافة أسئلة للاختبار بعد.', { exact: false })).toBeVisible();
});

test('template replacement does not orphan assigned questions', async ({ page }) => {
  const nav = await openMockBuilder(page);
  await page.getByRole('button', { name: 'إضافة السؤال Q-1' }).click();
  await page.getByLabel('قسم السؤال 1').selectOption({ label: 'القسم 1' });
  await nav.getByRole('button', { name: 'الأقسام والمؤقت', exact: true }).click();
  await page.getByRole('button', { name: 'توليد أقسام محاكي التحصيلي (4 أقسام)' }).click();
  await expect(page.getByPlaceholder('عنوان القسم...')).toHaveCount(1);
  await expect(page.getByText('انقل الأسئلة المرتبطة بالأقسام أو احذفها قبل استبدال الأقسام.')).toBeVisible();
  await nav.getByRole('button', { name: 'الأسئلة', exact: true }).click();
  await expect(page.getByLabel('قسم السؤال 1')).toHaveValue(await page.getByLabel('قسم السؤال 1').locator('option', { hasText: 'القسم 1' }).getAttribute('value') || '');
});
