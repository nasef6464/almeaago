import{expect,test,type Page,type Route}from'@playwright/test';

const student={id:'student-1',email:'student@example.com',name:'طالب',status:'active',avatarUrl:'',emailVerified:true,role:'student',roles:['student']};

function json(route:Route,body:unknown,status=200){return route.fulfill({status,contentType:'application/json',body:JSON.stringify(body)})}

async function auth(page:Page){
 await page.route('**/api/v1/auth/me',route=>json(route,{user:student}));
 await page.route('**/api/v1/auth/csrf',route=>json(route,{csrfToken:'csrf-global'}));
}

test('student golden journey crosses content assessment result review remediation and mastery without leaking pre-submit answers',async({page})=>{
 await auth(page);
 await page.setViewportSize({width:390,height:844});

 await page.route('**/api/v1/taxonomy/bootstrap?phase=core',route=>json(route,{
  paths:[{id:'path-1',code:'QDR',name:'القدرات',slug:'abilities',description:'',sortOrder:1,status:'active'}],
  subjects:[{id:'subject-1',pathId:'path-1',code:'QNT',name:'الكمي',slug:'quant',sortOrder:1,status:'active'}],
 }));
 await page.route('**/api/v1/learning-spaces/path-1/subjects/subject-1?limit=50',route=>json(route,{
  pathId:'path-1',subjectId:'subject-1',
  courses:{items:[{id:'course-1',title:'دورة الكمي',description:'تدريب منظم',instructorName:'المدرب',durationMinutes:90,level:'متوسط',thumbnailAssetId:'',dripContentEnabled:false,certificateEnabled:false}],hasMore:false},
  foundation:{items:[{id:'topic-1',parentTopicId:'',title:'أساسيات النسب',description:'تأسيس قصير',sortOrder:1,isLocked:false}],hasMore:false},
  library:{items:[{id:'library-1',title:'ملف دعم النسب',description:'ملخص',type:'pdf',isLocked:false}],hasMore:false},
 }));

 const baseAttempt={id:'attempt-1',assessmentId:'assessment-1',assessmentVersion:2,attemptNumber:1,status:'in_progress',title:'اختبار كمي',startedAt:'2026-09-28T08:00:00Z',expiresAt:null,submittedAt:null,showProgressBar:true,requireAnswerBeforeNext:false,allowQuestionReview:true,randomizeOptions:false,questions:[{id:'q-1',version:3,sectionId:'',sortOrder:1,points:1,type:'mcq',text:'٢ + ٢ = ؟',imageAssetId:'',imageAlt:'',optionsEmbeddedInImage:false,videoUrl:'',difficulty:'easy',options:[{index:0,text:'٣',assetId:''},{index:1,text:'٤',assetId:''}]}],answers:[]};
 await page.route('**/api/v1/assessments/assessment-1/attempts',route=>json(route,{attempt:baseAttempt}));
 await page.route('**/api/v1/assessment-attempts/attempt-1/answers/q-1',route=>json(route,{attempt:{...baseAttempt,answers:[{questionId:'q-1',selectedOptionIndex:1,textAnswer:'',timeSpentSeconds:4,markedForReview:false,lastSavedAt:'2026-09-28T08:01:00Z'}]}}));
 let submitCalls=0;
 await page.route('**/api/v1/assessment-attempts/attempt-1/submit',route=>{
  submitCalls++;
  return json(route,{result:{attemptId:'attempt-1',score:100,totalQuestions:1,correctAnswers:1,wrongAnswers:0,unanswered:0,passed:true,timeSpentSeconds:12,finalizedAt:'2026-09-28T08:02:00Z'}});
 });

 const result={attemptId:'attempt-1',assessmentId:'assessment-1',assessmentVersion:2,title:'اختبار كمي',attemptNumber:1,score:100,totalQuestions:1,correctAnswers:1,wrongAnswers:0,unanswered:0,passed:true,timeSpentSeconds:12,finalizedAt:'2026-09-28T08:02:00Z',showResultsReport:true};
 await page.route('**/api/v1/assessment-attempts/attempt-1/review',route=>json(route,{detail:{
  result,assessmentId:'assessment-1',assessmentVersion:2,title:'اختبار كمي',attemptNumber:1,
  allowQuestionReview:true,showAnswers:true,showExplanations:true,showResultsReport:true,
  questions:[{questionId:'q-1',questionVersion:3,sectionId:'',sortOrder:0,points:1,type:'mcq',text:'٢ + ٢ = ؟',imageAssetId:'',imageAlt:'',optionsEmbeddedInImage:false,videoUrl:'',difficulty:'easy',options:[{index:0,text:'٣',assetId:''},{index:1,text:'٤',assetId:''}],selectedOptionIndex:1,correctOptionIndex:1,answered:true,correct:true,markedForReview:false,timeSpentSeconds:4,explanation:'نجمع العددين فنحصل على أربعة.',hint:'اجمع العددين.',solvingStrategy:'جمع مباشر'}],
 }}));
 let saveCalls=0;
 await page.route('**/api/v1/review/questions/q-1/saved',route=>{saveCalls++;return json(route,{success:true})});

 const card={cardId:'card-1',questionId:'q-1',questionVersion:3,pathId:'path-1',subjectId:'subject-1',reviewType:'error_recovery',savedForReview:true,savedAt:'2026-09-28T08:03:00Z',hasMistake:true,nextReviewAt:'2026-09-28T08:04:00Z',skillIds:['skill-1'],updatedAt:'2026-09-28T08:03:00Z'};
 const safeQuestion={id:'q-1',version:3,type:'mcq',text:'٢ + ٢ = ؟',imageAssetId:'',imageAlt:'',optionsEmbeddedInImage:false,videoUrl:'',difficulty:'easy',options:[{index:0,text:'٣',assetId:''},{index:1,text:'٤',assetId:''}]};
 await page.route('**/api/v1/review/practice?**',route=>json(route,{items:[{card,question:safeQuestion}],page:1,limit:20,hasMore:false}));
 let remediationCalls=0;
 await page.route('**/api/v1/review/cards/card-1/answer',route=>{
  remediationCalls++;
  return json(route,{result:{submissionId:'review-submission-1',cardId:'card-1',questionId:'q-1',questionVersion:3,selectedOptionIndex:0,correct:false,evidenceType:'remediation',quality:2,correctOptionIndex:1,explanation:'نجمع العددين فنحصل على أربعة.',hint:'',solvingStrategy:'جمع مباشر',reviewTypeAfter:'error_recovery',nextReviewAt:'2026-09-29T08:04:00Z'}});
 });

 await page.route('**/api/v1/review/library?**',route=>json(route,{items:[{card,question:{...safeQuestion,correctOptionIndex:1,explanation:'نجمع العددين فنحصل على أربعة.',hint:'اجمع العددين.',solvingStrategy:'جمع مباشر'}}],page:1,limit:20,hasMore:false}));
 const mastery={pathId:'path-1',subjectId:'subject-1',skillId:'skill-1',mastery:40,status:'weak',attempts:2,evidenceCount:3,lastEvidenceAt:'2026-09-28T08:04:00Z',recommendedAction:'خطة علاج عاجلة: شرح + تدريب + اختبار موجه'};
 await page.route('**/api/v1/mastery/progress?**',route=>json(route,{items:[mastery],page:1,limit:8,hasMore:false}));
 await page.route('**/api/v1/mastery/next-action?**',route=>json(route,{item:mastery}));
 await page.route('**/api/v1/mastery/readiness?**',route=>json(route,{readiness:{score:54,status:'building',mastery:40,coverage:1,evidenceConfidence:1,recency:1,totalSkills:1,reliableSkills:1,totalEvidence:3,explanation:'استمر في العلاج والتدريب قبل إعادة القياس.'}}));
 await page.route('**/api/v1/mastery/goals?**',route=>json(route,{items:[],page:1,limit:20,hasMore:false}));

 await page.goto('/learning');
 await page.getByLabel('المسار').selectOption('path-1');
 await page.getByLabel('المادة').selectOption('subject-1');
 await expect(page.getByText('دورة الكمي')).toBeVisible();
 await page.getByRole('button',{name:'التأسيس'}).click();
 await expect(page.getByText('أساسيات النسب')).toBeVisible();

 await page.goto('/assessments/assessment-1/start');
 await expect(page.getByText('٢ + ٢ = ؟')).toBeVisible();
 await expect(page.getByText('الإجابة الصحيحة')).toHaveCount(0);
 await page.getByRole('button',{name:/٤/}).click();
 await page.getByRole('button',{name:'تسليم الاختبار'}).click();
 await expect(page.getByRole('heading',{name:'تم تسليم الاختبار'})).toBeVisible();
 await expect.poll(()=>submitCalls).toBe(1);

 await page.goto('/assessment-results/attempt-1');
 await expect(page.getByText('الإجابة الصحيحة')).toBeVisible();
 await page.getByRole('button',{name:'حفظ للمراجعة'}).click();
 await expect(page.getByRole('button',{name:'تم الحفظ'})).toBeVisible();
 await expect.poll(()=>saveCalls).toBe(1);

 await page.goto('/review/practice?pathId=path-1&subjectId=subject-1&tab=mistakes');
 await expect(page.getByText('السؤال 1 من 1')).toBeVisible();
 await expect(page.getByText('الإجابة الصحيحة')).toHaveCount(0);
 await page.getByRole('button',{name:/٣/}).click();
 await page.getByRole('button',{name:'تحقق وسجّل المراجعة'}).click();
 await expect.poll(()=>remediationCalls).toBe(1);
 await expect(page.getByText('الإجابة الصحيحة')).toBeVisible();

 await page.goto('/review');
 await page.getByLabel('مسار المراجعة').selectOption('path-1');
 await page.getByLabel('مادة المراجعة').selectOption('subject-1');
 await expect(page.getByText('خطة علاج عاجلة: شرح + تدريب + اختبار موجه')).toBeVisible();
 await expect(page.getByTestId('mastery-readiness')).toContainText('54');
 await page.screenshot({path:'test-results/global-student-golden-mobile.png',fullPage:true});
});
