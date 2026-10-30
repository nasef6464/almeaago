import { expect, test, type Page, type Route } from '@playwright/test';

const admin={
  id:'admin-1',email:'admin@example.com',name:'مدير المنصة',status:'active',avatarUrl:'',emailVerified:true,
  role:'admin',roles:['admin'],
};
const teacher={...admin,id:'teacher-1',role:'teacher',roles:['teacher'],name:'معلم'};

function json(route:Route,body:unknown,status=200){
  return route.fulfill({status,contentType:'application/json',body:JSON.stringify(body)});
}
async function auth(page:Page,user:typeof admin|typeof teacher){
  await page.route('**/api/v1/auth/me',route=>json(route,{user}));
  await page.route('**/api/v1/auth/csrf',route=>json(route,{csrfToken:'csrf-taxonomy'}));
}

function seed(){
  return {
    paths:[
      {id:'path-1',code:'QDR',name:'القدرات',parentPathId:'',description:'المسار الأساسي',sortOrder:1,status:'active'},
      {id:'path-archived',code:'OLD',name:'مسار قديم',parentPathId:'',description:'',sortOrder:9,status:'archived'},
    ],
    levels:[{id:'level-1',pathId:'path-1',code:'L1',name:'المرحلة الأولى',sortOrder:1,status:'active'}],
    subjects:[{id:'subject-1',pathId:'path-1',levelId:'level-1',code:'QNT',name:'الكمي',sortOrder:1,status:'active'}],
    skills:[
      {id:'skill-main',subjectId:'subject-1',parentSkillId:'',code:'NUM',name:'الأعداد',description:'مهارة رئيسية',kind:'main',sortOrder:1,status:'active'},
      {id:'skill-sub',subjectId:'subject-1',parentSkillId:'skill-main',code:'NUM-1',name:'العمليات',description:'مهارة فرعية',kind:'sub',sortOrder:1,status:'inactive'},
    ],
  };
}

async function mockTaxonomy(page:Page){
  const data=seed();
  let createPathCsrf='';
  let patchPathCsrf='';
  let createSkillCsrf='';

  await page.route('**/api/v1/taxonomy/admin/bootstrap',route=>json(route,data));
  await page.route('**/api/v1/taxonomy/admin/paths',async route=>{
    createPathCsrf=route.request().headers()['x-csrf-token']||'';
    const body=route.request().postDataJSON() as {code:string;name:string;description:string;parentPathId:string;sortOrder:number};
    data.paths.push({id:'path-2',code:body.code.toUpperCase(),name:body.name,parentPathId:body.parentPathId,description:body.description,sortOrder:body.sortOrder,status:'active'});
    return json(route,{path:{id:'path-2'}},201);
  });
  await page.route('**/api/v1/taxonomy/admin/paths/path-1',async route=>{
    patchPathCsrf=route.request().headers()['x-csrf-token']||'';
    const body=route.request().postDataJSON() as {status?:'active'|'inactive'|'archived';name?:string;description?:string};
    const row=data.paths.find(x=>x.id==='path-1')!;
    if(body.status)row.status=body.status;
    if(body.name)row.name=body.name;
    if(body.description!==undefined)row.description=body.description;
    return json(route,{path:row});
  });
  await page.route('**/api/v1/taxonomy/admin/skills',async route=>{
    createSkillCsrf=route.request().headers()['x-csrf-token']||'';
    const body=route.request().postDataJSON() as {subjectId:string;parentSkillId:string;code:string;name:string;description:string;kind:'main'|'sub';sortOrder:number};
    data.skills.push({id:'skill-new',...body,code:body.code.toUpperCase(),status:'active'});
    return json(route,{skill:{id:'skill-new'}},201);
  });
  return {
    get createPathCsrf(){return createPathCsrf},
    get patchPathCsrf(){return patchPathCsrf},
    get createSkillCsrf(){return createSkillCsrf},
  };
}

test('taxonomy admin desktop manages lifecycle-safe hierarchy with csrf',async({page})=>{
  await auth(page,admin);
  const observed=await mockTaxonomy(page);
  await page.setViewportSize({width:1440,height:1000});
  await page.goto('/admin-dashboard/taxonomy');

  await expect(page.getByRole('heading',{name:'إدارة المسارات'})).toBeVisible();
  await expect(page.getByText('مسار قديم')).toBeVisible();
  await expect(page.getByTestId('taxonomy-admin-page').getByText('شجرة المهارات')).toHaveCount(0);
  await expect(page.getByRole('button',{name:/حذف/})).toHaveCount(0);

  await page.getByLabel('كود المسار الجديد').fill('sat');
  await page.getByLabel('اسم المسار الجديد').fill('التحصيلي');
  await page.getByRole('button',{name:'إنشاء المسار'}).click();
  await expect(page.getByText('تم إنشاء المسار.')).toBeVisible();
  await expect(page.getByRole('button',{name:/التحصيلي SAT نشط/})).toBeVisible();
  expect(observed.createPathCsrf).toBe('csrf-taxonomy');

  await page.getByLabel('حالة المسار').selectOption('inactive');
  await expect(page.getByText('تم تحديث الحالة إلى «غير نشط».')).toBeVisible();
  expect(observed.patchPathCsrf).toBe('csrf-taxonomy');

  await page.screenshot({path:'test-results/taxonomy-admin-desktop.png',fullPage:true});

  // The original platform has a separate Skills Center tab. The same
  // taxonomy service still owns the relationship and the CSRF mutation.
  await page.goto('/admin-dashboard?tab=skills');
  await expect(page.getByRole('heading',{name:'مركز المهارات'})).toBeVisible();
  await page.getByRole('button',{name:'فتح المهارة الرئيسة الأعداد'}).click();
  await expect(page.getByText('العمليات',{exact:true})).toBeVisible();
  await page.getByRole('button',{name:'إضافة مهارة فرعية'}).click();
  const editor=page.getByRole('dialog',{name:'إضافة مهارة فرعية'});
  await editor.getByRole('textbox',{name:'كود المهارة'}).fill('num-2');
  await editor.getByRole('textbox',{name:'اسم المهارة'}).fill('النسب');
  await editor.getByRole('button',{name:'حفظ المهارة'}).click();
  await expect(page.getByText('تم حفظ المهارة.')).toBeVisible();
  await expect(page.getByText('النسب')).toBeVisible();
  expect(observed.createSkillCsrf).toBe('csrf-taxonomy');

  await page.screenshot({path:'test-results/admin-skills-center-desktop.png',fullPage:true});
});

test('taxonomy admin mobile separates path workspace and skill center controls',async({page})=>{
  await auth(page,admin);
  await mockTaxonomy(page);
  await page.setViewportSize({width:390,height:844});
  await page.goto('/admin-dashboard/taxonomy');

  await expect(page.getByRole('heading',{name:'إدارة المسارات'})).toBeVisible();
  await expect(page.getByRole('heading',{name:'شجرة المسارات'})).toBeVisible();
  await expect(page.getByRole('heading',{name:'المواد'})).toBeVisible();
  await expect(page.getByText('شجرة المهارات',{exact:true})).toHaveCount(0);
  await expect(page.getByLabel('كود المسار الجديد')).toBeVisible();
  await page.screenshot({path:'test-results/taxonomy-admin-mobile.png',fullPage:true});
  await page.goto('/admin-dashboard?tab=skills');
  await expect(page.getByRole('heading',{name:'مركز المهارات'})).toBeVisible();
  await expect(page.getByTestId('skills-filter-path')).toBeVisible();
  await page.getByRole('button',{name:'فتح المهارة الرئيسة الأعداد'}).click();
  await expect(page.getByRole('button',{name:'إضافة مهارة فرعية'})).toBeVisible();
  await page.screenshot({path:'test-results/admin-skills-center-mobile.png',fullPage:true});
});

test('taxonomy admin page denies teacher persona before issuing admin bootstrap',async({page})=>{
  await auth(page,teacher);
  let adminBootstrapCalls=0;
  await page.route('**/api/v1/taxonomy/admin/bootstrap',route=>{adminBootstrapCalls+=1;return json(route,seed())});
  await page.goto('/admin-dashboard/taxonomy');

  await expect(page.getByText('إدارة التصنيف متاحة لمدير المنصة فقط.')).toBeVisible();
  expect(adminBootstrapCalls).toBe(0);
});
