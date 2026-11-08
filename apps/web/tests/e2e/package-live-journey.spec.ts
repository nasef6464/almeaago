import { expect, test } from '@playwright/test';

test('isolated real package storefront and checkout', async ({page,browser}) => {
  test.skip(process.env.PACKAGE_LIVE !== '1', 'requires isolated Go and PostgreSQL fixture');
  test.setTimeout(420_000);
  page.setDefaultTimeout(20_000);
  page.setDefaultNavigationTimeout(60_000);
  const email=process.env.PACKAGE_STUDENT_EMAIL!, adminEmail=process.env.PACKAGE_ADMIN_EMAIL!, password=process.env.PACKAGE_PASSWORD!, path=process.env.PACKAGE_PATH_ID!, subject=process.env.PACKAGE_SUBJECT_ID!, topic=process.env.PACKAGE_TOPIC_ID!, lesson=process.env.PACKAGE_LESSON_ID!;
  const level=process.env.PACKAGE_LEVEL_ID!;
  const packageName=`باقة تجربة واجهة ${Date.now()}`;
  const admin=await browser.newContext({baseURL:`http://127.0.0.1:${process.env.E2E_WEB_PORT || '4173'}`});
  const adminLogin=await admin.request.post('/api/v1/auth/login',{data:{email:adminEmail,password}});
  expect(adminLogin.status()).toBe(200);
  const adminPage=await admin.newPage();
  adminPage.setDefaultTimeout(20_000);
  adminPage.setDefaultNavigationTimeout(60_000);
  await adminPage.goto(`/admin-dashboard/taxonomy?path=${path}&pathTab=packages`,{waitUntil:'domcontentloaded'});
  await adminPage.getByRole('button',{name:'إنشاء باقة مسار'}).click();
  const editor=adminPage.locator('.fixed.inset-0').filter({hasText:'إنشاء باقة جديدة لمسار'});
  await editor.getByPlaceholder('مثال: باقة القدرات الشاملة').fill(packageName);
  await editor.getByPlaceholder('مثال: QUDRAT-ALL').fill(`LIVE-${Date.now()}`);
  await editor.locator('select').first().selectOption(subject);
  await editor.getByLabel('التدريبات', {exact:true}).check();
  await editor.getByLabel('التأسيس', {exact:true}).check();
  const creation=adminPage.waitForResponse(response=>response.url().endsWith('/api/v1/commerce/products') && response.request().method()==='POST', {timeout:20_000});
  await editor.getByRole('button',{name:'إنشاء وتفعيل الباقة'}).click();
  const created=await creation; expect(created.status()).toBe(201);
  const product=(await created.json()).product.id;
  const login=await page.request.post('/api/v1/auth/login',{data:{email,password}});
  expect(login.status()).toBe(200);
  const lessonURL=`/api/v1/learning-spaces/foundation/${topic}/lessons/${lesson}`;
  expect((await page.request.get(lessonURL)).status()).toBe(403);
  await page.goto(`/category/${path}?tab=packages`,{waitUntil:'domcontentloaded'});
  const card=page.getByTestId('path-package-card').filter({hasText:packageName});
  await expect(card).toBeVisible({timeout:60_000});
  await card.getByRole('button',{name:'اشترك الآن'}).click();
  const modal=page.getByTestId('payment-modal-shell');
  await expect(modal).toContainText(packageName);
  await modal.getByTestId('payment-continue-purchase').click();
  await modal.getByRole('button',{name:/تحويل بنكي/}).click();
  const checkout=page.waitForResponse(response=>response.url().includes('/api/v1/commerce/checkout/requests') && response.request().method()==='POST');
  await modal.getByRole('button',{name:'إنشاء طلب شراء'}).click();
  const response=await checkout; expect(response.status()).toBe(201);
  const body=await response.json(); expect(body.request.productId).toBe(product); expect(body.request.status).toBe('pending');
  await expect(modal).toContainText('رقم الطلب');
  expect((await page.request.get(lessonURL)).status()).toBe(403);
  await page.screenshot({path:'test-results/package-live-checkout.png',fullPage:true});
  const checkoutOverflow=await page.evaluate(() => {
    const viewport=document.documentElement.clientWidth;
    const offenders=[...document.querySelectorAll('body *')].flatMap(element => {
      const rect=element.getBoundingClientRect();
      if (rect.right <= viewport + 1 && rect.left >= -1) return [];
      const style=getComputedStyle(element);
      return [{tag:element.tagName, className:typeof element.className === 'string' ? element.className.slice(0,160) : '', left:Math.round(rect.left), right:Math.round(rect.right), position:style.position}];
    }).slice(0,20);
    return {viewport, scrollWidth:document.documentElement.scrollWidth, offenders};
  });
  expect(checkoutOverflow, `checkout has horizontal overflow: ${JSON.stringify(checkoutOverflow)}`).toMatchObject({scrollWidth:checkoutOverflow.viewport});
  try {
    await adminPage.goto('/admin-dashboard/commerce',{waitUntil:'domcontentloaded'});
    const requestRow=adminPage.getByRole('article').filter({hasText:packageName});
    await expect(requestRow).toBeVisible();
    adminPage.once('dialog', dialog => void dialog.accept('isolated bank transfer'));
    const reviewPromise=adminPage.waitForResponse(response=>response.url().includes(`/admin/payment-requests/${body.request.id}/review`) && response.request().method()==='PATCH');
    await requestRow.getByRole('button',{name:'اعتماد',exact:true}).click();
    const review=await reviewPromise;
    expect(review.status()).toBe(200);
    await adminPage.goto(`/admin-dashboard/taxonomy?path=${path}&pathTab=packages`,{waitUntil:'domcontentloaded'});
    const packageCard=adminPage.locator('div.rounded-3xl').filter({has:adminPage.getByRole('heading',{name:packageName})});
    await expect(packageCard).toBeVisible();
    const hide=adminPage.waitForResponse(response=>response.url().endsWith(`/api/v1/commerce/products/${product}`) && response.request().method()==='PUT');
    await packageCard.getByRole('button',{name:'إخفاء الباقة'}).click();
    expect((await hide).status()).toBe(200);
    await expect(packageCard.getByRole('button',{name:'إظهار الباقة'})).toBeVisible();
    expect((await page.request.get(lessonURL)).status()).toBe(200);
    await page.goto(`/category/${path}?tab=packages`,{waitUntil:'domcontentloaded'});
    await expect(page.getByTestId('path-package-card').filter({hasText:packageName})).toHaveCount(0);
    const show=adminPage.waitForResponse(response=>response.url().endsWith(`/api/v1/commerce/products/${product}`) && response.request().method()==='PUT');
    await packageCard.getByRole('button',{name:'إظهار الباقة'}).click();
    expect((await show).status()).toBe(200);
    const hidePath=adminPage.waitForResponse(response=>response.url().endsWith(`/api/v1/taxonomy/admin/paths/${path}`) && response.request().method()==='PATCH');
    await adminPage.getByRole('button',{name:'إخفاء المسار من الموقع'}).click();
    expect((await hidePath).status()).toBe(200);
    await expect(adminPage.getByRole('button',{name:'إظهار المسار على الموقع'})).toBeVisible();
    const hidden=await page.request.get('/api/v1/taxonomy/bootstrap?phase=core');
    expect(JSON.stringify(await hidden.json())).not.toContain(path);
    expect((await page.request.get(lessonURL)).status()).toBe(404);
    await adminPage.reload({waitUntil:'domcontentloaded'});
    const showPath=adminPage.waitForResponse(response=>response.url().endsWith(`/api/v1/taxonomy/admin/paths/${path}`) && response.request().method()==='PATCH');
    await adminPage.getByRole('button',{name:'إظهار المسار على الموقع'}).click();
    expect((await showPath).status()).toBe(200);
    expect((await page.request.get(lessonURL)).status()).toBe(200);
    for (const item of [
      {tab:'subjects',route:'subjects',id:subject,title:'test',hide:'إخفاء المادة',show:'إظهار المادة'},
      {tab:'levels',route:'levels',id:level,title:'مرحلة فحص تجريبية',hide:'إخفاء المرحلة',show:'إظهار المرحلة'},
    ]) {
      await adminPage.goto(`/admin-dashboard/taxonomy?path=${path}&pathTab=${item.tab}`,{waitUntil:'domcontentloaded'});
      const row=adminPage.locator('div.rounded-3xl').filter({has:adminPage.getByRole('heading',{name:item.title,exact:true})});
      await expect(row).toBeVisible();
      for (const width of [390,820,1440]) {
        await adminPage.setViewportSize({width,height:900});
        await adminPage.screenshot({path:`test-results/taxonomy-${item.tab}-${width}.png`,fullPage:true});
        const overflow=await adminPage.evaluate(()=>document.documentElement.scrollWidth>document.documentElement.clientWidth);
        expect(overflow,`${item.tab} has horizontal page overflow at ${width}px`).toBe(false);
        const cardBounds=await row.boundingBox();
        for (const name of [item.hide,'حذف']) {
          const buttonBounds=await row.getByRole('button',{name,exact:true}).boundingBox();
          expect(buttonBounds && cardBounds && buttonBounds.x >= cardBounds.x-1 && buttonBounds.x+buttonBounds.width <= cardBounds.x+cardBounds.width+1,`${item.tab} ${name} clipped at ${width}px`).toBe(true);
        }
        const pathButton=adminPage.getByRole('button',{name:'إخفاء المسار من الموقع',exact:true});
        const withinPathCard=await pathButton.evaluate(element=>{
          const card=element.closest('article'); if (!card) return false;
          const button=element.getBoundingClientRect(), container=card.getBoundingClientRect();
          return button.left>=container.left-1 && button.right<=container.right+1;
        });
        expect(withinPathCard,`path visibility control clipped at ${width}px`).toBe(true);
      }
      await adminPage.setViewportSize({width:1280,height:720});
      const hiddenResponse=adminPage.waitForResponse(response=>response.url().endsWith(`/api/v1/taxonomy/admin/${item.route}/${item.id}`) && response.request().method()==='PATCH');
      await row.getByRole('button',{name:item.hide}).click();
      expect((await hiddenResponse).status()).toBe(200);
      await expect(row.getByRole('button',{name:item.show})).toBeVisible();
      const state=await page.request.get('/api/v1/taxonomy/bootstrap?phase=core');
      expect(JSON.stringify(await state.json())).not.toContain(item.id);
      const shownResponse=adminPage.waitForResponse(response=>response.url().endsWith(`/api/v1/taxonomy/admin/${item.route}/${item.id}`) && response.request().method()==='PATCH');
      await row.getByRole('button',{name:item.show}).click();
      expect((await shownResponse).status()).toBe(200);
    }
    const levelRow=adminPage.locator('div.rounded-3xl').filter({has:adminPage.getByRole('heading',{name:'مرحلة فحص تجريبية',exact:true})});
    await levelRow.getByRole('button',{name:'حذف',exact:true}).click();
    const deleted=adminPage.waitForResponse(response=>response.url().endsWith(`/api/v1/taxonomy/admin/levels/${level}`) && response.request().method()==='DELETE');
    await adminPage.getByRole('button',{name:'تأكيد الحذف النهائي'}).click();
    expect((await deleted).status()).toBe(200);
    await expect(levelRow).toHaveCount(0);
    await adminPage.goto(`/admin-dashboard/taxonomy?path=${path}&pathTab=subjects`,{waitUntil:'domcontentloaded'});
    const subjectRow=adminPage.locator('div.rounded-3xl').filter({has:adminPage.getByRole('heading',{name:'test',exact:true})});
    await subjectRow.getByRole('button',{name:'حذف',exact:true}).click();
    const conflict=adminPage.waitForResponse(response=>response.url().endsWith(`/api/v1/taxonomy/admin/subjects/${subject}`) && response.request().method()==='DELETE');
    await adminPage.getByRole('button',{name:'تأكيد الحذف النهائي'}).click();
    expect((await conflict).status()).toBe(409);
    await expect(adminPage.getByText('لا يمكن الحذف لوجود بيانات مرتبطة.',{exact:false})).toBeVisible();
    await expect(subjectRow).toBeVisible();
  } finally { await admin.close(); }
  const opened=await page.request.get(lessonURL); expect(opened.status()).toBe(200);
  expect((await opened.json()).lesson.contentText).toBe('محتوى محمي تجريبي');
  await page.goto(`/category/${path}?subject=${subject}&tab=skills&topic=${topic}&content=lessons`,{waitUntil:'domcontentloaded'});
  const topicDialog=page.getByTestId('foundation-topic-dialog');
  await expect(topicDialog.getByText('درس باقة تجريبي')).toBeVisible();
  await topicDialog.getByRole('button',{name:'فتح الدرس: درس باقة تجريبي'}).click();
  await expect(topicDialog.getByRole('dialog',{name:'الدرس المحدد'})).toContainText('محتوى محمي تجريبي');
});
