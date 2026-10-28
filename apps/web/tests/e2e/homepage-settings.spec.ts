import {test,expect} from './fixtures/header-test';
const admin={id:'homepage-admin',email:'admin@example.test',name:'مدير المنصة',status:'active',roles:['admin'],role:'admin'};
for(const width of [390,820,1440]) test(`homepage saves original editor to public identity at ${width}`,async({page})=>{
 await page.setViewportSize({width,height:1000});
 await page.route('**/api/v1/auth/me',r=>r.fulfill({json:{user:admin}}));
 await page.route('**/api/v1/auth/csrf',r=>r.fulfill({json:{csrfToken:'homepage-csrf'}}));
 await page.route('**/api/v1/taxonomy/bootstrap?*',r=>r.fulfill({json:{levels:[],paths:[],subjects:[]}}));
 for(const name of ['courses','lessons']) await page.route(`**/api/v1/${name}?*`,r=>r.fulfill({json:{items:[],hasMore:false}}));
 let settings:Record<string,unknown>={hero:{}};let fail=false;
 await page.route('**/api/v1/content/homepage-settings',r=>{
  if(r.request().method()==='PATCH') {expect(r.request().headers()['x-csrf-token']).toBe('homepage-csrf');if(fail)return r.fulfill({status:500,json:{message:'تعذر الحفظ التجريبي'}});settings=r.request().postDataJSON();}
  return r.fulfill({json:settings});
 });
 await page.goto('/admin-dashboard?tab=homepage');
 await expect(page.getByRole('heading',{name:'إدارة الصفحة الرئيسية',exact:true})).toBeVisible();

 // Locate the original field by its placeholder, as source labels lack htmlFor.
 await page.getByRole('textbox',{name:'نص الشعار الأول',exact:true}).fill('هوية محفوظة');
 await page.getByRole('button',{name:'حفظ التعديلات',exact:true}).click();
 await expect(page.getByText('تم حفظ إعدادات الصفحة الرئيسية بنجاح.',{exact:true})).toBeVisible();
 await page.reload();await expect(page.getByRole('textbox',{name:'نص الشعار الأول',exact:true})).toHaveValue('هوية محفوظة');
 fail=true;await page.getByRole('textbox',{name:'نص الشعار الأول',exact:true}).fill('مسودة باقية');
 await page.getByRole('button',{name:'حفظ التعديلات',exact:true}).click();
 await expect(page.getByText('تعذر الحفظ التجريبي',{exact:true})).toBeVisible();
 await expect(page.getByRole('textbox',{name:'نص الشعار الأول',exact:true})).toHaveValue('مسودة باقية');
 await page.goto('/');await expect(page.locator('header').getByText('هوية محفوظة',{exact:true})).toBeVisible();
 await expect.poll(()=>page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
});
test('non-admin cannot access restored homepage save controls',async({page})=>{
 await page.route('**/api/v1/auth/me',r=>r.fulfill({json:{user:{...admin,roles:['student'],role:'student'}}}));
 await page.goto('/admin-dashboard?tab=homepage');await expect(page.getByText('لا تملك صلاحية إدارة الصفحة الرئيسية.',{exact:true})).toBeVisible();await expect(page.getByRole('button',{name:'حفظ التعديلات',exact:true})).toHaveCount(0);await expect(page.getByRole('link',{name:'إدارة الصفحة الرئيسية',exact:true})).toHaveCount(0);
});
test('failed initial settings load cannot save fallback defaults over persisted settings',async({page})=>{
 await page.route('**/api/v1/auth/me',r=>r.fulfill({json:{user:admin}}));
 await page.route('**/api/v1/content/homepage-settings',r=>r.fulfill({status:503,json:{message:'فشل التحميل الآمن'}}));
 await page.goto('/admin-dashboard?tab=homepage');await expect(page.getByText('فشل التحميل الآمن',{exact:true})).toBeVisible();await expect(page.getByRole('button',{name:'حفظ التعديلات',exact:true})).toBeDisabled();
});
test('slow homepage save freezes edits against a late response',async({page})=>{
 await page.route('**/api/v1/auth/me',r=>r.fulfill({json:{user:admin}}));await page.route('**/api/v1/auth/csrf',r=>r.fulfill({json:{csrfToken:'homepage-csrf'}}));
 await page.route('**/api/v1/taxonomy/bootstrap?*',r=>r.fulfill({json:{levels:[],paths:[],subjects:[]}}));for(const name of ['courses','lessons'])await page.route(`**/api/v1/${name}?*`,r=>r.fulfill({json:{items:[],hasMore:false}}));
 let release:()=>void=()=>{};const gate=new Promise<void>(r=>release=r);let patch=false;
 await page.route('**/api/v1/content/homepage-settings',async r=>{if(r.request().method()==='PATCH'){patch=true;await gate;return r.fulfill({json:r.request().postDataJSON()});}return r.fulfill({json:{hero:{}}});});
 await page.goto('/admin-dashboard?tab=homepage');const field=page.getByRole('textbox',{name:'نص الشعار الأول',exact:true});await field.fill('هوية نهائية');await page.getByRole('button',{name:'حفظ التعديلات',exact:true}).click();await expect.poll(()=>patch).toBe(true);await expect(field).toBeDisabled();release();await expect(page.getByText('تم حفظ إعدادات الصفحة الرئيسية بنجاح.',{exact:true})).toBeVisible();await expect(field).toHaveValue('هوية نهائية');
});
