import { test, expect } from '@playwright/test';

test('course admin creates and manages a real placement and it survives reload', async ({ page }) => {
  test.setTimeout(120_000);
  const course = { id:'course-1',pathId:'path-1',subjectId:'sub-1',title:'دورة',workflowStatus:'approved',isPublished:true,isVisible:true,revision:1,level:'beginner',presentation:{},skillIds:['skill-1'] };
  let placement: any = null;
  let creates = 0;
  await page.route('**/api/v1/taxonomy/bootstrap?phase=full', r => r.fulfill({json:{paths:[{id:'path-1',name:'مسار'}],subjects:[{id:'sub-1',pathId:'path-1',name:'مادة'}],skills:[{id:'skill-1',subjectId:'sub-1',name:'مهارة'}]}}));
  await page.route('**/api/v1/courses/course-1/modules', r => r.fulfill({json:{modules:[]}}));
  await page.route('**/api/v1/lessons?*', r => r.fulfill({json:{items:[],hasMore:false}}));
  await page.route('**/api/v1/assessments?*', r => r.fulfill({json:{items:[{id:'quiz-1',title:'اختبار أصلي',isPublished:true,kind:'normal',code:'Q1'}],hasMore:false}}));
  await page.route('**/api/v1/courses/course-1', r => r.fulfill({json:{course}}));
  await page.route('**/api/v1/assessments/quiz-1/placements*', async r => {
    if (r.request().method() === 'GET') return r.fulfill({json:{items:placement ? [placement] : [],hasMore:false,page:1,limit:100}});
    creates++;
    const body = r.request().postDataJSON();
    expect(body).toMatchObject({slot:'course',courseId:'course-1',pathId:'path-1',subjectId:'sub-1',accessType:'free',isVisible:true});
    if (creates === 1) return r.fulfill({status:503,json:{message:'تعذر الحفظ مؤقتًا'}});
    placement = {...body,id:'placement-1',assessmentId:'quiz-1',assessmentVersion:1,updatedAt:'2026-01-01T00:00:00Z'};
    return r.fulfill({json:{placement}});
  });
  await page.route('**/api/v1/assessment-placements/placement-1', async r => {
    const body = r.request().postDataJSON();
    expect(body.expectedUpdatedAt).toBe(placement.updatedAt);
    placement = {...placement,...body,updatedAt:'2026-01-02T00:00:00Z'};
    return r.fulfill({json:{placement}});
  });
  await page.goto('/tests/e2e/fixtures/course-editor-files.html');
  await page.getByRole('button',{name:/الاختبارات المرتبطة/}).click();
  await page.getByLabel('اختبار الدورة').selectOption('quiz-1');
  await page.getByLabel('صلاحية الاختبار الجديد').selectOption('free');
  await page.getByRole('button',{name:'تفعيل الاختبار في الدورة'}).click();
  await expect(page.getByRole('alert')).toContainText('تعذر الحفظ مؤقتًا');
  await page.getByRole('button',{name:'تفعيل الاختبار في الدورة'}).click();
  await expect(page.getByText('ظاهر للطلاب')).toBeVisible();
  await page.getByRole('button',{name:'إخفاء الاختبار'}).click();
  await expect(page.getByText('مخفي عن الطلاب')).toBeVisible();
  await page.reload();
  await page.getByRole('button',{name:/الاختبارات المرتبطة/}).click();
  await page.getByLabel('اختبار الدورة').selectOption('quiz-1');
  await expect(page.getByText('مخفي عن الطلاب')).toBeVisible();
  await expect(page.getByLabel('صلاحية الاختبار المرتبط')).toHaveValue('free');
  await page.getByRole('button',{name:'إظهار الاختبار'}).click();
  await page.getByLabel('صلاحية الاختبار المرتبط').selectOption('package');
  await expect(page.getByLabel('صلاحية الاختبار المرتبط')).toHaveValue('package');
  expect(creates).toBe(2);
});


test('admin attaches a placement to an approved lesson in the course', async ({ page }) => {
  test.setTimeout(120_000);
  const course = {id:'course-1',pathId:'path-1',subjectId:'sub-1',title:'دورة',workflowStatus:'approved',isPublished:true,isVisible:true,revision:1,level:'beginner',presentation:{},skillIds:['skill-1']};
  await page.route('**/api/v1/taxonomy/bootstrap?phase=full', r => r.fulfill({json:{paths:[{id:'path-1',name:'مسار'}],subjects:[{id:'sub-1',pathId:'path-1',name:'مادة'}],skills:[{id:'skill-1',subjectId:'sub-1',name:'مهارة'}]}}));
  await page.route('**/api/v1/courses/course-1/modules', r => r.fulfill({json:{modules:[{id:'module-1',courseId:'course-1',title:'قسم',status:'active',sortOrder:1,lessons:[{lessonId:'lesson-a',sortOrder:1,isPreview:false}]}]}}));
  await page.route('**/api/v1/lessons?*', r => r.fulfill({json:{items:[{id:'lesson-a',title:'الدرس الأول',workflowStatus:'approved',isVisible:true}],hasMore:false}}));
  await page.route('**/api/v1/assessments?*', r => r.fulfill({json:{items:[{id:'quiz-1',title:'اختبار أصلي',isPublished:true,kind:'normal',code:'Q1'}],hasMore:false}}));
  await page.route('**/api/v1/courses/course-1', r => r.fulfill({json:{course}}));
  let placement:any = null;
  await page.route('**/api/v1/assessments/quiz-1/placements*', r => {
    if (r.request().method() === 'GET') return r.fulfill({json:{items:placement?[placement]:[],hasMore:false}});
    const body=r.request().postDataJSON(); expect(body).toMatchObject({slot:'course',courseId:'course-1',lessonId:'lesson-a',accessType:'package'});
    placement={...body,id:'lesson-placement',assessmentId:'quiz-1',updatedAt:'2026-01-01T00:00:00Z'};
    return r.fulfill({json:{placement}});
  });
  await page.goto('/tests/e2e/fixtures/course-editor-files.html');
  await page.getByRole('button',{name:/الاختبارات المرتبطة/}).click();
  await page.getByLabel('اختبار الدورة').selectOption('quiz-1');
  await page.getByLabel('مكان الاختبار في الدورة').selectOption('lesson-a');
  await page.getByLabel('صلاحية الاختبار الجديد').selectOption('package');
  await page.getByRole('button',{name:'تفعيل الاختبار في الدورة'}).click();
  await expect(page.getByText('ظاهر للطلاب')).toBeVisible();
  await expect(page.getByLabel('صلاحية الاختبار المرتبط')).toHaveValue('package');
});

test('course editor opens published lesson discussion and replies with real scope', async ({ page }) => {
  test.setTimeout(120_000);
  const course = {id:'course-1',pathId:'path-1',subjectId:'sub-1',title:'دورة',workflowStatus:'approved',isPublished:true,isVisible:true,revision:1,level:'beginner',presentation:{},skillIds:['skill-1']};
  await page.route('**/api/v1/taxonomy/bootstrap?phase=full', r => r.fulfill({json:{paths:[{id:'path-1',name:'مسار'}],subjects:[{id:'sub-1',pathId:'path-1',name:'مادة'}],skills:[]}}));
  await page.route('**/api/v1/courses/course-1/modules', r => r.fulfill({json:{modules:[{id:'module-1',courseId:'course-1',title:'قسم',status:'active',sortOrder:1,lessons:[{lessonId:'lesson-a',sortOrder:1,isPreview:false}]}]}}));
  await page.route('**/api/v1/lessons?*', r => r.fulfill({json:{items:[],hasMore:false}}));
  await page.route('**/api/v1/assessments?*', r => r.fulfill({json:{items:[],hasMore:false}}));
  await page.route('**/api/v1/courses/course-1', r => r.fulfill({json:{course}}));
  let attempts = 0;
  await page.route('**/api/v1/learning-spaces/courses/course-1', r => {
    attempts++;
    return attempts === 1 ? r.fulfill({status:503,json:{message:'تعذر تحميل الدروس'}}) : r.fulfill({json:{course:{...course,modules:[{lessons:[{id:'lesson-a',title:'الدرس المنشور'},{id:'outside',title:'درس غير مرتبط'}]}]}}});
  });
  await page.route('**/api/v1/learning-spaces/courses/course-1/lessons/lesson-a/discussion?*', r => r.fulfill({json:{page:1,hasMore:false,items:[{id:'question-1',parentId:'',authorId:'student',authorName:'طالب',body:'كيف أحل المسألة؟',createdAt:'2026-11-19T00:00:00Z'}]}}));
  await page.route('**/api/v1/learning-spaces/courses/course-1/lessons/lesson-a/discussion', r => {
    const body=r.request().postDataJSON();
    expect(body).toMatchObject({body:'ابدأ بتحديد المعطيات',parentId:'question-1'});
    expect(r.request().headers()['x-csrf-token']).toBe('csrf');
    return r.fulfill({status:201,json:{item:{id:'reply-1',parentId:'question-1',authorId:'teacher',authorName:'مدرب',body:body.body,createdAt:'2026-11-19T00:01:00Z'}}});
  });
  await page.goto('/tests/e2e/fixtures/course-editor-files.html');
  await page.getByRole('button',{name:'مناقشات الدروس'}).click();
  await expect(page.getByRole('alert')).toContainText('تعذر تحميل الدروس');
  await page.getByRole('button',{name:'إعادة المحاولة'}).click();
  const selector=page.getByLabel('الدرس',{exact:true});
  await expect(selector.getByRole('option',{name:'الدرس المنشور'})).toHaveCount(1);
  await expect(selector.getByRole('option',{name:'درس غير مرتبط'})).toHaveCount(0);
  await selector.selectOption('lesson-a');
  await expect(page.getByText('كيف أحل المسألة؟')).toBeVisible();
  await page.getByRole('button',{name:'رد',exact:true}).click();
  await page.getByLabel('اكتب سؤالك أو مناقشتك').fill('ابدأ بتحديد المعطيات');
  await page.getByRole('button',{name:'إرسال',exact:true}).click();
  await expect(page.getByText('ابدأ بتحديد المعطيات',{exact:true})).toBeVisible();
  await expect(page.getByText('رد على: كيف أحل المسألة؟')).toBeVisible();
});
