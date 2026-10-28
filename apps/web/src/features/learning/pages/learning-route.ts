export type LearningTab='courses'|'foundation'|'questions'|'exams'|'library';
type Catalog={paths:{id:string;code?:string}[];levels?:{id:string;pathId:string;code?:string}[];subjects:{id:string;pathId:string;levelId?:string;code?:string}[]};
const tabs:Record<string,LearningTab>={courses:'courses',skills:'foundation',foundation:'foundation',banks:'questions',questions:'questions',tests:'exams',exams:'exams',library:'library'};
export function resolveLearningRoute(legacyPath:string,params:URLSearchParams,catalog:Catalog){
 const requestedPath=legacyPath||params.get('pathId')||'';const path=catalog.paths.find(row=>row.id===requestedPath||row.code===requestedPath);
 const requestedLevel=params.get('level')||params.get('levelId')||'';const level=catalog.levels?.find(row=>row.pathId===path?.id&&(row.id===requestedLevel||row.code===requestedLevel));
 const requestedSubject=params.get('subjectId')||params.get('subject')||'';const subject=catalog.subjects.find(row=>row.pathId===path?.id&&(row.id===requestedSubject||row.code===requestedSubject)&&(!requestedLevel||row.levelId===level?.id));
 return {pathId:path?.id||'',subjectId:subject?.id||'',levelId:level?.id||'',tab:tabs[params.get('tab')||'courses']||'courses',invalidScope:Boolean((requestedPath&&!path)||(requestedLevel&&!level)||(requestedSubject&&!subject))};
}
export function updateLearningQuery(previous:URLSearchParams,field:'pathId'|'subjectId'|'tab',value:string,legacy:boolean){
 const next=new URLSearchParams(previous);
 if(field==='pathId'){next.delete('subject');next.delete('subjectId');next.delete('level');next.delete('levelId');if(legacy)next.delete('pathId');else value?next.set('pathId',value):next.delete('pathId');}
 if(field==='subjectId'){next.delete(legacy?'subjectId':'subject');const key=legacy?'subject':'subjectId';value?next.set(key,value):next.delete(key);}
 if(field==='tab')next.set('tab',value);
 return next;
}
