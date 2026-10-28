import {test,expect} from '@playwright/test';
test('original homepage editor persists brand and hero through Go sessions/PostgreSQL to a guest',async({page,context},testInfo)=>{
 test.skip(process.env.HOMEPAGE_LIVE!=='1','isolated PostgreSQL integration only');test.setTimeout(180000);
 // Catalog endpoints are outside this isolated presentation server. Empty fixtures
 // are explicit; homepage/auth/CSRF/database persistence are never mocked.
 for(const pattern of ['**/api/v1/courses?*','**/api/v1/lessons?*']) await context.route(pattern,r=>r.fulfill({json:{items:[],hasMore:false}}));
 await context.route('**/api/v1/taxonomy/bootstrap?*',r=>r.fulfill({json:{paths:[],subjects:[]}}));
 const login=await page.request.post('/api/v1/auth/login',{data:{email:process.env.HOMEPAGE_TEST_ADMIN_EMAIL,password:'Homepage-test-pass-42!'}});expect(login.status()).toBe(200);
 for(const width of [390,820,1440]){
  await page.setViewportSize({width,height:1000});await page.goto('/admin-dashboard?tab=homepage');
  await expect(page.getByRole('heading',{name:'إدارة الصفحة الرئيسية',exact:true})).toBeVisible();
  await page.getByRole('textbox',{name:'نص الشعار الأول',exact:true}).fill('هوية محفوظة');
  await page.getByRole('textbox',{name:'مقدمة العنوان',exact:true}).fill('تعلم بثقة');
  await page.getByRole('button',{name:'حفظ التعديلات',exact:true}).click();
  await expect(page.getByText('تم حفظ إعدادات الصفحة الرئيسية بنجاح.',{exact:true})).toBeVisible();
  await page.reload();await expect(page.getByRole('textbox',{name:'نص الشعار الأول',exact:true})).toHaveValue('هوية محفوظة');await page.screenshot({path:`test-results/homepage-editor-actual-${width}.png`,fullPage:true,animations:'disabled'});
  for(const section of ['brand','hero']){
   const frames=[];
   for(const variant of ['source','go']){
    const frame=await context.newPage();await frame.setViewportSize({width,height:1000});await frame.goto(`/tests/reference/homepage-section.html?variant=${variant}&section=${section}`);await expect(frame.locator(`#${section}-section`)).toBeVisible();frames.push(frame);
   }
   const capture=async(p:typeof page,name:string)=>{
    await p.mouse.move(0,0);
    await p.evaluate(()=>document.fonts.ready);
    const locator=p.locator(`#${section}-section`);
    // Decode every original image and place the complete section inside the
    // viewport before capture. No masks, altered image CSS or pixel tolerance.
    await locator.locator('img').evaluateAll(async elements=>{await Promise.all(elements.map(element=>(element as HTMLImageElement).decode()));});
    const initial=await locator.boundingBox();expect(initial).not.toBeNull();
    await p.setViewportSize({width,height:Math.ceil(initial!.y+initial!.height+20)});
    await p.evaluate(()=>scrollTo(0,0));
    await p.evaluate(()=>new Promise<void>(resolve=>requestAnimationFrame(()=>requestAnimationFrame(()=>resolve()))));
    const clip=await locator.boundingBox();expect(clip).not.toBeNull();
    await testInfo.attach(`metrics-${section}-${name}-${width}`,{body:JSON.stringify({clip,viewport:p.viewportSize()}),contentType:'application/json'});
    return p.screenshot({path:`test-results/homepage-${section}-${name}-${width}.png`,clip:clip!,animations:'disabled'});
   };
   const source=await capture(frames[0],'source');const go=await capture(frames[1],'go');await testInfo.attach(`homepage-${section}-source-${width}`,{body:source,contentType:'image/png'});await testInfo.attach(`homepage-${section}-go-${width}`,{body:go,contentType:'image/png'});expect(Buffer.compare(go,source),`${section} component pixels at ${width}`).toBe(0);
   for(const frame of frames)await frame.close();
  }
  await page.goto('/');await expect(page.locator('header').getByText('هوية محفوظة',{exact:true})).toBeVisible();await expect(page.getByRole('heading',{level:1})).toContainText('تعلم بثقة');await page.screenshot({path:`test-results/homepage-guest-actual-${width}.png`,animations:'disabled'});
  await page.goBack();await expect(page.getByRole('heading',{name:'إدارة الصفحة الرئيسية',exact:true})).toBeVisible();await page.goForward();await expect(page.getByRole('heading',{level:1})).toContainText('تعلم بثقة');
  await expect.poll(()=>page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
 }
 await context.clearCookies();await page.reload();await expect(page.locator('header').getByText('هوية محفوظة',{exact:true})).toBeVisible();await expect(page.getByRole('heading',{level:1})).toContainText('تعلم بثقة');
});
