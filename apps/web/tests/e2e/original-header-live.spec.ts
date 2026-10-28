import {test,expect,type Page,type TestInfo} from '@playwright/test';

const live=process.env.HEADER_LIVE==='1';
const env=(name:string)=>{const value=process.env[name];if(!value)throw Error(`${name} required for native header fixture`);return value};
const password=process.env.HEADER_PASSWORD||'Header-test-pass-42!';
async function signIn(page:Page,role:'admin'|'student'){
 const response=await page.request.post('/api/v1/auth/login',{data:{email:env(role==='admin'?'HEADER_ADMIN_EMAIL':'HEADER_STUDENT_EMAIL'),password}});
 expect(response.status()).toBe(200);return (await response.json()).csrfToken as string;
}
async function ready(page:Page,url:string){
 const font=page.waitForResponse(r=>r.url().includes('/content/platform-font-settings')&&r.request().method()==='GET');
 await page.goto(url);await font;
 if(url.startsWith('/tests/reference/'))await expect(page.getByTestId('header-reference-body')).toHaveAttribute('data-ready','true');
 await expect(page.locator('header').first().getByRole('button',{name:'فتح البحث',exact:true})).toBeVisible();
 await expect(page.getByLabel('جارٍ تجهيز قائمة المنصة')).toHaveCount(0);
 await expect(page.locator('header').first().locator('nav').getByRole('link',{name:'قدرات',exact:true})).toHaveCount(1);
 await page.evaluate(()=>document.fonts.ready);
 await expect.poll(()=>page.locator('header').first().locator('img').evaluateAll(images=>images.every(image=>(image as HTMLImageElement).complete&&(image as HTMLImageElement).naturalWidth>0))).toBe(true);
}
async function stable(page:Page){
 await page.mouse.move(0,999);await page.evaluate(()=>document.fonts.ready);
 await page.evaluate(()=>scrollTo(0,100));await page.evaluate(()=>new Promise<void>(r=>requestAnimationFrame(()=>r())));
 await page.evaluate(()=>scrollTo(0,0));await page.evaluate(()=>new Promise<void>(r=>requestAnimationFrame(()=>requestAnimationFrame(()=>r()))));
}
async function attachPage(page:Page,info:TestInfo,name:string){
 const bytes=await page.screenshot({path:info.outputPath(`${name}.png`),animations:'disabled'});
 await info.attach(name,{body:bytes,contentType:'image/png'});return bytes;
}
async function openPath(page:Page,level=false){
 const nav=page.locator('header').first().locator('nav');
 await nav.getByRole('link',{name:'قدرات',exact:true}).hover();
 const stage=nav.getByRole('button',{name:/المرحلة المتوسطة/});await expect(stage).toBeVisible();
 if(level){await stage.hover();await expect(nav.getByRole('link',{name:'رياضيات',exact:true})).toBeVisible()}
}
async function visualMetrics(page:Page){return page.evaluate(()=>{
 const close=document.querySelector('button[aria-label="إغلاق القائمة"]');const box=close?.getBoundingClientRect();
 return {viewport:innerWidth,scrollWidth:document.documentElement.scrollWidth,mobileCloseReachable:box?close===document.elementFromPoint(box.x+box.width/2,box.y+box.height/2)||close?.contains(document.elementFromPoint(box.x+box.width/2,box.y+box.height/2)):null};
})}

test.describe('original full Header on native Go data',()=>{
 test.skip(!live,'HEADER_LIVE=1: isolated real Go/PostgreSQL fixture only');
 test.describe.configure({mode:'serial'});

 test('source and Go complete component pixels for guest admin student at3908201440',async({page,context},info)=>{
  test.setTimeout(240000);
  for(const role of ['guest','admin','student'] as const){
   await context.clearCookies();if(role!=='guest')await signIn(page,role);
   for(const width of [390,820,1440]){
    const source=await context.newPage();await page.setViewportSize({width,height:1000});await source.setViewportSize({width,height:1000});
    await ready(source,'/tests/reference/header.html?variant=source');await ready(page,'/tests/reference/header.html?variant=go');
    // Fixture has no realtime broker: native SSE503 is an explicit evidence gap,
    // not a connected-state certificate. Both renderers use the same real transport.
    if(role!=='guest')for(const surface of [source,page]){
     const bell=surface.getByRole('button',{name:'الإشعارات',exact:true});
     await expect(bell).toBeVisible();await expect(bell.locator('span.bg-emerald-400')).toHaveCount(0);
     if(role==='admin')await expect(bell.locator('span.bg-red-500')).toHaveText('1');
    }
    const compare=async(state:string)=>{
     // Identical scrollable wrappers and sticky composition; no masks/CSS fixes/tolerance.
     await stable(source);await stable(page);
     if(state!=='closed'&&width>=768){await openPath(source,state==='level');await openPath(page,state==='level')}
     const expected=await attachPage(source,info,`header-${role}-${width}-${state}-source`);
     const actual=await attachPage(page,info,`header-${role}-${width}-${state}-go`);
     const sourceMetrics=await visualMetrics(source);const targetMetrics=await visualMetrics(page);
     await info.attach(`header-${role}-${width}-${state}-metrics`,{body:JSON.stringify({source:sourceMetrics,go:targetMetrics,scope:'Header component + shared real providers and StudentPathBar; not whole legacy App'}),contentType:'application/json'});
     expect.soft(Buffer.compare(actual,expected),`${role}/${width}/${state}: exact original full visible Header pixels`).toBe(0);
     expect.soft(targetMetrics,`${role}/${width}/${state}: original overflow and close-hit-test behavior`).toEqual(sourceMetrics);
    };
    await compare('closed');
    if(width>=768){await compare('path');await compare('level')}
    else{
     await source.getByRole('button',{name:'فتح القائمة',exact:true}).click();await page.getByRole('button',{name:'فتح القائمة',exact:true}).click();
     // Include the entire visible mobile overlay, even if it exceeds the initial viewport.
     const panelHeight=async(p:Page)=>p.locator('header > div.fixed.inset-0').evaluate(e=>e.scrollHeight);
     const height=Math.max(1000,await panelHeight(source),await panelHeight(page));
     await source.setViewportSize({width,height});await page.setViewportSize({width,height});await compare('mobile');
    }
    await source.close();
   }
  }
 });

 test('native persisted settings taxonomy enrollment navigation notification theme and search journeys',async({page,context},info)=>{
  test.setTimeout(180000);await context.clearCookies();await page.setViewportSize({width:1440,height:1000});
  const adminCSRF=await signIn(page,'admin');
  await page.goto('/admin-dashboard?tab=homepage');
  await expect(page.getByRole('heading',{name:'الشريط العلوي',exact:true})).toBeVisible();
  const navigation=page.locator('section').filter({has:page.getByRole('heading',{name:'الشريط العلوي',exact:true})});
  await navigation.getByRole('textbox',{name:'اسم قائمة العناصر الأخرى',exact:true}).fill('روابط الهيدر الحية');
  const homeRow=navigation.locator('div.rounded-2xl').filter({has:page.getByText('home',{exact:true})});
  await homeRow.getByRole('textbox',{name:'الاسم الظاهر',exact:true}).fill('الرئيسية الحية');
  await page.getByRole('button',{name:'حفظ التعديلات',exact:true}).click();
  await expect(page.getByText('تم حفظ إعدادات الصفحة الرئيسية بنجاح.',{exact:true})).toBeVisible();await page.reload();
  await expect(page.getByRole('textbox',{name:'اسم قائمة العناصر الأخرى',exact:true})).toHaveValue('روابط الهيدر الحية');
  const stored=await page.request.get('/api/v1/content/homepage-settings');expect(stored.status()).toBe(200);
  expect((await stored.json()).navigation.moreLabel).toBe('روابط الهيدر الحية');
  const guest=await context.browser()!.newContext({baseURL:new URL(page.url()).origin});const guestPage=await guest.newPage();await guestPage.setViewportSize({width:1440,height:1000});
  await ready(guestPage,'/');await expect(guestPage.locator('header').first().getByRole('link',{name:'الرئيسية الحية',exact:true})).toBeVisible();
  await page.goto('/admin-dashboard/taxonomy');await page.getByRole('button',{name:/تحصيلي.*tahsili/i}).click();
  const display=page.locator('section').filter({has:page.getByRole('heading',{name:'إعدادات العرض في التنقل',exact:true})});
  await display.getByRole('checkbox',{name:'إظهار المسار في القائمة العلوية',exact:true}).uncheck();await display.getByRole('button',{name:'حفظ عرض المسار',exact:true}).click();
  await expect(page.getByText('تم حفظ إعدادات عرض المسار.',{exact:true})).toBeVisible();
  await ready(guestPage,'/');await expect(guestPage.locator('header nav').getByRole('link',{name:'تحصيلي',exact:true})).toHaveCount(0);
  await page.reload();await page.getByRole('button',{name:/تحصيلي.*tahsili/i}).click();
  await display.getByRole('checkbox',{name:'إظهار المسار في القائمة العلوية',exact:true}).check();await display.getByRole('button',{name:'حفظ عرض المسار',exact:true}).click();
  await expect(page.getByText('تم حفظ إعدادات عرض المسار.',{exact:true})).toBeVisible();await ready(guestPage,'/');await expect(guestPage.locator('header nav').getByRole('link',{name:'تحصيلي',exact:true})).toBeVisible();
  await guest.close();
  await ready(page,'/');await page.getByRole('button',{name:'الإشعارات',exact:true}).click();await expect(page.getByText('إشعار الهيدر الحي',{exact:true})).toBeVisible();
  const readRequest=page.waitForRequest(r=>r.method()==='PATCH'&&r.url().includes('/notifications/')&&r.url().endsWith('/read'));
  await page.getByText('إشعار الهيدر الحي',{exact:true}).click();expect((await readRequest).headers()['x-csrf-token']).toBeTruthy();
  await expect.poll(async()=>{const r=await page.request.get('/api/v1/notifications/me/unread-count');return (await r.json()).unreadCount}).toBe(0);
  const denied=await page.request.patch(`/api/v1/notifications/${env('HEADER_NOTIFICATION_ID')}/read`);expect(denied.status()).toBe(403);
  await page.getByRole('button',{name:'الإشعارات',exact:true}).click();
  await page.getByRole('button',{name:'تفعيل الوضع الداكن',exact:true}).click();await page.reload();await expect(page.locator('html')).toHaveClass(/dark/);
  expect(await page.evaluate(()=>localStorage.getItem('almeaa_theme'))).toBe('dark');await page.getByRole('button',{name:'تفعيل الوضع الفاتح',exact:true}).click();
  await context.clearCookies();await signIn(page,'student');await ready(page,'/');
  await page.getByRole('button',{name:'اختيار المسار',exact:true}).click();const dialog=page.getByRole('dialog',{name:'اختر مسارك التعليمي',exact:true});
  await dialog.getByRole('combobox',{name:'المسار التعليمي',exact:true}).selectOption(env('HEADER_PATH_ID'));
  await dialog.getByRole('combobox').nth(1).selectOption(env('HEADER_LEVEL_ID'));
  const saved=page.waitForRequest(r=>r.method()==='PATCH'&&r.url().includes('/learning/navigation-preferences'));
  await dialog.getByRole('button',{name:'تأكيد التسجيل',exact:true}).click();expect((await saved).headers()['x-csrf-token']).toBeTruthy();await expect(dialog).toHaveCount(0);await page.reload();
  await expect(page.getByRole('combobox',{name:'مساري الحالي',exact:true})).toContainText('قدرات');
  const prefs=await page.request.get('/api/v1/learning/navigation-preferences');const current=(await prefs.json()).user;
  expect(current.enrolledPaths).toContain(env('HEADER_PATH_ID'));expect(current.pathStageSelections).toContainEqual({pathId:env('HEADER_PATH_ID'),levelId:env('HEADER_LEVEL_ID')});
  await openPath(page,true);await expect(page.locator('header nav').getByRole('button',{name:/الثانوية/})).toHaveCount(0);const math=page.locator('header nav').getByRole('link',{name:'رياضيات',exact:true});
  const mathURL=new URL((await math.getAttribute('href'))!,'http://fixture');expect(mathURL.pathname).toBe('/category/'+env('HEADER_PATH_ID'));expect(mathURL.searchParams.get('subject')).toBe(env('HEADER_SUBJECT_ID'));expect(mathURL.searchParams.get('level')).toBe(env('HEADER_LEVEL_ID'));
  await math.click();await expect(page).toHaveURL(new RegExp('/category/'+env('HEADER_PATH_ID')+'\\?'));
  expect(new URL(page.url()).searchParams.get('subject')).toBe(env('HEADER_SUBJECT_ID'));
  await page.reload();expect(new URL(page.url()).searchParams.get('subject')).toBe(env('HEADER_SUBJECT_ID'));await page.goBack();await page.goForward();expect(new URL(page.url()).searchParams.get('subject')).toBe(env('HEADER_SUBJECT_ID'));
  await attachPage(page,info,'native-student-category-after-reload');
  await page.keyboard.press('Control+k');const query=page.getByRole('textbox',{name:'Search query',exact:true});await expect(query).toBeVisible();
  const search=page.locator('div.fixed.inset-0').filter({has:query});
  await query.fill('بحث الهيدر');await expect(search.getByRole('link',{name:/دورة بحث الهيدر/})).toBeVisible();await expect(search.getByRole('link',{name:/مقال بحث الهيدر/})).toBeVisible();
  await page.getByRole('combobox',{name:'Search type',exact:true}).selectOption('course');await expect(search.getByRole('link',{name:/مقال بحث الهيدر/})).toHaveCount(0);
  const course=search.getByRole('link',{name:/دورة بحث الهيدر/});await expect(course).toHaveAttribute('href','/course/'+env('HEADER_COURSE_ID'));await course.click();await expect(page).toHaveURL(new RegExp('/course/'+env('HEADER_COURSE_ID')+'$'));
  await page.keyboard.press('Control+k');await expect(query).toBeVisible();await page.keyboard.press('Escape');await expect(query).toHaveCount(0);
  await page.getByRole('button',{name:'فتح البحث',exact:true}).click();await expect(query).toBeVisible();await page.getByRole('button',{name:'Close search',exact:true}).click();
  await attachPage(page,info,'native-student-course-from-original-search');
  // Actor denial and persisted public read use the real services and cookies.
  const deniedSettings=await page.request.patch('/api/v1/content/homepage-settings',{headers:{'X-CSRF-Token':adminCSRF},data:{navigation:{moreLabel:'must-not-save'}}});expect([401,403]).toContain(deniedSettings.status());
 });
});
