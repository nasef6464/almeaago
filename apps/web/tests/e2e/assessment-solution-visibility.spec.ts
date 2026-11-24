import { expect, test } from '@playwright/test';
import { reviewVideoFixture } from './fixtures/review-video';

for (const showExplanations of [false, true]) {
  test(`review ${showExplanations ? 'shows' : 'hides'} the configured solution video`, async ({page}) => {
    const clip = await reviewVideoFixture(page);
    let videoRequests = 0;
    await page.route('**/review-fixture.webm', r => { videoRequests++; return r.fulfill({ body: clip, contentType: 'video/webm' }); });
    await page.route('**/api/v1/auth/me', r => r.fulfill({json:{user:{id:'student',name:'طالب',email:'student@example.invalid',roles:['student'],role:'student'}}}));
    await page.route('**/api/v1/auth/csrf', r => r.fulfill({json:{csrfToken:'csrf'}}));
    await page.route('**/api/v1/assessment-attempts/attempt/review', r => r.fulfill({json:{detail:{
      result:{attemptId:'attempt',score:100,totalQuestions:1,correctAnswers:1,wrongAnswers:0,unanswered:0,passed:true,timeSpentSeconds:1,finalizedAt:'2026-11-01T00:00:00Z'},
      assessmentId:'a',assessmentVersion:1,title:'اختبار',attemptNumber:1,allowQuestionReview:true,showAnswers:true,showExplanations,showResultsReport:true,
      questions:[{questionId:'q',questionVersion:1,sectionId:'',sortOrder:0,points:1,type:'mcq',text:'السؤال',imageAssetId:'',imageAlt:'',optionsEmbeddedInImage:false,videoUrl:'/review-fixture.webm',options:[{index:0,text:'نعم',assetId:''}],selectedOptionIndex:0,correctOptionIndex:0,answered:true,correct:true,markedForReview:false,timeSpentSeconds:1}],
    }}}));
    await page.goto('/assessment-results/attempt',{waitUntil:'domcontentloaded'});
    await page.getByRole('button', { name: /^مراجعة الأسئلة/ }).click();
    await expect(page.getByText('السؤال',{exact:true})).toBeVisible();
    const play = page.getByRole('button', { name: 'تشغيل شرح الفيديو' });
    const dialog = page.getByRole('dialog', { name: 'شرح السؤال 1' });
    await expect(dialog).toHaveCount(0);
    expect(videoRequests).toBe(0);
    if (showExplanations) {
      await play.click();
      await expect(dialog).toBeVisible();
      await expect(dialog.locator('video')).toHaveCount(1);
      await expect.poll(() => videoRequests).toBeGreaterThan(0);
      const media = dialog.locator('video');
      await expect.poll(() => media.evaluate(video => (video as HTMLVideoElement).readyState)).toBeGreaterThanOrEqual(2);
      expect(await media.evaluate(video => (video as HTMLVideoElement).paused)).toBe(true);
      await dialog.getByRole('button', { name: 'Play', exact: true }).first().click();
      await expect.poll(() => media.evaluate(video => (video as HTMLVideoElement).currentTime)).toBeGreaterThan(0);
      await page.keyboard.press('Escape');
      await expect(dialog).toHaveCount(0);
      await expect(play).toBeFocused();
      await expect(page.getByText('السؤال', { exact: true })).toBeVisible();
    } else {
      await expect(play).toHaveCount(0);
      await page.getByRole('button', { name: 'إظهار الملاحظات' }).click();
      await expect(play).toHaveCount(0);
      expect(videoRequests).toBe(0);
    }
  });
}
