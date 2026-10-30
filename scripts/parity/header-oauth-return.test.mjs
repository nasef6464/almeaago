import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createRequire} from 'node:module';
const require=createRequire(new URL('../../apps/web/package.json',import.meta.url));const ts=require('typescript');
const module={exports:{}};
function load(){new Function('exports','module',ts.transpileModule(readFileSync(new URL('../../apps/web/src/features/auth/utils/oauth-return.ts',import.meta.url),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS}}).outputText)(module.exports,module);return module.exports.oauthReturnPath;}
test('standalone Google login and signup complete at the authenticated role dashboard',()=>{
 const resolve=load();assert.equal(resolve('/login','/admin-dashboard'),'/admin-dashboard');assert.equal(resolve('/signup','/dashboard'),'/dashboard');
});
test('in-place OAuth preserves context and rejects unsafe browser navigation',()=>{
 const resolve=load();assert.equal(resolve('/category/p?tab=mock-exams#start','/dashboard'),'/category/p?tab=mock-exams#start');
 for(const unsafe of ['https://evil.test','//evil.test','/\\evil.test','/\t/evil.test','/\n/evil.test'])assert.equal(resolve(unsafe,'/dashboard'),'/');
});
