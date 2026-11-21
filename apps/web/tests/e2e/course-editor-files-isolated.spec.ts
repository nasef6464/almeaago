import { test, expect } from '@playwright/test';

test('admin adds file URL, handles save failure and sees it after reload', async ({ page }) => {
  test.setTimeout(120_000);
  let writes=0;
  let course:any = { id:'course-1',pathId:'path-1',subjectId:'sub-1',title:'دورة تجريبية',description:'',instructorName:'',durationMinutes:0,level:'beginner',ownerType:'platform',ownerUserId:'',ownerSchoolId:'',assignedTeacherId:'',revenueSharePercentage:0,workflowStatus:'draft',revision:1,isVisible:true,dripContentEnabled:false,certificateEnabled:false,thumbnailAssetId:'',presentation:{files:[]},skillIds:['skill-1'] };
  await page.route('**/api/v1/taxonomy/bootstrap?phase=full', route => route.fulfill({json:{paths:[{id:'path-1',code:'p',name:'مسار'}],subjects:[{id:'sub-1',pathId:'path-1',code:'s',name:'مادة'}],skills:[{id:'skill-1',subjectId:'sub-1',code:'k',name:'مهارة'}]}}));
  await page.route('**/api/v1/courses/course-1/modules', route => route.fulfill({json:{modules:[]}}));
  await page.route('**/api/v1/lessons?*', route => route.fulfill({json:{items:[],hasMore:false}}));
  await page.route('**/api/v1/assessments?*', route => route.fulfill({json:{items:[],hasMore:false}}));
  await page.route('**/api/v1/courses/course-1', route => {
    if (route.request().method() === 'GET') return route.fulfill({json:{course}});
    writes++;
    const input = route.request().postDataJSON();
    expect(input.presentation.files[0]).toMatchObject({title:'مذكرة حقيقية',url:'https://example.test/notes.pdf',access:'free_preview'});
    if (writes === 1) return route.fulfill({status:503,json:{message:'تعذر الحفظ مؤقتًا'}});
    course = {...course,...input,revision:2};
    return route.fulfill({json:{course}});
  });
  await page.goto('/tests/e2e/fixtures/course-editor-files.html');
  await page.getByRole('button',{name:/ملفات الدورة/}).click();
  await page.getByLabel('اسم الملف / المذكرة *').fill('مذكرة حقيقية');
  await page.getByLabel('رابط الملف *').fill('https://example.test/notes.pdf');
  await page.getByRole('button',{name:'إضافة ملف'}).click();
  await expect(page.getByText('مذكرة حقيقية')).toBeVisible();
  await page.getByRole('button',{name:'حفظ الملفات'}).click();
  await expect(page.getByText('تعذر الحفظ مؤقتًا')).toBeVisible();
  await page.getByRole('button',{name:'حفظ الملفات'}).click();
  await expect(page.getByText('تم حفظ إعدادات الدورة.')).toBeVisible();
  await page.reload();
  await page.getByRole('button',{name:/ملفات الدورة/}).click();
  await expect(page.getByText('مذكرة حقيقية')).toBeVisible();
  expect(writes).toBe(2);
  await page.route('**/api/v1/auth/me', route => route.fulfill({json:{user:{id:'student-1',name:'طالب',role:'student',roles:['student'],status:'active'}}}));
  await page.route('**/api/v1/learning-spaces/courses/course-1', route => route.fulfill({json:{course:{...course,modules:[],access:{allowed:true,configured:true,reason:'free_product'}}}}));
  await page.goto('/course/course-1?tab=files');
  await expect(page.getByRole('link', {name:'تحميل مذكرة حقيقية'})).toHaveAttribute('href','https://example.test/notes.pdf');
});
