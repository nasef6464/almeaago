import { expect, test } from '@playwright/test';

test('a question without an approved explanation never shows an unrelated example as its solution', async ({ page }) => {
  await page.goto('/tests/e2e/fixtures/empty-solution.html');
  await expect(page.getByText('لا يوجد شرح أو استراتيجية حل معتمدة لهذا السؤال حتى الآن.')).toBeVisible();
  await expect(page.getByText('2x + 10 = 30')).toHaveCount(0);
  await expect(page.getByText('سؤال بلا شرح')).toBeVisible();
});
