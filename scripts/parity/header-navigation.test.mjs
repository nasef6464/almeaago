import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,existsSync} from 'node:fs';
import {createRequire} from 'node:module';
const require=createRequire(new URL('../../apps/web/package.json',import.meta.url));
const ts=require('typescript');
function load(code){const mod={exports:{}};new Function('require','module','exports',ts.transpileModule(code,{compilerOptions:{module:ts.ModuleKind.CommonJS}}).outputText)(require,mod,mod.exports);return mod.exports;}
const path=new URL('../../apps/web/src/features/public/header/navigation.ts',import.meta.url);
const restored=existsSync(path)?load(readFileSync(path,'utf8')):{};
const raw=readFileSync(new URL('../../docs/migration/baselines/legacy-Header.tsx.txt',import.meta.url),'utf8');
const begin=raw.indexOf('    const navSettings = homepageSettings?.navigation || {};');
const end=raw.indexOf('\n  }, [homepageSettings?.navigation',begin);
assert(begin>0&&end>begin);
const source=load(`export function original({homepageSettings,paths,levels,subjects,user,scope}:any){const text={main:'الرئيسية',blog:'المدونة',offersPrefix:'عروض وباقات'};${raw.slice(begin,end)}\n}`);
const scope={navigationPathVisible:()=>true};
const paths=Array.from({length:6},(_,i)=>({id:`p${i}`,name:`مسار ${i}`,isActive:i!==5}));
paths.push({id:'child',name:'مسار فرعي',parentPathId:'p0'});
const levels=[{id:'level',pathId:'p0',name:'مرحلة'}];
const subjects=Array.from({length:12},(_,i)=>({id:`s${i}`,pathId:'p0',levelId:i<10?'level':'',name:`مادة ${i}`,icon:'📘',color:'#123456'}));
const settings={navigation:{moreLabel:'روابط أخرى',items:[{id:'home',label:'البداية',visible:true,order:0},{id:'p0',order:10},{id:'mock-exams',order:20},{id:'more',order:90}]}};
function input(role='student',homepageSettings=settings){return {homepageSettings,paths,levels,subjects,user:{role},scope};}
test('restored navigation builder exists as the renderer data source',()=>assert.equal(typeof restored.buildHeaderNavigation,'function'));
test('original hierarchy, all paths and twelve subjects retain original links without truncation',()=>{
 assert.equal(typeof restored.buildHeaderNavigation,'function');
 const args=input();const actual=restored.buildHeaderNavigation(args);assert.deepEqual(actual,source.original(args));
 assert.equal(actual.filter(i=>/^p\d$/.test(i.id)).length,5);
 const first=actual.find(i=>i.id==='p0');assert.equal(first.link,'/category/p0');assert.equal(first.children.find(i=>i.isGroup).subjects.length,10);
 assert.equal(first.children.find(i=>i.id==='s11').link,'/category/p0?subject=s11');
 assert.equal(first.children.find(i=>i.id==='p0_mock_exams').link,'/category/p0?tab=mock-exams');
 assert.equal(first.children.find(i=>i.id==='child').link,'/category/child');
});
test('visibility/order/custom labels and privileged inactive paths match executed source',()=>{
 assert.equal(typeof restored.buildHeaderNavigation,'function');
 for(const role of ['student','admin','teacher','supervisor','school_admin','parent']){
  const args=input(role);assert.deepEqual(restored.buildHeaderNavigation(args),source.original(args),role);
 }
 for(const navigation of [{showAutoPaths:false},{items:[{id:'home',visible:false},{id:'pricing',visible:false},{id:'blog',visible:false}]},{items:[{id:'home',label:'',order:100},{id:'more',order:0}]}]){
  const args=input('student',{navigation});assert.deepEqual(restored.buildHeaderNavigation(args),source.original(args));
 }
 const args=input();args.paths=[...paths,{id:'hidden',name:'مخفي',showInNavbar:false}];args.scope={navigationPathVisible:p=>p.id!=='p1'};
 assert.deepEqual(restored.buildHeaderNavigation(args),source.original(args));
});
