export type ContentWorkflowStatus =
  | 'draft'
  | 'pending_review'
  | 'approved'
  | 'rejected'
  | 'archived';

export interface ContentListFilters {
  page?: number;
  limit?: number;
  pathId?: string;
  subjectId?: string;
  search?: string;
  workflowStatus?: ContentWorkflowStatus | '';
}

export interface PageResult<T> {
  items: T[];
  page: number;
  limit: number;
  hasMore: boolean;
}

export interface CourseSummary {
  id: string;
  pathId: string;
  subjectId: string;
  title: string;
  instructorName: string;
  durationMinutes: number;
  level: string;
  ownerType: string;
  ownerUserId: string;
  ownerSchoolId: string;
  assignedTeacherId: string;
  workflowStatus: ContentWorkflowStatus;
  isVisible: boolean;
  isPublished: boolean;
  revision: number;
  updatedAt: string;
}

export interface LessonSummary {
  id: string;
  pathId: string;
  subjectId: string;
  title: string;
  type: string;
  durationSeconds: number;
  ownerType: string;
  ownerUserId: string;
  ownerSchoolId: string;
  assignedTeacherId: string;
  workflowStatus: ContentWorkflowStatus;
  isVisible: boolean;
  isLocked: boolean;
  revision: number;
  updatedAt: string;
}

export interface LibrarySummary {
  id: string;
  pathId: string;
  subjectId: string;
  title: string;
  type: string;
  ownerType: string;
  ownerUserId: string;
  ownerSchoolId: string;
  assignedTeacherId: string;
  workflowStatus: ContentWorkflowStatus;
  isVisible: boolean;
  isLocked: boolean;
  revision: number;
  updatedAt: string;
}

export interface FoundationTopicSummary {
  id: string;
  pathId: string;
  subjectId: string;
  parentTopicId: string;
  code: string;
  title: string;
  sortOrder: number;
  status: 'active' | 'inactive' | 'archived';
  isVisible: boolean;
  isLocked: boolean;
  revision: number;
  updatedAt: string;
}

export interface TaxonomyPath {
  id: string;
  code: string;
  name: string;
  parentPathId?: string;
  description: string;
  sortOrder: number;
}

export interface TaxonomySubject {
  id: string;
  pathId: string;
  levelId?: string;
  code: string;
  name: string;
  sortOrder: number;
}

export interface TaxonomySkill {
  id: string;
  subjectId: string;
  parentSkillId?: string;
  code: string;
  name: string;
  description: string;
  kind: string;
  sortOrder: number;
}

export interface TaxonomyCore {
  paths: TaxonomyPath[];
  subjects: TaxonomySubject[];
}

export interface TaxonomyFull extends TaxonomyCore {
  skills: TaxonomySkill[];
}

export interface CreateCourseInput {
  pathId: string;
  subjectId: string;
  title: string;
  description: string;
  instructorName: string;
  durationMinutes: number;
  level: 'beginner' | 'intermediate' | 'advanced';
  isVisible: boolean;
  dripContentEnabled: boolean;
  certificateEnabled: boolean;
  skillIds: string[];
}
