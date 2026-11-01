import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createRequire} from 'node:module';
const require=createRequire(new URL('../../apps/web/package.json',import.meta.url));
const ts=require('typescript');
const code=ts.transpileModule(readFileSync(new URL('../../apps/web/src/features/public/header/authAdapter.ts',import.meta.url),'utf8'),{
 compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020},
}).outputText;
const module={exports:{}};
new Function('require','exports','module',code)(name=>{
 if(name==='../../auth/state/AuthProvider')return {useAuth:()=>{throw new Error('React auth hook is outside this pure routing test')}};
 if(name==='../../presentation/defaultAvatar')return {DEFAULT_AVATAR:'synthetic-avatar'};
 throw new Error(`Unexpected dependency: ${name}`);
},module.exports,module);
const {afterHeaderLoginPath,headerAuthReturnPath,safeHeaderReturnTo}=module.exports;

test('standalone email login and Google return sentinel retain the role-dashboard decision',()=>{
 for(const pathname of ['/login','/signup']){
  assert.equal(afterHeaderLoginPath({pathname},'/admin-dashboard'),'/admin-dashboard');
  assert.equal(afterHeaderLoginPath({pathname},'/school-teacher-dashboard'),'/school-teacher-dashboard');
  assert.equal(headerAuthReturnPath({pathname}),pathname);
 }
 assert.equal(headerAuthReturnPath({pathname:'/course/lesson',search:'?subject=quant',hash:'#play'}),'/login');
});

test('explicit in-place email and Google auth preserve path scope query and fragment without reopening auth',()=>{
 const location={pathname:'/category/p',search:'?level=l&subject=s&tab=mock-exams&auth=login',hash:'#start'};
 const expected='/category/p?level=l&subject=s&tab=mock-exams#start';
 assert.equal(afterHeaderLoginPath(location,'/dashboard'),expected);
 assert.equal(headerAuthReturnPath(location),expected);
 const ordinary={...location,search:'?level=l&subject=s&tab=mock-exams'};
 assert.equal(afterHeaderLoginPath(ordinary,'/dashboard'),'/dashboard');
 assert.equal(headerAuthReturnPath(ordinary),'/login');
});

test('safe explicit returnTo overrides standalone routes and removes only its auth hint',()=>{
 const returnTo='/category/p?subject=s&auth=signup&tab=skills#support';
 const expected='/category/p?subject=s&tab=skills#support';
 assert.equal(safeHeaderReturnTo(returnTo),returnTo);
 for(const pathname of ['/login','/signup']){
  const location={pathname,search:'?returnTo='+encodeURIComponent(returnTo)};
  assert.equal(afterHeaderLoginPath(location,'/dashboard'),expected);
  assert.equal(headerAuthReturnPath(location),expected);
 }
});

test('unsafe explicit returnTo values reject external and browser-normalized targets',()=>{
 for(const unsafe of ['https://evil.test','//evil.test','/\\evil.test','/\t/evil.test','/\n/evil.test','/path\r\nLocation:evil']){
  assert.equal(safeHeaderReturnTo(unsafe),null,JSON.stringify(unsafe));
  const location={pathname:'/login',search:'?returnTo='+encodeURIComponent(unsafe)};
  assert.equal(afterHeaderLoginPath(location,'/dashboard'),'/dashboard');
  assert.equal(headerAuthReturnPath(location),'/login');
 }
});
