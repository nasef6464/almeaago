package application

import (
	"context"
	"errors"
	"strings"

	content "github.com/nasef6464/almeaago/internal/content/domain"
	identity "github.com/nasef6464/almeaago/internal/identity/domain"
)

var ErrHasDependencies = content.ErrHasDependencies

type contentDeletionStore interface {
	DeleteContentRecord(ctx context.Context, actorUserID, kind, id string) error
}

func (s *Service) canDeleteKind(ctx context.Context, actor identity.User, kind, pathID, subjectID string) error {
	if actor.HasRole(identity.RoleAdmin) {
		return nil
	}
	if !actor.HasRole(identity.RoleTeacher) {
		return ErrForbidden
	}
	scope, err := s.repo.GetTrainerScope(ctx, actor.ID)
	if err != nil {
		return ErrForbidden
	}
	if !scope.Permissions.CanDelete {
		return ErrForbidden
	}
	switch kind {
	case "course", "course_module":
		if !scope.Permissions.ManageCourses {
			return ErrForbidden
		}
	case "lesson":
		if !scope.Permissions.ManageLessons {
			return ErrForbidden
		}
	case "foundation_topic":
		if !scope.Permissions.ManageFoundation {
			return ErrForbidden
		}
	case "library_item":
		if !scope.Permissions.ManageLibrary {
			return ErrForbidden
		}
	default:
		return ErrInvalidInput
	}
	ok, err := s.repo.CanAuthor(ctx, actor.ID, pathID, subjectID)
	if err != nil || !ok {
		return ErrForbidden
	}
	return nil
}

func (s *Service) scopeForRecord(ctx context.Context, kind, id string) (string, string, error) {
	switch kind {
	case "course":
		c, err := s.repo.GetCourse(ctx, id)
		return c.PathID, c.SubjectID, err
	case "lesson":
		l, err := s.repo.GetLesson(ctx, id)
		return l.PathID, l.SubjectID, err
	case "foundation_topic":
		t, err := s.repo.GetTopic(ctx, id)
		return t.PathID, t.SubjectID, err
	case "library_item":
		i, err := s.repo.GetLibraryItem(ctx, id)
		return i.PathID, i.SubjectID, err
	default:
		return "", "", ErrInvalidInput
	}
}

func (s *Service) DeleteRecord(ctx context.Context, actor identity.User, kind, id string) error {
	id = strings.TrimSpace(id)
	if id == "" {
		return ErrInvalidInput
	}
	if !actor.HasRole(identity.RoleAdmin) {
		pathID, subjectID, err := s.scopeForRecord(ctx, kind, id)
		if err != nil {
			return err
		}
		if err := s.canDeleteKind(ctx, actor, kind, pathID, subjectID); err != nil {
			return err
		}
	}
	store, ok := s.repo.(contentDeletionStore)
	if !ok {
		return errors.New("content deletion unavailable")
	}
	err := store.DeleteContentRecord(ctx, actor.ID, kind, id)
	if errors.Is(err, content.ErrHasDependencies) {
		return ErrHasDependencies
	}
	return err
}

func (s *Service) BulkDeleteRecords(ctx context.Context, actor identity.User, kind string, ids []string) (content.BulkDeleteResult, error) {
	clean := normalizeIDs(ids)
	if len(clean) == 0 || len(clean) > 100 {
		return content.BulkDeleteResult{}, ErrInvalidInput
	}
	res := content.BulkDeleteResult{
		DeletedIDs: make([]string, 0, len(clean)),
		Blocked:    make([]content.BulkDeleteBlocked, 0),
	}
	for _, id := range clean {
		err := s.DeleteRecord(ctx, actor, kind, id)
		switch {
		case err == nil:
			res.DeletedIDs = append(res.DeletedIDs, id)
		case errors.Is(err, ErrHasDependencies):
			res.Blocked = append(res.Blocked, content.BulkDeleteBlocked{ID: id, Reason: "مرتبط ببيانات أو طلاب نشطين"})
		case errors.Is(err, ErrForbidden):
			res.Blocked = append(res.Blocked, content.BulkDeleteBlocked{ID: id, Reason: "غير مصرح بالحذف"})
		case errors.Is(err, content.ErrNotFound):
			res.Blocked = append(res.Blocked, content.BulkDeleteBlocked{ID: id, Reason: "غير موجود"})
		default:
			res.Blocked = append(res.Blocked, content.BulkDeleteBlocked{ID: id, Reason: "تعذر الحذف"})
		}
	}
	return res, nil
}
