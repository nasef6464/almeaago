import{expect,test,type Page,type Route}from'@playwright/test';

const admin={id:'admin-1',email:'admin@example.com',name:'مدير المنصة',status:'active',avatarUrl:'',emailVerified:true,role:'admin',roles:['admin']};
const student={id:'student-1',email:'student@example.com',name:'طالب',status:'active',avatarUrl:'',emailVerified:true,role:'student',roles:['student']};

function json(r:Route,b:unknown,s=200){return r.fulfill({status:s,contentType:'application/json',body:JSON.stringify(b)})}
async function auth(page:Page,user:typeof admin|typeof student){await page.route('**/api/v1/auth/me',r=>json(r,{user}));await page.route('**/api/v1/auth/csrf',r=>json(r,{csrfToken:'csrf'}));}

test('admin makes a course paid and grants server-owned access',async({page})=>{
 await auth(page,admin);
 let courseProduct:any={id:'product-course-1',code:'COURSE-1',productType:'course',name:'دورة الكمي',description:'',status:'active',accessMode:'free',priceMinor:0,currency:'SAR',courseId:'course-1',isVisible:true,revision:1,createdAt:'2026-09-26T10:00:00Z',updatedAt:'2026-09-26T10:00:00Z'};
 let entitlement:any=null;
 await page.route('**/api/v1/commerce/products?**',r=>json(r,{items:[courseProduct],page:1,limit:100,hasMore:false}));
 await page.route('**/api/v1/commerce/entitlements?**',r=>json(r,{items:entitlement?[entitlement]:[],page:1,limit:50,hasMore:false}));
 await page.route('**/api/v1/commerce/admin/discounts?**',r=>json(r,{items:[],page:1,limit:50,hasMore:false}));
 await page.route('**/api/v1/commerce/admin/payment-requests?**',r=>json(r,{items:[],page:1,limit:50,hasMore:false}));
 await page.route('**/api/v1/commerce/admin/access-codes?**',r=>json(r,{items:[],page:1,limit:50,hasMore:false}));
 await page.route('**/api/v1/commerce/products/product-course-1',async r=>{
   expect(r.request().method()).toBe('PUT');
   const body=JSON.parse(r.request().postData()||'{}');
   expect(body.expectedRevision).toBe(1);
   expect(body.product).toMatchObject({productType:'course',courseId:'course-1',accessMode:'paid',priceMinor:12000,currency:'SAR'});
   courseProduct={...courseProduct,...body.product,revision:2,updatedAt:'2026-09-26T10:01:00Z'};
   return json(r,{product:courseProduct});
 });
 await page.route('**/api/v1/commerce/entitlements',async r=>{
   expect(r.request().method()).toBe('POST');
   const body=JSON.parse(r.request().postData()||'{}');
   expect(body).toMatchObject({subjectType:'user',userId:'student-1',schoolId:'',productId:'product-course-1'});
   expect(typeof body.idempotencyKey).toBe('string');
   entitlement={id:'entitlement-1',...body,sourceType:'admin_manual',sourceId:body.idempotencyKey,status:'active',grantedByUserId:'admin-1',startsAt:'2026-09-26T10:02:00Z',expiresAt:null,revokedAt:null,revokeReason:'',revision:1,createdAt:'2026-09-26T10:02:00Z',updatedAt:'2026-09-26T10:02:00Z'};
   return json(r,{entitlement},201);
 });

 await page.goto('/admin-dashboard/commerce');
 await expect(page.getByRole('heading',{name:'المنتجات والخصومات وطلبات الدفع'})).toBeVisible();
 await page.getByLabel('سعر دورة الكمي').fill('12000');
 await page.getByRole('button',{name:'مدفوع'}).click();
 await expect(page.getByText('تم حفظ سياسة الوصول من الخادم.')).toBeVisible();

 await page.getByLabel('معرف المستفيد').fill('student-1');
 await page.getByLabel('المنتج الممنوح').selectOption('product-course-1');
 await page.getByRole('button',{name:'منح الوصول'}).click();
 await expect(page.getByText('تم منح الوصول يدويًا مع سجل قابل للتدقيق.')).toBeVisible();
 await expect(page.getByText('student-1')).toBeVisible();
 await page.screenshot({path:'test-results/commerce-admin-foundation.png',fullPage:true});
});

test('mobile learner gets preview only until Commerce grants the paid course',async({page})=>{
 await auth(page,student);
 await page.setViewportSize({width:390,height:844});
 let granted=false;
 const buildCourse=()=>({
   id:'course-1',title:'دورة الكمي المدفوعة',description:'',instructorName:'فريق المنصة',durationMinutes:30,level:'beginner',thumbnailAssetId:'',dripContentEnabled:false,certificateEnabled:false,
   access:{allowed:granted,configured:true,reason:granted?'user_entitlement':'paid_required'},
   modules:[{id:'module-1',title:'الوحدة',description:'',sortOrder:1,lessons:[
     {id:'preview-1',title:'معاينة مجانية',description:'',type:'text',durationSeconds:0,isLocked:false,isPreview:true,commerceLocked:false,sortOrder:1},
     {id:'paid-1',title:'الدرس المدفوع',description:'',type:'text',durationSeconds:0,isLocked:false,isPreview:false,commerceLocked:!granted,sortOrder:2},
   ]}],
 });
 await page.route('**/api/v1/learning-spaces/courses/course-1',r=>json(r,{course:buildCourse()}));
 await page.route('**/api/v1/learning-spaces/courses/course-1/lessons/*',r=>{
   const id=new URL(r.request().url()).pathname.split('/').pop()||'';
   if(id==='paid-1'&&!granted)return json(r,{message:'Forbidden'},403);
   return json(r,{lesson:{id,title:id==='paid-1'?'الدرس المدفوع':'معاينة مجانية',description:'',type:'text',durationSeconds:0,isLocked:false,isPreview:id==='preview-1',commerceLocked:false,sortOrder:id==='preview-1'?1:2,contentText:id==='paid-1'?'محتوى مدفوع':'محتوى معاينة',videoUrl:'',videoSource:''}});
 });
 await page.route('**/api/v1/learning-progress/lessons/**',r=>json(r,{progress:{lessonId:'preview-1',contextType:'course',courseId:'course-1',topicId:'',status:'not_started',positionSeconds:0,completedAt:null,updatedAt:'2026-09-26T10:00:00Z'}}));

 await page.goto('/learning/courses/course-1');
 await expect(page.getByTestId('course-commerce-lock')).toBeVisible();
 await expect(page.getByRole('button',{name:/الدرس المدفوع/})).toBeDisabled();
 await expect(page.getByText('محتوى معاينة')).toBeVisible();

 granted=true;
 await page.reload();
 await expect(page.getByTestId('course-commerce-lock')).toHaveCount(0);
 await expect(page.getByRole('button',{name:/الدرس المدفوع/})).toBeEnabled();
 await page.getByRole('button',{name:/الدرس المدفوع/}).click();
 await expect(page.getByText('محتوى مدفوع')).toBeVisible();
 await page.screenshot({path:'test-results/commerce-course-access-mobile.png',fullPage:true});
});
