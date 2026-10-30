import type {Page} from '@playwright/test';

type Actor={id:string;role?:string};
type Preferences={enrolledPaths:string[];pathStageSelections:{pathId:string;levelId:string}[]};
/** Opt-in transport fixture for ordinary mocked browser tests. Never install in
 * HEADER_LIVE tests: native tests must exercise actual sessions/CSRF/PostgreSQL. */
export async function mockHeaderNavigation(page:Page,input:{actor:()=>Actor|null|Promise<Actor|null>;catalog:{paths:unknown[];levels:unknown[];subjects:unknown[]};saved?:Record<string,Preferences>}){
 const records=new Map(Object.entries(input.saved||{}));
 let nextSaveFailure='';
 await page.route('**/api/v1/taxonomy/bootstrap?phase=core',route=>route.fulfill({json:input.catalog}));
 await page.route('**/api/v1/learning/navigation-preferences',async route=>{
  const actor=await input.actor();if(!actor)return route.fulfill({status:401,json:{message:'Authentication required'}});
  const current=records.get(actor.id)||{enrolledPaths:[],pathStageSelections:[]};
  if(route.request().method()==='PATCH'){
   if(nextSaveFailure){const message=nextSaveFailure;nextSaveFailure='';return route.fulfill({status:500,json:{message}})}
   const patch=route.request().postDataJSON() as Partial<Preferences>;
   const enrolledPaths=patch.enrolledPaths??current.enrolledPaths;
   const stages=new Map(current.pathStageSelections.filter(row=>enrolledPaths.includes(row.pathId)).map(row=>[row.pathId,row]));
   for(const row of patch.pathStageSelections||[])stages.set(row.pathId,row);
   records.set(actor.id,{enrolledPaths,pathStageSelections:[...stages.values()]});
  }
  return route.fulfill({json:{user:{id:actor.id,...(records.get(actor.id)||current)}}});
 });
 return {records,failNextSave:(message='تعذر حفظ التسجيل؛ حاول مرة أخرى.')=>{nextSaveFailure=message}};
}
