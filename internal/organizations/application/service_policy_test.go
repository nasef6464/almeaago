package application

import (
	"context"
	"encoding/json"
	"errors"
	"strings"
	"testing"

	identity "github.com/nasef6464/almeaago/internal/identity/domain"
	org "github.com/nasef6464/almeaago/internal/organizations/domain"
)

func TestCreateSchoolRequiresAdminAndNormalizesInput(t *testing.T) {
	repo := &repositoryMock{}
	service := NewService(repo)

	if _, err := service.CreateSchool(
		context.Background(),
		actor("supervisor-1", identity.RoleSupervisor),
		CreateSchoolInput{Name: "School"},
	); !errors.Is(err, ErrForbidden) {
		t.Fatalf("expected forbidden, got %v", err)
	}

	school, err := service.CreateSchool(
		context.Background(),
		actor("admin-1", identity.RoleAdmin),
		CreateSchoolInput{
			Code:     " sch-demo ",
			Name:     "  Demo School  ",
			Metadata: json.RawMessage(`{"location":"Jeddah"}`),
		},
	)
	if err != nil {
		t.Fatal(err)
	}
	if school.Code != "SCH-DEMO" || school.Name != "Demo School" {
		t.Fatalf("unexpected normalized school %#v", school)
	}
	if string(repo.createdSchool.Metadata) != `{"location":"Jeddah"}` {
		t.Fatalf("unexpected metadata %s", repo.createdSchool.Metadata)
	}
}

func TestListSchoolsCapsPageSizeAndRejectsLongSearch(t *testing.T) {
	repo := &repositoryMock{}
	service := NewService(repo)

	_, err := service.ListSchools(
		context.Background(),
		actor("admin-1", identity.RoleAdmin),
		org.SchoolListQuery{Page: 0, Limit: 500},
	)
	if err != nil {
		t.Fatal(err)
	}
	if repo.lastSchoolQuery.Page != 1 || repo.lastSchoolQuery.Limit != 100 {
		t.Fatalf("unexpected normalized query %#v", repo.lastSchoolQuery)
	}

	_, err = service.ListSchools(
		context.Background(),
		actor("admin-1", identity.RoleAdmin),
		org.SchoolListQuery{Search: strings.Repeat("x", 121)},
	)
	if !errors.Is(err, ErrInvalidInput) {
		t.Fatalf("expected invalid input, got %v", err)
	}
}

func TestSupervisorNeedsSchoolWideScopeForSchoolMutation(t *testing.T) {
	repo := &repositoryMock{manageAllowed: false}
	service := NewService(repo)
	name := "Updated"

	if _, err := service.UpdateSchool(
		context.Background(),
		actor("supervisor-1", identity.RoleSupervisor),
		"school-1",
		UpdateSchoolInput{Name: &name},
	); !errors.Is(err, ErrForbidden) {
		t.Fatalf("expected forbidden, got %v", err)
	}

	repo.manageAllowed = true
	if _, err := service.UpdateSchool(
		context.Background(),
		actor("supervisor-1", identity.RoleSupervisor),
		"school-1",
		UpdateSchoolInput{Name: &name},
	); err != nil {
		t.Fatal(err)
	}
}

func TestSchoolAdminNeedsClassPermission(t *testing.T) {
	repo := &repositoryMock{}
	service := NewService(repo)
	input := CreateClassInput{Name: "Class A"}

	if _, err := service.CreateClass(
		context.Background(),
		actor("director-1", identity.RoleSchoolAdmin),
		"school-1",
		input,
	); !errors.Is(err, ErrForbidden) {
		t.Fatalf("expected forbidden, got %v", err)
	}

	repo.permissionAllowed = true
	class, err := service.CreateClass(
		context.Background(),
		actor("director-1", identity.RoleSchoolAdmin),
		"school-1",
		input,
	)
	if err != nil {
		t.Fatal(err)
	}
	if class.Name != "Class A" || !strings.HasPrefix(class.Code, "CLS-") {
		t.Fatalf("unexpected class %#v", class)
	}
}

func TestTeacherRosterIsStudentOnlyAndScoped(t *testing.T) {
	repo := &repositoryMock{accessAllowed: true}
	service := NewService(repo)

	page, err := service.Roster(
		context.Background(),
		actor("teacher-1", identity.RoleTeacher),
		"school-1",
		org.RosterQuery{Page: 0, Limit: 500},
	)
	if err != nil {
		t.Fatal(err)
	}
	if page.Page != 1 || page.Limit != 100 {
		t.Fatalf("unexpected roster pagination %#v", page)
	}
	if repo.lastRosterQuery.Role == nil || *repo.lastRosterQuery.Role != identity.RoleStudent {
		t.Fatalf("teacher roster must be student-only: %#v", repo.lastRosterQuery)
	}

	role := identity.RoleTeacher
	if _, err := service.Roster(
		context.Background(),
		actor("teacher-1", identity.RoleTeacher),
		"school-1",
		org.RosterQuery{Role: &role},
	); !errors.Is(err, ErrForbidden) {
		t.Fatalf("expected teacher non-student roster to be forbidden, got %v", err)
	}
}

func TestSchoolAdminRosterRequiresViewPermission(t *testing.T) {
	repo := &repositoryMock{accessAllowed: true}
	service := NewService(repo)

	if _, err := service.Roster(
		context.Background(),
		actor("director-1", identity.RoleSchoolAdmin),
		"school-1",
		org.RosterQuery{},
	); !errors.Is(err, ErrForbidden) {
		t.Fatalf("expected forbidden, got %v", err)
	}

	repo.permissionAllowed = true
	if _, err := service.Roster(
		context.Background(),
		actor("director-1", identity.RoleSchoolAdmin),
		"school-1",
		org.RosterQuery{},
	); err != nil {
		t.Fatal(err)
	}
	if repo.lastRosterQuery.Role == nil || *repo.lastRosterQuery.Role != identity.RoleStudent {
		t.Fatalf("director roster must default to students: %#v", repo.lastRosterQuery)
	}
}

func TestArchiveStatusCannotBypassArchiveLifecycle(t *testing.T) {
	repo := &repositoryMock{manageAllowed: true, permissionAllowed: true}
	service := NewService(repo)

	schoolStatus := org.SchoolStatusArchived
	if _, err := service.UpdateSchool(
		context.Background(),
		actor("admin-1", identity.RoleAdmin),
		"school-1",
		UpdateSchoolInput{Status: &schoolStatus},
	); !errors.Is(err, ErrInvalidInput) {
		t.Fatalf("expected school archive patch rejection, got %v", err)
	}

	classStatus := org.ClassStatusArchived
	if _, err := service.UpdateClass(
		context.Background(),
		actor("admin-1", identity.RoleAdmin),
		"school-1",
		"class-1",
		UpdateClassInput{Status: &classStatus},
	); !errors.Is(err, ErrInvalidInput) {
		t.Fatalf("expected class archive patch rejection, got %v", err)
	}
}


func TestMembershipMutationRequiresPlatformAdmin(t *testing.T) {
	repo := &repositoryMock{}
	service := NewService(repo)

	if _, err := service.UpsertMembership(
		context.Background(),
		actor("director-1", identity.RoleSchoolAdmin),
		"school-1",
		UpsertMembershipInput{
			UserID: "student-1",
			Role:   identity.RoleStudent,
		},
	); !errors.Is(err, ErrForbidden) {
		t.Fatalf("expected forbidden membership mutation, got %v", err)
	}

	membership, err := service.UpsertMembership(
		context.Background(),
		actor("admin-1", identity.RoleAdmin),
		"school-1",
		UpsertMembershipInput{
			UserID: "student-1",
			Role:   identity.RoleStudent,
		},
	)
	if err != nil {
		t.Fatal(err)
	}
	if membership.Status != org.MembershipStatusActive ||
		repo.membershipWrite.Status != org.MembershipStatusActive {
		t.Fatalf("expected active membership default, got %#v", membership)
	}
}

func TestDirectorDefaultsMatchLegacyPermissionSet(t *testing.T) {
	repo := &repositoryMock{}
	service := NewService(repo)

	record, err := service.UpsertDirector(
		context.Background(),
		actor("admin-1", identity.RoleAdmin),
		"school-1",
		UpsertDirectorInput{
			UserID: "director-1",
		},
	)
	if err != nil {
		t.Fatal(err)
	}
	expected := org.DefaultSchoolDirectorPermissions
	if len(record.Membership.Permissions) != len(expected) {
		t.Fatalf("unexpected default permissions %#v", record.Membership.Permissions)
	}
	for index, permission := range expected {
		if record.Membership.Permissions[index] != permission {
			t.Fatalf("permission %d: expected %q got %q", index, permission, record.Membership.Permissions[index])
		}
	}

	if _, err := service.UpsertDirector(
		context.Background(),
		actor("admin-1", identity.RoleAdmin),
		"school-1",
		UpsertDirectorInput{
			UserID:      "director-1",
			Permissions: []string{"NOT_A_REAL_PERMISSION"},
		},
	); !errors.Is(err, ErrInvalidInput) {
		t.Fatalf("expected invalid director permission, got %v", err)
	}
}

func TestSchoolDirectorAssignmentRequiresTeacherAssignPermission(t *testing.T) {
	repo := &repositoryMock{}
	service := NewService(repo)
	director := actor("director-1", identity.RoleSchoolAdmin)
	input := UpsertAssignmentInput{
		TeacherID: "teacher-1",
		ClassID:   "class-1",
	}

	if _, err := service.UpsertAssignment(
		context.Background(),
		director,
		"school-1",
		input,
	); !errors.Is(err, ErrForbidden) {
		t.Fatalf("expected forbidden assignment mutation, got %v", err)
	}

	repo.permissionAllowed = true
	assignment, err := service.UpsertAssignment(
		context.Background(),
		director,
		"school-1",
		input,
	)
	if err != nil {
		t.Fatal(err)
	}
	if assignment.Status != org.AssignmentStatusActive {
		t.Fatalf("expected active assignment default, got %#v", assignment)
	}
	if repo.assignmentWrite.SubjectID != "" {
		t.Fatalf("legacy subject-agnostic assignment must remain empty, got %q", repo.assignmentWrite.SubjectID)
	}
}

func TestTeacherAssignmentDirectoryIsSelfScoped(t *testing.T) {
	repo := &repositoryMock{}
	service := NewService(repo)
	teacher := actor("teacher-1", identity.RoleTeacher)

	page, err := service.ListAssignments(
		context.Background(),
		teacher,
		"school-1",
		org.AssignmentQuery{Page: 0, Limit: 500},
	)
	if err != nil {
		t.Fatal(err)
	}
	if page.Page != 1 || page.Limit != 100 {
		t.Fatalf("unexpected pagination %#v", page)
	}
	if repo.assignmentQuery.TeacherID != "teacher-1" {
		t.Fatalf("teacher directory must be self-scoped: %#v", repo.assignmentQuery)
	}

	if _, err := service.ListAssignments(
		context.Background(),
		teacher,
		"school-1",
		org.AssignmentQuery{TeacherID: "teacher-2"},
	); !errors.Is(err, ErrForbidden) {
		t.Fatalf("expected other-teacher assignment denial, got %v", err)
	}
}

func TestDirectorDirectoryIsBoundedAndAdminOnly(t *testing.T) {
	repo := &repositoryMock{}
	service := NewService(repo)

	if _, err := service.ListDirectors(
		context.Background(),
		actor("supervisor-1", identity.RoleSupervisor),
		"school-1",
		org.DirectorQuery{},
	); !errors.Is(err, ErrForbidden) {
		t.Fatalf("expected director directory to be admin-only, got %v", err)
	}

	page, err := service.ListDirectors(
		context.Background(),
		actor("admin-1", identity.RoleAdmin),
		"school-1",
		org.DirectorQuery{Limit: 500},
	)
	if err != nil {
		t.Fatal(err)
	}
	if page.Limit != 100 || repo.directorQuery.Limit != 100 {
		t.Fatalf("director directory must cap at 100, got %#v", repo.directorQuery)
	}
}


func TestGenericMembershipCannotGrantSchoolAdmin(t *testing.T) {
	service := NewService(&repositoryMock{})

	if _, err := service.UpsertMembership(
		context.Background(),
		actor("admin-1", identity.RoleAdmin),
		"school-1",
		UpsertMembershipInput{
			UserID: "director-1",
			Role:   identity.RoleSchoolAdmin,
			Status: org.MembershipStatusActive,
		},
	); !errors.Is(err, ErrInvalidInput) {
		t.Fatalf("school_admin must use director delegation flow, got %v", err)
	}
}
