import {expect, test, type Page} from '@playwright/test';

const user={id:'image-student',name:'طالب',email:'student@example.invalid',role:'student',roles:['student'],status:'active'};
const imageQuestion={id:'q1',version:1,sectionId:'',sortOrder:0,points:1,type:'mcq',text:'نص مخصص للذكاء الاصطناعي',passage:'قطعة مخصصة للذكاء الاصطناعي',imageAssetId:'',imageUrl:'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" width="80" height="80"/%3E',imageAlt:'صورة السؤال',optionsEmbeddedInImage:false,learnerPresentation:{optionLabelStyle:'latin',showOptionText:true,showOptionLabels:false},options:[{index:0,text:'نص اختيار سري',assetId:''},{index:1,text:'نص اختيار آخر',assetId:''}]};
const result={attemptId:'attempt-1',score:100,totalQuestions:1,correctAnswers:1,wrongAnswers:0,unanswered:0,passed:true,timeSpentSeconds:1,finalizedAt:'2026-11-13T00:00:00Z'};
async function auth(page:Page){
  await page.route('**/api/v1/auth/me',r=>r.fulfill({json:{user}}));
  await page.route('**/api/v1/auth/csrf',r=>r.fulfill({json:{csrfToken:'test-csrf'}}));
}
async function noHiddenText(page:Page){
  await expect(page.getByText('نص مخصص للذكاء الاصطناعي')).toHaveCount(0);
  await expect(page.getByText('قطعة مخصصة للذكاء الاصطناعي')).toHaveCount(0);
  await expect(page.getByText('نص اختيار سري')).toHaveCount(0);
  await expect(page.getByRole('img',{name:'صورة السؤال'})).toBeVisible();
}

test('image attempt displays image and labels only',async({page})=>{
  await auth(page);
  await page.route('**/api/v1/assessments/a1/attempts',r=>r.fulfill({json:{attempt:{id:'attempt-1',assessmentId:'a1',assessmentVersion:1,attemptNumber:1,status:'in_progress',title:'اختبار',startedAt:new Date().toISOString(),expiresAt:null,showProgressBar:true,allowQuestionReview:true,questions:[imageQuestion],answers:[]}}}));
  await page.goto('/assessments/a1/start',{waitUntil:'domcontentloaded'});
  await noHiddenText(page);
  await expect(page.getByRole('button',{name:'A',exact:true})).toBeVisible();
  await expect(page.getByRole('button',{name:'B',exact:true})).toBeVisible();
});

test('image review displays image and labels only',async({page})=>{
  await auth(page);
  await page.route('**/api/v1/assessment-attempts/attempt-1/review',r=>r.fulfill({json:{detail:{result,assessmentId:'a1',assessmentVersion:1,title:'اختبار',attemptNumber:1,allowQuestionReview:true,showAnswers:true,showExplanations:true,showResultsReport:true,questions:[{...imageQuestion,questionId:'q1',questionVersion:1,selectedOptionIndex:0,correctOptionIndex:0,answered:true,correct:true,markedForReview:false,timeSpentSeconds:1}]}}}));
  await page.goto('/assessment-results/attempt-1',{waitUntil:'domcontentloaded'});
  await noHiddenText(page);
  await expect(page.getByText('A',{exact:true})).toBeVisible();
  await expect(page.getByText('B',{exact:true})).toBeVisible();
});

test('public barcode displays image and labels only',async({page})=>{
  await page.route('**/api/v1/public-assessments/testcode/start',r=>r.fulfill({json:{attempt:{id:'public-1',title:'اختبار',attemptNumber:1,status:'in_progress',questions:[imageQuestion],optionLayout:'auto'}},status:201}));
  await page.goto('/barcode-test/testcode',{waitUntil:'domcontentloaded'});
  await noHiddenText(page);
  await expect(page.getByRole('button',{name:'A',exact:true})).toBeVisible();
  await expect(page.getByRole('button',{name:'B',exact:true})).toBeVisible();
});
