package application

import (
    "context"
    "errors"
    "testing"

    content "github.com/nasef6464/almeaago/internal/content/domain"
    identity "github.com/nasef6464/almeaago/internal/identity/domain"
)

type studentScopeRepo struct {
    *repoStub
    response content.LearningSpace
    err error
    requestedPath string
    requestedSubject string
}

func (r *studentScopeRepo) GetLearningSpace(_ context.Context, pathID, subjectID string, _ int) (content.LearningSpace, error) {
    r.requestedPath, r.requestedSubject = pathID, subjectID
    return r.response, r.err
}

func TestStudentLearningSpaceRejectsCrossSubjectRepositoryResponse(t *testing.T) {
    actor := identity.User{ID: "student-1", Roles: []identity.Role{identity.RoleStudent}}
    repo := &studentScopeRepo{repoStub: &repoStub{}, response: content.LearningSpace{
        PathID: "path-1", SubjectID: "subject-2",
    }}
    _, err := NewService(repo).LearningSpace(context.Background(), actor, "path-1", "subject-1", 24)
    if !errors.Is(err, content.ErrConflict) {
        t.Fatalf("cross-subject response must be rejected: %v", err)
    }
    if repo.requestedPath != "path-1" || repo.requestedSubject != "subject-1" {
        t.Fatalf("repository received wrong scope: %#v", repo)
    }
}

func TestStudentLearningSpacePreservesMatchingScopeAndRepositoryFailure(t *testing.T) {
    actor := identity.User{ID: "student-1", Roles: []identity.Role{identity.RoleStudent}}
    repo := &studentScopeRepo{repoStub: &repoStub{}, response: content.LearningSpace{
        PathID: "path-1", SubjectID: "subject-1",
    }}
    row, err := NewService(repo).LearningSpace(context.Background(), actor, " path-1 ", " subject-1 ", 24)
    if err != nil || row.PathID != "path-1" || row.SubjectID != "subject-1" {
        t.Fatalf("matching scoped response must survive: row=%#v err=%v", row, err)
    }
    failure := errors.New("database unavailable")
    repo.err = failure
    _, err = NewService(repo).LearningSpace(context.Background(), actor, "path-1", "subject-1", 24)
    if !errors.Is(err, failure) {
        t.Fatalf("repository failure must propagate, not become an empty catalog: %v", err)
    }
}
