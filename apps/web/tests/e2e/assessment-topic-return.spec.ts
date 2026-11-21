import { expect, test } from '@playwright/test';
const returnTo='/category/path-1?subject=subject-1&tab=skills&topic=topic-main&content=quizzes';
const attempt={id:'a1',assessmentId:'assessment-1',assessmentVersion:1,attemptNumber:1,status:'in_progress',title:'تدريب النسب',startedAt:'2026-01-01T00:00:00Z',expiresAt:null,submittedAt:null,showProgressBar:true,requireAnswerBeforeNext:false,allowQuestionReview:true,randomizeOptions:false,questions:[{id:'q1',version:1,sectionId:'',sortOrder:0,points:1,type:'mcq',text:'كم؟',imageAssetId:'',imageAlt:'',optionsEmbeddedInImage:false,videoUrl:'',difficulty:'easy',options:[{index:0,text:'واحد',assetId:''}]}],answers:[]};
test.beforeEach(async ({page})=>{
 await page.route('**/api/v1/auth/me',r=>r.fulfill({json:{user:{id:'student-1',name:'طالب',roles:['student'],status:'active'}}}));
 await page.route('**/api/v1/auth/csrf',r=>r.fulfill({json:{csrfToken:'csrf'}}));
 await page.route('**/api/v1/assessment-attempts/a1',r=>r.fulfill({json:{attempt}}));
 await page.route('**/api/v1/assessment-attempts/a1/questions/q1/time',r=>r.fulfill({json:{timeSpentSeconds:r.request().postDataJSON().timeSpentSeconds}}));
 await page.route('**/api/v1/assessment-attempts/a1/submit',r=>r.fulfill({json:{result:{attemptId:'a1',score:0,correctAnswers:0,wrongAnswers:0,unanswered:1}}}));
 await page.route('**/api/v1/assessment-attempts/a1/review',r=>r.fulfill({json:{detail:{result:{attemptId:'a1',finalizedAt:'2026-01-01T00:00:00Z'},assessmentId:'assessment-1',assessmentVersion:1,title:'تدريب النسب',attemptNumber:1,allowQuestionReview:false,showAnswers:false,showExplanations:false,showResultsReport:false}}}));
});
test('returns to the topic while taking an attempt and after submission',async({page})=>{
 await page.goto(`/assessment-attempts/a1?${new URLSearchParams({returnTo})}`);
 const link=page.getByRole('link',{name:'العودة لموضوع التأسيس',exact:true});
 await expect(link).toHaveAttribute('href',returnTo);
 await page.waitForTimeout(1200); // Exercise the elapsed-time save before submission.
 await page.getByRole('button',{name:'إنهاء وتسليم الاختبار',exact:true}).click();
 await page.getByRole('button',{name:'نعم، قم بالتسليم'}).click();
 await expect(page.getByRole('heading',{name:'تم تسليم الاختبار'})).toBeVisible();
 await expect(page.getByRole('link',{name:'العودة لموضوع التأسيس',exact:true})).toHaveAttribute('href',returnTo);
});
for (const [destination,label] of [
 ['/learning/courses/course-1?lesson=lesson-1','العودة إلى الدرس'],
 ['/course/course-1?tab=tests','العودة إلى الدورة'],
] as const) {
 test(`return label follows destination: ${label}`,async({page})=>{
  await page.goto(`/assessment-attempts/a1?${new URLSearchParams({returnTo:destination})}`);
  await expect(page.getByRole('link',{name:label,exact:true})).toHaveAttribute('href',destination);
  await page.getByRole('button',{name:'إنهاء وتسليم الاختبار',exact:true}).click();
  await page.getByRole('button',{name:'نعم، قم بالتسليم'}).click();
  await expect(page.getByRole('heading',{name:'تم تسليم الاختبار'})).toBeVisible();
  await expect(page.getByRole('link',{name:label,exact:true})).toHaveAttribute('href',destination);
 });
}
test('review preserves the course lesson return path after submission',async({page})=>{
 const destination='/learning/courses/course-1?lesson=lesson-1';
 await page.goto(`/assessment-attempts/a1?${new URLSearchParams({returnTo:destination})}`);
 await page.getByRole('button',{name:'إنهاء وتسليم الاختبار',exact:true}).click();
 await page.getByRole('button',{name:'نعم، قم بالتسليم'}).click();
 await page.getByRole('link',{name:'عرض النتيجة والمراجعة'}).click();
 await expect(page.getByRole('heading',{name:'تدريب النسب'})).toBeVisible();
 await expect(page.getByRole('link',{name:'العودة إلى الدرس',exact:true})).toHaveAttribute('href',destination);
});
test('review rejects an unsafe return path',async({page})=>{
 await page.goto(`/assessment-results/a1?${new URLSearchParams({returnTo:'//evil.example'})}`);
 await expect(page.getByRole('heading',{name:'تدريب النسب'})).toBeVisible();
 await expect(page.getByRole('link',{name:/العودة إلى الدرس|العودة إلى الدورة|العودة لموضوع التأسيس/})).toHaveCount(0);
});
for (const unsafe of ['//evil.example','/\\evil.example','/%2f%2fevil.example','/path%0aevil']) {
 test(`unsafe return destination is not rendered: ${unsafe}`,async({page})=>{
  await page.goto(`/assessment-attempts/a1?${new URLSearchParams({returnTo:unsafe})}`);
  await expect(page.getByRole('heading',{name:'تدريب النسب'})).toBeVisible();
  await expect(page.getByRole('link',{name:'العودة لموضوع التأسيس'})).toHaveCount(0);
 });
}
