package application

import (
	"context"
	"errors"
	"strings"

	identity "github.com/nasef6464/almeaago/internal/identity/domain"
	question "github.com/nasef6464/almeaago/internal/questionbank/domain"
)

var ErrHasDependencies = question.ErrHasDependencies

type questionDeletionStore interface {
	DeleteQuestion(ctx context.Context, actorUserID, id string) error
}

type trainerQuestionDeleteAuthorizer interface {
	CanTrainerDeleteQuestion(ctx context.Context, userID, pathID, subjectID string) (bool, error)
}

type BulkDeleteBlocked struct {
	ID     string `json:"id"`
	Reason string `json:"reason"`
}

type BulkDeleteResult struct {
	DeletedIDs []string            `json:"deletedIds"`
	Blocked    []BulkDeleteBlocked `json:"blocked"`
}

func (s *Service) requireDeletePermission(ctx context.Context, actor identity.User, pathID, subjectID string) error {
	if actor.HasRole(identity.RoleAdmin) {
		return nil
	}
	if !actor.HasRole(identity.RoleTeacher) {
		return ErrForbidden
	}
	if checker, ok := s.repo.(trainerQuestionDeleteAuthorizer); ok {
		allowed, err := checker.CanTrainerDeleteQuestion(ctx, actor.ID, pathID, subjectID)
		if err != nil {
			return err
		}
		if !allowed {
			return ErrForbidden
		}
		return nil
	}
	return s.requireAuthorScope(ctx, actor, pathID, subjectID)
}

func (s *Service) DeleteQuestion(ctx context.Context, actor identity.User, id string) error {
	id = strings.TrimSpace(id)
	if id == "" {
		return ErrInvalidInput
	}
	if !actor.HasRole(identity.RoleAdmin) {
		row, err := s.repo.Get(ctx, id)
		if err != nil {
			return err
		}
		if err := s.requireDeletePermission(ctx, actor, row.PathID, row.SubjectID); err != nil {
			return err
		}
	}
	store, ok := s.repo.(questionDeletionStore)
	if !ok {
		return ErrInvalidInput
	}
	err := store.DeleteQuestion(ctx, actor.ID, id)
	if errors.Is(err, question.ErrHasDependencies) {
		return ErrHasDependencies
	}
	return err
}

func (s *Service) BulkDeleteQuestions(ctx context.Context, actor identity.User, ids []string) (BulkDeleteResult, error) {
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
		err := s.DeleteQuestion(ctx, actor, id)
		if err == nil {
			result.DeletedIDs = append(result.DeletedIDs, id)
			continue
		}
		reason := "تعذر الحذف"
		switch {
		case errors.Is(err, ErrHasDependencies):
			reason = "السؤال مرتبط باختبارات أو محاولات نشطة"
		case errors.Is(err, ErrForbidden):
			reason = "غير مصرح بحذف هذا السؤال"
		case errors.Is(err, question.ErrNotFound):
			reason = "السؤال غير موجود"
		}
		result.Blocked = append(result.Blocked, BulkDeleteBlocked{ID: id, Reason: reason})
	}
	return result, nil
}
