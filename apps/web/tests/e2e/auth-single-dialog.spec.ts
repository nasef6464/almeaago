import { expect, test, type Page } from '@playwright/test';

// This suite exercises modal ownership only. All API traffic is synthetic and
// every external request is blocked; no identity provider or real data is used.
async function guest(page: Page) {
  const externalRequests: string[] = [];
  await page.route('**/*', async route => {
    const url = new URL(route.request().url());
    if (url.origin !== 'http://127.0.0.1:4173') {
      externalRequests.push(url.href);
      return route.abort('blockedbyclient');
    }
    if (!url.pathname.startsWith('/api/')) return route.continue();
    if (url.pathname === '/api/v1/auth/me') {
      return route.fulfill({ status: 401, json: { error: { message: 'unauthenticated' } } });
    }
    if (url.pathname === '/api/v1/taxonomy/bootstrap') {
      return route.fulfill({ json: { paths: [], levels: [], subjects: [], skills: [] } });
    }
    if (url.pathname === '/api/v1/content/homepage-settings') {
      return route.fulfill({ json: {
        hero: { primaryCtaLabel: 'ابدأ الحساب من الرئيسية', primaryCtaLink: '/?auth=signup' },
      } });
    }
    if (url.pathname === '/api/v1/content/platform-font-settings') {
      return route.fulfill({ json: {} });
    }
    if (url.pathname.startsWith('/api/v1/auth/')) {
      return route.fulfill({ status: 403, json: { error: { message: 'No authentication requests expected in this suite' } } });
    }
    return route.fulfill({ json: { items: [], articles: [], ads: [], announcements: [], hasMore: false } });
  });
  return externalRequests;
}

async function singleDialog(page: Page, title: 'تسجيل الدخول' | 'إنشاء حساب جديد') {
  await expect(page.getByRole('dialog')).toHaveCount(1);
  const dialog = page.getByRole('dialog');
  await expect(dialog).toBeVisible();
  await expect(dialog.getByRole('heading', { name: title, exact: true })).toBeVisible();
  if (title === 'تسجيل الدخول') await expect(page.locator('#smart-login-input')).toHaveCount(1);
  return dialog;
}

async function closeAndConsumeRoute(page: Page, destination = '/') {
  await page.getByRole('dialog').getByRole('button', { name: 'إغلاق النافذة', exact: true }).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await expect(page).toHaveURL('http://127.0.0.1:4173' + destination);
  // Dispatching a browser navigation notification exercises a subsequent router
  // render without adding a new auth intent or using arbitrary sleep delays.
  await page.evaluate(() => window.dispatchEvent(new PopStateEvent('popstate', { state: history.state })));
  await expect(page.getByRole('dialog')).toHaveCount(0);
}

for (const width of [390, 820, 1440]) {
  test(`login route opens exactly one dialog and stays closed after dismissal at ${width}px`, async ({ page }) => {
    await guest(page);
    await page.setViewportSize({ width, height: 1000 });
    await page.goto('/login');
    await singleDialog(page, 'تسجيل الدخول');
    await closeAndConsumeRoute(page);
  });
}

test('signup route owns one dialog and switches to the original login form', async ({ page }) => {
  await guest(page);
  await page.setViewportSize({ width: 820, height: 1000 });
  await page.goto('/signup');
  const dialog = await singleDialog(page, 'إنشاء حساب جديد');
  await expect(page.locator('#signup-form')).toHaveCount(1);
  await dialog.getByRole('button', { name: /لديك حساب بالفعل.*تسجيل الدخول/ }).click();
  await singleDialog(page, 'تسجيل الدخول');
  await closeAndConsumeRoute(page);
});

test('hidden admin header keeps one auth dialog and consumes only the auth query on close', async ({ page }) => {
  await guest(page);
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto('/admin-dashboard/questions?scope=keep&auth=login#return');
  await singleDialog(page, 'تسجيل الدخول');
  await closeAndConsumeRoute(page, '/admin-dashboard/questions?scope=keep#return');
});

test('public header and both explicit homepage auth actions reopen one dialog after close', async ({ page }) => {
  const externalRequests = await guest(page);
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto('/');
  await expect(page.getByRole('dialog')).toHaveCount(0);

  await page.locator('header').getByRole('button', { name: 'تسجيل الدخول', exact: true }).click();
  await singleDialog(page, 'تسجيل الدخول');
  await closeAndConsumeRoute(page);

  await page.getByRole('link', { name: 'ابدأ الحساب من الرئيسية', exact: true }).click();
  await singleDialog(page, 'إنشاء حساب جديد');
  await closeAndConsumeRoute(page);

  await page.getByRole('button', { name: 'ابدأ رحلة التفوق الآن', exact: true }).click();
  await singleDialog(page, 'إنشاء حساب جديد');
  await closeAndConsumeRoute(page);

  await page.locator('header').getByRole('button', { name: 'تسجيل الدخول', exact: true }).click();
  await singleDialog(page, 'تسجيل الدخول');
  expect(externalRequests.filter(url => /accounts\.google|oauth|whatsapp|api\.openai/.test(url))).toEqual([]);
});
