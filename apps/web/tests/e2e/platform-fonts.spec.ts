import {expect,test,type Page} from '@playwright/test';
const admin={id:'fonts-admin',email:'admin@example.test',name:'مدير المنصة',status:'active',avatarUrl:'',emailVerified:true,role:'admin',roles:['admin']};
async function auth(page:Page,roles=['admin']) {
 await page.route('**/api/v1/auth/me',r=>r.fulfill({json:{user:{...admin,role:roles[0],roles}}}));
 await page.route('**/api/v1/auth/csrf',r=>r.fulfill({json:{csrfToken:'fonts-csrf'}}));
}
for(const width of [390,820,1440]) test(`source font editor previews saves uploads and resets at ${width}`,async({page})=>{
 await page.setViewportSize({width,height:1000});await auth(page);
 let settings:Record<string,unknown>={bodyFont:'tajawal',headingFont:'tajawal',navigationFont:'tajawal',buttonFont:'tajawal'};
 let rejectSave=false;
 await page.route('**/api/v1/content/platform-font-settings',async route=>{
  if(route.request().method()==='PATCH') {
   expect(route.request().headers()['x-csrf-token']).toBe('fonts-csrf');
   if(rejectSave) return route.fulfill({status:500,json:{message:'تعذر الحفظ التجريبي'}});
   settings={...settings,...route.request().postDataJSON()};
  }
  return route.fulfill({json:settings});
 });
 await page.goto('/admin-dashboard/platform-fonts');
 const body=page.locator('section').filter({has:page.getByRole('heading',{name:'النصوص العامة',exact:true})});
 await expect(body).toBeVisible();
 await body.getByRole('combobox').nth(0).selectOption('system');
 await body.getByRole('textbox',{name:'حجم النصوص العامة',exact:true}).fill('18px');
 await expect(page.locator('body')).toHaveCSS('font-size','18px');
 await body.getByRole('textbox',{name:'لون النصوص العامة كنص',exact:true}).fill('#123456');
 await body.getByRole('button',{name:'مسح',exact:true}).click();
 await expect(body.getByRole('textbox',{name:'لون النصوص العامة كنص',exact:true})).toHaveValue('');
 await page.getByLabel('رفع ملف خط مخصص للنصوص',{exact:true}).setInputFiles({name:'TestFont.woff2',mimeType:'font/woff2',buffer:Buffer.from('wOF2-font-test')});
 await expect(body.getByRole('combobox').nth(0)).toHaveValue('custom');
 await page.getByRole('button',{name:'حفظ التعديلات',exact:true}).click();
 await expect(page.getByText('تم حفظ إعدادات الخطوط وتطبيقها على المنصة.',{exact:true})).toBeVisible();
 await page.reload();
 await expect(body.getByRole('textbox',{name:'حجم النصوص العامة',exact:true})).toHaveValue('18px');
 await expect(page.getByText(/الملف الحالي: TestFont.woff2/)).toBeVisible();
 await page.getByRole('button',{name:'رجوع للافتراضي',exact:true}).click();
 await expect(body.getByRole('textbox',{name:'حجم النصوص العامة',exact:true})).toHaveValue('');
 rejectSave=true;
 await page.getByRole('button',{name:'حفظ التعديلات',exact:true}).click();
 await expect(page.getByText('تعذر الحفظ التجريبي',{exact:true})).toBeVisible();
 await expect(page.getByText('تم حفظ إعدادات الخطوط وتطبيقها على المنصة.',{exact:true})).toHaveCount(0);
 await page.reload();
 await expect(body.getByRole('textbox',{name:'حجم النصوص العامة',exact:true})).toHaveValue('18px');
 await expect.poll(()=>page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
});
test('non-admin cannot open the font editor or its save controls',async({page})=>{
 await auth(page,['student']);
 await page.route('**/api/v1/content/platform-font-settings',r=>r.fulfill({json:{}}));
 await page.goto('/admin-dashboard/platform-fonts');
 await expect(page.getByText('لا تملك صلاحية إدارة خطوط المنصة.',{exact:true})).toBeVisible();
 await expect(page.getByRole('button',{name:'حفظ التعديلات'})).toHaveCount(0);
 await expect(page.getByRole('link',{name:'إدارة خطوط المنصة',exact:true})).toHaveCount(0);
});
test('bootstrap failure keeps source defaults and editor shows a load error',async({page})=>{
 await auth(page);
 await page.route('**/api/v1/content/platform-font-settings',r=>r.fulfill({status:503,json:{message:'تعذر تحميل إعدادات الخطوط.'}}));
 await page.goto('/admin-dashboard/platform-fonts');
 await expect(page.getByText('تعذر تحميل إعدادات الخطوط.',{exact:true})).toBeVisible();
 await expect.poll(()=>page.evaluate(()=>document.documentElement.style.getPropertyValue('--platform-font-body'))).toContain('Tajawal');
});
test('late bootstrap response cannot overwrite a locally saved font',async({page})=>{
 await auth(page);let reads=0;let release:()=>void=()=>{};
 const blocked=new Promise<void>(resolve=>{release=resolve});
 await page.route('**/api/v1/content/platform-font-settings',async route=>{
  if(route.request().method()==='PATCH') return route.fulfill({json:route.request().postDataJSON()});
  reads++;
  if(reads===1) {await blocked;return route.fulfill({json:{bodyFont:'tajawal',bodySize:'12px'}});}
  return route.fulfill({json:{bodyFont:'system'}});
 });
 await page.goto('/about');
 await expect.poll(()=>reads).toBe(1);
 await page.evaluate(()=>{history.pushState({},'', '/admin-dashboard/platform-fonts');window.dispatchEvent(new PopStateEvent('popstate'));});
 await expect(page.getByRole('textbox',{name:'حجم النصوص العامة',exact:true})).toBeVisible();
 const size=page.getByRole('textbox',{name:'حجم النصوص العامة',exact:true});await size.fill('18px');
 await page.getByRole('button',{name:'حفظ التعديلات',exact:true}).click();
 await expect(page.getByText('تم حفظ إعدادات الخطوط وتطبيقها على المنصة.',{exact:true})).toBeVisible();
 const late=page.waitForResponse(r=>r.url().endsWith('/api/v1/content/platform-font-settings')&&r.request().method()==='GET');
 release();await late;await expect(page.locator('body')).toHaveCSS('font-size','18px');
});

test('original admin font tab links preserve hash priority, refresh, back and forward',async({page})=>{
 await page.setViewportSize({width:1440,height:1000});await auth(page);
 await page.route('**/api/v1/content/platform-font-settings',r=>r.fulfill({json:{}}));
 for(const url of ['/admin-dashboard?tab=platform-fonts','/admin-dashboard?tab=paths#/admin-dashboard?tab=platform-fonts']) {
  await page.goto(url);
  await expect(page.getByRole('heading',{name:'إدارة خطوط المنصة',exact:true})).toBeVisible();
  await page.reload();
  await expect(page.getByRole('heading',{name:'إدارة خطوط المنصة',exact:true})).toBeVisible();
 }
 await page.goto('/admin-dashboard');
 await page.getByRole('link',{name:'إدارة خطوط المنصة',exact:true}).click();
 await expect(page).toHaveURL(/\/admin-dashboard#\/admin-dashboard\?tab=platform-fonts$/);
 await expect(page.getByRole('heading',{name:'إدارة خطوط المنصة',exact:true})).toBeVisible();
 await page.goBack();
 await expect(page.getByRole('heading',{name:'إدارة خطوط المنصة',exact:true})).toHaveCount(0);
 await page.goForward();
 await expect(page.getByRole('heading',{name:'إدارة خطوط المنصة',exact:true})).toBeVisible();
 await page.goto('/admin-dashboard?tab=platform-fonts#/admin-dashboard?tab=paths');
 await expect(page.getByRole('heading',{name:'إدارة خطوط المنصة',exact:true})).toHaveCount(0);
});
