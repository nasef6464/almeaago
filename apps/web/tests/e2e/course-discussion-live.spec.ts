import { expect, test } from '@playwright/test';

test('purchased course lesson discussion survives reload', async ({page}) => {
  test.skip(process.env.DISCUSSION_LIVE !== '1', 'requires disposable Go and PostgreSQL fixture');
  test.setTimeout(180_000);
  const login = await page.request.post('/api/v1/auth/login', {data:{email:process.env.DISCUSSION_STUDENT_EMAIL!, password:process.env.DISCUSSION_PASSWORD!}});
  expect(login.status()).toBe(200);
  await page.goto(`/learning/courses/${process.env.DISCUSSION_COURSE_ID}?lesson=${process.env.DISCUSSION_LESSON_ID}`, {waitUntil:'domcontentloaded'});
  await page.getByRole('button',{name:'الملاحظات والنقاش'}).click();
  await expect(page.getByText('سؤال الدرس',{exact:true})).toBeVisible({timeout:60_000});
  await page.getByLabel('اكتب سؤالك أو مناقشتك').fill('رسالة اختبار محلية');
  await page.getByRole('button',{name:'إرسال',exact:true}).click();
  await expect(page.getByText('رسالة اختبار محلية',{exact:true})).toBeVisible();
  await page.reload({waitUntil:'domcontentloaded'});
  await page.getByRole('button',{name:'الملاحظات والنقاش'}).click();
  await expect(page.getByText('رسالة اختبار محلية',{exact:true})).toBeVisible({timeout:60_000});
  await page.screenshot({path:'test-results/course-discussion-live.png',fullPage:true});
});
