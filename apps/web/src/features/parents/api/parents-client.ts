import type{ParentDashboard,ParentResultPage,ParentWeeklyReport}from './parents-types';

const BASE=(import.meta.env.VITE_API_BASE_URL??'').replace(/\/$/,'');
async function request<T>(path:string,signal?:AbortSignal):Promise<T>{
 const response=await fetch(BASE+path,{credentials:'include',headers:{Accept:'application/json'},signal});
 if(!response.ok){
  const body=await response.json().catch(()=>({message:'تعذر تحميل بيانات ولي الأمر'}));
  throw new Error(body.message||'تعذر تحميل بيانات ولي الأمر');
 }
 return response.json() as Promise<T>;
}

export const parentsClient={
 dashboard:(page=1,limit=20,signal?:AbortSignal)=>request<ParentDashboard>(`/api/v1/parents/dashboard?page=${page}&limit=${limit}`,signal),
 results:(studentId:string,page=1,limit=20,signal?:AbortSignal)=>request<ParentResultPage>(`/api/v1/parents/children/${encodeURIComponent(studentId)}/results?page=${page}&limit=${limit}`,signal),
 weeklyReport:(page=1,limit=20,signal?:AbortSignal)=>request<ParentWeeklyReport>(`/api/v1/parents/weekly-report?page=${page}&limit=${limit}`,signal),
};
