import {test as base,type Response} from '@playwright/test';
import {mockHeaderNavigation} from './header-navigation';
export * from '@playwright/test';
/** Shared opt-in scaffold for mocked E2E files. It supplies only newly consumed
 * navigation transport; each test's later explicit routes take precedence. */
export const test=base.extend<{headerNavigationDefaults:void}>({
 headerNavigationDefaults:[async({page},use,testInfo)=>{
  if(testInfo.file.endsWith('-live.spec.ts')){await use();return}
  type Actor={id:string;role?:string};
  let latestAuth:Promise<Actor|null>=Promise.resolve(null);
  const observe=(response:Response)=>{
   const path=new URL(response.url()).pathname;
   if(!/^\/api\/v1\/auth\/(?:me|login(?:\/.*)?|register|whatsapp\/verify|logout)$/.test(path))return;
   latestAuth=response.json().then(body=>body?.user?.id?{id:body.user.id,role:body.user.role}:null).catch(()=>null);
  };
  page.on('response',observe);
  await mockHeaderNavigation(page,{actor:()=>latestAuth,catalog:{paths:[],levels:[],subjects:[]}});
  await use();page.off('response',observe);
 },{auto:true}],
});
