package application

import (
	"context"
	"errors"
	"testing"
	"time"

	assessment "github.com/nasef6464/almeaago/internal/assessment/domain"
	identity "github.com/nasef6464/almeaago/internal/identity/domain"
)

type sessionRepoStub struct {
	created   assessment.Session
	page      assessment.SessionPage
	live      assessment.LiveJoin
	lastPage  int
	lastLimit int
}

func (r *sessionRepoStub) CreateSession(context.Context, string, []identity.Role, assessment.SessionWrite, string) (assessment.Session, error) {
	return r.created, nil
}
func (r *sessionRepoStub) ListSessions(_ context.Context, _ string, _ string, _ []identity.Role, page, limit int) (assessment.SessionPage, error) {
	r.lastPage, r.lastLimit = page, limit
	return r.page, nil
}
func (r *sessionRepoStub) GetSession(context.Context, string) (assessment.Session, error) {
	return r.created, nil
}
func (r *sessionRepoStub) SetSessionStatus(context.Context, string, []identity.Role, string, assessment.SessionStatus) (assessment.Session, error) {
	return r.created, nil
}
func (r *sessionRepoStub) StartPublic(context.Context, string, string, string) (assessment.PublicAttempt, error) {
	return assessment.PublicAttempt{ID: "public-attempt-1"}, nil
}
func (r *sessionRepoStub) SubmitPublic(context.Context, string, assessment.PublicSubmitInput) (assessment.PublicSubmission, error) {
	return assessment.PublicSubmission{ResultVisible: true}, nil
}
func (r *sessionRepoStub) LiveByCode(context.Context, string, string) (assessment.LiveJoin, error) {
	return r.live, nil
}
func (r *sessionRepoStub) StartLive(context.Context, string, string, string) (assessment.Attempt, error) {
	return assessment.Attempt{ID: "attempt-1"}, nil
}

type sessionDefinitionRepo struct{ row assessment.Assessment }

func (r *sessionDefinitionRepo) List(context.Context, assessment.ListQuery) (assessment.Page, error) {
	return assessment.Page{}, nil
}
func (r *sessionDefinitionRepo) Get(context.Context, string) (assessment.Assessment, error) {
	return r.row, nil
}
func (r *sessionDefinitionRepo) Create(context.Context, string, assessment.Write) (assessment.Assessment, error) {
	return assessment.Assessment{}, nil
}
func (r *sessionDefinitionRepo) Update(context.Context, string, string, int, assessment.Write) (assessment.Assessment, error) {
	return assessment.Assessment{}, nil
}
func (r *sessionDefinitionRepo) SetWorkflow(context.Context, string, string, int, assessment.WorkflowStatus, string) (assessment.Assessment, error) {
	return assessment.Assessment{}, nil
}
func (r *sessionDefinitionRepo) SetPublication(context.Context, string, string, int, bool) (assessment.Assessment, error) {
	return assessment.Assessment{}, nil
}
func (r *sessionDefinitionRepo) CanAuthor(context.Context, string, string, string) (bool, error) {
	return true, nil
}

func publishedSessionDefinition(owner string) assessment.Assessment {
	version := 2
	return assessment.Assessment{
		ID:                "assessment-1",
		OwnerType:         assessment.OwnerTeacher,
		OwnerUserID:       owner,
		AssignedTeacherID: owner,
		WorkflowStatus:    assessment.WorkflowApproved,
		IsPublished:       true,
		IsVisible:         true,
		PublishedVersion:  &version,
		Version:           assessment.Version{Version: 2, PathID: "path-1", SubjectID: "subject-1"},
	}
}

func TestSessionCreateRequiresPublishedDefinitionAndValidDistributionShape(t *testing.T) {
	repo := &sessionRepoStub{created: assessment.Session{ID: "session-1"}}
	defs := NewService(&sessionDefinitionRepo{row: publishedSessionDefinition("teacher-1")})
	s := NewSessionService(repo, defs)
	teacher := identity.User{ID: "teacher-1", Roles: []identity.Role{identity.RoleTeacher}}

	out, err := s.Create(context.Background(), teacher, assessment.SessionWrite{
		AssessmentID: "assessment-1",
		Channel:      assessment.SessionBarcode,
	})
	if err != nil || out.ID != "session-1" {
		t.Fatalf("create failed: %#v %v", out, err)
	}
	_, err = s.Create(context.Background(), teacher, assessment.SessionWrite{
		AssessmentID: "assessment-1",
		Channel:      assessment.SessionPublic,
		SchoolID:     "school-1",
	})
	if !errors.Is(err, ErrInvalidInput) {
		t.Fatalf("public school scope should be rejected, got %v", err)
	}
}

func TestSessionCreateRejectsInvalidWindowAndMaxSubmissions(t *testing.T) {
	repo := &sessionRepoStub{}
	defs := NewService(&sessionDefinitionRepo{row: publishedSessionDefinition("teacher-1")})
	s := NewSessionService(repo, defs)
	teacher := identity.User{ID: "teacher-1", Roles: []identity.Role{identity.RoleTeacher}}
	now := time.Now()
	before := now.Add(-time.Minute)
	tooMany := 100001

	_, err := s.Create(context.Background(), teacher, assessment.SessionWrite{
		AssessmentID: "assessment-1", Channel: assessment.SessionBarcode, OpensAt: &now, ClosesAt: &before,
	})
	if !errors.Is(err, ErrInvalidInput) {
		t.Fatalf("invalid window should fail, got %v", err)
	}
	_, err = s.Create(context.Background(), teacher, assessment.SessionWrite{
		AssessmentID: "assessment-1", Channel: assessment.SessionBarcode, MaxSubmissions: &tooMany,
	})
	if !errors.Is(err, ErrInvalidInput) {
		t.Fatalf("max submissions should fail, got %v", err)
	}
}

func TestSessionListIsBounded(t *testing.T) {
	repo := &sessionRepoStub{}
	defs := NewService(&sessionDefinitionRepo{row: publishedSessionDefinition("teacher-1")})
	s := NewSessionService(repo, defs)
	teacher := identity.User{ID: "teacher-1", Roles: []identity.Role{identity.RoleTeacher}}

	if _, err := s.List(context.Background(), teacher, "assessment-1", 0, 500); err != nil {
		t.Fatal(err)
	}
	if repo.lastPage != 1 || repo.lastLimit != 100 {
		t.Fatalf("query not bounded: page=%d limit=%d", repo.lastPage, repo.lastLimit)
	}
}

func TestPublicKeysAreBoundedAndLiveIsStudentOnly(t *testing.T) {
	repo := &sessionRepoStub{}
	defs := NewService(&sessionDefinitionRepo{row: publishedSessionDefinition("teacher-1")})
	s := NewSessionService(repo, defs)

	if _, err := s.StartPublic(context.Background(), "code", assessment.PublicStartInput{ParticipantKey: "short", StartKey: "also-short"}); !errors.Is(err, ErrInvalidInput) {
		t.Fatalf("short public keys should fail, got %v", err)
	}
	teacher := identity.User{ID: "teacher-1", Roles: []identity.Role{identity.RoleTeacher}}
	if _, err := s.Live(context.Background(), teacher, "livecode"); !errors.Is(err, ErrForbidden) {
		t.Fatalf("teacher live join should fail, got %v", err)
	}
}
