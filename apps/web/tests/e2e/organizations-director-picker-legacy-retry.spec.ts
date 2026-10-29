import { expect, test, type Page, type Route } from '@playwright/test';

// Source oracle: almeaacodax@bf7281fc, dashboards/school-director/DirectorQuestionPicker.tsx
// and SchoolDirectorAcademicCenter.tsx. The question search is submitted explicitly,
// a failed approved-question read has a retry control, and the first class is selected.
const director={id:'director-1',email:'director@example.com',name:'مدير المدرسة',status:'active',avatarUrl:'',emailVerified:true,role:'school_admin',roles:['school_admin']};
const permissions=['SCHOOL_OVERVIEW_VIEW','SCHOOL_STUDENTS_VIEW','SCHOOL_ASSESSMENTS_MANAGE'];
const classes=[{id:'class-1',schoolId:'school-1',code:'A1',name:'الأول أ',status:'active'}];
function json(route:Route,body:unknown,status=200){return route.fulfill({status,contentType:'application/json',body:JSON.stringify(body)});}
async function setup(page:Page){
  await page.route('**/api/v1/auth/me',route=>json(route,{user:director}));
  await page.route('**/api/v1/auth/csrf',route=>json(route,{csrfToken:'csrf-director'}));
  await page.route('**/api/v1/taxonomy/bootstrap?phase=core',route=>json(route,{paths:[{id:'path-1',name:'قدرات'}],subjects:[{id:'subject-1',pathId:'path-1',name:'الرياضيات',code:'MATH',sortOrder:1}]}));
  await page.route('**/api/v1/schools/context',route=>json(route,{contexts:[{schoolId:'school-1',schoolName:'مدرسة المئة',role:'school_admin',permissions,modules:['SCHOOL_CORE','SCHOOL_ASSESSMENTS'],source:'membership'}]}));
  await page.route('**/api/v1/schools/school-1/classes*',route=>json(route,{classes,pagination:{page:1,limit:100,total:1,totalPages:1}}));
  await page.route('**/api/school-access/director/schools/school-1/overview',route=>json(route,{school:{schoolId:'school-1',schoolName:'مدرسة المئة'},metrics:{students:1,classes:1,teachers:0,supervisors:0,schoolAssessments:0,completedSmartClasses:0},classes:[{classId:'class-1',className:'الأول أ'}]}));
  await page.route('**/api/school-access/director/schools/school-1/students*',route=>json(route,{students:[],total:0}));
  await page.route('**/api/school-access/director/schools/school-1/academic/assessments',route=>json(route,{assessments:[],classes:[{classId:'class-1',className:'الأول أ'}]}));
}
for(const width of [390,820,1440]){
  test(`director school picker source search/retry and failed-save draft at ${width}px RTL`,async({page})=>{
    await page.setViewportSize({width,height:900});
    await setup(page);
    let questionReads=0;
    const searches:string[]=[];
    await page.route('**/api/school-access/director/schools/school-1/academic/available-questions?*',route=>{
      questionReads++;
      searches.push(new URL(route.request().url()).searchParams.get('search')||'');
      if(questionReads===1)return json(route,{message:'temporarily unavailable'},503);
      return json(route,{items:[{id:'question-1',questionCode:'MATH-014',text:'سؤال رياضيات معتمد',type:'mcq',imageUrl:'',imageAlt:'',currentVersion:1}],hasMore:false});
    });
    const keys:string[]=[];
    let saveCalls=0;
    await page.route('**/api/school-access/director/schools/school-1/academic/assessments',route=>{
      if(route.request().method()==='GET')return json(route,{assessments:[],classes:[{classId:'class-1',className:'الأول أ'}]});
      keys.push(route.request().headers()['idempotency-key']||'');
      saveCalls++;
      if(saveCalls===1)return json(route,{message:'temporary save failure'},503);
      return json(route,{assessment:{assessmentId:'assessment-1',title:'اختبار الفصل',classId:'class-1',targetScope:'class'}},201);
    });
    await page.goto('/school-director-dashboard');
    await page.getByRole('navigation',{name:'أقسام لوحة مدير المدرسة'}).getByRole('button',{name:'اختبارات المدرسة'}).click();
    await page.getByRole('button',{name:'إنشاء اختبار',exact:true}).click();
    await expect(page.getByLabel('فصل الاختبار المدرسي')).toHaveValue('class-1');
    await page.getByLabel('مسار الاختبار المدرسي').selectOption('path-1');
    await page.getByLabel('مادة الاختبار المدرسي').selectOption('subject-1');
    await expect(page.getByRole('alert').filter({hasText:'temporarily unavailable'})).toBeVisible();
    await page.getByRole('button',{name:'إعادة المحاولة'}).click();
    await expect(page.getByText('سؤال رياضيات معتمد')).toBeVisible();
    expect(questionReads).toBe(2);
    const search=page.getByLabel('البحث في الأسئلة');
    await search.fill('المعادلات');
    await page.waitForTimeout(450);
    expect(questionReads).toBe(2);
    await page.getByRole('button',{name:'بحث',exact:true}).click();
    await expect.poll(()=>questionReads).toBe(3);
    expect(searches.at(-1)).toBe('المعادلات');
    await page.getByLabel('اختيار السؤال MATH-014').check();
    await page.getByLabel('عنوان الاختبار المدرسي').fill('اختبار الفصل');
    await page.screenshot({path:`test-results/schools-question-picker-legacy-${width}.png`,fullPage:true});
    await page.getByRole('button',{name:'إنشاء ونشر للطلاب المستهدفين'}).click();
    await expect(page.getByRole('alert').filter({hasText:'temporary save failure'})).toBeVisible();
    await expect(page.getByLabel('عنوان الاختبار المدرسي')).toHaveValue('اختبار الفصل');
    await expect(page.getByLabel('اختيار السؤال MATH-014')).toBeChecked();
    await page.getByRole('button',{name:'إنشاء ونشر للطلاب المستهدفين'}).click();
    await expect(page.getByRole('button',{name:'إنشاء اختبار',exact:true})).toBeVisible();
    expect(saveCalls).toBe(2);
    expect(keys[0]).toBeTruthy();
    expect(keys[1]).toBe(keys[0]);
    expect(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth)).toBe(true);
  });
}
