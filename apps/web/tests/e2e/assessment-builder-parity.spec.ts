import { expect, test } from '@playwright/test';

// A hermetic component check; the live Go/PostgreSQL publication journey is
// covered separately by prepared-quiz-live.spec.ts. Screenshots are evidence,
// not a pixel comparison with the legacy application.
test('mock assessment builder exposes sections, question selection and policies', async ({ page }, testInfo) => {
  await page.route('**/api/v1/questions?**', route => route.fulfill({json:{items:[],page:1,limit:100,hasMore:false}}));
  await page.goto('/tests/e2e/fixtures/assessment-save-workflow.html', {waitUntil:'domcontentloaded'});
  const nav=page.getByRole('navigation',{name:'أقسام منشئ الاختبارات'});
  await page.getByRole('button',{name:'محاكي قياس رسمي (أقسام ومؤقت)'}).click();
  await page.screenshot({path:testInfo.outputPath('builder-mode.png'),fullPage:true});
  await nav.getByRole('button',{name:'الأقسام والمؤقت',exact:true}).click();
  await page.getByRole('button',{name:'توليد أقسام محاكي التحصيلي (4 أقسام)'}).click();
  await expect(page.getByPlaceholder('عنوان القسم...')).toHaveCount(4);
  const titles=['القسم الأول — الرياضيات','القسم الثاني — الفيزياء','القسم الثالث — الكيمياء','القسم الرابع — الأحياء'];
  for (let i=0;i<titles.length;i++) await expect(page.getByPlaceholder('عنوان القسم...').nth(i)).toHaveValue(titles[i]);
  await page.screenshot({path:testInfo.outputPath('builder-sections.png'),fullPage:true});
  await nav.getByRole('button',{name:'الأسئلة',exact:true}).click();
  await page.getByRole('button',{name:'التوليد التلقائي للأسئلة من البنك'}).click();
  await expect(page.getByText('عدد الأسئلة المطلوب')).toBeVisible();
  await page.screenshot({path:testInfo.outputPath('builder-questions.png'),fullPage:true});
  await nav.getByRole('button',{name:'الإعدادات',exact:true}).click();
  for(const text of ['ترتيب عشوائي للأسئلة في كل محاولة','ترتيب عشوائي للخيارات','إظهار التفسيرات والشروحات','إظهار تقرير النتيجة والتفاصيل للطالب']) await expect(page.getByText(text,{exact:false})).toBeVisible();
  await page.screenshot({path:testInfo.outputPath('builder-settings.png'),fullPage:true});
});
