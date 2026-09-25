package application

import (
	"context"
	"errors"

	identity "github.com/nasef6464/almeaago/internal/identity/domain"
	org "github.com/nasef6464/almeaago/internal/organizations/domain"
)

type repositoryMock struct {
	contexts          []org.SchoolContext
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
	membershipWrite   org.MembershipWrite
	directorQuery     org.DirectorQuery
	directorWrite     org.DirectorWrite
	assignmentQuery   org.AssignmentQuery
	assignmentWrite   org.AssignmentWrite
	teacherWorkspace org.TeacherWorkspace
}

func (m *repositoryMock) TeacherWorkspace(_ context.Context, _ string) (org.TeacherWorkspace, error) {
	return m.teacherWorkspace, nil
}

func (m *repositoryMock) SchoolContexts(
	_ context.Context,
	_ string,
) ([]org.SchoolContext, error) {
	return append([]org.SchoolContext(nil), m.contexts...), nil
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

func (m *repositoryMock) UpsertMembership(
	_ context.Context,
	_ string,
	schoolID string,
	write org.MembershipWrite,
) (org.SchoolMembership, error) {
	m.membershipWrite = write
	return org.SchoolMembership{
		ID:       "membership-1",
		SchoolID: schoolID,
		UserID:   write.UserID,
		Role:     write.Role,
		Status:   write.Status,
	}, nil
}

func (m *repositoryMock) ListDirectors(
	_ context.Context,
	_ string,
	query org.DirectorQuery,
) (org.DirectorPage, error) {
	m.directorQuery = query
	return org.DirectorPage{Page: query.Page, Limit: query.Limit}, nil
}

func (m *repositoryMock) UpsertDirector(
	_ context.Context,
	_ string,
	schoolID string,
	write org.DirectorWrite,
) (org.DirectorRecord, error) {
	m.directorWrite = write
	return org.DirectorRecord{
		Membership: org.SchoolMembership{
			ID:          "director-membership-1",
			SchoolID:    schoolID,
			UserID:      write.UserID,
			Role:        identity.RoleSchoolAdmin,
			Status:      write.Status,
			Permissions: append([]string(nil), write.Permissions...),
		},
	}, nil
}

func (m *repositoryMock) ListAssignments(
	_ context.Context,
	_ org.AccessContext,
	_ string,
	query org.AssignmentQuery,
) (org.AssignmentPage, error) {
	m.assignmentQuery = query
	return org.AssignmentPage{Page: query.Page, Limit: query.Limit}, nil
}

func (m *repositoryMock) UpsertAssignment(
	_ context.Context,
	_ string,
	schoolID string,
	write org.AssignmentWrite,
) (org.TeachingAssignment, error) {
	m.assignmentWrite = write
	return org.TeachingAssignment{
		ID:        "assignment-1",
		SchoolID:  schoolID,
		TeacherID: write.TeacherID,
		ClassID:   write.ClassID,
		SubjectID: write.SubjectID,
		Status:    write.Status,
	}, nil
}

func (m *repositoryMock) DirectorAddStudent(
	_ context.Context,
	_ string,
	_ string,
	write org.DirectorStudentCreate,
) (org.DirectorStudentMutationResult, error) {
	return org.DirectorStudentMutationResult{
		Student: org.DirectorStudent{
			StudentID: "student-1",
			Name:      write.Name,
			Email:     write.Email,
			Active:    true,
			ClassID:   write.ClassID,
		},
		Created: true,
	}, nil
}

func (m *repositoryMock) DirectorMoveStudent(
	_ context.Context,
	_ string,
	_ string,
	studentID string,
	classID string,
) (org.DirectorStudentMutationResult, error) {
	return org.DirectorStudentMutationResult{
		Student: org.DirectorStudent{
			StudentID: studentID,
			Active:    true,
			ClassID:   classID,
		},
	}, nil
}

func (m *repositoryMock) DirectorUpdateStudentBasic(
	_ context.Context,
	_ string,
	_ string,
	studentID string,
	patch org.DirectorStudentBasicPatch,
) (org.DirectorStudentMutationResult, error) {
	name := "Student"
	if patch.Name != nil {
		name = *patch.Name
	}
	return org.DirectorStudentMutationResult{
		Student: org.DirectorStudent{StudentID: studentID, Name: name, Active: true},
	}, nil
}

func (m *repositoryMock) DirectorSetStudentActive(
	_ context.Context,
	_ string,
	_ string,
	studentID string,
	active bool,
) (org.DirectorStudentMutationResult, error) {
	return org.DirectorStudentMutationResult{
		Student: org.DirectorStudent{StudentID: studentID, Active: active},
	}, nil
}

func (m *repositoryMock) ListDirectorStudents(
	_ context.Context,
	_ string,
	query org.DirectorStudentQuery,
) (org.DirectorStudentPage, error) {
	return org.DirectorStudentPage{Page: query.Page, Limit: query.Limit}, nil
}

func (m *repositoryMock) DirectorTeachers(
	context.Context,
	string,
) (org.DirectorTeacherWorkspace, error) {
	return org.DirectorTeacherWorkspace{}, nil
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


func TestTeacherWorkspaceRequiresTeacherRole(t *testing.T) {
	service := NewService(&repositoryMock{})
	if _, err := service.TeacherWorkspace(context.Background(), actor("admin-1", identity.RoleAdmin)); !errors.Is(err, ErrForbidden) {
		t.Fatalf("expected forbidden, got %v", err)
	}
}

func TestTeacherWorkspaceDelegatesTeacherIdentity(t *testing.T) {
	repo := &repositoryMock{teacherWorkspace: org.TeacherWorkspace{
		Schools: []org.TeacherWorkspaceSchool{{SchoolID: "school-1"}},
	}}
	service := NewService(repo)
	workspace, err := service.TeacherWorkspace(context.Background(), actor("teacher-1", identity.RoleTeacher))
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if len(workspace.Schools) != 1 || workspace.Schools[0].SchoolID != "school-1" {
		t.Fatalf("unexpected workspace: %#v", workspace)
	}
}
