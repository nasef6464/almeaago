import {expect,test,type Route} from '@playwright/test';

const courses=[
 {id:'c-public-1',title:'دورة قدرات منشورة',instructorName:'معلم القدرات',thumbnailUrl:'/images/daylight-qudrat-math.webp'},
 {id:'c-public-2',title:'دورة تحصيلي منشورة',instructorName:'معلم التحصيلي',thumbnailUrl:''},
];
const json=(r:Route,body:unknown,status=200)=>r.fulfill({status,contentType:'application/json',body:JSON.stringify(body)});
for(const width of [390,820,1440]){
 test(`guest homepage shows only real published course cards at ${width}px`,async({page})=>{
  await page.setViewportSize({width,height:960});
  await page.route('**/api/v1/auth/me',r=>json(r,{error:{message:'unauthenticated'}},401));
  await page.route('**/api/v1/taxonomy/bootstrap?*',r=>json(r,{paths:[],subjects:[]}));
  await page.route('**/api/v1/courses/public?*',r=>json(r,{items:courses}));
  await page.goto('/');
  const landing=page.getByTestId('public-landing');
  const courseSection=landing.locator('section[aria-label="الدورات المنشورة"]');
  await expect(landing.getByText('دورة قدرات منشورة',{exact:true})).toBeVisible();
  await expect(landing.getByText('دورة تحصيلي منشورة',{exact:true})).toBeVisible();
  await expect(courseSection.getByText('استوديو التعلم والإنطلاق الذكي',{exact:true})).toHaveCount(0);
  await expect(courseSection.getByText('هذه بطاقات عرض للواجهة المرجعية',{exact:false})).toHaveCount(0);
  await expect(landing.locator('a[href="/course/c-public-1"]')).toBeVisible();
  await expect(landing.locator('a[href="/course/c-public-2?buy=1"]')).toBeVisible();
  await expect.poll(()=>page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
  await page.screenshot({path:`test-results/public-real-courses-${width}.png`,fullPage:true});
 });
}
test('guest homepage does not invent course cards when public catalog is empty or fails',async({page})=>{
 await page.route('**/api/v1/auth/me',r=>json(r,{error:{message:'unauthenticated'}},401));
 await page.route('**/api/v1/taxonomy/bootstrap?*',r=>json(r,{paths:[],subjects:[]}));
 let failed=true;
 await page.route('**/api/v1/courses/public?*',r=>failed?json(r,{message:'unavailable'},503):json(r,{items:[]}));
 await page.goto('/');
 await expect(page.getByText('تعذر تحميل الدورات حاليًا.',{exact:true})).toBeVisible();
 await expect(page.getByText('عرض تعريفي',{exact:true})).toHaveCount(0);
 failed=false;
 await page.reload();
 await expect(page.getByText('لا توجد دورات منشورة حاليًا.',{exact:true})).toBeVisible();
 await expect(page.getByText('تعذر تحميل الدورات حاليًا.',{exact:true})).toHaveCount(0);
});
