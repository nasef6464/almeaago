package application

import (
	"context"
	"encoding/json"
	"strings"

	content "github.com/nasef6464/almeaago/internal/content/domain"
	identity "github.com/nasef6464/almeaago/internal/identity/domain"
)

func (s *Service) CreateCourse(ctx context.Context, actor identity.User, input CourseInput) (content.Course, error) {
	if !actor.HasRole(identity.RoleAdmin) {
		return content.Course{}, ErrForbidden
	}
	write, err := normalizeCourse(actor, input)
	if err != nil {
		return content.Course{}, err
	}
	return s.repo.CreateCourse(ctx, actor.ID, write)
}

func (s *Service) UpdateCourse(ctx context.Context, actor identity.User, courseID string, input UpdateCourseInput) (content.Course, error) {
	courseID = strings.TrimSpace(courseID)
	if courseID == "" || input.ExpectedRevision < 1 {
		return content.Course{}, ErrInvalidInput
	}
	current, err := s.repo.GetCourse(ctx, courseID)
	if err != nil {
		return content.Course{}, err
	}
	if !canEdit(actor, current.OwnerType, current.OwnerUserID, current.AssignedTeacherID) {
		return content.Course{}, ErrForbidden
	}
	if current.WorkflowStatus == content.WorkflowApproved || current.WorkflowStatus == content.WorkflowArchived {
		return content.Course{}, ErrWorkflow
	}
	write, err := normalizeCourse(actor, input.CourseInput)
	if err != nil {
		return content.Course{}, err
	}
	if !actor.HasRole(identity.RoleAdmin) {
		write.OwnerType, write.OwnerUserID, write.OwnerSchoolID, write.AssignedTeacherID = current.OwnerType, current.OwnerUserID, current.OwnerSchoolID, current.AssignedTeacherID
		write.RevenueSharePercentage = current.RevenueSharePercentage
	}
	return s.repo.UpdateCourse(ctx, actor.ID, courseID, input.ExpectedRevision, write)
}

func (s *Service) SetCourseWorkflow(ctx context.Context, actor identity.User, courseID string, input WorkflowInput) (content.Course, error) {
	current, err := s.repo.GetCourse(ctx, strings.TrimSpace(courseID))
	if err != nil {
		return content.Course{}, err
	}
	if err := validateWorkflowInput(input); err != nil {
		return content.Course{}, err
	}
	if err := authorizeWorkflow(actor, current.OwnerType, current.OwnerUserID, current.AssignedTeacherID, current.WorkflowStatus, input.Status); err != nil {
		return content.Course{}, err
	}
	if input.Status == content.WorkflowApproved {
		ready, err := s.repo.CourseReadyForApproval(ctx, current.ID)
		if err != nil {
			return content.Course{}, err
		}
		if !ready {
			return content.Course{}, ErrWorkflow
		}
	}
	return s.repo.SetCourseWorkflow(ctx, actor.ID, current.ID, input.ExpectedRevision, input.Status, strings.TrimSpace(input.ReviewerNotes))
}

func (s *Service) StaffCourse(ctx context.Context, actor identity.User, courseID string) (content.Course, error) {
	row, err := s.repo.GetCourse(ctx, strings.TrimSpace(courseID))
	if err != nil {
		return content.Course{}, err
	}
	if !canEdit(actor, row.OwnerType, row.OwnerUserID, row.AssignedTeacherID) {
		return content.Course{}, ErrForbidden
	}
	return row, nil
}

func (s *Service) ListCourses(ctx context.Context, actor identity.User, query content.ListQuery) (content.CoursePage, error) {
	if err := normalizeList(actor, &query); err != nil {
		return content.CoursePage{}, err
	}
	return s.repo.ListCourses(ctx, query)
}

func normalizeCourse(actor identity.User, input CourseInput) (content.CourseWrite, error) {
	if len(input.Presentation) > 0 && !json.Valid(input.Presentation) {
		return content.CourseWrite{}, ErrInvalidInput
	}
	write := content.CourseWrite{
		PathID: strings.TrimSpace(input.PathID), SubjectID: strings.TrimSpace(input.SubjectID),
		Title: strings.TrimSpace(input.Title), Description: strings.TrimSpace(input.Description),
		InstructorName: strings.TrimSpace(input.InstructorName), DurationMinutes: input.DurationMinutes,
		Level: input.Level, OwnerType: input.OwnerType, OwnerUserID: strings.TrimSpace(input.OwnerUserID),
		OwnerSchoolID: strings.TrimSpace(input.OwnerSchoolID), AssignedTeacherID: strings.TrimSpace(input.AssignedTeacherID),
		RevenueSharePercentage: input.RevenueSharePercentage, IsVisible: boolDefault(input.IsVisible, true),
		DripContentEnabled: input.DripContentEnabled, CertificateEnabled: input.CertificateEnabled,
		ThumbnailAssetID: strings.TrimSpace(input.ThumbnailAssetID), Presentation: normalizeJSON(input.Presentation),
		SkillIDs: normalizeIDs(input.SkillIDs),
	}
	if write.Level == "" {
		write.Level = content.CourseBeginner
	}
	if write.PathID == "" || write.SubjectID == "" || write.Title == "" || len(write.Title) > 240 || len(write.Description) > 12000 || len(write.InstructorName) > 160 || write.DurationMinutes < 0 || !content.ValidCourseLevel(write.Level) || len(write.SkillIDs) == 0 || len(write.SkillIDs) > 50 {
		return content.CourseWrite{}, ErrInvalidInput
	}
	if write.RevenueSharePercentage != nil && (*write.RevenueSharePercentage < 0 || *write.RevenueSharePercentage > 100) {
		return content.CourseWrite{}, ErrInvalidInput
	}
	if err := normalizeOwner(actor, &write.OwnerType, &write.OwnerUserID, &write.OwnerSchoolID, &write.AssignedTeacherID); err != nil {
		return content.CourseWrite{}, err
	}
	return write, nil
}
