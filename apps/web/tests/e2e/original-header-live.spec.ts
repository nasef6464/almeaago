import {test,expect,type Page,type TestInfo} from '@playwright/test';
import {PNG} from 'pngjs';

const live=process.env.HEADER_LIVE==='1';
// Keep exact RGBA parity strict while avoiding GPU compositor rounding at rounded edges.
test.use({ launchOptions: { args: ['--disable-gpu'] } });
const env=(name:string)=>{const value=process.env[name];if(!value)throw Error(`${name} required for native header fixture`);return value};
const password=process.env.HEADER_PASSWORD||'Header-test-pass-42!';
const visibleHeader=(page:Page)=>page.locator('[data-header-variant][data-visible="true"] header').first();
async function headerFor(page:Page){
 const reference=visibleHeader(page);
 return await reference.count()?reference:page.locator('header').first();
}
async function signIn(page:Page,role:'admin'|'student'){
 const response=await page.request.post('/api/v1/auth/login',{data:{email:env(role==='admin'?'HEADER_ADMIN_EMAIL':'HEADER_STUDENT_EMAIL'),password}});
 expect(response.status()).toBe(200);return (await response.json()).csrfToken as string;
}
async function ready(page:Page,url:string){
 const font=page.waitForResponse(r=>r.url().includes('/content/platform-font-settings')&&r.request().method()==='GET');
 await page.goto(url);await font;
 if(url.startsWith('/tests/reference/')){
  await expect(page.getByTestId('header-reference-body')).toHaveAttribute('data-ready','true');
  await expect(page.getByTestId('header-reference-body')).toHaveAttribute('data-variant',url.includes('variant=go')?'go':'source');
  await page.waitForFunction(()=>typeof (window as any).__setHeaderVariant==='function');
 }
 const header=await headerFor(page);
 await expect(header.getByRole('button',{name:'فتح البحث',exact:true})).toBeVisible();
 await expect(page.getByLabel('جارٍ تجهيز قائمة المنصة')).toHaveCount(0);
 const width=page.viewportSize()?.width??0;
 if(width>=768)await expect(header.locator('nav').getByRole('link',{name:'قدرات',exact:true})).toHaveCount(1);
 else{await expect(header.getByRole('button',{name:'فتح القائمة',exact:true})).toBeVisible();await expect(header.locator('nav')).toBeHidden()}
 await expect(header.locator('a[href="/cart"] span')).toHaveText('1');
 await expect.poll(()=>page.locator('#platform-font-google-link').getAttribute('href')).toContain('Tajawal');
 await page.evaluate(async()=>{const header=document.querySelector('[data-header-variant][data-visible="true"] header')||document.querySelector('header');const family=(header?getComputedStyle(header).fontFamily:'Tajawal').split(',')[0].replace(/["']/g,'').trim();const specs=[`400 16px "${family}"`,`500 14px "${family}"`,`700 14px "${family}"`,`700 12px "${family}"`,`800 12px "${family}"`,`900 12px "${family}"`];await Promise.all(specs.map(font=>document.fonts.load(font)));await document.fonts.ready;const missing=specs.filter(font=>!document.fonts.check(font));if(missing.length)throw new Error(`Header font weights did not load: ${missing.join(', ')}`);});
 await expect.poll(()=>header.locator('img').evaluateAll(images=>images.every(image=>(image as HTMLImageElement).complete&&(image as HTMLImageElement).naturalWidth>0))).toBe(true);
}
async function stable(page:Page){
 await page.mouse.move(0,999);await page.evaluate(()=>document.fonts.ready);
 await page.evaluate(()=>scrollTo(0,100));await page.evaluate(()=>new Promise<void>(r=>requestAnimationFrame(()=>r())));
 await page.evaluate(()=>scrollTo(0,0));await page.evaluate(()=>new Promise<void>(r=>requestAnimationFrame(()=>requestAnimationFrame(()=>r()))));
}
async function selectVariant(page:Page,variant:'source'|'go'){
 await page.evaluate((value)=>(window as any).__setHeaderVariant?.(value),variant);
 await expect(page.getByTestId('header-reference-body')).toHaveAttribute('data-variant',variant);
 await expect(page.locator('[data-header-variant="'+variant+'"][data-visible="true"] header')).toBeVisible();
 await page.evaluate(async()=>{const header=document.querySelector('[data-header-variant][data-visible="true"] header');await document.fonts.ready;await Promise.all(Array.from(header?.querySelectorAll('img')||[]).map(image=>(image as HTMLImageElement).decode().catch(()=>undefined)));});
 await expect(visibleHeader(page).getByRole('button',{name:'تفعيل الوضع الداكن',exact:true})).toBeVisible();
 await expect(page.locator('html')).not.toHaveClass(/dark/);
 await stable(page);
}
async function attachPage(page:Page,info:TestInfo,name:string){
 const bytes=await page.screenshot({path:info.outputPath(`${name}.png`),animations:'disabled'});
 await info.attach(name,{body:bytes,contentType:'image/png'});return bytes;
}
async function openPath(page:Page,level=false){
 const nav=visibleHeader(page).locator('nav');
 await nav.getByRole('link',{name:'قدرات',exact:true}).hover();
 await expect(nav.getByRole('link',{name:'مسار فرعي',exact:true})).toHaveAttribute('href','/category/'+env('HEADER_CHILD_PATH_ID'));
 const mock=nav.locator('a[href="/category/'+env('HEADER_PATH_ID')+'?tab=mock-exams"]');await expect(mock).toBeVisible();await expect(mock).toContainText('اختبارات محاكية قدرات');
 const packages=nav.locator('a[href="/category/'+env('HEADER_PATH_ID')+'?tab=packages"]');await expect(packages).toBeVisible();await expect(packages).toContainText('عروض وباقات قدرات');
 const stage=nav.getByRole('button',{name:/المرحلة المتوسطة/});await expect(stage).toBeVisible();
 if(level){await stage.hover();await expect(nav.getByRole('link',{name:'رياضيات',exact:true})).toBeVisible()}
}
async function openMockExams(page:Page){
 const nav=visibleHeader(page).locator('nav');
 await nav.getByRole('link',{name:'اختبارات محاكية',exact:true}).hover();
 const path=nav.locator('a[href="/category/'+env('HEADER_PATH_ID')+'?tab=mock-exams"]');
 await expect(path).toBeVisible();await expect(path).toContainText('قدرات');
}
async function openMore(page:Page){
 const nav=visibleHeader(page).locator('nav');
 await nav.getByRole('link',{name:'أخرى',exact:true}).hover();
 await expect(nav.getByRole('link',{name:'العضويات',exact:true})).toHaveAttribute('href','/pricing');
 await expect(nav.getByRole('link',{name:'المدونة',exact:true})).toHaveAttribute('href','/blog');
}
async function openAccount(page:Page,role:'admin'|'student'){
 const header=visibleHeader(page);
 await header.getByRole('button',{name:'قائمة المستخدم',exact:true}).click();
 const destination=role==='admin'?'/admin-dashboard':'/dashboard';
 await expect(header.locator('a[href="'+destination+'"]:visible').first()).toBeVisible();
}
function exactPixelDifference(actual:Buffer,expected:Buffer){
 const left=PNG.sync.read(actual);const right=PNG.sync.read(expected);
 if(left.width!==right.width||left.height!==right.height)return {width:left.width,height:left.height,expectedWidth:right.width,expectedHeight:right.height,diffPixels:-1,bounds:null,samples:[] as Array<{x:number;y:number;source:number[];go:number[]}>};
 let diffPixels=0,minX=left.width,minY=left.height,maxX=-1,maxY=-1;
 const samples:Array<{x:number;y:number;source:number[];go:number[]}>=[];
 for(let y=0;y<left.height;y++)for(let x=0;x<left.width;x++){
  const offset=(y*left.width+x)*4;
  if(left.data[offset]!==right.data[offset]||left.data[offset+1]!==right.data[offset+1]||left.data[offset+2]!==right.data[offset+2]||left.data[offset+3]!==right.data[offset+3]){
   diffPixels++;minX=Math.min(minX,x);minY=Math.min(minY,y);maxX=Math.max(maxX,x);maxY=Math.max(maxY,y);
   if(samples.length<12)samples.push({x,y,source:Array.from(right.data.subarray(offset,offset+4)),go:Array.from(left.data.subarray(offset,offset+4))});
  }
 }
 return {width:left.width,height:left.height,diffPixels,bounds:diffPixels?{minX,minY,maxX,maxY}:null,samples};
}
async function visualMetrics(page:Page,points:Array<{x:number;y:number}>=[]){return page.evaluate((samplePoints)=>{
 const box=(element:Element|null)=>{if(!element)return null;const r=element.getBoundingClientRect();const s=getComputedStyle(element);return {tag:element.tagName,className:typeof (element as HTMLElement).className==='string'?(element as HTMLElement).className:'',aria:element.getAttribute('aria-label'),text:(element.textContent||'').replace(/\\s+/g,' ').trim().slice(0,80),x:r.x,y:r.y,width:r.width,height:r.height,display:s.display,position:s.position,fontFamily:s.fontFamily,fontSize:s.fontSize,fontWeight:s.fontWeight,lineHeight:s.lineHeight,color:s.color,backgroundColor:s.backgroundColor,borderColor:s.borderColor,borderRadius:s.borderRadius,boxShadow:s.boxShadow,opacity:s.opacity,transform:s.transform,textShadow:s.textShadow,padding:s.padding,gap:s.gap}};
 const variant=document.querySelector('[data-testid="header-reference-body"]')?.getAttribute('data-variant')||'source';
 const header=document.querySelector('[data-header-variant="'+variant+'"][data-visible="true"] header')||document.querySelector('header');
 const close=header?.querySelector('button[aria-label="إغلاق القائمة"]')??null;const r=close?.getBoundingClientRect();
 const visible=(element:Element)=>{const rect=element.getBoundingClientRect();return rect.width>0&&rect.height>0};
 const links=Array.from(header?.querySelectorAll('a,button')||[]).filter(visible).map(element=>({tag:element.tagName,text:(element.textContent||'').replace(/\\s+/g,' ').trim(),aria:element.getAttribute('aria-label'),href:element.getAttribute('href'),...box(element)}));
 const svgs=Array.from(header?.querySelectorAll('svg')||[]).filter(visible).map((element,index)=>{const html=element.outerHTML;const hash=Array.from(html).reduce((value,char)=>((value<<5)-value+char.charCodeAt(0))|0,0).toString(16);return {index,hash,className:element.getAttribute('class'),...box(element)}});
 const family=(header?getComputedStyle(header).fontFamily:'Tajawal').split(',')[0].replace(/["']/g,'').trim();
 const fonts=['400 16px','500 14px','700 14px','700 12px','800 12px','900 12px'].map(spec=>({font:spec+' '+family,available:document.fonts.check(spec+' '+family)}));
 const hitTargets=samplePoints.slice(0,12).map(point=>{let element=document.elementFromPoint(point.x,point.y);const chain=[];for(let depth=0;element&&depth<5;depth++,element=element.parentElement)chain.push(box(element));return {point,chain}});
 const bell=header?.querySelector('button[aria-label="الإشعارات"]')??null;
 const ancestors=(element:Element|null)=>{const chain=[];for(let depth=0;element&&depth<5;depth++,element=element.parentElement)chain.push(box(element));return chain};
 return {viewport:innerWidth,scrollWidth:document.documentElement.scrollWidth,header:box(header),links,svgs,fonts,hitTargets,notification:{button:box(bell),badge:box(bell?.querySelector('span.bg-red-500')??null),ancestors:ancestors(bell)},mobileCloseReachable:r?close===document.elementFromPoint(r.x+r.width/2,r.y+r.height/2)||close?.contains(document.elementFromPoint(r.x+r.width/2,r.y+r.height/2)):null};
},points)}

test.describe('original full Header on native Go data',()=>{
 test.skip(!live,'HEADER_LIVE=1: isolated real Go/PostgreSQL fixture only');
 test.describe.configure({mode:'serial'});

 test('source and Go complete component pixels for guest admin student at3908201440',async({page,context},info)=>{
  test.setTimeout(240000);
  await context.addInitScript(()=>{localStorage.setItem('almeaa-header-cart-v1',JSON.stringify({items:[{id:'header-cart-fixture',type:'course',title:'دورة اختبار الهيدر',price:150,currency:'SAR'}]}));localStorage.setItem('almeaa_theme','light');Object.defineProperty(window,'EventSource',{value:undefined,configurable:true});});
  for(const role of ['guest','admin','student'] as const){
   await context.clearCookies();if(role!=='guest')await signIn(page,role);
   for(const width of [390,820,1440]){
    await page.setViewportSize({width,height:1000});
    await ready(page,'/tests/reference/header.html?variant=source');
    const prepare=async(state:string,closeAfterMeasure=false)=>{
     if(role!=='guest'){
      const bell=page.getByRole('button',{name:'الإشعارات',exact:true});
      await expect(bell).toBeVisible();
      await expect(bell.locator('span.bg-emerald-400')).toHaveCount(0);
      if(role==='admin')await expect(bell.locator('span.bg-red-500')).toHaveText('1');
     }else await expect(page.getByRole('button',{name:'الإشعارات',exact:true})).toHaveCount(0);
     if(state==='path'||state==='level')await openPath(page,state==='level');
     if(state==='mock-exams')await openMockExams(page);
     if(state==='more')await openMore(page);
     if(state==='account'&&role!=='guest')await openAccount(page,role);
     if(state==='mobile'){
      await page.getByRole('button',{name:'فتح القائمة',exact:true}).click();
      const header=visibleHeader(page);
      await expect(header.locator('[data-mobile-nav="home"]')).toBeVisible();
      await expect(header.locator('[data-mobile-nav="'+env('HEADER_PATH_ID')+'"]')).toBeVisible();
      return header.locator('div.fixed.inset-0').evaluate(e=>e.scrollHeight);
     }
     return 1000;
    };
    const compare=async(state:string)=>{
     let mobileHeight=1000;
     if(state==='mobile'){
      await selectVariant(page,'source');const sourceHeight=await prepare(state);
      await selectVariant(page,'go');const goHeight=await prepare(state);
      mobileHeight=Math.max(1000,sourceHeight,goHeight);
     }
     const capture=async(variant:'source'|'go',label:string)=>{
      await selectVariant(page,variant);
      if(state==='mobile'){
       await page.setViewportSize({width,height:mobileHeight});
       await prepare(state);
      }else await prepare(state);
      const bytes=await attachPage(page,info,`header-${role}-${width}-${state}-${label}`);
      const metrics=await visualMetrics(page);
      return {bytes,metrics};
     };
     const source=await capture('source','source');
     const target=await capture('go','go');
     const pixelDiff=exactPixelDifference(target.bytes,source.bytes);
     if(pixelDiff.diffPixels!==0)console.log('[HEADER_PIXEL_DIFF] '+JSON.stringify({role,width,state,pixelDiff,source:source.metrics,go:target.metrics}));
     await info.attach(`header-${role}-${width}-${state}-metrics`,{body:JSON.stringify({source:source.metrics,go:target.metrics,scope:'Header component + shared real providers and StudentPathBar; both variants switched in the same document; not whole legacy App'}),contentType:'application/json'});
     expect.soft(pixelDiff.diffPixels,`${role}/${width}/${state}: exact original full visible Header pixels`).toBe(0);
     expect.soft(target.metrics,`${role}/${width}/${state}: original overflow and close-hit-test behavior`).toEqual(source.metrics);
    };
    await compare('closed');
    if(width>=768){
     await compare('path');await compare('level');await compare('mock-exams');await compare('more');
     if(role!=='guest'&&width===1440)await compare('account');
    }else await compare('mobile');
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
