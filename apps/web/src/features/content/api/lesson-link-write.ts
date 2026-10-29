import type { LessonDetail, UpdateLessonInput } from './content-types';

// Keep the canonical lesson unchanged except for its skill links. Go enforces
// revision matching, author scope and workflow state on the actual PUT.
export function lessonLinkWrite(lesson: LessonDetail, skillIds: string[]): UpdateLessonInput {
  return {
    expectedRevision: lesson.revision,
    pathId: lesson.pathId,
    subjectId: lesson.subjectId,
    title: lesson.title,
    description: lesson.description,
    type: lesson.type as UpdateLessonInput['type'],
    contentText: lesson.contentText,
    durationSeconds: lesson.durationSeconds,
    videoUrl: lesson.videoUrl,
    videoSource: lesson.videoSource,
    meetingUrl: lesson.meetingUrl,
    meetingAt: lesson.meetingAt,
    recordingUrl: lesson.recordingUrl,
    joinInstructions: lesson.joinInstructions,
    showRecording: lesson.showRecording,
    isVisible: lesson.isVisible,
    isLocked: lesson.isLocked,
    skillIds: [...new Set(skillIds)],
    assetIds: lesson.assetIds,
    ownerType: lesson.ownerType as UpdateLessonInput['ownerType'],
    ownerUserId: lesson.ownerUserId,
    ownerSchoolId: lesson.ownerSchoolId,
    assignedTeacherId: lesson.assignedTeacherId,
    revenueSharePercentage: lesson.revenueSharePercentage,
  };
}
