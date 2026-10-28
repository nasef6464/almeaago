import assert from 'node:assert/strict';
import {buildServerNextBestAction as rank} from './learning-source/nextBestAction.ts';
const originalNow=Date.now;
Date.now=()=>Date.parse('2026-10-28T00:00:00Z');
const base={pathId:'p',subjectId:'s',mastery:60,status:'average',evidenceCount:3};
const row=(skillId,extra={})=>({...base,skillId,...extra});
try {
 const scope={pathId:'p',subjectId:'s'};
 const result=rank([row('lower',{mastery:59}),row('declining',{recentEvidence:[{mastery:90,occurredAt:'2026-10-01'},{mastery:60,occurredAt:'2026-10-02'}]}),row('foreign',{pathId:'other',mastery:0}),row('subject',{subjectId:'other',mastery:0})],scope);
 assert.deepEqual(result.candidates.map(x=>x.skillId),['declining','lower']);
 assert.equal(result.nextAction.action,'alternate_support_then_recheck');
 assert.equal(rank([row('measure',{evidenceCount:2})],scope).nextAction.action,'measure');
 assert.equal(rank([row('review',{mastery:80})],scope).nextAction.action,'mastery_review');
 assert.deepEqual(rank([row('fresh',{lastAttemptAt:'2026-10-28'}),row('old',{lastAttemptAt:'2026-01-01'})],scope).candidates.map(x=>x.skillId),['old','fresh']);
 assert.equal(rank(Array.from({length:6},(_,i)=>row(String(i))),scope).candidates.length,4);
 assert.equal(rank([row('foreign',{pathId:'other'})],scope).nextAction,null);
 assert.equal(rank([row('other',{subjectId:'other'})],{pathId:'p'}).candidates.length,1);
 assert.deepEqual(rank([row('a'),row('b')],scope).candidates.map(x=>x.skillId),['a','b']);
 assert.deepEqual(rank([row('a')],scope),rank([row('a')],scope));
 console.log('PASS: adaptive source ranking, evidence, recency, scope, cap, ties and deterministic clock');
} finally {Date.now=originalNow;}
