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
 await page.route('**/api/v1/commerce/access-codes/redeem',async r=>{
   const body=JSON.parse(r.request().postData()||'{}');expect(body).toEqual({code:'ACCESS-2026'});expect(r.request().headers()['x-csrf-token']).toBe('csrf');
   return json(r,{accessCode:{id:'code-1',code:'ACCESS-2026',productId:'package-1',schoolId:'',status:'active',maxUses:10,currentUses:1,startsAt:'2026-09-01T00:00:00Z',expiresAt:'2026-12-01T00:00:00Z',revision:1,createdAt:'2026-09-01T00:00:00Z',updatedAt:'2026-09-26T00:00:00Z'},entitlement:{id:'ent-1'}});
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
 await page.getByTestId('payment-access-code-input').fill('access-2026');
 await page.getByTestId('payment-redeem-access-code').click();
 await expect(page.getByText('تم تفعيل كود الوصول. يمكنك العودة للمحتوى الآن.')).toBeVisible();
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
 await page.route('**/api/v1/commerce/admin/access-codes?**',r=>json(r,{items:[],page:1,limit:50,hasMore:false}));
 await page.route('**/api/v1/commerce/admin/revenue?**',r=>json(r,{items:[],page:1,limit:50,hasMore:false}));

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

test('admin records factual trainer revenue allocation and payout evidence',async({page})=>{
 await auth(page,admin);
 let entry:any={id:'rev-1',paymentRequestId:'payment-paid-1',productId:'product-course-1',productType:'course',courseId:'course-1',buyerUserId:'student-1',trainerUserId:'trainer-1',revenueSharePercentage:35,grossAmountMinor:12000,discountAmountMinor:1200,paidAmountMinor:10800,currency:'SAR',providerFeeMinor:null,trainerShareMinor:null,platformShareMinor:null,allocationStatus:'pending',payoutStatus:'pending',allocationEvidence:'',allocatedBy:'',allocatedAt:null,payoutEvidence:'',paidBy:'',payoutPaidAt:null,revision:1,createdAt:'2026-09-26T11:05:00Z',updatedAt:'2026-09-26T11:05:00Z'};

 await page.route('**/api/v1/commerce/products?**',r=>json(r,{items:[product],page:1,limit:100,hasMore:false}));
 await page.route('**/api/v1/commerce/entitlements?**',r=>json(r,{items:[],page:1,limit:50,hasMore:false}));
 await page.route('**/api/v1/commerce/admin/discounts?**',r=>json(r,{items:[],page:1,limit:50,hasMore:false}));
 await page.route('**/api/v1/commerce/admin/payment-requests?**',r=>json(r,{items:[],page:1,limit:50,hasMore:false}));
 await page.route('**/api/v1/commerce/admin/access-codes?**',r=>json(r,{items:[],page:1,limit:50,hasMore:false}));
 await page.route('**/api/v1/commerce/admin/revenue?**',r=>json(r,{items:[entry],page:1,limit:50,hasMore:false}));
 await page.route('**/api/v1/commerce/admin/revenue/rev-1/allocation',async r=>{
   const body=JSON.parse(r.request().postData()||'{}');
   expect(body).toEqual({expectedRevision:1,providerFeeMinor:300,trainerShareMinor:3500,platformShareMinor:7000,evidence:'settlement-7788'});
   entry={...entry,providerFeeMinor:300,trainerShareMinor:3500,platformShareMinor:7000,allocationStatus:'allocated',allocationEvidence:body.evidence,allocatedBy:'admin-1',allocatedAt:'2026-09-26T11:06:00Z',revision:2};
   return json(r,{entry});
 });
 await page.route('**/api/v1/commerce/admin/revenue/rev-1/payout',async r=>{
   const body=JSON.parse(r.request().postData()||'{}');
   expect(body).toEqual({expectedRevision:2,evidence:'payout-7788'});
   entry={...entry,payoutStatus:'paid',payoutEvidence:body.evidence,paidBy:'admin-1',payoutPaidAt:'2026-09-26T11:07:00Z',revision:3};
   return json(r,{entry});
 });

 const answers=['300','3500','7000','settlement-7788','payout-7788'];
 page.on('dialog',dialog=>dialog.accept(answers.shift()||''));
 await page.goto('/admin-dashboard/commerce');
 await expect(page.getByText('سجل الإيراد الفعلي وحصص المدربين')).toBeVisible();
 await expect(page.getByText('نسبة السياسة 35%')).toBeVisible();
 await page.getByRole('button',{name:'تسجيل التسوية الفعلية'}).click();
 await expect(page.getByText('تم تسجيل التسوية الفعلية بدون تقدير آلي للإيراد.')).toBeVisible();
 await expect(page.getByText(/^رسوم المزود .* حصة المدرب .* حصة المنصة/)).toBeVisible();
 await page.getByRole('button',{name:'تسجيل صرف المدرب'}).click();
 await expect(page.getByText('تم تسجيل صرف حصة المدرب في السجل.')).toBeVisible();
 await expect(page.getByText('الصرف paid', {exact:false})).toBeVisible();
 await page.screenshot({path:'test-results/commerce-revenue-ledger.png',fullPage:true});
});

test('learner receives only a trusted Tap redirect after server-authoritative checkout',async({page})=>{
 await auth(page,student);
 await page.route('**/api/v1/commerce/catalog/products/product-course-1',r=>json(r,{product}));
 await page.route('**/api/v1/commerce/checkout/requests?**',r=>json(r,{items:[],page:1,limit:20,hasMore:false}));
 await page.route('**/api/v1/commerce/checkout/requests',async r=>{
   const body=JSON.parse(r.request().postData()||'{}');
   expect(body).toMatchObject({productId:'product-course-1',discountCode:'',paymentMethod:'card'});
   expect(body).not.toHaveProperty('amount');
   expect(body).not.toHaveProperty('amountMinor');
   expect(body).not.toHaveProperty('currency');
   return json(r,{request:{
     ...pending,discountId:'',discountCode:'',discountAmountMinor:0,finalAmountMinor:12000,
     gatewayMode:'payment_link',providerCode:'tap',providerSessionId:'chg_test_1',
     providerRedirectUrl:'https://tap.example/pay/chg_test_1',providerSessionStatus:'initiated',
     idempotencyKey:body.idempotencyKey
   }},201);
 });
 await page.goto('/checkout?productId=product-course-1');
 await page.getByRole('button',{name:'إنشاء طلب دفع آمن'}).click();
 const link=page.getByTestId('payment-provider-redirect');
 await expect(link).toBeVisible();
 await expect(link).toHaveAttribute('href','https://tap.example/pay/chg_test_1');
 await expect(page.getByText('لن يتم منح الوصول من الواجهة.',{exact:false})).toBeVisible();
});

