import {expect,test} from '@playwright/test';

const cases=[
  {route:'/about',title:'من نحن',section:'مهمتنا',copy:'نساعد الطالب على فهم مستواه'},
  {route:'/contact',title:'تواصل معنا',section:'الدعم',copy:'زر واتساب الظاهر في الصفحات العامة عند تفعيله'},
  {route:'/faq',title:'الأسئلة الشائعة',section:'هل أحتاج حسابا للبدء؟',copy:'يظهر في صفحة طلباتي'},
  {route:'/privacy',title:'سياسة الخصوصية',section:'بيانات الحساب',copy:'تقييد الصفحات الخاصة خلف تسجيل الدخول'},
  {route:'/terms',title:'الشروط والأحكام',section:'استخدام الحساب',copy:'المحتوى، الأسعار، أو آليات الوصول'},
] as const;

for(const width of [390,820,1440]){
  for(const info of cases){
    test(`legacy public info ${info.route} at ${width}px: text, RTL and back navigation`,async({page})=>{
      await page.route('**/api/v1/auth/me',route=>route.fulfill({status:401,contentType:'application/json',body:'{"error":{"message":"unauthenticated"}}'}));
      await page.setViewportSize({width,height:width===390?844:width===820?1180:1000});
      await page.goto(info.route);
      await expect(page.getByRole('heading',{name:info.title,exact:true})).toBeVisible();
      await expect(page.getByRole('heading',{name:info.section,exact:true})).toBeVisible();
      await expect(page.getByText(info.copy,{exact:false})).toBeVisible();
      const main=page.locator('[dir="rtl"]').filter({has:page.getByRole('heading',{name:info.title,exact:true})}).first();
      await expect(main).toBeVisible();
      await expect.poll(()=>page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth)).toBe(true);
      await page.screenshot({path:`test-results/public-static-${info.route.slice(1)}-${width}.png`,fullPage:true});
      await page.getByRole('link',{name:'العودة للرئيسية'}).click();
      await expect(page).toHaveURL(/\/$/);
    });
  }
}
