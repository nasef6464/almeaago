import type{AiAdminCopilotResult,AiAdminReadiness,AiInteractionPage,AiProvider,AiProviderSetting,AiProviderTestResult,AiProviderWrite,AiQuestionAssistResult,AiHelpLevel,AiUsageSummary}from'./ai-types';

const BASE=(import.meta.env.VITE_API_BASE_URL??'').replace(/\/$/,'');
async function request<T>(path:string,init:RequestInit={},signal?:AbortSignal):Promise<T>{
 const response=await fetch(BASE+path,{...init,credentials:'include',signal,headers:{Accept:'application/json',...init.headers}});
 if(!response.ok){
  const body=await response.json().catch(()=>({message:'تعذر تنفيذ طلب الذكاء الاصطناعي'}));
  throw new Error(body.message||'تعذر تنفيذ طلب الذكاء الاصطناعي');
 }
 return response.json() as Promise<T>;
}

export const aiClient={
 providers:(signal?:AbortSignal)=>request<{items:AiProviderSetting[]}>('/api/v1/ai/admin/providers',{},signal),
 updateProvider:(provider:AiProvider,write:AiProviderWrite,csrf:string)=>request<{provider:AiProviderSetting}>('/api/v1/ai/admin/providers/'+encodeURIComponent(provider),{method:'PATCH',headers:{'Content-Type':'application/json','X-CSRF-Token':csrf},body:JSON.stringify(write)}),
 testProvider:(provider:AiProvider,csrf:string)=>request<{result:AiProviderTestResult}>('/api/v1/ai/admin/providers/'+encodeURIComponent(provider)+'/test',{method:'POST',headers:{'X-CSRF-Token':csrf}}),
 interactions:(page=1,limit=50,signal?:AbortSignal)=>request<AiInteractionPage>(`/api/v1/ai/admin/interactions?page=${page}&limit=${limit}`,{},signal),
 usage:(signal?:AbortSignal)=>request<{usage:AiUsageSummary}>('/api/v1/ai/admin/usage',{},signal),
 readiness:(signal?:AbortSignal)=>request<{readiness:AiAdminReadiness}>('/api/v1/ai/admin/readiness',{},signal),
 copilot:(message:string,csrf:string)=>request<{result:AiAdminCopilotResult}>('/api/v1/ai/admin/copilot',{method:'POST',headers:{'Content-Type':'application/json','X-CSRF-Token':csrf},body:JSON.stringify({message})}),
 questionAssistant:(input:{reviewCardId:string;helpLevel:AiHelpLevel;message:string},csrf:string)=>request<{result:AiQuestionAssistResult}>('/api/v1/ai/question-assistant',{method:'POST',headers:{'Content-Type':'application/json','X-CSRF-Token':csrf},body:JSON.stringify(input)}),
};
