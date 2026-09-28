import type {AssessmentAttempt} from './assessment-attempt-types';
const API_BASE=(import.meta.env.VITE_API_BASE_URL??'').replace(/\/$/,'');
async function request<T>(path:string,init:RequestInit={}):Promise<T>{const r=await fetch(`${API_BASE}${path}`,{...init,credentials:'include',headers:{Accept:'application/json',...init.headers}});if(!r.ok){let b:any={};try{b=await r.json()}catch{}throw new Error(b?.message||'تعذر تنفيذ الطلب الآن.')}return r.json() as Promise<T>}
export interface LearnerAssessmentAssignment{assignmentId:string;assessmentId:string;assessmentVersion:number;title:string;schoolId:string;opensAt:string|null;closesAt:string|null;supervisorMessage:string;attemptCount:number;maxAttempts:number;canStart:boolean}
export interface LearnerAssignmentPage{items:LearnerAssessmentAssignment[];page:number;limit:number;hasMore:boolean}
export const assessmentAssignmentClient={
 mine:(page=1,limit=30,signal?:AbortSignal)=>request<LearnerAssignmentPage>(`/api/v1/assessment-assignments/mine?page=${page}&limit=${limit}`,{signal}),
 start:(id:string,startKey:string,csrf:string)=>request<{attempt:AssessmentAttempt}>(`/api/v1/assessment-assignments/${encodeURIComponent(id)}/start`,{method:'POST',headers:{'Content-Type':'application/json','X-CSRF-Token':csrf},body:JSON.stringify({startKey})})
};
