import{expect,test,type Page,type Route}from'@playwright/test';
function json(route:Route,body:unknown,status=200){return route.fulfill({status,contentType:'application/json',body:JSON.stringify(body)})}
async function auth(page:Page){await page.route('**/api/v1/auth/me',r=>json(r,{user:{id:'student-1',name:'طالب',email:'student@example.com',roles:['student']}}));}
const taxonomy={paths:[{id:'p1',name:'قدرات'}],subjects:[{id:'s1',pathId:'p1',name:'كمي'}]};
const learningSpace={pathId:'p1',subjectId:'s1',courses:{items:[{id:'c1',title:'دورة الكمي',description:'تدريب منظم',instructorName:'المدرب',durationMinutes:90,level:'متوسط',thumbnailAssetId:'',dripContentEnabled:false,certificateEnabled:false}],hasMore:false},foundation:{items:[{id:'t1',parentTopicId:'',title:'أساسيات النسب',description:'تأسيس قصير',sortOrder:1,isLocked:true}],hasMore:false},library:{items:[{id:'l1',title:'ملف دعم النسب',description:'ملخص',type:'pdf',isLocked:false}],hasMore:false}};

async function mockLearning(page:Page){
 await auth(page);
 await page.route('**/api/v1/taxonomy/bootstrap?phase=core',r=>json(r,taxonomy));
 let calls=0;
 await page.route('**/api/v1/learning-spaces/p1/subjects/s1?limit=50',r=>{calls++;return json(r,learningSpace)});
 return()=>calls;
}

test('mobile learner browses bounded legacy-shaped learning tabs without content inventory fanout',async({page})=>{
 const calls=await mockLearning(page);
 await page.setViewportSize({width:390,height:844});
 await page.goto('/learning');
 await expect(page.getByTestId('legacy-learning-space')).toBeVisible();
 await expect(page.getByRole('heading',{name:'تعلّم حسب المسار والمادة'})).toBeVisible();
 await page.getByLabel('المسار').selectOption('p1');
 await page.getByLabel('المادة').selectOption('s1');
 await expect(page.getByText('دورة الكمي')).toBeVisible();
 await expect(page.getByRole('button',{name:'التدريب'})).toBeVisible();
 await expect(page.getByRole('button',{name:'الاختبارات'})).toBeVisible();
 await page.getByRole('button',{name:'التأسيس'}).click();
 await expect(page.getByText('أساسيات النسب')).toBeVisible();
 await expect(page.getByText('مقفل')).toBeVisible();
 await page.getByRole('button',{name:'المكتبة'}).click();
 await expect(page.getByText('ملف دعم النسب')).toBeVisible();
 expect(calls()).toBe(1);
 await expect.poll(()=>page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth)).toBe(true);
 await page.screenshot({path:'test-results/content-learning-mobile.png',fullPage:true});
});


test('dashboard learning entry reaches working learning content',async({page})=>{
 const calls=await mockLearning(page);
 await page.setViewportSize({width:390,height:844});
 await page.goto('/dashboard');
 await page.getByRole('button',{name:'فتح قائمة لوحة الطالب'}).click();
 const studentNav=page.getByRole('navigation',{name:'تنقل لوحة الطالب'});
 await studentNav.getByRole('link',{name:/مساراتي ودوراتي/}).click();
 await expect(page).toHaveURL(/\/learning(?:\?tab=courses)?$/);
 await expect(page.getByTestId('legacy-learning-space')).toBeVisible();
 await page.getByLabel('المسار').selectOption('p1');
 await page.getByLabel('المادة').selectOption('s1');
 await expect(page.getByText('دورة الكمي')).toBeVisible();
 expect(calls()).toBe(1);
 await expect.poll(()=>page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth)).toBe(true);
});

test('legacy category deep link maps subject and tab onto canonical V2 learning data',async({page})=>{
 const calls=await mockLearning(page);
 await page.setViewportSize({width:820,height:1180});
 await page.goto('/category/p1?subject=s1&tab=skills');
 await expect(page.getByRole('heading',{name:'قدرات (كمي)'})).toBeVisible();
 await expect(page.getByRole('button',{name:'التأسيس'})).toHaveClass(/bg-indigo-600/);
 await expect(page.getByText('أساسيات النسب')).toBeVisible();
 expect(calls()).toBe(1);
 await expect.poll(()=>page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth)).toBe(true);
 await page.screenshot({path:'test-results/content-learning-legacy-tablet.png',fullPage:true});
});

test('legacy learning course CTA navigates into a working V2 course runtime',async({page})=>{
 await mockLearning(page);
 const course={id:'c1',title:'دورة الكمي',description:'تدريب منظم',instructorName:'المدرب',durationMinutes:90,level:'متوسط',thumbnailAssetId:'',dripContentEnabled:false,certificateEnabled:false,access:{allowed:true,configured:true,reason:'free_product'},modules:[{id:'m1',title:'الوحدة الأولى',description:'',sortOrder:1,lessons:[{id:'lesson-1',title:'درس النسب',description:'شرح مباشر',type:'video',durationSeconds:120,isLocked:false,isPreview:false,commerceLocked:false,sortOrder:1}]}]};
 const lesson={id:'lesson-1',title:'درس النسب',description:'شرح مباشر',type:'video',durationSeconds:120,isLocked:false,isPreview:false,commerceLocked:false,sortOrder:1,contentText:'',videoUrl:'/media/sample.mp4',videoSource:'upload'};
 await page.route('**/api/v1/auth/csrf',r=>json(r,{csrfToken:'csrf'}));
 await page.route('**/api/v1/learning-spaces/courses/c1',r=>json(r,{course}));
 await page.route('**/api/v1/learning-spaces/courses/c1/lessons/lesson-1',r=>json(r,{lesson}));
 await page.route('**/api/v1/learning-progress/lessons/lesson-1?**',r=>json(r,{progress:{lessonId:'lesson-1',contextType:'course',courseId:'c1',topicId:'',status:'in_progress',positionSeconds:0,completedAt:null,updatedAt:'2026-10-02T00:00:00Z'}}));
 await page.route('**/media/sample.mp4',r=>r.fulfill({status:200,headers:{'Content-Type':'video/mp4'},body:''}));
 await page.goto('/category/p1?subject=s1');
 const start=page.getByRole('link',{name:/ابدأ/});
 await expect(start).toHaveAttribute('href','/course/c1?learn=1');
 await start.click();
 await expect(page).toHaveURL(/\/course\/c1\?learn=1$/);
 await expect(page.getByTestId('legacy-course-player')).toBeVisible();
 await expect(page.getByRole('heading',{name:'درس النسب'})).toBeVisible();
 await expect(page.getByTestId('lesson-video')).toBeVisible();
 await expect.poll(()=>page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth)).toBe(true);
});


test('student dashboard click-through reaches all remaining certified learner destinations',async({page})=>{
 await page.route('**/api/v1/taxonomy/bootstrap?phase=core',r=>json(r,taxonomy));
 await page.route('**/api/v1/assessment-placements/available?**',r=>json(r,{items:[],page:1,limit:50,hasMore:false}));
 await page.route('**/api/v1/assessment-attempts/results?**',r=>json(r,{items:[],page:1,limit:20,hasMore:false}));
 await page.route('**/api/v1/notifications/me?page=1&limit=50',r=>json(r,{items:[],page:1,limit:50,hasMore:false}));
 await page.route('**/api/v1/notifications/me/unread-count',r=>json(r,{unreadCount:0}));
 await auth(page);
 await page.setViewportSize({width:390,height:844});

 const destinations=[
  {label:/اختبارات المنصة/,url:/\/assessments$/,heading:'اختبارات المنصة'},
  {label:/أسئلتي للمراجعة/,url:/\/review$/,heading:'أسئلتي للمراجعة'},
  {label:/خططي/,url:/\/plan$/,heading:'خططي'},
  {label:/اختباراتي ونتائجي/,url:/\/assessment-results$/,heading:'اختباراتي'},
  {label:/تقاريري/,url:/\/reports$/,heading:'تقارير الأداء'},
  {label:/الإشعارات/,url:/\/notifications$/,heading:'الإشعارات'},
 ];

 for(const destination of destinations){
  await page.goto('/dashboard');
  await page.getByRole('button',{name:'فتح قائمة لوحة الطالب'}).click();
  const nav=page.getByRole('navigation',{name:'تنقل لوحة الطالب'}).last();
  await nav.getByRole('link',{name:destination.label}).click();
  await expect(page).toHaveURL(destination.url);
  await expect(page.getByRole('heading',{name:destination.heading}).first()).toBeVisible();
  await expect(page.getByText(/Placeholder|Something went wrong|Application error/i)).toHaveCount(0);
  await expect.poll(()=>page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth)).toBe(true);
 }
});
