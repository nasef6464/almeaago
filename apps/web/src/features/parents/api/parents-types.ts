export interface ParentResultSummary{
  attemptId:string;
  assessmentId:string;
  assessmentVersion:number;
  title:string;
  attemptNumber:number;
  score:number;
  totalQuestions:number;
  correctAnswers:number;
  wrongAnswers:number;
  unanswered:number;
  passed:boolean;
  timeSpentSeconds:number;
  finalizedAt:string;
}

export interface ParentWeakSkill{
  pathId:string;
  subjectId:string;
  skillId:string;
  skillName:string;
  mastery:number;
  status:string;
  attempts:number;
  evidenceCount:number;
  recommendedAction:string;
  lastEvidenceAt:string;
}

export interface ParentChildSummary{
  studentId:string;
  name:string;
  avatarUrl:string;
  schoolIds:string[];
  weeklyStudyMinutes:number;
  weeklyAssessmentCount:number;
  weeklyAverageScore:number;
  recentResults:ParentResultSummary[];
  weakSkills:ParentWeakSkill[];
  nextAction:string;
}

export interface ParentDashboard{
  children:ParentChildSummary[];
  summary:{
    totalChildren:number;
    visibleChildren:number;
    weeklyAssessmentCount:number;
    weeklyAverageScore:number;
    weakSkills:number;
  };
  page:number;
  limit:number;
  hasMore:boolean;
}

export interface ParentResultPage{
  items:ParentResultSummary[];
  page:number;
  limit:number;
  hasMore:boolean;
}

export interface ParentWeeklyChildReport{
  studentId:string;
  name:string;
  avatarUrl:string;
  schoolIds:string[];
  assessmentCount:number;
  averageScore:number;
  studyMinutes:number;
  weakSkills:ParentWeakSkill[];
  nextAction:string;
}

export interface ParentWeeklyReport{
  periodStart:string;
  periodEnd:string;
  children:ParentWeeklyChildReport[];
  page:number;
  limit:number;
  hasMore:boolean;
}
