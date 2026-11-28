import { expect, test } from '@playwright/test';

test('a certificate can be printed only after the matching code is verified', async ({page}) => {
  await page.route('**/api/v1/learning-progress/certificates/*', async route => {
    const code = route.request().url().split('/').at(-1);
    if (code === 'unavailable') return route.fulfill({status:503,json:{message:'upstream unavailable'}});
    if (code === 'unknown') return route.fulfill({status:404,json:{message:'Not found'}});
    return route.fulfill({json:{certificate:{
      verificationCode:'verified',courseName:'دورة القدرات',studentName:'طالب تجريبي',
      completionPercentage:100,issuedAt:'2026-11-01T12:00:00Z',
    }}});
  });

  await page.goto('/certificate/verified');
  await expect(page.getByRole('heading',{name:'طالب تجريبي'})).toBeVisible();
  await expect(page.getByRole('button',{name:'طباعة الشهادة الرسمية'})).toBeVisible();
  await page.evaluate(() => {
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: {writeText: () => Promise.reject(new Error('denied'))},
    });
  });
  await page.getByRole('button',{name:'نسخ رابط التحقق'}).click();
  await expect(page.getByText('تعذر نسخ الرابط.', {exact:false})).toBeVisible();

  await page.evaluate(() => {
    history.pushState(null, '', '/certificate/unknown');
    window.dispatchEvent(new PopStateEvent('popstate'));
  });
  await expect(page.getByRole('alert')).toContainText('لم يتم العثور على شهادة');
  await expect(page.getByRole('button',{name:'طباعة الشهادة الرسمية'})).toHaveCount(0);

  await page.goto('/verify/cert/unavailable');
  await expect(page.getByRole('alert')).toContainText('تعذر التحقق');
  await expect(page.getByRole('button',{name:'طباعة الشهادة الرسمية'})).toHaveCount(0);

  await page.goto('/verify/mismatch');
  await expect(page.getByRole('alert')).toContainText('تعذر التحقق');
  await expect(page.getByRole('button',{name:'طباعة الشهادة الرسمية'})).toHaveCount(0);
});
