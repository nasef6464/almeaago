import type {AssessmentDetail,AssessmentFilters,AssessmentPage,AssessmentWorkflowStatus,AssessmentWriteInput,QuestionPage} from './assessment-types';
const API_BASE=(import.meta.env.VITE_API_BASE_URL??'').replace(/\/$/,'');
type ErrorBody={message?:string;error?:{message?:string}};
async function request<T>(path:string,init:RequestInit={}):Promise<T>{const r=await fetch(`${API_BASE}${path}`,{...init,credentials:'include',headers:{Accept:'application/json',...init.headers}});if(!r.ok){let b:ErrorBody={};try{b=await r.json() as ErrorBody}catch{}throw new Error(b.error?.message||b.message||'تعذر تنفيذ الطلب الآن.')}return await r.json() as T}
function qs(f:AssessmentFilters){const p=new URLSearchParams();p.set('page',String(f.page||1));p.set('limit',String(f.limit||50));if(f.pathId)p.set('pathId',f.pathId);if(f.subjectId)p.set('subjectId',f.subjectId);if(f.workflowStatus)p.set('workflowStatus',f.workflowStatus);if(f.search)p.set('search',f.search);return p.toString()}
export const assessmentClient={
 list:(f:AssessmentFilters,s?:AbortSignal)=>request<AssessmentPage>(`/api/v1/assessments?${qs(f)}`,{signal:s}),
 get:(id:string,s?:AbortSignal)=>request<{assessment:AssessmentDetail}>(`/api/v1/assessments/${encodeURIComponent(id)}`,{signal:s}),
 create:(input:AssessmentWriteInput,csrf:string)=>request<{assessment:AssessmentDetail}>('/api/v1/assessments',{method:'POST',headers:{'Content-Type':'application/json','X-CSRF-Token':csrf},body:JSON.stringify(input)}),
 update:(id:string,input:AssessmentWriteInput,csrf:string)=>request<{assessment:AssessmentDetail}>(`/api/v1/assessments/${encodeURIComponent(id)}`,{method:'PATCH',headers:{'Content-Type':'application/json','X-CSRF-Token':csrf},body:JSON.stringify(input)}),
 workflow:(id:string,expectedRevision:number,status:AssessmentWorkflowStatus,reviewerNotes:string,csrf:string)=>request<{assessment:AssessmentDetail}>(`/api/v1/assessments/${encodeURIComponent(id)}/workflow`,{method:'POST',headers:{'Content-Type':'application/json','X-CSRF-Token':csrf},body:JSON.stringify({expectedRevision,status,reviewerNotes})}),
 publication:(id:string,expectedRevision:number,published:boolean,csrf:string)=>request<{assessment:AssessmentDetail}>(`/api/v1/assessments/${encodeURIComponent(id)}/publication`,{method:'POST',headers:{'Content-Type':'application/json','X-CSRF-Token':csrf},body:JSON.stringify({expectedRevision,published})}),
 questions:(pathId:string,subjectId:string,search:string,s?:AbortSignal)=>{const p=new URLSearchParams({page:'1',limit:'50',pathId,subjectId,workflowStatus:'approved'});if(search)p.set('search',search);return request<QuestionPage>(`/api/v1/questions?${p}`,{signal:s})}
};
