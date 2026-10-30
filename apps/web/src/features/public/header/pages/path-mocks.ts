import type {MockSummary} from './destination-model';
export function pathMockCatalog(rows:MockSummary[],pathId:string){const items=rows.filter(row=>row.pathId===pathId);return {items,totals:{count:items.length,questions:items.reduce((sum,row)=>sum+row.questionCount,0),sections:items.reduce((sum,row)=>sum+Math.max(row.sectionCount,1),0),minutes:items.reduce((sum,row)=>sum+row.timeLimitSeconds/60,0)}};}
export async function startPublishedMock({assessmentId,key,current,getCsrf,start}:{assessmentId:string;key:string;current:()=>boolean;getCsrf:()=>Promise<string>;start:(id:string,key:string,csrf:string)=>Promise<{attempt:{id:string}}>}){
 const changed=()=>Error('تغيّر الحساب؛ أعد المحاولة من جلستك الحالية.');
 if(!current())throw changed();
 const csrf=await getCsrf();if(!current())throw changed();
 const result=await start(assessmentId,key,csrf);if(!current())throw changed();
 if(!result.attempt?.id)throw Error('تعذر تأكيد بدء الاختبار.');
 return result.attempt.id;
}
