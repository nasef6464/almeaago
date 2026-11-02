package application

import (
	"context"
	"errors"
	"testing"

	commerce "github.com/nasef6464/almeaago/internal/commerce/domain"
	content "github.com/nasef6464/almeaago/internal/content/domain"
	identity "github.com/nasef6464/almeaago/internal/identity/domain"
)

type foundationLessonRepoStub struct {
	repoStub
	row content.FoundationLessonDetail
	err error
}

func (r *foundationLessonRepoStub) GetLearnerFoundationLesson(context.Context, string, string) (content.FoundationLessonDetail, error) {
	return r.row, r.err
}

type foundationAccessStub struct {
	courseAccessStub
	allow         bool
	err           error
	calls         int
	path, subject string
}

func (a *foundationAccessStub) CheckFoundationAccess(_ context.Context, _ string, path, subject string) (commerce.AccessDecision, error) {
	a.calls++
	a.path, a.subject = path, subject
	return commerce.AccessDecision{Allowed: a.allow}, a.err
}

func TestFoundationLessonAccessUsesExactScopeAndFailsClosed(t *testing.T) {
	student := identity.User{ID: "student", Roles: []identity.Role{identity.RoleStudent}}
	repo := &foundationLessonRepoStub{row: content.FoundationLessonDetail{TopicID: "topic", PathID: "path", SubjectID: "subject", Lesson: content.LearnerLessonDetail{LearnerLessonSummary: content.LearnerLessonSummary{ID: "lesson", LessonType: "video"}, VideoURL: "https://example.invalid/video"}}}
	access := &foundationAccessStub{}
	s := NewServiceWithAuthorScope(repo, repo, access)
	if got, err := s.LearnerFoundationLesson(context.Background(), student, "topic", "lesson"); err != nil || got.VideoURL == "" || access.calls != 0 {
		t.Fatalf("free lesson: %+v %v calls=%d", got, err, access.calls)
	}
	repo.row.TopicLocked = true
	if got, err := s.LearnerFoundationLesson(context.Background(), student, "topic", "lesson"); !errors.Is(err, ErrForbidden) || got.VideoURL != "" {
		t.Fatalf("locked without entitlement leaked: %+v %v", got, err)
	}
	access.allow = true
	if _, err := s.LearnerFoundationLesson(context.Background(), student, "topic", "lesson"); err != nil || access.path != "path" || access.subject != "subject" {
		t.Fatalf("scope or entitlement: %v %q %q", err, access.path, access.subject)
	}
	repo.row.TopicLocked = false
	repo.row.Lesson.IsLocked = true
	access.allow = false
	if got, err := s.LearnerFoundationLesson(context.Background(), student, "topic", "lesson"); !errors.Is(err, ErrForbidden) || got.VideoURL != "" { t.Fatalf("locked lesson leaked: %+v %v", got, err) }
	access.allow = true
	access.err = errors.New("commerce unavailable")
	if got, err := s.LearnerFoundationLesson(context.Background(), student, "topic", "lesson"); err == nil || got.VideoURL != "" {
		t.Fatalf("commerce failure exposed content: %+v %v", got, err)
	}
	access.err = nil
	repo.row.TopicID = "other"
	if _, err := s.LearnerFoundationLesson(context.Background(), student, "topic", "lesson"); !errors.Is(err, ErrForbidden) {
		t.Fatalf("foreign topic accepted: %v", err)
	}
	if _, err := s.LearnerFoundationLesson(context.Background(), identity.User{ID: "teacher", Roles: []identity.Role{identity.RoleTeacher}}, "topic", "lesson"); !errors.Is(err, ErrForbidden) {
		t.Fatalf("nonstudent accepted: %v", err)
	}
}
