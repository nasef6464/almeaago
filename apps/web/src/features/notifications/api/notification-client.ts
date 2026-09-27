import type{NotificationCampaignResult,NotificationCampaignWrite,NotificationChannel,NotificationDelivery,NotificationPage,NotificationStatus,NotificationTemplate,NotificationTemplateWrite}from'./notification-types';

const BASE=(import.meta.env.VITE_API_BASE_URL??'').replace(/\/$/,'');
async function request<T>(path:string,init:RequestInit={},signal?:AbortSignal):Promise<T>{
 const response=await fetch(BASE+path,{...init,credentials:'include',signal,headers:{'Content-Type':'application/json',Accept:'application/json',...init.headers}});
 if(!response.ok){
  const body=await response.json().catch(()=>({message:'تعذر تنفيذ طلب الإشعارات'}));
  throw new Error(body.message||'تعذر تنفيذ طلب الإشعارات');
 }
 return response.status===204?undefined as T:response.json() as Promise<T>;
}
const query=(values:Record<string,string|number|undefined>)=>{
 const params=new URLSearchParams();
 Object.entries(values).forEach(([key,value])=>{if(value!==undefined&&value!=='')params.set(key,String(value))});
 const raw=params.toString();return raw?'?'+raw:'';
};

export const notificationClient={
 inbox:(page=1,limit=20,signal?:AbortSignal)=>request<NotificationPage<NotificationDelivery>>('/api/v1/notifications/me'+query({page,limit}),{},signal),
 unread:(signal?:AbortSignal)=>request<{unreadCount:number}>('/api/v1/notifications/me/unread-count',{},signal),
 markRead:(id:string,csrf:string)=>request<{notification:NotificationDelivery}>('/api/v1/notifications/'+encodeURIComponent(id)+'/read',{method:'PATCH',headers:{'X-CSRF-Token':csrf}}),
 markAllRead:(csrf:string)=>request<{modifiedCount:number}>('/api/v1/notifications/me/read-all',{method:'PATCH',headers:{'X-CSRF-Token':csrf}}),
 templates:(page=1,limit=50,signal?:AbortSignal)=>request<NotificationPage<NotificationTemplate>>('/api/v1/notifications/admin/templates'+query({page,limit}),{},signal),
 upsertTemplate:(write:NotificationTemplateWrite,csrf:string)=>request<{template:NotificationTemplate}>('/api/v1/notifications/admin/templates',{method:'POST',headers:{'X-CSRF-Token':csrf},body:JSON.stringify(write)}),
 deliveries:(page=1,limit=50,status?:NotificationStatus,channel?:NotificationChannel,signal?:AbortSignal)=>request<NotificationPage<NotificationDelivery>>('/api/v1/notifications/admin/deliveries'+query({page,limit,status,channel}),{},signal),
 send:(write:NotificationCampaignWrite,csrf:string)=>request<NotificationCampaignResult>('/api/v1/notifications/admin/send',{method:'POST',headers:{'X-CSRF-Token':csrf},body:JSON.stringify(write)}),
};
