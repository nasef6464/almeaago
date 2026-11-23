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
  await page.getByRole('button', { name: /^مراجعة الأسئلة/ }).click();
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

test('public barcode respects question numbering and legacy image labels',async({page})=>{
  const hidden={...imageQuestion,id:'hidden',learnerPresentation:{...imageQuestion.learnerPresentation,showQuestionNumber:false,questionNumber:'999'}};
  const numbered={...imageQuestion,id:'numbered',learnerPresentation:{...imageQuestion.learnerPresentation,showQuestionNumber:true,questionNumber:'42'}};
  const legacy={...imageQuestion,id:'legacy',learnerPresentation:undefined,options:[{index:0,text:'A',assetId:''},{index:1,text:'',assetId:''}]};
  await page.route('**/api/v1/public-assessments/numbered/start',r=>r.fulfill({json:{attempt:{id:'public-1',title:'اختبار',attemptNumber:1,status:'in_progress',questions:[hidden,numbered,legacy],optionLayout:'auto'}},status:201}));
  await page.goto('/barcode-test/numbered',{waitUntil:'domcontentloaded'});
  const cards=page.locator('article');
  await expect(cards).toHaveCount(3);
  await expect(cards.nth(0).locator('h2')).toHaveCount(0);
  await expect(cards.nth(0).getByText('999',{exact:true})).toHaveCount(0);
  await expect(cards.nth(1).locator('h2')).toHaveText('42.');
  await expect(cards.nth(2).getByRole('button',{name:'A',exact:true})).toBeVisible();
  await expect(cards.nth(2).getByRole('button',{name:'B',exact:true})).toBeVisible();
  await expect(page.getByText('نص مخصص للذكاء الاصطناعي')).toHaveCount(0);
  await expect(page.getByText('نص اختيار سري')).toHaveCount(0);
  await expect(page.getByRole('img',{name:'صورة السؤال'})).toHaveCount(3);
});

test('review labels follow shuffled display order while answer identity stays unchanged',async({page})=>{
  await auth(page);
  const question={...imageQuestion,imageUrl:'',imageAssetId:'',text:'سؤال نصي',passage:'',learnerPresentation:{optionLabelStyle:'latin',showOptionText:true,showOptionLabels:true},options:[{index:1,text:'الخيار الثاني',assetId:''},{index:0,text:'الخيار الأول',assetId:''}],questionId:'q1',questionVersion:1,selectedOptionIndex:1,correctOptionIndex:0,answered:true,correct:false,markedForReview:false,timeSpentSeconds:1};
  await page.route('**/api/v1/assessment-attempts/attempt-1/review',r=>r.fulfill({json:{detail:{result,assessmentId:'a1',assessmentVersion:1,title:'اختبار',attemptNumber:1,allowQuestionReview:true,showAnswers:true,showExplanations:true,showResultsReport:true,questions:[question]}}}));
  await page.goto('/assessment-results/attempt-1',{waitUntil:'domcontentloaded'});
  await page.getByRole('button', { name: /^مراجعة الأسئلة/ }).click();
  await expect(page.locator('div').filter({hasText:/^A\s*الخيار الثاني\s*اختيارك$/}).last()).toBeVisible();
  await expect(page.locator('div').filter({hasText:/^B\s*الخيار الأول\s*الإجابة الصحيحة$/}).last()).toBeVisible();
});

test('attempt uses custom question number',async({page})=>{
  await auth(page);
  const question={...imageQuestion,imageUrl:'',text:'سؤال خاص',learnerPresentation:{showQuestionNumber:true,questionNumber:'42'}};
  await page.route('**/api/v1/assessments/a1/attempts',r=>r.fulfill({json:{attempt:{id:'attempt-1',assessmentId:'a1',assessmentVersion:1,attemptNumber:1,status:'in_progress',title:'اختبار',startedAt:new Date().toISOString(),expiresAt:null,questions:[question],answers:[]}}}));
  await page.goto('/assessments/a1/start',{waitUntil:'domcontentloaded'});
  await expect(page.getByText('السؤال 42 من 1')).toBeVisible();
});

test('filtered review preserves displayed order after question shuffling',async({page})=>{
  await auth(page);
  const q=(id:string,sortOrder:number,correct:boolean,presentation?:object)=>({...imageQuestion,id,questionId:id,questionVersion:1,imageUrl:'',text:`نص ${id}`,passage:'',sortOrder,learnerPresentation:presentation,selectedOptionIndex:0,correctOptionIndex:0,answered:true,correct,markedForReview:false,timeSpentSeconds:1});
  const questions=[q('first',8,true),q('second',1,false),q('third',0,false,{showQuestionNumber:false})];
  await page.route('**/api/v1/assessment-attempts/attempt-1/review',r=>r.fulfill({json:{detail:{result,assessmentId:'a1',assessmentVersion:1,title:'اختبار',attemptNumber:1,allowQuestionReview:true,showAnswers:true,showExplanations:true,showResultsReport:true,questions}}}));
  await page.goto('/assessment-results/attempt-1',{waitUntil:'domcontentloaded'});
  await page.getByRole('button', { name: /^مراجعة الأسئلة/ }).click();
  await page.getByRole('button',{name:'أخطأت فيها'}).click();
  const second=page.getByText('نص second').locator('xpath=ancestor::article');
  await expect(second).toContainText('سؤال 2');
  const third=page.getByText('نص third').locator('xpath=ancestor::article');
  await expect(third).not.toContainText('سؤال 3');
});
