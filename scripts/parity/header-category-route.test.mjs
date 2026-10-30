import test from 'node:test';import assert from 'node:assert/strict';import {readFileSync,existsSync} from 'node:fs';import {createRequire} from 'node:module';
const require=createRequire(new URL('../../apps/web/package.json',import.meta.url));const ts=require('typescript');const url=new URL('../../apps/web/src/features/learning/pages/learning-route.ts',import.meta.url);const mod={exports:{}};
if(existsSync(url))new Function('require','module','exports',ts.transpileModule(readFileSync(url,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS}}).outputText)(require,mod,mod.exports);
const catalog={paths:[{id:'path-a',code:'qudrat'},{id:'path-b',code:'tahsili'}],levels:[{id:'level-a',code:'middle',pathId:'path-a'},{id:'level-b',pathId:'path-b'}],subjects:[{id:'sub-a',code:'math',pathId:'path-a',levelId:'level-a'},{id:'sub-a2',pathId:'path-a',levelId:'level-a'},{id:'sub-b',pathId:'path-b',levelId:'level-b'}]};
test('original category code/subject/level aliases resolve explicit identifiers, not names',()=>{
 assert.equal(typeof mod.exports.resolveLearningRoute,'function');
 assert.deepEqual(mod.exports.resolveLearningRoute('qudrat',new URLSearchParams('subject=math&level=middle&tab=tests'),catalog),{pathId:'path-a',subjectId:'sub-a',levelId:'level-a',tab:'exams',invalidScope:false});
 assert.equal(mod.exports.resolveLearningRoute('اسم مسار',new URLSearchParams(),catalog).pathId,'');
});
test('same-path query changes and history resolve the new subject and reject foreign scope',()=>{
 assert.equal(typeof mod.exports.resolveLearningRoute,'function');
 assert.equal(mod.exports.resolveLearningRoute('path-a',new URLSearchParams('subject=sub-a2'),catalog).subjectId,'sub-a2');
 assert.equal(mod.exports.resolveLearningRoute('path-a',new URLSearchParams('subject=sub-b'),catalog).invalidScope,true);
 assert.equal(mod.exports.resolveLearningRoute('path-a',new URLSearchParams('subject=sub-a&level=level-b'),catalog).subjectId,'');
});
test('selection preserves original query context and clears dependent scope on path change',()=>{
 assert.equal(typeof mod.exports.updateLearningQuery,'function');
 const params=new URLSearchParams('subject=sub-a&level=level-a&tab=library&ref=keep');
 assert.equal(mod.exports.updateLearningQuery(params,'subjectId','sub-a2',true).get('subject'),'sub-a2');
 const next=mod.exports.updateLearningQuery(params,'pathId','path-b',true);assert.equal(next.get('ref'),'keep');assert.equal(next.get('subject'),null);assert.equal(next.get('level'),null);assert.equal(next.get('tab'),'library');
});
