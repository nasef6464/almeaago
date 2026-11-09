import { expect, test } from '@playwright/test';

test('contact widget follows public settings', async ({ page }) => {
  await page.route('**/api/v1/content/public-contact-widget', route => route.fulfill({json: {enabled: true, channel: 'whatsapp', whatsappNumber: '+966511122233', whatsappMessage: 'أحتاج مساعدة', openInNewTab: false, showOnPublicPages: true, showOnDashboardPages: false}}));
  await page.goto('/tests/e2e/fixtures/contact-widget/', {waitUntil: 'domcontentloaded'});
  const link = page.getByRole('link', {name: 'تواصل معنا عبر واتساب'});
  await expect(link).toHaveAttribute('href', /wa\.me\/966511122233\?/);
  await expect(link).toHaveAttribute('target', '_self');
});

test('disabled contact widget stays hidden', async ({ page }) => {
  await page.route('**/api/v1/content/public-contact-widget', route => route.fulfill({json: {enabled: false, channel: 'whatsapp', whatsappNumber: '+966511122233', whatsappMessage: '', openInNewTab: true, showOnPublicPages: true, showOnDashboardPages: true}}));
  const response = page.waitForResponse('**/api/v1/content/public-contact-widget');
  await page.goto('/tests/e2e/fixtures/contact-widget/', {waitUntil: 'domcontentloaded'});
  await response;
  await expect(page.getByRole('link', {name: 'تواصل معنا عبر واتساب'})).toHaveCount(0);
});




test('dashboard visibility can be disabled without hiding public contact', async ({ page }) => {
  await page.route('**/api/v1/content/public-contact-widget', route => route.fulfill({json: {enabled: true, channel: 'whatsapp', whatsappNumber: '+966511122233', whatsappMessage: '', openInNewTab: true, showOnPublicPages: true, showOnDashboardPages: false}}));
  await page.goto('/tests/e2e/fixtures/contact-widget/', {waitUntil: 'domcontentloaded'});
  const link = page.getByRole('link', {name: 'تواصل معنا عبر واتساب'});
  await expect(link).toBeVisible();
  await page.evaluate(() => { history.pushState({}, '', '/student-dashboard'); window.dispatchEvent(new PopStateEvent('popstate')); });
  await expect(link).toHaveCount(0);
  await page.evaluate(() => { history.pushState({}, '', '/category/example'); window.dispatchEvent(new PopStateEvent('popstate')); });
  await expect(link).toBeVisible();
});

test('does not show a fabricated contact when settings cannot be loaded', async ({ page }) => {
  await page.route('**/api/v1/content/public-contact-widget', route => route.fulfill({status: 503, body: 'unavailable'}));
  const response = page.waitForResponse('**/api/v1/content/public-contact-widget');
  await page.goto('/tests/e2e/fixtures/contact-widget/', {waitUntil: 'domcontentloaded'});
  await response;
  await expect(page.getByRole('link', {name: 'تواصل معنا عبر واتساب'})).toHaveCount(0);
});
