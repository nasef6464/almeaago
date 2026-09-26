import{expect,test,type Page,type Route}from'@playwright/test';

const parent={id:'parent-1',email:'parent@example.com',name:'ولي أمر',status:'active',avatarUrl:'',emailVerified:true,role:'parent',roles:['parent']};

function json(route:Route,body:unknown,status=200){return route.fulfill({status,contentType:'application/json',body:JSON.stringify(body)})}
async function auth(page:Page){
 await page.route('**/api/v1/auth/me',route=>json(route,{user:parent}));
}

const result={
 attemptId:'attempt-1',assessmentId:'assessment-1',assessmentVersion:2,title:'اختبار الكمي',
 attemptNumber:1,score:68,totalQuestions:20,correctAnswers:13,wrongAnswers:6,unanswered:1,
 passed:true,timeSpentSeconds:720,finalizedAt:'2026-09-26T10:00:00Z',
};
const weak={pathId:'path-1',subjectId:'subject-1',skillId:'skill-1',skillName:'النسبة والتناسب',mastery:42,status:'weak',attempts:2,evidenceCount:5,recommendedAction:'خطة علاج عاجلة: شرح + تدريب + اختبار موجه',lastEvidenceAt:'2026-09-26T10:00:00Z'};
const dashboard={
 children:[{
  studentId:'student-1',name:'سارة',avatarUrl:'',schoolIds:['school-1'],weeklyStudyMinutes:24,
  weeklyAssessmentCount:2,weeklyAverageScore:71.5,recentResults:[result],weakSkills:[weak],
  nextAction:'خطة علاج عاجلة: شرح + تدريب + اختبار موجه',
 }],
 summary:{totalChildren:1,visibleChildren:1,weeklyAssessmentCount:2,weeklyAverageScore:71.5,weakSkills:1},
 page:1,limit:20,hasMore:false,
};

test('parent dashboard shows only canonical linked-child summary and deterministic next action',async({page})=>{
 await auth(page);
 await page.setViewportSize({width:390,height:844});
 await page.route('**/api/v1/parents/dashboard?**',route=>json(route,dashboard));
 await page.route('**/api/v1/parents/children/student-1/results?**',route=>json(route,{items:[result],page:1,limit:20,hasMore:false}));
 await page.route('**/api/v1/parents/weekly-report?**',route=>json(route,{periodStart:'2026-09-19T12:00:00Z',periodEnd:'2026-09-26T12:00:00Z',children:[{studentId:'student-1',name:'سارة',avatarUrl:'',schoolIds:['school-1'],assessmentCount:2,averageScore:71.5,studyMinutes:24,weakSkills:[weak],nextAction:weak.recommendedAction}],page:1,limit:20,hasMore:false}));

 await page.goto('/parent-dashboard');
 await expect(page.getByRole('heading',{name:'متابعة الأبناء ببساطة'})).toBeVisible();
 await expect(page.getByTestId('parent-child-card')).toHaveCount(1);
 await expect(page.getByRole('heading',{name:'سارة',exact:true})).toBeVisible();
 await expect(page.getByText('خطة علاج عاجلة: شرح + تدريب + اختبار موجه',{exact:true}).first()).toBeVisible();
 await expect(page.getByText('student-other')).toHaveCount(0);

 await page.getByRole('button',{name:'نتائج الأبناء'}).click();
 await expect(page.getByText('اختبار الكمي')).toBeVisible();
 await expect(page.getByText('68%')).toBeVisible();
 await expect(page.getByText(/مفاتيح الإجابة/)).toBeVisible();

 await page.getByRole('button',{name:'المهارات الضعيفة'}).click();
 await expect(page.getByText('النسبة والتناسب')).toBeVisible();
 await expect(page.getByText('42%')).toBeVisible();

 await page.getByRole('button',{name:'تقرير الأسبوع'}).click();
 await expect(page.getByText('التقرير الأسبوعي المبسط')).toBeVisible();
 await expect(page.getByText(/هذه المرحلة تعرض التقرير فقط/)).toBeVisible();
 await page.screenshot({path:'test-results/parent-dashboard-mobile.png',fullPage:true});
});

test('parent dashboard has an explicit empty state when no active linked child exists',async({page})=>{
 await auth(page);
 await page.route('**/api/v1/parents/dashboard?**',route=>json(route,{children:[],summary:{totalChildren:0,visibleChildren:0,weeklyAssessmentCount:0,weeklyAverageScore:0,weakSkills:0},page:1,limit:20,hasMore:false}));
 await page.goto('/parent-dashboard');
 await expect(page.getByRole('heading',{name:'لا يوجد أبناء مرتبطون بالحساب'})).toBeVisible();
 await expect(page.getByText(/لا تعرض هذه الصفحة أي طالب خارج العلاقات المعتمدة/)).toBeVisible();
});
