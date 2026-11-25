import type{
 AuditPage,
 AuditQuery,
 BackupExportRecord,
 BackupExportResult,
 BackupValidateResult,
 OperationsReadiness,
 PlatformIntegrationPatch,
 PlatformIntegrationState,
}from'./operations-types';

const BASE=(import.meta.env.VITE_API_BASE_URL??'').replace(/\/$/,'');
function qs(query:AuditQuery={}){
 const p=new URLSearchParams();
 Object.entries(query).forEach(([k,v])=>{if(v!==undefined&&v!==null&&v!=='')p.set(k,String(v))});
 const raw=p.toString();return raw?'?'+raw:'';
}
async function request<T>(path:string,initOrSignal?:RequestInit|AbortSignal):Promise<T>{
 const init:RequestInit=initOrSignal instanceof AbortSignal?{signal:initOrSignal}:(initOrSignal??{});
 const response=await fetch(BASE+path,{
  ...init,
  credentials:'include',
  headers:{Accept:'application/json',...(init.body?{'Content-Type':'application/json'}:{}),...init.headers},
 });
 if(!response.ok){const body=await response.json().catch(()=>({message:'تعذر تحميل بيانات التشغيل'}));throw new Error(body.message||'تعذر تحميل بيانات التشغيل')}
 return response.json() as Promise<T>;
}
export const operationsClient={
 readiness:(signal?:AbortSignal)=>request<OperationsReadiness>('/api/v1/operations/readiness',signal),
 audit:(query:AuditQuery={},signal?:AbortSignal)=>request<AuditPage>('/api/v1/operations/audit'+qs(query),signal),
 getIntegrations:(signal?:AbortSignal)=>request<PlatformIntegrationState>('/api/v1/operations/integrations',signal),
 updateIntegrations:(patch:PlatformIntegrationPatch,csrf:string)=>request<PlatformIntegrationState>('/api/v1/operations/integrations',{
  method:'PATCH',
  headers:{'X-CSRF-Token':csrf},
  body:JSON.stringify(patch),
 }),
 backups:(signal?:AbortSignal)=>request<{items:BackupExportRecord[];total:number}>('/api/v1/operations/backups',signal),
 exportBackup:(csrf:string)=>request<BackupExportResult>('/api/v1/operations/backups/export',{
  method:'POST',
  headers:{'X-CSRF-Token':csrf},
 }),
 validateBackup:(payload:{kind:string;schemaVersion:number;summary:Record<string,number>;collections:Record<string,unknown[]>},csrf:string)=>request<BackupValidateResult>('/api/v1/operations/backups/validate',{
  method:'POST',
  headers:{'X-CSRF-Token':csrf},
  body:JSON.stringify(payload),
 }),
};
