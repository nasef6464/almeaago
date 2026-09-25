package contenthttp

import content "github.com/nasef6464/almeaago/internal/content/domain"

func presentCourseSummary(row content.Course) map[string]any {
	return map[string]any{
		"id": row.ID, "pathId": row.PathID, "subjectId": row.SubjectID, "title": row.Title,
		"instructorName": row.InstructorName, "durationMinutes": row.DurationMinutes, "level": row.Level,
		"ownerType": row.OwnerType, "ownerUserId": row.OwnerUserID, "ownerSchoolId": row.OwnerSchoolID,
		"assignedTeacherId": row.AssignedTeacherID, "workflowStatus": row.WorkflowStatus,
		"isVisible": row.IsVisible, "revision": row.Revision, "updatedAt": row.UpdatedAt,
	}
}

func presentCourse(row content.Course) map[string]any {
	body := presentCourseSummary(row)
	body["description"] = row.Description
	body["createdBy"] = row.CreatedBy
	body["approvedBy"] = row.ApprovedBy
	body["approvedAt"] = row.ApprovedAt
	body["reviewerNotes"] = row.ReviewerNotes
	body["revenueSharePercentage"] = row.RevenueSharePercentage
	body["dripContentEnabled"] = row.DripContentEnabled
	body["certificateEnabled"] = row.CertificateEnabled
	body["thumbnailAssetId"] = row.ThumbnailAssetID
	body["presentation"] = row.Presentation
	body["skillIds"] = row.SkillIDs
	body["createdAt"] = row.CreatedAt
	return body
}

func presentLessonSummary(row content.Lesson) map[string]any {
	return map[string]any{
		"id": row.ID, "pathId": row.PathID, "subjectId": row.SubjectID, "title": row.Title,
		"type": row.LessonType, "durationSeconds": row.DurationSeconds,
		"ownerType": row.OwnerType, "ownerUserId": row.OwnerUserID, "ownerSchoolId": row.OwnerSchoolID,
		"assignedTeacherId": row.AssignedTeacherID, "workflowStatus": row.WorkflowStatus,
		"isVisible": row.IsVisible, "isLocked": row.IsLocked, "revision": row.Revision, "updatedAt": row.UpdatedAt,
	}
}

func presentLesson(row content.Lesson) map[string]any {
	body := presentLessonSummary(row)
	body["description"] = row.Description
	body["contentText"] = row.ContentText
	body["videoUrl"] = row.VideoURL
	body["videoSource"] = row.VideoSource
	body["meetingUrl"] = row.MeetingURL
	body["meetingAt"] = row.MeetingAt
	body["recordingUrl"] = row.RecordingURL
	body["joinInstructions"] = row.JoinInstructions
	body["showRecording"] = row.ShowRecording
	body["createdBy"] = row.CreatedBy
	body["approvedBy"] = row.ApprovedBy
	body["approvedAt"] = row.ApprovedAt
	body["reviewerNotes"] = row.ReviewerNotes
	body["revenueSharePercentage"] = row.RevenueSharePercentage
	body["skillIds"] = row.SkillIDs
	body["assetIds"] = row.AssetIDs
	body["createdAt"] = row.CreatedAt
	return body
}

func presentLibrarySummary(row content.LibraryItem) map[string]any {
	return map[string]any{
		"id": row.ID, "pathId": row.PathID, "subjectId": row.SubjectID, "title": row.Title,
		"type": row.ItemType, "ownerType": row.OwnerType, "ownerUserId": row.OwnerUserID,
		"ownerSchoolId": row.OwnerSchoolID, "assignedTeacherId": row.AssignedTeacherID,
		"workflowStatus": row.WorkflowStatus, "isVisible": row.IsVisible, "isLocked": row.IsLocked,
		"revision": row.Revision, "updatedAt": row.UpdatedAt,
	}
}

func presentLibrary(row content.LibraryItem) map[string]any {
	body := presentLibrarySummary(row)
	body["description"] = row.Description
	body["externalUrl"] = row.ExternalURL
	body["createdBy"] = row.CreatedBy
	body["approvedBy"] = row.ApprovedBy
	body["approvedAt"] = row.ApprovedAt
	body["reviewerNotes"] = row.ReviewerNotes
	body["revenueSharePercentage"] = row.RevenueSharePercentage
	body["skillIds"] = row.SkillIDs
	body["primaryAssetId"] = row.PrimaryAssetID
	body["createdAt"] = row.CreatedAt
	return body
}

func presentTopicSummary(row content.FoundationTopic) map[string]any {
	return map[string]any{
		"id": row.ID, "pathId": row.PathID, "subjectId": row.SubjectID, "parentTopicId": row.ParentTopicID,
		"code": row.Code, "title": row.Title, "sortOrder": row.SortOrder, "status": row.Status,
		"isVisible": row.IsVisible, "isLocked": row.IsLocked, "revision": row.Revision, "updatedAt": row.UpdatedAt,
	}
}

func presentTopic(row content.FoundationTopic) map[string]any {
	body := presentTopicSummary(row)
	body["description"] = row.Description
	body["createdBy"] = row.CreatedBy
	body["skillIds"] = row.SkillIDs
	body["createdAt"] = row.CreatedAt
	return body
}
