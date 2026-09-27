import { expect, test, type Page, type Route } from '@playwright/test';

const admin={
  id:'admin-1',email:'admin@example.com',name:'مدير المنصة',status:'active',avatarUrl:'',emailVerified:true,
  role:'admin',roles:['admin'],
};
const teacher={...admin,id:'teacher-1',email:'teacher@example.com',name:'معلم',role:'teacher',roles:['teacher']};

function json(route:Route,body:unknown,status=200){
  return route.fulfill({status,contentType:'application/json',body:JSON.stringify(body)});
}
async function auth(page:Page,user:typeof admin|typeof teacher){
  await page.route('**/api/v1/auth/me',r=>json(r,{user}));
  await page.route('**/api/v1/auth/csrf',r=>json(r,{csrfToken:'csrf-question-bank'}));
}
const taxonomy={
  paths:[{id:'path-1',code:'QDR',name:'القدرات',description:'',sortOrder:1}],
  subjects:[{id:'subject-1',pathId:'path-1',code:'QNT',name:'الكمي',sortOrder:1}],
  skills:[
    {id:'skill-main',subjectId:'subject-1',code:'NUM',name:'الأعداد',description:'',kind:'main',sortOrder:1},
    {id:'skill-sub',subjectId:'subject-1',parentSkillId:'skill-main',code:'NUM-1',name:'النسب',description:'',kind:'sub',sortOrder:1},
  ],
};
function summary(status='draft'){
  return {
    id:'question-1',questionCode:'Q-001',currentVersion:1,workflowStatus:status,ownerType:'platform',ownerId:'',
    pathId:'path-1',subjectId:'subject-1',assignedTeacherId:'',type:'mcq',difficulty:'medium',examType:'',source:'manual',
    year:null,hasImage:true,hasVideo:false,hasExplanation:true,mainSkillId:'skill-main',skillIds:['skill-main'],updatedAt:'2026-09-27T10:00:00Z',
  };
}
function detail(status='draft'){
  return {
    ...summary(status),approvedBy:'',approvedAt:null,reviewerNotes:'',revenueSharePercentage:null,
    version:{version:1,type:'mcq',text:'ما ناتج ٢ + ٢؟',imageAssetId:'asset-1',imageAlt:'صورة سؤال',optionsEmbeddedInImage:false,
      correctOptionIndex:1,explanation:'الإجابة الصحيحة أربعة',hint:'اجمع العددين',solvingStrategy:'',videoUrl:'',
      sourceMeta:{},aiContext:{},voiceExplanation:{},difficulty:'medium',examType:'',source:'manual',year:null,revisionNote:''},
    options:[{index:0,text:'٣',assetId:''},{index:1,text:'٤',assetId:''}],
    skillLinks:[{skillId:'skill-main',relationType:'main'}],
  };
}
async function mockBase(page:Page){
  await page.route('**/api/v1/taxonomy/bootstrap?phase=full',r=>json(r,taxonomy));
  await page.route('**/api/v1/questions/coverage?**',r=>json(r,{
    questionsTotal:1,approved:0,pendingReview:0,unlinked:0,mainSkillCoverage:1,subSkillCoverage:0,
    skills:[{skillId:'skill-main',relationType:'main',questionCount:1}],skillPage:1,skillLimit:50,skillsHasMore:false,
  }));
  await page.route('**/api/v1/questions?**',r=>json(r,{items:[summary()],page:1,limit:50,hasMore:false}));
}

test('admin desktop creates a canonical question with direct media upload and no destructive delete',async({page})=>{
  await auth(page,admin);await mockBase(page);
  let presignCsrf='',completeCsrf='',createCsrf='',uploadPut=false;
  let createBody:any=null;

  await page.route('**/api/v1/media/uploads/presign',async r=>{
    presignCsrf=r.request().headers()['x-csrf-token']||'';
    return json(r,{asset:{id:'asset-new',publicUrl:'https://cdn.example.test/q.webp',mimeType:'image/webp',sizeBytes:4,sha256:'0'.repeat(64),version:1,status:'pending_upload',verifiedAt:null},uploadRequired:true,upload:{url:'https://upload.example.test/object',headers:{'Content-Type':'image/webp'},expiresAt:'2026-09-27T11:00:00Z'}});
  });
  await page.route('https://upload.example.test/object',r=>{uploadPut=r.request().method()==='PUT';return r.fulfill({status:200,body:''})});
  await page.route('**/api/v1/media/uploads/asset-new/complete',r=>{
    completeCsrf=r.request().headers()['x-csrf-token']||'';
    return json(r,{asset:{id:'asset-new',publicUrl:'https://cdn.example.test/q.webp',mimeType:'image/webp',sizeBytes:4,sha256:'0'.repeat(64),version:1,status:'active',verifiedAt:'2026-09-27T10:05:00Z'}});
  });
  await page.route('**/api/v1/questions/',async r=>{
    createCsrf=r.request().headers()['x-csrf-token']||'';
    createBody=r.request().postDataJSON();
    return json(r,{question:{...detail(),id:'question-new',questionCode:'Q-NEW',version:{...detail().version,imageAssetId:'asset-new'}}},201);
  });

  await page.setViewportSize({width:1440,height:1000});
  await page.goto('/admin-dashboard/questions');

  await expect(page.getByRole('heading',{name:'مركز بنك الأسئلة'})).toBeVisible();
  await expect(page.getByText('Q-001')).toBeVisible();
  await expect(page.getByText('إجمالي مطابق')).toBeVisible();
  await expect(page.getByRole('button',{name:/حذف/})).toHaveCount(0);

  await page.getByRole('button',{name:'سؤال جديد'}).click();
  await page.getByLabel('كود السؤال الجديد').fill('Q-NEW');
  await page.getByLabel('مسار السؤال الجديد').selectOption('path-1');
  await page.getByLabel('مادة السؤال الجديد').selectOption('subject-1');
  await page.getByLabel('المهارة الرئيسية للسؤال').selectOption('skill-main');
  await page.getByLabel('المهارة الفرعية للسؤال').selectOption('skill-sub');
  await page.getByLabel('نص السؤال الجديد').fill('ما ناتج ٥ + ٥؟');
  await page.getByLabel('نص الخيار 1').fill('٩');
  await page.getByLabel('نص الخيار 2').fill('١٠');
  await page.getByLabel('الإجابة الصحيحة 2').check();
  await page.getByLabel('شرح السؤال الجديد').fill('الإجابة الصحيحة عشرة');
  await page.getByLabel('وصف صورة السؤال').fill('رسم توضيحي للسؤال');
  await page.getByLabel('ملف صورة السؤال').setInputFiles({name:'q.webp',mimeType:'image/webp',buffer:Buffer.from([1,2,3,4])});
  await page.getByRole('button',{name:'رفع وتحقق'}).click();
  await expect(page.getByText(/Asset: asset-new · active/)).toBeVisible();

  await page.getByRole('button',{name:'حفظ السؤال كمسودة'}).click();
  await expect(page.getByText('تم إنشاء السؤال كمسودة بإصدار أول.')).toBeVisible();

  expect(presignCsrf).toBe('csrf-question-bank');
  expect(completeCsrf).toBe('csrf-question-bank');
  expect(createCsrf).toBe('csrf-question-bank');
  expect(uploadPut).toBe(true);
  expect(createBody.version.imageAssetId).toBe('asset-new');
  expect(createBody.version.skillLinks).toEqual([
    {skillId:'skill-main',relationType:'main'},
    {skillId:'skill-sub',relationType:'sub'},
  ]);

  await page.screenshot({path:'test-results/question-bank-admin-desktop.png',fullPage:true});
});

test('admin review workflow stays version-pinned and csrf protected',async({page})=>{
  await auth(page,admin);await mockBase(page);
  let status='draft';
  const csrf:string[]=[];

  await page.route('**/api/v1/questions/question-1/staff',r=>json(r,{question:detail(status)}));
  await page.route('**/api/v1/questions/question-1/workflow',async r=>{
    csrf.push(r.request().headers()['x-csrf-token']||'');
    const body=r.request().postDataJSON() as {expectedCurrentVersion:number;status:string};
    expect(body.expectedCurrentVersion).toBe(1);
    status=body.status;
    return json(r,{question:detail(status)});
  });

  await page.goto('/admin-dashboard/questions');
  await page.getByRole('button',{name:'فتح'}).click();
  await expect(page.getByText('Q-001 · v1')).toBeVisible();

  await page.getByRole('button',{name:'إرسال للمراجعة'}).click();
  await expect(page.getByText('تم تحديث حالة السؤال إلى «بانتظار المراجعة».')).toBeVisible();
  await page.getByRole('button',{name:'اعتماد'}).click();
  await expect(page.getByText('تم تحديث حالة السؤال إلى «معتمد».')).toBeVisible();
  expect(csrf).toEqual(['csrf-question-bank','csrf-question-bank']);
});

test('admin import requires a successful dry run before write',async({page})=>{
  await auth(page,admin);await mockBase(page);
  const calls:Array<{dryRun:boolean;csrf:string}>=[];
  await page.route('**/api/v1/questions/import-batches',async r=>{
    const body=r.request().postDataJSON() as {dryRun:boolean;batchId:string;items:unknown[]};
    calls.push({dryRun:body.dryRun,csrf:r.request().headers()['x-csrf-token']||''});
    return json(r,body.dryRun?
      {status:'PASS',mode:'DRY_RUN',batchId:body.batchId,requested:1,prepared:1,inserted:0,questionCodes:['QDR-QNT-DOC-P001-Q01'],issues:[],conflicts:[]}:
      {status:'IMPORTED',mode:'WRITE',batchId:body.batchId,requested:1,prepared:1,inserted:1,questionCodes:['QDR-QNT-DOC-P001-Q01'],issues:[],conflicts:[]},
      body.dryRun?200:201);
  });

  await page.goto('/admin-dashboard/questions');
  const commit=page.getByRole('button',{name:'تنفيذ الدفعة المطابقة'});
  await expect(commit).toBeDisabled();

  await page.getByLabel('معرف دفعة الاستيراد').fill('BATCH_2026_001');
  await page.getByLabel('JSON عناصر الاستيراد').fill(JSON.stringify([{questionCode:'QDR-QNT-DOC-P001-Q01',version:{}}]));
  await page.getByRole('button',{name:'فحص جاف'}).click();
  await expect(page.getByText('اكتمل الفحص الجاف للدفعة.')).toBeVisible();
  await expect(commit).toBeEnabled();

  await commit.click();
  await expect(page.getByText('تم تنفيذ دفعة الاستيراد بعد الفحص الجاف.')).toBeVisible();
  expect(calls).toEqual([
    {dryRun:true,csrf:'csrf-question-bank'},
    {dryRun:false,csrf:'csrf-question-bank'},
  ]);
});

test('teacher mobile gets bounded authoring workspace without admin import controls',async({page})=>{
  await auth(page,teacher);await mockBase(page);
  await page.setViewportSize({width:390,height:844});
  await page.goto('/admin-dashboard/questions');

  await expect(page.getByRole('heading',{name:'مركز بنك الأسئلة'})).toBeVisible();
  await expect(page.getByText('Q-001')).toBeVisible();
  await expect(page.getByText('استيراد إداري بفحص جاف أولًا')).toHaveCount(0);
  await expect(page.getByRole('button',{name:'سؤال جديد'})).toBeVisible();
  await page.screenshot({path:'test-results/question-bank-teacher-mobile.png',fullPage:true});
});
