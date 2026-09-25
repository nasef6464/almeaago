package application

import (
	"context"
	"strings"

	content "github.com/nasef6464/almeaago/internal/content/domain"
	identity "github.com/nasef6464/almeaago/internal/identity/domain"
)

func (s *Service) CreateLesson(ctx context.Context, actor identity.User, input LessonInput) (content.Lesson, error) {
	write, err := normalizeLesson(actor, input)
	if err != nil {
		return content.Lesson{}, err
	}
	if err := s.requireAuthorScope(ctx, actor, write.PathID, write.SubjectID); err != nil {
		return content.Lesson{}, err
	}
	if !actor.HasRole(identity.RoleAdmin) {
		write.RevenueSharePercentage = nil
	}
	return s.repo.CreateLesson(ctx, actor.ID, write)
}

func (s *Service) UpdateLesson(ctx context.Context, actor identity.User, lessonID string, input UpdateLessonInput) (content.Lesson, error) {
	lessonID = strings.TrimSpace(lessonID)
	if lessonID == "" || input.ExpectedRevision < 1 {
		return content.Lesson{}, ErrInvalidInput
	}
	current, err := s.repo.GetLesson(ctx, lessonID)
	if err != nil {
		return content.Lesson{}, err
	}
	if !canEdit(actor, current.OwnerType, current.OwnerUserID, current.AssignedTeacherID) {
		return content.Lesson{}, ErrForbidden
	}
	if err := s.requireAuthorScope(ctx, actor, current.PathID, current.SubjectID); err != nil {
		return content.Lesson{}, err
	}
	if current.WorkflowStatus == content.WorkflowApproved || current.WorkflowStatus == content.WorkflowArchived {
		return content.Lesson{}, ErrWorkflow
	}
	write, err := normalizeLesson(actor, input.LessonInput)
	if err != nil {
		return content.Lesson{}, err
	}
	if err := s.requireAuthorScope(ctx, actor, write.PathID, write.SubjectID); err != nil {
		return content.Lesson{}, err
	}
	if !actor.HasRole(identity.RoleAdmin) {
		write.OwnerType, write.OwnerUserID, write.OwnerSchoolID, write.AssignedTeacherID = current.OwnerType, current.OwnerUserID, current.OwnerSchoolID, current.AssignedTeacherID
		write.RevenueSharePercentage = current.RevenueSharePercentage
	}
	return s.repo.UpdateLesson(ctx, actor.ID, lessonID, input.ExpectedRevision, write)
}

func (s *Service) SetLessonWorkflow(ctx context.Context, actor identity.User, lessonID string, input WorkflowInput) (content.Lesson, error) {
	current, err := s.repo.GetLesson(ctx, strings.TrimSpace(lessonID))
	if err != nil {
		return content.Lesson{}, err
	}
	if err := validateWorkflowInput(input); err != nil {
		return content.Lesson{}, err
	}
	if err := s.requireAuthorScope(ctx, actor, current.PathID, current.SubjectID); err != nil {
		return content.Lesson{}, err
	}
	if err := authorizeWorkflow(actor, current.OwnerType, current.OwnerUserID, current.AssignedTeacherID, current.WorkflowStatus, input.Status); err != nil {
		return content.Lesson{}, err
	}
	if input.Status == content.WorkflowApproved && !lessonPublishable(current) {
		return content.Lesson{}, ErrWorkflow
	}
	return s.repo.SetLessonWorkflow(ctx, actor.ID, current.ID, input.ExpectedRevision, input.Status, strings.TrimSpace(input.ReviewerNotes))
}

func (s *Service) StaffLesson(ctx context.Context, actor identity.User, lessonID string) (content.Lesson, error) {
	row, err := s.repo.GetLesson(ctx, strings.TrimSpace(lessonID))
	if err != nil {
		return content.Lesson{}, err
	}
	if !canEdit(actor, row.OwnerType, row.OwnerUserID, row.AssignedTeacherID) {
		return content.Lesson{}, ErrForbidden
	}
	if err := s.requireAuthorScope(ctx, actor, row.PathID, row.SubjectID); err != nil {
		return content.Lesson{}, err
	}
	return row, nil
}

func (s *Service) ListLessons(ctx context.Context, actor identity.User, query content.ListQuery) (content.LessonPage, error) {
	if err := normalizeList(actor, &query); err != nil {
		return content.LessonPage{}, err
	}
	return s.repo.ListLessons(ctx, query)
}

func normalizeLesson(actor identity.User, input LessonInput) (content.LessonWrite, error) {
	write := content.LessonWrite{
		PathID: strings.TrimSpace(input.PathID), SubjectID: strings.TrimSpace(input.SubjectID),
		Title: strings.TrimSpace(input.Title), Description: strings.TrimSpace(input.Description),
		LessonType: input.LessonType, ContentText: strings.TrimSpace(input.ContentText), DurationSeconds: input.DurationSeconds,
		VideoURL: strings.TrimSpace(input.VideoURL), VideoSource: strings.TrimSpace(input.VideoSource),
		MeetingURL: strings.TrimSpace(input.MeetingURL), MeetingAt: input.MeetingAt, RecordingURL: strings.TrimSpace(input.RecordingURL),
		JoinInstructions: strings.TrimSpace(input.JoinInstructions), ShowRecording: input.ShowRecording,
		OwnerType: input.OwnerType, OwnerUserID: strings.TrimSpace(input.OwnerUserID), OwnerSchoolID: strings.TrimSpace(input.OwnerSchoolID),
		AssignedTeacherID: strings.TrimSpace(input.AssignedTeacherID), RevenueSharePercentage: input.RevenueSharePercentage,
		IsVisible: boolDefault(input.IsVisible, true), IsLocked: input.IsLocked, SkillIDs: normalizeIDs(input.SkillIDs), AssetIDs: normalizeIDs(input.AssetIDs),
	}
	if write.PathID == "" || write.SubjectID == "" || write.Title == "" || len(write.Title) > 240 || len(write.Description) > 12000 || len(write.ContentText) > 50000 || len(write.JoinInstructions) > 10000 || len(write.VideoURL) > 2048 || len(write.MeetingURL) > 2048 || len(write.RecordingURL) > 2048 || write.DurationSeconds < 0 || !content.ValidLessonType(write.LessonType) || len(write.SkillIDs) == 0 || len(write.SkillIDs) > 50 || len(write.AssetIDs) > 20 {
		return content.LessonWrite{}, ErrInvalidInput
	}
	if write.VideoSource != "" && write.VideoSource != "upload" && write.VideoSource != "youtube" && write.VideoSource != "vimeo" {
		return content.LessonWrite{}, ErrInvalidInput
	}
	if write.RevenueSharePercentage != nil && (*write.RevenueSharePercentage < 0 || *write.RevenueSharePercentage > 100) {
		return content.LessonWrite{}, ErrInvalidInput
	}
	if err := normalizeOwner(actor, &write.OwnerType, &write.OwnerUserID, &write.OwnerSchoolID, &write.AssignedTeacherID); err != nil {
		return content.LessonWrite{}, err
	}
	return write, nil
}

func lessonPublishable(row content.Lesson) bool {
	if len(row.SkillIDs) == 0 {
		return false
	}
	switch row.LessonType {
	case content.LessonText, content.LessonAssignment:
		return strings.TrimSpace(row.ContentText) != ""
	case content.LessonVideo:
		return strings.TrimSpace(row.VideoURL) != "" || len(row.AssetIDs) > 0
	case content.LessonFile:
		return len(row.AssetIDs) > 0
	case content.LessonLiveYouTube, content.LessonZoom, content.LessonGoogleMeet, content.LessonTeams:
		return strings.TrimSpace(row.MeetingURL) != "" && row.MeetingAt != nil
	default:
		return false
	}
}
