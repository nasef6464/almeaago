import { expect, test, type Page, type Route } from '@playwright/test';

const supervisor={id:'supervisor-1',email:'supervisor@example.test',name:'مشرف المدرسة',status:'active',avatarUrl:'',emailVerified:true,role:'supervisor',roles:['supervisor']};
const contexts=[
 {schoolId:'school-1',schoolName:'مدرسة الأولى',role:'supervisor',permissions:[],modules:['SCHOOL_CORE'],source:'scope'},
 {schoolId:'school-2',schoolName:'مدرسة الثانية',role:'supervisor',permissions:[],modules:['SCHOOL_CORE'],source:'scope'},
];
const students:Record<string,unknown[]>={
 'school-1':[{userId:'student-one',name:'طالب الأولى',email:'first@example.test',status:'active',roles:['student'],classIds:['class-a']}],
 'school-2':[{userId:'student-two',name:'طالب الثانية',email:'second@example.test',status:'active',roles:['student'],classIds:['class-b']}],
};
function json(route:Route,body:unknown,status=200){return route.fulfill({status,contentType:'application/json',body:JSON.stringify(body)});}
async function auth(page:Page){
 await page.route('**/api/v1/auth/me',route=>json(route,{user:supervisor}));
 await page.route('**/api/v1/auth/csrf',route=>json(route,{csrfToken:'csrf'}));
}
async function mockRoster(page:Page){
 await auth(page);
 await page.route('**/api/v1/schools/context',route=>json(route,{contexts}));
 await page.route('**/api/v1/schools/*/classes?*',route=>json(route,{classes:[],pagination:{page:1,limit:100,total:0,totalPages:1}}));
 await page.route('**/api/v1/reports/overview?*',route=>json(route,{scope:{studentCount:1},assessment:{averageScore:85,attemptCount:2,passRate:90},weakestSkills:[]}));
 await page.route('**/api/v1/schools/*/roster?*',route=>{
  const school=route.request().url().split('/schools/')[1].split('/')[0];
  const items=students[school]||[];
  return json(route,{members:items,pagination:{page:1,limit:20,total:items.length,totalPages:1}});
 });
 await page.route('**/api/v1/classroom/teacher/sessions**',route=>json(route,{sessions:[]}));
}
const original=['الملخص العام','تعلم الطلاب وجاهزيتهم','الحصص المباشرة','الاختبارات والتحليل','المراقبة الحية','خريطة المهارات','تقارير الأداء'];
for(const width of [390,820,1440]){
 test('supervisor roster keeps original navigation and school scope at '+width,async({page})=>{
  await mockRoster(page);
  await page.setViewportSize({width,height:900});
  await page.goto('/supervisor-dashboard');
  await expect(page.getByRole('heading',{name:'لوحة الإشراف'})).toBeVisible();
  const nav=page.getByRole('navigation',{name:'أقسام لوحة المشرف'});
  for(const label of original)await expect(nav.getByText(label,{exact:true})).toHaveCount(1);
  const names=await nav.locator('button').allTextContents();
  expect(names.map(s=>s.trim())).toEqual(original);
  const groupStudents=nav.locator('details').filter({has:page.locator('summary',{hasText:'الطلاب والحصص'})});
  await expect(groupStudents).toHaveAttribute('open','');
  await expect(nav.locator('details[open]')).toHaveCount(1);
  await expect(nav.locator('summary')).toHaveCount(4);
  await nav.locator('summary',{hasText:'الرئيسية'}).click();
  await expect(nav.locator('details[open]')).toHaveCount(1);
  await expect(nav.locator('details').filter({has:page.locator('summary',{hasText:'الرئيسية'})})).toHaveAttribute('open','');
  await nav.locator('summary',{hasText:'الطلاب والحصص'}).click();
  await expect(groupStudents).toHaveAttribute('open','');
  const breadcrumb=page.getByRole('navigation',{name:'مسار الصفحة'});
  await expect(breadcrumb).toContainText('الطلاب والحصص');
  await expect(breadcrumb.locator('[aria-current="page"]')).toHaveText('تعلم الطلاب وجاهزيتهم');
  await expect(page.getByText('طالب الأولى')).toBeVisible();
  await expect(page.getByText('طالب الثانية')).toHaveCount(0);
  await page.getByLabel('المدرسة').selectOption('school-2');
  await expect(page.getByText('طالب الثانية')).toBeVisible();
  await expect(page.getByText('طالب الأولى')).toHaveCount(0);
  await nav.locator('summary',{hasText:'الرئيسية'}).click();
  await nav.getByRole('button',{name:'الملخص العام'}).click();
  await expect(page).toHaveURL(/tab=overview/);
  await expect(breadcrumb.locator('[aria-current="page"]')).toHaveText('الملخص العام');
  await page.reload();
  await expect(nav.getByRole('button',{name:'الملخص العام'})).toHaveAttribute('aria-current','page');
  await page.goBack();
  await expect(nav.getByRole('button',{name:'تعلم الطلاب وجاهزيتهم'})).toHaveAttribute('aria-current','page');
  await expect(page.locator('body')).not.toContainText('SUPERVISOR WORKSPACE');
  await expect(page.locator('body')).not.toContainText('الصلاحيات الفعلية');
  await test.info().attach('supervisor-'+width,{body:await page.screenshot({fullPage:true}),contentType:'image/png'});
 });
}
test('all supervisor sections are enabled and navigable, invalid tab fails closed to student view',async({page})=>{
 await mockRoster(page);
 await page.route('**/api/v1/assessments?*',route=>json(route,{items:[]}));
 await page.goto('/supervisor-dashboard?tab=tests');
 const nav=page.getByRole('navigation',{name:'أقسام لوحة المشرف'});
 await expect(nav.getByRole('button',{name:'الاختبارات والتحليل'})).toBeEnabled();
 await expect(nav.getByRole('button',{name:'الاختبارات والتحليل'})).toHaveAttribute('aria-current','page');
 await nav.locator('summary',{hasText:'الرئيسية'}).click();
 await nav.getByRole('button',{name:'الملخص العام'}).click();
 await expect(page).toHaveURL(/tab=overview/);
 await expect(nav.getByRole('button',{name:'الملخص العام'})).toHaveAttribute('aria-current','page');
 await page.goBack();
 await expect(page).toHaveURL(/tab=tests/);
 await expect(nav.getByRole('button',{name:'الاختبارات والتحليل'})).toHaveAttribute('aria-current','page');
 await page.goto('/supervisor-dashboard?tab=unknown-section');
 await expect(nav.getByRole('button',{name:'تعلم الطلاب وجاهزيتهم'})).toHaveAttribute('aria-current','page');
 await expect(page.getByText('طالب الأولى')).toBeVisible();
});
test('non-supervisor cannot read school contexts or student roster',async({page})=>{
 const student={...supervisor,id:'student-1',role:'student',roles:['student']};
 let protectedReads=0;
 await page.route('**/api/v1/auth/me',route=>json(route,{user:student}));
 await page.route('**/api/v1/auth/csrf',route=>json(route,{csrfToken:'csrf'}));
 await page.route('**/api/v1/schools/context',route=>{protectedReads++;return json(route,{contexts},200);});
 await page.route('**/api/v1/schools/*/roster?*',route=>{protectedReads++;return json(route,{members:students['school-1'],pagination:{page:1,limit:20,total:1,totalPages:1}});});
 await page.goto('/supervisor-dashboard');
 await expect(page.getByText('هذه الصفحة مخصصة للمشرف.')).toBeVisible();
 await expect(page.getByText('طالب الأولى')).toHaveCount(0);
 expect(protectedReads).toBe(0);
});
test('supervisor student list uses original show-more and show-less controls without losing scope',async({page})=>{
 await auth(page);
 await page.route('**/api/v1/schools/context',route=>json(route,{contexts:[contexts[0]]}));
 await page.route('**/api/v1/schools/*/roster?*',route=>{
  const url=new URL(route.request().url());
  const current=Number(url.searchParams.get('page')||1);
  const start=(current-1)*20;
  const members=Array.from({length:25},(_,i)=>({userId:'s-'+i,name:'طالب رقم '+(i+1),email:'s'+i+'@school.test',status:'active',roles:['student'],classIds:['class-a']})).slice(start,start+20);
  return json(route,{members,pagination:{page:current,limit:20,total:25,totalPages:2}});
 });
 await page.goto('/supervisor-dashboard');
 await expect(page.getByText('طالب رقم 1',{exact:true})).toBeVisible();
 await expect(page.getByText('طالب رقم 21',{exact:true})).toHaveCount(0);
 await page.getByRole('button',{name:'عرض المزيد'}).click();
 await expect(page.getByText('طالب رقم 21',{exact:true})).toBeVisible();
 await expect(page.getByText('طالب رقم 1',{exact:true})).toBeVisible();
 await page.getByRole('button',{name:'عرض أقل'}).click();
 await expect(page.getByText('طالب رقم 21',{exact:true})).toHaveCount(0);
 await expect(page.getByText('طالب رقم 1',{exact:true})).toBeVisible();
});
test('supervisor failed context and roster reads fail closed, preserve search and retry',async({page})=>{
 await auth(page);
 let contextFail=true;
 await page.route('**/api/v1/schools/context',route=>{
  if(contextFail){contextFail=false;return json(route,{message:'فشل النطاق'},503);}
  return json(route,{contexts});
 });
 let rosterFailures=2;
 await page.route('**/api/v1/schools/*/roster?*',route=>{
  if(rosterFailures>0){rosterFailures--;return json(route,{message:'فشل الطلاب'},503);}
  return json(route,{members:students['school-1'],pagination:{page:1,limit:20,total:1,totalPages:1}});
 });
 await page.goto('/supervisor-dashboard');
 await expect(page.getByRole('alert')).toContainText('فشل النطاق');
 await expect(page.getByText('طالب الأولى')).toHaveCount(0);
 await page.getByRole('button',{name:'إعادة المحاولة'}).click();
 await expect(page.getByRole('alert')).toContainText('فشل الطلاب');
 await expect(page.getByText('طالب الأولى')).toHaveCount(0);
 await page.getByLabel('بحث عن طالب').fill('طالب');
 await expect(page.getByRole('alert')).toContainText('فشل الطلاب');
 await page.getByRole('button',{name:'إعادة المحاولة'}).click();
 await expect(page.getByText('طالب الأولى')).toBeVisible();
 await expect(page.getByLabel('بحث عن طالب')).toHaveValue('طالب');
});
test('supervisor student profile alert action shows honest intervention status feedback',async({page})=>{
 await mockRoster(page);
 await page.goto('/supervisor-dashboard?tab=students');
 await expect(page.getByText('طالب الأولى')).toBeVisible();
 await page.getByRole('button',{name:'الملف والمهارات'}).click();
 await expect(page.getByRole('heading',{name:'طالب الأولى'})).toBeVisible();
 await page.getByRole('button',{name:'إرسال تنبيه'}).click();
 await expect(page.getByRole('heading',{name:'طالب الأولى'})).toHaveCount(0);
 const status=page.getByRole('status');
 await expect(status).toBeVisible();
 await expect(status).toContainText('تم تسجيل تنبيه المتابعة الأكاديمية للطالب "طالب الأولى" وإدراجه في خطة التدخل المدرسي.');
 await status.getByRole('button',{name:'إغلاق'}).click();
 await expect(page.getByRole('status')).toHaveCount(0);
});
test('supervisor overview and reports tabs render authentic scoped data', async ({ page }) => {
 await mockRoster(page);
 // Overview
 await page.goto('/supervisor-dashboard?tab=overview');
 await expect(page.getByText('إجمالي طلاب المدرسة')).toBeVisible();
 await expect(page.getByText('متوسط درجات الطلاب')).toBeVisible();
 await expect(page.getByText('محاولات الاختبارات')).toBeVisible();
 await expect(page.getByText('فصول تحت الإشراف')).toBeVisible();

 // Reports Panel
 await page.goto('/supervisor-dashboard?tab=reports');
 await expect(page.getByRole('heading', { name: 'تقارير الأداء المعتمدة وتوزيع المستويات' })).toBeVisible();
 await expect(page.getByRole('button', { name: 'تصدير CSV' })).toBeVisible();
 await expect(page.getByRole('button', { name: 'طباعة' })).toBeVisible();
});

test('supervisor live sessions and monitoring tabs render honest states', async ({ page }) => {
 await mockRoster(page);
 // Live Sessions (Honest empty state)
 await page.goto('/supervisor-dashboard?tab=live-sessions');
 await expect(page.getByText('الحصص التفاعلية المباشرة')).toBeVisible();
 await expect(page.getByText('لا توجد حصص تفاعلية مباشرة مجدولة حالياً لهذه المدرسة.')).toBeVisible();

 // Live Sessions (With real scheduled session)
 await page.route('**/api/v1/classroom/teacher/sessions**', (route) =>
  json(route, {
   sessions: [
    {
     id: 'sess-live-01',
     schoolId: 'school-1',
     classId: 'class-a',
     subjectId: 'subj-1',
     teacherId: 'teacher-1',
     status: 'live',
     day: '2026-11-24',
     period: 1,
     publishedMode: 'batch',
     activeBatchId: '',
     activeQuestionOrdinal: null,
     pinExpiresAt: '',
     revision: 1,
     startedAt: null,
     endedAt: null,
     createdAt: '',
     updatedAt: '',
    },
   ],
  }),
 );
 await page.goto('/supervisor-dashboard?tab=live-sessions');
 await expect(page.getByText('حصة تفاعلية - 2026-11-24')).toBeVisible();
 await expect(page.getByText('بث مباشر الآن')).toBeVisible();
 await expect(page.getByRole('link', { name: 'دخول الحصة' })).toBeVisible();

 // Live Monitoring
 await page.goto('/supervisor-dashboard?tab=live-monitoring');
 await expect(page.getByRole('heading', { name: 'شاشة المراقبة الحية للاختبارات' })).toBeVisible();
 await expect(page.getByText('متصل (0 نشط)')).toBeVisible();
 await expect(page.getByText('لا يوجد اختبارات نشطة حالياً.')).toBeVisible();
});

test('supervisor live sessions renders honest error alert on 403 or failure with retry', async ({ page }) => {
 await mockRoster(page);
 await page.route('**/api/v1/classroom/teacher/sessions**', (route) =>
  route.fulfill({
   status: 403,
   contentType: 'application/json',
   body: JSON.stringify({ message: 'غير مصرح بالوصول لحصص هذه المدرسة' }),
  }),
 );
 await page.goto('/supervisor-dashboard?tab=live-sessions');
 const alert = page.getByRole('alert');
 await expect(alert).toBeVisible();
 await expect(alert).toContainText('فشل تحميل الحصص المباشرة');
 await expect(alert).toContainText('غير مصرح بالوصول لحصص هذه المدرسة');
 await expect(page.getByText('لا توجد حصص تفاعلية مباشرة مجدولة حالياً لهذه المدرسة.')).not.toBeVisible();

 // Mock recovery on retry
 await page.route('**/api/v1/classroom/teacher/sessions**', (route) =>
  json(route, {
   sessions: [
    {
     id: 'sess-live-02',
     schoolId: 'school-1',
     classId: 'class-a',
     subjectId: 'subj-1',
     teacherId: 'teacher-1',
     status: 'upcoming',
     day: '2026-11-25',
     period: 2,
     publishedMode: 'single',
     activeBatchId: '',
     activeQuestionOrdinal: null,
     pinExpiresAt: '',
     revision: 1,
     startedAt: null,
     endedAt: null,
     createdAt: '',
     updatedAt: '',
    },
   ],
  }),
 );
 await page.getByRole('button', { name: 'إعادة المحاولة' }).click();
 await expect(page.getByText('حصة تفاعلية - 2026-11-25')).toBeVisible();
 await expect(page.getByRole('alert')).not.toBeVisible();
});

test('supervisor skills map renders honest empty state when no skills data', async ({ page }) => {
 await mockRoster(page);
 await page.goto('/supervisor-dashboard?tab=skills');
 await expect(page.getByRole('heading', { name: 'خريطة المهارات وتحليل الفجوات' })).toBeVisible();
 await expect(page.getByText('لا توجد بيانات مهارات كافية بعد.')).toBeVisible();
});
