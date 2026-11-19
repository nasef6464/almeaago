import { expect, test } from '@playwright/test';

test('assigned teacher answers a purchased lesson discussion', async ({page, browser}) => {
  test.skip(process.env.DISCUSSION_TEACHER_LIVE !== '1', 'requires disposable Go and PostgreSQL fixture');
  test.setTimeout(180_000);
  const login = await page.request.post('/api/v1/auth/login',{data:{email:process.env.DISCUSSION_TEACHER_EMAIL!,password:process.env.DISCUSSION_PASSWORD!}});
  expect(login.status()).toBe(200);
  const course = process.env.DISCUSSION_COURSE_ID!;
  const lesson = process.env.DISCUSSION_LESSON_ID!;
  await page.goto(`/tests/e2e/fixtures/course-editor-teacher.html?course=${encodeURIComponent(course)}&actor=${encodeURIComponent(process.env.DISCUSSION_TEACHER_ID!)}`,{waitUntil:'domcontentloaded'});
  await page.getByRole('button',{name:'مناقشات الدروس'}).click();
  await page.getByLabel('الدرس',{exact:true}).selectOption(lesson);
  const question=page.getByText('سؤال الدرس',{exact:true});
  await expect(question).toBeVisible({timeout:60_000});
  await question.locator('xpath=ancestor::li').getByRole('button',{name:'رد',exact:true}).click();
  await page.getByLabel('اكتب سؤالك أو مناقشتك').fill('توضيح من المدرس في التجربة');
  await page.getByRole('button',{name:'إرسال',exact:true}).click();
  await expect(page.getByText('توضيح من المدرس في التجربة',{exact:true})).toBeVisible();
  const student = await browser.newContext({baseURL:'http://127.0.0.1:4173'});
  try {
    const studentLogin=await student.request.post('/api/v1/auth/login',{data:{email:process.env.DISCUSSION_STUDENT_EMAIL!,password:process.env.DISCUSSION_PASSWORD!}});
    expect(studentLogin.status()).toBe(200);
    const response=await student.request.get(`/api/v1/learning-spaces/courses/${course}/lessons/${lesson}/discussion`);
    expect(response.status()).toBe(200);
    expect(await response.text()).toContain('توضيح من المدرس في التجربة');
  } finally { await student.close(); }
  await page.screenshot({path:'test-results/course-discussion-teacher-live.png',fullPage:true});
});
