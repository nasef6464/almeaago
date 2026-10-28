import { expect, test, type Page, type Route } from './fixtures/header-test';

const director={
  id:'director-1',email:'director@example.com',name:'مدير المدرسة',status:'active',avatarUrl:'',emailVerified:true,
  role:'school_admin',roles:['school_admin'],
};

function json(route:Route,body:unknown,status=200){
  return route.fulfill({status,contentType:'application/json',body:JSON.stringify(body)});
}
async function auth(page:Page){
  await page.route('**/api/v1/auth/me',route=>json(route,{user:director}));
  await page.route('**/api/v1/auth/csrf',route=>json(route,{csrfToken:'csrf-director'}));
}
const classes=[
  {id:'class-1',schoolId:'school-1',code:'A1',name:'الأول أ',status:'active'},
  {id:'class-2',schoolId:'school-1',code:'A2',name:'الأول ب',status:'active'},
];
const student={studentId:'student-1',name:'طالب أول',email:'s1@example.com',phone:'0501234567',isActive:true,classId:'class-1',className:'الأول أ'};
const schoolOneOverview={school:{schoolId:'school-1',schoolName:'مدرسة المئة'},metrics:{students:12,classes:2,teachers:1,supervisors:3,schoolAssessments:7,completedSmartClasses:4},classes:[{classId:'class-1',className:'الأول أ'},{classId:'class-2',className:'الأول ب'}]};
const schoolTwoOverview={school:{schoolId:'school-2',schoolName:'مدرسة ثانية'},metrics:{students:21,classes:1,teachers:2,supervisors:1,schoolAssessments:5,completedSmartClasses:8},classes:[{classId:'class-b',className:'الثاني أ'}]};
const permissions=[
  'SCHOOL_OVERVIEW_VIEW','SCHOOL_STUDENTS_VIEW','SCHOOL_STUDENTS_ADD','SCHOOL_STUDENTS_MOVE_CLASS',
  'SCHOOL_STUDENTS_UPDATE_BASIC','SCHOOL_STUDENTS_DEACTIVATE','SCHOOL_CLASSES_MANAGE','SCHOOL_TEACHERS_ASSIGN',
];

async function mockDirector(page:Page,modules=['SCHOOL_CORE']){
  await auth(page);
  await page.route('**/api/v1/taxonomy/bootstrap?phase=core',route=>json(route,{levels:[],paths:[{id:'path-1',name:'قدرات'}],subjects:[{id:'subject-1',pathId:'path-1',name:'الرياضيات',code:'MATH',sortOrder:1}]}));
  await page.route('**/api/v1/schools/context',route=>json(route,{contexts:[
    {schoolId:'school-1',schoolName:'مدرسة المئة',role:'school_admin',permissions,modules,source:'membership'},
    {schoolId:'school-2',schoolName:'مدرسة ثانية',role:'school_admin',permissions:['SCHOOL_OVERVIEW_VIEW','SCHOOL_STUDENTS_VIEW'],modules:['SCHOOL_CORE'],source:'membership'},
  ]}));
  await page.route('**/api/v1/schools/school-1/classes*',route=>json(route,{classes,pagination:{page:1,limit:100,total:2,totalPages:1}}));
  await page.route('**/api/v1/schools/school-2/classes*',route=>json(route,{classes:[{id:'class-b',schoolId:'school-2',code:'B1',name:'الثاني أ',status:'active'}],pagination:{page:1,limit:100,total:1,totalPages:1}}));
  await page.route('**/api/school-access/director/schools/school-1/overview',route=>json(route,schoolOneOverview));
  await page.route('**/api/school-access/director/schools/school-2/overview',route=>json(route,schoolTwoOverview));
  await page.route('**/api/school-access/director/schools/school-1/students*',route=>json(route,{students:[student],total:1}));
  await page.route('**/api/school-access/director/schools/school-2/students*',route=>json(route,{students:[],total:0}));
  await page.route('**/api/school-access/director/schools/school-1/teachers',route=>json(route,{
    teachers:[{teacherId:'teacher-1',name:'معلم المدرسة',email:'teacher@example.com',isActive:true}],
    assignments:[],
  }));
}

async function openDirectorSection(page:Page,label:string){
  await page.getByRole('navigation',{name:'أقسام لوحة مدير المدرسة'}).getByRole('button',{name:label,exact:true}).click();
}

test('school director desktop runs bounded student class and teacher operations',async({page})=>{
  await mockDirector(page);
  let addCsrf='',moveCsrf='',classCsrf='',assignmentCsrf='';

  await page.route('**/api/school-access/director/schools/school-1/students',async route=>{
    if(route.request().method()==='POST'){
      addCsrf=route.request().headers()['x-csrf-token']||'';
      return json(route,{student:{...student,studentId:'student-2',name:'طالب جديد',email:'new@example.com'},created:true},201);
    }
    return route.fallback();
  });
  await page.route('**/api/school-access/director/schools/school-1/students/student-1/class',route=>{
    moveCsrf=route.request().headers()['x-csrf-token']||'';
    return json(route,{student:{...student,classId:'class-2',className:'الأول ب'},idempotent:false});
  });
  await page.route('**/api/school-access/director/schools/school-1/classes',route=>{
    classCsrf=route.request().headers()['x-csrf-token']||'';
    return json(route,{classroom:{classId:'class-3',className:'الأول ج'}},201);
  });
  await page.route('**/api/school-access/director/schools/school-1/assignments',route=>{
    assignmentCsrf=route.request().headers()['x-csrf-token']||'';
    expect(route.request().postDataJSON().subjectId).toBe('subject-1');
    return json(route,{assignment:{assignmentId:'assignment-1',teacherId:'teacher-1',classId:'class-1',subjectId:'subject-1',status:'active'}});
  });

  await page.setViewportSize({width:1440,height:1000});
  await page.goto('/school-director-dashboard');

  await expect(page.getByRole('heading',{name:'لوحة مدير المدرسة'})).toBeVisible();
  await expect(page.getByText('نطاق مفوض من مدير المنصة')).toBeVisible();
  await expect(page.getByRole('region',{name:'مركز تشغيل مدير المدرسة'})).toContainText('قيد النقل');
  await expect(page.getByRole('region',{name:'مركز تشغيل مدير المدرسة'}).getByRole('link')).toHaveCount(0);

  await openDirectorSection(page,'الطلاب');
  await expect(page.getByText('طلاب مدرسة المئة')).toBeVisible();
  await expect(page.getByText('طالب أول')).toBeVisible();
  await page.getByRole('button',{name:'إضافة طالب'}).click();
  await page.getByLabel('اسم الطالب الجديد').fill('طالب جديد');
  await page.getByLabel('بريد الطالب الجديد').fill('new@example.com');
  await page.getByLabel('كلمة مرور الطالب الجديد').fill('Password1');
  await page.getByLabel('فصل الطالب الجديد').selectOption('class-1');
  await page.getByRole('button',{name:'إنشاء وربط'}).click();
  await expect(page.getByText('تم إنشاء الطالب وربطه بالمدرسة والفصل.')).toBeVisible();
  expect(addCsrf).toBe('csrf-director');

  await page.getByLabel('فصل طالب أول').selectOption('class-2');
  await expect(page.getByText('تم نقل الطالب داخل المدرسة وحفظ الفصل الجديد.')).toBeVisible();
  expect(moveCsrf).toBe('csrf-director');

  await openDirectorSection(page,'الفصول');
  await page.getByLabel('اسم فصل جديد').fill('الأول ج');
  await page.getByRole('button',{name:'إنشاء الفصل'}).click();
  await expect(page.getByText('تم إنشاء الفصل داخل المدرسة.')).toBeVisible();
  expect(classCsrf).toBe('csrf-director');

  await openDirectorSection(page,'المعلمون والتكليفات');
  await page.getByLabel('المعلم',{exact:true}).selectOption('teacher-1');
  await page.getByLabel('فصل التكليف').selectOption('class-1');
  await expect(page.getByRole('button',{name:'حفظ التكليف'})).toBeDisabled();
  await page.getByLabel('مادة التكليف').selectOption('subject-1');
  await page.getByRole('button',{name:'حفظ التكليف'}).click();
  await expect(page.getByText('تم حفظ تكليف المعلم.')).toBeVisible();
  expect(assignmentCsrf).toBe('csrf-director');

  await expect(page.getByRole('button',{name:/حذف/})).toHaveCount(0);
  await page.screenshot({path:'test-results/organizations-director-desktop.png',fullPage:true});
});

test('overview-only school admin sees all six authorized metrics without private roster requests',async({page})=>{
  await mockDirector(page,[]);
  await page.route('**/api/v1/schools/context',route=>json(route,{contexts:[
    {schoolId:'school-1',schoolName:'مدرسة المئة',role:'school_admin',permissions:['SCHOOL_OVERVIEW_VIEW'],modules:[],source:'membership'},
  ]}));
  let forbiddenCalls=0;
  await page.route('**/api/v1/schools/school-1/classes*',route=>{forbiddenCalls++;return json(route,{message:'not delegated'},403)});
  await page.route('**/api/school-access/director/schools/school-1/students*',route=>{forbiddenCalls++;return json(route,{message:'not delegated'},403)});
  await page.route('**/api/school-access/director/schools/school-1/teachers',route=>{forbiddenCalls++;return json(route,{message:'not delegated'},403)});
  await page.goto('/school-director-dashboard');
  const metrics=page.getByRole('region',{name:'مؤشرات المدرسة'});
  for(const [label,value] of [['الطلاب','12'],['الفصول','2'],['المعلمون','1'],['المشرفون','3'],['اختبارات المدرسة','7'],['فصول ذكية مكتملة','4']]){
    await expect(metrics.locator('article').filter({hasText:label})).toContainText(value);
  }
  await expect(page.getByRole('heading',{name:'طلاب مدرسة المئة'})).toHaveCount(0);
  await expect(page.getByRole('button',{name:'إضافة طالب'})).toHaveCount(0);
  await expect(page.getByRole('region',{name:'مركز تشغيل مدير المدرسة'}).getByRole('link')).toHaveCount(0);
  expect(forbiddenCalls).toBe(0);
});

test('school admin with no delegated director permissions gets no metrics or route shortcuts',async({page})=>{
  await mockDirector(page,[]);
  await page.route('**/api/v1/schools/context',route=>json(route,{contexts:[
    {schoolId:'school-1',schoolName:'مدرسة المئة',role:'school_admin',permissions:[],modules:[],source:'membership'},
  ]}));
  let overviewCalls=0;
  await page.route('**/api/school-access/director/schools/school-1/overview',route=>{overviewCalls++;return json(route,{message:'forbidden'},403)});
  await page.goto('/school-director-dashboard');
  await expect(page.getByText('ليس لديك أقسام مفعّلة في لوحة هذه المدرسة حاليًا.')).toBeVisible();
  await expect(page.getByRole('region',{name:'مؤشرات المدرسة'})).toHaveCount(0);
  await expect(page.getByRole('region',{name:'مركز تشغيل مدير المدرسة'}).getByRole('link')).toHaveCount(0);
  expect(overviewCalls).toBe(0);
});

test('director follows legacy section order with only implemented permitted links',async({page})=>{
  await mockDirector(page);
  await page.goto('/school-director-dashboard');
  const nav=page.getByRole('navigation',{name:'أقسام لوحة مدير المدرسة'});
  await expect(nav.getByRole('button')).toHaveCount(4);
  const labels=await nav.getByRole('button').allTextContents();
  expect(labels.map(x=>x.trim())).toEqual(['الملخص العام','الطلاب','الفصول','المعلمون والتكليفات']);
  await nav.getByRole('button',{name:'الطلاب'}).click();
  await expect(page.getByRole('heading',{name:'طلاب مدرسة المئة'})).toBeVisible();
  await expect(page.getByRole('region',{name:'مؤشرات المدرسة'})).toHaveCount(0);
  await nav.getByRole('button',{name:'الفصول'}).click();
  await expect(page.getByRole('heading',{name:'إدارة الفصول'})).toBeVisible();
  await nav.getByRole('button',{name:'الملخص العام'}).click();
  await expect(page.getByRole('region',{name:'مؤشرات المدرسة'})).toBeVisible();
});

test('school assessments list is readable only with permission and active contract module',async({page})=>{
  await mockDirector(page,['SCHOOL_CORE','SCHOOL_ASSESSMENTS']);
  await page.route('**/api/v1/schools/context',route=>json(route,{contexts:[
    {schoolId:'school-1',schoolName:'مدرسة المئة',role:'school_admin',permissions:[...permissions,'SCHOOL_ASSESSMENTS_MANAGE'],modules:['SCHOOL_CORE','SCHOOL_ASSESSMENTS'],source:'membership'},
    {schoolId:'school-2',schoolName:'مدرسة ثانية',role:'school_admin',permissions:['SCHOOL_OVERVIEW_VIEW','SCHOOL_ASSESSMENTS_MANAGE'],modules:['SCHOOL_CORE'],source:'membership'},
  ]}));
  let reads=0;
  await page.route('**/api/school-access/director/schools/*/academic/assessments',route=>{
    reads++;
    return json(route,{assessments:[
      {id:'assessment-1',title:'اختبار الرياضيات',subjectId:'subject-1',isPublished:true,targetGroupIds:['class-1']},
      {id:'assessment-2',title:'مسودة اختبار العلوم',isPublished:false,targetGroupIds:[]},
    ],classes:[{classId:'class-1',className:'الأول أ'}]});
  });
  await page.goto('/school-director-dashboard');
  await openDirectorSection(page,'اختبارات المدرسة');
  const listing=page.getByRole('region',{name:'اختبارات المدرسة'});
  await expect(listing).toContainText('اختبار الرياضيات');
  await expect(listing).toContainText('مسودة اختبار العلوم');
  await expect(listing).toContainText('الأول أ');
  await expect(listing).toContainText('2');
  await expect(listing.getByRole('button',{name:'النتائج والإدارة'})).toHaveCount(2);
  await expect(listing.getByRole('button',{name:/نشر|حذف|تعديل|استنساخ/})).toHaveCount(0);
  expect(reads).toBe(1);
  await page.getByLabel('المدرسة',{exact:true}).selectOption('school-2');
  await expect(page.getByRole('navigation',{name:'أقسام لوحة مدير المدرسة'}).getByRole('button',{name:'اختبارات المدرسة'})).toHaveCount(0);
  await expect(page.getByText('اختبار الرياضيات')).toHaveCount(0);
  expect(reads).toBe(1);
});

test('director report shows only persisted aggregate scores on mobile and clears across school visits',async({page})=>{
  await mockDirector(page,['SCHOOL_CORE','SCHOOL_ASSESSMENTS']);
  await page.route('**/api/v1/schools/context',route=>json(route,{contexts:[
    {schoolId:'school-1',schoolName:'مدرسة المئة',role:'school_admin',permissions:[...permissions,'SCHOOL_ASSESSMENTS_MANAGE'],modules:['SCHOOL_CORE','SCHOOL_ASSESSMENTS'],source:'membership'},
    {schoolId:'school-2',schoolName:'مدرسة ثانية',role:'school_admin',permissions:['SCHOOL_OVERVIEW_VIEW'],modules:['SCHOOL_CORE'],source:'membership'},
  ]}));
  await page.route('**/api/school-access/director/schools/school-1/academic/assessments',route=>json(route,{
    assessments:[{id:'assessment-1',title:'اختبار النسبة',subjectId:'subject-1',isPublished:true,targetGroupIds:['class-1']}],
    classes:[{classId:'class-1',className:'الأول أ'}],
  }));
  let reportCalls=0;
  await page.route('**/api/school-access/director/schools/school-1/academic/assessments/assessment-1/report',route=>{
    reportCalls++;
    return json(route,{
      coverage:{complete:false,missingEvidence:['started_attempts','subject_totals'],subjects:{completed:1,withEvidence:0,complete:false}},
      audience:{targeted:2},participation:{completed:1,notCompleted:1,started:null},
      scores:{average:80,passRate:100,highest:80,lowest:80},
      subjects:[],sections:[],skills:[],subjectBreakdowns:[],
    });
  });
  await page.setViewportSize({width:390,height:844});
  await page.goto('/school-director-dashboard');
  await openDirectorSection(page,'اختبارات المدرسة');
  await page.getByRole('button',{name:'النتائج والإدارة'}).click();
  const dialog=page.getByRole('dialog',{name:'النتائج والإدارة — اختبار النسبة'});
  await expect(dialog).toBeVisible();
  const metrics=dialog.getByLabel('ملخص نتائج الاختبار');
  await expect(metrics.getByText('الطلاب المستهدفون').locator('..')).toContainText('٢');
  await expect(metrics.getByText('أكملوا الاختبار',{exact:true}).locator('..')).toContainText('١');
  await expect(metrics.getByText('متوسط الدرجات').locator('..')).toContainText('٨٠%');
  await expect(dialog).toContainText('بيانات من بدأوا الاختبار وتحليل المواد والمهارات ليست مكتملة');
  await expect(dialog.getByText('تفاصيل الطلاب وإجراءات تعديل أو نسخ أو إعادة فتح الاختبار')).toBeVisible();
  // React StrictMode can remount an effect in the test development server.
  // The privacy invariant is that switching schools never issues a stale
  // school-A report request, not that a read-only GET occurs exactly once.
  expect(reportCalls).toBeGreaterThanOrEqual(1);
  const beforeSchoolSwitch=reportCalls;
  await page.keyboard.press('Escape');
  await expect(dialog).toHaveCount(0);
  await page.getByLabel('المدرسة',{exact:true}).selectOption('school-2');
  await expect(page.getByRole('button',{name:'النتائج والإدارة'})).toHaveCount(0);
  expect(reportCalls).toBe(beforeSchoolSwitch);
});

test('detailed school assessment roster filters real results and opens redacted learner evidence on mobile',async({page})=>{
  await mockDirector(page,['SCHOOL_CORE','SCHOOL_ASSESSMENTS','SCHOOL_INTELLIGENCE']);
  await page.route('**/api/v1/schools/context',route=>json(route,{contexts:[
    {schoolId:'school-1',schoolName:'مدرسة المئة',role:'school_admin',permissions:[...permissions,'SCHOOL_ASSESSMENTS_MANAGE','SCHOOL_REPORTS_DETAILED_VIEW'],modules:['SCHOOL_CORE','SCHOOL_ASSESSMENTS','SCHOOL_INTELLIGENCE'],source:'membership'},
    {schoolId:'school-2',schoolName:'مدرسة ثانية',role:'school_admin',permissions:['SCHOOL_OVERVIEW_VIEW'],modules:['SCHOOL_CORE'],source:'membership'},
  ]}));
  await page.route('**/api/school-access/director/schools/school-1/academic/assessments',route=>json(route,{
    assessments:[{id:'assessment-1',title:'الاختبار المركزي',subjectId:'subject-1',isPublished:true,targetGroupIds:['class-1']}],classes:[],
  }));
  const base='**/api/school-access/director/schools/school-1/academic/assessments/assessment-1';
  await page.route(base+'/report',route=>json(route,{
    coverage:{complete:false,missingEvidence:['started_attempts'],subjects:{completed:1,withEvidence:0,complete:false}},
    audience:{targeted:13},participation:{completed:2,notCompleted:11,started:null},
    scores:{average:67.5,passRate:50,highest:90,lowest:45},subjects:[],sections:[],skills:[],subjectBreakdowns:[],
  }));
  const first={studentId:'student-1',name:'متعلم أ',result:{id:'attempt-1',score:45,passed:false,date:'2026-10-28T00:00:00Z',attemptNumber:2}};
  const second={studentId:'student-2',name:'متعلم ب',result:null};
  const seenQueries:string[]=[];
  await page.route(base+'/learners*',route=>{
    const url=new URL(route.request().url());const params=url.searchParams;
    seenQueries.push(params.toString());
    const status=params.get('status')||'all';const search=params.get('search')||'';const number=Number(params.get('page')||1);
    let learners=number===1?[first,second]:[{studentId:'student-13',name:'متعلم م',result:null}];
    let total=13;
    if(status==='needs_support'){learners=[first];total=1}
    if(search){learners=search==='متعلم ب'?[second]:[];total=learners.length}
    return json(route,{learners,pagination:{page:number,limit:12,total,totalPages:Math.ceil(total/12)}});
  });
  await page.route(base+'/results/attempt-1',route=>json(route,{result:{
    id:'attempt-1',studentId:'student-1',score:45,passed:false,attemptNumber:2,date:'2026-10-28T00:00:00Z',
    totalQuestions:20,correctAnswers:9,wrongAnswers:11,unanswered:0,timeSpentSeconds:800,
    sectionResults:[{id:'sec-1',name:'الجبر',score:60,totalQuestions:10,correctAnswers:6,wrongAnswers:4,unanswered:0}],
    skillsAnalysis:[{id:'skill-1',name:'المعادلات',score:40,totalQuestions:5,correctAnswers:2,wrongAnswers:3,unanswered:0}],
  }}));
  await page.setViewportSize({width:390,height:844});
  await page.goto('/school-director-dashboard');
  await openDirectorSection(page,'اختبارات المدرسة');
  await page.getByRole('button',{name:'النتائج والإدارة'}).click();
  const dialog=page.getByRole('dialog',{name:'النتائج والإدارة — الاختبار المركزي'});
  await dialog.getByRole('button',{name:'نتائج الطلاب'}).click();
  const roster=dialog.getByRole('region',{name:'نتائج الطلاب'});
  await expect(roster.getByText('متعلم أ')).toBeVisible();
  await expect(roster.getByText('متعلم ب')).toBeVisible();
  await roster.getByRole('button',{name:'عرض النتيجة'}).click();
  await expect(dialog.getByRole('region',{name:'تفاصيل نتيجة الطالب'})).toContainText('المعادلات');
  await expect(dialog.getByRole('region',{name:'تفاصيل نتيجة الطالب'})).toContainText('الجبر');
  await expect(dialog).not.toContainText('مفتاح الإجابة');
  await roster.getByLabel('حالة الأداء').selectOption('needs_support');
  await expect(roster).toContainText('١ طالب مطابق');
  await roster.getByLabel('حالة الأداء').selectOption('all');
  await roster.getByLabel('بحث عن طالب').fill('متعلم ب');
  await roster.getByRole('button',{name:'بحث'}).click();
  await expect(roster.getByText('متعلم ب')).toBeVisible();
  await expect(roster.getByText('متعلم أ')).toHaveCount(0);
  await roster.getByLabel('بحث عن طالب').fill('');
  await roster.getByRole('button',{name:'بحث'}).click();
  await roster.getByRole('button',{name:'التالي'}).click();
  await expect(roster.getByText('متعلم م')).toBeVisible();
  expect(seenQueries.some(query=>query.includes('status=needs_support'))).toBe(true);
  expect(seenQueries.some(query=>query.includes('search=%D9'))).toBe(true);
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth)).toBe(true);
  await page.setViewportSize({width:1440,height:900});
  await expect(roster.getByText('متعلم م')).toBeVisible();
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth)).toBe(true);
  await page.keyboard.press('Escape');
  await page.getByLabel('المدرسة',{exact:true}).selectOption('school-2');
  await expect(page.getByText('متعلم أ')).toHaveCount(0);
});

test('aggregate-only school report never requests private learner rows',async({page})=>{
  await mockDirector(page,['SCHOOL_CORE','SCHOOL_ASSESSMENTS']);
  await page.route('**/api/v1/schools/context',route=>json(route,{contexts:[
    {schoolId:'school-1',schoolName:'مدرسة المئة',role:'school_admin',permissions:[...permissions,'SCHOOL_ASSESSMENTS_MANAGE'],modules:['SCHOOL_CORE','SCHOOL_ASSESSMENTS'],source:'membership'},
  ]}));
  await page.route('**/api/school-access/director/schools/school-1/academic/assessments',route=>json(route,{
    assessments:[{id:'assessment-1',title:'اختبار النسبة',isPublished:true,targetGroupIds:[]}],classes:[],
  }));
  await page.route('**/api/school-access/director/schools/school-1/academic/assessments/assessment-1/report',route=>json(route,{
    coverage:{complete:false,missingEvidence:['started_attempts'],subjects:{completed:0,withEvidence:0,complete:false}},audience:{targeted:0},
    participation:{completed:0,notCompleted:0,started:null},scores:{average:null,passRate:null,highest:null,lowest:null},subjects:[],sections:[],skills:[],subjectBreakdowns:[],
  }));
  let privateReads=0;
  await page.route('**/learners*',route=>{privateReads++;return json(route,{message:'forbidden'},403)});
  await page.goto('/school-director-dashboard');await openDirectorSection(page,'اختبارات المدرسة');
  await page.getByRole('button',{name:'النتائج والإدارة'}).click();
  await expect(page.getByRole('dialog').getByRole('button',{name:'نتائج الطلاب'})).toHaveCount(0);
  expect(privateReads).toBe(0);
});

test('school assessments require the module as well as the permission at mobile width',async({page})=>{
  await mockDirector(page);
  await page.route('**/api/v1/schools/context',route=>json(route,{contexts:[
    {schoolId:'school-1',schoolName:'مدرسة المئة',role:'school_admin',permissions:[...permissions,'SCHOOL_ASSESSMENTS_MANAGE'],modules:['SCHOOL_CORE'],source:'membership'},
  ]}));
  let calls=0;
  await page.route('**/api/school-access/director/schools/*/academic/assessments',route=>{calls++;return json(route,{},403)});
  await page.setViewportSize({width:360,height:780});
  await page.goto('/school-director-dashboard');
  await expect(page.getByRole('navigation',{name:'أقسام لوحة مدير المدرسة'}).getByRole('button',{name:'اختبارات المدرسة'})).toHaveCount(0);
  expect(calls).toBe(0);
});

test('director creates a private class assessment from approved school picker on mobile',async({page})=>{
  await mockDirector(page,['SCHOOL_CORE','SCHOOL_ASSESSMENTS']);
  await page.route('**/api/v1/schools/context',route=>json(route,{contexts:[{
    schoolId:'school-1',schoolName:'مدرسة المئة',role:'school_admin',
    permissions:[...permissions,'SCHOOL_ASSESSMENTS_MANAGE'],modules:['SCHOOL_CORE','SCHOOL_ASSESSMENTS'],source:'membership',
  }]}));
  let published=false;
  let sent:Record<string,unknown>|undefined;
  await page.route('**/api/school-access/director/schools/school-1/academic/assessments',route=>{
    if(route.request().method()==='POST'){
      sent=route.request().postDataJSON() as Record<string,unknown>;
      expect(route.request().headers()['idempotency-key']).toMatch(/^[0-9a-f-]{36}$/);
      expect(route.request().headers()['x-csrf-token']).toBe('csrf-director');
      published=true;
      return json(route,{assessment:{assessmentId:'assessment-created',title:sent.title,classId:sent.classId,targetScope:sent.targetScope}},201);
    }
    return json(route,{assessments:published?[{id:'assessment-created',title:'اختبار الفصل التجريبي',isPublished:true,targetGroupIds:['class-1']}]:[],classes:[{classId:'class-1',className:'الأول أ'}]});
  });
  let pickerCalls=0;
  await page.route('**/api/school-access/director/schools/school-1/academic/available-questions?*',route=>{
    pickerCalls++;
    const url=new URL(route.request().url());
    expect(url.searchParams.get('subjectId')).toBe('subject-1');
    return json(route,{items:[
      {id:'question-approved',questionCode:'MATH-014',text:'سؤال رياضيات معتمد',type:'mcq',imageUrl:'',imageAlt:'',currentVersion:3},
    ],hasMore:false});
  });
  await page.setViewportSize({width:390,height:844});
  await page.goto('/school-director-dashboard');
  await openDirectorSection(page,'اختبارات المدرسة');
  await page.getByRole('button',{name:'إنشاء اختبار',exact:true}).click();
  await page.getByLabel('عنوان الاختبار المدرسي').fill('اختبار الفصل التجريبي');
  await page.getByLabel('فصل الاختبار المدرسي').selectOption('class-1');
  await page.getByLabel('مسار الاختبار المدرسي').selectOption('path-1');
  await page.getByLabel('مادة الاختبار المدرسي').selectOption('subject-1');
  await expect(page.getByText('سؤال رياضيات معتمد')).toBeVisible();
  await page.getByLabel('اختيار السؤال MATH-014').check();
  await page.getByRole('button',{name:'إنشاء ونشر للطلاب المستهدفين'}).click();
  await expect(page.getByRole('region',{name:'اختبارات المدرسة'})).toContainText('اختبار الفصل التجريبي');
  expect(sent).toMatchObject({title:'اختبار الفصل التجريبي',targetScope:'class',classId:'class-1',pathId:'path-1',subjectId:'subject-1',questionIds:['question-approved']});
  expect(pickerCalls).toBeGreaterThan(0);
  expect(await page.evaluate(()=>document.documentElement.scrollWidth>document.documentElement.clientWidth)).toBe(false);
});

test('whole-school assessment needs an explicit school audience and no class',async({page})=>{
  await mockDirector(page,['SCHOOL_CORE','SCHOOL_ASSESSMENTS']);
  await page.route('**/api/v1/schools/context',route=>json(route,{contexts:[{
    schoolId:'school-1',schoolName:'مدرسة المئة',role:'school_admin',permissions:[...permissions,'SCHOOL_ASSESSMENTS_MANAGE'],modules:['SCHOOL_CORE','SCHOOL_ASSESSMENTS'],source:'membership',
  }]}));
  let payload:Record<string,unknown>|undefined;
  await page.route('**/api/school-access/director/schools/school-1/academic/assessments',route=>{
    if(route.request().method()==='POST'){
      payload=route.request().postDataJSON() as Record<string,unknown>;
      return json(route,{assessment:{assessmentId:'school-assessment',title:payload.title,classId:'',targetScope:'school'}},201);
    }
    return json(route,{assessments:[],classes:[]});
  });
  await page.route('**/api/school-access/director/schools/school-1/academic/available-questions?*',route=>{
    const pageNumber=new URL(route.request().url()).searchParams.get('page');
    return json(route,pageNumber==='2'?{items:[{id:'q-2',questionCode:'MATH-101',text:'سؤال الصفحة التالية',type:'mcq',imageUrl:'',imageAlt:'',currentVersion:1}],hasMore:false}:{items:[{id:'q-1',questionCode:'MATH-100',text:'سؤال مصدق',type:'mcq',imageUrl:'',imageAlt:'',currentVersion:1}],hasMore:true});
  });
  await page.goto('/school-director-dashboard');
  await openDirectorSection(page,'اختبارات المدرسة');
  await page.getByRole('button',{name:'إنشاء اختبار',exact:true}).click();
  await page.getByLabel('عنوان الاختبار المدرسي').fill('اختبار المدرسة الكامل');
  await page.getByLabel('نطاق اختبار المدرسة').selectOption('school');
  await expect(page.getByLabel('فصل الاختبار المدرسي')).toHaveCount(0);
  await page.getByLabel('مسار الاختبار المدرسي').selectOption('path-1');
  await page.getByLabel('مادة الاختبار المدرسي').selectOption('subject-1');
  await page.getByLabel('اختيار السؤال MATH-100').check();
  await page.getByRole('button',{name:'التالي'}).click();
  await expect(page.getByText('سؤال الصفحة التالية')).toBeVisible();
  await page.getByLabel('اختيار السؤال MATH-101').check();
  await page.getByRole('button',{name:'إنشاء ونشر للطلاب المستهدفين'}).click();
  await expect(page.getByRole('button',{name:'إنشاء اختبار',exact:true})).toBeVisible();
  expect(payload).toMatchObject({targetScope:'school',classId:'',questionIds:['q-1','q-2']});
});

test('school central assessment directs one exam to multiple checked classes on mobile and desktop',async({page})=>{
  await mockDirector(page,['SCHOOL_CORE','SCHOOL_ASSESSMENTS']);
  await page.route('**/api/v1/schools/context',route=>json(route,{contexts:[{
    schoolId:'school-1',schoolName:'مدرسة المئة',role:'school_admin',permissions:[...permissions,'SCHOOL_ASSESSMENTS_MANAGE'],modules:['SCHOOL_CORE','SCHOOL_ASSESSMENTS'],source:'membership',
  }]}));
  let created:Record<string,unknown>|undefined;
  await page.route('**/api/school-access/director/schools/school-1/academic/assessments',route=>{
    if(route.request().method()==='POST'){
      created=route.request().postDataJSON() as Record<string,unknown>;
      return json(route,{assessment:{assessmentId:'central-1',title:created.title,classId:'',classIds:created.classIds,targetScope:'classes'}},201);
    }
    return json(route,{assessments:created?[{id:'central-1',title:'اختبار موحد بين الفصول',isPublished:true,targetGroupIds:['class-1','class-2']}]:[],classes:[{classId:'class-1',className:'الأول أ'},{classId:'class-2',className:'الأول ب'},{classId:'class-3',className:'الثاني أ'}]});
  });
  await page.route('**/api/school-access/director/schools/school-1/academic/available-questions?*',route=>json(route,{items:[
    {id:'q-1',questionCode:'MATH-001',text:'سؤال مركزي معتمد',type:'mcq',imageUrl:'',imageAlt:'',currentVersion:1},
  ],hasMore:false}));
  await page.setViewportSize({width:390,height:844});
  await page.goto('/school-director-dashboard');
  await openDirectorSection(page,'اختبارات المدرسة');
  await page.getByRole('button',{name:'إنشاء اختبار',exact:true}).click();
  await page.getByLabel('عنوان الاختبار المدرسي').fill('اختبار موحد بين الفصول');
  await page.getByLabel('نطاق اختبار المدرسة').selectOption('classes');
  await expect(page.getByLabel('فصل الاختبار المدرسي')).toHaveCount(0);
  await page.getByLabel('اختيار الفصل الأول أ').check();
  await expect(page.getByRole('button',{name:'إنشاء ونشر للطلاب المستهدفين'})).toBeDisabled();
  await page.getByLabel('اختيار الفصل الأول ب').check();
  await page.getByLabel('مسار الاختبار المدرسي').selectOption('path-1');
  await page.getByLabel('مادة الاختبار المدرسي').selectOption('subject-1');
  await page.getByLabel('اختيار السؤال MATH-001').check();
  await expect(page.getByRole('button',{name:'إنشاء ونشر للطلاب المستهدفين'})).toBeEnabled();
  expect(await page.evaluate(()=>document.documentElement.scrollWidth>document.documentElement.clientWidth)).toBe(false);
  await page.setViewportSize({width:1440,height:900});
  expect(await page.evaluate(()=>document.documentElement.scrollWidth>document.documentElement.clientWidth)).toBe(false);
  await page.getByRole('button',{name:'إنشاء ونشر للطلاب المستهدفين'}).click();
  await expect(page.getByRole('region',{name:'اختبارات المدرسة'})).toContainText('اختبار موحد بين الفصول');
  expect(created).toMatchObject({title:'اختبار موحد بين الفصول',targetScope:'classes',classId:'',classIds:['class-1','class-2'],questionIds:['q-1']});
});

test('selected school assessment combines named students and a class without leaking contact details',async({page})=>{
  await mockDirector(page,['SCHOOL_CORE','SCHOOL_ASSESSMENTS']);
  await page.route('**/api/v1/schools/context',route=>json(route,{contexts:[{
    schoolId:'school-1',schoolName:'مدرسة المئة',role:'school_admin',permissions:[...permissions,'SCHOOL_ASSESSMENTS_MANAGE'],modules:['SCHOOL_CORE','SCHOOL_ASSESSMENTS'],source:'membership',
  }]}));
  let created:Record<string,unknown>|undefined;
  await page.route('**/api/school-access/director/schools/school-1/academic/assessments',route=>{
    if(route.request().method()==='POST'){
      created=route.request().postDataJSON() as Record<string,unknown>;
      return json(route,{assessment:{assessmentId:'selected-1',title:created.title,classIds:created.classIds,studentIds:created.studentIds,targetScope:'selected'}},201);
    }
    return json(route,{assessments:created?[{id:'selected-1',title:'اختبار المجموعة المختارة',isPublished:true,targetGroupIds:['class-1']}]:[],classes:[{classId:'class-1',className:'الأول أ'},{classId:'class-2',className:'الأول ب'}]});
  });
  await page.route('**/api/school-access/director/schools/school-1/academic/eligible-students?*',route=>{
    const q=new URL(route.request().url()).searchParams;
    return json(route,q.get('page')==='2'?{items:[{studentId:'learner-2',name:'مريم خالد',className:'الأول ب'}],total:2,page:2,limit:1,hasMore:false}:
      {items:[{studentId:'learner-1',name:'ليلى أحمد',className:'الأول أ'}],total:2,page:1,limit:1,hasMore:true});
  });
  await page.route('**/api/school-access/director/schools/school-1/academic/available-questions?*',route=>json(route,{items:[
    {id:'q-1',questionCode:'MATH-001',text:'سؤال المجموعة المختارة',type:'mcq',imageUrl:'',imageAlt:'',currentVersion:1},
  ],hasMore:false}));
  await page.setViewportSize({width:390,height:844});
  await page.goto('/school-director-dashboard');
  await openDirectorSection(page,'اختبارات المدرسة');
  await page.getByRole('button',{name:'إنشاء اختبار',exact:true}).click();
  await page.getByLabel('عنوان الاختبار المدرسي').fill('اختبار المجموعة المختارة');
  await page.getByLabel('نطاق اختبار المدرسة').selectOption('selected');
  await page.getByLabel('اختيار الطالب ليلى أحمد').check();
  await page.getByRole('button',{name:'التالي للطلاب'}).click();
  await page.getByLabel('اختيار الطالب مريم خالد').check();
  await page.getByLabel('اختيار الفصل الأول أ').check();
  await page.getByLabel('درجة النجاح للاختبار').fill('75');
  await page.getByLabel('مدة الاختبار بالدقائق').fill('25');
  await page.getByLabel('عدد محاولات الاختبار').fill('2');
  await page.getByLabel('طريقة عرض اختيارات الاختبار').selectOption('two_columns');
  await page.getByLabel('خلط ترتيب أسئلة الاختبار').uncheck();
  await page.getByLabel('إظهار الإجابات بعد الاختبار').uncheck();
  await page.getByLabel('مسار الاختبار المدرسي').selectOption('path-1');
  await page.getByLabel('مادة الاختبار المدرسي').selectOption('subject-1');
  await page.getByLabel('اختيار السؤال MATH-001').check();
  await expect(page.getByText('تم اختيار 2 طالب')).toBeVisible();
  expect(await page.evaluate(()=>document.documentElement.scrollWidth>document.documentElement.clientWidth)).toBe(false);
  await page.setViewportSize({width:1440,height:900});
  expect(await page.evaluate(()=>document.documentElement.scrollWidth>document.documentElement.clientWidth)).toBe(false);
  await page.getByRole('button',{name:'إنشاء ونشر للطلاب المستهدفين'}).click();
  await expect(page.getByText('اختبار المجموعة المختارة')).toBeVisible();
  expect(created).toMatchObject({targetScope:'selected',classId:'',classIds:['class-1'],studentIds:['learner-1','learner-2'],questionIds:['q-1'],settings:{passingScore:75,timeLimitMinutes:25,maxAttempts:2,optionLayout:'two_columns',randomizeQuestions:false,showAnswers:false}});
});

test('assessment cards ignore a late A response after A to B to A, on all target widths',async({page})=>{
  await mockDirector(page,['SCHOOL_CORE','SCHOOL_ASSESSMENTS']);
  const context=(schoolId:string,schoolName:string)=>({
    schoolId,schoolName,role:'school_admin',
    permissions:['SCHOOL_OVERVIEW_VIEW','SCHOOL_ASSESSMENTS_MANAGE'],
    modules:['SCHOOL_CORE','SCHOOL_ASSESSMENTS'],source:'membership',
  });
  await page.route('**/api/v1/schools/context',route=>json(route,{contexts:[
    context('school-1','مدرسة المئة'),context('school-2','مدرسة ثانية'),
  ]}));
  let aCalls=0;
  let releaseOld:(()=>void)|undefined;
  let oldStarted:(()=>void)|undefined;
  const firstA=new Promise<void>(resolve=>{oldStarted=resolve});
  await page.route('**/api/school-access/director/schools/school-1/academic/assessments',async route=>{
    aCalls++;
    if(aCalls===1){
      oldStarted?.();
      await new Promise<void>(resolve=>{releaseOld=resolve});
      try{await json(route,{assessments:[{id:'old',title:'قائمة قديمة',isPublished:true,targetGroupIds:[]}],classes:[]});}catch{/* aborted old-school request */}
      return;
    }
    return json(route,{assessments:[{id:'new',title:'قائمة محدثة للمدرسة أ',isPublished:true,targetGroupIds:['school-1']}],classes:[]});
  });
  await page.route('**/api/school-access/director/schools/school-2/academic/assessments',route=>json(route,{
    assessments:[{id:'b',title:'اختبار المدرسة ب',isPublished:true,targetGroupIds:['school-2']}],classes:[],
  }));
  await page.goto('/school-director-dashboard');
  await openDirectorSection(page,'اختبارات المدرسة');
  await firstA;
  await page.getByLabel('المدرسة',{exact:true}).selectOption('school-2');
  await openDirectorSection(page,'اختبارات المدرسة');
  await expect(page.getByText('اختبار المدرسة ب')).toBeVisible();
  await page.getByLabel('المدرسة',{exact:true}).selectOption('school-1');
  await openDirectorSection(page,'اختبارات المدرسة');
  await expect(page.getByText('قائمة محدثة للمدرسة أ')).toBeVisible();
  releaseOld?.();
  await expect(page.getByText('قائمة قديمة')).toHaveCount(0);
  await expect(page.getByText('اختبار المدرسة ب')).toHaveCount(0);
  for(const width of [360,390,430,768,1024,1366,1440,1920]){
    await page.setViewportSize({width,height:850});
    await expect(page.getByRole('region',{name:'اختبارات المدرسة'})).toBeVisible();
    const overflows=await page.evaluate(()=>document.documentElement.scrollWidth>document.documentElement.clientWidth);
    expect(overflows,`horizontal overflow at ${width}px`).toBe(false);
  }
});

test('school A to B to A ignores stale overview numbers from B',async({page})=>{
  await mockDirector(page);
  let firstSchoolLoads=0;
  let releaseSchoolB:(()=>void)|undefined;
  let schoolBStarted:(()=>void)|undefined;
  let schoolBFinished:(()=>void)|undefined;
  const seenB=new Promise<void>(resolve=>{schoolBStarted=resolve});
  const finishedB=new Promise<void>(resolve=>{schoolBFinished=resolve});
  await page.route('**/api/school-access/director/schools/school-1/overview',route=>{
    firstSchoolLoads++;
    return json(route,{...schoolOneOverview,metrics:{...schoolOneOverview.metrics,students:firstSchoolLoads===1?12:44}});
  });
  await page.route('**/api/school-access/director/schools/school-2/overview',async route=>{
    schoolBStarted?.();
    await new Promise<void>(resolve=>{releaseSchoolB=resolve});
    try{await json(route,schoolTwoOverview)}catch{/* Client abandoned the old-school request. */}
    finally{schoolBFinished?.()}
  });
  await page.goto('/school-director-dashboard');
  const metrics=page.getByRole('region',{name:'مؤشرات المدرسة'});
  await expect(metrics.locator('article').filter({hasText:'الطلاب'})).toContainText('12');
  await page.getByLabel('المدرسة',{exact:true}).selectOption('school-2');
  await seenB;
  await expect(page.getByLabel('المدرسة',{exact:true})).toHaveValue('school-2');
  await expect(metrics.locator('article')).toHaveCount(0);
  await page.getByLabel('المدرسة',{exact:true}).selectOption('school-1');
  await expect(metrics.locator('article').filter({hasText:'الطلاب'})).toContainText('44');
  releaseSchoolB?.();
  await finishedB;
  await expect(metrics.locator('article').filter({hasText:'الطلاب'})).toContainText('44');
  await expect(page.getByLabel('المدرسة',{exact:true})).toHaveValue('school-1');
});

test('school director lists active teacher materials and ends the exact assignment with CSRF',async({page})=>{
  await mockDirector(page);
  let activeAssignments=[
    {assignmentId:'assignment-1',teacherId:'teacher-1',classId:'class-1',subjectId:'subject-1',status:'active'},
    {assignmentId:'assignment-2',teacherId:'teacher-1',classId:'class-2',subjectId:'',status:'active'},
    {assignmentId:'assignment-3',teacherId:'teacher-1',classId:'class-1',subjectId:'subject-1',status:'inactive'},
  ];
  let deactivated:unknown;
  let schoolScope='';
  let csrf='';
  await page.route('**/api/school-access/director/schools/school-1/teachers',route=>json(route,{
    teachers:[{teacherId:'teacher-1',name:'معلم المدرسة',email:'teacher@example.com',isActive:true}],
    assignments:activeAssignments,
  }));
  await page.route('**/api/school-access/director/schools/*/assignments',route=>{
    const payload=route.request().postDataJSON();
    schoolScope=route.request().url();
    csrf=route.request().headers()['x-csrf-token']||'';
    deactivated=payload;
    activeAssignments=activeAssignments.map(a=>a.classId===payload.classId&&a.subjectId===payload.subjectId?{...a,status:'inactive'}:a);
    return json(route,{assignment:{...payload,assignmentId:'assignment-2'}});
  });
  await page.goto('/school-director-dashboard');
  await openDirectorSection(page,'المعلمون والتكليفات');
  await page.getByLabel('المعلم',{exact:true}).selectOption('teacher-1');
  const listing=page.getByRole('region',{name:'تكليفات المعلم الحالية'});
  await expect(listing).toContainText('الأول أ');
  await expect(listing).toContainText('الرياضيات');
  await expect(listing).toContainText('الأول ب');
  await expect(listing).toContainText('مادة غير محددة');
  await expect(listing).toContainText('يلزم توحيد التكليفات');
  await expect(listing.getByRole('button',{name:'إيقاف التكليف'})).toHaveCount(2);
  await listing.getByRole('button',{name:'إيقاف التكليف'}).nth(1).click();
  await expect(page.getByText('تم إيقاف التكليف دون تغيير التقارير السابقة.')).toBeVisible();
  expect(deactivated).toEqual({teacherId:'teacher-1',classId:'class-2',subjectId:'',status:'inactive'});
  expect(schoolScope).toContain('/schools/school-1/assignments');
  expect(csrf).toBe('csrf-director');
  await expect(listing.getByRole('button',{name:'إيقاف التكليف'})).toHaveCount(1);
  await expect(listing).not.toContainText('مادة غير محددة');
});

test('school director school switch never reuses the previous school roster',async({page})=>{
  await mockDirector(page);
  await page.goto('/school-director-dashboard');
  await openDirectorSection(page,'الطلاب');
  await expect(page.getByText('طالب أول')).toBeVisible();

  await page.getByLabel('المدرسة',{exact:true}).selectOption('school-2');
  await openDirectorSection(page,'الطلاب');
  await expect(page.getByText('طلاب مدرسة ثانية')).toBeVisible();
  await expect(page.getByText('طالب أول')).toHaveCount(0);
  await expect(page.getByText('لا يوجد طلاب مطابقون حاليًا.')).toBeVisible();
  await expect(page.getByRole('button',{name:'إضافة طالب'})).toHaveCount(0);
});

test('late school-one response cannot overwrite school-two roster or assignment selection',async({page})=>{
  await mockDirector(page);
  let releaseOldResponse:(()=>void)|undefined;
  let oldRequestStarted:(()=>void)|undefined;
  const oldRequestSeen=new Promise<void>(resolve=>{oldRequestStarted=resolve});
  await page.route('**/api/school-access/director/schools/school-1/students*',async route=>{
    if(!route.request().url().includes('search=delayed'))return json(route,{students:[student],total:1});
    oldRequestStarted?.();
    await new Promise<void>(resolve=>{releaseOldResponse=resolve});
    return json(route,{students:[{...student,studentId:'late-1',name:'طالب متأخر من المدرسة الأولى'}],total:1});
  });
  await page.goto('/school-director-dashboard');
  await openDirectorSection(page,'المعلمون والتكليفات');
  await page.getByLabel('المعلم',{exact:true}).selectOption('teacher-1');
  await openDirectorSection(page,'الطلاب');
  await expect(page.getByText('طالب أول')).toBeVisible();
  await page.getByLabel('بحث الطلاب').fill('delayed');
  await page.getByLabel('بحث الطلاب').press('Enter');
  await oldRequestSeen;
  await page.getByLabel('المدرسة',{exact:true}).selectOption('school-2');
  await openDirectorSection(page,'الطلاب');
  await expect(page.getByText('طلاب مدرسة ثانية')).toBeVisible();
  await expect(page.getByText('لا يوجد طلاب مطابقون حاليًا.')).toBeVisible();
  releaseOldResponse?.();
  await page.waitForTimeout(250);
  await expect(page.getByText('طالب متأخر من المدرسة الأولى')).toHaveCount(0);
  await expect(page.getByLabel('بحث الطلاب')).toHaveValue('');
  await page.getByLabel('المدرسة',{exact:true}).selectOption('school-1');
  await openDirectorSection(page,'المعلمون والتكليفات');
  await expect(page.getByLabel('المعلم',{exact:true})).toHaveValue('');
});

test('late student mutation from previous school cannot refresh the new school using stale scope',async({page})=>{
  await mockDirector(page);
  let releaseCreate:(()=>void)|undefined;
  let creationStarted:(()=>void)|undefined;
  const creating=new Promise<void>(resolve=>{creationStarted=resolve});
  await page.route('**/api/school-access/director/schools/school-1/students',async route=>{
    if(route.request().method()!=='POST')return route.fallback();
    creationStarted?.();
    await new Promise<void>(resolve=>{releaseCreate=resolve});
    return json(route,{student:{...student,studentId:'new-1',name:'طالب قادم من الأولى'},created:true},201);
  });
  await page.goto('/school-director-dashboard');
  await openDirectorSection(page,'الطلاب');
  await page.getByRole('button',{name:'إضافة طالب'}).click();
  await page.getByLabel('اسم الطالب الجديد').fill('طالب قادم من الأولى');
  await page.getByLabel('بريد الطالب الجديد').fill('from-first@example.com');
  await page.getByLabel('كلمة مرور الطالب الجديد').fill('Password1');
  await page.getByLabel('فصل الطالب الجديد').selectOption('class-1');
  await page.getByRole('button',{name:'إنشاء وربط'}).click();
  await creating;
  await page.getByLabel('المدرسة',{exact:true}).selectOption('school-2');
  await openDirectorSection(page,'الطلاب');
  await expect(page.getByText('لا يوجد طلاب مطابقون حاليًا.')).toBeVisible();
  releaseCreate?.();
  await page.waitForTimeout(350);
  await expect(page.getByText('طالب أول')).toHaveCount(0);
  await expect(page.getByText('لا يوجد طلاب مطابقون حاليًا.')).toBeVisible();
});

test('late refresh after a successful student create cannot display the old-school success notice',async({page})=>{
  await mockDirector(page);
  let schoolOneStudentLoads=0;
  let releaseRefresh:(()=>void)|undefined;
  let refreshStarted:(()=>void)|undefined;
  const refreshing=new Promise<void>(resolve=>{refreshStarted=resolve});
  await page.route('**/api/school-access/director/schools/school-1/students*',async route=>{
    if(route.request().method()==='POST')return json(route,{student:{...student,studentId:'new-1'},created:true},201);
    schoolOneStudentLoads++;
    if(schoolOneStudentLoads===2){
      refreshStarted?.();
      await new Promise<void>(resolve=>{releaseRefresh=resolve});
    }
    return json(route,{students:[student],total:1});
  });
  await page.goto('/school-director-dashboard');
  await openDirectorSection(page,'الطلاب');
  await expect(page.getByText('طالب أول')).toBeVisible();
  await page.getByRole('button',{name:'إضافة طالب'}).click();
  await page.getByLabel('اسم الطالب الجديد').fill('طالب جديد');
  await page.getByLabel('بريد الطالب الجديد').fill('new@example.com');
  await page.getByLabel('كلمة مرور الطالب الجديد').fill('Password1');
  await page.getByLabel('فصل الطالب الجديد').selectOption('class-1');
  await page.getByRole('button',{name:'إنشاء وربط'}).click();
  await refreshing;
  await page.getByLabel('المدرسة',{exact:true}).selectOption('school-2');
  await openDirectorSection(page,'الطلاب');
  await expect(page.getByText('لا يوجد طلاب مطابقون حاليًا.')).toBeVisible();
  releaseRefresh?.();
  await page.waitForTimeout(300);
  await expect(page.getByText('تم إنشاء الطالب وربطه بالمدرسة والفصل.')).toHaveCount(0);
});

test('switching school clears student draft and closes the previous school editor',async({page})=>{
  await mockDirector(page);
  await page.goto('/school-director-dashboard');
  await openDirectorSection(page,'الطلاب');
  await page.getByRole('button',{name:'إضافة طالب'}).click();
  await page.getByLabel('اسم الطالب الجديد').fill('بيانات تخص المدرسة الأولى');
  await page.getByLabel('بريد الطالب الجديد').fill('old-school@example.com');
  await page.getByLabel('كلمة مرور الطالب الجديد').fill('OldPassword1');
  await page.getByLabel('المدرسة',{exact:true}).selectOption('school-2');
  await expect(page.getByLabel('اسم الطالب الجديد')).toHaveCount(0);
  await expect(page.getByLabel('كلمة مرور الطالب الجديد')).toHaveCount(0);
  await page.getByLabel('المدرسة',{exact:true}).selectOption('school-1');
  await openDirectorSection(page,'الطلاب');
  await page.getByRole('button',{name:'إضافة طالب'}).click();
  await expect(page.getByLabel('اسم الطالب الجديد')).toHaveValue('');
  await expect(page.getByLabel('بريد الطالب الجديد')).toHaveValue('');
  await expect(page.getByLabel('كلمة مرور الطالب الجديد')).toHaveValue('');
});

test('school switch cannot flash previous-school student password when destination has students but no overview',async({page})=>{
  await mockDirector(page);
  await page.route('**/api/v1/schools/context',route=>json(route,{contexts:[
    {schoolId:'school-1',schoolName:'مدرسة المئة',role:'school_admin',permissions,modules:['SCHOOL_CORE'],source:'membership'},
    {schoolId:'school-2',schoolName:'مدرسة ثانية',role:'school_admin',permissions:['SCHOOL_STUDENTS_VIEW'],modules:['SCHOOL_CORE'],source:'membership'},
  ]}));
  await page.goto('/school-director-dashboard');
  await openDirectorSection(page,'الطلاب');
  await page.getByRole('button',{name:'إضافة طالب'}).click();
  await page.getByLabel('كلمة مرور الطالب الجديد').fill('PreviousSchoolSecret');
  await page.getByLabel('المدرسة',{exact:true}).selectOption('school-2');
  await expect(page.getByRole('heading',{name:'طلاب مدرسة ثانية'})).toBeVisible();
  await expect(page.getByLabel('كلمة مرور الطالب الجديد')).toHaveCount(0);
  await expect(page.getByRole('button',{name:'إضافة طالب'})).toHaveCount(0);
  await expect(page.getByText('PreviousSchoolSecret')).toHaveCount(0);
  await expect(page.getByRole('region',{name:'مؤشرات المدرسة'})).toHaveCount(0);
});

test('completed stop-assignment request from former school cannot replace new school teachers',async({page})=>{
  await mockDirector(page);
  let releaseStop:(()=>void)|undefined;
  let stopStarted:(()=>void)|undefined;
  const stopping=new Promise<void>(resolve=>{stopStarted=resolve});
  await page.route('**/api/v1/schools/context',route=>json(route,{contexts:[
    {schoolId:'school-1',schoolName:'مدرسة المئة',role:'school_admin',permissions,modules:['SCHOOL_CORE'],source:'membership'},
    {schoolId:'school-2',schoolName:'مدرسة ثانية',role:'school_admin',permissions,modules:['SCHOOL_CORE'],source:'membership'},
  ]}));
  await page.route('**/api/school-access/director/schools/school-1/teachers',route=>json(route,{
    teachers:[{teacherId:'teacher-1',name:'معلم الأولى',email:'first@example.com',isActive:true}],
    assignments:[{assignmentId:'first-a',teacherId:'teacher-1',classId:'class-1',subjectId:'subject-1',status:'active'}],
  }));
  await page.route('**/api/school-access/director/schools/school-2/teachers',route=>json(route,{
    teachers:[{teacherId:'teacher-2',name:'معلم الثانية',email:'second@example.com',isActive:true}],assignments:[],
  }));
  await page.route('**/api/school-access/director/schools/school-1/assignments',async route=>{
    stopStarted?.();
    await new Promise<void>(resolve=>{releaseStop=resolve});
    return json(route,{assignment:{...route.request().postDataJSON(),assignmentId:'first-a'}});
  });
  await page.goto('/school-director-dashboard');
  await openDirectorSection(page,'المعلمون والتكليفات');
  await page.getByLabel('المعلم',{exact:true}).selectOption('teacher-1');
  await page.getByRole('button',{name:'إيقاف التكليف'}).click();
  await stopping;
  await page.getByLabel('المدرسة',{exact:true}).selectOption('school-2');
  await openDirectorSection(page,'المعلمون والتكليفات');
  await expect(page.getByLabel('المعلم',{exact:true}).locator('option')).toContainText(['اختر المعلم','معلم الثانية']);
  releaseStop?.();
  await page.waitForTimeout(350);
  await expect(page.getByLabel('المعلم',{exact:true}).locator('option')).toContainText(['اختر المعلم','معلم الثانية']);
  await expect(page.getByText('تم إيقاف التكليف دون تغيير التقارير السابقة.')).toHaveCount(0);
});

test('late student move from former school cannot show its completion notice in the new school',async({page})=>{
  await mockDirector(page);
  let releaseMove:(()=>void)|undefined;
  let moveStarted:(()=>void)|undefined;
  const moving=new Promise<void>(resolve=>{moveStarted=resolve});
  await page.route('**/api/school-access/director/schools/school-1/students/student-1/class',async route=>{
    moveStarted?.();
    await new Promise<void>(resolve=>{releaseMove=resolve});
    return json(route,{student:{...student,classId:'class-2',className:'الأول ب'},idempotent:false});
  });
  await page.goto('/school-director-dashboard');
  await openDirectorSection(page,'الطلاب');
  await page.getByLabel('فصل طالب أول').selectOption('class-2');
  await moving;
  await page.getByLabel('المدرسة',{exact:true}).selectOption('school-2');
  await openDirectorSection(page,'الطلاب');
  await expect(page.getByText('لا يوجد طلاب مطابقون حاليًا.')).toBeVisible();
  releaseMove?.();
  await page.waitForTimeout(300);
  await expect(page.getByText('تم نقل الطالب داخل المدرسة وحفظ الفصل الجديد.')).toHaveCount(0);
});

test('late roster refresh cannot restore an already ended teacher assignment',async({page})=>{
  await mockDirector(page);
  let activeAssignments=[{assignmentId:'assignment-1',teacherId:'teacher-1',classId:'class-1',subjectId:'subject-1',status:'active'}];
  let releaseStudents:(()=>void)|undefined;
  let requestStarted:(()=>void)|undefined;
  const requesting=new Promise<void>(resolve=>{requestStarted=resolve});
  await page.route('**/api/school-access/director/schools/school-1/teachers',route=>json(route,{
    teachers:[{teacherId:'teacher-1',name:'معلم المدرسة',email:'teacher@example.com',isActive:true}],
    assignments:activeAssignments,
  }));
  await page.route('**/api/school-access/director/schools/school-1/students*',async route=>{
    if(!route.request().url().includes('search=delayed'))return json(route,{students:[student],total:1});
    requestStarted?.();
    await new Promise<void>(resolve=>{releaseStudents=resolve});
    return json(route,{students:[student],total:1});
  });
  await page.route('**/api/school-access/director/schools/school-1/assignments',route=>{
    activeAssignments=activeAssignments.map(a=>({...a,status:'inactive'}));
    return json(route,{assignment:{...activeAssignments[0]}});
  });
  await page.goto('/school-director-dashboard');
  await openDirectorSection(page,'المعلمون والتكليفات');
  await page.getByLabel('المعلم',{exact:true}).selectOption('teacher-1');
  const listing=page.getByRole('region',{name:'تكليفات المعلم الحالية'});
  await expect(listing.getByRole('button',{name:'إيقاف التكليف'})).toHaveCount(1);
  await openDirectorSection(page,'الطلاب');
  await page.getByLabel('بحث الطلاب').fill('delayed');
  await page.getByLabel('بحث الطلاب').press('Enter');
  await requesting;
  await openDirectorSection(page,'المعلمون والتكليفات');
  await listing.getByRole('button',{name:'إيقاف التكليف'}).click();
  await expect(listing.getByRole('button',{name:'إيقاف التكليف'})).toHaveCount(0);
  releaseStudents?.();
  await page.waitForTimeout(300);
  await expect(listing.getByRole('button',{name:'إيقاف التكليف'})).toHaveCount(0);
});

test('returning to school A does not accept a mutation from its previous visit',async({page})=>{
  await mockDirector(page);
  let releaseMove:(()=>void)|undefined;
  let moveStarted:(()=>void)|undefined;
  const moving=new Promise<void>(resolve=>{moveStarted=resolve});
  await page.route('**/api/school-access/director/schools/school-1/students/student-1/class',async route=>{
    moveStarted?.();
    await new Promise<void>(resolve=>{releaseMove=resolve});
    return json(route,{student:{...student,classId:'class-2',className:'الأول ب'},idempotent:false});
  });
  await page.goto('/school-director-dashboard');
  await openDirectorSection(page,'الطلاب');
  await page.getByLabel('فصل طالب أول').selectOption('class-2');
  await moving;
  await page.getByLabel('المدرسة',{exact:true}).selectOption('school-2');
  await openDirectorSection(page,'الطلاب');
  await expect(page.getByText('لا يوجد طلاب مطابقون حاليًا.')).toBeVisible();
  await page.getByLabel('المدرسة',{exact:true}).selectOption('school-1');
  await openDirectorSection(page,'الطلاب');
  await expect(page.getByText('طالب أول')).toBeVisible();
  releaseMove?.();
  await page.waitForTimeout(350);
  await expect(page.getByText('تم نقل الطالب داخل المدرسة وحفظ الفصل الجديد.')).toHaveCount(0);
  await expect(page.getByLabel('فصل طالب أول')).toHaveValue('class-1');
});

test('optional school-core tools require both permission and active module in the UI',async({page})=>{
  await mockDirector(page,[]);
  await page.goto('/school-director-dashboard');
  await openDirectorSection(page,'الطلاب');

  await expect(page.getByText('طالب أول')).toBeVisible();
  await expect(page.getByRole('button',{name:'إضافة طالب'})).toBeVisible();
  await expect(page.getByLabel('فصل طالب أول')).toBeVisible();
  await expect(page.getByRole('heading',{name:'إدارة الفصول'})).toHaveCount(0);
  await expect(page.getByRole('heading',{name:'تكليف المعلمين'})).toHaveCount(0);
  await expect(page.getByRole('button',{name:'تعديل طالب أول'})).toHaveCount(0);
  await expect(page.getByRole('button',{name:'تعطيل طالب أول'})).toHaveCount(0);
});

test('mobile director empty state is explicit when no active school delegation exists',async({page})=>{
  await auth(page);
  await page.route('**/api/v1/taxonomy/bootstrap?phase=core',route=>json(route,{levels:[],paths:[],subjects:[]}));
  await page.route('**/api/v1/schools/context',route=>json(route,{contexts:[]}));
  await page.setViewportSize({width:390,height:844});
  await page.goto('/school-director-dashboard');

  await expect(page.getByRole('heading',{name:'لا توجد مدرسة مفوضة'})).toBeVisible();
  await expect(page.getByText('اطلب من مدير المنصة ربط حسابك بمدرسة وتفعيل الصلاحيات المطلوبة.')).toBeVisible();
  await page.screenshot({path:'test-results/organizations-director-mobile-empty.png',fullPage:true});
});


test('school director populated tablet dashboard uses cards without page overflow',async({page})=>{
  await mockDirector(page);
  await page.setViewportSize({width:820,height:1180});
  await page.goto('/school-director-dashboard');

  await expect(page.getByRole('heading',{name:'لوحة مدير المدرسة'})).toBeVisible();
  await expect(page.getByRole('region',{name:'مؤشرات المدرسة'})).toBeVisible();
  await expect(page.getByRole('region',{name:'مركز تشغيل مدير المدرسة'})).toBeVisible();
  await openDirectorSection(page,'الطلاب');
  await expect(page.getByText('طالب أول')).toBeVisible();
  await expect(page.getByLabel('فصل طالب أول')).toBeVisible();
  await expect.poll(()=>page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth)).toBe(true);
  await page.screenshot({path:'test-results/organizations-director-tablet.png',fullPage:true});
});

test('director section navigation and six metrics stay reachable on eight legacy comparison widths',async({page})=>{
  await mockDirector(page);
  await page.goto('/school-director-dashboard');
  for(const width of [360,390,430,768,1024,1366,1440,1920]){
    await page.setViewportSize({width,height:900});
    await expect(page.getByRole('navigation',{name:'أقسام لوحة مدير المدرسة'}).getByRole('button',{name:'الملخص العام'})).toBeVisible();
    await expect(page.getByRole('region',{name:'مؤشرات المدرسة'}).locator('article')).toHaveCount(6);
    await expect.poll(()=>page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth),{message:`horizontal overflow at ${width}px`}).toBe(true);
  }
  await page.setViewportSize({width:390,height:844});
  await page.screenshot({path:'test-results/organizations-director-overview-mobile.png',fullPage:true});
  await page.setViewportSize({width:1440,height:900});
  await page.screenshot({path:'test-results/organizations-director-overview-desktop.png',fullPage:true});
});
