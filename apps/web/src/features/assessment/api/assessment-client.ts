import type {AssessmentDetail,AssessmentFilters,AssessmentPage,AssessmentSummary,AssessmentWorkflowStatus,AssessmentWriteInput,QuestionPage} from './assessment-types';
const API_BASE=(import.meta.env.VITE_API_BASE_URL??'').replace(/\/$/,'');
type ErrorBody={message?:string;error?:{message?:string}};
async function request<T>(path:string,init:RequestInit={}):Promise<T>{const r=await fetch(`${API_BASE}${path}`,{...init,credentials:'include',headers:{Accept:'application/json',...init.headers}});if(!r.ok){let b:ErrorBody={};try{b=await r.json() as ErrorBody}catch{}throw new Error(b.error?.message||b.message||'تعذر تنفيذ الطلب الآن.')}return await r.json() as T}
function qs(f:AssessmentFilters){const p=new URLSearchParams();p.set('page',String(f.page||1));p.set('limit',String(f.limit||50));if(f.pathId)p.set('pathId',f.pathId);if(f.subjectId)p.set('subjectId',f.subjectId);if(f.workflowStatus)p.set('workflowStatus',f.workflowStatus);if(f.kind)p.set('kind',f.kind);if(f.search)p.set('search',f.search);return p.toString()}
export const assessmentClient={
 list:async(f:AssessmentFilters,s?:AbortSignal):Promise<AssessmentPage>=>{
   const raw=await request<any>(`/api/v1/assessments?${qs(f)}`,{signal:s});
   const rawItems=(raw?.items||raw?.Items||[]);
   const items:AssessmentSummary[]=rawItems.map((x:any)=>({
     id:x.id??x.ID??'',
     code:x.code??x.Code??'',
     title:x.title??x.Title??'',
     pathId:x.pathId??x.PathID??'',
     subjectId:x.subjectId??x.SubjectID??'',
     kind:(x.kind??x.Kind??'normal') as 'normal'|'mock',
     workflowStatus:x.workflowStatus??x.WorkflowStatus??'draft',
     ownerType:x.ownerType??x.OwnerType??'platform',
     revision:Number(x.revision??x.Revision??0),
     currentVersion:Number(x.currentVersion??x.CurrentVersion??1),
     isPublished:Boolean(x.isPublished??x.IsPublished??false),
     updatedAt:x.updatedAt??x.UpdatedAt??'',
   }));
   return{
     items,
     page:Number(raw?.page??raw?.Page??1),
     limit:Number(raw?.limit??raw?.Limit??50),
     hasMore:Boolean(raw?.hasMore??raw?.HasMore??false),
   };
 },
 get:async(id:string,s?:AbortSignal):Promise<{assessment:AssessmentDetail}>=>{
   const raw=await request<any>(`/api/v1/assessments/${encodeURIComponent(id)}`,{signal:s});
   const a=raw?.assessment||raw?.Assessment||raw;
   const v=a?.version||a?.Version||{};
   const normalized:AssessmentDetail={
     id:a?.id??a?.ID??'',
     code:a?.code??a?.Code??'',
     title:a?.title??a?.Title??v?.title??v?.Title??'',
     pathId:a?.pathId??a?.PathID??v?.pathId??v?.PathID??'',
     subjectId:a?.subjectId??a?.SubjectID??v?.subjectId??v?.SubjectID??'',
     kind:(a?.kind??a?.Kind??v?.kind??v?.Kind??'normal'),
     workflowStatus:a?.workflowStatus??a?.WorkflowStatus??'draft',
     ownerType:a?.ownerType??a?.OwnerType??'platform',
     ownerUserId:a?.ownerUserId??a?.OwnerUserID??'',
     ownerSchoolId:a?.ownerSchoolId??a?.OwnerSchoolID??'',
     assignedTeacherId:a?.assignedTeacherId??a?.AssignedTeacherID??'',
     reviewerNotes:a?.reviewerNotes??a?.ReviewerNotes??'',
     isVisible:Boolean(a?.isVisible??a?.IsVisible??false),
     isPublished:Boolean(a?.isPublished??a?.IsPublished??false),
     revision:Number(a?.revision??a?.Revision??0),
     currentVersion:Number(a?.currentVersion??a?.CurrentVersion??1),
     updatedAt:a?.updatedAt??a?.UpdatedAt??'',
     version:v,
     sections:(a?.sections||a?.Sections||[]).map((sec:any)=>({
       id:sec?.id??sec?.ID??'',
       title:sec?.title??sec?.Title??'',
       subjectId:sec?.subjectId??sec?.SubjectID??'',
       sortOrder:Number(sec?.sortOrder??sec?.SortOrder??0),
       timeLimitSeconds:sec?.timeLimitSeconds??sec?.TimeLimitSeconds??null,
       domain:sec?.domain??sec?.Domain??'',
       strictLock:Boolean(sec?.strictLock??sec?.StrictLock??false),
     })),
     questions:(a?.questions||a?.Questions||[]).map((q:any)=>({
       questionId:q?.questionId??q?.QuestionID??'',
       questionVersion:Number(q?.questionVersion??q?.QuestionVersion??1),
       sectionId:q?.sectionId??q?.SectionID??'',
       sortOrder:Number(q?.sortOrder??q?.SortOrder??0),
       points:Number(q?.points??q?.Points??1),
     })),
   };
   return{assessment:normalized};
 },
 create:(input:AssessmentWriteInput,csrf:string)=>request<{assessment:AssessmentDetail}>('/api/v1/assessments',{method:'POST',headers:{'Content-Type':'application/json','X-CSRF-Token':csrf},body:JSON.stringify(input)}),
 update:(id:string,input:AssessmentWriteInput,csrf:string)=>request<{assessment:AssessmentDetail}>(`/api/v1/assessments/${encodeURIComponent(id)}`,{method:'PATCH',headers:{'Content-Type':'application/json','X-CSRF-Token':csrf},body:JSON.stringify(input)}),
 workflow:(id:string,expectedRevision:number,status:AssessmentWorkflowStatus,reviewerNotes:string,csrf:string)=>request<{assessment:AssessmentDetail}>(`/api/v1/assessments/${encodeURIComponent(id)}/workflow`,{method:'POST',headers:{'Content-Type':'application/json','X-CSRF-Token':csrf},body:JSON.stringify({expectedRevision,status,reviewerNotes})}),
 publication:(id:string,expectedRevision:number,published:boolean,csrf:string)=>request<{assessment:AssessmentDetail}>(`/api/v1/assessments/${encodeURIComponent(id)}/publication`,{method:'POST',headers:{'Content-Type':'application/json','X-CSRF-Token':csrf},body:JSON.stringify({expectedRevision,published})}),
 questions:(pathId:string,subjectId:string,search:string,difficulty?:string,limit=50,s?:AbortSignal)=>{const p=new URLSearchParams({page:'1',limit:String(limit),pathId,subjectId,workflowStatus:'approved'});if(search)p.set('search',search);if(difficulty&&difficulty!=='all')p.set('difficulty',difficulty);return request<QuestionPage>(`/api/v1/questions?${p}`,{signal:s})}
};
