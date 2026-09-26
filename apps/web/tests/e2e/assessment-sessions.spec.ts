import{expect,test,type Page,type Route}from'@playwright/test';

const admin={id:'admin-1',email:'admin@example.com',name:'مدير',status:'active',avatarUrl:'',emailVerified:true,role:'admin',roles:['admin']};
const student={id:'student-1',email:'student@example.com',name:'طالب',status:'active',avatarUrl:'',emailVerified:true,role:'student',roles:['student']};
const taxonomy={paths:[{id:'path-1',code:'QDR',name:'القدرات',description:'',sortOrder:1}],subjects:[{id:'subject-1',pathId:'path-1',code:'QNT',name:'الكمي',sortOrder:1}]};
const summary={id:'assessment-1',code:'QNT-1',title:'اختبار الجلسة',pathId:'path-1',subjectId:'subject-1',kind:'normal',workflowStatus:'approved',ownerType:'platform',revision:3,currentVersion:2,isPublished:true,updatedAt:'2026-09-26T03:00:00Z'};
const question={id:'q-1',version:1,sectionId:'',sortOrder:0,points:1,type:'mcq',text:'٢ + ٢ = ؟',imageAssetId:'',imageAlt:'',optionsEmbeddedInImage:false,videoUrl:'',difficulty:'easy',options:[{index:0,text:'٣',assetId:''},{index:1,text:'٤',assetId:''}]};
const attempt={id:'live-attempt-1',assessmentId:'assessment-1',assessmentVersion:2,attemptNumber:1,status:'in_progress',title:'اختبار الجلسة',startedAt:'2026-09-26T03:05:00Z',expiresAt:null,submittedAt:null,showProgressBar:true,requireAnswerBeforeNext:false,allowQuestionReview:true,randomizeOptions:false,questions:[question],answers:[]};
function json(r:Route,b:unknown,s=200){return r.fulfill({status:s,contentType:'application/json',body:JSON.stringify(b)})}
async function auth(page:Page,user:typeof admin|typeof student){await page.route('**/api/v1/auth/me',r=>json(r,{user}));await page.route('**/api/v1/auth/csrf',r=>json(r,{csrfToken:'csrf'}));}

test('staff creates activates and exposes a stable barcode session',async({page})=>{
 await auth(page,admin);
 await page.route('**/api/v1/taxonomy/bootstrap?phase=core',r=>json(r,taxonomy));
 await page.route('**/api/v1/assessments?**',r=>json(r,{items:[summary],page:1,limit:50,hasMore:false}));
 let sessions:any[]=[];
 await page.route('**/api/v1/assessment-sessions?**',r=>json(r,{items:sessions,page:1,limit:100,hasMore:false}));
 await page.route('**/api/v1/assessment-sessions',async r=>{
   const body=JSON.parse(r.request().postData()||'{}');
   expect(body).toMatchObject({assessmentId:'assessment-1',channel:'barcode',schoolId:'',classId:''});
   const session={id:'session-1',assessmentId:'assessment-1',assessmentVersion:2,title:'اختبار الجلسة',channel:'barcode',sessionCode:'barcodeabc123',status:'scheduled',schoolId:'',classId:'',opensAt:null,closesAt:null,maxSubmissions:null,createdAt:'2026-09-26T03:01:00Z',updatedAt:'2026-09-26T03:01:00Z'};
   sessions=[session];return json(r,{session},201);
 });
 await page.route('**/api/v1/assessment-sessions/session-1/status',async r=>{const body=JSON.parse(r.request().postData()||'{}');expect(body.status).toBe('active');sessions=[{...sessions[0],status:'active'}];return json(r,{session:sessions[0]})});
 await page.goto('/admin-dashboard/assessments');
 await page.getByRole('button',{name:'الجلسات'}).click();
 await expect(page.getByRole('heading',{name:'الجلسات العامة والمباشرة'})).toBeVisible();
 await page.getByRole('button',{name:'إنشاء جلسة'}).click();
 await expect(page.getByText('barcodeabc123')).toBeVisible();
 await page.getByRole('button',{name:'تفعيل'}).click();
 await expect(page.getByText('نشط')).toBeVisible();
 await expect(page.getByRole('link',{name:'فتح'})).toHaveAttribute('href','/barcode-test/barcodeabc123');
});

test('anonymous barcode participant starts submits once and sees server result on mobile',async({page})=>{
 await page.setViewportSize({width:390,height:844});
 await page.route('**/api/v1/auth/me',r=>json(r,{message:'Authentication required'},401));
 await page.route('**/api/v1/public-assessments/barcodeabc123/start',async r=>{
   const body=JSON.parse(r.request().postData()||'{}');
   expect(body.participantKey.length).toBeGreaterThanOrEqual(8);expect(body.startKey.length).toBeGreaterThanOrEqual(8);
   return json(r,{attempt:{id:'public-attempt-1',sessionId:'session-1',sessionCode:'barcodeabc123',assessmentId:'assessment-1',assessmentVersion:2,title:'اختبار الجلسة',attemptNumber:1,status:'in_progress',startedAt:'2026-09-26T03:05:00Z',expiresAt:null,showProgressBar:true,requireAnswerBeforeNext:true,optionLayout:'auto',questions:[question]}},201);
 });
 await page.route('**/api/v1/public-assessments/barcodeabc123/submit',async r=>{
   const body=JSON.parse(r.request().postData()||'{}');
   expect(body.participantName).toBe('طالب زائر');expect(body.publicAttemptId).toBe('public-attempt-1');expect(body.answers).toEqual([{questionId:'q-1',selectedOptionIndex:1}]);
   return json(r,{resultVisible:true,result:{attemptId:'public-attempt-1',score:100,totalQuestions:1,correctAnswers:1,wrongAnswers:0,unanswered:0,passed:true,timeSpentSeconds:2,finalizedAt:'2026-09-26T03:06:00Z'}});
 });
 await page.goto('/barcode-test/barcodeabc123');
 await expect(page.getByRole('heading',{name:'اختبار الجلسة'})).toBeVisible();
 await page.getByLabel('اسم المشارك').fill('طالب زائر');
 await page.getByRole('button',{name:'٤'}).click();
 await page.getByRole('button',{name:'إرسال الاختبار'}).click();
 await expect(page.getByRole('heading',{name:'تم إرسال الاختبار'})).toBeVisible();
 await expect(page.getByText('100.0%')).toBeVisible();
 await page.screenshot({path:'test-results/public-barcode-mobile.png',fullPage:true});
});

test('student joins live session by code and enters canonical attempt runner',async({page})=>{
 await page.setViewportSize({width:390,height:844});
 await auth(page,student);
 await page.route('**/api/v1/assessment-sessions/join/live1234',r=>json(r,{session:{sessionId:'live-session-1',assessmentId:'assessment-1',assessmentVersion:2,title:'اختبار الجلسة',sessionCode:'live1234',opensAt:null,closesAt:null,attemptCount:0,maxAttempts:2,canStart:true}}));
 await page.route('**/api/v1/assessment-sessions/live-session-1/start',r=>json(r,{attempt},201));
 await page.route('**/api/v1/assessment-attempts/live-attempt-1',r=>json(r,{attempt}));
 await page.goto('/live-assessment?code=live1234');
 await expect(page.getByText('اختبار الجلسة')).toBeVisible();
 await page.getByRole('button',{name:'ابدأ الاختبار'}).click();
 await expect(page).toHaveURL(/assessment-attempts\/live-attempt-1/);
 await expect(page.getByRole('heading',{name:'اختبار الجلسة'})).toBeVisible();
});
