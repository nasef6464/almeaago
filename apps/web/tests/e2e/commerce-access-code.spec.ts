import{expect,test,type Page,type Route}from'@playwright/test';

const admin={id:'admin-1',email:'admin@example.com',name:'مدير المنصة',status:'active',avatarUrl:'',emailVerified:true,role:'admin',roles:['admin']};
const student={id:'student-1',email:'student@example.com',name:'طالب',status:'active',avatarUrl:'',emailVerified:true,role:'student',roles:['student']};

const courseProduct={
 id:'product-course-1',code:'COURSE-1',productType:'course',name:'دورة الكمي',description:'دورة مدفوعة',
 status:'active',accessMode:'paid',priceMinor:12000,currency:'SAR',courseId:'course-1',isVisible:true,revision:4,
 createdAt:'2026-09-26T11:00:00Z',updatedAt:'2026-09-26T11:00:00Z'
};
const schoolProduct={
 id:'product-school-1',code:'SCHOOL-PACK',productType:'package',name:'باقة مدرسة الرياض',description:'',
 status:'active',accessMode:'paid',priceMinor:50000,currency:'SAR',courseId:'',isVisible:true,revision:1,
 package:{id:'package-1',productId:'product-school-1',packageKind:'school',seatCapacity:30,validityDays:90,items:[{scopeType:'all',courseId:'',pathId:'',subjectId:'',contentType:''}]},
 createdAt:'2026-09-26T11:00:00Z',updatedAt:'2026-09-26T11:00:00Z'
};

function json(r:Route,b:unknown,s=200){return r.fulfill({status:s,contentType:'application/json',body:JSON.stringify(b)})}
async function auth(page:Page,user:typeof admin|typeof student){
 await page.route('**/api/v1/auth/me',r=>json(r,{user}));
 await page.route('**/api/v1/auth/csrf',r=>json(r,{csrfToken:'csrf'}));
}

test('student redeems school access code without sending price or membership authority',async({page})=>{
 await auth(page,student);
 await page.setViewportSize({width:390,height:844});
 await page.route('**/api/v1/commerce/catalog/products/product-course-1',r=>json(r,{product:courseProduct}));
 await page.route('**/api/v1/commerce/checkout/requests?**',r=>json(r,{items:[],page:1,limit:20,hasMore:false}));
 await page.route('**/api/v1/commerce/access-codes/redeem',async r=>{
  expect(r.request().method()).toBe('POST');
  expect(r.request().headers()['x-csrf-token']).toBe('csrf');
  const body=JSON.parse(r.request().postData()||'{}');
  expect(body).toEqual({code:'SCHOOL-2026'});
  expect(body).not.toHaveProperty('schoolId');
  expect(body).not.toHaveProperty('productId');
  expect(body).not.toHaveProperty('priceMinor');
  return json(r,{redemption:{
   accessCode:{id:'code-1',code:'SCHOOL-2026',schoolId:'school-1',productId:'product-school-1',status:'active',maxUses:30,currentUses:1,startsAt:null,expiresAt:'2026-12-31T12:00:00Z',revision:2,createdAt:'2026-09-26T11:00:00Z',updatedAt:'2026-09-26T11:02:00Z'},
   schoolSeat:{id:'seat-1',schoolId:'school-1',productId:'product-school-1',userId:'student-1',entitlementId:'ent-1',sourceType:'access_code',sourceId:'code-1',idempotencyKey:'access_code:code-1:student-1',assignedByUserId:'',createdAt:'2026-09-26T11:02:00Z'},
   entitlement:{id:'ent-1',subjectType:'user',userId:'student-1',schoolId:'',productId:'product-school-1',sourceType:'access_code',sourceId:'code-1',status:'active',grantedByUserId:'',startsAt:'2026-09-26T11:02:00Z',expiresAt:'2026-12-25T11:02:00Z',revokedAt:null,revokeReason:'',idempotencyKey:'access_code:code-1:student-1',revision:1,createdAt:'2026-09-26T11:02:00Z',updatedAt:'2026-09-26T11:02:00Z'},
   duplicate:false
  }});
 });
 await page.goto('/checkout?productId=product-course-1');
 await expect(page.getByText('كود التفعيل مختلف عن كود الخصم', {exact:false})).toBeVisible();
 await page.getByLabel('كود التفعيل').fill('school-2026');
 await page.getByRole('button',{name:'تفعيل الباقة'}).click();
 await expect(page.getByText('تم تفعيل كود الباقة وتم حجز مقعد المدرسة لك.')).toBeVisible();
 await page.screenshot({path:'test-results/commerce-access-code-mobile.png',fullPage:true});
});

test('admin creates bounded school code and explicit seat assignment',async({page})=>{
 await auth(page,admin);
 let codes:any[]=[];
 let seats:any[]=[];
 await page.route('**/api/v1/commerce/products?**',r=>json(r,{items:[courseProduct,schoolProduct],page:1,limit:100,hasMore:false}));
 await page.route('**/api/v1/commerce/entitlements?**',r=>json(r,{items:[],page:1,limit:50,hasMore:false}));
 await page.route('**/api/v1/commerce/admin/discounts?**',r=>json(r,{items:[],page:1,limit:50,hasMore:false}));
 await page.route('**/api/v1/commerce/admin/payment-requests?**',r=>json(r,{items:[],page:1,limit:50,hasMore:false}));
 await page.route('**/api/v1/commerce/admin/access-codes?**',r=>json(r,{items:codes,page:1,limit:50,hasMore:false}));
 await page.route('**/api/v1/commerce/admin/school-seats?**',r=>json(r,{items:seats,page:1,limit:50,hasMore:false}));
 await page.route('**/api/v1/commerce/admin/access-codes',async r=>{
  const body=JSON.parse(r.request().postData()||'{}');
  expect(body.code).toBe('RIYADH-30');
  expect(body.schoolId).toBe('school-1');
  expect(body.productId).toBe('product-school-1');
  expect(body.maxUses).toBe(30);
  expect(body.startsAt).toBeNull();
  expect(body.expiresAt).toContain('2026-12-31');
  const accessCode={id:'code-2',...body,status:'active',currentUses:0,revision:1,createdAt:'2026-09-26T11:00:00Z',updatedAt:'2026-09-26T11:00:00Z'};
  codes=[accessCode];
  return json(r,{accessCode},201);
 });
 await page.route('**/api/v1/commerce/admin/school-seats',async r=>{
  const body=JSON.parse(r.request().postData()||'{}');
  expect(body.schoolId).toBe('school-1');
  expect(body.userId).toBe('student-1');
  expect(body.productId).toBe('product-school-1');
  expect(body.expiresAt).toBeNull();
  expect(typeof body.idempotencyKey).toBe('string');
  const schoolSeat={id:'seat-2',schoolId:body.schoolId,productId:body.productId,userId:body.userId,entitlementId:'ent-2',sourceType:'admin_assignment',sourceId:body.idempotencyKey,idempotencyKey:'school_seat:'+body.idempotencyKey,assignedByUserId:'admin-1',createdAt:'2026-09-26T11:10:00Z'};
  seats=[schoolSeat];
  return json(r,{schoolSeat,entitlement:{id:'ent-2'}},201);
 });

 await page.goto('/admin-dashboard/commerce');
 await page.getByLabel('كود التفعيل الإداري').fill('riyadh-30');
 await page.getByLabel('معرف مدرسة كود التفعيل').fill('school-1');
 await page.getByLabel('باقة كود التفعيل').selectOption('product-school-1');
 await page.getByLabel('حد استخدام كود التفعيل').fill('30');
 await page.getByLabel('انتهاء كود التفعيل').fill('2026-12-31T12:00');
 await page.getByRole('button',{name:'إنشاء كود التفعيل'}).click();
 await expect(page.getByText('تم إنشاء كود التفعيل مع حد استخدام ومقاعد خاضعة للخادم.')).toBeVisible();
 await expect(page.getByText('RIYADH-30')).toBeVisible();

 await page.getByLabel('معرف مدرسة المقعد').fill('school-1');
 await page.getByLabel('معرف طالب المقعد').fill('student-1');
 await page.getByLabel('باقة المقعد').selectOption('product-school-1');
 await page.getByRole('button',{name:'حجز المقعد'}).click();
 await expect(page.getByText('تم حجز مقعد صريح وإنشاء Entitlement واحد للطالب.')).toBeVisible();
 await expect(page.getByText('student-1')).toBeVisible();
});
