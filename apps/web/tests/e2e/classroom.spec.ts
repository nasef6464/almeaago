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
 pinExpiresAt:'2026-09-28T12:30:00Z',revision:1,startedAt:null,endedAt:null,
 createdAt:'2026-09-28T09:00:00Z',updatedAt:'2026-09-28T09:00:00Z'
}as const;

test('teacher runs QR lobby roster attendance challenge reveal and immutable report',async({page})=>{
 await auth(page,teacher);
 await page.routeWebSocket('**/api/v1/classroom/sessions/**/stream',()=>{});
 await page.route('**/api/v1/schools/teacher-workspace',route=>json(route,{
  personas:{platformTrainer:false,schoolTeacher:true},
  schools:[{schoolId:'school-1',schoolName:'مدرسة المئة',source:'membership',assignments:[{
   assignmentId:'assignment-1',classId:'class-1',className:'الصف الأول',subjectId:'subject-1',studentCount:2
  }]}]
 }));
 await page.route('**/api/v1/taxonomy/bootstrap?phase=core',route=>json(route,{
  paths:[{id:'path-1',code:'PATH',name:'المسار'}],
  subjects:[{id:'subject-1',pathId:'path-1',code:'MATH',name:'الرياضيات'}]
 }));
 await page.route('**/api/v1/schools/school-1/roster?**',route=>json(route,{
  members:[
   {userId:'student-1',name:'سارة',email:'sara@school.test',status:'active',roles:['student'],classIds:['class-1']},
   {userId:'student-2',name:'أحمد',email:'ahmad@school.test',status:'active',roles:['student'],classIds:['class-1']}
  ],pagination:{page:1,limit:100,total:2,totalPages:1}
 }));
 await page.route('**/api/v1/classroom/teacher/sessions',route=>json(route,{sessions:[]}));
 await page.route('**/api/v1/classroom/questions*',route=>json(route,{
  items:[{id:'question-1',version:3,questionType:'mcq',text:'٢ + ٢ = ؟',difficulty:'easy'}],
  page:1,limit:30,hasMore:false
 }));

 let state:any={...baseSession};
 let revealed=false;
 let attendanceRows:any[]=[
  {studentId:'student-1',joinedAt:'2026-09-28T09:01:30Z',joinedMethod:'qr',attendanceStatus:'present',attendanceOverriddenBy:'',attendanceOverriddenAt:null},
  {studentId:'student-2',joinedAt:null,joinedMethod:'',attendanceStatus:'absent',attendanceOverriddenBy:'',attendanceOverriddenAt:null}
 ];
 let challenge:any=null;
 let challengeConfigured=0,attendanceWrites=0;
 const headers:string[]=[];
 await page.route('**/api/v1/classroom/sessions',async route=>{
  if(route.request().method()!=='POST')return route.fallback();
  headers.push(route.request().headers()['x-csrf-token']||'');state={...baseSession};
  return json(route,{session:state,pin:'654321'},201);
 });
 await page.route('**/api/v1/classroom/sessions/session-1/start',route=>{
  headers.push(route.request().headers()['x-csrf-token']||'');state={...state,status:'live',revision:2,startedAt:'2026-09-28T09:01:00Z'};
  return json(route,{session:state});
 });
 await page.route('**/api/v1/classroom/sessions/session-1/publish/0',route=>{
  headers.push(route.request().headers()['x-csrf-token']||'');state={...state,activeBatchId:'batch-1',activeQuestionOrdinal:0,revision:3};
  return json(route,{session:state});
 });
 await page.route('**/api/v1/classroom/sessions/session-1/presentation',route=>json(route,{presentation:{
  sessionId:'session-1',status:state.status,publishedMode:'single',activeBatchId:state.activeBatchId,
  activeQuestionOrdinal:state.activeQuestionOrdinal,challenge,
  questions:state.activeQuestionOrdinal===0?[{
   ordinal:0,questionId:'question-1',questionVersion:3,text:'٢ + ٢ = ؟',imageAssetId:'',imageAlt:'',
   optionsEmbeddedInImage:false,options:[{index:0,text:'٣',assetId:''},{index:1,text:'٤',assetId:''}],
   difficulty:'easy',revealed,correctOptionIndex:revealed?1:null,explanation:revealed?'لأن ٢ + ٢ = ٤':'',selectedOptionIndex:null
  }]:[],
  aggregate:{sessionId:'session-1',status:state.status,activeBatchId:state.activeBatchId,activeQuestionOrdinal:state.activeQuestionOrdinal,joinedCount:1,questions:state.activeQuestionOrdinal===0?[{ordinal:0,questionId:'question-1',responseCount:1,correctCount:1,distribution:{'0':0,'1':1}}]:[]}
 }}));
 await page.route('**/api/v1/classroom/sessions/session-1/attendance',route=>{
  const summary={expected:2,joined:attendanceRows.filter(x=>x.joinedAt).length,present:attendanceRows.filter(x=>x.attendanceStatus==='present').length,late:attendanceRows.filter(x=>x.attendanceStatus==='late').length,absent:attendanceRows.filter(x=>x.attendanceStatus==='absent').length,excused:attendanceRows.filter(x=>x.attendanceStatus==='excused').length};
  return json(route,{attendance:{sessionId:'session-1',...summary,rows:attendanceRows}});
 });
 await page.route('**/api/v1/classroom/sessions/session-1/participants/student-2/attendance',route=>{
  headers.push(route.request().headers()['x-csrf-token']||'');attendanceWrites++;
  const body=route.request().postDataJSON() as{status:string};expect(body.status).toBe('excused');
  attendanceRows=attendanceRows.map(x=>x.studentId==='student-2'?{...x,attendanceStatus:'excused',attendanceOverriddenBy:'teacher-1',attendanceOverriddenAt:'2026-09-28T09:03:00Z'}:x);
  return json(route,{participant:attendanceRows[1]});
 });
 await page.route('**/api/v1/classroom/sessions/session-1/competition',route=>json(route,{competition:{
  state:challenge||{sessionId:'session-1',activeBatchId:'',competitionEnabled:false,challengeDurationSeconds:null,timerStartedAt:null,timerEndsAt:null,expired:false,serverNow:new Date().toISOString()},
  participantCount:challenge?2:0,
  leaderboard:challenge?[{rank:1,studentId:'student-1',answered:1,correct:1,accuracy:100,score:100,lastSubmittedAt:'2026-09-28T09:04:00Z'},{rank:2,studentId:'student-2',answered:1,correct:0,accuracy:0,score:0,lastSubmittedAt:'2026-09-28T09:04:10Z'}]:[],
  podium:[],scoring:{correctAnswerPoints:100,speedBonus:false}
 }}));
 await page.route('**/api/v1/classroom/sessions/session-1/competition/configure',route=>{
  headers.push(route.request().headers()['x-csrf-token']||'');challengeConfigured++;
  const body=route.request().postDataJSON() as{durationSeconds:number};expect(body.durationSeconds).toBe(60);
  const now=new Date();challenge={sessionId:'session-1',activeBatchId:'batch-1',competitionEnabled:true,challengeDurationSeconds:60,timerStartedAt:now.toISOString(),timerEndsAt:new Date(now.getTime()+60_000).toISOString(),expired:false,serverNow:now.toISOString()};
  return json(route,{challenge});
 });
 await page.route('**/api/v1/classroom/sessions/session-1/reveal/0',route=>{
  headers.push(route.request().headers()['x-csrf-token']||'');revealed=true;
  return json(route,{question:{ordinal:0,batchId:'batch-1',questionId:'question-1',questionVersion:3,publishedAt:'2026-09-28T09:02:00Z',revealedAt:'2026-09-28T09:05:00Z'}});
 });
 await page.route('**/api/v1/classroom/sessions/session-1/end',route=>{
  headers.push(route.request().headers()['x-csrf-token']||'');state={...state,status:'ended',activeBatchId:'',activeQuestionOrdinal:null,endedAt:'2026-09-28T09:10:00Z'};
  return json(route,{report:{
   sessionId:'session-1',schoolId:'school-1',classId:'class-1',subjectId:'subject-1',teacherId:'teacher-1',status:'ended',
   startedAt:'2026-09-28T09:01:00Z',endedAt:'2026-09-28T09:10:00Z',durationMinutes:9,
   roster:{expected:2,joined:1,absentFromSession:1,present:1,late:0,absent:0,excused:1},
   attendance:attendanceRows.map(x=>({studentId:x.studentId,status:x.attendanceStatus,joinedAt:x.joinedAt,joinedMethod:x.joinedMethod,attendanceOverriddenBy:x.attendanceOverriddenBy,attendanceOverriddenAt:x.attendanceOverriddenAt})),
   batches:[],questions:[],totals:{responses:1,correct:1}
  },finalizedAt:'2026-09-28T09:10:00Z'});
 });

 await page.goto('/school-teacher-dashboard');
 await expect(page.getByRole('heading',{name:'الفصل الذكي'})).toBeVisible();
 await page.getByRole('button',{name:/٢ \+ ٢/}).click();
 await page.getByRole('button',{name:'إنشاء الحصة'}).click();
 await expect(page.getByText('654321')).toBeVisible();
 await expect(page.getByTestId('classroom-join-qr')).toBeVisible();
 await page.getByRole('button',{name:'بدء الحصة'}).click();
 await page.getByRole('button',{name:'نشر السؤال الأول'}).click();
 await expect(page.getByTestId('classroom-attendance')).toContainText('سارة');
 await page.getByLabel('حضور أحمد').selectOption('excused');
 await expect.poll(()=>attendanceWrites).toBe(1);
 await expect(page.getByTestId('classroom-attendance')).toContainText('بعذر 1');
 await page.getByRole('button',{name:'بدء التحدي'}).click();
 await expect.poll(()=>challengeConfigured).toBe(1);
 await expect(page.getByTestId('classroom-challenge')).toContainText('100');
 await expect(page.getByTestId('classroom-challenge')).toContainText('سارة');
 await page.getByRole('button',{name:'إظهار الحل'}).click();
 await expect(page.getByText('لأن ٢ + ٢ = ٤')).toBeVisible();
 await page.getByRole('button',{name:'إنهاء الحصة وحفظ التقرير'}).click();
 await expect(page.getByRole('heading',{name:'التقرير النهائي'})).toBeVisible();
 await expect(page.getByText('بعذر')).toBeVisible();
 expect(headers.every(x=>x==='csrf-token')).toBeTruthy();
 await page.screenshot({path:'test-results/classroom-teacher-desktop.png',fullPage:true});
});

test('student joins from QR, revises answer, and restores server truth after reconnect',async({page})=>{
 await auth(page,student);
 await page.setViewportSize({width:390,height:844});
 await page.routeWebSocket('**/api/v1/classroom/sessions/**/stream',()=>{});
 const live={...baseSession,status:'live',activeBatchId:'batch-1',activeQuestionOrdinal:0,revision:3,startedAt:'2026-09-28T09:01:00Z'};
 let selected:number|null=null;let answerWrites=0;let qrJoinBody:any=null;
 let joinByPinHeader='',joinHeader='',answerHeader='';
 await page.route('**/api/v1/classroom/join-by-pin',route=>{
  joinByPinHeader=route.request().headers()['x-csrf-token']||'';qrJoinBody=route.request().postDataJSON();
  return json(route,{participant:{sessionId:'session-1',studentId:'student-1',joinedAt:'2026-09-28T09:01:00Z',joinedMethod:'qr',attendanceStatus:'present'},session:live});
 });
 await page.route('**/api/v1/classroom/sessions/session-1/join',route=>{
  joinHeader=route.request().headers()['x-csrf-token']||'';
  return json(route,{participant:{sessionId:'session-1',studentId:'student-1',joinedAt:'2026-09-28T09:01:00Z',joinedMethod:'qr',attendanceStatus:'present'},session:live});
 });
 await page.route('**/api/v1/classroom/sessions/session-1/current',route=>{const now=new Date();return json(route,{state:{
  sessionId:'session-1',status:'live',publishedMode:'single',activeBatchId:'batch-1',activeQuestionOrdinal:0,
  challenge:{sessionId:'session-1',activeBatchId:'batch-1',competitionEnabled:true,challengeDurationSeconds:120,timerStartedAt:now.toISOString(),timerEndsAt:new Date(now.getTime()+120_000).toISOString(),expired:false,serverNow:now.toISOString()},
  questions:[{ordinal:0,questionId:'question-1',questionVersion:3,text:'٢ + ٢ = ؟',imageAssetId:'',imageAlt:'',
   optionsEmbeddedInImage:false,options:[{index:0,text:'٣',assetId:''},{index:1,text:'٤',assetId:''}],
   difficulty:'easy',revealed:false,correctOptionIndex:null,explanation:'',selectedOptionIndex:selected}]
 }});});
 await page.route('**/api/v1/classroom/sessions/session-1/answers/0',route=>{
  answerHeader=route.request().headers()['x-csrf-token']||'';answerWrites++;
  const body=route.request().postDataJSON() as{selectedOptionIndex:number};selected=body.selectedOptionIndex;
  return json(route,{response:{questionOrdinal:0,selectedOptionIndex:selected,submittedAt:'2026-09-28T09:04:00Z'}});
 });

 await page.goto('/classroom/join?pin=654321');
 await expect.poll(()=>new URL(page.url()).pathname).toBe('/classroom/session-1');
 await expect.poll(()=>qrJoinBody).toMatchObject({pin:'654321',method:'qr'});
 await expect(page.getByRole('heading',{name:'الحصة التفاعلية'})).toBeVisible();
 await expect(page.getByText('تم كشف الحل بواسطة المعلم')).toHaveCount(0);
 await expect(page.getByTestId('student-challenge-timer')).toBeVisible();
 await page.getByTestId('classroom-answer-0-0').click();
 await expect.poll(()=>selected).toBe(0);
 await page.getByTestId('classroom-answer-0-1').click();
 await expect.poll(()=>selected).toBe(1);
 expect(answerWrites).toBe(2);
 await page.reload();
 await expect(page.getByTestId('classroom-answer-0-1')).toHaveAttribute('aria-pressed','true');
 await expect(page.getByText('تم كشف الحل بواسطة المعلم')).toHaveCount(0);
 expect(joinByPinHeader).toBe('csrf-token');expect(joinHeader).toBe('csrf-token');expect(answerHeader).toBe('csrf-token');
 await page.screenshot({path:'test-results/classroom-student-mobile.png',fullPage:true});
});

test('projector lobby exposes PIN and QR without student identity',async({page})=>{
 await auth(page,teacher);
 await page.addInitScript(()=>sessionStorage.setItem('almeaa:classroom:pin:session-1','654321'));
 await page.routeWebSocket('**/api/v1/classroom/sessions/**/stream',()=>{});
 await page.route('**/api/v1/classroom/sessions/session-1/presentation',route=>json(route,{presentation:{
  sessionId:'session-1',status:'live',publishedMode:'single',activeBatchId:'',activeQuestionOrdinal:null,questions:[],challenge:null,
  aggregate:{sessionId:'session-1',status:'live',activeBatchId:'',activeQuestionOrdinal:null,joinedCount:0,questions:[]}
 }}));
 await page.goto('/classroom/session-1/projector');
 await expect(page.getByTestId('classroom-join-qr')).toBeVisible();
 await expect(page.locator('section').getByText('654321',{exact:true})).toBeVisible();
 await expect(page.getByText('سارة',{exact:true})).toHaveCount(0);
 await page.screenshot({path:'test-results/classroom-projector-lobby.png',fullPage:true});
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
  expect(body.modules).toContain('SMART_CLASSROOM');expect(body.expectedRevision).toBe(0);
  return json(route,{contract:{id:'contract-1',schoolId:'school-1',status:'active',modules:body.modules,validFrom:null,validUntil:null,revision:1,createdAt:'2026-09-28T09:00:00Z',updatedAt:'2026-09-28T09:00:00Z'}});
 });
 await page.goto('/admin-dashboard/classroom');
 await expect(page.getByRole('heading',{name:'تفعيل الفصل الذكي للمدارس'})).toBeVisible();
 await expect(page.getByLabel('تفعيل الفصل الذكي')).not.toBeChecked();
 await page.getByLabel('تفعيل الفصل الذكي').check();
 await page.getByRole('button',{name:'حفظ العقد'}).click();
 await expect(page.getByText('تم تفعيل Smart Classroom بعقد المدرسة.')).toBeVisible();
});
