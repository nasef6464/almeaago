import { expect, test } from '@playwright/test';

for (const showExplanations of [false, true]) {
  test(`review ${showExplanations ? 'shows' : 'hides'} the configured solution video`, async ({page}) => {
    await page.route('**/api/v1/auth/me', r => r.fulfill({json:{user:{id:'student',name:'طالب',email:'student@example.invalid',roles:['student'],role:'student'}}}));
    await page.route('**/api/v1/auth/csrf', r => r.fulfill({json:{csrfToken:'csrf'}}));
    await page.route('**/api/v1/assessment-attempts/attempt/review', r => r.fulfill({json:{detail:{
      result:{attemptId:'attempt',score:100,totalQuestions:1,correctAnswers:1,wrongAnswers:0,unanswered:0,passed:true,timeSpentSeconds:1,finalizedAt:'2026-11-01T00:00:00Z'},
      assessmentId:'a',assessmentVersion:1,title:'اختبار',attemptNumber:1,allowQuestionReview:true,showAnswers:true,showExplanations,showResultsReport:true,
      questions:[{questionId:'q',questionVersion:1,sectionId:'',sortOrder:0,points:1,type:'mcq',text:'السؤال',imageAssetId:'',imageAlt:'',optionsEmbeddedInImage:false,videoUrl:'https://example.invalid/solution',options:[{index:0,text:'نعم',assetId:''}],selectedOptionIndex:0,correctOptionIndex:0,answered:true,correct:true,markedForReview:false,timeSpentSeconds:1}],
    }}}));
    await page.goto('/assessment-results/attempt',{waitUntil:'domcontentloaded'});
    await expect(page.getByText('السؤال',{exact:true})).toBeVisible();
    if (showExplanations) await expect(page.getByRole('link',{name:'شاهد فيديو الشرح'})).toBeVisible();
    else await expect(page.getByRole('link',{name:'شاهد فيديو الشرح'})).toHaveCount(0);
  });
}
