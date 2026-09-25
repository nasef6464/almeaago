package application

import (
	"context"
	"encoding/json"
	"errors"
	"strings"

	content "github.com/nasef6464/almeaago/internal/content/domain"
	identity "github.com/nasef6464/almeaago/internal/identity/domain"
)

var (
	ErrInvalidInput = errors.New("invalid content input")
	ErrForbidden    = errors.New("content operation forbidden")
	ErrWorkflow     = errors.New("invalid content workflow transition")
)

type Repository interface {
	CreateCourse(ctx context.Context, actorUserID string, write content.CourseWrite) (content.Course, error)
	UpdateCourse(ctx context.Context, actorUserID, courseID string, expectedRevision int, write content.CourseWrite) (content.Course, error)
	SetCourseWorkflow(ctx context.Context, actorUserID, courseID string, expectedRevision int, status content.WorkflowStatus, reviewerNotes string) (content.Course, error)
	GetCourse(ctx context.Context, courseID string) (content.Course, error)
	ListCourses(ctx context.Context, query content.ListQuery) (content.CoursePage, error)
	CourseReadyForApproval(ctx context.Context, courseID string) (bool, error)

	CreateLesson(ctx context.Context, actorUserID string, write content.LessonWrite) (content.Lesson, error)
	UpdateLesson(ctx context.Context, actorUserID, lessonID string, expectedRevision int, write content.LessonWrite) (content.Lesson, error)
	SetLessonWorkflow(ctx context.Context, actorUserID, lessonID string, expectedRevision int, status content.WorkflowStatus, reviewerNotes string) (content.Lesson, error)
	GetLesson(ctx context.Context, lessonID string) (content.Lesson, error)
	ListLessons(ctx context.Context, query content.ListQuery) (content.LessonPage, error)

	CreateLibraryItem(ctx context.Context, actorUserID string, write content.LibraryWrite) (content.LibraryItem, error)
	UpdateLibraryItem(ctx context.Context, actorUserID, itemID string, expectedRevision int, write content.LibraryWrite) (content.LibraryItem, error)
	SetLibraryWorkflow(ctx context.Context, actorUserID, itemID string, expectedRevision int, status content.WorkflowStatus, reviewerNotes string) (content.LibraryItem, error)
	GetLibraryItem(ctx context.Context, itemID string) (content.LibraryItem, error)
	ListLibraryItems(ctx context.Context, query content.ListQuery) (content.LibraryPage, error)

	CreateTopic(ctx context.Context, actorUserID string, write content.TopicWrite) (content.FoundationTopic, error)
	UpdateTopic(ctx context.Context, actorUserID, topicID string, expectedRevision int, write content.TopicWrite) (content.FoundationTopic, error)
	GetTopic(ctx context.Context, topicID string) (content.FoundationTopic, error)
	ListTopics(ctx context.Context, query content.TopicQuery) (content.TopicPage, error)
}

type Service struct{ repo Repository }

func NewService(repo Repository) *Service { return &Service{repo: repo} }

func normalizeOwner(actor identity.User, ownerType *content.OwnerType, ownerUserID, ownerSchoolID, assignedTeacherID *string) error {
	if actor.HasRole(identity.RoleTeacher) && !actor.HasRole(identity.RoleAdmin) {
		*ownerType = content.OwnerTeacher
		*ownerUserID = actor.ID
		*ownerSchoolID = ""
		*assignedTeacherID = actor.ID
		return nil
	}
	if !actor.HasRole(identity.RoleAdmin) {
		return ErrForbidden
	}
	if *ownerType == "" {
		*ownerType = content.OwnerPlatform
	}
	switch *ownerType {
	case content.OwnerPlatform:
		*ownerUserID, *ownerSchoolID = "", ""
	case content.OwnerTeacher:
		if *ownerUserID == "" {
			return ErrInvalidInput
		}
		*ownerSchoolID = ""
	case content.OwnerSchool:
		if *ownerSchoolID == "" {
			return ErrInvalidInput
		}
		*ownerUserID = ""
	default:
		return ErrInvalidInput
	}
	return nil
}

func normalizeList(actor identity.User, query *content.ListQuery) error {
	if !isStaff(actor) {
		return ErrForbidden
	}
	if query.Page == 0 {
		query.Page = 1
	}
	if query.Limit == 0 {
		query.Limit = 50
	}
	query.PathID, query.SubjectID, query.Search = strings.TrimSpace(query.PathID), strings.TrimSpace(query.SubjectID), strings.TrimSpace(query.Search)
	if query.Page < 1 || query.Limit < 1 || query.Limit > 100 || len(query.Search) > 160 {
		return ErrInvalidInput
	}
	if query.WorkflowStatus != "" && !content.ValidWorkflowStatus(query.WorkflowStatus) {
		return ErrInvalidInput
	}
	if actor.HasRole(identity.RoleTeacher) && !actor.HasRole(identity.RoleAdmin) {
		query.TeacherScopeUserID = actor.ID
	}
	return nil
}

func validateWorkflowInput(input WorkflowInput) error {
	if input.ExpectedRevision < 1 || !content.ValidWorkflowStatus(input.Status) || len(strings.TrimSpace(input.ReviewerNotes)) > 4000 {
		return ErrInvalidInput
	}
	return nil
}

func authorizeWorkflow(actor identity.User, ownerType content.OwnerType, ownerUserID, assignedTeacherID string, from, to content.WorkflowStatus) error {
	if from == content.WorkflowArchived {
		return ErrWorkflow
	}
	if actor.HasRole(identity.RoleAdmin) {
		if !validAdminTransition(from, to) {
			return ErrWorkflow
		}
		return nil
	}
	if !actor.HasRole(identity.RoleTeacher) || !canEdit(actor, ownerType, ownerUserID, assignedTeacherID) {
		return ErrForbidden
	}
	allowed := (from == content.WorkflowDraft || from == content.WorkflowRejected) && to == content.WorkflowPendingReview
	allowed = allowed || (from == content.WorkflowPendingReview && to == content.WorkflowDraft)
	if !allowed {
		return ErrWorkflow
	}
	return nil
}

func validAdminTransition(from, to content.WorkflowStatus) bool {
	switch from {
	case content.WorkflowDraft, content.WorkflowRejected:
		return to == content.WorkflowPendingReview || to == content.WorkflowArchived
	case content.WorkflowPendingReview:
		return to == content.WorkflowApproved || to == content.WorkflowRejected || to == content.WorkflowDraft || to == content.WorkflowArchived
	case content.WorkflowApproved:
		return to == content.WorkflowDraft || to == content.WorkflowArchived
	default:
		return false
	}
}

func canEdit(actor identity.User, ownerType content.OwnerType, ownerUserID, assignedTeacherID string) bool {
	if actor.HasRole(identity.RoleAdmin) {
		return true
	}
	if !actor.HasRole(identity.RoleTeacher) {
		return false
	}
	return (ownerType == content.OwnerTeacher && ownerUserID == actor.ID) || assignedTeacherID == actor.ID
}

func isStaff(actor identity.User) bool {
	return actor.HasRole(identity.RoleAdmin) || actor.HasRole(identity.RoleTeacher)
}

func normalizeIDs(values []string) []string {
	result := make([]string, 0, len(values))
	seen := make(map[string]struct{}, len(values))
	for _, value := range values {
		value = strings.TrimSpace(value)
		if value == "" {
			continue
		}
		if _, ok := seen[value]; ok {
			continue
		}
		seen[value] = struct{}{}
		result = append(result, value)
	}
	return result
}

func normalizeJSON(raw json.RawMessage) json.RawMessage {
	if len(raw) == 0 {
		return json.RawMessage(`{}`)
	}
	if !json.Valid(raw) {
		return nil
	}
	return raw
}

func boolDefault(value *bool, fallback bool) bool {
	if value == nil {
		return fallback
	}
	return *value
}
