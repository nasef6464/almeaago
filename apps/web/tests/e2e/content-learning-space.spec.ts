import{expect,test,type Page,type Route}from'@playwright/test';
function json(route:Route,body:unknown,status=200){return route.fulfill({status,contentType:'application/json',body:JSON.stringify(body)})}
async function auth(page:Page){await page.route('**/api/v1/auth/me',r=>json(r,{user:{id:'student-1',name:'طالب',email:'student@example.com',roles:['student']}}));}
test('mobile learner browses bounded courses foundation and library without content inventory fanout',async({page})=>{
 await auth(page);await page.setViewportSize({width:390,height:844});
 await page.route('**/api/v1/taxonomy/bootstrap?phase=core',r=>json(r,{paths:[{id:'p1',name:'قدرات'}],subjects:[{id:'s1',pathId:'p1',name:'كمي'}]}));
 let calls=0;await page.route('**/api/v1/learning-spaces/p1/subjects/s1?limit=50',r=>{calls++;return json(r,{pathId:'p1',subjectId:'s1',courses:{items:[{id:'c1',title:'دورة الكمي',description:'تدريب منظم',instructorName:'المدرب',durationMinutes:90,level:'متوسط',thumbnailAssetId:'',dripContentEnabled:false,certificateEnabled:false}],hasMore:false},foundation:{items:[{id:'t1',parentTopicId:'',title:'أساسيات النسب',description:'تأسيس قصير',sortOrder:1,isLocked:true}],hasMore:false},library:{items:[{id:'l1',title:'ملف دعم النسب',description:'ملخص',type:'pdf',isLocked:false}],hasMore:false}})});
 await page.goto('/learning');await expect(page.getByRole('heading',{name:'تعلّم حسب المسار والمادة'})).toBeVisible();await page.getByLabel('المسار').selectOption('p1');await page.getByLabel('المادة').selectOption('s1');await expect(page.getByText('دورة الكمي')).toBeVisible();
 await page.getByRole('button',{name:'التأسيس'}).click();await expect(page.getByText('أساسيات النسب')).toBeVisible();await expect(page.getByText('مقفل')).toBeVisible();
 await page.getByRole('button',{name:'المكتبة'}).click();await expect(page.getByText('ملف دعم النسب')).toBeVisible();expect(calls).toBe(1);
 await page.screenshot({path:'test-results/content-learning-mobile.png',fullPage:true});
});
