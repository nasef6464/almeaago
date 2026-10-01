import{expect,test,type Page,type Route}from'@playwright/test';

const admin={id:'admin-1',email:'admin@example.com',name:'مدير المنصة',status:'active',avatarUrl:'',emailVerified:true,role:'admin',roles:['admin']};
const student={id:'student-1',email:'student@example.com',name:'سارة',status:'active',avatarUrl:'',emailVerified:true,role:'student',roles:['student']};
const parent={id:'parent-1',email:'parent@example.com',name:'ولي أمر',status:'active',avatarUrl:'',emailVerified:true,role:'parent',roles:['parent']};
function json(route:Route,body:unknown,status=200){return route.fulfill({status,contentType:'application/json',body:JSON.stringify(body)})}
async function auth(page:Page,user:typeof admin|typeof student|typeof parent){
 await page.route('**/api/v1/auth/me',route=>json(route,{user}));
 await page.route('**/api/v1/auth/csrf',route=>json(route,{csrfToken:'csrf-token'}));
}
async function fakeNotificationStream(page:Page){
 await page.addInitScript(()=>{
  class FakeEventSource{
   listeners:Record<string,Array<()=>void>>={};
   constructor(){(window as any).__notificationStream=this;setTimeout(()=>this.emit('connected'),0)}
   addEventListener(type:string,listener:()=>void){(this.listeners[type]??=[]).push(listener)}
   removeEventListener(type:string,listener:()=>void){this.listeners[type]=(this.listeners[type]||[]).filter(row=>row!==listener)}
   emit(type:string){for(const listener of this.listeners[type]||[])listener()}
   close(){}
  }
  Object.defineProperty(window,'EventSource',{configurable:true,value:FakeEventSource});
  (window as any).__emitNotification=()=>((window as any).__notificationStream as FakeEventSource|undefined)?.emit('notification');
 });
}

test('admin creates notification template and bounded in-app campaign',async({page})=>{
 await auth(page,admin);
 let sentPayload:any=null;
 let templatePayload:any=null;
 await page.route('**/api/v1/notifications/admin/templates?**',route=>json(route,{items:[],page:1,limit:50,hasMore:false}));
 await page.route('**/api/v1/notifications/admin/deliveries?**',route=>json(route,{items:[],page:1,limit:50,hasMore:false}));
 await page.route('**/api/v1/notifications/admin/templates',async route=>{
  if(route.request().method()==='POST'){templatePayload=route.request().postDataJSON();return json(route,{template:{id:'tpl-1',...templatePayload,revision:1,createdAt:'2026-09-27T00:00:00Z',updatedAt:'2026-09-27T00:00:00Z'}})}
  return route.fallback();
 });
 await page.route('**/api/v1/notifications/admin/send',async route=>{
  sentPayload=route.request().postDataJSON();
  return json(route,{campaign:{campaignId:'campaign-1',recipients:1,created:1,pending:0,sent:1},maxRecipients:10000},202);
 });

 await page.goto('/admin-dashboard/notifications');
 await expect(page.getByRole('heading',{name:'مركز الإشعارات'})).toBeVisible();
 await page.getByLabel('مفتاح القالب').fill('exam.reminder');
 await page.getByLabel('اسم القالب').fill('تذكير اختبار');
 await page.getByLabel('عنوان القالب').fill('تذكير {{name}}');
 await page.getByLabel('محتوى القالب').fill('موعد الاختبار قريب');
 await page.getByLabel('متغيرات القالب').fill('name');
 await page.getByRole('button',{name:'حفظ القالب'}).click();
 await expect.poll(()=>templatePayload?.key).toBe('exam.reminder');

 await page.getByLabel('عنوان الحملة').fill('تنبيه للطلاب');
 await page.getByLabel('محتوى الحملة').fill('ابدأ استعدادك الآن');
 await page.getByRole('button',{name:'طالب'}).click();
 await page.getByRole('button',{name:'إنشاء الحملة'}).click();
 await expect.poll(()=>sentPayload?.roles?.[0]).toBe('student');
 expect(sentPayload.channels).toEqual(['in_app']);
 expect(sentPayload).not.toHaveProperty('recipientEmail');
 expect(sentPayload).not.toHaveProperty('recipientPhone');
 await expect(page.getByText(/تم إنشاء الحملة لـ 1 مستلم/)).toBeVisible();
 await expect(page.getByText(/10,000 مستلم/)).toBeVisible();
});

test('user inbox is self-scoped, realtime-refreshed and read mutations require csrf',async({page})=>{
 await fakeNotificationStream(page);
 await auth(page,student);
 let readOneHeader='';let readAllHeader='';let unread=2;
 let rows=[{id:'delivery-1',campaignId:'campaign-1',templateKey:'',channel:'in_app',status:'sent',title:'نتيجتك جاهزة',subject:'',body:'راجع المهارة الأضعف اليوم',recipientUserId:'student-1',provider:'internal',providerMessageId:'',failureReason:'',retryCount:0,nextAttemptAt:null,sentAt:'2026-09-27T00:00:00Z',readAt:null,createdAt:'2026-09-27T00:00:00Z',updatedAt:'2026-09-27T00:00:00Z'}];
 await page.route('**/api/v1/notifications/me?page=1&limit=50',route=>json(route,{items:rows,page:1,limit:50,hasMore:false}));
 await page.route('**/api/v1/notifications/me/unread-count',route=>json(route,{unreadCount:unread}));
 await page.route('**/api/v1/notifications/delivery-1/read',route=>{readOneHeader=route.request().headers()['x-csrf-token']||'';return json(route,{notification:{...rows[0],readAt:'2026-09-27T01:00:00Z'}})});
 await page.route('**/api/v1/notifications/me/read-all',route=>{readAllHeader=route.request().headers()['x-csrf-token']||'';return json(route,{modifiedCount:0})});

 await page.goto('/notifications');
 await expect(page.getByRole('heading',{name:'الإشعارات'})).toBeVisible();
 await expect(page.getByText('نتيجتك جاهزة')).toBeVisible();
 await expect(page.getByTestId('notification-live-state')).toContainText('تحديث لحظي');
 rows=[{...rows[0],id:'delivery-2',title:'وصل تحديث جديد',createdAt:'2026-09-27T02:00:00Z'},...rows];
 unread=3;
 await page.evaluate(()=>(window as any).__emitNotification());
 await expect(page.getByText('وصل تحديث جديد')).toBeVisible();
 await expect(page.getByText('3 جديد')).toBeVisible();
 await page.getByText('نتيجتك جاهزة').click();
 await expect.poll(()=>readOneHeader).toBe('csrf-token');
 await expect(page.getByText('2 غير مقروء')).toBeVisible();

 await page.getByRole('button',{name:'تعليم الكل مقروء'}).click();
 await expect.poll(()=>readAllHeader).toBe('csrf-token');
 await expect(page.getByText('0 غير مقروء')).toBeVisible();
});


test('parent explicitly opts into weekly WhatsApp digest without generic consent inference',async({page})=>{
 await fakeNotificationStream(page);
 await auth(page,parent);
 await page.setViewportSize({width:390,height:844});
 let preferenceBody:any=null;let preferenceCSRF='';
 await page.route('**/api/v1/notifications/me?page=1&limit=50',route=>json(route,{items:[],page:1,limit:50,hasMore:false}));
 await page.route('**/api/v1/notifications/me/unread-count',route=>json(route,{unreadCount:0}));
 await page.route('**/api/v1/notifications/me/preferences',async route=>{
  if(route.request().method()==='PATCH'){
   preferenceCSRF=route.request().headers()['x-csrf-token']||'';
   preferenceBody=route.request().postDataJSON();
   return json(route,{preferences:{userId:'parent-1',parentWhatsAppDigestEnabled:true,revision:1,updatedAt:'2026-09-28T05:00:00Z'}});
  }
  return json(route,{preferences:{userId:'parent-1',parentWhatsAppDigestEnabled:false,revision:0,updatedAt:'0001-01-01T00:00:00Z'}});
 });
 await page.goto('/notifications');
 await expect(page.getByText('تقرير ولي الأمر الأسبوعي عبر واتساب')).toBeVisible();
 await expect(page.getByText(/اشتراك اختياري محدد لهذا التقرير فقط/)).toBeVisible();
 await page.getByRole('button',{name:'غير مفعّل — تفعيل'}).click();
 await expect.poll(()=>preferenceCSRF).toBe('csrf-token');
 expect(preferenceBody).toEqual({parentWhatsAppDigestEnabled:true,expectedRevision:0});
 await expect(page.getByRole('button',{name:'مفعّل — إيقاف'})).toBeVisible();
 await page.screenshot({path:'test-results/notifications-parent-whatsapp-opt-in-mobile.png',fullPage:true});
});
