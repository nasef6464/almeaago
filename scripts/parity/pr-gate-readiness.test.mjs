import test from 'node:test';
import assert from 'node:assert/strict';
import {GATES,classify,report} from './pr-gate-readiness.mjs';
const sha='abcdef1234567890123456789012345678901234';
const pr={number:171,draft:true,head:{sha,ref:'student'}};
const run=(name,conclusion='success',other={})=>({
  id:1,name,head_sha:sha,head_branch:'student',event:'pull_request',
  status:'completed',conclusion,created_at:'2026-10-29T10:00:00Z',...other});
test('four exact-head green gates are CI-only',()=>{
  const r=classify(pr,GATES.map(g=>run(g)));
  assert.equal(r.decision,'CI_ONLY_VERIFIED');
  assert.match(report([r],'nasef6464/almeaago'),/not UI parity/);
});
test('one failing E2E blocks three passing gates',()=>{
  assert.equal(classify(pr,GATES.map(g=>run(g,g==='Frontend E2E'?'failure':'success'))).decision,'BLOCKED_CI');
});
test('missing Backend and Database do not pass',()=>{
  const r=classify(pr,['Frontend CI','Frontend E2E'].map(g=>run(g)));
  assert.equal(r.decision,'PARTIAL_CI');
  assert.deepEqual(r.gates.filter(g=>g.status==='MISSING').map(g=>g.name),['Backend CI','Database CI']);
});
test('old SHA is never accepted',()=>{
  assert.equal(classify(pr,GATES.map(g=>run(g,'success',{head_sha:'old'}))).decision,'PARTIAL_CI');
});
test('different head branch is never accepted',()=>{
  assert.equal(classify(pr,GATES.map(g=>run(g,'success',{head_branch:'other'}))).decision,'PARTIAL_CI');
});
test('latest failed run overrides earlier success; newer retry restores PASS',()=>{
  const runs=GATES.map(g=>run(g));
  runs.push(run('Frontend E2E','failure',{id:2,created_at:'2026-10-29T11:00:00Z'}));
  assert.equal(classify(pr,runs).decision,'BLOCKED_CI');
  runs.push(run('Frontend E2E','success',{id:3,created_at:'2026-10-29T12:00:00Z'}));
  assert.equal(classify(pr,runs).decision,'CI_ONLY_VERIFIED');
});
test('pending, cancelled and skipped are never all green',()=>{
  const r=classify(pr,[run('Backend CI','cancelled'),run('Frontend CI','skipped'),
    run('Database CI','success',{status:'in_progress'}),run('Frontend E2E')]);
  assert.deepEqual(r.gates.map(g=>g.status),['FAIL','NOT_PASS','PENDING','PASS']);
});
test('non-draft red PR stays blocked; invalid inputs fail closed',()=>{
  assert.equal(classify({...pr,draft:false},GATES.map(g=>run(g,'failure'))).decision,'BLOCKED_CI');
  assert.throws(()=>classify({number:1,head:{}},[]));
  assert.throws(()=>classify(pr,null));
});
