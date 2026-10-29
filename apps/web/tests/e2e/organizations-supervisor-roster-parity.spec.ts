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
 await page.route('**/api/v1/schools/*/roster?*',route=>{
  const school=route.request().url().split('/schools/')[1].split('/')[0];
  const items=students[school]||[];
  return json(route,{members:items,pagination:{page:1,limit:20,total:items.length,totalPages:1}});
 });
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
  await expect(page.getByText('طالب الأولى')).toBeVisible();
  await expect(page.getByText('طالب الثانية')).toHaveCount(0);
  await page.getByLabel('المدرسة').selectOption('school-2');
  await expect(page.getByText('طالب الثانية')).toBeVisible();
  await expect(page.getByText('طالب الأولى')).toHaveCount(0);
  await nav.getByRole('button',{name:'الملخص العام'}).click();
  await expect(page).toHaveURL(/tab=overview/);
  await page.reload();
  await expect(nav.getByRole('button',{name:'الملخص العام'})).toHaveAttribute('aria-current','page');
  await page.goBack();
  await expect(nav.getByRole('button',{name:'تعلم الطلاب وجاهزيتهم'})).toHaveAttribute('aria-current','page');
  await expect(page.locator('body')).not.toContainText('SUPERVISOR WORKSPACE');
  await expect(page.locator('body')).not.toContainText('الصلاحيات الفعلية');
  await test.info().attach('supervisor-'+width,{body:await page.screenshot({fullPage:true}),contentType:'image/png'});
 });
}
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
