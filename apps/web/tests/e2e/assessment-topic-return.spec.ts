import { expect, test } from '@playwright/test';
const returnTo='/category/path-1?subject=subject-1&tab=skills&topic=topic-main&content=quizzes';
const attempt={id:'a1',assessmentId:'assessment-1',assessmentVersion:1,attemptNumber:1,status:'in_progress',title:'تدريب النسب',startedAt:'2026-01-01T00:00:00Z',expiresAt:null,submittedAt:null,showProgressBar:true,requireAnswerBeforeNext:false,allowQuestionReview:true,randomizeOptions:false,questions:[{id:'q1',version:1,sectionId:'',sortOrder:0,points:1,type:'mcq',text:'كم؟',imageAssetId:'',imageAlt:'',optionsEmbeddedInImage:false,videoUrl:'',difficulty:'easy',options:[{index:0,text:'واحد',assetId:''}]}],answers:[]};
test.beforeEach(async ({page})=>{
 await page.route('**/api/v1/auth/me',r=>r.fulfill({json:{user:{id:'student-1',name:'طالب',roles:['student'],status:'active'}}}));
 await page.route('**/api/v1/auth/csrf',r=>r.fulfill({json:{csrfToken:'csrf'}}));
 await page.route('**/api/v1/assessment-attempts/a1',r=>r.fulfill({json:{attempt}}));
 await page.route('**/api/v1/assessment-attempts/a1/submit',r=>r.fulfill({json:{result:{attemptId:'a1',score:0,correctAnswers:0,wrongAnswers:0,unanswered:1}}}));
});
test('returns to the topic while taking an attempt and after submission',async({page})=>{
 await page.goto(`/assessment-attempts/a1?${new URLSearchParams({returnTo})}`);
 const link=page.getByRole('link',{name:'العودة لموضوع التأسيس',exact:true});
 await expect(link).toHaveAttribute('href',returnTo);
 await page.getByRole('button',{name:'تسليم الاختبار',exact:true}).click();
 await expect(page.getByRole('heading',{name:'تم تسليم الاختبار'})).toBeVisible();
 await expect(page.getByRole('link',{name:'العودة لموضوع التأسيس',exact:true})).toHaveAttribute('href',returnTo);
});
for (const unsafe of ['//evil.example','/\\evil.example','/%2f%2fevil.example','/path%0aevil']) {
 test(`unsafe return destination is not rendered: ${unsafe}`,async({page})=>{
  await page.goto(`/assessment-attempts/a1?${new URLSearchParams({returnTo:unsafe})}`);
  await expect(page.getByRole('heading',{name:'تدريب النسب'})).toBeVisible();
  await expect(page.getByRole('link',{name:'العودة لموضوع التأسيس'})).toHaveCount(0);
 });
}
