import { expect, test, type Page, type Route } from '@playwright/test';

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
const permissions=[
  'SCHOOL_OVERVIEW_VIEW','SCHOOL_STUDENTS_VIEW','SCHOOL_STUDENTS_ADD','SCHOOL_STUDENTS_MOVE_CLASS',
  'SCHOOL_STUDENTS_UPDATE_BASIC','SCHOOL_STUDENTS_DEACTIVATE','SCHOOL_CLASSES_MANAGE','SCHOOL_TEACHERS_ASSIGN',
];

async function mockDirector(page:Page,modules=['SCHOOL_CORE']){
  await auth(page);
  await page.route('**/api/v1/schools/context',route=>json(route,{contexts:[
    {schoolId:'school-1',schoolName:'مدرسة المئة',role:'school_admin',permissions,modules,source:'membership'},
    {schoolId:'school-2',schoolName:'مدرسة ثانية',role:'school_admin',permissions:['SCHOOL_OVERVIEW_VIEW','SCHOOL_STUDENTS_VIEW'],modules:['SCHOOL_CORE'],source:'membership'},
  ]}));
  await page.route('**/api/v1/schools/school-1/classes*',route=>json(route,{classes,pagination:{page:1,limit:100,total:2,totalPages:1}}));
  await page.route('**/api/v1/schools/school-2/classes*',route=>json(route,{classes:[{id:'class-b',schoolId:'school-2',code:'B1',name:'الثاني أ',status:'active'}],pagination:{page:1,limit:100,total:1,totalPages:1}}));
  await page.route('**/api/school-access/director/schools/school-1/students*',route=>json(route,{students:[student],total:1}));
  await page.route('**/api/school-access/director/schools/school-2/students*',route=>json(route,{students:[],total:0}));
  await page.route('**/api/school-access/director/schools/school-1/teachers',route=>json(route,{
    teachers:[{teacherId:'teacher-1',name:'معلم المدرسة',email:'teacher@example.com',isActive:true}],
    assignments:[],
  }));
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
    return json(route,{assignment:{assignmentId:'assignment-1',teacherId:'teacher-1',classId:'class-1',subjectId:'',status:'active'}});
  });

  await page.setViewportSize({width:1440,height:1000});
  await page.goto('/school-director-dashboard');

  await expect(page.getByRole('heading',{name:'لوحة مدير المدرسة'})).toBeVisible();
  await expect(page.getByText('نطاق مفوض من مدير المنصة')).toBeVisible();
  await expect(page.getByText('طلاب مدرسة المئة')).toBeVisible();
  await expect(page.getByText('طالب أول')).toBeVisible();
  await expect(page.getByRole('region',{name:'مركز تشغيل مدير المدرسة'})).toContainText('التدخلات والخطط العلاجية');
  await expect(page.getByRole('region',{name:'مركز تشغيل مدير المدرسة'})).toContainText('التقارير');

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

  await page.getByLabel('اسم فصل جديد').fill('الأول ج');
  await page.getByRole('button',{name:'إنشاء الفصل'}).click();
  await expect(page.getByText('تم إنشاء الفصل داخل المدرسة.')).toBeVisible();
  expect(classCsrf).toBe('csrf-director');

  await page.getByLabel('المعلم').selectOption('teacher-1');
  await page.getByLabel('فصل التكليف').selectOption('class-1');
  await page.getByRole('button',{name:'حفظ التكليف'}).click();
  await expect(page.getByText('تم حفظ تكليف المعلم.')).toBeVisible();
  expect(assignmentCsrf).toBe('csrf-director');

  await expect(page.getByRole('button',{name:/حذف/})).toHaveCount(0);
  await page.screenshot({path:'test-results/organizations-director-desktop.png',fullPage:true});
});

test('school director school switch never reuses the previous school roster',async({page})=>{
  await mockDirector(page);
  await page.goto('/school-director-dashboard');
  await expect(page.getByText('طالب أول')).toBeVisible();

  await page.getByLabel('المدرسة').selectOption('school-2');
  await expect(page.getByText('طلاب مدرسة ثانية')).toBeVisible();
  await expect(page.getByText('طالب أول')).toHaveCount(0);
  await expect(page.getByText('لا يوجد طلاب مطابقون حاليًا.')).toBeVisible();
  await expect(page.getByRole('button',{name:'إضافة طالب'})).toHaveCount(0);
});

test('optional school-core tools require both permission and active module in the UI',async({page})=>{
  await mockDirector(page,[]);
  await page.goto('/school-director-dashboard');

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
  await expect(page.getByText('طالب أول')).toBeVisible();
  await expect(page.getByLabel('فصل طالب أول')).toBeVisible();
  await expect(page.getByRole('region',{name:'مركز تشغيل مدير المدرسة'})).toBeVisible();
  await expect.poll(()=>page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth)).toBe(true);
  await page.screenshot({path:'test-results/organizations-director-tablet.png',fullPage:true});
});
