import { expect, test } from '@playwright/test';

test('question markup is sanitized while formatting and blanks remain visible', async ({page}) => {
  await page.route('**/api/v1/auth/me', r => r.fulfill({json:{user:{id:'s1',name:'طالب',email:'s@example.invalid',role:'student',roles:['student'],status:'active'}}}));
  await page.route('**/api/v1/auth/csrf', r => r.fulfill({json:{csrfToken:'csrf'}}));
  await page.route('**/api/v1/assessments/a1/attempts', r => r.fulfill({json:{attempt:{id:'a',assessmentId:'a1',assessmentVersion:1,attemptNumber:1,status:'in_progress',title:'اختبار',startedAt:new Date().toISOString(),expiresAt:null,showProgressBar:true,allowQuestionReview:true,questions:[{id:'q',version:1,sectionId:'',sortOrder:0,points:1,type:'mcq',text:'<strong>اختر</strong> .... <svg onload="window.questionAttack=1"></svg><a href="javascript:window.questionAttack=2">الرابط</a>',imageAssetId:'',imageUrl:'',imageAlt:'',optionsEmbeddedInImage:false,passage:'',options:[{index:0,text:'نعم',assetId:''},{index:1,text:'لا',assetId:''}]}],answers:[]}}}));
  await page.goto('/assessments/a1/start',{waitUntil:'domcontentloaded'});
  await expect(page.locator('h2 strong')).toHaveText('اختر');
  await expect(page.locator('h2 .question-blank')).toHaveText('....');
  await expect(page.locator('h2 svg[onload], h2 a[href^="javascript:"]')).toHaveCount(0);
  expect(await page.evaluate(() => (window as any).questionAttack)).toBeUndefined();
});

test('shared rich question rendering removes executable markup and keeps math', async ({page}) => {
  await page.goto('/tests/e2e/fixtures/question-html-safety.html',{waitUntil:'domcontentloaded'});
  const result=page.getByTestId('normalized');
  await expect(result.locator('strong')).toHaveText('سؤال');
  await expect(result.locator('.question-blank')).toBeVisible();
  await expect(result.locator('.katex')).toHaveCount(1);
  await expect(result.locator('svg[onload], a[href^="javascript:"]')).toHaveCount(0);
  expect(await page.evaluate(() => (window as any).sharedAttack)).toBeUndefined();
});
