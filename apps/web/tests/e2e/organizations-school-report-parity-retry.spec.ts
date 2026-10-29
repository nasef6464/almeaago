import { expect, test, type Page, type Route } from '@playwright/test';

const schoolId='school-1';
const assessmentId='assessment-1';
const reportUrl=`**/api/school-access/director/schools/${schoolId}/academic/assessments/${assessmentId}/report`;
const learnerUrl=`**/api/school-access/director/schools/${schoolId}/academic/assessments/${assessmentId}/learners*`;
function json(route:Route,body:unknown,status=200){
  return route.fulfill({status,contentType:'application/json',body:JSON.stringify(body)});
}
async function setup(page:Page){
  await page.route('**/api/v1/auth/me',route=>json(route,{user:{
    id:'director-1',email:'director@example.com',name:'مدير المدرسة',status:'active',
    avatarUrl:'',emailVerified:true,role:'school_admin',roles:['school_admin'],
  }}));
  await page.route('**/api/v1/auth/csrf',route=>json(route,{csrfToken:'csrf-director'}));
  await page.route('**/api/v1/taxonomy/bootstrap?phase=core',route=>json(route,{paths:[],subjects:[]}));
  await page.route('**/api/v1/schools/context',route=>json(route,{contexts:[{
    schoolId,schoolName:'مدرسة المئة',role:'school_admin',source:'membership',
    permissions:['SCHOOL_OVERVIEW_VIEW','SCHOOL_ASSESSMENTS_MANAGE','SCHOOL_REPORTS_DETAILED_VIEW'],
    modules:['SCHOOL_CORE','SCHOOL_ASSESSMENTS','SCHOOL_INTELLIGENCE'],
  }]}));
  await page.route('**/api/school-access/director/schools/school-1/overview',route=>json(route,{
    school:{schoolId,schoolName:'مدرسة المئة'},
    metrics:{students:2,classes:1,teachers:1,supervisors:0,schoolAssessments:1,completedSmartClasses:0},
    classes:[{classId:'class-1',className:'الأول أ'}],
  }));
  await page.route('**/api/school-access/director/schools/school-1/academic/assessments',route=>json(route,{
    assessments:[{id:assessmentId,title:'اختبار النسبة',subjectId:'subject-1',isPublished:true,targetGroupIds:['class-1']}],
    classes:[{classId:'class-1',className:'الأول أ'}],
  }));
}
const report={
  coverage:{complete:false,missingEvidence:['started_attempts','subject_totals'],subjects:{completed:1,withEvidence:0,complete:false}},
  audience:{targeted:2},participation:{completed:1,notCompleted:1,started:null},
  scores:{average:80,passRate:100,highest:80,lowest:80},
  subjects:[],sections:[],skills:[],subjectBreakdowns:[],
};

for(const width of [390,820,1440]){
  test(`school assessment report retry, source analysis tab and learner shortcut at ${width}px RTL`,async({page})=>{
    await setup(page);
    await page.setViewportSize({width,height:900});
    let calls=0;
    let allowSuccess=false;
    await page.route(reportUrl,route=>{
      calls++;
      return allowSuccess?json(route,report):json(route,{message:'temporary read failure'},503);
    });
    const statuses:string[]=[];
    await page.route(learnerUrl,route=>{
      statuses.push(new URL(route.request().url()).searchParams.get('status')||'all');
      return json(route,{learners:[],pagination:{page:1,limit:12,total:0,totalPages:0}});
    });
    await page.goto('/school-director-dashboard');
    await page.getByRole('navigation',{name:'أقسام لوحة مدير المدرسة'})
      .getByRole('button',{name:'اختبارات المدرسة'}).click();
    await page.getByRole('button',{name:'النتائج والإدارة'}).click();
    const dialog=page.getByRole('dialog',{name:'النتائج والإدارة — اختبار النسبة'});
    await expect(dialog.getByRole('alert')).toContainText('تعذر تحميل');
    allowSuccess=true;
    await dialog.getByRole('button',{name:'إعادة المحاولة'}).click();
    await expect(dialog.getByText('متوسط الدرجات')).toBeVisible();
    expect(calls).toBeGreaterThanOrEqual(2);
    await dialog.getByRole('button',{name:'المواد والمهارات'}).click();
    await expect(dialog.getByText('لا توجد بيانات مواد مصنفة في النتائج المحفوظة.')).toBeVisible();
    await dialog.getByRole('button',{name:'الملخص'}).click();
    await dialog.getByRole('button',{name:'من لم يسلّم؟'}).click();
    await expect(dialog.getByRole('region',{name:'نتائج الطلاب'}).getByLabel('حالة الأداء')).toHaveValue('not_completed');
    await expect.poll(()=>statuses.includes('not_completed')).toBe(true);
    expect(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth)).toBe(true);
    await page.screenshot({path:`test-results/school-report-retry-${width}.png`,fullPage:true});
    await page.keyboard.press('Escape');
    await expect(dialog).toHaveCount(0);
  });
}
