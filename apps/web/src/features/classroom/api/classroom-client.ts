import type{
 ClassroomAggregate,ClassroomAttendance,ClassroomAttendanceStatus,ClassroomBatch,ClassroomChallenge,
 ClassroomCompetition,ClassroomPresentation,ClassroomPublishedMode,ClassroomQuestionPage,ClassroomReport,
 ClassroomSession,ClassroomStudentState,SchoolContract
}from'./classroom-types';

const BASE=(import.meta.env.VITE_API_BASE_URL??'').replace(/\/$/,'');
async function request<T>(path:string,init:RequestInit={},signal?:AbortSignal):Promise<T>{
 const response=await fetch(BASE+path,{...init,credentials:'include',signal,headers:{Accept:'application/json','Content-Type':'application/json',...init.headers}});
 if(!response.ok){const body=await response.json().catch(()=>({message:'تعذر تنفيذ طلب الفصل الذكي'}));throw new Error(body.message||'تعذر تنفيذ طلب الفصل الذكي')}
 return response.json() as Promise<T>;
}
function query(values:Record<string,string|number|undefined>){
 const p=new URLSearchParams();Object.entries(values).forEach(([k,v])=>{if(v!==undefined&&v!=='')p.set(k,String(v))});return p.toString();
}
export const classroomClient={
 questions(input:{schoolId:string;classId:string;subjectId:string;search?:string;page?:number;limit?:number},signal?:AbortSignal){
  return request<ClassroomQuestionPage>('/api/v1/classroom/questions?'+query({...input,page:input.page||1,limit:input.limit||30}),{},signal);
 },
 teacherSessions(signal?:AbortSignal){return request<{sessions:ClassroomSession[]}>('/api/v1/classroom/teacher/sessions',{},signal)},
 create(input:{schoolId:string;classId:string;subjectId:string;questionIds:string[];day:string;period:number|null;publishedMode:ClassroomPublishedMode},csrf:string){
  return request<{session:ClassroomSession;pin:string}>('/api/v1/classroom/sessions',{method:'POST',headers:{'X-CSRF-Token':csrf},body:JSON.stringify(input)});
 },
 start(id:string,expectedRevision:number,csrf:string){return request<{session:ClassroomSession}>(`/api/v1/classroom/sessions/${encodeURIComponent(id)}/start`,{method:'POST',headers:{'X-CSRF-Token':csrf},body:JSON.stringify({expectedRevision})})},
 appendBatch(id:string,label:string,questionIds:string[],csrf:string){return request<{batch:ClassroomBatch}>(`/api/v1/classroom/sessions/${encodeURIComponent(id)}/batches`,{method:'POST',headers:{'X-CSRF-Token':csrf},body:JSON.stringify({label,questionIds})})},
 publish(id:string,ordinal:number,csrf:string){return request<{session:ClassroomSession}>(`/api/v1/classroom/sessions/${encodeURIComponent(id)}/publish/${ordinal}`,{method:'POST',headers:{'X-CSRF-Token':csrf},body:'{}'})},
 reveal(id:string,ordinal:number,csrf:string){return request<{question:unknown}>(`/api/v1/classroom/sessions/${encodeURIComponent(id)}/reveal/${ordinal}`,{method:'POST',headers:{'X-CSRF-Token':csrf},body:'{}'})},
 endBatch(id:string,batchId:string,csrf:string){return request<{batch:ClassroomBatch}>(`/api/v1/classroom/sessions/${encodeURIComponent(id)}/batches/${encodeURIComponent(batchId)}/end`,{method:'POST',headers:{'X-CSRF-Token':csrf},body:'{}'})},
 joinByPin(pin:string,csrf:string,method:'pin'|'qr'='pin'){return request<{participant:unknown;session:ClassroomSession}>(`/api/v1/classroom/join-by-pin`,{method:'POST',headers:{'X-CSRF-Token':csrf},body:JSON.stringify({pin,method})})},
 join(id:string,csrf:string){return request<{joined:boolean;session:ClassroomSession}>(`/api/v1/classroom/sessions/${encodeURIComponent(id)}/join`,{method:'POST',headers:{'X-CSRF-Token':csrf},body:'{}'})},
 current(id:string,signal?:AbortSignal){return request<{state:ClassroomStudentState}>(`/api/v1/classroom/sessions/${encodeURIComponent(id)}/current`,{},signal)},
 answer(id:string,ordinal:number,selectedOptionIndex:number,csrf:string){return request<{response:{questionOrdinal:number;selectedOptionIndex:number;submittedAt:string;updatedAt:string}}>(`/api/v1/classroom/sessions/${encodeURIComponent(id)}/answers/${ordinal}`,{method:'PUT',headers:{'X-CSRF-Token':csrf},body:JSON.stringify({selectedOptionIndex})})},
 aggregate(id:string,signal?:AbortSignal){return request<{aggregate:ClassroomAggregate}>(`/api/v1/classroom/sessions/${encodeURIComponent(id)}/aggregate`,{},signal)},
 presentation(id:string,signal?:AbortSignal){return request<{presentation:ClassroomPresentation}>(`/api/v1/classroom/sessions/${encodeURIComponent(id)}/presentation`,{},signal)},
 attendanceSnapshot(id:string,signal?:AbortSignal){return request<{attendance:ClassroomAttendance}>(`/api/v1/classroom/sessions/${encodeURIComponent(id)}/attendance`,{},signal)},
 attendance(id:string,studentId:string,status:ClassroomAttendanceStatus,csrf:string){return request<{participant:unknown}>(`/api/v1/classroom/sessions/${encodeURIComponent(id)}/participants/${encodeURIComponent(studentId)}/attendance`,{method:'PATCH',headers:{'X-CSRF-Token':csrf},body:JSON.stringify({status})})},
 challengeState(id:string,signal?:AbortSignal){return request<{challenge:ClassroomChallenge|null}>(`/api/v1/classroom/sessions/${encodeURIComponent(id)}/challenge-state`,{},signal)},
 configureCompetition(id:string,durationSeconds:number,csrf:string){return request<{challenge:ClassroomChallenge}>(`/api/v1/classroom/sessions/${encodeURIComponent(id)}/competition/configure`,{method:'POST',headers:{'X-CSRF-Token':csrf},body:JSON.stringify({durationSeconds})})},
 endCompetition(id:string,csrf:string){return request<{challenge:ClassroomChallenge}>(`/api/v1/classroom/sessions/${encodeURIComponent(id)}/competition/end`,{method:'POST',headers:{'X-CSRF-Token':csrf},body:'{}'})},
 competition(id:string,signal?:AbortSignal){return request<{competition:ClassroomCompetition}>(`/api/v1/classroom/sessions/${encodeURIComponent(id)}/competition`,{},signal)},
 end(id:string,csrf:string){return request<{report:ClassroomReport;finalizedAt:string}>(`/api/v1/classroom/sessions/${encodeURIComponent(id)}/end`,{method:'POST',headers:{'X-CSRF-Token':csrf},body:'{}'})},
 report(id:string,signal?:AbortSignal){return request<{report:ClassroomReport;finalizedAt:string}>(`/api/v1/classroom/sessions/${encodeURIComponent(id)}/report`,{},signal)},
 contract(schoolId:string,signal?:AbortSignal){return request<{contract:SchoolContract}>(`/api/v1/school-contracts/${encodeURIComponent(schoolId)}`,{},signal)},
 saveContract(schoolId:string,input:{status:'active'|'inactive'|'expired';modules:string[];validFrom:string|null;validUntil:string|null;expectedRevision:number},csrf:string){return request<{contract:SchoolContract}>(`/api/v1/school-contracts/${encodeURIComponent(schoolId)}`,{method:'PUT',headers:{'X-CSRF-Token':csrf},body:JSON.stringify(input)})},
 websocket(id:string){
  const target=new URL(`/api/v1/classroom/sessions/${encodeURIComponent(id)}/stream`,BASE||window.location.origin);
  target.protocol=target.protocol==='https:'?'wss:':'ws:';
  return new WebSocket(target.toString());
 }
};
