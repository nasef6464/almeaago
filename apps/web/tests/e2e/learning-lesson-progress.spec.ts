import{expect,test,type Page,type Route}from'@playwright/test';

const student={id:'student-1',email:'student@example.com',name:'طالب',status:'active',avatarUrl:'',emailVerified:true,role:'student',roles:['student']};
const course={id:'course-1',title:'دورة الكمي',description:'تدريب منظم',instructorName:'فريق المنصة',durationMinutes:20,level:'beginner',thumbnailAssetId:'',dripContentEnabled:false,certificateEnabled:true,modules:[{id:'module-1',title:'الوحدة الأولى',description:'',sortOrder:1,lessons:[{id:'lesson-1',title:'فيديو النسب',description:'شرح مباشر',type:'video',durationSeconds:120,isLocked:false,isPreview:false,sortOrder:1}]}]};
const lesson={id:'lesson-1',title:'فيديو النسب',description:'شرح مباشر',type:'video',durationSeconds:120,isLocked:false,isPreview:false,sortOrder:1,contentText:'',videoUrl:'/media/sample.mp4',videoSource:'upload'};
function json(r:Route,b:unknown,s=200){return r.fulfill({status:s,contentType:'application/json',body:JSON.stringify(b)})}
async function auth(page:Page){await page.route('**/api/v1/auth/me',r=>json(r,{user:student}));await page.route('**/api/v1/auth/csrf',r=>json(r,{csrfToken:'csrf'}));}

test('mobile course lesson resumes video and completes only through explicit action',async({page})=>{
 await auth(page);
 await page.setViewportSize({width:390,height:844});
 await page.route('**/api/v1/learning-spaces/courses/course-1',r=>json(r,{course}));
 await page.route('**/api/v1/learning-spaces/courses/course-1/lessons/lesson-1',r=>json(r,{lesson}));
 let status='in_progress';
 let position=25;
 let completeCalls=0;
 await page.route('**/api/v1/learning-progress/lessons/lesson-1?**',r=>json(r,{progress:{lessonId:'lesson-1',contextType:'course',courseId:'course-1',topicId:'',status,positionSeconds:position,completedAt:null,updatedAt:'2026-09-26T04:00:00Z'}}));
 await page.route('**/api/v1/learning-progress/lessons/lesson-1/video',async r=>{
   const body=JSON.parse(r.request().postData()||'{}');
   expect(body).toMatchObject({contextType:'course',courseId:'course-1',topicId:''});
   expect(body.positionSeconds).toBe(42);
   position=42;
   return json(r,{progress:{lessonId:'lesson-1',contextType:'course',courseId:'course-1',topicId:'',status:'in_progress',positionSeconds:42,completedAt:null,updatedAt:'2026-09-26T04:01:00Z'}});
 });
 await page.route('**/api/v1/learning-progress/lessons/lesson-1/complete',async r=>{
   completeCalls++;
   const body=JSON.parse(r.request().postData()||'{}');
   expect(body).toEqual({contextType:'course',courseId:'course-1',topicId:''});
   status='completed';
   return json(r,{progress:{lessonId:'lesson-1',contextType:'course',courseId:'course-1',topicId:'',status:'completed',positionSeconds:42,completedAt:'2026-09-26T04:02:00Z',updatedAt:'2026-09-26T04:02:00Z'}});
 });
 await page.route('**/media/sample.mp4',r=>r.fulfill({status:200,headers:{'Content-Type':'video/mp4'},body:''}));

 await page.goto('/learning/courses/course-1');
 await expect(page.getByRole('heading',{name:'فيديو النسب'})).toBeVisible();
 await expect(page.getByText(/آخر موضع 25 ثانية/)).toBeVisible();

 const video=page.getByTestId('lesson-video');
 await video.evaluate((node)=>{
   Object.defineProperty(node,'currentTime',{configurable:true,writable:true,value:42});
   node.dispatchEvent(new Event('pause'));
 });
 await expect(page.getByText('تم حفظ موضع المشاهدة.')).toBeVisible();
 expect(completeCalls).toBe(0);
 await expect(page.getByText(/آخر موضع 42 ثانية/)).toBeVisible();

 await page.getByRole('button',{name:'تحديد كمكتمل'}).click();
 await expect(page.getByText('تم تسجيل الدرس كمكتمل.')).toBeVisible();
 await expect(page.getByText('مكتمل',{exact:true})).toBeVisible();
 expect(completeCalls).toBe(1);
 await page.screenshot({path:'test-results/learning-course-progress-mobile.png',fullPage:true});
});

test('locked non-preview lesson is not opened and no progress request is sent',async({page})=>{
 await auth(page);
 const lockedCourse={...course,modules:[{...course.modules[0],lessons:[{...course.modules[0].lessons[0],isLocked:true,isPreview:false}]}]};
 await page.route('**/api/v1/learning-spaces/courses/course-1',r=>json(r,{course:lockedCourse}));
 let progressRequests=0;
 await page.route('**/api/v1/learning-progress/**',r=>{progressRequests++;return json(r,{})});
 await page.goto('/learning/courses/course-1');
 await expect(page.getByRole('button',{name:/فيديو النسب/})).toBeDisabled();
 expect(progressRequests).toBe(0);
});
