import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createRequire} from 'node:module';
const require=createRequire(new URL('../../apps/web/package.json',import.meta.url));
const React=require('react');const {MemoryRouter}=require('react-router-dom');const {renderToStaticMarkup}=require('react-dom/server');const ts=require('typescript');
const base=new URL('../../apps/web/src/features/public/',import.meta.url);
const paths=[{id:'p',name:'قدرات'},{id:'child',parentPathId:'p',name:'فرعي'}];
const levels=[{id:'l',pathId:'p',name:'المتوسطة'}];const subjects=[{id:'s',pathId:'p',levelId:'l',name:'رياضيات'}];
const homepageSettings={brand:{logoUrl:'/saved.svg',logoText:'منصة',logoAccentText:'المئة'},navigation:{items:[{id:'home',order:0}]}};
function load(code,user){const mod={exports:{}};const resolve=id=>{
 if(id==='react'||id==='react/jsx-runtime'||id==='react-router-dom'||id==='lucide-react')return require(id);
 if(/StudentExperienceContext|learning\/navigation/.test(id))return {useStudentExperience:()=>({paths,levels,subjects,homepageSettings,scope:{navigationPathVisible:()=>true,matchesNavigationContent:()=>true}})};
 if(/AuthContext|authAdapter|AuthProvider/.test(id))return {useAuth:()=>({user,logout:async()=>{}})};
 if(/useStore|headerStore/.test(id))return {useStore:()=>({paths,levels,subjects,cartItems:[]})};
 if(/services\/api|headerApi/.test(id))return {api:{},isStagingEnv:false};
 if(/ThemeToggle/.test(id))return {ThemeToggle:()=>React.createElement('button',{'data-probe':'theme'})};
 if(/NotificationBell/.test(id))return {NotificationBell:()=>React.createElement('button',{'data-probe':'notifications'})};
 if(/SearchModal/.test(id))return {SearchModal:()=>null};
 if(/useHomepageSettings/.test(id))return {useHomepageSettings:()=>homepageSettings};
 if(/content-client/.test(id))return {contentClient:{}};
 if(/dashboard-path/.test(id))return {dashboardPathFor:()=>'/dashboard'};
 if(/OriginalHeader/.test(id))return load(readFileSync(new URL('header/OriginalHeader.tsx',base),'utf8'),user);
 if(/\.\/navigation/.test(id))return load(readFileSync(new URL('header/navigation.ts',base),'utf8'),user);
 if(/homepage-types|types|Sanitizer|sanitizeMojibake/.test(id))return {};
 throw Error('Unexpected header dependency '+id);
 };new Function('require','module','exports',ts.transpileModule(code,{compilerOptions:{jsx:ts.JsxEmit.ReactJSX,module:ts.ModuleKind.CommonJS,esModuleInterop:true}}).outputText)(resolve,mod,mod.exports);return mod.exports;}
const original=readFileSync(new URL('../../docs/migration/baselines/legacy-Header.tsx.txt',import.meta.url),'utf8');
const target=()=>readFileSync(new URL('components/LegacySiteHeader.tsx',base),'utf8');
for(const role of ['guest','student','admin','teacher','supervisor','school_admin','parent'])test(`original complete header shell and controls for ${role}`,()=>{
 const user=role==='guest'?null:{id:'u',role,roles:[role],name:'مستخدم',displayName:'مستخدم',email:'u@example.test',photoURL:'/avatar.png',avatarUrl:'/avatar.png'};
 const render=Component=>renderToStaticMarkup(React.createElement(MemoryRouter,null,React.createElement(Component,{onAuth:()=>{}})));
 const actual=render(load(target(),user).LegacySiteHeader);const expected=render(load(original,user).Header);
 assert.equal(actual,expected);
});
