import{expect,test,type Page,type Route}from'@playwright/test';

const admin={id:'admin-1',email:'admin@example.com',name:'مدير المنصة',status:'active',avatarUrl:'',emailVerified:true,role:'admin',roles:['admin']};
const student={id:'student-1',email:'student@example.com',name:'طالب',status:'active',avatarUrl:'',emailVerified:true,role:'student',roles:['student']};

const product={
 id:'product-course-1',code:'COURSE-1',productType:'course',name:'دورة الكمي',description:'دورة مدفوعة',
 status:'active',accessMode:'paid',priceMinor:12000,currency:'SAR',courseId:'course-1',isVisible:true,revision:4,
 createdAt:'2026-09-26T11:00:00Z',updatedAt:'2026-09-26T11:00:00Z'
};
const preview={
 valid:true,code:'SAVE10',label:'خصم 10%',originalAmountMinor:12000,discountAmountMinor:1200,
 finalAmountMinor:10800,currency:'SAR',message:''
};
const pending={
 id:'payment-1',userId:'student-1',productId:'product-course-1',productRevision:4,productName:'دورة الكمي',
 originalAmountMinor:12000,discountAmountMinor:1200,finalAmountMinor:10800,currency:'SAR',
 discountId:'discount-1',discountCode:'SAVE10',paymentMethod:'card',gatewayMode:'manual_review',
 providerCode:'manual_card',status:'pending',idempotencyKey:'checkout-key',providerTransactionId:'',
 paidAt:null,reviewedBy:'',reviewedAt:null,reviewerNotes:'',approvalEvidence:'',revision:1,
 createdAt:'2026-09-26T11:01:00Z',updatedAt:'2026-09-26T11:01:00Z'
};

function json(r:Route,b:unknown,s=200){return r.fulfill({status:s,contentType:'application/json',body:JSON.stringify(b)})}
async function auth(page:Page,user:typeof admin|typeof student){
 await page.route('**/api/v1/auth/me',r=>json(r,{user}));
 await page.route('**/api/v1/auth/csrf',r=>json(r,{csrfToken:'csrf'}));
}

test('learner checkout uses server price and creates pending request without browser amount authority',async({page})=>{
 await auth(page,student);
 await page.setViewportSize({width:390,height:844});

 await page.route('**/api/v1/commerce/catalog/products/product-course-1',r=>json(r,{product}));
 await page.route('**/api/v1/commerce/checkout/requests?**',r=>json(r,{items:[],page:1,limit:20,hasMore:false}));
 await page.route('**/api/v1/commerce/discounts/preview',async r=>{
   const body=JSON.parse(r.request().postData()||'{}');
   expect(body).toEqual({productId:'product-course-1',code:'SAVE10'});
   return json(r,{preview});
 });
 await page.route('**/api/v1/commerce/checkout/requests',async r=>{
   expect(r.request().method()).toBe('POST');
   const body=JSON.parse(r.request().postData()||'{}');
   expect(body.productId).toBe('product-course-1');
   expect(body.discountCode).toBe('SAVE10');
   expect(body.paymentMethod).toBe('card');
   expect(typeof body.idempotencyKey).toBe('string');
   expect(body.idempotencyKey.length).toBeGreaterThan(8);
   expect(body).not.toHaveProperty('priceMinor');
   expect(body).not.toHaveProperty('amount');
   expect(body).not.toHaveProperty('amountMinor');
   expect(body).not.toHaveProperty('currency');
   expect(body).not.toHaveProperty('productName');
   return json(r,{request:{...pending,idempotencyKey:body.idempotencyKey}},201);
 });

 await page.goto('/checkout?productId=product-course-1');
 await expect(page.getByRole('heading',{name:'طلب شراء دورة الكمي'})).toBeVisible();
 await expect(page.getByText('السعر الأصلي')).toBeVisible();
 await page.getByLabel('كود الخصم').fill('save10');
 await page.getByRole('button',{name:'تطبيق'}).click();
 await expect(page.getByText('تم تطبيق SAVE10', {exact:false})).toBeVisible();
 await expect(page.getByText('المبلغ النهائي')).toBeVisible();

 await page.getByRole('button',{name:'إنشاء طلب دفع آمن'}).click();
 const statusCard=page.getByTestId('payment-request-status');
 await expect(statusCard).toBeVisible();
 await expect(statusCard).toContainText('لن يتم منح الوصول من الواجهة');
 await expect(statusCard).toContainText('pending');
 await page.screenshot({path:'test-results/commerce-checkout-mobile.png',fullPage:true});
});

test('admin creates discount and approves pending payment with evidence',async({page})=>{
 await auth(page,admin);

 let discounts:any[]=[];
 let requests:any[]=[pending];

 await page.route('**/api/v1/commerce/products?**',r=>json(r,{items:[product],page:1,limit:100,hasMore:false}));
 await page.route('**/api/v1/commerce/entitlements?**',r=>json(r,{items:[],page:1,limit:50,hasMore:false}));
 await page.route('**/api/v1/commerce/admin/discounts?**',r=>json(r,{items:discounts,page:1,limit:50,hasMore:false}));
 await page.route('**/api/v1/commerce/admin/payment-requests?**',r=>json(r,{items:requests,page:1,limit:50,hasMore:false}));

 await page.route('**/api/v1/commerce/admin/discounts',async r=>{
   expect(r.request().method()).toBe('POST');
   const body=JSON.parse(r.request().postData()||'{}');
   expect(body).toMatchObject({
     code:'SAVE20',discountType:'percentage',percentageBps:2000,status:'active',
     scopes:[{scopeType:'all',productId:'',productType:''}]
   });
   const discount={
     id:'discount-2',...body,reservedCount:0,redeemedCount:0,revision:1,
     createdAt:'2026-09-26T11:02:00Z',updatedAt:'2026-09-26T11:02:00Z'
   };
   discounts=[discount];
   return json(r,{discount},201);
 });

 await page.route('**/api/v1/commerce/admin/payment-requests/payment-1/review',async r=>{
   expect(r.request().method()).toBe('PATCH');
   const body=JSON.parse(r.request().postData()||'{}');
   expect(body.expectedRevision).toBe(1);
   expect(body.status).toBe('paid');
   expect(body.approvalEvidence.length).toBeGreaterThanOrEqual(6);
   requests=[];
   return json(r,{request:{...pending,status:'paid',revision:2,paidAt:'2026-09-26T11:03:00Z',reviewedBy:'admin-1',reviewedAt:'2026-09-26T11:03:00Z',reviewerNotes:body.reviewerNotes,approvalEvidence:body.approvalEvidence}});
 });

 page.on('dialog',dialog=>dialog.accept('bank-ref-7788'));

 await page.goto('/admin-dashboard/commerce');
 await expect(page.getByRole('heading',{name:'المنتجات والخصومات وطلبات الدفع'})).toBeVisible();

 await page.getByLabel('كود الخصم الإداري').fill('SAVE20');
 await page.getByLabel('نسبة الخصم').fill('20');
 await page.getByRole('button',{name:'إنشاء الخصم'}).click();
 await expect(page.getByText('تم إنشاء كود الخصم من Commerce.')).toBeVisible();
 await expect(page.getByText('SAVE20')).toBeVisible();

 const approve=page.getByRole('button',{name:'اعتماد',exact:true});
 await expect(approve).toBeVisible();
 await approve.click();
 await expect(page.getByText('تم اعتماد الطلب وإنشاء صلاحية الوصول من الخادم.')).toBeVisible();
 await expect(page.getByText('لا توجد طلبات معلقة.')).toBeVisible();
});
