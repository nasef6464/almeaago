import{expect,test,type Page,type Route}from'@playwright/test';
const user={id:'student-1',email:'student@example.com',name:'طالب',status:'active',avatarUrl:'',emailVerified:true,role:'student',roles:['student']};
const attempt={id:'attempt-1',assessmentId:'assessment-1',assessmentVersion:2,attemptNumber:1,status:'in_progress',title:'محاكي كمي',startedAt:'2026-09-26T10:00:00Z',expiresAt:null,submittedAt:null,showProgressBar:true,requireAnswerBeforeNext:false,allowQuestionReview:true,randomizeOptions:false,questions:[{id:'q-1',version:3,sectionId:'',sortOrder:1,points:1,type:'mcq',text:'٢ + ٢ = ؟',imageAssetId:'',imageAlt:'',optionsEmbeddedInImage:false,videoUrl:'',difficulty:'easy',options:[{index:0,text:'٣',assetId:''},{index:1,text:'٤',assetId:''}]}],answers:[]};
function json(r:Route,b:unknown,s=200){return r.fulfill({status:s,contentType:'application/json',body:JSON.stringify(b)})}
async function mock(page:Page){await page.route('**/api/v1/auth/me',r=>json(r,{user}));await page.route('**/api/v1/auth/csrf',r=>json(r,{csrfToken:'csrf'}));await page.route('**/api/v1/assessments/assessment-1/attempts',r=>json(r,{attempt}));await page.route('**/api/v1/assessment-attempts/attempt-1/answers/q-1',r=>json(r,{attempt:{...attempt,answers:[{questionId:'q-1',selectedOptionIndex:1,textAnswer:'',timeSpentSeconds:0,markedForReview:false,lastSavedAt:'2026-09-26T10:01:00Z'}]}}));await page.route('**/api/v1/assessment-attempts/attempt-1/submit',r=>json(r,{result:{attemptId:'attempt-1',score:100,totalQuestions:1,correctAnswers:1,wrongAnswers:0,unanswered:0,passed:true,timeSpentSeconds:12,finalizedAt:'2026-09-26T10:02:00Z'}}))}
test.beforeEach(async({page})=>{await page.route('**/api/v1/assessment-attempts/*/questions/*/time',r=>json(r,{timeSpentSeconds:r.request().postDataJSON().timeSpentSeconds}));});
test('late rejected answer does not block timeout submission',async({page})=>{
  test.setTimeout(120_000);
  await mock(page);
  await page.route('**/api/v1/assessments/assessment-1/attempts',r=>json(r,{attempt:{...attempt,expiresAt:new Date(Date.now()+12000).toISOString()}}));
  await page.route('**/api/v1/assessment-attempts/attempt-1/answers/q-1',r=>json(r,{message:'Attempt expired'},409));
  await page.route('**/api/v1/assessment-attempts/attempt-1/questions/q-1/time',r=>json(r,{message:'Attempt expired'},409));
  await page.goto('/assessments/assessment-1/start',{waitUntil:'domcontentloaded'});
  await page.getByRole('button',{name:/٤/}).click();
  await expect(page.getByRole('heading',{name:'تم تسليم الاختبار'})).toBeVisible({timeout:30000});
});
test('disconnected draft does not block submission after reconnecting at timeout',async({page})=>{
  test.setTimeout(120_000);
  await mock(page);
  let saves=0;
  await page.route('**/api/v1/assessments/assessment-1/attempts',r=>json(r,{attempt:{...attempt,expiresAt:new Date(Date.now()+12000).toISOString()}}));
  await page.route('**/api/v1/assessment-attempts/attempt-1/answers/q-1',r=>{ saves++; return json(r,{message:saves===1?'connection unavailable':'Attempt expired'},saves===1?503:409); });
  await page.route('**/api/v1/assessment-attempts/attempt-1/questions/q-1/time',r=>json(r,{message:'Attempt expired'},409));
  await page.goto('/assessments/assessment-1/start',{waitUntil:'domcontentloaded'});
  await page.getByRole('button',{name:/٤/}).click();
  await expect(page.getByRole('heading',{name:'تم تسليم الاختبار'})).toBeVisible({timeout:30000});
});
test('countdown uses server time when the device clock is wrong',async({page})=>{
  test.setTimeout(120_000);
  await mock(page);
  const now=Date.now();
  await page.clock.setFixedTime(new Date(now+3600_000));
  await page.route('**/api/v1/assessments/assessment-1/attempts',r=>json(r,{attempt:{...attempt,serverTime:new Date(now).toISOString(),expiresAt:new Date(now+120_000).toISOString()}}));
  await page.goto('/assessments/assessment-1/start',{waitUntil:'domcontentloaded'});
  await expect(page.getByRole('heading',{name:'محاكي كمي'})).toBeVisible({timeout:30000});
  await expect(page.getByText(/متبقي: 0[12]:\d{2}/)).toBeVisible();
  await expect(page.getByRole('heading',{name:'تم تسليم الاختبار'})).toHaveCount(0);
});
test('image question hides AI text and choice text and shows labels only',async({page})=>{
  test.setTimeout(120_000);
  await mock(page);
  const visual={...attempt.questions[0],text:'نص للذكاء الاصطناعي',passage:'قطعة للذكاء الاصطناعي',imageUrl:'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg"/>',optionsEmbeddedInImage:false,learnerPresentation:{optionLabelStyle:'latin',showOptionText:true,showOptionLabels:false},options:[{index:0,text:'الأول',assetId:''},{index:1,text:'الثاني',assetId:''}]};
  await page.route('**/api/v1/assessments/assessment-1/attempts',r=>json(r,{attempt:{...attempt,title:'اختبار الفيزياء',questions:[visual]}}));
  await page.goto('/assessments/assessment-1/start',{waitUntil:'domcontentloaded'});
  await expect(page.getByRole('button',{name:'A',exact:true})).toBeVisible({timeout:30000});
  await expect(page.getByRole('button',{name:'B',exact:true})).toBeVisible();
  await expect(page.getByText('نص للذكاء الاصطناعي')).toHaveCount(0);
  await expect(page.getByText('قطعة للذكاء الاصطناعي')).toHaveCount(0);
  await expect(page.getByText('الأول',{exact:true})).toHaveCount(0);
  await expect(page.getByText('الثاني',{exact:true})).toHaveCount(0);
});

test('text question shows question and written choices',async({page})=>{
  await mock(page);
  await page.goto('/assessments/assessment-1/start',{waitUntil:'domcontentloaded'});
  await expect(page.getByText('٢ + ٢ = ؟')).toBeVisible();
  await expect(page.getByRole('button',{name:/٣/})).toBeVisible();
  await expect(page.getByRole('button',{name:/٤/})).toBeVisible();
});
test('question ribbon cannot skip an unanswered required question',async({page})=>{
  test.setTimeout(120_000);
  await mock(page);
  const second={...attempt.questions[0],id:'q-2',text:'السؤال الثاني',sortOrder:2};
  await page.route('**/api/v1/assessments/assessment-1/attempts',r=>json(r,{attempt:{...attempt,kind:'normal',requireAnswerBeforeNext:true,questions:[attempt.questions[0],second]}}));
  await page.route('**/api/v1/assessment-attempts/attempt-1/answers/q-1',r=>json(r,{attempt:{...attempt,kind:'normal',requireAnswerBeforeNext:true,questions:[attempt.questions[0],second],answers:[{questionId:'q-1',selectedOptionIndex:1,textAnswer:'',timeSpentSeconds:0,markedForReview:false,lastSavedAt:new Date().toISOString()}]}}));
  await page.goto('/assessments/assessment-1/start',{waitUntil:'domcontentloaded'});
  await expect(page.getByRole('heading',{name:'٢ + ٢ = ؟'})).toBeVisible({timeout:30000});
  await expect(page.getByRole('button',{name:'2',exact:true})).toBeDisabled();
  await expect(page.getByRole('button',{name:'التالي'})).toBeDisabled();
  await page.getByRole('button',{name:/٤/}).click();
  await expect(page.getByRole('heading',{name:'٢ + ٢ = ؟'})).toBeVisible();
  await expect(page.getByRole('button',{name:'التالي'})).toBeEnabled();
  await page.getByRole('button',{name:'التالي'}).click();
  await expect(page.getByRole('heading',{name:'السؤال الثاني'})).toBeVisible();
});
test('mock permits moving past unanswered question despite ordinary-test setting',async({page})=>{
  test.setTimeout(180_000);
  await mock(page);
  const second={...attempt.questions[0],id:'q-2',text:'السؤال الثاني',sortOrder:2};
  await page.route('**/api/v1/assessments/assessment-1/attempts',r=>json(r,{attempt:{...attempt,kind:'mock',requireAnswerBeforeNext:true,questions:[attempt.questions[0],second]}}));
  await page.goto('/tests/e2e/fixtures/attempt-isolated.html',{waitUntil:'domcontentloaded'});
  await expect(page.getByRole('heading',{name:'٢ + ٢ = ؟'})).toBeVisible({timeout:60000});
  await expect(page.getByRole('button',{name:'2',exact:true})).toBeEnabled();
  await page.getByRole('button',{name:'التالي'}).click();
  await expect(page.getByRole('heading',{name:'السؤال الثاني'})).toBeVisible();
});
test('active time of an unanswered question survives navigation and is not counted as an answer',async({page})=>{
  test.setTimeout(120_000);
  await page.clock.install();
  await mock(page);
  const second={...attempt.questions[0],id:'q-2',text:'السؤال الثاني',sortOrder:2};
  let savedSeconds=0;
  const makeAttempt=()=>({...attempt,questions:[attempt.questions[0],second],answers:savedSeconds?[{questionId:'q-1',selectedOptionIndex:null,textAnswer:'',timeSpentSeconds:savedSeconds,markedForReview:false,lastSavedAt:new Date().toISOString()}]:[]});
  await page.route('**/api/v1/assessments/assessment-1/attempts',r=>json(r,{attempt:makeAttempt()}));
  await page.route('**/api/v1/assessment-attempts/attempt-1/questions/q-1/time',r=>{
    const body=r.request().postDataJSON();
    savedSeconds=body.timeSpentSeconds;
    expect(savedSeconds).toBeGreaterThanOrEqual(3);
    return json(r,{timeSpentSeconds:savedSeconds});
  });
  await page.goto('/assessments/assessment-1/start',{waitUntil:'domcontentloaded'});
  await expect(page.getByRole('heading',{name:'٢ + ٢ = ؟'})).toBeVisible({timeout:30000});
  await page.bringToFront();
  await page.clock.fastForward(3500);
  await page.getByRole('button',{name:'التالي'}).click();
  await expect(page.getByRole('heading',{name:'السؤال الثاني'})).toBeVisible();
  await page.getByRole('button',{name:'السابق'}).click();
  await expect(page.getByText('لم تُجب بعد')).toBeVisible();
  expect(savedSeconds).toBeGreaterThanOrEqual(3);
  await page.clock.fastForward(2200);
  await page.reload({waitUntil:'domcontentloaded'});
  await expect(page.getByRole('heading',{name:'٢ + ٢ = ؟'})).toBeVisible({timeout:30000});
  await page.bringToFront();
  await page.clock.fastForward(1200);
  await page.getByRole('button',{name:'التالي'}).click();
  await expect(page.getByRole('heading',{name:'السؤال الثاني'})).toBeVisible();
  expect(savedSeconds).toBeGreaterThanOrEqual(5);
});
test('question time pauses on visibility change',async({page})=>{
  test.setTimeout(120_000);
  await page.clock.install();
  await mock(page);
  const second={...attempt.questions[0],id:'q-2',text:'السؤال الثاني',sortOrder:2};
  let savedSeconds=-1;
  await page.route('**/api/v1/assessments/assessment-1/attempts',r=>json(r,{attempt:{...attempt,questions:[attempt.questions[0],second]}}));
  await page.route('**/api/v1/assessment-attempts/attempt-1/questions/q-1/time',r=>{
    savedSeconds=r.request().postDataJSON().timeSpentSeconds;
    return json(r,{timeSpentSeconds:savedSeconds});
  });
  await page.goto('/assessments/assessment-1/start',{waitUntil:'domcontentloaded'});
  await expect(page.getByRole('heading',{name:'٢ + ٢ = ؟'})).toBeVisible({timeout:30000});
  await page.bringToFront();
  await page.clock.fastForward(2500);
  await page.evaluate(()=>{Object.defineProperty(document,'visibilityState',{configurable:true,value:'hidden'});document.dispatchEvent(new Event('visibilitychange'));});
  await page.clock.fastForward(10000);
  await page.evaluate(()=>{Object.defineProperty(document,'visibilityState',{configurable:true,value:'visible'});document.dispatchEvent(new Event('visibilitychange'));});
  await page.clock.fastForward(1200);
  await page.getByRole('button',{name:'التالي'}).click();
  await expect(page.getByRole('heading',{name:'السؤال الثاني'})).toBeVisible();
  expect(savedSeconds).toBeGreaterThanOrEqual(3);
  expect(savedSeconds).toBeLessThan(8);
});
test('strict section can advance after its clock closes while a time checkpoint is late',async({page})=>{
  test.setTimeout(120_000);
  await mock(page);
  const section={id:'section-1',title:'القسم الأول',subjectId:'',sortOrder:1,timeLimitSeconds:60,domain:'quantitative',strictLock:true};
  const current={...attempt,kind:'mock',requireAnswerBeforeNext:true,mockPresentationMode:'qiyas_strict',mockStrictSectionLock:true,sections:[section],questions:[{...attempt.questions[0],sectionId:section.id}],sectionProgress:{currentSectionId:section.id,startedAt:new Date().toISOString(),deadline:null,finished:false,serverTime:new Date().toISOString()}};
  const finished={...current,questions:[],sectionProgress:{...current.sectionProgress,currentSectionId:'',finished:true}};
  await page.route('**/api/v1/assessments/assessment-1/attempts',r=>json(r,{attempt:current}));
  await page.route('**/api/v1/assessment-attempts/attempt-1/questions/q-1/time',r=>json(r,{message:'Attempt conflicts with assessment state'},409));
  await page.route('**/api/v1/assessment-attempts/attempt-1/sections/advance',r=>json(r,{attempt:finished}));
  await page.goto('/assessments/assessment-1/start',{waitUntil:'domcontentloaded'});
  await expect(page.getByRole('heading',{name:'٢ + ٢ = ؟'})).toBeVisible({timeout:30000});
  await page.waitForTimeout(2200);
  await page.getByRole('button',{name:'إنهاء القسم والانتقال'}).click();
  await page.getByRole('button',{name:'تأكيد الانتقال'}).click();
  await expect(page.getByRole('heading',{name:'تم تسليم الاختبار'})).toBeVisible({timeout:30000});
});
test('student starts autosaves submits and sees server result',async({page})=>{test.setTimeout(90_000);await mock(page);await page.setViewportSize({width:390,height:844});await page.goto('/assessments/assessment-1/start',{waitUntil:'domcontentloaded'});await expect(page.getByRole('heading',{name:'محاكي كمي'})).toBeVisible();await page.getByRole('button',{name:/٤/}).click();await expect(page.getByRole('button',{name:/٤/})).toHaveAttribute('aria-pressed','true');await page.getByRole('button',{name:'إنهاء الاختبار'}).click();await page.getByRole('button',{name:'نعم، قم بالتسليم'}).click();await expect(page.getByRole('heading',{name:'تم تسليم الاختبار'})).toBeVisible();await expect(page.getByText('100.0%')).toBeVisible();await page.screenshot({path:'test-results/assessment-attempt-mobile.png',fullPage:true})});

test('shuffled text options keep display letters while saving original identity', async ({page}) => {
  test.setTimeout(90000);
  await mock(page);
  const shuffled = {...attempt, randomizeOptions:true, questions:[{...attempt.questions[0], options:[{index:1,text:'٤',assetId:''},{index:0,text:'٣',assetId:''}]}]};
  await page.route('**/api/v1/assessments/assessment-1/attempts', route => json(route,{attempt:shuffled}));
  await page.goto('/assessments/assessment-1/start',{waitUntil:'domcontentloaded'});
  const first = page.getByRole('button',{name:/٤/});
  await expect(first).toContainText('أ');
  const request = page.waitForRequest(r=>r.url().endsWith('/answers/q-1') && r.method()==='PUT');
  await first.click();
  expect((await request).postDataJSON().selectedOptionIndex).toBe(1);
});

test('strict mock advances through server-authorized sections', async ({page}) => {
  test.setTimeout(90000);
  await mock(page);
  const sections=[{id:'section-1',title:'القسم الكمي',subjectId:'q',sortOrder:1,timeLimitSeconds:120,domain:'quantitative',strictLock:true},{id:'section-2',title:'القسم اللفظي',subjectId:'v',sortOrder:2,timeLimitSeconds:120,domain:'verbal',strictLock:true}];
  const first={...attempt, kind:'mock', mockPresentationMode:'qiyas_strict', mockStrictSectionLock:true, sections, sectionProgress:{currentSectionId:'section-1',startedAt:new Date().toISOString(),deadline:null,finished:false,serverTime:new Date().toISOString()},questions:[{...attempt.questions[0],sectionId:'section-1'}]};
  const second={...first,sectionProgress:{...first.sectionProgress,currentSectionId:'section-2'},questions:[{...attempt.questions[0],id:'q-2',text:'السؤال اللفظي',sectionId:'section-2'}]};
  await page.route('**/api/v1/assessments/assessment-1/attempts',route=>json(route,{attempt:first}));
  await page.route('**/api/v1/assessment-attempts/attempt-1/sections/advance',route=>json(route,{attempt:second}));
  await page.goto('/assessments/assessment-1/start',{waitUntil:'domcontentloaded'});
  await expect(page.getByText('القسم الكمي',{exact:true})).toBeVisible();
  const request=page.waitForRequest(r=>r.url().endsWith('/sections/advance') && r.method()==='POST');
  await page.getByRole('button',{name:'إنهاء القسم والانتقال'}).click();
  await expect(page.getByRole('dialog',{name:'تأكيد إنهاء القسم'})).toBeVisible();
  await page.getByRole('button',{name:'تأكيد الانتقال'}).click();
  expect((await request).postDataJSON()).toEqual({expectedSectionId:'section-1'});
  await expect(page.getByText('القسم اللفظي',{exact:true})).toBeVisible();
  await expect(page.getByText('السؤال اللفظي',{exact:true})).toBeVisible();
});

test('strict mock refreshes server state after a section deadline', async ({page}) => {
  test.setTimeout(90000);
  await mock(page);
  const sections=[{id:'section-1',title:'القسم الكمي',subjectId:'q',sortOrder:1,timeLimitSeconds:1,domain:'quantitative',strictLock:true},{id:'section-2',title:'القسم اللفظي',subjectId:'v',sortOrder:2,timeLimitSeconds:120,domain:'verbal',strictLock:true}];
  const now=Date.now();
  const first={...attempt,kind:'mock',mockPresentationMode:'qiyas_strict',mockStrictSectionLock:true,sections,sectionProgress:{currentSectionId:'section-1',startedAt:new Date(now).toISOString(),deadline:new Date(now+1000).toISOString(),finished:false,serverTime:new Date(now).toISOString()},questions:[{...attempt.questions[0],sectionId:'section-1'}]};
  const second={...first,sectionProgress:{...first.sectionProgress,currentSectionId:'section-2',deadline:null},questions:[{...attempt.questions[0],id:'q-2',text:'السؤال اللفظي',sectionId:'section-2'}]};
  await page.route('**/api/v1/assessments/assessment-1/attempts',route=>json(route,{attempt:first}));
  await page.route('**/api/v1/assessment-attempts/attempt-1',route=>json(route,{attempt:second}));
  await page.goto('/assessments/assessment-1/start',{waitUntil:'domcontentloaded'});
  await expect(page.getByText('السؤال اللفظي',{exact:true})).toBeVisible({timeout:15000});
});

test('finishing final strict section submits the attempt', async ({page}) => {
 test.setTimeout(90000);
 await mock(page);
 const section={id:'section-final',title:'القسم الأخير',subjectId:'q',sortOrder:1,timeLimitSeconds:120,domain:'quantitative',strictLock:true};
 const first={...attempt,kind:'mock',mockPresentationMode:'qiyas_strict',mockStrictSectionLock:true,sections:[section],sectionProgress:{currentSectionId:section.id,startedAt:new Date().toISOString(),deadline:null,finished:false,serverTime:new Date().toISOString()},questions:[{...attempt.questions[0],sectionId:section.id}]};
 const finished={...first,sectionProgress:{...first.sectionProgress,currentSectionId:'',finished:true},questions:[]};
 await page.route('**/api/v1/assessments/assessment-1/attempts',route=>json(route,{attempt:first}));
 await page.route('**/api/v1/assessment-attempts/attempt-1/sections/advance',route=>json(route,{attempt:finished}));
 await page.goto('/assessments/assessment-1/start',{waitUntil:'domcontentloaded'});
 await page.getByRole('button',{name:'إنهاء القسم والانتقال'}).click();
 await page.getByRole('button',{name:'تأكيد الانتقال'}).click();
 await expect(page.getByRole('heading',{name:'تم تسليم الاختبار'})).toBeVisible();
});
