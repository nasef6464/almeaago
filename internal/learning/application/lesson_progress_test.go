package application

import (
	"context"
	"errors"
	"testing"

	identity "github.com/nasef6464/almeaago/internal/identity/domain"
	learning "github.com/nasef6464/almeaago/internal/learning/domain"
)

type lessonProgressRepoStub struct {
	row          learning.LessonProgress
	wrongRow     *learning.LessonProgress
	lastPosition int
	lastStudent  string
}

func (r *lessonProgressRepoStub) GetLessonProgress(_ context.Context, student, lessonID string, ct learning.LessonProgressContext, courseID, topicID string) (learning.LessonProgress, error) {
	r.lastStudent = student
	if r.wrongRow != nil {
		return *r.wrongRow, nil
	}
	if r.row.LessonID == "" {
		return learning.LessonProgress{}, learning.ErrNotFound
	}
	return r.row, nil
}
func (r *lessonProgressRepoStub) SaveVideoProgress(_ context.Context, student, lessonID string, ct learning.LessonProgressContext, courseID, topicID string, pos int) (learning.LessonProgress, error) {
	r.lastStudent = student
	r.lastPosition = pos
	if r.wrongRow != nil {
		return *r.wrongRow, nil
	}
	return learning.LessonProgress{LessonID: lessonID, ContextType: ct, CourseID: courseID, TopicID: topicID, Status: learning.LessonInProgress, PositionSeconds: pos}, nil
}
func (r *lessonProgressRepoStub) CompleteLesson(_ context.Context, student, lessonID string, ct learning.LessonProgressContext, courseID, topicID string) (learning.LessonProgress, error) {
	r.lastStudent = student
	if r.wrongRow != nil {
		return *r.wrongRow, nil
	}
	return learning.LessonProgress{LessonID: lessonID, ContextType: ct, CourseID: courseID, TopicID: topicID, Status: learning.LessonCompleted}, nil
}

type lessonTargetStub struct {
	ok         bool
	lessonType string
	duration   int
}

type foundationProgressAccessStub struct {
	allowed bool
	calls   int
}

func (s *foundationProgressAccessStub) ResolveFoundationLessonProgressTarget(_ context.Context, _ identity.User, _, _ string) (bool, string, int, error) {
	s.calls++
	return s.allowed, "video", 120, nil
}

func TestFoundationProgressUsesSameAuthorizedLessonBoundary(t *testing.T) {
	repo := &lessonProgressRepoStub{}
	access := &foundationProgressAccessStub{}
	s := NewLessonProgressService(repo, lessonTargetStub{ok: true, lessonType: "video"}, access)
	in := learning.LessonProgressContextInput{ContextType: learning.LessonProgressFoundation, TopicID: "topic"}
	if _, err := s.Get(context.Background(), progressStudent(), "lesson", in); !errors.Is(err, ErrNotFound) {
		t.Fatalf("denied read: %v", err)
	}
	if _, err := s.SaveVideo(context.Background(), progressStudent(), "lesson", learning.VideoProgressWrite{LessonProgressContextInput: in, PositionSeconds: 10}); !errors.Is(err, ErrNotFound) {
		t.Fatalf("denied write: %v", err)
	}
	if _, err := s.Complete(context.Background(), progressStudent(), "lesson", in); !errors.Is(err, ErrNotFound) {
		t.Fatalf("denied completion: %v", err)
	}
	if repo.lastStudent != "" || access.calls != 3 {
		t.Fatalf("denied access reached progress storage: %+v calls=%d", repo, access.calls)
	}
	access.allowed = true
	if _, err := s.SaveVideo(context.Background(), progressStudent(), "lesson", learning.VideoProgressWrite{LessonProgressContextInput: in, PositionSeconds: 10}); err != nil || repo.lastPosition != 10 {
		t.Fatalf("authorized write: %v", err)
	}
}

func (s lessonTargetStub) ResolveLessonProgressTarget(context.Context, string, string, string) (bool, string, int, error) {
	return s.ok, s.lessonType, s.duration, nil
}

func progressStudent() identity.User {
	return identity.User{ID: "student-1", Roles: []identity.Role{identity.RoleStudent}}
}

func TestLessonProgressRequiresStudentAndExactContext(t *testing.T) {
	s := NewLessonProgressService(&lessonProgressRepoStub{}, lessonTargetStub{ok: true, lessonType: "video", duration: 120})
	teacher := identity.User{ID: "teacher-1", Roles: []identity.Role{identity.RoleTeacher}}
	if _, err := s.Get(context.Background(), teacher, "lesson-1", learning.LessonProgressContextInput{ContextType: learning.LessonProgressCourse, CourseID: "course-1"}); !errors.Is(err, ErrForbidden) {
		t.Fatalf("want forbidden got %v", err)
	}
	if _, err := s.Get(context.Background(), progressStudent(), "lesson-1", learning.LessonProgressContextInput{ContextType: learning.LessonProgressCourse}); !errors.Is(err, ErrInvalidInput) {
		t.Fatalf("want exact course context got %v", err)
	}
}

func TestLessonProgressReadReturnsNotStartedWithoutCreatingRow(t *testing.T) {
	s := NewLessonProgressService(&lessonProgressRepoStub{}, lessonTargetStub{ok: true, lessonType: "video", duration: 120})
	out, err := s.Get(context.Background(), progressStudent(), "lesson-1", learning.LessonProgressContextInput{ContextType: learning.LessonProgressCourse, CourseID: "course-1"})
	if err != nil {
		t.Fatal(err)
	}
	if out.Status != learning.LessonNotStarted || out.PositionSeconds != 0 {
		t.Fatalf("unexpected default: %#v", out)
	}
}

func TestVideoProgressIsBoundedAndDoesNotAutoComplete(t *testing.T) {
	repo := &lessonProgressRepoStub{}
	s := NewLessonProgressService(repo, lessonTargetStub{ok: true, lessonType: "video", duration: 120})
	out, err := s.SaveVideo(context.Background(), progressStudent(), "lesson-1", learning.VideoProgressWrite{
		LessonProgressContextInput: learning.LessonProgressContextInput{ContextType: learning.LessonProgressCourse, CourseID: "course-1"},
		PositionSeconds:            999,
	})
	if err != nil {
		t.Fatal(err)
	}
	if repo.lastPosition != 120 || out.Status != learning.LessonInProgress {
		t.Fatalf("expected capped non-completing progress: repo=%d out=%#v", repo.lastPosition, out)
	}
}

func TestVideoProgressRejectsNonVideoAndHiddenTarget(t *testing.T) {
	ctx := learning.LessonProgressContextInput{ContextType: learning.LessonProgressCourse, CourseID: "course-1"}
	s := NewLessonProgressService(&lessonProgressRepoStub{}, lessonTargetStub{ok: true, lessonType: "text"})
	if _, err := s.SaveVideo(context.Background(), progressStudent(), "lesson-1", learning.VideoProgressWrite{LessonProgressContextInput: ctx, PositionSeconds: 10}); !errors.Is(err, ErrInvalidInput) {
		t.Fatalf("non-video should fail: %v", err)
	}
	s = NewLessonProgressService(&lessonProgressRepoStub{}, lessonTargetStub{ok: false, lessonType: "video"})
	if _, err := s.Complete(context.Background(), progressStudent(), "lesson-1", ctx); !errors.Is(err, ErrNotFound) {
		t.Fatalf("hidden target should fail closed: %v", err)
	}
}

func TestLessonProgressRejectsRepositoryResponseFromOtherCourse(t *testing.T) {
	ctx := context.Background()
	request := learning.LessonProgressContextInput{ContextType: learning.LessonProgressCourse, CourseID: "course-1"}
	repo := &lessonProgressRepoStub{wrongRow: &learning.LessonProgress{
		LessonID: "lesson-1", ContextType: learning.LessonProgressCourse, CourseID: "course-2",
		Status: learning.LessonCompleted, PositionSeconds: 42,
	}}
	s := NewLessonProgressService(repo, lessonTargetStub{ok: true, lessonType: "video", duration: 120})
	if _, err := s.Get(ctx, progressStudent(), "lesson-1", request); !errors.Is(err, ErrNotFound) {
		t.Fatalf("read must not return another course's completion: %v", err)
	}
	if _, err := s.SaveVideo(ctx, progressStudent(), "lesson-1", learning.VideoProgressWrite{
		LessonProgressContextInput: request, PositionSeconds: 40,
	}); !errors.Is(err, ErrNotFound) {
		t.Fatalf("video save must not return another course's progress: %v", err)
	}
	if _, err := s.Complete(ctx, progressStudent(), "lesson-1", request); !errors.Is(err, ErrNotFound) {
		t.Fatalf("completion must not return another course's progress: %v", err)
	}
}

func TestLessonProgressAcceptsCanonicalUUIDCase(t *testing.T) {
	repo := &lessonProgressRepoStub{row: learning.LessonProgress{
		LessonID:    "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa",
		ContextType: learning.LessonProgressCourse,
		CourseID:    "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb",
		Status:      learning.LessonInProgress,
	}}
	s := NewLessonProgressService(repo, lessonTargetStub{ok: true, lessonType: "video", duration: 120})
	out, err := s.Get(context.Background(), progressStudent(), "AAAAAAAA-AAAA-AAAA-AAAA-AAAAAAAAAAAA",
		learning.LessonProgressContextInput{ContextType: learning.LessonProgressCourse, CourseID: "BBBBBBBB-BBBB-BBBB-BBBB-BBBBBBBBBBBB"})
	if err != nil || out.LessonID != repo.row.LessonID {
		t.Fatalf("PostgreSQL canonical UUID casing should not change the scope: progress=%+v err=%v", out, err)
	}
}
