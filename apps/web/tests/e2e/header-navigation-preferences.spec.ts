import {test,expect,type Page} from './fixtures/header-test';
import {mockHeaderNavigation} from './fixtures/header-navigation';
const student={id:'header-student',name:'طالب',email:'student@example.test',role:'student',roles:['student'],status:'active',avatarUrl:'',emailVerified:true};
const catalog={paths:[{id:'p',name:'مسار تجريبي',isActive:true}],levels:[{id:'l',name:'مرحلة تجريبية',pathId:'p'}],subjects:[]};
async function shell(page:Page,actor:()=>typeof student|null){
 await page.route('**/api/v1/auth/me',r=>actor()?r.fulfill({json:{user:actor()}}):r.fulfill({status:401,json:{message:'Authentication required'}}));
 await page.route('**/api/v1/auth/csrf',r=>r.fulfill({json:{csrfToken:'fixture-csrf'}}));
 await page.route('**/api/v1/content/homepage-settings',r=>r.fulfill({json:{studentExperience:{visibilityMode:'enrolled',promptEnrollment:true}}}));
 await page.route('**/api/v1/notifications/**',r=>r.fulfill({json:{items:[],unreadCount:0,hasMore:false}}));
 await page.route('**/api/v1/public/articles**',r=>r.fulfill({json:{items:[],page:1,limit:20,hasMore:false}}));
}
test('mocked navigation save retains dialog draft after failure then reloads persisted preference envelope',async({page})=>{
 await shell(page,()=>student);const fixture=await mockHeaderNavigation(page,{actor:()=>student,catalog});
 await page.goto('/blog');await page.getByRole('button',{name:'اختيار المسار',exact:true}).click();
 const dialog=page.getByRole('dialog',{name:'اختر مسارك التعليمي'});
 await dialog.getByLabel('المسار التعليمي',{exact:true}).selectOption('p');await dialog.getByLabel('اختر مرحلتك',{exact:true}).selectOption('l');
 fixture.failNextSave('فشل حفظ تجريبي');await dialog.getByRole('button',{name:'تأكيد التسجيل'}).click();await expect(dialog.getByRole('alert')).toHaveText('فشل حفظ تجريبي');await expect(dialog.getByLabel('المسار التعليمي',{exact:true})).toHaveValue('p');await expect(dialog.getByLabel('اختر مرحلتك',{exact:true})).toHaveValue('l');
 await dialog.getByRole('button',{name:'تأكيد التسجيل'}).click();await expect(dialog).toHaveCount(0);expect(fixture.records.get(student.id)).toEqual({enrolledPaths:['p'],pathStageSelections:[{pathId:'p',levelId:'l'}]});await page.reload();await expect(page.getByLabel('مساري الحالي',{exact:true})).toBeVisible();
});
test('mocked account change and logout cannot retain student preference or enrollment overlay',async({page})=>{
 let actor:typeof student|null=student;await shell(page,()=>actor);await mockHeaderNavigation(page,{actor:()=>actor,catalog,saved:{[student.id]:{enrolledPaths:['p'],pathStageSelections:[{pathId:'p',levelId:'l'}]}}});
 await page.goto('/blog');await page.getByRole('button',{name:'إضافة مسار أو تغيير المرحلة'}).click();await expect(page.getByRole('dialog',{name:'اختر مسارك التعليمي'})).toBeVisible();
 actor={...student,id:'header-admin',role:'admin',roles:['admin']};await page.reload();await expect(page.getByRole('dialog',{name:'اختر مسارك التعليمي'})).toHaveCount(0);await expect(page.getByLabel('مساري الحالي',{exact:true})).toHaveCount(0);
 actor=null;await page.reload();await expect(page.getByRole('dialog',{name:'اختر مسارك التعليمي'})).toHaveCount(0);await expect(page.getByLabel('مساري الحالي',{exact:true})).toHaveCount(0);
});
