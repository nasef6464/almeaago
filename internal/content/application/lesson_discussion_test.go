package application

import (
	"context"
	"errors"
	content "github.com/nasef6464/almeaago/internal/content/domain"
	identity "github.com/nasef6464/almeaago/internal/identity/domain"
	"strings"
	"testing"
)

type discussionRepo struct {
	*commerceAccessRepo
	reads, writes int
	parent, body  string
}

func (r *discussionRepo) GetLearnerCourseLesson(_ context.Context, course, lesson string) (content.LearnerLessonDetail, error) {
	if course != "course" || lesson != "lesson" {
		return content.LearnerLessonDetail{}, content.ErrNotFound
	}
	return r.lesson, nil
}

func (r *discussionRepo) ListLessonDiscussion(_ context.Context, _, _ string, page, _ int) (content.LessonDiscussionPage, error) {
	r.reads++
	return content.LessonDiscussionPage{Page: page}, nil
}
func (r *discussionRepo) CreateLessonDiscussion(_ context.Context, _, _, _, parent, body, _ string) (content.LessonDiscussionMessage, error) {
	r.writes++
	r.parent = parent
	r.body = body
	return content.LessonDiscussionMessage{Body: body}, nil
}

func TestLessonDiscussionRequiresStudentLessonAccessAndBounds(t *testing.T) {
	ctx := context.Background()
	repo := &discussionRepo{commerceAccessRepo: &commerceAccessRepo{lesson: content.LearnerLessonDetail{LearnerLessonSummary: content.LearnerLessonSummary{ID: "lesson"}}}}
	student := identity.User{ID: "student", Roles: []identity.Role{identity.RoleStudent}}
	denied := NewServiceWithAuthorScope(repo, repo, courseAccessStub{allowed: false})
	if _, err := denied.LessonDiscussion(ctx, student, "course", "lesson", 1, 30); !errors.Is(err, ErrForbidden) || repo.reads != 0 {
		t.Fatalf("denied read: %v", err)
	}
	if _, err := denied.AddLessonDiscussion(ctx, student, "course", "lesson", "", "hello", "request-123456789"); !errors.Is(err, ErrForbidden) || repo.writes != 0 {
		t.Fatalf("denied write: %v", err)
	}
	service := NewServiceWithAuthorScope(repo, repo, courseAccessStub{allowed: true})
	if _, err := service.LessonDiscussion(ctx, identity.User{ID: "teacher", Roles: []identity.Role{identity.RoleTeacher}}, "course", "lesson", 1, 30); !errors.Is(err, ErrForbidden) {
		t.Fatalf("staff must not bypass authorization: %v", err)
	}
	repo.commerceAccessRepo.repoStub.course = content.Course{ID: "course", OwnerType: content.OwnerTeacher, OwnerUserID: "owner", PathID: "path", SubjectID: "subject"}
	repo.commerceAccessRepo.repoStub.canAuthor = true
	owner := identity.User{ID: "owner", Roles: []identity.Role{identity.RoleTeacher}}
	if _, err := service.LessonDiscussion(ctx, owner, "course", "lesson", 1, 30); err != nil {
		t.Fatalf("authorized owner: %v", err)
	}
	if _, err := service.LessonDiscussion(ctx, owner, "course", "foreign", 1, 30); !errors.Is(err, content.ErrNotFound) {
		t.Fatalf("foreign lesson: %v", err)
	}
	repo.commerceAccessRepo.repoStub.canAuthor = false
	if _, err := service.LessonDiscussion(ctx, owner, "course", "lesson", 1, 30); !errors.Is(err, ErrForbidden) {
		t.Fatalf("owner without scope: %v", err)
	}
	if _, err := service.AddLessonDiscussion(ctx, student, "course", "lesson", "", strings.Repeat("س", 2001), "request-123456789"); !errors.Is(err, ErrInvalidInput) {
		t.Fatalf("length: %v", err)
	}
	if _, err := service.LessonDiscussion(ctx, student, "course", "lesson", 1, 51); !errors.Is(err, ErrInvalidInput) {
		t.Fatalf("limit: %v", err)
	}
	message, err := service.AddLessonDiscussion(ctx, student, "course", "lesson", "parent", "  شرح  ", "request-123456789")
	if err != nil || message.Body != "شرح" || repo.parent != "parent" {
		t.Fatalf("write: %+v %v", message, err)
	}
	page, err := service.LessonDiscussion(ctx, student, "course", "lesson", 0, 0)
	if err != nil || page.Items == nil || page.Page != 1 {
		t.Fatalf("page: %+v %v", page, err)
	}
}
