import {test,expect,type BrowserContext} from '@playwright/test';
// Match the existing full-header comparison's deterministic text rasterizer.
const localChromium=process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH?.trim();
test.use({launchOptions:{args:['--disable-gpu'],...(localChromium?{executablePath:localChromium}:{})}});

const logo='data:image/svg+xml;base64,'+Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" width="64" height="64"><rect width="64" height="64" fill="#2563eb"/></svg>').toString('base64');
async function prepare(context:BrowserContext){
  for(const pattern of ['**/api/v1/courses?*','**/api/v1/lessons?*'])await context.route(pattern,r=>r.fulfill({json:{items:[],hasMore:false}}));
  await context.route('**/api/v1/taxonomy/bootstrap?*',r=>r.fulfill({json:{paths:[],subjects:[]}}));
}

test.describe('persisted original header brand',()=>{
  test.skip(process.env.HOMEPAGE_LIVE!=='1','isolated PostgreSQL integration only');

test.beforeAll(async({browser,baseURL})=>{
  test.setTimeout(120000);
  const context=await browser.newContext({baseURL});
  try{
  await prepare(context);
  const page=await context.newPage();
  const login=await page.request.post('/api/v1/auth/login',{data:{email:process.env.HOMEPAGE_TEST_ADMIN_EMAIL,password:'Homepage-test-pass-42!'}});
  expect(login.status()).toBe(200);
  await page.goto('/admin-dashboard?tab=homepage');
  await page.getByRole('textbox',{name:'رابط الشعار أو الصورة المرفوعة',exact:true}).fill(logo);
  await page.getByRole('textbox',{name:'وصف الشعار',exact:true}).fill('شعار محفوظ');
  await page.getByRole('textbox',{name:'نص الشعار الأول',exact:true}).fill('هوية محفوظة');
  await page.getByRole('textbox',{name:'نص الشعار المميز',exact:true}).fill('المئة');
  await page.getByRole('button',{name:'حفظ التعديلات',exact:true}).click();
  await expect(page.getByText('تم حفظ إعدادات الصفحة الرئيسية بنجاح.',{exact:true})).toBeVisible();
  }finally{await context.close();}
});

for(const role of ['admin','guest'])for(const width of [390,820,1440]){
  test(`saved logo retains original brand image and name for ${role} at ${width}`,async({page,context},testInfo)=>{
      test.setTimeout(120000);
      await prepare(context);
      if(role==='admin'){
        const login=await page.request.post('/api/v1/auth/login',{data:{email:process.env.HOMEPAGE_TEST_ADMIN_EMAIL,password:'Homepage-test-pass-42!'}});
        expect(login.status()).toBe(200);
      }
      await page.setViewportSize({width,height:1000});await page.goto('/');await page.reload();
      const brand=page.locator('header a[href="/"]').filter({has:page.getByRole('img',{name:'شعار محفوظ',exact:true})});
      await expect(brand.getByText('هوية محفوظة',{exact:true})).toBeVisible();
      await expect(brand.getByRole('img',{name:'شعار محفوظ',exact:true})).toHaveAttribute('src',logo);
      await expect(brand.getByText('المئة',{exact:true})).toBeVisible();
      await expect(brand.getByRole('img')).toHaveCSS('width',width<640?'36px':'44px');
      const heroHeight=await page.locator('[data-testid="public-landing"] > section').first().evaluate(element=>element.getBoundingClientRect().height);
      const source=await context.newPage();await source.setViewportSize({width,height:1000});await source.goto('/tests/reference/header-brand.html?role='+role+'&heroHeight='+encodeURIComponent(String(heroHeight)));
      const original=source.locator('header a[href="/"]').filter({has:source.getByRole('img',{name:'شعار محفوظ',exact:true})});await expect(original.getByRole('img')).toHaveAttribute('src',logo);
      await expect(source.getByTestId('header-brand-reference-body')).toHaveAttribute('data-ready','true');
      // Match loaded navigation, not static approximations of sibling controls.
      for(const view of [page,source])await expect(view.getByLabel('جارٍ تجهيز قائمة المنصة')).toHaveCount(0);
      const capture=async(p:typeof page,link:typeof brand,name:string)=>{
        await p.mouse.move(0,999);await p.evaluate(()=>document.fonts.ready);
        // Both references have a scrollable page, like the real landing page.
        // Exercise sticky positioning before capture so both text runs use the
        // same compositing conditions; no CSS changes, masks or pixel tolerance.
        await p.evaluate(()=>scrollTo(0,100));
        await p.evaluate(()=>new Promise<void>(r=>requestAnimationFrame(()=>r())));
        await p.evaluate(()=>scrollTo(0,0));
        await p.evaluate(()=>new Promise<void>(r=>requestAnimationFrame(()=>requestAnimationFrame(()=>r()))));
        await expect.poll(()=>link.locator('img').evaluate((image:HTMLImageElement)=>image.complete&&image.naturalWidth>0)).toBe(true);
        const metrics=await link.evaluate(element=>[element,...element.querySelectorAll('span,img')].map(e=>{const s=getComputedStyle(e);const r=e.getBoundingClientRect();return {text:e.textContent,box:{x:r.x,y:r.y,width:r.width,height:r.height},font:s.font,fontFamily:s.fontFamily,letterSpacing:s.letterSpacing,color:s.color};}));
        await testInfo.attach(`header-brand-metrics-${role}-${width}-${name}`,{body:JSON.stringify(metrics),contentType:'application/json'});
        const bytes=await link.screenshot({path:`test-results/header-brand-${role}-${width}-${name}.png`,animations:'disabled'});
        await testInfo.attach(`header-brand-${role}-${width}-${name}`,{body:bytes,contentType:'image/png'});return bytes;
      };
      const expected=await capture(source,original,'source');const actual=await capture(page,brand,'go');
      expect(Buffer.compare(actual,expected),`original brand pixels for ${role} at ${width}`).toBe(0);
      await source.close();await brand.click();await expect(page).toHaveURL(/\/$/);
      await expect.poll(()=>page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
  });
}
});
