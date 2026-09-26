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

export type CourseLevel = 'beginner' | 'intermediate' | 'advanced';
export type ContentOwnerType = 'platform' | 'teacher' | 'school';

export interface CourseDetail extends CourseSummary {
  description: string;
  createdBy: string;
  approvedBy: string;
  approvedAt: string | null;
  reviewerNotes: string;
  revenueSharePercentage: number | null;
  publishedBy: string;
  publishedAt: string | null;
  dripContentEnabled: boolean;
  certificateEnabled: boolean;
  thumbnailAssetId: string;
  presentation: unknown;
  skillIds: string[];
  createdAt: string;
}

export interface UpdateCourseInput {
  expectedRevision: number;
  pathId: string;
  subjectId: string;
  title: string;
  description: string;
  instructorName: string;
  durationMinutes: number;
  level: CourseLevel;
  ownerType: ContentOwnerType;
  ownerUserId: string;
  ownerSchoolId: string;
  assignedTeacherId: string;
  revenueSharePercentage: number | null;
  isVisible: boolean;
  dripContentEnabled: boolean;
  certificateEnabled: boolean;
  thumbnailAssetId: string;
  presentation: unknown;
  skillIds: string[];
}

export interface CourseLessonPlacement {
  lessonId: string;
  sortOrder: number;
  isPreview: boolean;
}

export interface CourseModule {
  id: string;
  courseId: string;
  title: string;
  description: string;
  sortOrder: number;
  status: 'active' | 'archived';
  lessons: CourseLessonPlacement[];
  createdAt: string;
  updatedAt: string;
}

export type LessonType =
  | 'video'
  | 'file'
  | 'text'
  | 'assignment'
  | 'live_youtube'
  | 'zoom'
  | 'google_meet'
  | 'teams';

export interface LessonDetail extends LessonSummary {
  description: string;
  contentText: string;
  videoUrl: string;
  videoSource: '' | 'upload' | 'youtube' | 'vimeo';
  meetingUrl: string;
  meetingAt: string | null;
  recordingUrl: string;
  joinInstructions: string;
  showRecording: boolean;
  createdBy: string;
  approvedBy: string;
  approvedAt: string | null;
  reviewerNotes: string;
  revenueSharePercentage: number | null;
  skillIds: string[];
  assetIds: string[];
  createdAt: string;
}

export interface CreateLessonInput {
  pathId: string;
  subjectId: string;
  title: string;
  description: string;
  type: LessonType;
  contentText: string;
  durationSeconds: number;
  videoUrl: string;
  videoSource: '' | 'upload' | 'youtube' | 'vimeo';
  meetingUrl: string;
  meetingAt: string | null;
  recordingUrl: string;
  joinInstructions: string;
  showRecording: boolean;
  isVisible: boolean;
  isLocked: boolean;
  skillIds: string[];
  assetIds: string[];
}

export interface UpdateLessonInput extends CreateLessonInput {
  expectedRevision: number;
  ownerType: ContentOwnerType;
  ownerUserId: string;
  ownerSchoolId: string;
  assignedTeacherId: string;
  revenueSharePercentage: number | null;
}

export type LibraryItemType = 'pdf' | 'doc' | 'video' | 'link';

export interface LibraryDetail extends LibrarySummary {
  description: string;
  externalUrl: string;
  createdBy: string;
  approvedBy: string;
  approvedAt: string | null;
  reviewerNotes: string;
  revenueSharePercentage: number | null;
  skillIds: string[];
  primaryAssetId: string;
  createdAt: string;
}

export interface CreateLibraryInput {
  pathId: string;
  subjectId: string;
  title: string;
  description: string;
  type: LibraryItemType;
  externalUrl: string;
  isVisible: boolean;
  isLocked: boolean;
  skillIds: string[];
  primaryAssetId: string;
}

export interface UpdateLibraryInput extends CreateLibraryInput {
  expectedRevision: number;
  ownerType: ContentOwnerType;
  ownerUserId: string;
  ownerSchoolId: string;
  assignedTeacherId: string;
  revenueSharePercentage: number | null;
}

export type FoundationTopicStatus = 'active' | 'inactive' | 'archived';

export interface FoundationTopicDetail extends FoundationTopicSummary {
  description: string;
  createdBy: string;
  skillIds: string[];
  createdAt: string;
}

export interface CreateFoundationTopicInput {
  pathId: string;
  subjectId: string;
  parentTopicId: string;
  code: string;
  title: string;
  description: string;
  sortOrder: number;
  status: FoundationTopicStatus;
  isVisible: boolean;
  isLocked: boolean;
  skillIds: string[];
}

export interface UpdateFoundationTopicInput extends CreateFoundationTopicInput {
  expectedRevision: number;
}

export interface FoundationPlacements {
  lessons: Array<{ lessonId: string; sortOrder: number }>;
  libraryItems: Array<{ libraryItemId: string; sortOrder: number }>;
}

export interface LearnerCourseSummary{id:string;title:string;description:string;instructorName:string;durationMinutes:number;level:string;thumbnailAssetId:string;dripContentEnabled:boolean;certificateEnabled:boolean}
export interface LearnerTopicSummary{id:string;parentTopicId:string;title:string;description:string;sortOrder:number;isLocked:boolean}
export interface LearnerLibrarySummary{id:string;title:string;description:string;type:string;isLocked:boolean}
export interface LearnerLessonSummary{id:string;title:string;description:string;type:string;durationSeconds:number;isLocked:boolean;isPreview:boolean;commerceLocked:boolean;sortOrder:number}
export interface LearnerCourseModule{id:string;title:string;description:string;sortOrder:number;lessons:LearnerLessonSummary[]}
export interface LearnerCourse extends LearnerCourseSummary{modules:LearnerCourseModule[];access:{allowed:boolean;configured:boolean;reason:string}}
export interface LearnerTopic extends LearnerTopicSummary{lessons:LearnerLessonSummary[];libraryItems:LearnerLibrarySummary[]}
export interface LearningSpace{pathId:string;subjectId:string;courses:{items:LearnerCourseSummary[];hasMore:boolean};foundation:{items:LearnerTopicSummary[];hasMore:boolean};library:{items:LearnerLibrarySummary[];hasMore:boolean}}

export interface LearnerLessonDetail extends LearnerLessonSummary {
  contentText:string;
  videoUrl:string;
  videoSource:''|'upload'|'youtube'|'vimeo';
}
