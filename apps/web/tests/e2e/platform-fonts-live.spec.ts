import {expect,test} from '@playwright/test';

test('original font editor persists through real Go identity and PostgreSQL',async({page,context},testInfo)=>{
 test.skip(process.env.FONT_LIVE !== '1','isolated PostgreSQL integration only');
 test.setTimeout(90_000);
 const login=await page.request.post('/api/v1/auth/login',{data:{email:process.env.FONT_TEST_ADMIN_EMAIL,password:'Fonts-test-pass-42!'}});
 expect(login.status()).toBe(200);
 for(const width of [390,820,1440]) {
  await page.setViewportSize({width,height:1000});
  await page.goto('/admin-dashboard/platform-fonts');
  await expect(page.getByRole('heading',{name:'إدارة خطوط المنصة',exact:true})).toBeVisible();
  const navigation=page.locator('section').filter({has:page.getByRole('heading',{name:'القوائم والتنقل',exact:true})});
  await navigation.getByRole('combobox').nth(0).selectOption('system');
  await navigation.getByRole('textbox',{name:'حجم القوائم والتنقل',exact:true}).fill('18px');
  await page.getByRole('button',{name:'العناوين',exact:true}).click();
  await expect(page.getByText('عناوين الصفحة، العناوين الرئيسية، وعناوين الأقسام المهمة.',{exact:true})).toHaveCount(2);
  const saved=page.waitForResponse(r=>r.url().endsWith('/api/v1/content/platform-font-settings')&&r.request().method()==='PATCH');
  await page.getByRole('button',{name:'حفظ التعديلات',exact:true}).click();
  expect((await saved).status()).toBe(200);
  await expect(page.getByText('تم حفظ إعدادات الخطوط وتطبيقها على المنصة.',{exact:true})).toBeVisible();
  await page.reload();
  await expect(navigation.getByRole('textbox',{name:'حجم القوائم والتنقل',exact:true})).toHaveValue('18px');
  await expect(navigation.getByRole('combobox').nth(0)).toHaveValue('system');
  // Reset remains a preview until Save; reload must recover the stored value.
  await page.getByRole('button',{name:'رجوع للافتراضي',exact:true}).click();
  await expect(navigation.getByRole('textbox',{name:'حجم القوائم والتنقل',exact:true})).toHaveValue('');
  await page.reload();
  await expect(navigation.getByRole('textbox',{name:'حجم القوائم والتنقل',exact:true})).toHaveValue('18px');
  await expect.poll(()=>page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
  await page.screenshot({path:`test-results/persisted-font-editor-${width}.png`,fullPage:true});
  // Compare the actual pinned source component, not a manually recreated image.
  // Both use the same real Go document/session and shared shell/CSS constraints;
  // this is component-only parity, not original whole-application certification.
  const original=await context.newPage();
  await original.setViewportSize({width,height:1000});
  await original.goto('/tests/reference/fonts.html');
  await expect(original.getByRole('heading',{name:'إدارة خطوط المنصة',exact:true})).toBeVisible();
  const sourceNavigation=original.locator('section').filter({has:original.getByRole('heading',{name:'القوائم والتنقل',exact:true})});
  await expect(sourceNavigation.getByRole('textbox',{name:'حجم القوائم والتنقل',exact:true})).toHaveValue('18px');
  const panel=(p:typeof page)=>p.getByRole('heading',{name:'إدارة خطوط المنصة',exact:true}).locator('xpath=../../..');
  await page.mouse.move(0,0);await original.mouse.move(0,0);
  // Locator.screenshot scrolls this tall panel under the sticky site header.
  // Capture its document rectangle at scroll0 instead, so all panel pixels are
  // visible and no unrelated shell title is painted over the component.
  const capture=async(p:typeof page,name:string)=>{
   await p.evaluate(()=>window.scrollTo(0,0));
   const clip=await panel(p).boundingBox();expect(clip).not.toBeNull();
   return p.screenshot({path:`test-results/font-${name}-component-${width}.png`,fullPage:true,clip:clip!,animations:'disabled'});
  };
  const expected=await capture(original,'source');
  const actual=await capture(page,'go');
  const metrics=async(p:typeof page)=>p.locator('select').evaluateAll(elements=>elements.map(element=>{
   const style=getComputedStyle(element);const rect=element.getBoundingClientRect();
   return {font:style.font,fontFamily:style.fontFamily,lineHeight:style.lineHeight,x:rect.x,y:rect.y,width:rect.width,height:rect.height};
  }));
  await testInfo.attach(`font-component-metrics-${width}`,{body:JSON.stringify({source:await metrics(original),go:await metrics(page)}),contentType:'application/json'});
  expect(Buffer.compare(actual,expected),`source/Go component pixels differ at ${width}px`).toBe(0);
  await original.close();
  await page.goto('/about');
  await expect(page.locator('header')).toHaveCSS('font-size','18px');
  await page.goBack();
  await expect(navigation.getByRole('textbox',{name:'حجم القوائم والتنقل',exact:true})).toHaveValue('18px');
 }
 // Upload travels through the real API and survives reload.
 await page.getByLabel('رفع ملف خط مخصص للنصوص',{exact:true}).setInputFiles({name:'TestFont.woff2',mimeType:'font/woff2',buffer:Buffer.from('wOF2-font-test')});
 await page.getByRole('button',{name:'حفظ التعديلات',exact:true}).click();
 await expect(page.getByText('تم حفظ إعدادات الخطوط وتطبيقها على المنصة.',{exact:true})).toBeVisible();
 await page.reload();
 await expect(page.getByText(/الملف الحالي: TestFont.woff2/)).toBeVisible();
 const data=await (await page.request.get('/api/v1/content/platform-font-settings')).json();
 expect(data.bodyFont).toBe('custom');
 expect(data.bodyCustomFont.dataUrl).toMatch(/^data:font\/woff2;base64,/);
});
