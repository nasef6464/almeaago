import test from 'node:test';import assert from 'node:assert/strict';import {readFileSync} from 'node:fs';import {createRequire} from 'node:module';
const require=createRequire(new URL('../../apps/web/package.json',import.meta.url));const ts=require('typescript');
function load(source,resolve=require){const mod={exports:{}};new Function('require','module','exports',ts.transpileModule(source,{compilerOptions:{jsx:ts.JsxEmit.React,esModuleInterop:true,module:ts.ModuleKind.CommonJS}}).outputText)(resolve,mod,mod.exports);return mod.exports;}
test('homepage adapter sends same-origin credentials, real CSRF and preserves false/empty payload',async()=>{
 const source=readFileSync(new URL('../../apps/web/src/features/presentation/api.ts',import.meta.url),'utf8').replace('import.meta.env.VITE_API_BASE_URL',"''");
 const {api}=load(source);assert.equal(typeof api.getHomepageSettings,'function');
 const old=globalThis.fetch;const calls=[];globalThis.fetch=async(url,init)=>{calls.push({url,init});return {ok:true,json:async()=>({brand:{logoText:''},navigation:{showAutoPaths:false}})}};
 try{await api.getHomepageSettings();await api.updateHomepageSettings({brand:{logoText:''},navigation:{showAutoPaths:false}},'real-csrf');assert.equal(calls[0].url,'/api/v1/content/homepage-settings');assert.equal(calls[1].init.headers['X-CSRF-Token'],'real-csrf');assert.equal(calls[1].init.credentials,'include');assert.equal(JSON.parse(calls[1].init.body).navigation.showAutoPaths,false);}finally{globalThis.fetch=old;}
});
test('hero restores original gallery fallback, duplicate-primary handling and bounded rotation',()=>{
 const {heroGallery,heroRotateSeconds}=load(readFileSync(new URL('../../apps/web/src/features/presentation/homepageHero.ts',import.meta.url),'utf8'));
 const presets=[{url:'/a',alt:'a'},{url:'/b',alt:'b'}];assert.deepEqual(heroGallery({imageUrl:'/a',galleryImages:[]},presets).map(x=>x.url),['/a','/b']);assert.deepEqual(heroGallery({imageUrl:'/a',galleryImages:['/a','/c']},presets).map(x=>x.url),['/a','/c']);assert.equal(heroRotateSeconds(1),3);assert.equal(heroRotateSeconds(100),60);assert.equal(heroRotateSeconds(0),6);
});
test('saved homepage event wins over an older bootstrap read',async()=>{
 const oldWindow=globalThis.window;globalThis.window=new EventTarget();let effect;let state={};let resolve;
 const pending=new Promise(r=>resolve=r);
 const hooks={useState:()=>[{},v=>{state=typeof v==='function'?v(state):v;}],useEffect:fn=>effect=fn};
 const sanitizer=load(readFileSync(new URL('../../apps/web/src/features/presentation/homepageSanitizer.ts',import.meta.url),'utf8'));
 const {useHomepageSettings,HOMEPAGE_SETTINGS_UPDATED}=load(readFileSync(new URL('../../apps/web/src/features/presentation/useHomepageSettings.ts',import.meta.url),'utf8'),id=>id==='react'?hooks:id==='./api'?{api:{getHomepageSettings:()=>pending}}:id==='./homepageSanitizer'?sanitizer:require(id));
 try{useHomepageSettings();const cleanup=effect();window.dispatchEvent(new CustomEvent(HOMEPAGE_SETTINGS_UPDATED,{detail:{hero:{},brand:{logoText:'saved'}}}));resolve({hero:{},brand:{logoText:'stale'}});await pending;await Promise.resolve();assert.equal(state.brand.logoText,'saved');cleanup();}finally{globalThis.window=oldWindow;}
});
test('original legacy hero-image recovery replaces historical image hints',()=>{
 const {resolveHomepageHeroImage}=load(readFileSync(new URL('../../apps/web/src/features/presentation/homepageHero.ts',import.meta.url),'utf8'));
 assert.equal(typeof resolveHomepageHeroImage,'function');assert.equal(resolveHomepageHeroImage(' /images/girl-student.png '),'/images/homepage-hero-boy-platform.webp?v=20260512');assert.equal(resolveHomepageHeroImage(' /images/new.png '),'/images/new.png');
});


test('partial homepage save events preserve omitted fields and explicit clears without breaking Arabic text', async () => {
 const oldWindow=globalThis.window;globalThis.window=new EventTarget();
 let effect;let state={};let resolveRead;
 const pending=new Promise(resolve=>{resolveRead=resolve;});
 const hooks={useState:initial=>[initial,update=>{state=typeof update==='function'?update(state):update;}],useEffect:fn=>{effect=fn;}};
 const sanitizer=load(readFileSync(new URL('../../apps/web/src/features/presentation/homepageSanitizer.ts',import.meta.url),'utf8'));
 const {useHomepageSettings,HOMEPAGE_SETTINGS_UPDATED}=load(readFileSync(new URL('../../apps/web/src/features/presentation/useHomepageSettings.ts',import.meta.url),'utf8'),id=>id==='react'?hooks:id==='./api'?{api:{getHomepageSettings:()=>pending}}:id==='./homepageSanitizer'?sanitizer:require(id));
 try {
  useHomepageSettings();const cleanup=effect();
  resolveRead({hero:{titlePrefix:'محفوظ',titleSuffix:'في الاختبارات'},brand:{logoText:'قبل'},navigation:{moreLabel:'المزيد',showAutoPaths:false,items:[{id:'home',label:'الرئيسية'}]},sections:{featuredCoursesTitle:'الدورات'},stats:[{id:'courses',label:'دورات',mode:'manual',source:'courses',manualValue:'0'}],testimonials:[]});
  await pending;await Promise.resolve();
  assert.equal(state.hero.titlePrefix,'محفوظ');
  window.dispatchEvent(new CustomEvent(HOMEPAGE_SETTINGS_UPDATED,{detail:{brand:{logoText:'بعد'}}}));
  assert.equal(state.brand.logoText,'بعد');
  assert.equal(state.hero.titlePrefix,'محفوظ','brand-only update must not erase saved hero');
  assert.equal(state.sections.featuredCoursesTitle,'الدورات');
  assert.equal(state.stats[0].manualValue,'0');
  window.dispatchEvent(new CustomEvent(HOMEPAGE_SETTINGS_UPDATED,{detail:{hero:{titlePrefix:''},navigation:{items:[],showAutoPaths:false}}}));
  assert.equal(state.hero.titlePrefix,'','explicit empty hero text must clear');
  assert.equal(state.hero.titleSuffix,'في الاختبارات','unmentioned nested hero fields must survive');
  assert.equal(state.navigation.moreLabel,'المزيد','unmentioned nested navigation fields must survive');
  assert.deepEqual(state.navigation.items,[],'explicit empty navigation list must clear');
  assert.equal(state.navigation.showAutoPaths,false);
  window.dispatchEvent(new CustomEvent(HOMEPAGE_SETTINGS_UPDATED,{detail:null}));
  assert.equal(state.brand.logoText,'بعد','malformed event must not wipe settings');
  cleanup();
 } finally {globalThis.window=oldWindow;}
});
