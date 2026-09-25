package organizationshttp

import (
	"context"
	"errors"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	identityapp "github.com/nasef6464/almeaago/internal/identity/application"
	identitydomain "github.com/nasef6464/almeaago/internal/identity/domain"
	orgapp "github.com/nasef6464/almeaago/internal/organizations/application"
	orgdomain "github.com/nasef6464/almeaago/internal/organizations/domain"
)

type authStub struct {
	auth    identityapp.Authenticated
	authErr error
	csrfErr error
}

func (a authStub) Authenticate(context.Context, string) (identityapp.Authenticated, error) {
	return a.auth, a.authErr
}

func (a authStub) VerifyCSRF(identityapp.Authenticated, string) error {
	return a.csrfErr
}

type repoStub struct {
	contexts        []orgdomain.SchoolContext
	page            orgdomain.SchoolPage
	membershipWrite orgdomain.MembershipWrite
	directorWrite   orgdomain.DirectorWrite
	assignmentWrite orgdomain.AssignmentWrite
}

func (r *repoStub) SchoolContexts(
	_ context.Context,
	_ string,
) ([]orgdomain.SchoolContext, error) {
	return append([]orgdomain.SchoolContext(nil), r.contexts...), nil
}
func (r *repoStub) ListSchools(context.Context, orgdomain.AccessContext, orgdomain.SchoolListQuery) (orgdomain.SchoolPage, error) {
	return r.page, nil
}
func (r *repoStub) SchoolByID(context.Context, orgdomain.AccessContext, string) (orgdomain.School, error) {
	return orgdomain.School{}, orgdomain.ErrNotFound
}
func (r *repoStub) CreateSchool(context.Context, string, orgdomain.SchoolWrite) (orgdomain.School, error) {
	return orgdomain.School{ID: "school-1", Code: "SCH-1", Name: "School", Status: orgdomain.SchoolStatusActive}, nil
}
func (r *repoStub) UpdateSchool(context.Context, string, string, orgdomain.SchoolPatch) (orgdomain.School, error) {
	return orgdomain.School{}, nil
}
func (r *repoStub) ArchiveSchool(context.Context, string, string) (orgdomain.School, error) {
	return orgdomain.School{}, nil
}
func (r *repoStub) ListClasses(context.Context, orgdomain.AccessContext, string, orgdomain.ClassListQuery) (orgdomain.ClassPage, error) {
	return orgdomain.ClassPage{}, nil
}
func (r *repoStub) CreateClass(context.Context, string, string, orgdomain.ClassWrite) (orgdomain.Class, error) {
	return orgdomain.Class{}, nil
}
func (r *repoStub) UpdateClass(context.Context, string, string, string, orgdomain.ClassPatch) (orgdomain.Class, error) {
	return orgdomain.Class{}, nil
}
func (r *repoStub) ArchiveClass(context.Context, string, string, string) (orgdomain.Class, error) {
	return orgdomain.Class{}, nil
}
func (r *repoStub) Roster(context.Context, orgdomain.AccessContext, string, orgdomain.RosterQuery) (orgdomain.RosterPage, error) {
	return orgdomain.RosterPage{}, nil
}

func (r *repoStub) UpsertMembership(
	_ context.Context,
	_ string,
	schoolID string,
	write orgdomain.MembershipWrite,
) (orgdomain.SchoolMembership, error) {
	r.membershipWrite = write
	return orgdomain.SchoolMembership{
		ID:       "membership-1",
		SchoolID: schoolID,
		UserID:   write.UserID,
		Role:     write.Role,
		Status:   write.Status,
	}, nil
}
func (r *repoStub) ListDirectors(
	_ context.Context,
	_ string,
	query orgdomain.DirectorQuery,
) (orgdomain.DirectorPage, error) {
	return orgdomain.DirectorPage{Page: query.Page, Limit: query.Limit}, nil
}
func (r *repoStub) UpsertDirector(
	_ context.Context,
	_ string,
	schoolID string,
	write orgdomain.DirectorWrite,
) (orgdomain.DirectorRecord, error) {
	r.directorWrite = write
	return orgdomain.DirectorRecord{
		Membership: orgdomain.SchoolMembership{
			ID:          "director-membership-1",
			SchoolID:    schoolID,
			UserID:      write.UserID,
			Role:        identitydomain.RoleSchoolAdmin,
			Status:      write.Status,
			Permissions: append([]string(nil), write.Permissions...),
		},
	}, nil
}
func (r *repoStub) ListAssignments(
	_ context.Context,
	_ orgdomain.AccessContext,
	_ string,
	query orgdomain.AssignmentQuery,
) (orgdomain.AssignmentPage, error) {
	return orgdomain.AssignmentPage{Page: query.Page, Limit: query.Limit}, nil
}
func (r *repoStub) UpsertAssignment(
	_ context.Context,
	_ string,
	schoolID string,
	write orgdomain.AssignmentWrite,
) (orgdomain.TeachingAssignment, error) {
	r.assignmentWrite = write
	return orgdomain.TeachingAssignment{
		ID:        "assignment-1",
		SchoolID:  schoolID,
		TeacherID: write.TeacherID,
		ClassID:   write.ClassID,
		SubjectID: write.SubjectID,
		Status:    write.Status,
	}, nil
}
func (r *repoStub) CanAccessSchool(context.Context, orgdomain.AccessContext, string) (bool, error) {
	return true, nil
}
func (r *repoStub) CanManageSchool(context.Context, string, string) (bool, error) {
	return true, nil
}
func (r *repoStub) HasSchoolPermission(context.Context, string, string, string) (bool, error) {
	return true, nil
}

func adminAuth() identityapp.Authenticated {
	return identityapp.Authenticated{User: identitydomain.User{
		ID: "admin-1", Status: "active", Roles: []identitydomain.Role{identitydomain.RoleAdmin},
	}}
}

func TestListSchoolsRequiresSession(t *testing.T) {
	service := orgapp.NewService(&repoStub{})
	handler := New(service, authStub{authErr: identityapp.ErrUnauthenticated})
	request := httptest.NewRequest(http.MethodGet, "/", nil)
	response := httptest.NewRecorder()

	handler.ServeHTTP(response, request)

	if response.Code != http.StatusUnauthorized {
		t.Fatalf("expected 401, got %d", response.Code)
	}
}

func TestCreateSchoolRequiresCSRF(t *testing.T) {
	service := orgapp.NewService(&repoStub{})
	handler := New(service, authStub{auth: adminAuth(), csrfErr: identityapp.ErrCSRF})
	request := httptest.NewRequest(http.MethodPost, "/", strings.NewReader(`{"name":"School"}`))
	request.Header.Set("Content-Type", "application/json")
	response := httptest.NewRecorder()

	handler.ServeHTTP(response, request)

	if response.Code != http.StatusForbidden {
		t.Fatalf("expected 403, got %d", response.Code)
	}
}

func TestAdminCanListSchools(t *testing.T) {
	service := orgapp.NewService(&repoStub{
		page: orgdomain.SchoolPage{
			Schools: []orgdomain.School{{ID: "school-1", Code: "SCH-1", Name: "School", Status: orgdomain.SchoolStatusActive}},
			Page:    1, Limit: 50, Total: 1,
		},
	})
	handler := New(service, authStub{auth: adminAuth()})
	request := httptest.NewRequest(http.MethodGet, "/?page=1&limit=50", nil)
	response := httptest.NewRecorder()

	handler.ServeHTTP(response, request)

	if response.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d body=%s", response.Code, response.Body.String())
	}
	if !strings.Contains(response.Body.String(), `"total":1`) {
		t.Fatalf("unexpected response %s", response.Body.String())
	}
}

func TestParsePageLimitRejectsUnboundedRequests(t *testing.T) {
	request := httptest.NewRequest(http.MethodGet, "/?limit=101", nil)
	var page, limit int
	if err := parsePageLimit(request, &page, &limit); !errors.Is(err, orgapp.ErrInvalidInput) {
		t.Fatalf("expected invalid input, got %v", err)
	}
}

func TestParseRosterRejectsInvalidBoolean(t *testing.T) {
	request := httptest.NewRequest(http.MethodGet, "/?isActive=maybe", nil)
	if _, err := parseRosterQuery(request); !errors.Is(err, orgapp.ErrInvalidInput) {
		t.Fatalf("expected invalid input, got %v", err)
	}
}

func TestMembershipMutationRequiresCSRF(t *testing.T) {
	service := orgapp.NewService(&repoStub{})
	handler := New(service, authStub{auth: adminAuth(), csrfErr: identityapp.ErrCSRF})
	request := httptest.NewRequest(
		http.MethodPut,
		"/school-1/memberships",
		strings.NewReader(`{"userId":"student-1","role":"student","status":"active"}`),
	)
	request.Header.Set("Content-Type", "application/json")
	response := httptest.NewRecorder()

	handler.ServeHTTP(response, request)

	if response.Code != http.StatusForbidden {
		t.Fatalf("expected 403, got %d", response.Code)
	}
}

func TestExplicitEmptyDirectorPermissionsArePreserved(t *testing.T) {
	repo := &repoStub{}
	service := orgapp.NewService(repo)
	handler := New(service, authStub{auth: adminAuth()})
	request := httptest.NewRequest(
		http.MethodPut,
		"/school-1/directors/director-1",
		strings.NewReader(`{"status":"active","permissions":[]}`),
	)
	request.Header.Set("Content-Type", "application/json")
	response := httptest.NewRecorder()

	handler.ServeHTTP(response, request)

	if response.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d body=%s", response.Code, response.Body.String())
	}
	if repo.directorWrite.Permissions == nil {
		t.Fatal("explicit empty permission list must not become nil/default permissions")
	}
	if len(repo.directorWrite.Permissions) != 0 {
		t.Fatalf("expected no permissions, got %#v", repo.directorWrite.Permissions)
	}
}

func TestAssignmentAllowsLegacySubjectAgnosticPayload(t *testing.T) {
	repo := &repoStub{}
	service := orgapp.NewService(repo)
	handler := New(service, authStub{auth: adminAuth()})
	request := httptest.NewRequest(
		http.MethodPut,
		"/school-1/assignments",
		strings.NewReader(`{"teacherId":"teacher-1","classId":"class-1","subjectId":"","status":"active"}`),
	)
	request.Header.Set("Content-Type", "application/json")
	response := httptest.NewRecorder()

	handler.ServeHTTP(response, request)

	if response.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d body=%s", response.Code, response.Body.String())
	}
	if repo.assignmentWrite.SubjectID != "" {
		t.Fatalf("expected subject-agnostic assignment, got %q", repo.assignmentWrite.SubjectID)
	}
}

func TestSchoolContextUsesCanonicalMembershipData(t *testing.T) {
	repo := &repoStub{
		contexts: []orgdomain.SchoolContext{{
			SchoolID:    "school-1",
			SchoolName:  "School",
			Role:        identitydomain.RoleSchoolAdmin,
			Permissions: []string{orgdomain.PermissionSchoolStudentsView},
			Source:      "membership",
		}},
	}
	service := orgapp.NewService(repo)
	handler := New(service, authStub{auth: adminAuth()})
	request := httptest.NewRequest(http.MethodGet, "/context", nil)
	response := httptest.NewRecorder()

	handler.ServeHTTP(response, request)

	if response.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d body=%s", response.Code, response.Body.String())
	}
	body := response.Body.String()
	for _, fragment := range []string{
		`"schoolId":"school-1"`,
		`"role":"school_admin"`,
		`"source":"membership"`,
		`"SCHOOL_STUDENTS_VIEW"`,
	} {
		if !strings.Contains(body, fragment) {
			t.Fatalf("missing %s in %s", fragment, body)
		}
	}
}
