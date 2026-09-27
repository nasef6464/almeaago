import type{AuditPage,AuditQuery,OperationsReadiness}from'./operations-types';

const BASE=(import.meta.env.VITE_API_BASE_URL??'').replace(/\/$/,'');
function qs(query:AuditQuery={}){
 const p=new URLSearchParams();
 Object.entries(query).forEach(([k,v])=>{if(v!==undefined&&v!==null&&v!=='')p.set(k,String(v))});
 const raw=p.toString();return raw?'?'+raw:'';
}
async function request<T>(path:string,signal?:AbortSignal):Promise<T>{
 const response=await fetch(BASE+path,{credentials:'include',headers:{Accept:'application/json'},signal});
 if(!response.ok){const body=await response.json().catch(()=>({message:'تعذر تحميل بيانات التشغيل'}));throw new Error(body.message||'تعذر تحميل بيانات التشغيل')}
 return response.json() as Promise<T>;
}
export const operationsClient={
 readiness:(signal?:AbortSignal)=>request<OperationsReadiness>('/api/v1/operations/readiness',signal),
 audit:(query:AuditQuery={},signal?:AbortSignal)=>request<AuditPage>('/api/v1/operations/audit'+qs(query),signal),
};
