import { expect, test } from '@playwright/test';
const fixture = '/tests/e2e/fixtures/assessment-editor/';
async function setup(page: import('@playwright/test').Page) {
  await page.route('**/api/v1/questions**', route => route.fulfill({json:{items:[],page:1,limit:100,hasMore:false}}));
  await page.route('**/api/v1/assessments', route => route.fulfill({json:{assessment:{}}}));
  await page.goto(fixture, {waitUntil:'domcontentloaded'});
  await page.getByPlaceholder('مثال: EXAM-TAH-PHYS-01 أو MOCK-QUD-01').fill('EXAM-1');
  await page.getByPlaceholder('مثال: الاختبار المحاكي الشامل للقدرات العامة — النموذج التجريبي 1').fill('اختبار تجريبي');
}
test('normal assessment sends supported option layout',async({page})=>{
 await setup(page);
 const request=page.waitForRequest(r=>r.url().endsWith('/api/v1/assessments')&&r.method()==='POST');
 await page.getByRole('button',{name:'حفظ الاختبار',exact:true}).click();
 const body=(await request).postDataJSON();
 expect(body.version.optionLayout).toBe('auto');
 expect(body.version.normalMode).toBe('exam');
});
test('mock sends complete valid scope and section identifiers',async({page})=>{
 await setup(page);
 await page.getByRole('button',{name:'محاكي قياس رسمي (أقسام ومؤقت)'}).click();
 await page.getByLabel('مادة الاختبار').selectOption('');
 await page.getByRole('navigation',{name:'أقسام منشئ الاختبارات'}).getByRole('button',{name:'الأقسام والمؤقت',exact:true}).click();
 await page.getByRole('button',{name:'توليد أقسام محاكي القدرات (5 أقسام)'}).click();
 const request=page.waitForRequest(r=>r.url().endsWith('/api/v1/assessments')&&r.method()==='POST');
 await page.getByRole('button',{name:'حفظ الاختبار',exact:true}).click();
 const body=(await request).postDataJSON();
 expect(body.version).toMatchObject({kind:'mock',normalMode:'',subjectId:'',optionLayout:'auto',mockCategory:'qudrat',mockTargetScore:60,mockStrictSectionLock:true,mockPresentationMode:'qiyas_strict'});
 expect(body.sections).toHaveLength(5);
 for(const section of body.sections) expect(section.id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i);
});

test('switching from mock back to normal clears mock-only fields',async({page})=>{
 await setup(page);
 await page.getByRole('button',{name:'محاكي قياس رسمي (أقسام ومؤقت)'}).click();
 await page.getByRole('button',{name:'اختبار عادي (تقييم / تدريب)'}).click();
 const request=page.waitForRequest(r=>r.url().endsWith('/api/v1/assessments')&&r.method()==='POST');
 await page.getByRole('button',{name:'حفظ الاختبار',exact:true}).click();
 const body=(await request).postDataJSON();
 expect(body.version).toMatchObject({kind:'normal',normalMode:'exam',mockCategory:'',mockTargetScore:null,mockStrictSectionLock:null,mockPresentationMode:''});
});
test('path mock searches questions using explicitly selected material',async({page})=>{
 await setup(page);
 await page.getByRole('button',{name:'محاكي قياس رسمي (أقسام ومؤقت)'}).click();
 await page.getByLabel('مادة الاختبار').selectOption('');
 await page.getByRole('navigation',{name:'أقسام منشئ الاختبارات'}).getByRole('button',{name:'الأسئلة',exact:true}).click();
 const request=page.waitForRequest(r=>r.url().includes('/api/v1/questions?')&&new URL(r.url()).searchParams.get('subjectId')==='33333333-3333-4333-8333-333333333333');
 await page.getByLabel('مادة البحث في بنك الأسئلة').selectOption('33333333-3333-4333-8333-333333333333');
 expect(new URL((await request).url()).searchParams.get('pathId')).toBe('11111111-1111-4111-8111-111111111111');
});

test('flexible mock mode preserves its section policy in the save request',async({page})=>{
 await setup(page);
 await page.getByRole('button',{name:'محاكي قياس رسمي (أقسام ومؤقت)'}).click();
 await page.getByRole('button',{name:/النمط المرن/}).click();
 await page.getByRole('navigation',{name:'أقسام منشئ الاختبارات'}).getByRole('button',{name:'الأقسام والمؤقت',exact:true}).click();
 await page.getByRole('button',{name:'توليد أقسام محاكي القدرات (5 أقسام)'}).click();
 const request=page.waitForRequest(r=>r.url().endsWith('/api/v1/assessments')&&r.method()==='POST');
 await page.getByRole('button',{name:'حفظ الاختبار',exact:true}).click();
 const body=(await request).postDataJSON();
 expect(body.version).toMatchObject({mockStrictSectionLock:false,mockPresentationMode:'flexible'});
 expect(body.sections).toHaveLength(5);
 expect(body.sections.every((section:{strictLock:boolean})=>!section.strictLock)).toBe(true);
});

test('admin can select mock category for any path',async({page})=>{
 test.setTimeout(90000);
 await setup(page);
 await page.getByRole('button',{name:'محاكي قياس رسمي (أقسام ومؤقت)'}).click();
 await page.getByLabel('تصنيف المحاكي').selectOption('specialized');
 const request=page.waitForRequest(r=>r.url().endsWith('/api/v1/assessments')&&r.method()==='POST');
 await page.getByRole('button',{name:'حفظ الاختبار',exact:true}).click();
 expect((await request).postDataJSON().version.mockCategory).toBe('specialized');
});

test('question bank error is visible and is not reported as empty',async({page})=>{
 test.setTimeout(90000);
 await setup(page);
 await page.route('**/api/v1/questions**',route=>route.fulfill({status:403,json:{message:'Forbidden'}}));
 await page.getByRole('navigation',{name:'أقسام منشئ الاختبارات'}).getByRole('button',{name:'الأسئلة',exact:true}).click();
 await page.getByLabel('بحث بنك الأسئلة').fill('test-error');
 await expect(page.getByText('تعذر تحميل بنك الأسئلة. تحقق من الصلاحية أو الاتصال ثم حاول مجددًا.')).toBeVisible();
 await expect(page.getByText('لا توجد أسئلة مطابقة للبحث في هذا المسار والمادة.')).toHaveCount(0);
 await page.route('**/api/v1/questions**',route=>route.fulfill({json:{items:[],page:1,limit:100,hasMore:false}}));
 await page.getByRole('button',{name:'إعادة المحاولة'}).click();
 await expect(page.getByText('لا توجد أسئلة مطابقة للبحث في هذا المسار والمادة.')).toBeVisible();
});

test('automatic question selection includes later bank pages',async({page})=>{
 test.setTimeout(90000);
 await setup(page);
 const make=(id:string)=>({id,questionCode:id,currentVersion:1,pathId:'11111111-1111-4111-8111-111111111111',subjectId:'22222222-2222-4222-8222-222222222222',workflowStatus:'approved',type:'text',text:id,imageAssetId:'',difficulty:'easy'});
 await page.route('**/api/v1/questions**',route=>{const p=new URL(route.request().url()).searchParams.get('page');return route.fulfill({json:{items:p==='2'?[make('later-question')]:Array.from({length:10},(_,i)=>make(`first-${i}`)),page:Number(p),limit:100,hasMore:p!=='2'}})});
 await page.getByRole('navigation',{name:'أقسام منشئ الاختبارات'}).getByRole('button',{name:'الأسئلة',exact:true}).click();
 await page.getByLabel('بحث بنك الأسئلة').fill('first');
 await expect(page.getByText('first-0').first()).toBeVisible();
 await page.getByRole('button',{name:'التوليد التلقائي للأسئلة من البنك'}).click();
 await page.getByRole('button',{name:'بدء التوليد والإضافة الآن'}).click();
 await expect(page.getByText('later-question').first()).toBeVisible({timeout:12000});
});

test('mock random selection requires its destination section',async({page})=>{
 test.setTimeout(90000);
 await setup(page);
 await page.getByRole('button',{name:'محاكي قياس رسمي (أقسام ومؤقت)'}).click();
 await page.getByRole('navigation',{name:'أقسام منشئ الاختبارات'}).getByRole('button',{name:'الأسئلة',exact:true}).click();
 await page.getByRole('button',{name:'التوليد التلقائي للأسئلة من البنك'}).click();
 await page.getByRole('button',{name:'بدء التوليد والإضافة الآن'}).click();
 await expect(page.getByText('أضف قسمًا للمحاكي واختره قبل توليد أسئلته.')).toBeVisible();
});

test('admin can browse question-bank pages and keep selected question details',async({page})=>{
 test.setTimeout(90000);
 await setup(page);
 const make=(id:string)=>({id,questionCode:id,currentVersion:1,pathId:'11111111-1111-4111-8111-111111111111',subjectId:'22222222-2222-4222-8222-222222222222',workflowStatus:'approved',type:'text',text:id,imageAssetId:'',difficulty:'easy'});
 await page.route('**/api/v1/questions**',route=>{const p=new URL(route.request().url()).searchParams.get('page');return route.fulfill({json:{items:[make(p==='2'?'later-question':'first-question')],page:Number(p),limit:100,hasMore:p!=='2'}})});
 await page.getByRole('navigation',{name:'أقسام منشئ الاختبارات'}).getByRole('button',{name:'الأسئلة',exact:true}).click();
 await page.getByLabel('بحث بنك الأسئلة').fill('pages');
 await expect(page.getByText('first-question').first()).toBeVisible();
 await page.getByRole('button',{name:'الصفحة التالية للأسئلة'}).click();
 await expect(page.getByText('later-question').first()).toBeVisible();
 await page.getByRole('button',{name:'إضافة السؤال later-question'}).click();
 await page.getByRole('button',{name:'الصفحة السابقة للأسئلة'}).click();
 await expect(page.getByText('later-question').first()).toBeVisible();
});

test('mock generation rejects a bank from a different section subject',async({page})=>{
 test.setTimeout(90000);
 await setup(page);
 await page.getByRole('button',{name:'محاكي قياس رسمي (أقسام ومؤقت)'}).click();
 await page.getByRole('navigation',{name:'أقسام منشئ الاختبارات'}).getByRole('button',{name:'الأقسام والمؤقت',exact:true}).click();
 await page.getByRole('button',{name:'توليد أقسام محاكي القدرات (5 أقسام)'}).click();
 await page.getByRole('navigation',{name:'أقسام منشئ الاختبارات'}).getByRole('button',{name:'الأسئلة',exact:true}).click();
 await page.getByLabel('مادة البحث في بنك الأسئلة').selectOption('33333333-3333-4333-8333-333333333333');
 await page.getByRole('button',{name:'التوليد التلقائي للأسئلة من البنك'}).click();
 await page.locator('select').filter({has:page.locator('option').filter({hasText:'القسم الأول — كمي'})}).last().selectOption({label:'القسم الأول — كمي'});
 await page.getByRole('button',{name:'بدء التوليد والإضافة الآن'}).click();
 await expect(page.getByText('مادة بنك الأسئلة لا تطابق مادة القسم المحدد.')).toBeVisible();
});

test('manual mock question awaits an explicit section choice',async({page})=>{
 test.setTimeout(90000);
 await setup(page);
 await page.getByRole('button',{name:'محاكي قياس رسمي (أقسام ومؤقت)'}).click();
 await page.getByRole('navigation',{name:'أقسام منشئ الاختبارات'}).getByRole('button',{name:'الأقسام والمؤقت',exact:true}).click();
 await page.getByRole('button',{name:'توليد أقسام محاكي القدرات (5 أقسام)'}).click();
 await page.route('**/api/v1/questions**',route=>route.fulfill({json:{items:[{id:'verbal-question',questionCode:'verbal-question',currentVersion:1,pathId:'11111111-1111-4111-8111-111111111111',subjectId:'33333333-3333-4333-8333-333333333333',workflowStatus:'approved',type:'text',text:'سؤال لفظي',imageAssetId:'',difficulty:'easy'}],page:1,limit:100,hasMore:false}}));
 await page.getByRole('navigation',{name:'أقسام منشئ الاختبارات'}).getByRole('button',{name:'الأسئلة',exact:true}).click();
 await page.getByLabel('مادة البحث في بنك الأسئلة').selectOption('33333333-3333-4333-8333-333333333333');
 await page.getByRole('button',{name:'إضافة السؤال verbal-question'}).click();
 await expect(page.getByLabel('قسم السؤال 1')).toHaveValue('');
 await page.getByLabel('قسم السؤال 1').selectOption({label:'القسم الثاني — لفظي'});
 await expect(page.getByLabel('قسم السؤال 1').locator('option:checked')).toHaveText('القسم الثاني — لفظي');
});
