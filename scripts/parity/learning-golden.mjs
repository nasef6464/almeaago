// Run with Node >=24: execute the pinned original TypeScript, never reimplement it.
import {buildSkillStatus,buildRecommendedAction} from './learning-source/skillAnalytics.ts';
import {buildServerNextBestAction} from './learning-source/nextBestAction.ts';
import {createHash} from 'node:crypto';
import {readFileSync} from 'node:fs';
const source={repository:'nasef6464/almeaacodax',commit:'bf7281fc9fe34165a070e3d2d58f65f91b4a3ef7',files:{}};
for(const name of ['skillAnalytics','nextBestAction'])source.files[name]=createHash('sha256').update(readFileSync(new URL(`./learning-source/${name}.ts`,import.meta.url))).digest('hex');
const cases=[];
for(const mastery of [0,44,44.999,45,49.999,50,64.999,65,74.499,74.5,74.999,75,79.999,80,89.999,90,100])for(const attempts of [0,2,3])cases.push({mastery,attempts,status:buildSkillStatus(mastery),action:buildRecommendedAction(mastery,attempts)});
const adaptive=[];
for(const evidenceCount of [0,1,2,3])for(const mastery of [0,60,80]){
const row={skillId:'skill-1',pathId:'path-1',subjectId:'subject-1',mastery,status:buildSkillStatus(mastery),evidenceCount,attempts:0};
const result=buildServerNextBestAction([row],{pathId:'path-1',subjectId:'subject-1'});
adaptive.push({mastery,evidenceCount,action:result.nextAction.action});
}
const output=JSON.stringify({source,cases,adaptive},null,2)+'\n';
if(process.argv[2]==='--check'){
 try{
 const target=process.argv[3]||new URL('../../internal/learning/domain/testdata/legacy_learning_golden.json',import.meta.url);
 if(readFileSync(target,'utf8')!==output)throw new Error('Source oracle fixture drift');
 console.log('Source oracle verified: 51 shared cases, 12 adaptive observations');
 }catch(error){console.error(error.message);process.exitCode=1;}
}else process.stdout.write(output);
