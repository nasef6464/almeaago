package application

import (
	"context"
	"errors"
	"strings"
	"testing"

	content "github.com/nasef6464/almeaago/internal/content/domain"
	identity "github.com/nasef6464/almeaago/internal/identity/domain"
)

type repoStub struct {
	course        content.Course
	courseWrite   content.CourseWrite
	workflowWrite bool
	listQuery     content.ListQuery
}

func (r *repoStub) CreateCourse(context.Context, string, content.CourseWrite) (content.Course, error) {
	return content.Course{}, nil
}
func (r *repoStub) UpdateCourse(_ context.Context, _ string, _ string, _ int, write content.CourseWrite) (content.Course, error) {
	r.courseWrite = write
	return r.course, nil
}
func (r *repoStub) SetCourseWorkflow(context.Context, string, string, int, content.WorkflowStatus, string) (content.Course, error) {
	r.workflowWrite = true
	return r.course, nil
}
func (r *repoStub) GetCourse(context.Context, string) (content.Course, error) { return r.course, nil }
func (r *repoStub) ListCourses(_ context.Context, query content.ListQuery) (content.CoursePage, error) {
	r.listQuery = query
	return content.CoursePage{Page: query.Page, Limit: query.Limit}, nil
}
func (r *repoStub) CourseReadyForApproval(context.Context, string) (bool, error) { return true, nil }

func (r *repoStub) CreateLesson(context.Context, string, content.LessonWrite) (content.Lesson, error) {
	return content.Lesson{}, nil
}
func (r *repoStub) UpdateLesson(context.Context, string, string, int, content.LessonWrite) (content.Lesson, error) {
	return content.Lesson{}, nil
}
func (r *repoStub) SetLessonWorkflow(context.Context, string, string, int, content.WorkflowStatus, string) (content.Lesson, error) {
	return content.Lesson{}, nil
}
func (r *repoStub) GetLesson(context.Context, string) (content.Lesson, error) {
	return content.Lesson{}, nil
}
func (r *repoStub) ListLessons(_ context.Context, query content.ListQuery) (content.LessonPage, error) {
	r.listQuery = query
	return content.LessonPage{Page: query.Page, Limit: query.Limit}, nil
}

func (r *repoStub) CreateLibraryItem(context.Context, string, content.LibraryWrite) (content.LibraryItem, error) {
	return content.LibraryItem{}, nil
}
func (r *repoStub) UpdateLibraryItem(context.Context, string, string, int, content.LibraryWrite) (content.LibraryItem, error) {
	return content.LibraryItem{}, nil
}
func (r *repoStub) SetLibraryWorkflow(context.Context, string, string, int, content.WorkflowStatus, string) (content.LibraryItem, error) {
	return content.LibraryItem{}, nil
}
func (r *repoStub) GetLibraryItem(context.Context, string) (content.LibraryItem, error) {
	return content.LibraryItem{}, nil
}
func (r *repoStub) ListLibraryItems(_ context.Context, query content.ListQuery) (content.LibraryPage, error) {
	r.listQuery = query
	return content.LibraryPage{Page: query.Page, Limit: query.Limit}, nil
}

func (r *repoStub) CreateTopic(context.Context, string, content.TopicWrite) (content.FoundationTopic, error) {
	return content.FoundationTopic{}, nil
}
func (r *repoStub) UpdateTopic(context.Context, string, string, int, content.TopicWrite) (content.FoundationTopic, error) {
	return content.FoundationTopic{}, nil
}
func (r *repoStub) GetTopic(context.Context, string) (content.FoundationTopic, error) {
	return content.FoundationTopic{}, nil
}
func (r *repoStub) ListTopics(context.Context, content.TopicQuery) (content.TopicPage, error) {
	return content.TopicPage{}, nil
}

func staffActor(role identity.Role) identity.User {
	return identity.User{ID: "teacher-1", Roles: []identity.Role{role}}
}

func TestTeacherListIsForcedToOwnedOrAssignedScope(t *testing.T) {
	repo := &repoStub{}
	service := NewService(repo)
	teacher := staffActor(identity.RoleTeacher)

	if _, err := service.ListCourses(context.Background(), teacher, content.ListQuery{}); err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if repo.listQuery.TeacherScopeUserID != teacher.ID {
		t.Fatalf("teacher scope not enforced: %#v", repo.listQuery)
	}
	if repo.listQuery.Page != 1 || repo.listQuery.Limit != 50 {
		t.Fatalf("unexpected list defaults: %#v", repo.listQuery)
	}
}

func TestListRejectsUnboundedLimit(t *testing.T) {
	service := NewService(&repoStub{})
	_, err := service.ListCourses(context.Background(), staffActor(identity.RoleAdmin), content.ListQuery{Limit: 101})
	if !errors.Is(err, ErrInvalidInput) {
		t.Fatalf("expected invalid input, got %v", err)
	}
}

func TestTeacherUpdatePreservesExistingAssignment(t *testing.T) {
	repo := &repoStub{course: content.Course{
		ID:                     "course-1",
		OwnerType:              content.OwnerTeacher,
		OwnerUserID:            "teacher-1",
		AssignedTeacherID:      "teacher-2",
		WorkflowStatus:         content.WorkflowDraft,
		RevenueSharePercentage: float64Ptr(25),
	}}
	service := NewService(repo)

	_, err := service.UpdateCourse(context.Background(), staffActor(identity.RoleTeacher), "course-1", UpdateCourseInput{
		ExpectedRevision: 1,
		CourseInput: CourseInput{
			PathID: "path-1", SubjectID: "subject-1", Title: "Course",
			Level: content.CourseBeginner, SkillIDs: []string{"skill-1"}, RevenueSharePercentage: float64Ptr(90),
		},
	})
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if repo.courseWrite.AssignedTeacherID != "teacher-2" {
		t.Fatalf("teacher changed assignment implicitly: %#v", repo.courseWrite)
	}
	if repo.courseWrite.RevenueSharePercentage == nil || *repo.courseWrite.RevenueSharePercentage != 25 {
		t.Fatalf("teacher changed revenue share implicitly: %#v", repo.courseWrite)
	}
}

func TestTeacherCannotCreateBeforeAuthoringScopeIsAvailable(t *testing.T) {
	service := NewService(&repoStub{})
	_, err := service.CreateCourse(context.Background(), staffActor(identity.RoleTeacher), CourseInput{})
	if !errors.Is(err, ErrForbidden) {
		t.Fatalf("expected forbidden teacher self-create, got %v", err)
	}
}

func TestAdminCannotSkipDraftDirectlyToApproved(t *testing.T) {
	repo := &repoStub{course: content.Course{ID: "course-1", WorkflowStatus: content.WorkflowDraft}}
	service := NewService(repo)

	_, err := service.SetCourseWorkflow(context.Background(), staffActor(identity.RoleAdmin), "course-1", WorkflowInput{
		ExpectedRevision: 1,
		Status:           content.WorkflowApproved,
	})
	if !errors.Is(err, ErrWorkflow) {
		t.Fatalf("expected workflow error, got %v", err)
	}
	if repo.workflowWrite {
		t.Fatal("repository workflow write must not run for an invalid transition")
	}
}

func float64Ptr(value float64) *float64 { return &value }

func TestCoursePresentationMetadataIsBounded(t *testing.T) {
	_, err := normalizeCourse(staffActor(identity.RoleAdmin), CourseInput{
		PathID: "path-1", SubjectID: "subject-1", Title: "Course",
		Level: content.CourseBeginner, SkillIDs: []string{"skill-1"},
		Presentation: []byte(`{"payload":"` + strings.Repeat("x", 33<<10) + `"}`),
	})
	if !errors.Is(err, ErrInvalidInput) {
		t.Fatalf("expected oversized presentation to be rejected, got %v", err)
	}
}
