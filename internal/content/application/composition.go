package application

import (
	"context"
	"strings"

	content "github.com/nasef6464/almeaago/internal/content/domain"
	identity "github.com/nasef6464/almeaago/internal/identity/domain"
)

type CourseModuleInput struct {
	ExpectedRevision int    `json:"expectedRevision"`
	Title            string `json:"title"`
	Description      string `json:"description"`
	SortOrder        int    `json:"sortOrder"`
	Status           string `json:"status"`
}

type PlacementInput struct {
	ExpectedRevision int  `json:"expectedRevision"`
	SortOrder        int  `json:"sortOrder"`
	IsPreview        bool `json:"isPreview"`
}

type RevisionInput struct {
	ExpectedRevision int `json:"expectedRevision"`
}

func (s *Service) CourseModules(ctx context.Context, actor identity.User, courseID string) ([]content.CourseModule, error) {
	row, err := s.StaffCourse(ctx, actor, courseID)
	if err != nil {
		return nil, err
	}
	return s.repo.ListCourseModules(ctx, row.ID)
}

func (s *Service) CreateCourseModule(ctx context.Context, actor identity.User, courseID string, input CourseModuleInput) (content.CourseModule, int, error) {
	row, err := s.StaffCourse(ctx, actor, courseID)
	if err != nil {
		return content.CourseModule{}, 0, err
	}
	if row.WorkflowStatus == content.WorkflowApproved || row.WorkflowStatus == content.WorkflowArchived {
		return content.CourseModule{}, 0, ErrWorkflow
	}
	title, description := strings.TrimSpace(input.Title), strings.TrimSpace(input.Description)
	if input.ExpectedRevision < 1 || title == "" || len(title) > 240 || len(description) > 4000 || input.SortOrder < 0 {
		return content.CourseModule{}, 0, ErrInvalidInput
	}
	return s.repo.CreateCourseModule(ctx, actor.ID, row.ID, input.ExpectedRevision, title, description, input.SortOrder)
}

func (s *Service) UpdateCourseModule(ctx context.Context, actor identity.User, courseID, moduleID string, input CourseModuleInput) (content.CourseModule, int, error) {
	row, err := s.StaffCourse(ctx, actor, courseID)
	if err != nil {
		return content.CourseModule{}, 0, err
	}
	if row.WorkflowStatus == content.WorkflowApproved || row.WorkflowStatus == content.WorkflowArchived {
		return content.CourseModule{}, 0, ErrWorkflow
	}
	moduleID = strings.TrimSpace(moduleID)
	title, description := strings.TrimSpace(input.Title), strings.TrimSpace(input.Description)
	status := strings.TrimSpace(input.Status)
	if status == "" {
		status = "active"
	}
	if input.ExpectedRevision < 1 || moduleID == "" || title == "" || len(title) > 240 || len(description) > 4000 || input.SortOrder < 0 || (status != "active" && status != "archived") {
		return content.CourseModule{}, 0, ErrInvalidInput
	}
	return s.repo.UpdateCourseModule(ctx, actor.ID, row.ID, moduleID, input.ExpectedRevision, title, description, status, input.SortOrder)
}

func (s *Service) PlaceCourseLesson(ctx context.Context, actor identity.User, courseID, moduleID, lessonID string, input PlacementInput) (int, error) {
	courseRow, err := s.StaffCourse(ctx, actor, courseID)
	if err != nil {
		return 0, err
	}
	if courseRow.WorkflowStatus == content.WorkflowApproved || courseRow.WorkflowStatus == content.WorkflowArchived {
		return 0, ErrWorkflow
	}
	lessonRow, err := s.StaffLesson(ctx, actor, lessonID)
	if err != nil {
		return 0, err
	}
	moduleID = strings.TrimSpace(moduleID)
	if input.ExpectedRevision < 1 || input.SortOrder < 0 || moduleID == "" || courseRow.PathID != lessonRow.PathID || courseRow.SubjectID != lessonRow.SubjectID {
		return 0, ErrInvalidInput
	}
	return s.repo.PlaceCourseLesson(ctx, actor.ID, courseRow.ID, moduleID, lessonRow.ID, input.ExpectedRevision, input.SortOrder, input.IsPreview)
}

func (s *Service) RemoveCourseLesson(ctx context.Context, actor identity.User, courseID, moduleID, lessonID string, input RevisionInput) (int, error) {
	courseRow, err := s.StaffCourse(ctx, actor, courseID)
	if err != nil {
		return 0, err
	}
	if courseRow.WorkflowStatus == content.WorkflowApproved || courseRow.WorkflowStatus == content.WorkflowArchived {
		return 0, ErrWorkflow
	}
	moduleID, lessonID = strings.TrimSpace(moduleID), strings.TrimSpace(lessonID)
	if input.ExpectedRevision < 1 || moduleID == "" || lessonID == "" {
		return 0, ErrInvalidInput
	}
	return s.repo.RemoveCourseLesson(ctx, actor.ID, courseRow.ID, moduleID, lessonID, input.ExpectedRevision)
}

func (s *Service) TopicPlacements(ctx context.Context, actor identity.User, topicID string) (content.FoundationPlacements, error) {
	row, err := s.StaffTopic(ctx, actor, topicID)
	if err != nil {
		return content.FoundationPlacements{}, err
	}
	return s.repo.ListTopicPlacements(ctx, row.ID)
}

func (s *Service) LinkTopicLesson(ctx context.Context, actor identity.User, topicID, lessonID string, input PlacementInput) (int, error) {
	if !actor.HasRole(identity.RoleAdmin) {
		return 0, ErrForbidden
	}
	topic, err := s.StaffTopic(ctx, actor, topicID)
	if err != nil {
		return 0, err
	}
	if topic.Status != content.TopicActive || input.ExpectedRevision < 1 || input.SortOrder < 0 {
		return 0, ErrWorkflow
	}
	lesson, err := s.repo.GetLesson(ctx, strings.TrimSpace(lessonID))
	if err != nil {
		return 0, err
	}
	if lesson.WorkflowStatus == content.WorkflowArchived || lesson.PathID != topic.PathID || lesson.SubjectID != topic.SubjectID {
		return 0, ErrInvalidInput
	}
	return s.repo.LinkTopicLesson(ctx, actor.ID, topic.ID, lesson.ID, input.ExpectedRevision, input.SortOrder)
}

func (s *Service) UnlinkTopicLesson(ctx context.Context, actor identity.User, topicID, lessonID string, input RevisionInput) (int, error) {
	if !actor.HasRole(identity.RoleAdmin) {
		return 0, ErrForbidden
	}
	topic, err := s.StaffTopic(ctx, actor, topicID)
	if err != nil {
		return 0, err
	}
	lessonID = strings.TrimSpace(lessonID)
	if topic.Status != content.TopicActive || input.ExpectedRevision < 1 || lessonID == "" {
		return 0, ErrInvalidInput
	}
	return s.repo.UnlinkTopicLesson(ctx, actor.ID, topic.ID, lessonID, input.ExpectedRevision)
}

func (s *Service) LinkTopicLibrary(ctx context.Context, actor identity.User, topicID, itemID string, input PlacementInput) (int, error) {
	if !actor.HasRole(identity.RoleAdmin) {
		return 0, ErrForbidden
	}
	topic, err := s.StaffTopic(ctx, actor, topicID)
	if err != nil {
		return 0, err
	}
	if topic.Status != content.TopicActive || input.ExpectedRevision < 1 || input.SortOrder < 0 {
		return 0, ErrWorkflow
	}
	item, err := s.repo.GetLibraryItem(ctx, strings.TrimSpace(itemID))
	if err != nil {
		return 0, err
	}
	if item.WorkflowStatus == content.WorkflowArchived || item.PathID != topic.PathID || item.SubjectID != topic.SubjectID {
		return 0, ErrInvalidInput
	}
	return s.repo.LinkTopicLibrary(ctx, actor.ID, topic.ID, item.ID, input.ExpectedRevision, input.SortOrder)
}

func (s *Service) UnlinkTopicLibrary(ctx context.Context, actor identity.User, topicID, itemID string, input RevisionInput) (int, error) {
	if !actor.HasRole(identity.RoleAdmin) {
		return 0, ErrForbidden
	}
	topic, err := s.StaffTopic(ctx, actor, topicID)
	if err != nil {
		return 0, err
	}
	itemID = strings.TrimSpace(itemID)
	if topic.Status != content.TopicActive || input.ExpectedRevision < 1 || itemID == "" {
		return 0, ErrInvalidInput
	}
	return s.repo.UnlinkTopicLibrary(ctx, actor.ID, topic.ID, itemID, input.ExpectedRevision)
}
