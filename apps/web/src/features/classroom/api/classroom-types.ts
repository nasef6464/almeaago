export type ClassroomSessionStatus='draft'|'scheduled'|'live'|'ended'|'archived';
export type ClassroomPublishedMode='single'|'batch';
export type ClassroomAttendanceStatus='present'|'late'|'absent'|'excused';

export interface ClassroomSession{
 id:string;schoolId:string;classId:string;subjectId:string;teacherId:string;
 status:ClassroomSessionStatus;day:string;period:number|null;publishedMode:ClassroomPublishedMode;
 activeBatchId:string;activeQuestionOrdinal:number|null;pinExpiresAt:string;revision:number;
 startedAt:string|null;endedAt:string|null;createdAt:string;updatedAt:string;
}
export interface ClassroomQuestionSummary{id:string;version:number;questionType:'mcq'|'true_false';text:string;difficulty:string}
export interface ClassroomQuestionPage{items:ClassroomQuestionSummary[];page:number;limit:number;hasMore:boolean}
export interface ClassroomOption{index:number;text:string;assetId:string}
export interface ClassroomLiveQuestion{
 ordinal:number;questionId:string;questionVersion:number;text:string;imageAssetId:string;imageAlt:string;
 optionsEmbeddedInImage:boolean;options:ClassroomOption[];difficulty:string;revealed:boolean;
 correctOptionIndex:number|null;explanation:string;selectedOptionIndex:number|null;
}
export interface ClassroomStudentState{
 sessionId:string;status:ClassroomSessionStatus;publishedMode:ClassroomPublishedMode;
 activeBatchId:string;activeQuestionOrdinal:number|null;questions:ClassroomLiveQuestion[];
}
export interface ClassroomQuestionAggregate{ordinal:number;questionId:string;responseCount:number;correctCount:number;distribution:Record<string,number>}
export interface ClassroomAggregate{
 sessionId:string;status:ClassroomSessionStatus;activeBatchId:string;activeQuestionOrdinal:number|null;
 joinedCount:number;questions:ClassroomQuestionAggregate[];
}
export interface ClassroomPresentation{
 sessionId:string;status:ClassroomSessionStatus;publishedMode:ClassroomPublishedMode;
 activeBatchId:string;activeQuestionOrdinal:number|null;questions:ClassroomLiveQuestion[];aggregate:ClassroomAggregate;
}
export interface ClassroomBatch{
 id:string;sessionId:string;batchNumber:number;label:string;startedAt:string|null;endedAt:string|null;createdAt:string;
 questions:Array<{ordinal:number;batchId:string;questionId:string;questionVersion:number;publishedAt:string|null;revealedAt:string|null}>;
}
export interface SchoolContract{
 id:string;schoolId:string;status:'active'|'inactive'|'expired';modules:string[];
 validFrom:string|null;validUntil:string|null;revision:number;createdAt:string;updatedAt:string;
}
export interface ClassroomReport{
 sessionId:string;schoolId:string;classId:string;subjectId:string;teacherId:string;status:'ended';
 startedAt:string|null;endedAt:string|null;durationMinutes:number|null;
 roster:{expected:number;joined:number;absentFromSession:number};
 batches:Array<{batchId:string;number:number;label:string;questionOrdinals:number[];startedAt:string|null;endedAt:string|null;totals:{answered:number;correct:number;wrong:number;unanswered:number;accuracy:number|null}}>;
 questions:Array<{ordinal:number;questionId:string;questionVersion:number;answered:number;correct:number;wrong:number;unanswered:number;distribution:Record<string,number>}>;
 totals:{responses:number;correct:number};
}
