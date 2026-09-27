import{expect,test,type Page,type Route}from'@playwright/test';

const teacher={id:'teacher-1',email:'teacher@example.com',name:'معلم الفصل',status:'active',avatarUrl:'',emailVerified:true,role:'teacher',roles:['teacher']};
const student={id:'student-1',email:'student@example.com',name:'طالب الفصل',status:'active',avatarUrl:'',emailVerified:true,role:'student',roles:['student']};
const admin={id:'admin-1',email:'admin@example.com',name:'مدير المنصة',status:'active',avatarUrl:'',emailVerified:true,role:'admin',roles:['admin']};

function json(route:Route,body:unknown,status=200){return route.fulfill({status,contentType:'application/json',body:JSON.stringify(body)})}
async function auth(page:Page,user:typeof teacher|typeof student|typeof admin){
 await page.route('**/api/v1/auth/me',route=>json(route,{user}));
 await page.route('**/api/v1/auth/csrf',route=>json(route,{csrfToken:'csrf-token'}));
}

const baseSession={
 id:'session-1',schoolId:'school-1',classId:'class-1',subjectId:'subject-1',teacherId:'teacher-1',
 status:'draft',day:'',period:null,publishedMode:'single',activeBatchId:'',activeQuestionOrdinal:null,
 pinExpiresAt:'2026-09-27T09:30:00Z',revision:1,startedAt:null,endedAt:null,
 createdAt:'2026-09-27T09:00:00Z',updatedAt:'2026-09-27T09:00:00Z'
}as const;

test('teacher creates starts publishes reveals and finalizes a classroom session',async({page})=>{
 await auth(page,teacher);
 await page.routeWebSocket('**/api/v1/classroom/sessions/**/stream',()=>{});
 await page.route('**/api/v1/schools/teacher-workspace',route=>json(route,{
  personas:{platformTrainer:false,schoolTeacher:true},
  schools:[{schoolId:'school-1',schoolName:'مدرسة المئة',source:'membership',assignments:[{
   assignmentId:'assignment-1',classId:'class-1',className:'الصف الأول',subjectId:'subject-1',studentCount:18
  }]}]
 }));
 await page.route('**/api/v1/taxonomy/bootstrap?phase=core',route=>json(route,{
  paths:[{id:'path-1',code:'PATH',name:'المسار'}],
  subjects:[{id:'subject-1',pathId:'path-1',code:'MATH',name:'الرياضيات'}]
 }));
 await page.route('**/api/v1/classroom/teacher/sessions',route=>json(route,{sessions:[]}));
 await page.route('**/api/v1/classroom/questions*',route=>json(route,{
  items:[{id:'question-1',version:3,questionType:'mcq',text:'٢ + ٢ = ؟',difficulty:'easy'}],
  page:1,limit:30,hasMore:false
 }));

 let state:any={...baseSession};
 let revealed=false;
 let createHeader='',startHeader='',publishHeader='',revealHeader='',endHeader='';
 await page.route('**/api/v1/classroom/sessions',async route=>{
  if(route.request().method()!=='POST')return route.fallback();
  createHeader=route.request().headers()['x-csrf-token']||'';
  state={...baseSession};
  return json(route,{session:state,pin:'654321'},201);
 });
 await page.route('**/api/v1/classroom/sessions/session-1/start',route=>{
  startHeader=route.request().headers()['x-csrf-token']||'';
  state={...state,status:'live',revision:2,startedAt:'2026-09-27T09:01:00Z'};
  return json(route,{session:state});
 });
 await page.route('**/api/v1/classroom/sessions/session-1/publish/0',route=>{
  publishHeader=route.request().headers()['x-csrf-token']||'';
  state={...state,activeBatchId:'batch-1',activeQuestionOrdinal:0,revision:3};
  return json(route,{session:state});
 });
 await page.route('**/api/v1/classroom/sessions/session-1/reveal/0',route=>{
  revealHeader=route.request().headers()['x-csrf-token']||'';
  revealed=true;
  return json(route,{question:{ordinal:0,batchId:'batch-1',questionId:'question-1',questionVersion:3,publishedAt:'2026-09-27T09:02:00Z',revealedAt:'2026-09-27T09:03:00Z'}});
 });
 await page.route('**/api/v1/classroom/sessions/session-1/presentation',route=>json(route,{presentation:{
  sessionId:'session-1',status:state.status,publishedMode:'single',activeBatchId:state.activeBatchId,
  activeQuestionOrdinal:state.activeQuestionOrdinal,
  questions:state.activeQuestionOrdinal===0?[{
   ordinal:0,questionId:'question-1',questionVersion:3,text:'٢ + ٢ = ؟',imageAssetId:'',imageAlt:'',
   optionsEmbeddedInImage:false,options:[{index:0,text:'٣',assetId:''},{index:1,text:'٤',assetId:''}],
   difficulty:'easy',revealed,correctOptionIndex:revealed?1:null,explanation:revealed?'لأن ٢ + ٢ = ٤':'',selectedOptionIndex:null
  }]:[],
  aggregate:{sessionId:'session-1',status:state.status,activeBatchId:state.activeBatchId,activeQuestionOrdinal:state.activeQuestionOrdinal,joinedCount:12,questions:state.activeQuestionOrdinal===0?[{ordinal:0,questionId:'question-1',responseCount:8,correctCount:6,distribution:{'0':2,'1':6}}]:[]}
 }}));
 await page.route('**/api/v1/classroom/sessions/session-1/end',route=>{
  endHeader=route.request().headers()['x-csrf-token']||'';
  state={...state,status:'ended',activeBatchId:'',activeQuestionOrdinal:null,endedAt:'2026-09-27T09:10:00Z'};
  return json(route,{report:{
   sessionId:'session-1',schoolId:'school-1',classId:'class-1',subjectId:'subject-1',teacherId:'teacher-1',status:'ended',
   startedAt:'2026-09-27T09:01:00Z',endedAt:'2026-09-27T09:10:00Z',durationMinutes:9,
   roster:{expected:18,joined:12,absentFromSession:6},batches:[],questions:[],totals:{responses:8,correct:6}
  },finalizedAt:'2026-09-27T09:10:00Z'});
 });

 await page.goto('/school-teacher-dashboard');
 await expect(page.getByRole('heading',{name:'الفصل الذكي'})).toBeVisible();
 await page.getByRole('button',{name:/٢ + ٢/}).click();
 await page.getByRole('button',{name:'إنشاء الحصة'}).click();
 await expect(page.getByText('654321')).toBeVisible();
 await page.getByRole('button',{name:'بدء الحصة'}).click();
 await page.getByRole('button',{name:'نشر السؤال الأول'}).click();
 await expect(page.getByText('8')).toBeVisible();
 await page.getByRole('button',{name:'إظهار الحل'}).click();
 await expect(page.getByText('لأن ٢ + ٢ = ٤')).toBeVisible();
 await page.getByRole('button',{name:'إنهاء الحصة وحفظ التقرير'}).click();
 await expect(page.getByRole('heading',{name:'التقرير النهائي'})).toBeVisible();
 await expect(page.getByText('12')).toBeVisible();
 expect([createHeader,startHeader,publishHeader,revealHeader,endHeader]).toEqual(Array(5).fill('csrf-token'));
 await page.screenshot({path:'test-results/classroom-teacher-desktop.png',fullPage:true});
});

test('student joins by pin and answers without receiving answer key before reveal',async({page})=>{
 await auth(page,student);
 await page.setViewportSize({width:390,height:844});
 await page.routeWebSocket('**/api/v1/classroom/sessions/**/stream',()=>{});
 const live={...baseSession,status:'live',activeBatchId:'batch-1',activeQuestionOrdinal:0,revision:3,startedAt:'2026-09-27T09:01:00Z'};
 let selected:number|null=null;
 let joinByPinHeader='',joinHeader='',answerHeader='';
 await page.route('**/api/v1/classroom/join-by-pin',route=>{
  joinByPinHeader=route.request().headers()['x-csrf-token']||'';
  return json(route,{participant:{sessionId:'session-1',studentId:'student-1',attendanceStatus:'present'},session:live});
 });
 await page.route('**/api/v1/classroom/sessions/session-1/join',route=>{
  joinHeader=route.request().headers()['x-csrf-token']||'';
  return json(route,{participant:{sessionId:'session-1',studentId:'student-1',attendanceStatus:'present'},session:live});
 });
 await page.route('**/api/v1/classroom/sessions/session-1/current',route=>json(route,{state:{
  sessionId:'session-1',status:'live',publishedMode:'single',activeBatchId:'batch-1',activeQuestionOrdinal:0,
  questions:[{ordinal:0,questionId:'question-1',questionVersion:3,text:'٢ + ٢ = ؟',imageAssetId:'',imageAlt:'',
   optionsEmbeddedInImage:false,options:[{index:0,text:'٣',assetId:''},{index:1,text:'٤',assetId:''}],
   difficulty:'easy',revealed:false,selectedOptionIndex:selected}]
 }}));
 await page.route('**/api/v1/classroom/sessions/session-1/answers/0',route=>{
  answerHeader=route.request().headers()['x-csrf-token']||'';
  const body=route.request().postDataJSON() as{selectedOptionIndex:number};
  selected=body.selectedOptionIndex;
  return json(route,{response:{questionOrdinal:0,selectedOptionIndex:selected,submittedAt:'2026-09-27T09:04:00Z'}});
 });

 await page.goto('/classroom/join');
 await page.getByLabel('رمز الفصل الذكي').fill('654321');
 await page.getByRole('button',{name:'انضمام للحصة'}).click();
 await expect(page).toHaveURL(/\/classroom\/session-1$/);
 await expect(page.getByRole('heading',{name:'الحصة التفاعلية'})).toBeVisible();
 await expect(page.getByText('تم كشف الحل بواسطة المعلم')).toHaveCount(0);
 await page.getByRole('button',{name:/٤/}).click();
 await expect.poll(()=>selected).toBe(1);
 expect(joinByPinHeader).toBe('csrf-token');
 expect(joinHeader).toBe('csrf-token');
 expect(answerHeader).toBe('csrf-token');
 await page.screenshot({path:'test-results/classroom-student-mobile.png',fullPage:true});
});

test('platform admin controls SMART_CLASSROOM school module with csrf',async({page})=>{
 await auth(page,admin);
 await page.route('**/api/v1/schools/?**',route=>json(route,{
  schools:[{id:'school-1',code:'SCH-1',name:'مدرسة المئة',status:'active'}],
  pagination:{page:1,limit:100,total:1,totalPages:1}
 }));
 await page.route('**/api/v1/school-contracts/school-1',async route=>{
  if(route.request().method()==='GET')return json(route,{message:'not found'},404);
  const body=route.request().postDataJSON() as{modules:string[];expectedRevision:number};
  expect(route.request().headers()['x-csrf-token']).toBe('csrf-token');
  expect(body.modules).toContain('SMART_CLASSROOM');
  expect(body.expectedRevision).toBe(0);
  return json(route,{contract:{
   id:'contract-1',schoolId:'school-1',status:'active',modules:body.modules,
   validFrom:null,validUntil:null,revision:1,createdAt:'2026-09-27T09:00:00Z',updatedAt:'2026-09-27T09:00:00Z'
  }});
 });

 await page.goto('/admin-dashboard/classroom');
 await expect(page.getByRole('heading',{name:'تفعيل الفصل الذكي للمدارس'})).toBeVisible();
 await expect(page.getByLabel('تفعيل الفصل الذكي')).not.toBeChecked();
 await page.getByLabel('تفعيل الفصل الذكي').check();
 await page.getByRole('button',{name:'حفظ العقد'}).click();
 await expect(page.getByText('تم تفعيل Smart Classroom بعقد المدرسة.')).toBeVisible();
});
