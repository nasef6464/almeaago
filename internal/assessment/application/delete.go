package application

import (
	"context"
	"errors"
	"strings"

	assessment "github.com/nasef6464/almeaago/internal/assessment/domain"
	identity "github.com/nasef6464/almeaago/internal/identity/domain"
)

var ErrHasDependencies = assessment.ErrHasDependencies

type assessmentDeletionStore interface {
	DeleteAssessment(ctx context.Context, actorUserID, id string) error
}

type trainerAssessmentDeleteAuthorizer interface {
	CanTrainerDeleteAssessment(ctx context.Context, userID, pathID, subjectID string) (bool, error)
}

type placementDeletionStore interface {
	DeletePlacement(ctx context.Context, actorUserID, id string) error
}

type BulkDeleteBlocked struct {
	ID     string `json:"id"`
	Reason string `json:"reason"`
}

type BulkDeleteResult struct {
	DeletedIDs []string            `json:"deletedIds"`
	Blocked    []BulkDeleteBlocked `json:"blocked"`
}

func (s *Service) canDeleteAssessment(ctx context.Context, actor identity.User, a assessment.Assessment) error {
	if actor.HasRole(identity.RoleAdmin) {
		return nil
	}
	if !actor.HasRole(identity.RoleTeacher) {
		return ErrForbidden
	}
	if checker, ok := s.repo.(trainerAssessmentDeleteAuthorizer); ok {
		allowed, err := checker.CanTrainerDeleteAssessment(ctx, actor.ID, a.Version.PathID, a.Version.SubjectID)
		if err != nil {
			return err
		}
		if !allowed {
			return ErrForbidden
		}
		return nil
	}
	allowed, err := s.repo.CanAuthor(ctx, actor.ID, a.Version.PathID, a.Version.SubjectID)
	if err != nil {
		return err
	}
	if !allowed {
		return ErrForbidden
	}
	return nil
}

func (s *Service) DeleteAssessment(ctx context.Context, actor identity.User, id string) error {
	id = strings.TrimSpace(id)
	if id == "" {
		return ErrInvalidInput
	}
	if !actor.HasRole(identity.RoleAdmin) {
		row, err := s.repo.Get(ctx, id)
		if err != nil {
			return err
		}
		if err := s.canDeleteAssessment(ctx, actor, row); err != nil {
			return err
		}
	}
	store, ok := s.repo.(assessmentDeletionStore)
	if !ok {
		return ErrInvalidInput
	}
	err := store.DeleteAssessment(ctx, actor.ID, id)
	if errors.Is(err, assessment.ErrHasDependencies) {
		return ErrHasDependencies
	}
	return err
}

func (s *Service) BulkDeleteAssessments(ctx context.Context, actor identity.User, ids []string) (BulkDeleteResult, error) {
	if len(ids) == 0 || len(ids) > 100 {
		return BulkDeleteResult{}, ErrInvalidInput
	}
	if !actor.HasRole(identity.RoleAdmin) && !actor.HasRole(identity.RoleTeacher) {
		return BulkDeleteResult{}, ErrForbidden
	}
	result := BulkDeleteResult{
		DeletedIDs: make([]string, 0, len(ids)),
		Blocked:    make([]BulkDeleteBlocked, 0),
	}
	seen := make(map[string]struct{}, len(ids))
	for _, raw := range ids {
		id := strings.TrimSpace(raw)
		if id == "" {
			continue
		}
		if _, dup := seen[id]; dup {
			continue
		}
		seen[id] = struct{}{}
		err := s.DeleteAssessment(ctx, actor, id)
		if err == nil {
			result.DeletedIDs = append(result.DeletedIDs, id)
			continue
		}
		reason := "تعذر الحذف"
		switch {
		case errors.Is(err, ErrHasDependencies):
			reason = "الاختبار مرتبط بمحاولات أو تعيينات أو أماكن عرض نشطة"
		case errors.Is(err, ErrForbidden):
			reason = "غير مصرح بحذف هذا الاختبار"
		case errors.Is(err, assessment.ErrNotFound):
			reason = "الاختبار غير موجود"
		}
		result.Blocked = append(result.Blocked, BulkDeleteBlocked{ID: id, Reason: reason})
	}
	return result, nil
}

func (s *PlacementService) DeletePlacement(ctx context.Context, actor identity.User, id string) error {
	id = strings.TrimSpace(id)
	if id == "" {
		return ErrInvalidInput
	}
	if !actor.HasRole(identity.RoleAdmin) {
		if !actor.HasRole(identity.RoleTeacher) {
			return ErrForbidden
		}
		p, err := s.repo.GetPlacement(ctx, id)
		if err != nil {
			return err
		}
		if s.definitions == nil {
			return ErrForbidden
		}
		def, err := s.definitions.repo.Get(ctx, p.AssessmentID)
		if err != nil {
			return err
		}
		if err := s.definitions.canDeleteAssessment(ctx, actor, def); err != nil {
			return err
		}
	}
	store, ok := s.repo.(placementDeletionStore)
	if !ok {
		return ErrInvalidInput
	}
	return store.DeletePlacement(ctx, actor.ID, id)
}
