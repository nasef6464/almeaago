import{expect,test,type Page,type Route}from'@playwright/test';

const admin={id:'admin-1',email:'admin@example.com',name:'مدير المنصة',status:'active',avatarUrl:'',emailVerified:true,role:'admin',roles:['admin']};
const student={id:'student-1',email:'student@example.com',name:'طالب',status:'active',avatarUrl:'',emailVerified:true,role:'student',roles:['student']};

function json(route:Route,body:unknown,status=200){return route.fulfill({status,contentType:'application/json',body:JSON.stringify(body)})}
async function auth(page:Page,user:typeof admin|typeof student){
 await page.route('**/api/v1/auth/me',route=>json(route,{user}));
 await page.route('**/api/v1/auth/csrf',route=>json(route,{csrfToken:'csrf-ai'}));
}

test('admin manages non-secret AI provider policy and inspects usage evidence',async({page})=>{
 await auth(page,admin);
 let patchBody:any=null;let patchCSRF='';let testCSRF='';
 const provider={provider:'gemini',enabled:false,model:'gemini-2.5-flash',baseUrl:'',priority:10,maxOutputTokens:450,revision:1,secretConfigured:true,health:{consecutiveFailures:0,openUntil:null,lastError:'',lastSuccessAt:null,lastFailureAt:null,updatedAt:'2026-09-27T08:00:00Z'},createdAt:'2026-09-27T08:00:00Z',updatedAt:'2026-09-27T08:00:00Z'};
 await page.route('**/api/v1/ai/admin/providers',async route=>{
  if(route.request().method()==='GET')return json(route,{items:[provider]});
  patchCSRF=route.request().headers()['x-csrf-token']||'';
  patchBody=route.request().postDataJSON();
  return json(route,{provider:{...provider,...patchBody,revision:2,secretConfigured:true}});
 });
 await page.route('**/api/v1/ai/admin/interactions?**',route=>json(route,{items:[{id:'interaction-1',userId:'student-1',audience:'student',endpoint:'/ai/question-assistant',capability:'question_tutor',provider:'gemini',model:'gemini-2.5-flash',status:'success',usedFallback:false,cacheHit:false,questionId:'q-1',questionVersion:3,reviewCardId:'card-1',promptVersion:'question_tutor.v1',latencyMs:120,inputTokens:20,outputTokens:10,totalTokens:30,usageEstimated:false,responseLength:80,errorCategory:'',metadata:{helpLevel:'hint'},retentionUntil:'2026-10-27T08:00:00Z',createdAt:'2026-09-27T08:00:00Z'}],page:1,limit:50,hasMore:false}));
 await page.route('**/api/v1/ai/admin/providers/gemini',async route=>{
  patchCSRF=route.request().headers()['x-csrf-token']||'';
  patchBody=route.request().postDataJSON();
  return json(route,{provider:{...provider,...patchBody,revision:2,secretConfigured:true}});
 });
 await page.route('**/api/v1/ai/admin/providers/gemini/test',route=>{
  testCSRF=route.request().headers()['x-csrf-token']||'';
  return json(route,{result:{text:'OK',provider:'gemini',model:'gemini-2.5-flash',usage:{inputTokens:2,outputTokens:1,totalTokens:3,cachedTokens:0,estimated:false}}});
 });

 await page.goto('/admin-dashboard/ai');
 await expect(page.getByRole('heading',{name:'إدارة المساعد الذكي'})).toBeVisible();
 await expect(page.getByText('Runtime configured')).toBeVisible();
 await expect(page.getByText(/tokens 30/)).toBeVisible();

 await page.getByLabel('تفعيل Gemini').check();
 await page.getByLabel('حد إخراج Gemini').fill('500');
 await page.getByRole('button',{name:'حفظ'}).click();
 await expect.poll(()=>patchCSRF).toBe('csrf-ai');
 expect(patchBody).toMatchObject({enabled:true,model:'gemini-2.5-flash',priority:10,maxOutputTokens:500,expectedRevision:1});
 expect(patchBody).not.toHaveProperty('apiKey');
 expect(patchBody).not.toHaveProperty('secret');
 await expect(page.getByText('تم حفظ إعدادات Gemini.')).toBeVisible();

 await page.getByRole('button',{name:'اختبار المزود'}).click();
 await expect.poll(()=>testCSRF).toBe('csrf-ai');
 await expect(page.getByText(/اختبار Gemini نجح/)).toBeVisible();
});

test('student question assistant is scoped to owned review card and can return trusted fallback',async({page})=>{
 await auth(page,student);
 await page.setViewportSize({width:390,height:844});
 await page.route('**/api/v1/taxonomy/bootstrap?phase=core',route=>json(route,{paths:[{id:'path-1',name:'القدرات',slug:'abilities',status:'active'}],subjects:[{id:'subject-1',pathId:'path-1',name:'كمي',slug:'quant',status:'active'}]}));
 await page.route('**/api/v1/review/library?**',route=>json(route,{items:[{card:{cardId:'card-1',questionId:'q-1',questionVersion:3,pathId:'path-1',subjectId:'subject-1',reviewType:'error_recovery',savedForReview:false,savedAt:null,hasMistake:true,nextReviewAt:'2026-09-27T09:00:00Z',skillIds:['skill-1'],updatedAt:'2026-09-27T08:00:00Z'},question:{id:'q-1',version:3,type:'mcq',text:'٢ + ٢ = ؟',imageAssetId:'',imageAlt:'',optionsEmbeddedInImage:false,videoUrl:'',difficulty:'easy',correctOptionIndex:1,explanation:'نجمع العددين فنحصل على أربعة.',hint:'اجمع العددين.',solvingStrategy:'جمع مباشر',options:[{index:0,text:'٣',assetId:''},{index:1,text:'٤',assetId:''}]}}],page:1,limit:20,hasMore:false}));
 await page.route('**/api/v1/mastery/progress?**',route=>json(route,{items:[],page:1,limit:8,hasMore:false}));
 await page.route('**/api/v1/mastery/next-action?**',route=>json(route,{item:null}));
 await page.route('**/api/v1/mastery/goals?**',route=>json(route,{items:[],page:1,limit:20,hasMore:false}));
 let assistBody:any=null;let assistCSRF='';
 await page.route('**/api/v1/ai/question-assistant',route=>{
  assistBody=route.request().postDataJSON();
  assistCSRF=route.request().headers()['x-csrf-token']||'';
  return json(route,{result:{text:'اجمع العددين.',helpLevel:'hint',provider:'none',model:'trusted-fallback',usedFallback:true,cacheHit:false,promptVersion:'question_tutor.v1'}});
 });

 await page.goto('/review?pathId=path-1&subjectId=subject-1');
 await expect(page.getByText('٢ + ٢ = ؟')).toBeVisible();
 await expect(page.getByTestId('question-assistant')).toBeVisible();
 await page.getByTestId('question-assistant').getByRole('button',{name:'تلميح',exact:true}).click();
 await expect.poll(()=>assistCSRF).toBe('csrf-ai');
 expect(assistBody).toEqual({reviewCardId:'card-1',helpLevel:'hint',message:''});
 await expect(page.getByText('شرح موثوق احتياطي')).toBeVisible();
 await expect(page.getByTestId('question-assistant').getByText('اجمع العددين.',{exact:true})).toBeVisible();
 await page.screenshot({path:'test-results/ai-question-assistant-mobile.png',fullPage:true});
});
