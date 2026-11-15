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
