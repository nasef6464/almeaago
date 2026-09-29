import { expect, test, type Page, type Route } from '@playwright/test';

function json(route:Route,body:unknown,status=200){
  return route.fulfill({status,contentType:'application/json',body:JSON.stringify(body)});
}

async function signedOut(page:Page){
  await page.route('**/api/v1/auth/me',route=>json(route,{error:{message:'unauthenticated'}},401));
}

const student={
  id:'student-ui-1',email:'student@example.com',name:'طالب المئة',status:'active',avatarUrl:'',emailVerified:true,
  role:'student',roles:['student'],
};
const supervisor={
  id:'supervisor-ui-1',email:'supervisor@example.com',name:'مشرف المدرسة',status:'active',avatarUrl:'',emailVerified:true,
  role:'supervisor',roles:['supervisor'],
};
const admin={
  id:'admin-ui-1',email:'admin@example.com',name:'مدير المنصة',status:'active',avatarUrl:'',emailVerified:true,
  role:'admin',roles:['admin'],
};

test('public landing restores the real platform identity on desktop',async({page})=>{
  await signedOut(page);
  await page.setViewportSize({width:1440,height:1000});
  await page.goto('/');

  await expect(page).toHaveTitle(/منصة المئة/);
  await expect(page.getByTestId('public-landing')).toBeVisible();
  await expect(page.getByRole('heading',{name:'حقق المئة في اختباراتك'})).toBeVisible();
  await expect(page.getByText('المنصة الأولى للقدرات والتحصيلي')).toBeVisible();
  await expect(page.getByRole('button',{name:'ابدأ التدريب مجانًا'})).toBeVisible();
  await expect(page.getByRole('heading',{name:'من التأسيس إلى يوم الاختبار'})).toBeVisible();
  await expect(page.getByRole('heading',{name:'لماذا يختار الطلاب منصة المئة؟'})).toBeVisible();
  await expect(page.getByRole('heading',{name:'قصص نجاح نعتز بها'})).toBeVisible();
  await expect.poll(()=>page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth)).toBe(true);
  await page.screenshot({path:'test-results/public-landing-desktop.png',fullPage:true});
});

test('public landing is bounded on phone and opens the responsive menu',async({page})=>{
  await signedOut(page);
  await page.setViewportSize({width:390,height:844});
  await page.goto('/');

  await expect(page.getByRole('heading',{name:'حقق المئة في اختباراتك'})).toBeVisible();
  await page.getByRole('button',{name:'فتح القائمة'}).click();
  await expect(page.getByRole('navigation',{name:'التنقل الرئيسي للجوال'})).toBeVisible();
  await expect(page.getByRole('navigation',{name:'التنقل الرئيسي للجوال'}).getByRole('link',{name:'التعلم',exact:true})).toBeVisible();
  await expect.poll(()=>page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth)).toBe(true);
  await page.screenshot({path:'test-results/public-landing-mobile.png',fullPage:true});
});

test('public landing stays bounded on tablet and source-backed info pages are real routes',async({page})=>{
  await signedOut(page);
  await page.setViewportSize({width:820,height:1180});
  await page.goto('/');

  await expect(page.getByRole('heading',{name:'من التأسيس إلى يوم الاختبار'})).toBeVisible();
  await expect.poll(()=>page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth)).toBe(true);
  await page.goto('/privacy');
  await expect(page.getByRole('heading',{name:'سياسة الخصوصية'})).toBeVisible();
  await expect(page.getByRole('heading',{name:'بيانات الحساب'})).toBeVisible();
  await page.screenshot({path:'test-results/public-info-tablet.png',fullPage:true});
});

test('student dashboard is a real workspace hub instead of a placeholder',async({page})=>{
  await page.route('**/api/v1/auth/me',route=>json(route,{user:student}));
  await page.setViewportSize({width:390,height:844});
  await page.goto('/dashboard');

  await expect(page.getByRole('heading',{name:'أهلًا طالب المئة'})).toBeVisible();
  await expect(page.locator('a[href="/learning"]')).toBeVisible();
  await expect(page.locator('a[href="/assessments"]')).toBeVisible();
  await expect(page.locator('a[href="/review"]')).toBeVisible();
  await expect(page.locator('a[href="/classroom/join"]')).toBeVisible();
  await expect(page.getByText('هذه الوجهة ستُنقل من الواجهة المرجعية في مرحلتها.')).toHaveCount(0);
  await expect.poll(()=>page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth)).toBe(true);
  await page.screenshot({path:'test-results/student-dashboard-mobile.png',fullPage:true});
});

test('supervisor and admin roots expose real scoped workspaces',async({page})=>{
  await page.route('**/api/v1/auth/me',route=>json(route,{user:supervisor}));
  await page.route('**/api/v1/schools/context',route=>json(route,{contexts:[
    {schoolId:'school-1',schoolName:'مدرسة المئة',role:'supervisor',permissions:['SCHOOL_REPORTS_AGGREGATE_VIEW'],modules:['SCHOOL_CORE'],source:'scope'},
  ]}));
  await page.goto('/supervisor-dashboard');

  await expect(page.getByRole('heading',{name:'لوحة المشرف'})).toBeVisible();
  await expect(page.getByText('مدرسة المئة')).toBeVisible();
  await expect(page.getByRole('link',{name:/التدخلات والخطط العلاجية/})).toBeVisible();

  await page.unroute('**/api/v1/auth/me');
  await page.route('**/api/v1/auth/me',route=>json(route,{user:admin}));
  await page.goto('/admin-dashboard');

  await expect(page.getByRole('heading',{name:'مركز إدارة منصة المئة'})).toBeVisible();
  await expect(page.locator('main').getByRole('link',{name:/المحتوى التعليمي/})).toBeVisible();
  await expect(page.locator('main').getByRole('link',{name:/العمليات والتدقيق/})).toBeVisible();
  await expect(page.getByText('هذه الوجهة ستُنقل من الواجهة المرجعية في مرحلتها.')).toHaveCount(0);
});
