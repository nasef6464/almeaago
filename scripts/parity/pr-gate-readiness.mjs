#!/usr/bin/env node
// Read-only, exact-HEAD audit. Green CI is not Legacy↔Go parity.
import {appendFileSync} from 'node:fs';
import {pathToFileURL} from 'node:url';

export const GATES=['Backend CI','Frontend CI','Database CI','Frontend E2E'];
export function classify(pr,runs){
  if(!pr?.head?.sha || !Number.isInteger(pr.number) || !Array.isArray(runs))throw Error('Invalid audit input');
  const gates=GATES.map(name=>{
    const matching=runs.filter(r=>r.name===name && r.head_sha===pr.head.sha &&
      r.event==='pull_request' && (!r.head_branch || r.head_branch===pr.head.ref))
      .sort((a,b)=>String(b.created_at||'').localeCompare(String(a.created_at||''))||Number(b.id||0)-Number(a.id||0));
    const r=matching[0];
    return {name,id:r?.id||null,status:!r?'MISSING':r.status!=='completed'?'PENDING':
      r.conclusion==='success'?'PASS':['failure','timed_out','cancelled'].includes(r.conclusion)?'FAIL':'NOT_PASS'};
  });
  return {number:pr.number,sha:pr.head.sha,draft:!!pr.draft,gates,
    decision:gates.some(g=>g.status==='FAIL')?'BLOCKED_CI':
      gates.every(g=>g.status==='PASS')?'CI_ONLY_VERIFIED':'PARTIAL_CI'};
}
export function report(rows,repo){
  const lines=['# Open PR exact-HEAD CI (not UI parity)','',
    'Green workflows do NOT prove Legacy parity, real PostgreSQL journeys or RBAC.','',
    '| PR | SHA | Draft | Backend | Frontend | Database | E2E | Decision |',
    '|---|---|---|---|---|---|---|---|'];
  for(const r of rows){
    const cells=r.gates.map(g=>g.id?'['+g.status+'](https://github.com/'+repo+'/actions/runs/'+g.id+')':g.status);
    lines.push('| [#'+r.number+'](https://github.com/'+repo+'/pull/'+r.number+') | '+r.sha.slice(0,12)+
      ' | '+(r.draft?'yes':'no')+' | '+cells.join(' | ')+' | '+r.decision+' |');
  }
  return lines.join('\n')+'\n';
}
async function request(path,token){
  const res=await fetch('https://api.github.com'+path,{headers:{
    Authorization:'Bearer '+token,Accept:'application/vnd.github+json',
    'X-GitHub-Api-Version':'2022-11-28','User-Agent':'almeaa-ci-readiness'}});
  if(!res.ok)throw Error('GitHub API '+res.status+' on '+path);
  return res.json();
}
async function pages(path,token,select){
  const result=[];
  for(let page=1;page<=20;page++){
    const data=await request(path+(path.includes('?')?'&':'?')+'per_page=100&page='+page,token);
    const batch=select(data);
    if(!Array.isArray(batch))throw Error('Unexpected API payload');
    result.push(...batch);
    if(batch.length<100)return result;
  }
  throw Error('Incomplete pagination: cannot certify gates');
}
export async function audit(repo,token){
  if(!/^[\w.-]+\/[\w.-]+$/.test(repo)||!token)throw Error('Valid repo and GITHUB_TOKEN required');
  const base='/repos/'+repo;
  const prs=await pages(base+'/pulls?state=open',token,d=>d);
  const rows=[];
  for(const pr of prs){
    const runs=await pages(base+'/actions/runs?head_sha='+encodeURIComponent(pr.head.sha)+
      '&event=pull_request',token,d=>d.workflow_runs);
    rows.push(classify(pr,runs));
  }
  return rows.sort((a,b)=>b.number-a.number);
}
if(process.argv[1] && import.meta.url===pathToFileURL(process.argv[1]).href){
  audit(process.env.GITHUB_REPOSITORY||'nasef6464/almeaago',process.env.GITHUB_TOKEN)
    .then(rows=>{
      const md=report(rows,process.env.GITHUB_REPOSITORY||'nasef6464/almeaago');
      process.stdout.write(md);
      if(process.env.GITHUB_STEP_SUMMARY)appendFileSync(process.env.GITHUB_STEP_SUMMARY,md);
      if(process.argv.includes('--strict')&&rows.some(r=>r.decision!=='CI_ONLY_VERIFIED'))process.exitCode=1;
    }).catch(e=>{console.error(e.message);process.exitCode=2});
}
