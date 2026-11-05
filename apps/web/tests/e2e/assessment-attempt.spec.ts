import{expect,test,type Page,type Route}from'@playwright/test';
const user={id:'student-1',email:'student@example.com',name:'طالب',status:'active',avatarUrl:'',emailVerified:true,role:'student',roles:['student']};
const attempt={id:'attempt-1',assessmentId:'assessment-1',assessmentVersion:2,attemptNumber:1,status:'in_progress',title:'محاكي كمي',startedAt:'2026-09-26T10:00:00Z',expiresAt:null,submittedAt:null,showProgressBar:true,requireAnswerBeforeNext:false,allowQuestionReview:true,randomizeOptions:false,questions:[{id:'q-1',version:3,sectionId:'',sortOrder:1,points:1,type:'mcq',text:'٢ + ٢ = ؟',imageAssetId:'',imageAlt:'',optionsEmbeddedInImage:false,videoUrl:'',difficulty:'easy',options:[{index:0,text:'٣',assetId:''},{index:1,text:'٤',assetId:''}]}],answers:[]};
function json(r:Route,b:unknown,s=200){return r.fulfill({status:s,contentType:'application/json',body:JSON.stringify(b)})}
async function mock(page:Page){await page.route('**/api/v1/auth/me',r=>json(r,{user}));await page.route('**/api/v1/auth/csrf',r=>json(r,{csrfToken:'csrf'}));await page.route('**/api/v1/assessments/assessment-1/attempts',r=>json(r,{attempt}));await page.route('**/api/v1/assessment-attempts/attempt-1/answers/q-1',r=>json(r,{attempt:{...attempt,answers:[{questionId:'q-1',selectedOptionIndex:1,textAnswer:'',timeSpentSeconds:0,markedForReview:false,lastSavedAt:'2026-09-26T10:01:00Z'}]}}));await page.route('**/api/v1/assessment-attempts/attempt-1/submit',r=>json(r,{result:{attemptId:'attempt-1',score:100,totalQuestions:1,correctAnswers:1,wrongAnswers:0,unanswered:0,passed:true,timeSpentSeconds:12,finalizedAt:'2026-09-26T10:02:00Z'}}))}
test('student starts autosaves submits and sees server result',async({page})=>{await mock(page);await page.setViewportSize({width:390,height:844});await page.goto('/assessments/assessment-1/start');await expect(page.getByRole('heading',{name:'محاكي كمي'})).toBeVisible();await page.getByRole('button',{name:/٤/}).click();await expect(page.getByRole('button',{name:/٤/})).toHaveClass(/border-amber-500/);await page.getByRole('button',{name:'تسليم الاختبار'}).click();await expect(page.getByRole('heading',{name:'تم تسليم الاختبار'})).toBeVisible();await expect(page.getByText('100.0%')).toBeVisible();await page.screenshot({path:'test-results/assessment-attempt-mobile.png',fullPage:true})});

test('student can see and select image-backed options when choices are not embedded in question image', async ({ page }) => {
  await mock(page);
  const image = 'image-asset-1';
  const imageUrl = 'https://cdn.example.test/question.png';
  let mediaLookups = 0;
  await page.route('**/api/v1/media/assets/image-asset-1', route => {
    mediaLookups += 1;
    return json(route, { asset: { id: image, publicUrl: imageUrl, status: 'active', mimeType: 'image/png' } });
  });
  await page.route(imageUrl, route => route.fulfill({ status: 200, contentType: 'image/png', body: Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVQIHWP4z8DwHwAFgAI/ScL/nwAAAABJRU5ErkJggg==', 'base64') }));
  const visualQuestion = {
    ...attempt.questions[0],
    text: 'اختر الشكل الصحيح',
    imageAssetId: image,
    imageAlt: 'صورة السؤال',
    options: [{ index: 0, text: '', assetId: image }, { index: 1, text: '', assetId: image }],
  };
  await page.route('**/api/v1/assessments/assessment-1/attempts', route =>
    json(route, { attempt: { ...attempt, questions: [visualQuestion] } }));
  await page.route('**/api/v1/assessment-attempts/attempt-1/answers/q-1', route =>
    json(route, {
      attempt: {
        ...attempt,
        questions: [visualQuestion],
        answers: [{ questionId: 'q-1', selectedOptionIndex: 1, textAnswer: '', timeSpentSeconds: 0, markedForReview: false, lastSavedAt: '2026-09-26T10:01:00Z' }],
      },
    }));

  for (const width of [390, 820, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    await page.goto('/assessments/assessment-1/start');
    await expect(page.getByRole('img', { name: 'صورة السؤال' })).toBeVisible();
    await expect(page.getByRole('img', { name: 'صورة الاختيار أ' })).toBeVisible();
    await expect(page.getByRole('img', { name: 'صورة الاختيار ب' })).toBeVisible();
    await expect(page.getByRole('img', { name: 'صورة الاختيار ب' })).toHaveAttribute('src', imageUrl);
    await page.getByRole('button', { name: /صورة الاختيار ب/ }).click();
    await expect(page.getByRole('button', { name: /صورة الاختيار ب/ })).toHaveClass(/border-amber-500/);
  }
  expect(mediaLookups).toBeGreaterThan(0);
});


test('student can retry a temporarily unavailable question image without losing the attempt', async ({ page }) => {
  await mock(page);
  let lookups = 0;
  const imageId = 'question-retry-asset';
  const visualQuestion = {
    ...attempt.questions[0],
    imageAssetId: imageId,
    imageAlt: 'صورة السؤال',
  };
  await page.route('**/api/v1/assessments/assessment-1/attempts', route =>
    json(route, { attempt: { ...attempt, questions: [visualQuestion] } }));
  await page.route('**/api/v1/media/assets/question-retry-asset', route => {
    lookups += 1;
    if (lookups === 1) return json(route, { error: 'temporarily_unavailable' }, 503);
    return json(route, {
      asset: {
        id: imageId,
        publicUrl: 'https://cdn.example.test/question-retry.png',
        status: 'active',
        mimeType: 'image/png',
      },
    });
  });
  await page.route('https://cdn.example.test/question-retry.png', route =>
    route.fulfill({
      status: 200,
      contentType: 'image/png',
      body: Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVQIHWP4z8DwHwAFgAI/ScL/nwAAAABJRU5ErkJggg==', 'base64'),
    }));

  await page.goto('/assessments/assessment-1/start');
  await expect(page.getByText('تعذر تحميل صورة السؤال')).toBeVisible();
  await page.getByRole('button', { name: 'إعادة تحميل الصورة' }).click();
  await expect(page.getByRole('img', { name: 'صورة السؤال' })).toHaveAttribute(
    'src', 'https://cdn.example.test/question-retry.png');
  expect(lookups).toBe(2);
  await expect(page.getByRole('heading', { name: 'محاكي كمي' })).toBeVisible();
});
