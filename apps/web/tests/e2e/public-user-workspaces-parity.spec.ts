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
  await expect(page.getByRole('heading',{name:'كل ما تحتاجه للتفوق'})).toBeVisible();
  await expect(page.getByRole('heading',{name:'الدورات الأكثر طلبًا'})).toBeVisible();
  await expect(page.getByRole('heading',{name:'مقالات ومراجعات مهمة'})).toBeVisible();
  await expect(page.getByRole('heading',{name:'لماذا يختار الطلاب منصة المئة؟'})).toBeVisible();
  await expect(page.getByRole('heading',{name:'محطات التفوق الذكي في منصة المئة'})).toBeVisible();
  await expect(page.getByRole('heading',{name:'قصص نجاح نعتز بها'})).toBeVisible();
  await expect(page.getByRole('button',{name:'الصورة التالية'})).toBeVisible();
  await page.getByRole('button',{name:/النمط السيبراني الليلي/}).click();
  await expect(page.getByText('بطل القدرات العامة')).toBeVisible();
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
  await expect(page.getByRole('navigation',{name:'التنقل الرئيسي للجوال'}).getByRole('link',{name:'اختبارات',exact:true})).toBeVisible();
  await expect.poll(()=>page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth)).toBe(true);
  await page.screenshot({path:'test-results/public-landing-mobile.png',fullPage:true});
});

test('public landing stays bounded on tablet and source-backed info pages are real routes',async({page})=>{
  await signedOut(page);
  await page.setViewportSize({width:820,height:1180});
  await page.goto('/');

  await expect(page.getByRole('heading',{name:'كل ما تحتاجه للتفوق'})).toBeVisible();
  await expect(page.getByRole('heading',{name:'محطات التفوق الذكي في منصة المئة'})).toBeVisible();
  await expect.poll(()=>page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth)).toBe(true);
  await page.screenshot({path:'test-results/public-landing-tablet.png',fullPage:true});
  await page.goto('/privacy');
  await expect(page.getByRole('heading',{name:'سياسة الخصوصية'})).toBeVisible();
  await expect(page.getByRole('heading',{name:'بيانات الحساب'})).toBeVisible();
  await page.screenshot({path:'test-results/public-info-tablet.png',fullPage:true});
});

test('student dashboard restores the legacy workspace shell over real V2 routes',async({page})=>{
  await page.route('**/api/v1/auth/me',route=>json(route,{user:student}));
  await page.setViewportSize({width:390,height:844});
  await page.goto('/dashboard');

  await expect(page.getByRole('heading',{name:'مرحباً يا بطل! 👋'})).toBeVisible();
  await expect(page.getByTestId('student-today-focus')).toContainText('خطوتك اليوم');

  const studentMain=page.locator('main');
  await expect(studentMain.locator('a[href="/learning"]').first()).toBeVisible();
  await expect(studentMain.locator('a[href="/assessments"]').first()).toBeVisible();
  await expect(studentMain.locator('a[href="/review"]').first()).toBeVisible();
  await expect(studentMain.locator('a[href="/reports"]').first()).toBeVisible();
  await expect(studentMain.locator('a[href="/notifications"]').first()).toBeVisible();

  await page.getByRole('button',{name:'فتح قائمة لوحة الطالب'}).click();
  const navigation=page.getByRole('navigation',{name:'تنقل لوحة الطالب'});
  await expect(navigation).toBeVisible();
  await expect(page.getByTestId('student-menu-group-learning')).toContainText('التعلم');
  await expect(page.getByTestId('student-menu-group-exams')).toContainText('الاختبارات');
  await expect(page.getByTestId('student-menu-group-tools')).toContainText('الأدوات');
  await expect(page.getByTestId('student-menu-group-support')).toContainText('الدعم والمتابعة');
  await expect(navigation.locator('a[href="/assessment-assignments"]')).toBeVisible();
  await expect(navigation.locator('a[href="/classroom/join"]')).toBeVisible();

  await expect(page.getByText('هذه الوجهة ستُنقل من الواجهة المرجعية في مرحلتها.')).toHaveCount(0);
  await expect.poll(()=>page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth)).toBe(true);
  await page.screenshot({path:'test-results/student-dashboard-mobile-menu.png',fullPage:true});

  await page.getByRole('button',{name:'إغلاق قائمة لوحة الطالب'}).last().click();
  await page.setViewportSize({width:1440,height:1000});
  await expect(navigation).toBeVisible();
  await expect(page.locator('aside[aria-label="تنقل لوحة الطالب"]').getByText('طالب المئة',{exact:true})).toBeVisible();
  await expect.poll(()=>page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth)).toBe(true);
  await page.screenshot({path:'test-results/student-dashboard-desktop.png',fullPage:true});
});


test('learner reporting entry opens the already-certified report without duplicating reporting authority',async({page})=>{
  await page.route('**/api/v1/auth/me',route=>json(route,{user:student}));
  await page.route('**/api/v1/taxonomy/bootstrap?phase=core',route=>json(route,{paths:[],subjects:[]}));
  await page.route('**/api/v1/reports/overview',route=>json(route,{scope:{canExport:false,isTruncated:false},assessment:{averageScore:0,passRate:0,passed:0,resultCount:0,resultsTruncated:false,attemptsTruncated:false},weakestSkills:[]}));
  await page.route('**/api/v1/reports/results?page=1&limit=20',route=>json(route,{items:[],page:1,limit:20,total:0}));
  await page.setViewportSize({width:390,height:844});
  await page.goto('/dashboard');
  await page.locator('main a[href="/reports"]').first().click();
  await expect(page).toHaveURL(/\/reports$/);
  await expect(page.getByRole('heading',{name:'تقارير الأداء'})).toBeVisible();
  await expect(page.getByText('قراءة سريعة للتقرير')).toBeVisible();
  await expect(page.getByText('لا توجد نتائج في النطاق الحالي.')).toBeVisible();
  await expect.poll(()=>page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth)).toBe(true);
  await page.screenshot({path:'test-results/ui4-reporting-entry-mobile.png',fullPage:true});
});


test('learner notifications preserve legacy entry states over canonical V2 authority',async({page})=>{
  await page.route('**/api/v1/auth/me',route=>json(route,{user:student}));
  await page.route('**/api/v1/notifications/me?page=1&limit=50',route=>json(route,{items:[],page:1,limit:50,total:0}));
  await page.route('**/api/v1/notifications/me/unread-count',route=>json(route,{unreadCount:0}));
  await page.setViewportSize({width:390,height:844});
  await page.goto('/notifications');

  await expect(page.getByTestId('learner-notification-inbox')).toBeVisible();
  await expect(page.getByRole('heading',{name:'الإشعارات'})).toBeVisible();
  await expect(page.getByText('لوحة الطالب / الدعم والمتابعة')).toBeVisible();
  await expect(page.getByText('لا توجد إشعارات جديدة')).toBeVisible();
  await expect(page.getByRole('region',{name:'قائمة الإشعارات'})).toContainText('لا توجد إشعارات');
  await expect.poll(()=>page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth)).toBe(true);
  await page.screenshot({path:'test-results/learner-notifications-mobile-empty.png',fullPage:true});

  await page.unroute('**/api/v1/notifications/me?page=1&limit=50');
  await page.unroute('**/api/v1/notifications/me/unread-count');
  await page.route('**/api/v1/notifications/me?page=1&limit=50',route=>json(route,{items:[{id:'n-1',title:'اختبار جديد',body:'تمت إضافة اختبار جديد لك.',createdAt:'2026-10-01T00:00:00Z',readAt:null}],page:1,limit:50,total:1}));
  await page.route('**/api/v1/notifications/me/unread-count',route=>json(route,{unreadCount:1}));
  await page.setViewportSize({width:1440,height:1000});
  await page.goto('/notifications');
  await expect(page.getByText('1 جديد')).toBeVisible();
  await expect(page.getByRole('region',{name:'قائمة الإشعارات'})).toContainText('اختبار جديد');
  await expect.poll(()=>page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth)).toBe(true);
  await page.screenshot({path:'test-results/learner-notifications-desktop-unread.png',fullPage:true});
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
