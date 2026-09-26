import{expect,test,type Page,type Route}from'@playwright/test';

const admin={id:'admin-1',email:'admin@example.com',name:'مدير',status:'active',avatarUrl:'',emailVerified:true,role:'admin',roles:['admin']};
const student={id:'student-1',email:'student@example.com',name:'طالب',status:'active',avatarUrl:'',emailVerified:true,role:'student',roles:['student']};
const taxonomy={paths:[{id:'path-1',code:'QDR',name:'القدرات',description:'',sortOrder:1}],subjects:[{id:'subject-1',pathId:'path-1',code:'QNT',name:'الكمي',sortOrder:1}]};
const summary={id:'assessment-1',code:'QNT-1',title:'اختبار الكمي',pathId:'path-1',subjectId:'subject-1',kind:'normal',workflowStatus:'approved',ownerType:'platform',revision:3,currentVersion:2,isPublished:true,updatedAt:'2026-09-26T02:00:00Z'};
const attempt={id:'attempt-placement-1',assessmentId:'assessment-1',assessmentVersion:2,attemptNumber:1,status:'in_progress',title:'اختبار الكمي',startedAt:'2026-09-26T02:05:00Z',expiresAt:null,submittedAt:null,showProgressBar:true,requireAnswerBeforeNext:false,allowQuestionReview:true,randomizeOptions:false,questions:[{id:'q-1',version:1,sectionId:'',sortOrder:0,points:1,type:'mcq',text:'١ + ١ = ؟',imageAssetId:'',imageAlt:'',optionsEmbeddedInImage:false,videoUrl:'',difficulty:'easy',options:[{index:0,text:'١',assetId:''},{index:1,text:'٢',assetId:''}]}],answers:[]};
function json(r:Route,b:unknown,s=200){return r.fulfill({status:s,contentType:'application/json',body:JSON.stringify(b)})}
async function auth(page:Page,user:typeof admin|typeof student){await page.route('**/api/v1/auth/me',r=>json(r,{user}));await page.route('**/api/v1/auth/csrf',r=>json(r,{csrfToken:'csrf'}));}

test('staff creates and hides a bounded learning placement',async({page})=>{
 await auth(page,admin);
 await page.route('**/api/v1/taxonomy/bootstrap?phase=core',r=>json(r,taxonomy));
 await page.route('**/api/v1/assessments?**',r=>json(r,{items:[summary],page:1,limit:50,hasMore:false}));
 let placements:any[]=[];
 await page.route('**/api/v1/assessments/assessment-1/placements?**',r=>json(r,{items:placements,page:1,limit:100,hasMore:false}));
 await page.route('**/api/v1/assessments/assessment-1/placements',async r=>{
   const body=JSON.parse(r.request().postData()||'{}');
   expect(body).toMatchObject({slot:'tests',pathId:'path-1',subjectId:'subject-1',courseId:'',lessonId:'',topicId:'',isVisible:true});
   const placement={id:'placement-1',assessmentId:'assessment-1',assessmentVersion:2,...body,createdAt:'2026-09-26T02:01:00Z',updatedAt:'2026-09-26T02:01:00Z'};
   placements=[placement];return json(r,{placement},201);
 });
 await page.route('**/api/v1/assessment-placements/placement-1',async r=>{
   const body=JSON.parse(r.request().postData()||'{}');
   expect(body.isVisible).toBe(false);expect(body.expectedUpdatedAt).toBe('2026-09-26T02:01:00Z');
   placements=[{...placements[0],isVisible:false,updatedAt:'2026-09-26T02:02:00Z'}];
   return json(r,{placement:placements[0]});
 });
 await page.goto('/admin-dashboard/assessments');
 await expect(page.getByText('اختبار الكمي')).toBeVisible();
 await page.getByRole('button',{name:'أماكن الظهور'}).click();
 await expect(page.getByRole('heading',{name:'أماكن ظهور الاختبار'})).toBeVisible();
 await page.getByRole('button',{name:'إضافة مكان الظهور'}).click();
 await expect(page.getByRole('button',{name:/إخفاء/})).toBeVisible();
 await page.getByRole('button',{name:/إخفاء/}).click();
 await expect(page.getByText('مخفي')).toBeVisible();
});

test('student enters exact learning scope and starts placement attempt on mobile',async({page})=>{
 await auth(page,student);
 await page.setViewportSize({width:390,height:844});
 await page.route('**/api/v1/taxonomy/bootstrap?phase=core',r=>json(r,taxonomy));
 await page.route('**/api/v1/assessment-placements/available?**',r=>{
   const u=new URL(r.request().url());
   expect(u.searchParams.get('slot')).toBe('tests');
   expect(u.searchParams.get('pathId')).toBe('path-1');
   expect(u.searchParams.get('subjectId')).toBe('subject-1');
   return json(r,{items:[
    {placementId:'placement-paid',assessmentId:'assessment-paid',assessmentVersion:1,assessmentKind:'normal',title:'اختبار مدفوع',slot:'tests',pathId:'path-1',subjectId:'subject-1',courseId:'',lessonId:'',topicId:'',sortOrder:0,attemptCount:0,maxAttempts:2,accessType:'paid',baseAccessType:'free',accessAllowed:false,accessReason:'paid_required',canStart:false},
    {placementId:'placement-1',assessmentId:'assessment-1',assessmentVersion:2,assessmentKind:'normal',title:'اختبار الكمي',slot:'tests',pathId:'path-1',subjectId:'subject-1',courseId:'',lessonId:'',topicId:'',sortOrder:1,attemptCount:0,maxAttempts:2,accessType:'inherit',baseAccessType:'free',accessAllowed:true,accessReason:'free_assessment',canStart:true}
   ],page:1,limit:30,hasMore:false});
 });
 await page.route('**/api/v1/assessment-placements/placement-1/start',r=>json(r,{attempt},201));
 await page.route('**/api/v1/assessment-attempts/attempt-placement-1',r=>json(r,{attempt}));
 await page.goto('/assessments');
 await page.getByLabel('المسار').selectOption('path-1');
 await page.getByLabel('المادة').selectOption('subject-1');
 await expect(page.getByText('اختبار مدفوع')).toBeVisible();
 await expect(page.getByRole('button',{name:'يتطلب تفعيل باقة أو صلاحية'})).toBeDisabled();
 await expect(page.getByText('الوصول لهذا الاختبار يتحقق من Commerce على الخادم عند العرض وعند بدء المحاولة.')).toBeVisible();
 await expect(page.getByText('اختبار الكمي')).toBeVisible();
 await page.getByRole('button',{name:'ابدأ الاختبار'}).click();
 await expect(page).toHaveURL(/assessment-attempts\/attempt-placement-1/);
 await expect(page.getByRole('heading',{name:'اختبار الكمي'})).toBeVisible();
 await page.screenshot({path:'test-results/assessment-placement-mobile.png',fullPage:true});
});
