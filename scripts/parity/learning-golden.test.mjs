import test from 'node:test';
import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import {mkdtempSync,writeFileSync,rmSync,cpSync,appendFileSync} from 'node:fs';
import {join,resolve} from 'node:path';
const run=(...args)=>spawnSync(process.execPath,[...process.execArgv,'scripts/parity/learning-golden.mjs',...args],{encoding:'utf8'});
test('generated source oracle agrees byte-for-byte with committed fixture',()=>assert.equal(run('--check').status,0));
test('rejects corrupt and missing oracle fixtures instead of blessing drift',()=>{
 const dir=mkdtempSync('.learning-golden-');
 try{const bad=join(dir,'bad.json');writeFileSync(bad,'{}');assert.notEqual(run('--check',bad).status,0);assert.notEqual(run('--check',join(dir,'missing.json')).status,0);}finally{rmSync(dir,{recursive:true});}
});

test('rejects changed source even when regenerating the oracle',()=>{
 const dir=mkdtempSync('.learning-source-');
 try{
 cpSync('scripts/parity',join(dir,'parity'),{recursive:true});
 appendFileSync(join(dir,'parity/learning-source/skillAnalytics.ts'),'\n// changed source\n');
 const result=spawnSync(process.execPath,[...process.execArgv,resolve(dir,'parity/learning-golden.mjs')],{encoding:'utf8'});
 assert.notEqual(result.status,0);
 }finally{rmSync(dir,{recursive:true});}
});
