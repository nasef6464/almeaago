package application

import (
	"context"
	"errors"
	"strings"

	assessment "github.com/nasef6464/almeaago/internal/assessment/domain"
	identity "github.com/nasef6464/almeaago/internal/identity/domain"
)

var (
	ErrInvalidInput = errors.New("invalid assessment input")
	ErrForbidden    = errors.New("assessment operation forbidden")
	ErrWorkflow     = errors.New("invalid assessment workflow transition")
)

type Repository interface {
	Create(ctx context.Context, actorUserID string, write assessment.Write) (assessment.Assessment, error)
	Update(ctx context.Context, actorUserID, id string, expectedRevision int, write assessment.Write) (assessment.Assessment, error)
	Get(ctx context.Context, id string) (assessment.Assessment, error)
	List(ctx context.Context, query assessment.ListQuery) (assessment.Page, error)
	SetWorkflow(ctx context.Context, actorUserID, id string, expectedRevision int, status assessment.WorkflowStatus, notes string) (assessment.Assessment, error)
	SetPublication(ctx context.Context, actorUserID, id string, expectedRevision int, published bool) (assessment.Assessment, error)
	CanAuthor(ctx context.Context, userID, pathID, subjectID string) (bool, error)
}

type Service struct{ repo Repository }

func NewService(repo Repository) *Service { return &Service{repo: repo} }

func normalizeList(actor identity.User, q *assessment.ListQuery) error {
	if !actor.HasRole(identity.RoleAdmin) && !actor.HasRole(identity.RoleTeacher) {
		return ErrForbidden
	}
	if q.Page == 0 {
		q.Page = 1
	}
	if q.Limit == 0 {
		q.Limit = 50
	}
	q.PathID = strings.TrimSpace(q.PathID)
	q.SubjectID = strings.TrimSpace(q.SubjectID)
	q.Search = strings.TrimSpace(q.Search)
	if q.Page < 1 || q.Limit < 1 || q.Limit > 100 || len(q.Search) > 160 {
		return ErrInvalidInput
	}
	if q.WorkflowStatus != "" && !assessment.ValidWorkflowStatus(q.WorkflowStatus) {
		return ErrInvalidInput
	}
	if actor.HasRole(identity.RoleTeacher) && !actor.HasRole(identity.RoleAdmin) {
		q.TeacherScopeUserID = actor.ID
	}
	return nil
}

func (s *Service) List(ctx context.Context, actor identity.User, q assessment.ListQuery) (assessment.Page, error) {
	if err := normalizeList(actor, &q); err != nil {
		return assessment.Page{}, err
	}
	return s.repo.List(ctx, q)
}
func (s *Service) Get(ctx context.Context, actor identity.User, id string) (assessment.Assessment, error) {
	if !actor.HasRole(identity.RoleAdmin) && !actor.HasRole(identity.RoleTeacher) {
		return assessment.Assessment{}, ErrForbidden
	}
	a, err := s.repo.Get(ctx, strings.TrimSpace(id))
	if err != nil {
		return assessment.Assessment{}, err
	}
	if actor.HasRole(identity.RoleTeacher) && !actor.HasRole(identity.RoleAdmin) && a.OwnerUserID != actor.ID && a.AssignedTeacherID != actor.ID {
		return assessment.Assessment{}, ErrForbidden
	}
	return a, nil
}
func (s *Service) normalizeWrite(ctx context.Context, actor identity.User, w *assessment.Write) error {
	w.Code = strings.TrimSpace(w.Code)
	w.Version.Title = strings.TrimSpace(w.Version.Title)
	w.Version.PathID = strings.TrimSpace(w.Version.PathID)
	w.Version.SubjectID = strings.TrimSpace(w.Version.SubjectID)
	if w.Code == "" || w.Version.Title == "" || w.Version.PathID == "" || len(w.Code) > 120 || len(w.Version.Title) > 240 || len(w.Version.Description) > 8000 || len(w.Sections) > 100 || len(w.Questions) > 500 {
		return ErrInvalidInput
	}
	if actor.HasRole(identity.RoleTeacher) && !actor.HasRole(identity.RoleAdmin) {
		ok, err := s.repo.CanAuthor(ctx, actor.ID, w.Version.PathID, w.Version.SubjectID)
		if err != nil {
			return err
		}
		if !ok {
			return ErrForbidden
		}
		w.OwnerType = assessment.OwnerTeacher
		w.OwnerUserID = actor.ID
		w.OwnerSchoolID = ""
		w.AssignedTeacherID = actor.ID
	} else if !actor.HasRole(identity.RoleAdmin) {
		return ErrForbidden
	}
	if !assessment.ValidOwnerType(w.OwnerType) {
		return ErrInvalidInput
	}
	if w.OwnerType == assessment.OwnerPlatform {
		w.OwnerUserID = ""
		w.OwnerSchoolID = ""
	}
	if w.OwnerType == assessment.OwnerTeacher && w.OwnerUserID == "" {
		return ErrInvalidInput
	}
	if w.OwnerType == assessment.OwnerSchool && w.OwnerSchoolID == "" {
		return ErrInvalidInput
	}
	if w.Version.MaxAttempts < 1 || w.Version.MaxAttempts > 100 || w.Version.PassingScore < 0 || w.Version.PassingScore > 100 {
		return ErrInvalidInput
	}
	seen := map[string]bool{}
	sections := map[string]bool{}
	for _, sec := range w.Sections {
		if strings.TrimSpace(sec.Title) == "" || sec.SortOrder < 0 {
			return ErrInvalidInput
		}
		if sec.ID != "" {
			sections[sec.ID] = true
		}
	}
	for _, q := range w.Questions {
		if q.QuestionID == "" || q.QuestionVersion < 1 || q.Points <= 0 || q.SortOrder < 0 || seen[q.QuestionID] {
			return ErrInvalidInput
		}
		seen[q.QuestionID] = true
		if q.SectionID != "" && !sections[q.SectionID] {
			return ErrInvalidInput
		}
	}
	return nil
}
func (s *Service) Create(ctx context.Context, actor identity.User, w assessment.Write) (assessment.Assessment, error) {
	if err := s.normalizeWrite(ctx, actor, &w); err != nil {
		return assessment.Assessment{}, err
	}
	return s.repo.Create(ctx, actor.ID, w)
}
func (s *Service) Update(ctx context.Context, actor identity.User, id string, rev int, w assessment.Write) (assessment.Assessment, error) {
	if rev < 1 {
		return assessment.Assessment{}, ErrInvalidInput
	}
	current, err := s.Get(ctx, actor, id)
	if err != nil {
		return assessment.Assessment{}, err
	}
	if current.WorkflowStatus == assessment.WorkflowArchived {
		return assessment.Assessment{}, ErrWorkflow
	}
	if err := s.normalizeWrite(ctx, actor, &w); err != nil {
		return assessment.Assessment{}, err
	}
	w.Code = current.Code
	return s.repo.Update(ctx, actor.ID, id, rev, w)
}
func validTransition(from, to assessment.WorkflowStatus, admin bool) bool {
	if admin {
		switch from {
		case assessment.WorkflowDraft, assessment.WorkflowRejected:
			return to == assessment.WorkflowPendingReview || to == assessment.WorkflowArchived
		case assessment.WorkflowPendingReview:
			return to == assessment.WorkflowApproved || to == assessment.WorkflowRejected || to == assessment.WorkflowDraft || to == assessment.WorkflowArchived
		case assessment.WorkflowApproved:
			return to == assessment.WorkflowDraft || to == assessment.WorkflowArchived
		}
	}
	return (from == assessment.WorkflowDraft || from == assessment.WorkflowRejected) && to == assessment.WorkflowPendingReview || from == assessment.WorkflowPendingReview && to == assessment.WorkflowDraft
}
func (s *Service) SetWorkflow(ctx context.Context, actor identity.User, id string, rev int, to assessment.WorkflowStatus, notes string) (assessment.Assessment, error) {
	if rev < 1 || !assessment.ValidWorkflowStatus(to) || len(strings.TrimSpace(notes)) > 4000 {
		return assessment.Assessment{}, ErrInvalidInput
	}
	a, err := s.Get(ctx, actor, id)
	if err != nil {
		return assessment.Assessment{}, err
	}
	admin := actor.HasRole(identity.RoleAdmin)
	if !validTransition(a.WorkflowStatus, to, admin) {
		return assessment.Assessment{}, ErrWorkflow
	}
	if to == assessment.WorkflowApproved && !admin {
		return assessment.Assessment{}, ErrForbidden
	}
	return s.repo.SetWorkflow(ctx, actor.ID, id, rev, to, strings.TrimSpace(notes))
}
func (s *Service) SetPublication(ctx context.Context, actor identity.User, id string, rev int, published bool) (assessment.Assessment, error) {
	if rev < 1 {
		return assessment.Assessment{}, ErrInvalidInput
	}
	if !actor.HasRole(identity.RoleAdmin) {
		return assessment.Assessment{}, ErrForbidden
	}
	a, err := s.Get(ctx, actor, id)
	if err != nil {
		return assessment.Assessment{}, err
	}
	if published && (a.WorkflowStatus != assessment.WorkflowApproved || len(a.Questions) == 0) {
		return assessment.Assessment{}, ErrWorkflow
	}
	return s.repo.SetPublication(ctx, actor.ID, id, rev, published)
}
