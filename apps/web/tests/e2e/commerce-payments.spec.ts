import{expect,test,type Page,type Route}from'@playwright/test';

const student={id:'student-1',email:'student@example.com',name:'طالب',status:'active',avatarUrl:'',emailVerified:true,role:'student',roles:['student']};
const admin={id:'admin-1',email:'admin@example.com',name:'مدير',status:'active',avatarUrl:'',emailVerified:true,role:'admin',roles:['admin']};
function json(r:Route,b:unknown,s=200){return r.fulfill({status:s,contentType:'application/json',body:JSON.stringify(b)})}
async function auth(page:Page,user:typeof student|typeof admin){await page.route('**/api/v1/auth/me',r=>json(r,{user}));await page.route('**/api/v1/auth/csrf',r=>json(r,{csrfToken:'csrf'}));}

test('student checkout uses server quote and never posts client price',async({page})=>{
 await auth(page,student);await page.setViewportSize({width:390,height:844});
 await page.route('**/api/v1/learning-spaces/courses/course-1',r=>json(r,{course:{id:'course-1',title:'دورة مدفوعة',description:'',instructorName:'فريق المنصة',durationMinutes:20,level:'beginner',thumbnailAssetId:'',dripContentEnabled:false,certificateEnabled:false,access:{allowed:false,configured:true,reason:'paid_required',productId:'product-1'},modules:[{id:'m-1',title:'الوحدة',description:'',sortOrder:1,lessons:[{id:'paid-1',title:'درس مدفوع',description:'',type:'text',durationSeconds:0,isLocked:false,isPreview:false,commerceLocked:true,sortOrder:1}]}]}}));
 await page.route('**/api/v1/commerce/checkout/quote?**',r=>{const u=new URL(r.request().url());const discounted=u.searchParams.get('discountCode')==='SAVE10';return json(r,{quote:{productId:'product-1',productName:'دورة مدفوعة',productType:'course',courseId:'course-1',productRevision:2,originalAmountMinor:10000,discountCode:discounted?'SAVE10':'',discountAmountMinor:discounted?1000:0,finalAmountMinor:discounted?9000:10000,currency:'SAR'}})});
 let posted:any=null;
 await page.route('**/api/v1/commerce/payment-requests',async r=>{posted=JSON.parse(r.request().postData()||'{}');return json(r,{request:{id:'pay-1',userId:'student-1',productId:'product-1',productRevision:2,productName:'دورة مدفوعة',productType:'course',originalAmountMinor:10000,discountAmountMinor:1000,finalAmountMinor:9000,currency:'SAR',discountCodeId:'d-1',discountCode:'SAVE10',paymentMethod:'transfer',providerCode:'transfer',gatewayMode:'manual_review',paymentCountry:'SA',transferReference:'TRX-123',walletNumber:'',notes:'',status:'pending',reviewerNotes:'',approvalEvidence:'',reviewedBy:'',reviewedAt:null,providerTransactionId:'',providerEventId:'',paidAt:null,idempotencyKey:posted?.idempotencyKey||'key',revision:1,createdAt:'2026-09-26T10:00:00Z',updatedAt:'2026-09-26T10:00:00Z'}},201)});
 await page.goto('/learning/courses/course-1');
 await page.getByRole('link',{name:'طلب شراء الدورة'}).click();
 await expect(page.getByRole('heading',{name:'إتمام طلب الشراء'})).toBeVisible();
 await page.getByLabel('كود الخصم').fill('SAVE10');await page.getByRole('button',{name:'تطبيق'}).click();
 await expect(page.getByText(/90/)).toBeVisible();
 await page.getByRole('button',{name:'تحويل'}).click();await page.getByLabel('مرجع التحويل').fill('TRX-123');
 await page.getByRole('button',{name:'إنشاء طلب الدفع'}).click();
 await expect(page.getByRole('heading',{name:'تم إنشاء طلب الدفع'})).toBeVisible();
 expect(posted.productId).toBe('product-1');expect(posted.discountCode).toBe('SAVE10');expect(posted.paymentMethod).toBe('transfer');
 expect(posted.originalAmountMinor).toBeUndefined();expect(posted.finalAmountMinor).toBeUndefined();expect(posted.currency).toBeUndefined();expect(posted.priceMinor).toBeUndefined();
 await page.screenshot({path:'test-results/commerce-checkout-mobile.png',fullPage:true});
});

test('admin creates discount and approves pending payment with evidence',async({page})=>{
 await auth(page,admin);
 const product={id:'product-1',code:'COURSE-1',productType:'course',name:'دورة مدفوعة',description:'',status:'active',accessMode:'paid',priceMinor:10000,currency:'SAR',courseId:'course-1',isVisible:true,revision:2,createdAt:'2026-09-26T09:00:00Z',updatedAt:'2026-09-26T09:00:00Z'};
 const request={id:'pay-1',userId:'student-1',productId:'product-1',productRevision:2,productName:'دورة مدفوعة',productType:'course',originalAmountMinor:10000,discountAmountMinor:0,finalAmountMinor:10000,currency:'SAR',discountCodeId:'',discountCode:'',paymentMethod:'transfer',providerCode:'transfer',gatewayMode:'manual_review',paymentCountry:'SA',transferReference:'TRX-1',walletNumber:'',notes:'',status:'pending',reviewerNotes:'',approvalEvidence:'',reviewedBy:'',reviewedAt:null,providerTransactionId:'',providerEventId:'',paidAt:null,idempotencyKey:'key-1',revision:1,createdAt:'2026-09-26T10:00:00Z',updatedAt:'2026-09-26T10:00:00Z'};
 await page.route('**/api/v1/commerce/products?**',r=>json(r,{items:[product],page:1,limit:100,hasMore:false}));
 await page.route('**/api/v1/commerce/entitlements?**',r=>json(r,{items:[],page:1,limit:50,hasMore:false}));
 await page.route('**/api/v1/commerce/payment-requests?**',r=>json(r,{items:[request],page:1,limit:50,hasMore:false}));
 let discounts:any[]=[];
 await page.route('**/api/v1/commerce/discount-codes?**',r=>json(r,{items:discounts,page:1,limit:50,hasMore:false}));
 await page.route('**/api/v1/commerce/discount-codes',async r=>{const body=JSON.parse(r.request().postData()||'{}');expect(body).toMatchObject({code:'SAVE10',type:'percentage',value:10,currency:'SAR',status:'active'});discounts=[{id:'d-1',...body,currentRedemptions:0,revision:1,createdAt:'2026-09-26T10:00:00Z',updatedAt:'2026-09-26T10:00:00Z'}];return json(r,{discount:discounts[0]},201)});
 let reviewBody:any=null;
 await page.route('**/api/v1/commerce/payment-requests/pay-1/review',async r=>{reviewBody=JSON.parse(r.request().postData()||'{}');return json(r,{request:{...request,status:'approved',revision:2}})});
 await page.goto('/admin-dashboard/commerce');
 await page.getByLabel('كود الخصم الإداري').fill('SAVE10');await page.getByRole('button',{name:'إنشاء الخصم'}).click();
 await expect(page.getByText('SAVE10')).toBeVisible();
 page.once('dialog',dialog=>dialog.accept('receipt verified'));
 await page.getByRole('button',{name:'اعتماد'}).click();
 expect(reviewBody).toMatchObject({expectedRevision:1,status:'approved',approvalEvidence:'receipt verified'});
});
