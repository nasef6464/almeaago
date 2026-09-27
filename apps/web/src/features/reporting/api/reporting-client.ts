import type{ReportingOverview,ReportingQuery,ReportingResultPage}from'./reporting-types';

const BASE=(import.meta.env.VITE_API_BASE_URL??'').replace(/\/$/,'');
function qs(query:ReportingQuery&{page?:number;limit?:number}={}){
  const params=new URLSearchParams();
  Object.entries(query).forEach(([key,value])=>{if(value!==undefined&&value!==null&&value!=='')params.set(key,String(value))});
  const raw=params.toString();return raw?'?'+raw:'';
}
async function request<T>(path:string,signal?:AbortSignal):Promise<T>{
  const response=await fetch(BASE+path,{credentials:'include',headers:{Accept:'application/json'},signal});
  if(!response.ok){const body=await response.json().catch(()=>({message:'تعذر تحميل التقرير'}));throw new Error(body.message||'تعذر تحميل التقرير')}
  return response.json() as Promise<T>;
}
export const reportingClient={
  overview:(query:ReportingQuery={},signal?:AbortSignal)=>request<ReportingOverview>('/api/v1/reports/overview'+qs(query),signal),
  results:(query:ReportingQuery={},page=1,limit=20,signal?:AbortSignal)=>request<ReportingResultPage>('/api/v1/reports/results'+qs({...query,page,limit}),signal),
  async exportCsv(query:ReportingQuery={}){
    const response=await fetch(BASE+'/api/v1/reports/results.csv'+qs(query),{credentials:'include',headers:{Accept:'text/csv'}});
    if(!response.ok){const body=await response.json().catch(()=>({message:'تعذر تصدير التقرير'}));throw new Error(body.message||'تعذر تصدير التقرير')}
    return response.blob();
  },
};
