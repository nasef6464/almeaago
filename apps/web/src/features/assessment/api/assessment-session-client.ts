import type {Attempt,AttemptQuestion,Result} from './attempt-client';

export type AssessmentSessionChannel='public'|'barcode'|'live';
export type AssessmentSessionStatus='scheduled'|'active'|'closed'|'cancelled';

export interface AssessmentSession{
  id:string;
  assessmentId:string;
  assessmentVersion:number;
  title:string;
  channel:AssessmentSessionChannel;
  sessionCode:string;
  status:AssessmentSessionStatus;
  schoolId:string;
  classId:string;
  opensAt:string|null;
  closesAt:string|null;
  maxSubmissions:number|null;
  createdAt:string;
  updatedAt:string;
}
export interface SessionPage{items:AssessmentSession[];page:number;limit:number;hasMore:boolean}
export interface SessionWrite{
  assessmentId:string;
  channel:AssessmentSessionChannel;
  schoolId:string;
  classId:string;
  opensAt:string|null;
  closesAt:string|null;
  maxSubmissions:number|null;
}
export interface PublicAttempt{
  id:string;
  sessionId:string;
  sessionCode:string;
  assessmentId:string;
  assessmentVersion:number;
  title:string;
  attemptNumber:number;
  status:'in_progress'|'submitted'|'expired';
  startedAt:string;
  expiresAt:string|null;
  showProgressBar:boolean;
  requireAnswerBeforeNext:boolean;
  optionLayout:string;
  questions:AttemptQuestion[];
}
export interface PublicSubmitResponse{resultVisible:boolean;result?:Result}
export interface LiveJoin{
  sessionId:string;
  assessmentId:string;
  assessmentVersion:number;
  title:string;
  sessionCode:string;
  opensAt:string|null;
  closesAt:string|null;
  attemptCount:number;
  maxAttempts:number;
  canStart:boolean;
}

const BASE=(import.meta.env.VITE_API_BASE_URL??'').replace(/\/$/,'');
async function req<T>(path:string,init:RequestInit={}):Promise<T>{
  const response=await fetch(BASE+path,{...init,credentials:'include',headers:{Accept:'application/json',...init.headers}});
  if(!response.ok){
    const body=await response.json().catch(()=>({message:'تعذر تنفيذ الطلب'}));
    throw new Error(body.message||'تعذر تنفيذ الطلب');
  }
  return response.json() as Promise<T>;
}

export const assessmentSessionClient={
  list:(assessmentId:string,page=1,limit=100,signal?:AbortSignal)=>req<SessionPage>(`/api/v1/assessment-sessions?assessmentId=${encodeURIComponent(assessmentId)}&page=${page}&limit=${limit}`,{signal}),
  create:(input:SessionWrite,csrf:string)=>req<{session:AssessmentSession}>('/api/v1/assessment-sessions',{method:'POST',headers:{'Content-Type':'application/json','X-CSRF-Token':csrf},body:JSON.stringify(input)}),
  status:(id:string,status:AssessmentSessionStatus,csrf:string)=>req<{session:AssessmentSession}>(`/api/v1/assessment-sessions/${encodeURIComponent(id)}/status`,{method:'PATCH',headers:{'Content-Type':'application/json','X-CSRF-Token':csrf},body:JSON.stringify({status})}),
  publicStart:(code:string,participantKey:string,startKey:string)=>req<{attempt:PublicAttempt}>(`/api/v1/public-assessments/${encodeURIComponent(code)}/start`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({participantKey,startKey})}),
  publicSubmit:(code:string,input:{participantKey:string;publicAttemptId:string;submissionKey:string;participantName:string;schoolName:string;classroomName:string;contact:string;timeSpentSeconds:number;answers:Array<{questionId:string;selectedOptionIndex:number|null}>})=>req<PublicSubmitResponse>(`/api/v1/public-assessments/${encodeURIComponent(code)}/submit`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(input)}),
  live:(code:string,signal?:AbortSignal)=>req<{session:LiveJoin}>(`/api/v1/assessment-sessions/join/${encodeURIComponent(code)}`,{signal}),
  startLive:(id:string,startKey:string,csrf:string)=>req<{attempt:Attempt}>(`/api/v1/assessment-sessions/${encodeURIComponent(id)}/start`,{method:'POST',headers:{'Content-Type':'application/json','X-CSRF-Token':csrf},body:JSON.stringify({startKey})})
};
