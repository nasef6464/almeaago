import { expect,test } from '@playwright/test';

test('administrator saves and removes only a section from the same subject',async({page})=>{
  let stored='';
  await page.route('**/api/v1/questions/question1/section',route=>{
    if(route.request().method()==='PUT') {expect(route.request().headers()['x-csrf-token']).toBe('csrf');stored=route.request().postDataJSON().sectionId;}
    return route.fulfill({json:{sectionId:stored}});
  });
  await page.goto('/tests/e2e/fixtures/question-section.html',{waitUntil:'domcontentloaded'});
  const select=page.getByLabel('قسم السؤال');
  await expect(select).toBeEnabled();
  await expect(select.locator('option')).toHaveCount(2);
  await select.selectOption('section1');
  await page.getByRole('button',{name:'حفظ قسم السؤال'}).click();
  await expect(page.getByRole('status')).toContainText('حُفظ');
  expect(stored).toBe('section1');
  await page.reload({waitUntil:'domcontentloaded'});
  await expect(select).toHaveValue('section1');
  await select.selectOption('');
  await page.getByRole('button',{name:'حفظ قسم السؤال'}).click();
  await expect.poll(()=>stored).toBe('');
});

test('failed load prevents changes and can be retried',async({page})=>{
  let fail=true;
  await page.route('**/api/v1/questions/question1/section',route=>fail?route.fulfill({status:503,json:{message:'تعذر التحميل'}}):route.fulfill({json:{sectionId:''}}));
  await page.goto('/tests/e2e/fixtures/question-section.html',{waitUntil:'domcontentloaded'});
  await expect(page.getByRole('alert')).toContainText('تعذر تحميل');
  await expect(page.getByLabel('قسم السؤال')).toBeDisabled();
  fail=false;
  await page.getByRole('button',{name:'إعادة التحميل'}).click();
  await expect(page.getByLabel('قسم السؤال')).toBeEnabled();
});
