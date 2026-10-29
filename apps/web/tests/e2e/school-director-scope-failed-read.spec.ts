import {expect, test, type Page, type Route} from '@playwright/test';

const director={id:'director-scope',email:'director@example.com',name:'مدير المدرسة',status:'active',avatarUrl:'',emailVerified:true,role:'school_admin',roles:['school_admin']};
const permissions=['SCHOOL_OVERVIEW_VIEW','SCHOOL_STUDENTS_VIEW','SCHOOL_STUDENTS_ADD','SCHOOL_STUDENTS_MOVE_CLASS','SCHOOL_CLASSES_MANAGE'];
const student={studentId:'student-1',name:'طالب موجود',email:'student@example.com',phone:'',isActive:true,classId:'class-1',className:'الأول أ'};
function json(route:Route,body:unknown,status=200){return route.fulfill({status,contentType:'application/json',body:JSON.stringify(body)});}
async function setup(page:Page){
  await page.route('**/api/v1/auth/me',route=>json(route,{user:director}));
  await page.route('**/api/v1/auth/csrf',route=>json(route,{csrfToken:'csrf-test'}));
  await page.route('**/api/v1/schools/context',route=>json(route,{contexts:[{schoolId:'school-1',schoolName:'مدرسة واحدة',role:'school_admin',permissions,modules:['SCHOOL_CORE'],source:'membership'}]}));
  await page.route('**/api/v1/schools/school-1/classes*',route=>json(route,{classes:[{id:'class-1',schoolId:'school-1',name:'الأول أ',code:'A1',status:'active'}],pagination:{page:1,limit:100,total:1,totalPages:1}}));
  await page.route('**/api/school-access/director/schools/school-1/overview',route=>json(route,{school:{schoolId:'school-1',schoolName:'مدرسة واحدة'},metrics:{students:1,classes:1,teachers:0,supervisors:0,schoolAssessments:0,completedSmartClasses:0},classes:[]}));
  await page.route('**/api/school-access/director/schools/school-1/teachers',route=>json(route,{teachers:[],assignments:[]}));
  await page.route('**/api/school-access/director/schools/school-1/students*',route=>route.request().url().includes('search=')?json(route,{message:'تعذر البحث'},503):json(route,{students:[student],total:1}));
}

for(const width of [390,820,1440]){
  test(`director failed roster refresh does not display old students at ${width}px`,async({page})=>{
    await page.setViewportSize({width,height:900});
    await setup(page);
    await page.goto('/school-director-dashboard');
    await page.getByRole('navigation',{name:'أقسام لوحة مدير المدرسة'}).getByRole('button',{name:'الطلاب',exact:true}).click();
    await expect(page.getByText('طالب موجود')).toBeVisible();
    await page.getByLabel('بحث الطلاب').fill('غير موجود');
    await page.getByLabel('بحث الطلاب').press('Enter');
    await expect(page.getByText('تعذر البحث')).toBeVisible();
    await expect(page.getByText('طالب موجود')).toHaveCount(0);
    await expect(page.getByLabel('بحث الطلاب')).toHaveValue('غير موجود');
    await page.screenshot({path:`test-results/school-director-failed-roster-${width}.png`,fullPage:true});
  });
}

test('director context read failure is not reported as an empty delegated school',async({page})=>{
  await setup(page);
  await page.route('**/api/v1/schools/context',route=>json(route,{message:'تعذر تحميل مساحة مدير المدرسة'},503));
  await page.goto('/school-director-dashboard');
  await expect(page.getByText('تعذر تحميل مساحة مدير المدرسة')).toBeVisible();
  await expect(page.getByText('اطلب من مدير المنصة ربط حسابك بمدرسة وتفعيل الصلاحيات المطلوبة.')).toHaveCount(0);
  await expect(page.getByRole('navigation',{name:'أقسام لوحة مدير المدرسة'})).toHaveCount(0);
});
