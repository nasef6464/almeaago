export type ReportingScopeKind='platform'|'school'|'teacher'|'supervisor'|'student';

export interface ReportingOverview{
  scope:{
    kind:ReportingScopeKind;
    schoolId?:string;
    classId?:string;
    studentCount:number;
    sampledStudentCount:number;
    isTruncated:boolean;
    limits:{students:number;results:number;attempts:number};
    canDetail:boolean;
    canExport:boolean;
  };
  assessment:{
    resultCount:number;
    sampledResultCount:number;
    resultsTruncated:boolean;
    attemptCount:number;
    sampledAttemptCount:number;
    attemptsTruncated:boolean;
    averageScore:number;
    passed:number;
    failed:number;
    passRate:number;
  };
  weakestSkills:Array<{
    skillId:string;
    skillName:string;
    evidenceCount:number;
    affectedStudents:number;
    mastery:number;
  }>;
}

export interface ReportingResult{
  attemptId:string;
  studentId:string;
  studentName:string;
  assessmentId:string;
  assessmentVersion:number;
  title:string;
  pathId:string;
  subjectId:string;
  score:number;
  passed:boolean;
  correctAnswers:number;
  wrongAnswers:number;
  unanswered:number;
  timeSpentSeconds:number;
  finalizedAt:string;
}

export interface ReportingResultPage{
  items:ReportingResult[];
  page:number;
  limit:number;
  total:number;
  hasMore:boolean;
}

export interface ReportingQuery{
  schoolId?:string;
  classId?:string;
  pathId?:string;
  subjectId?:string;
  dateFrom?:string;
  dateTo?:string;
  studentLimit?:number;
  resultLimit?:number;
  attemptLimit?:number;
}
