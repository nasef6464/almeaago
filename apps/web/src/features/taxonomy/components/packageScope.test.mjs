import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createRequire} from 'node:module';
const require=createRequire(import.meta.url), ts=require('typescript');
const module={exports:{}};
new Function('module','exports',ts.transpileModule(readFileSync(new URL('./packageScope.ts',import.meta.url),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS}}).outputText)(module,module.exports);
const {packageAppliesToPath}=module.exports;
test('path, subject and global package scopes do not leak into unrelated paths',()=>{
 const subjects=[{id:'s1',pathId:'p1'},{id:'s2',pathId:'p2'}];
 const item=(scopeType,pathId='',subjectId='')=>({scopeType,pathId,subjectId,courseId:'',contentType:''});
 assert.equal(packageAppliesToPath([item('path','p1')],'p1',subjects),true);
 assert.equal(packageAppliesToPath([item('path','p2')],'p1',subjects),false);
 assert.equal(packageAppliesToPath([item('subject','','s1')],'p1',subjects),true);
 assert.equal(packageAppliesToPath([item('subject','','s2')],'p1',subjects),false);
 assert.equal(packageAppliesToPath([{...item('course'),courseId:'c1'}],'p1',subjects,[{id:'c1',pathId:'p1'}]),true);
 assert.equal(packageAppliesToPath([{...item('course'),courseId:'c2'}],'p1',subjects,[{id:'c2',pathId:'p2'}]),false);
 assert.equal(packageAppliesToPath([item('all')],'p1',subjects),true);
});
