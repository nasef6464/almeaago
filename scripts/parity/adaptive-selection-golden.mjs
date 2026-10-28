// Source-executed oracle: do not replace with a second implementation.
import {buildServerNextBestAction as rank} from './learning-source/nextBestAction.ts';
import {createHash} from 'node:crypto';
import {readFileSync} from 'node:fs';
const bytes=readFileSync(new URL('./learning-source/nextBestAction.ts',import.meta.url));
if(createHash('sha1').update(`blob ${bytes.length}\0`).update(bytes).digest('hex')!=='0ebf7b2a08011e8f9bd66aa90ff41b348ede54dc')throw Error('Pinned adaptive source changed');
const now='2026-10-28T00:00:00Z';
const originalNow=Date.now;Date.now=()=>Date.parse(now);
const row=(skillId,extra={})=>({skillId,pathId:'p',subjectId:'s',mastery:60,status:'average',evidenceCount:3,attempts:3,...extra});
const scope={pathId:'p',subjectId:'s'};
const cases=[];
function add(name,rows,filter=scope){const result=rank(rows,filter);cases.push({name,scope:filter,rows,expected:result.candidates.map(({skillId,mastery,evidenceCount,action,trend})=>({skillId,mastery,evidenceCount,action,trend}))});}
try {
 add('declining beats lower mastery',[row('lower',{mastery:59}),row('declining',{recentEvidence:[{mastery:90,occurredAt:'2026-10-01'},{mastery:60,occurredAt:'2026-10-02'}]})]);
 add('status',[row('good',{mastery:59,status:'good'}),row('weak',{status:'weak'})]);
 add('insufficient evidence',[row('reliable',{mastery:59}),row('measure',{evidenceCount:2})]);
 add('recency',[row('fresh',{lastAttemptAt:now}),row('old',{lastAttemptAt:'2026-01-01'})]);
 add('stable ties and cap',Array.from({length:8},(_,i)=>row(String(i))));
 add('scope',[row('path',{pathId:'foreign',mastery:0}),row('subject',{subjectId:'foreign',mastery:0}),row('inside')]);
 add('optional subject',[row('a'),row('b',{subjectId:'other'})],{pathId:'p'});
 add('empty scope',[row('outside',{pathId:'foreign'})]);
 add('invalid future timestamps',[row('zero',{lastAttemptAt:'invalid'}),row('future',{lastAttemptAt:'2090-01-01'})]);
 add('evidence fallback and normalization',[row('fallback',{evidenceCount:0,attempts:2,mastery:-1}),row('max',{mastery:120}),row('negative',{evidenceCount:-1})]);
 add('unsorted and invalid evidence',[row('improving',{recentEvidence:[{mastery:90,occurredAt:'2026-10-03'},{mastery:40,occurredAt:'2026-10-01'},{mastery:0,occurredAt:'bad'}]}),row('stable')]);
 for(const mastery of [0,49.999,50,79.999,80,100])for(const evidenceCount of [0,2,3])add(`action ${mastery}/${evidenceCount}`,[row('skill',{mastery,evidenceCount,attempts:0})]);
 let seed=42;const rnd=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296};
 for(let c=0;c<40;c++)add(`multi ${c}`,Array.from({length:12},(_,i)=>row(`s${i}`,{mastery:Math.floor(rnd()*101),status:['weak','average','good','mastered'][Math.floor(rnd()*4)],evidenceCount:Math.floor(rnd()*7),lastAttemptAt:new Date(Date.parse(now)-Math.floor(rnd()*300)*86400000).toISOString(),recentEvidence:[{mastery:Math.floor(rnd()*101),occurredAt:'2026-09-01'},{mastery:Math.floor(rnd()*101),occurredAt:'2026-10-01'}],pathId:rnd()<.15?'foreign':'p',subjectId:rnd()<.15?'foreign':'s'})));
 const output=JSON.stringify({sourceBlob:'0ebf7b2a08011e8f9bd66aa90ff41b348ede54dc',now,cases})+'\n';
 if(process.argv[2]==='--check'){if(readFileSync(new URL('../../internal/learning/domain/testdata/adaptive_selection_golden.json',import.meta.url),'utf8')!==output)throw Error('Adaptive fixture drift');console.log(`PASS: ${cases.length} source-executed adaptive selection cases`);}else process.stdout.write(output);
} finally {Date.now=originalNow;}
