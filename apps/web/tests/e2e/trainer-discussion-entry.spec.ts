import { expect, test } from '@playwright/test';

test('trainer dashboard points to real course management and labels demo data', async ({page}) => {
  await page.route(url => url.pathname.startsWith('/api/'), route => {
    const path = new URL(route.request().url()).pathname;
    if (path === '/api/v1/auth/me') return route.fulfill({json:{user:{id:'teacher-1',name:'مدرب تجريبي',email:'teacher@example.invalid',roles:['teacher'],role:'teacher'}}});
    if (path === '/api/v1/taxonomy/bootstrap') return route.fulfill({json:{paths:[],subjects:[],levels:[],skills:[]}});
    return route.fulfill({json:{items:[],ads:[],announcements:[],hasMore:false}});
  });
  await page.goto('/trainer-dashboard',{waitUntil:'domcontentloaded'});
  await expect(page.getByRole('heading',{name:/لوحة مدرب المنصة/})).toContainText('مدرب تجريبي');
  await expect(page.getByRole('status')).toContainText('تجريبية حاليًا');
  await page.getByRole('link',{name:'إدارة الدورات ومناقشات الدروس'}).click();
  await expect(page).toHaveURL(/\/admin-dashboard\/content\?tab=courses/);
  await expect(page.getByRole('heading',{name:'إدارة المحتوى التعليمي'})).toBeVisible();
});
