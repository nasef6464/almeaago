import { test, expect } from '@playwright/test';

test('visibility change keeps a published assessment and a valid save snapshot', async ({ page }) => {
  test.setTimeout(120_000);
  const version = {version:1,accessType:'free',title:'اختبار منشور',description:'',pathId:'path-1',subjectId:'subject-1',kind:'normal',normalMode:'practice',showExplanations:true,showAnswers:true,showResultsReport:true,returnToSourceOnFinish:false,maxAttempts:2,passingScore:60,timeLimitSeconds:null,randomizeQuestions:false,randomizeOptions:false,showProgressBar:true,requireAnswerBeforeNext:false,allowQuestionReview:true,optionLayout:'vertical',mockCategory:'',mockTargetScore:null,mockStrictSectionLock:null,mockPresentationMode:'',presentation:{},revisionNote:''};
  const detail = {id:'assessment-1',code:'A1',ownerType:'platform',ownerUserId:'',ownerSchoolId:'',assignedTeacherId:'',reviewerNotes:'',workflowStatus:'approved',revision:2,isPublished:true,isVisible:true,version,sections:[],questions:[]};
  let visibilityWrites=0, otherWrites=0;
  await page.route('**/api/v1/assessments/assessment-1', route => route.request().method() === 'GET' ? route.fulfill({json:{assessment:detail}}) : (otherWrites++, route.fulfill({status:500})));
  await page.route('**/api/v1/assessments/assessment-1/visibility', async route => {
    visibilityWrites++;
    expect(route.request().postDataJSON()).toEqual({expectedRevision:2,isVisible:false});
    await route.fulfill({json:{assessment:{...detail,revision:3,isVisible:false}}});
  });
  await page.route('**/api/v1/questions?*', route => route.fulfill({json:{items:[],page:1,limit:50,hasMore:false}}));
  await page.goto('/tests/e2e/fixtures/assessment-save-workflow.html?id=assessment-1', {waitUntil:'domcontentloaded'});
  await page.getByRole('navigation',{name:'أقسام منشئ الاختبارات'}).getByRole('button',{name:'الصلاحيات والنشر'}).click();
  await page.getByLabel('إظهار الاختبار للطلاب').click();
  await expect(page.getByText('تم إخفاء الاختبار عن الطلاب.')).toBeVisible();
  await page.getByRole('button',{name:'حفظ الاختبار',exact:true}).click();
  await expect(page.getByText('تم التسليم للقائمة')).toBeVisible();
  expect(visibilityWrites).toBe(1);
  expect(otherWrites).toBe(0);
});

