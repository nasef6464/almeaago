import type{ParentDashboard,ParentPaymentApproval,ParentResultPage,ParentWeeklyReport,ParentWeeklyReportSendResult}from './parents-types';

const BASE=(import.meta.env.VITE_API_BASE_URL??'').replace(/\/$/,'');
async function request<T>(path:string,init:RequestInit={},signal?:AbortSignal):Promise<T>{
 const response=await fetch(BASE+path,{...init,credentials:'include',headers:{'Content-Type':'application/json',Accept:'application/json',...init.headers},signal});
 if(!response.ok){
  const body=await response.json().catch(()=>({message:'تعذر تحميل بيانات ولي الأمر'}));
  throw new Error(body.message||'تعذر تحميل بيانات ولي الأمر');
 }
 return response.json() as Promise<T>;
}

export const parentsClient={
 dashboard:(page=1,limit=20,signal?:AbortSignal)=>request<ParentDashboard>(`/api/v1/parents/dashboard?page=${page}&limit=${limit}`,{},signal),
 results:(studentId:string,page=1,limit=20,signal?:AbortSignal)=>request<ParentResultPage>(`/api/v1/parents/children/${encodeURIComponent(studentId)}/results?page=${page}&limit=${limit}`,{},signal),
 weeklyReport:(page=1,limit=20,signal?:AbortSignal)=>request<ParentWeeklyReport>(`/api/v1/parents/weekly-report?page=${page}&limit=${limit}`,{},signal),
 sendWeeklyReport:(csrf:string)=>request<ParentWeeklyReportSendResult>('/api/v1/parents/weekly-report/send',{method:'POST',headers:{'X-CSRF-Token':csrf}}),
 approvals:(signal?:AbortSignal)=>request<{items:ParentPaymentApproval[]}>('/api/v1/parents/approvals',{},signal),
 decideApproval:(requestId:string,decision:'approved'|'rejected',expectedRevision:number,csrf:string)=>request<{approval:ParentPaymentApproval;message:string}>(`/api/v1/parents/approvals/${encodeURIComponent(requestId)}/${decision==='approved'?'approve':'reject'}`,{method:'POST',headers:{'X-CSRF-Token':csrf},body:JSON.stringify({expectedRevision})}),
 unlinkStudent:(studentId:string,csrf:string)=>request<{studentId:string;message:string}>(`/api/v1/parents/linked-students/${encodeURIComponent(studentId)}`,{method:'DELETE',headers:{'X-CSRF-Token':csrf}}),
};
