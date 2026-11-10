export type StudentReportPeriod = 'month' | 'quarter' | 'all';

export interface StudentAggregatedSkill {
  skill: string;
  skillId?: string;
  level?: 'main' | 'sub';
  parentSkillId?: string;
  parentSkill?: string;
  pathId?: string;
  subjectId?: string;
  sectionId?: string;
  subjectName?: string;
  sectionName?: string;
  mastery: number;
  recentMastery?: number;
  trend?: 'improving' | 'stable' | 'declining';
  confidence?: number;
  recentEvidence?: number;
  recentSampleSize?: number;
  attempts: number;
  correctAttempts: number;
  totalEvidence: number;
  isReliable: boolean;
  status: 'weak' | 'average' | 'strong';
}

export interface SkillRecommendation {
  lessonTitle?: string;
  lessonLink?: string;
  lessonVideoUrl?: string;
  lessonTopicTitle?: string;
  foundationTopicLink?: string;
  quizTitle?: string;
  quizLink?: string;
  supportLink?: string;
  resourceTitle?: string;
  resourceUrl?: string;
  subjectName?: string;
  sectionName?: string;
  actionText?: string;
}

export interface SmartRemediationPlan {
  title?: string;
  summary?: string;
  steps?: Array<{ day?: string; skill?: string; action?: string; check?: string }>;
  parentNote?: string;
}

export interface StudentWeeklyPlanItem {
  day: string;
  skill: string;
  skillId?: string;
  pathId?: string;
  subjectId?: string;
  sectionId?: string;
  subjectName?: string;
  sectionName?: string;
  mastery: number;
  actionText: string;
  lessonTitle?: string;
  lessonTopicTitle?: string;
  lessonLink?: string;
  quizTitle?: string;
  quizLink?: string;
}

export interface StudentPerformanceStats {
  averageScore: number;
  bestSubject: { name: string; score: number };
  worstSubject: { name: string; score: number };
  totalQuestions: number;
  uniqueSkills: number;
}

export interface StudentMasteryGoal {
  id: string;
  studentId?: string;
  pathId: string;
  subjectId?: string;
  targetType: 'topic' | 'section' | 'path';
  targetId: string;
  title: string;
  targetMastery: number;
  horizon: 'short' | 'long';
  dueDate?: string;
  status: 'active' | 'achieved' | 'archived';
}

export interface StudentReadinessDecision {
  status: 'needsMeasurement' | 'readyToAdvance' | 'needsPractice' | 'needsRemediation';
  readyToAdvance: boolean;
  badge: string;
  title: string;
  body: string;
  evidence: string;
  actionLabel: string;
  actionHref: string;
  cardClass: string;
  badgeClass: string;
  textClass: string;
  iconKey: 'target' | 'checkCircle' | 'fileText' | 'bookOpen';
}
