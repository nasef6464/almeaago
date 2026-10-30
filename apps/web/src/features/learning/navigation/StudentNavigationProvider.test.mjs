import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createRequire} from 'node:module';
const require=createRequire(import.meta.url),ts=require('typescript');
function compile(name){return ts.transpileModule(readFileSync(new URL(name,import.meta.url),'utf8').replaceAll('import.meta.env.VITE_API_BASE_URL',"''"),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020,jsx:ts.JsxEmit.React}}).outputText}
const scopeModule={exports:{}};new Function('module','exports',compile('./studentPathScope.ts'))(scopeModule,scopeModule.exports);
const deferred=()=>{let resolve,reject;const promise=new Promise((a,b)=>{resolve=a;reject=b});return {promise,resolve,reject}};
const student={id:'student',role:'student'};
const catalog=(name='original')=>({paths:[{id:'p',name}],levels:[],subjects:[]});
const preferences=(id='student',ids=[])=>({user:{id,enrolledPaths:ids,pathStageSelections:[]}});
function harness(initialUser=student){
 let auth={user:initialUser,loading:false,getCsrfToken:async()=>'csrf'},cursor=0,dirty=true,value;
 const slots=[],effects=[],requests=[];const events=new EventTarget();
 const React={createContext:()=>({Provider:Symbol('Provider')}),createElement:(_type,props)=>props.value,
 useRef(initial){const i=cursor++;return slots[i]??=( {current:initial})},
 useState(initial){const i=cursor++;if(!(i in slots))slots[i]=typeof initial==='function'?initial():initial;return [slots[i],next=>{const v=typeof next==='function'?next(slots[i]):next;if(!Object.is(v,slots[i])){slots[i]=v;dirty=true}}]},
 useMemo(fn){cursor++;return fn()},
 useEffect(fn,deps){const i=cursor++,old=slots[i];if(!old||deps.some((d,j)=>!Object.is(d,old.deps[j]))){effects.push(()=>{old?.cleanup?.();slots[i]={deps,fn,cleanup:fn()}})}},useContext:()=>null};React.default=React;
 const fetch=(_url,init={})=>{const d=deferred();requests.push({url:_url,init,...d,reply(body,status=200){d.resolve({ok:status>=200&&status<300,json:async()=>body})}});return d.promise};
 const module={exports:{}};new Function('require','module','exports','fetch','window',compile('./StudentNavigationProvider.tsx'))(name=>name==='react'?React:name==='react-router-dom'?{useLocation:()=>({pathname:'/dashboard'})}:name.includes('AuthProvider')?{useAuth:()=>auth}:name.includes('useHomepageSettings')?{useHomepageSettings:()=>({studentExperience:{visibilityMode:'enrolled'}})}:name.includes('studentPathScope')?scopeModule.exports:null,module,module.exports,fetch,events);
 const render=()=>{for(let i=0;dirty;i++){assert(i<30,'render loop');dirty=false;cursor=0;value=module.exports.StudentNavigationProvider({children:null});while(effects.length)effects.shift()()}return value};
 const flush=async()=>{for(let i=0;i<12;i++){await Promise.resolve();render()}return value};
 render();
 return {get state(){return render()},requests,flush,refresh(){events.dispatchEvent(new Event('almeaa:taxonomy-updated'));render()},switchUser(user){auth={...auth,user};dirty=true;render()},replayEffects(){for(const slot of slots){if(slot?.fn){slot.cleanup?.();slot.cleanup=slot.fn()}}render()},dispose(){for(const slot of slots)slot?.cleanup?.()}};
}
test('guest remains catalog-loading until catalog resolves; null prefs fails closed and keeps enrollment unavailable',async()=>{
 const guest=harness(null);assert.equal(guest.state.catalogLoading,true);assert.equal(guest.state.preferencesLoading,false);assert.equal(guest.state.loading,true);assert.equal(guest.requests.length,1);guest.requests[0].reply(catalog());await guest.flush();assert.equal(guest.state.loading,false);assert.equal(guest.state.enrollmentOpen,false);guest.dispose();
 const h=harness();h.requests[0].reply(catalog());h.requests[1].reply({user:null});await h.flush();assert.equal(h.state.preferencesLoading,false);assert.match(h.state.preferencesError,/تعذر/);await assert.rejects(h.state.enrollPath('p'));assert.equal(h.requests.length,2);h.dispose();
});
test('taxonomy refresh updates catalog only and latest event beats stale response without replacing saved enrollment',async()=>{
 const h=harness();h.requests[0].reply(catalog());h.requests[1].reply(preferences());await h.flush();const save=h.state.enrollPath('p');await h.flush();const patch=h.requests.at(-1);assert.equal(patch.init.method,'PATCH');patch.reply(preferences('student',['p']));await save;await h.flush();
 h.refresh();const old=h.requests.at(-1);assert.equal(h.state.catalogLoading,true);h.refresh();const latest=h.requests.at(-1);latest.reply(catalog('new'));await h.flush();old.reply(catalog('stale'));await h.flush();assert.equal(h.state.paths[0].name,'new');assert.deepEqual(h.state.enrolledPaths,['p']);assert.equal(h.requests.filter(r=>r.url.includes('navigation-preferences')&&!r.init.method).length,1);h.dispose();
});
test('switching accounts and logout discard old loads, selected path and enrollment overlay',async()=>{
 const h=harness();const oldCatalog=h.requests[0],oldPrefs=h.requests[1];h.switchUser({id:'admin',role:'admin'});assert.deepEqual(h.state.paths,[]);assert.deepEqual(h.state.enrolledPaths,[]);h.state.openEnrollment('p');assert.equal(h.state.enrollmentOpen,false);oldCatalog.reply(catalog('old actor'));oldPrefs.reply(preferences('student',['p']));await h.flush();assert.deepEqual(h.state.paths,[]);assert.deepEqual(h.state.enrolledPaths,[]);
 h.requests[2].reply(catalog('admin'));h.requests[3].reply(preferences('admin'));await h.flush();assert.equal(h.state.paths[0].name,'admin');h.switchUser(null);assert.equal(h.state.user.id,'guest');assert.deepEqual(h.state.paths,[]);assert.deepEqual(h.state.enrolledPaths,[]);assert.equal(h.state.selectedPathId,'');assert.equal(h.state.enrollmentOpen,false);h.dispose();
});
test('failed save retains saved preferences and dialog; delayed write cannot change next actor',async()=>{
 const h=harness();h.requests[0].reply(catalog());h.requests[1].reply(preferences());await h.flush();h.state.openEnrollment('p');assert.equal(h.state.enrollmentOpen,true);let save=h.state.enrollPath('p');await h.flush();h.requests.at(-1).reply({message:'save failed'},500);await assert.rejects(save,/save failed/);await h.flush();assert.equal(h.state.enrollmentOpen,true);assert.deepEqual(h.state.enrolledPaths,[]);
 save=h.state.enrollPath('p');await h.flush();const patch=h.requests.at(-1);h.switchUser({id:'other',role:'student'});patch.reply(preferences('student',['p']));await assert.rejects(save,/تغيّر الحساب/);await h.flush();assert.deepEqual(h.state.enrolledPaths,[]);assert.equal(h.state.enrollmentOpen,false);h.dispose();
});

test('same-user effect replay old preference GET cannot overwrite a newer confirmed save',async()=>{
 const h=harness();const oldPrefs=h.requests[1];h.replayEffects();h.requests[2].reply(catalog());h.requests[3].reply(preferences());await h.flush();assert.equal(h.state.loading,false);const save=h.state.enrollPath('p');await h.flush();h.requests.at(-1).reply(preferences('student',['p']));await save;await h.flush();oldPrefs.reply(preferences());await h.flush();assert.deepEqual(h.state.enrolledPaths,['p']);h.dispose();
});
