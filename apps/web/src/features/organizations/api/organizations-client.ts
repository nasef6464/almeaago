export interface SchoolContext{
  schoolId:string;
  schoolName:string;
  role:'student'|'teacher'|'supervisor'|'school_admin'|'parent';
  permissions:string[];
  modules:string[];
  source:string;
}
export interface SchoolClass{id:string;schoolId:string;code:string;name:string;status:string}
export interface RosterMember{userId:string;name:string;email:string;status:string;roles:string[];classIds:string[]}
export interface TeacherWorkspaceAssignment{assignmentId:string;classId:string;className:string;subjectId:string;studentCount:number}
export interface TeacherWorkspaceSchool{schoolId:string;schoolName:string;source:string;assignments:TeacherWorkspaceAssignment[]}
export interface TeacherWorkspace{personas:{platformTrainer:boolean;schoolTeacher:boolean};schools:TeacherWorkspaceSchool[]}
export interface SchoolSummary{id:string;code:string;name:string;status:string}
export interface DirectorStudent{studentId:string;name:string;email:string;phone:string;isActive:boolean;classId:string|null;className:string|null}
export interface DirectorTeacher{teacherId:string;name:string;email:string;isActive:boolean}
export interface DirectorAssignment{assignmentId:string;teacherId:string;classId:string;subjectId:string;status:string}
export interface DirectorOverview{
  school:{schoolId:string;schoolName:string};
  metrics:{students:number;classes:number;teachers:number;supervisors:number;schoolAssessments:number;completedSmartClasses:number};
  classes:{classId:string;className:string}[];
}
export interface DirectorAssessment{
  id:string;
  title:string;
  subjectId?:string;
  targetGroupIds:string[];
  isPublished:boolean;
}
export interface DirectorAssessmentWorkspace{
  assessments:DirectorAssessment[];
  classes:{classId:string;className:string}[];
}
export interface DirectorAssessmentReport{
  coverage:{complete:boolean;missingEvidence:string[];subjects:{completed:number;withEvidence:number;complete:boolean}};
  audience:{targeted:number};
  participation:{completed:number;notCompleted:number;started:number|null};
  scores:{average:number|null;passRate:number|null;highest:number|null;lowest:number|null};
  subjects:unknown[];sections:unknown[];skills:unknown[];subjectBreakdowns:unknown[];
}
export type DirectorAssessmentLearnerStatus='all'|'completed'|'not_completed'|'needs_support';
export interface DirectorAssessmentLearnerEvidence{id:string;score:number;passed:boolean;date:string;attemptNumber:number}
export interface DirectorAssessmentLearner{studentId:string;name:string;result:DirectorAssessmentLearnerEvidence|null}
export interface DirectorAssessmentLearnerPage{
  learners:DirectorAssessmentLearner[];
  pagination:{page:number;limit:number;total:number;totalPages:number};
}
export interface DirectorAssessmentResultDimension{
  id:string;name:string;score:number;totalQuestions:number;correctAnswers:number;wrongAnswers:number;unanswered:number;
}
export interface DirectorAssessmentLearnerResult{
  result:{id:string;studentId:string;score:number;passed:boolean;attemptNumber:number;date:string;
    totalQuestions:number;correctAnswers:number;wrongAnswers:number;unanswered:number;timeSpentSeconds:number;
    sectionResults:DirectorAssessmentResultDimension[];skillsAnalysis:DirectorAssessmentResultDimension[]};
}
export interface DirectorAssessmentQuestion{
  id:string;questionCode:string;text:string;type:string;imageUrl:string;imageAlt:string;currentVersion:number;
}
export interface DirectorAssessmentQuestionPage{items:DirectorAssessmentQuestion[];hasMore:boolean}
export interface DirectorAssessmentCreateInput{
  title:string;targetScope:'school'|'class'|'classes';classId:string;classIds?:string[];pathId:string;subjectId:string;questionIds:string[];
}
const BASE=(import.meta.env.VITE_API_BASE_URL??'').replace(/\/$/,'');
async function request<T>(path:string,init:RequestInit={}):Promise<T>{
  const r=await fetch(BASE+path,{...init,credentials:'include',headers:{Accept:'application/json',...(init.body?{'Content-Type':'application/json'}:{}),...init.headers}});
  if(!r.ok){const b=await r.json().catch(()=>({message:'تعذر تنفيذ الطلب'}));throw new Error(b.message||'تعذر تنفيذ الطلب')}
  return r.json() as Promise<T>;
}
function csrfHeaders(csrf:string){return {'X-CSRF-Token':csrf}}
export const organizationsClient={
  schools(signal?:AbortSignal){
    return request<{schools:SchoolSummary[];pagination:{page:number;limit:number;total:number;totalPages:number}}>(
      '/api/v1/schools/?page=1&limit=100&status=active',{signal});
  },
  teacherWorkspace(signal?:AbortSignal){
    return request<TeacherWorkspace>('/api/v1/schools/teacher-workspace',{signal});
  },
  contexts(signal?:AbortSignal){return request<{contexts:SchoolContext[]}>('/api/v1/schools/context',{signal})},
  directorOverview(schoolId:string,signal?:AbortSignal){
    return request<DirectorOverview>(`/api/school-access/director/schools/${encodeURIComponent(schoolId)}/overview`,{signal});
  },
  directorAssessments(schoolId:string,signal?:AbortSignal){
    return request<DirectorAssessmentWorkspace>(`/api/school-access/director/schools/${encodeURIComponent(schoolId)}/academic/assessments`,{signal});
  },
  directorAssessmentReport(schoolId:string,assessmentId:string,signal?:AbortSignal){
    return request<DirectorAssessmentReport>(`/api/school-access/director/schools/${encodeURIComponent(schoolId)}/academic/assessments/${encodeURIComponent(assessmentId)}/report`,{signal});
  },
  directorAssessmentLearners(schoolId:string,assessmentId:string,filters:{page:number;limit:number;status:DirectorAssessmentLearnerStatus;search:string},signal?:AbortSignal){
    const query=new URLSearchParams({page:String(filters.page),limit:String(filters.limit),status:filters.status,search:filters.search});
    return request<DirectorAssessmentLearnerPage>(`/api/school-access/director/schools/${encodeURIComponent(schoolId)}/academic/assessments/${encodeURIComponent(assessmentId)}/learners?${query}`,{signal});
  },
  directorAssessmentLearnerResult(schoolId:string,assessmentId:string,attemptId:string,signal?:AbortSignal){
    return request<DirectorAssessmentLearnerResult>(`/api/school-access/director/schools/${encodeURIComponent(schoolId)}/academic/assessments/${encodeURIComponent(assessmentId)}/results/${encodeURIComponent(attemptId)}`,{signal});
  },
  directorAssessmentQuestions(schoolId:string,pathId:string,subjectId:string,search:string,page:number,signal?:AbortSignal){
    const q=new URLSearchParams({pathId,subjectId,search,page:String(page),limit:'20'});
    return request<DirectorAssessmentQuestionPage>(`/api/school-access/director/schools/${encodeURIComponent(schoolId)}/academic/available-questions?${q}`,{signal});
  },
  createDirectorAssessment(schoolId:string,input:DirectorAssessmentCreateInput,csrf:string,requestKey:string){
    return request<{assessment:{assessmentId:string;title:string;classId:string;classIds?:string[];targetScope:'school'|'class'|'classes'}}>(`/api/school-access/director/schools/${encodeURIComponent(schoolId)}/academic/assessments`,{
      method:'POST',headers:{...csrfHeaders(csrf),'Idempotency-Key':requestKey},body:JSON.stringify(input),
    });
  },
  classes(schoolId:string,signal?:AbortSignal){
    return request<{classes:SchoolClass[];pagination:{page:number;limit:number;total:number;totalPages:number}}>(
      `/api/v1/schools/${encodeURIComponent(schoolId)}/classes?page=1&limit=100&status=active`,{signal});
  },
  students(schoolId:string,classId:string,signal?:AbortSignal){
    const p=new URLSearchParams({page:'1',limit:'100',role:'student',isActive:'true',classId});
    return request<{members:RosterMember[];pagination:{page:number;limit:number;total:number;totalPages:number}}>(
      `/api/v1/schools/${encodeURIComponent(schoolId)}/roster?${p.toString()}`,{signal});
  },
  directorStudents(schoolId:string,search='',signal?:AbortSignal){
    const q=search.trim()?`?search=${encodeURIComponent(search.trim())}`:'';
    return request<{students:DirectorStudent[];total:number}>(`/api/school-access/director/schools/${encodeURIComponent(schoolId)}/students${q}`,{signal});
  },
  addDirectorStudent(schoolId:string,payload:{name:string;email:string;password:string;classId:string},csrf:string){
    return request<{student:DirectorStudent;created:boolean}>(`/api/school-access/director/schools/${encodeURIComponent(schoolId)}/students`,{method:'POST',headers:csrfHeaders(csrf),body:JSON.stringify(payload)});
  },
  moveDirectorStudent(schoolId:string,studentId:string,classId:string,csrf:string){
    return request<{student:DirectorStudent;idempotent:boolean}>(`/api/school-access/director/schools/${encodeURIComponent(schoolId)}/students/${encodeURIComponent(studentId)}/class`,{method:'PUT',headers:csrfHeaders(csrf),body:JSON.stringify({classId})});
  },
  updateDirectorStudent(schoolId:string,studentId:string,payload:{name?:string;phone?:string},csrf:string){
    return request<{student:DirectorStudent}>(`/api/school-access/director/schools/${encodeURIComponent(schoolId)}/students/${encodeURIComponent(studentId)}`,{method:'PATCH',headers:csrfHeaders(csrf),body:JSON.stringify(payload)});
  },
  setDirectorStudentActive(schoolId:string,studentId:string,isActive:boolean,csrf:string){
    return request<{student:DirectorStudent}>(`/api/school-access/director/schools/${encodeURIComponent(schoolId)}/students/${encodeURIComponent(studentId)}/active`,{method:'PATCH',headers:csrfHeaders(csrf),body:JSON.stringify({isActive})});
  },
  createDirectorClass(schoolId:string,name:string,csrf:string){
    return request<{classroom:{classId:string;className:string}}>(`/api/school-access/director/schools/${encodeURIComponent(schoolId)}/classes`,{method:'POST',headers:csrfHeaders(csrf),body:JSON.stringify({name})});
  },
  renameDirectorClass(schoolId:string,classId:string,name:string,csrf:string){
    return request<{classroom:{classId:string;className:string}}>(`/api/school-access/director/schools/${encodeURIComponent(schoolId)}/classes/${encodeURIComponent(classId)}`,{method:'PATCH',headers:csrfHeaders(csrf),body:JSON.stringify({name})});
  },
  directorTeachers(schoolId:string,signal?:AbortSignal){
    return request<{teachers:DirectorTeacher[];assignments:DirectorAssignment[]}>(`/api/school-access/director/schools/${encodeURIComponent(schoolId)}/teachers`,{signal});
  },
  upsertDirectorAssignment(schoolId:string,payload:{teacherId:string;classId:string;subjectId?:string;status:'active'|'inactive'},csrf:string){
    return request<{assignment:DirectorAssignment}>(`/api/school-access/director/schools/${encodeURIComponent(schoolId)}/assignments`,{method:'PUT',headers:csrfHeaders(csrf),body:JSON.stringify(payload)});
  },
};
