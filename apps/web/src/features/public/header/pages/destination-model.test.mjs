import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import ts from 'typescript';
const path=new URL('./destination-model.ts',import.meta.url);
const load=()=>import('data:text/javascript;base64,'+Buffer.from(ts.transpileModule(readFileSync(path,'utf8'),{compilerOptions:{module:ts.ModuleKind.ESNext}}).outputText).toString('base64'));
test('mock summaries preserve original visibility, path sorting and section/time fallback',async()=>{
 const {visibleMockPaths,mockPathSummary}=await load();
 const paths=[{id:'hidden',name:'مخفي',showInNavbar:false},{id:'t',name:'التحصيلي'},{id:'q',name:'القدرات'},{id:'off',name:'غير نشط',isActive:false},{id:'mockoff',name:'معطل',settings:{showMockExamCard:false}}];
 assert.deepEqual(visibleMockPaths(paths,'student').map(x=>x.id),['q','t']);assert.equal(visibleMockPaths(paths,'teacher').length,3);
 assert.deepEqual(mockPathSummary([{pathId:'q',questionCount:120,sectionCount:4,timeLimitSeconds:7200},{pathId:'q',questionCount:10,sectionCount:0,timeLimitSeconds:3600}], 'q'),{count:2,totalQuestions:130,totalSections:5,nearestTime:120});
});
