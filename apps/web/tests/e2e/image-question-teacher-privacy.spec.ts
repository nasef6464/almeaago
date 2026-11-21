import { expect, test } from '@playwright/test';

test('image-question review keeps AI context out of both visible teacher tools', async ({ page }) => {
  const secret = 'نص داخلي خاص بالذكاء لا يعرض للطالب';
  const respond = (route: any, payload: unknown) => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(payload) });
  await page.route('**/api/v1/auth/me', r => respond(r, { user: { id: 's', role: 'student', roles: ['student'], status: 'active' } }));
  await page.route('**/api/v1/auth/csrf', r => respond(r, { csrfToken: 'csrf' }));
  const result = {attemptId:'a',assessmentId:'assessment',assessmentVersion:1,title:'نتيجة الاختبار',attemptNumber:1,score:0,totalQuestions:1,correctAnswers:0,wrongAnswers:1,unanswered:0,passed:false,timeSpentSeconds:1,finalizedAt:'2026-01-01T00:00:00Z',showResultsReport:true};
  const q = {questionId:'q',questionVersion:1,sectionId:'section',sortOrder:0,points:1,type:'mcq',text:secret,imageUrl:'https://example.invalid/question.png',imageAssetId:'',imageAlt:'صورة السؤال',optionsEmbeddedInImage:true,videoUrl:'',difficulty:'medium',explanation:'شرح متاح',solvingStrategy:'طريقة متاحة',options:[{index:0,text:'A',assetId:''},{index:1,text:'B',assetId:''}],selectedOptionIndex:0,correctOptionIndex:1,answered:true,correct:false,markedForReview:false,timeSpentSeconds:1};
  await page.route('**/api/v1/assessment-attempts/a/review', r => respond(r,{detail:{result,assessmentId:'assessment',assessmentVersion:1,title:'نتيجة الاختبار',attemptNumber:1,allowQuestionReview:true,showAnswers:true,showExplanations:true,showResultsReport:true,questions:[q]}}));
  let sentText = '';
  await page.route('**/api/v1/ai/question-assistant', async r => {sentText = r.request().postDataJSON().questionText; await r.fulfill({status:503,contentType:'application/json',body:'{}'});});
  await page.goto('/assessment-results/a');
  await expect(page.getByRole('button', {name:'شرح صوتي خطوة بخطوة بالسبورة 🎙️'})).toBeVisible();
  await expect(page.getByText(secret)).toHaveCount(0);
  await page.getByRole('button', {name:'شرح صوتي خطوة بخطوة بالسبورة 🎙️'}).click();
  await expect(page.getByRole('dialog', {name:'شرح المسألة خطوة بخطوة بالصوت والسبورة'})).toBeVisible();
  await expect(page.getByText(secret)).toHaveCount(0);
  await page.getByRole('button', {name:'إغلاق النافذة'}).click();
  await page.getByRole('button', {name:'افتح المعلم الذكي والسبورة التفاعلية 🧑‍🏫'}).click();
  await expect(page.getByRole('heading', {name:'المعلم الذكي والسبورة التفاعلية'})).toBeVisible();
  await expect.poll(() => sentText).toBe(secret);
  await expect(page.getByTestId('teaching-board')).toBeVisible();
  await expect(page.getByText(secret)).toHaveCount(0);
});
