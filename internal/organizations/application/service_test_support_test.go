package application

import (
	"context"

	identity "github.com/nasef6464/almeaago/internal/identity/domain"
	org "github.com/nasef6464/almeaago/internal/organizations/domain"
)

type repositoryMock struct {
	accessAllowed     bool
	manageAllowed     bool
	permissionAllowed bool
	lastSchoolQuery   org.SchoolListQuery
	lastClassQuery    org.ClassListQuery
	lastRosterQuery   org.RosterQuery
	createdSchool     org.SchoolWrite
	updatedSchool     org.SchoolPatch
	createdClass      org.ClassWrite
	updatedClass      org.ClassPatch
}

func (m *repositoryMock) ListSchools(_ context.Context, _ org.AccessContext, query org.SchoolListQuery) (org.SchoolPage, error) {
	m.lastSchoolQuery = query
	return org.SchoolPage{Page: query.Page, Limit: query.Limit}, nil
}

func (m *repositoryMock) SchoolByID(_ context.Context, _ org.AccessContext, schoolID string) (org.School, error) {
	return org.School{ID: schoolID, Status: org.SchoolStatusActive}, nil
}

func (m *repositoryMock) CreateSchool(_ context.Context, _ string, write org.SchoolWrite) (org.School, error) {
	m.createdSchool = write
	return org.School{ID: "school-1", Code: write.Code, Name: write.Name, Status: write.Status, Metadata: write.Metadata}, nil
}

func (m *repositoryMock) UpdateSchool(_ context.Context, _ string, schoolID string, patch org.SchoolPatch) (org.School, error) {
	m.updatedSchool = patch
	return org.School{ID: schoolID, Status: org.SchoolStatusActive}, nil
}

func (m *repositoryMock) ArchiveSchool(_ context.Context, _ string, schoolID string) (org.School, error) {
	return org.School{ID: schoolID, Status: org.SchoolStatusArchived}, nil
}

func (m *repositoryMock) ListClasses(_ context.Context, _ org.AccessContext, _ string, query org.ClassListQuery) (org.ClassPage, error) {
	m.lastClassQuery = query
	return org.ClassPage{Page: query.Page, Limit: query.Limit}, nil
}

func (m *repositoryMock) CreateClass(_ context.Context, _ string, schoolID string, write org.ClassWrite) (org.Class, error) {
	m.createdClass = write
	return org.Class{ID: "class-1", SchoolID: schoolID, Code: write.Code, Name: write.Name, Status: write.Status, Metadata: write.Metadata}, nil
}

func (m *repositoryMock) UpdateClass(_ context.Context, _ string, schoolID, classID string, patch org.ClassPatch) (org.Class, error) {
	m.updatedClass = patch
	return org.Class{ID: classID, SchoolID: schoolID, Status: org.ClassStatusActive}, nil
}

func (m *repositoryMock) ArchiveClass(_ context.Context, _ string, schoolID, classID string) (org.Class, error) {
	return org.Class{ID: classID, SchoolID: schoolID, Status: org.ClassStatusArchived}, nil
}

func (m *repositoryMock) Roster(_ context.Context, _ org.AccessContext, _ string, query org.RosterQuery) (org.RosterPage, error) {
	m.lastRosterQuery = query
	return org.RosterPage{Page: query.Page, Limit: query.Limit}, nil
}

func (m *repositoryMock) CanAccessSchool(context.Context, org.AccessContext, string) (bool, error) {
	return m.accessAllowed, nil
}

func (m *repositoryMock) CanManageSchool(context.Context, string, string) (bool, error) {
	return m.manageAllowed, nil
}

func (m *repositoryMock) HasSchoolPermission(context.Context, string, string, string) (bool, error) {
	return m.permissionAllowed, nil
}

func actor(id string, role identity.Role) identity.User {
	return identity.User{ID: id, Status: "active", Roles: []identity.Role{role}}
}
