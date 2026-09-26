export type AssessmentWorkflowStatus='draft'|'pending_review'|'approved'|'rejected'|'archived';
export interface AssessmentSummary{ id:string;code:string;title:string;pathId:string;subjectId:string;kind:'normal'|'mock';workflowStatus:AssessmentWorkflowStatus;ownerType:'platform'|'teacher'|'school';revision:number;currentVersion:number;isPublished:boolean;updatedAt:string}
export interface AssessmentSection{id:string;title:string;subjectId:string;sortOrder:number;timeLimitSeconds:number|null;domain:string;strictLock:boolean}
export interface AssessmentQuestionPlacement{questionId:string;questionVersion:number;sectionId:string;sortOrder:number;points:number}
export interface AssessmentVersion{version:number;title:string;description:string;pathId:string;subjectId:string;kind:'normal'|'mock';normalMode:''|'practice'|'exam';showExplanations:boolean;showAnswers:boolean;showResultsReport:boolean;returnToSourceOnFinish:boolean;maxAttempts:number;passingScore:number;timeLimitSeconds:number|null;randomizeQuestions:boolean;randomizeOptions:boolean;showProgressBar:boolean;requireAnswerBeforeNext:boolean;allowQuestionReview:boolean;optionLayout:string;mockCategory:string;mockTargetScore:number|null;mockStrictSectionLock:boolean|null;mockPresentationMode:string;presentation:unknown;revisionNote:string}
export interface AssessmentDetail extends AssessmentSummary{ownerUserId:string;ownerSchoolId:string;assignedTeacherId:string;reviewerNotes:string;isVisible:boolean;version:AssessmentVersion;sections:AssessmentSection[];questions:AssessmentQuestionPlacement[]}
export interface AssessmentFilters{page?:number;limit?:number;pathId?:string;subjectId?:string;workflowStatus?:AssessmentWorkflowStatus|'';search?:string}
export interface AssessmentPage{items:AssessmentSummary[];page:number;limit:number;hasMore:boolean}
export interface QuestionSummary{id:string;questionCode:string;currentVersion:number;pathId:string;subjectId:string;workflowStatus:string;type:string;text:string;imageAssetId:string;difficulty:string}
export interface QuestionPage{items:QuestionSummary[];page:number;limit:number;hasMore:boolean}
export interface AssessmentWriteInput{expectedRevision?:number;code:string;ownerType:'platform'|'teacher'|'school';ownerUserId:string;ownerSchoolId:string;assignedTeacherId:string;isVisible:boolean;version:AssessmentVersion;sections:AssessmentSection[];questions:AssessmentQuestionPlacement[]}

export type AssessmentPlacementSlot='training'|'tests'|'foundation'|'course';
export interface AssessmentPlacement{id:string;assessmentId:string;assessmentVersion:number;slot:AssessmentPlacementSlot;pathId:string;subjectId:string;courseId:string;lessonId:string;topicId:string;isVisible:boolean;sortOrder:number;createdAt:string;updatedAt:string}
export interface AssessmentPlacementWrite{slot:AssessmentPlacementSlot;pathId:string;subjectId:string;courseId:string;lessonId:string;topicId:string;isVisible:boolean;sortOrder:number}
export interface AssessmentPlacementPage{items:AssessmentPlacement[];page:number;limit:number;hasMore:boolean}
export interface LearnerAssessmentPlacement{placementId:string;assessmentId:string;assessmentVersion:number;title:string;slot:AssessmentPlacementSlot;pathId:string;subjectId:string;courseId:string;lessonId:string;topicId:string;sortOrder:number;attemptCount:number;maxAttempts:number;canStart:boolean}
export interface LearnerAssessmentPlacementPage{items:LearnerAssessmentPlacement[];page:number;limit:number;hasMore:boolean}
