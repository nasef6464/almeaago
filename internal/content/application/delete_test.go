package application

import (
	"context"
	"errors"
	"testing"

	content "github.com/nasef6464/almeaago/internal/content/domain"
	identity "github.com/nasef6464/almeaago/internal/identity/domain"
)

type deleteContentRepoStub struct {
	Repository
	scope      content.TrainerScope
	canAuthor  bool
	courses    map[string]content.Course
	failID     string
	deletedIDs []string
}

func (r *deleteContentRepoStub) GetTrainerScope(_ context.Context, _ string) (content.TrainerScope, error) {
	return r.scope, nil
}

func (r *deleteContentRepoStub) CanAuthor(_ context.Context, _, _, _ string) (bool, error) {
	return r.canAuthor, nil
}

func (r *deleteContentRepoStub) GetCourse(_ context.Context, id string) (content.Course, error) {
	c, ok := r.courses[id]
	if !ok {
		return content.Course{}, content.ErrNotFound
	}
	return c, nil
}

func (r *deleteContentRepoStub) DeleteContentRecord(_ context.Context, _, _, id string) error {
	if id == r.failID {
		return content.ErrHasDependencies
	}
	r.deletedIDs = append(r.deletedIDs, id)
	return nil
}

func TestDeleteContentRecordPermissionsAndDependencies(t *testing.T) {
	repo := &deleteContentRepoStub{
		canAuthor: true,
		courses: map[string]content.Course{
			"c1": {ID: "c1", PathID: "p1", SubjectID: "s1"},
			"c2": {ID: "c2", PathID: "p1", SubjectID: "s1"},
		},
		failID: "c2",
	}
	svc := NewService(repo)
	teacher := identity.User{ID: "t1", Roles: []identity.Role{identity.RoleTeacher}}
	admin := identity.User{ID: "a1", Roles: []identity.Role{identity.RoleAdmin}}

	// Teacher without CanDelete is forbidden
	repo.scope = content.TrainerScope{Permissions: content.TrainerPermissions{ManageCourses: true, CanDelete: false}}
	if err := svc.DeleteRecord(context.Background(), teacher, "course", "c1"); !errors.Is(err, ErrForbidden) {
		t.Fatalf("expected forbidden without canDelete, got %v", err)
	}

	// Teacher with ManageCourses + CanDelete succeeds on unreferenced record
	repo.scope = content.TrainerScope{Permissions: content.TrainerPermissions{ManageCourses: true, CanDelete: true}}
	if err := svc.DeleteRecord(context.Background(), teacher, "course", "c1"); err != nil {
		t.Fatalf("expected teacher delete to succeed, got %v", err)
	}

	// Admin bulk delete collects deletedIds and blocked dependency errors
	res, err := svc.BulkDeleteRecords(context.Background(), admin, "course", []string{"c1", "c2", "c1"})
	if err != nil {
		t.Fatalf("bulk delete error: %v", err)
	}
	if len(res.DeletedIDs) != 1 || res.DeletedIDs[0] != "c1" {
		t.Fatalf("unexpected deletedIds: %+v", res.DeletedIDs)
	}
	if len(res.Blocked) != 1 || res.Blocked[0].ID != "c2" {
		t.Fatalf("unexpected blocked: %+v", res.Blocked)
	}
}
