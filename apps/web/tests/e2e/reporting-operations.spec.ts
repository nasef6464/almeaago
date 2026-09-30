import{expect,test,type Page,type Route}from'@playwright/test';

const admin={id:'admin-1',email:'admin@example.com',name:'مدير المنصة',status:'active',avatarUrl:'',emailVerified:true,role:'admin',roles:['admin']};
const student={id:'student-1',email:'student@example.com',name:'سارة',status:'active',avatarUrl:'',emailVerified:true,role:'student',roles:['student']};

function json(route:Route,body:unknown,status=200){return route.fulfill({status,contentType:'application/json',body:JSON.stringify(body)})}
async function auth(page:Page,user:typeof admin|typeof student){await page.route('**/api/v1/auth/me',route=>json(route,{user}))}

test('student report is self-scoped, bounded and exposes no answer-level data',async({page})=>{
 await auth(page,student);
 await page.setViewportSize({width:390,height:844});
 await page.route('**/api/v1/taxonomy/bootstrap?phase=core',route=>json(route,{paths:[{id:'path-1',code:'QDR',name:'القدرات',description:'',sortOrder:1}],subjects:[{id:'subject-1',pathId:'path-1',code:'QNT',name:'الكمي',sortOrder:1}]}));
 let lastOverviewUrl='';
 await page.route('**/api/v1/reports/overview**',route=>{lastOverviewUrl=route.request().url();return json(route,{
  scope:{kind:'student',studentCount:1,sampledStudentCount:1,isTruncated:false,limits:{students:500,results:2000,attempts:3000},canDetail:true,canExport:true},
  assessment:{resultCount:3,sampledResultCount:3,resultsTruncated:false,attemptCount:3,sampledAttemptCount:3,attemptsTruncated:false,averageScore:76.5,passed:2,failed:1,passRate:66.667},
  weakestSkills:[{skillId:'skill-1',skillName:'النسبة والتناسب',evidenceCount:5,affectedStudents:1,mastery:40}],
 })});
 let lastExportUrl='';
 await page.route('**/api/v1/reports/results.csv**',route=>{lastExportUrl=route.request().url();return route.fulfill({status:200,contentType:'text/csv',body:'attempt_id,score\nattempt-1,78\n'})});
 await page.route('**/api/v1/reports/results?**',route=>json(route,{items:[{
  attemptId:'attempt-1',studentId:'student-1',studentName:'سارة',assessmentId:'assessment-1',assessmentVersion:2,
  title:'اختبار الكمي',pathId:'path-1',subjectId:'subject-1',score:78,passed:true,correctAnswers:8,wrongAnswers:2,
  unanswered:0,timeSpentSeconds:420,finalizedAt:'2026-09-27T08:00:00Z',
 }],page:1,limit:20,total:1,hasMore:false}));

 await page.goto('/reports');
 await expect(page.getByRole('heading',{name:'تقارير الأداء'})).toBeVisible();
 await page.getByLabel('مسار التقرير').selectOption('path-1');
 await page.getByLabel('مادة التقرير').selectOption('subject-1');
 await expect.poll(()=>lastOverviewUrl).toContain('pathId=path-1');
 await expect.poll(()=>lastOverviewUrl).toContain('subjectId=subject-1');
 await expect(page.getByText('النسبة والتناسب')).toBeVisible();
 await expect(page.getByText('اختبار الكمي')).toBeVisible();
 await expect(page.getByText('78%')).toBeVisible();
 await expect(page.locator('body')).not.toContainText('correctOptionIndex');
 await expect(page.locator('body')).not.toContainText('answerKey');
 await expect(page.getByText('مفتاح الإجابة',{exact:true})).toHaveCount(0);
 await page.getByText('فترة مخصصة',{exact:true}).click();
 await page.getByLabel('بداية فترة التقرير').fill('2026-09-01');
 await page.getByLabel('نهاية فترة التقرير').fill('2026-09-28');
 await expect.poll(()=>lastOverviewUrl).toContain('dateFrom=2026-09-01');
 await expect.poll(()=>lastOverviewUrl).toContain('dateTo=2026-09-28');
 await expect(page.getByText(/الفترة المطبقة/)).toBeVisible();
 await page.getByRole('button',{name:'CSV'}).click();
 await expect.poll(()=>lastExportUrl).toContain('dateFrom=2026-09-01');
 await expect.poll(()=>lastExportUrl).toContain('dateTo=2026-09-28');
 await page.screenshot({path:'test-results/reporting-student-mobile.png',fullPage:true});
 await page.setViewportSize({width:820,height:1180});
 await expect(page.getByRole('heading',{name:'تقارير الأداء'})).toBeVisible();
 await expect(page.getByText('المهارات التي تبدأ بها')).toBeVisible();
 await page.screenshot({path:'test-results/reporting-student-tablet.png',fullPage:true});
});

test('admin operations center exposes evidence gaps instead of claiming release proof',async({page})=>{
 await auth(page,admin);
 await page.route('**/api/v1/operations/readiness',route=>json(route,{
  checkedAt:'2026-09-27T08:30:00Z',status:'ready_with_notes',
  dependencies:{postgres:true,redis:true},
  integrations:[
   {id:'r2',configured:true,required:false,detail:'Cloudflare R2 media storage'},
   {id:'tap',configured:false,required:false,detail:'Tap payment provider'},
  ],
  counts:{notificationPending:2,notificationRetrying:1,notificationFailed:0,auditBlocked24h:1,auditFailed24h:0,liveClassrooms:2,enabledAiProviders:1},
  releaseIdentity:{environment:'staging',commitSha:'abc123def456',deploymentProvider:'render',proof:'declared',detail:'Runtime declares an exact release SHA; external deployment verification is still required before certification.'},
  releaseEvidence:[
   {id:'release_identity',status:'declared',detail:'Runtime declares an exact release SHA; external deployment verification is still required before certification.'},
   {id:'observability',status:'configured_not_verified',detail:'Observability export is configured, but live event/trace ingestion and alert routing still require external verification.'},
   {id:'backup_restore',status:'external_proof_required',detail:'A dated isolated restore drill with measured RPO/RTO is not recorded by the application.'},
   {id:'performance_load',status:'external_proof_required',detail:'Production-equivalent performance evidence is external.'},
   {id:'governance',status:'external_proof_required',detail:'Repository protection requires external evidence.'},
  ],
  releaseDecision:'internal_ready_external_evidence_pending',
  backupRestoreProof:'external_proof_required',
  backupRestoreDetail:'The application records no verified backup/restore drill yet; deployment infrastructure must supply dated restore evidence.',
 }));
 await page.route('**/api/v1/operations/audit?**',route=>json(route,{
  items:[{id:'audit-1',actorUserId:'admin-1',actorName:'مدير المنصة',action:'commerce.payment.reversal',resourceType:'payment_request',resourceId:'pay-1',status:'success',metadata:{source:'provider_webhook'},createdAt:'2026-09-27T08:00:00Z'}],
  page:1,limit:50,total:1,hasMore:false,blockedCount24h:1,failedCount24h:0,
 }));

 await page.goto('/admin-dashboard/operations');
 await expect(page.getByRole('heading',{name:'مركز العمليات والتدقيق'})).toBeVisible();
 await expect(page.getByText('جاهزية مع ملاحظات خارجية')).toBeVisible();
 await expect(page.getByTestId('backup-restore-proof')).toHaveText('external_proof_required');
 await expect(page.getByText(/no verified backup\/restore drill yet/)).toBeVisible();
 await expect(page.getByText('Tap payment provider')).toBeVisible();
 await expect(page.getByText('غير مثبت',{exact:true})).toBeVisible();
 await expect(page.getByText('commerce.payment.reversal')).toBeVisible();
 await expect(page.getByTestId('release-evidence')).toContainText('abc123def456');
 await expect(page.getByTestId('release-evidence')).toContainText('configured_not_verified');
 await expect(page.getByTestId('release-evidence')).toContainText('internal_ready_external_evidence_pending');
 await expect(page.getByText(/الإجمالي 1/)).toBeVisible();
 await page.screenshot({path:'test-results/operations-admin.png',fullPage:true});
});
