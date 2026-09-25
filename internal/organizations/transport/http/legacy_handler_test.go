package organizationshttp

import (
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	orgapp "github.com/nasef6464/almeaago/internal/organizations/application"
	orgdomain "github.com/nasef6464/almeaago/internal/organizations/domain"
)

func TestLegacyMembershipMapsInactiveToRevoked(t *testing.T) {
	repo := &repoStub{}
	handler := NewLegacy(orgapp.NewService(repo), authStub{auth: adminAuth()})
	request := httptest.NewRequest(
		http.MethodPut,
		"/memberships",
		strings.NewReader(`{"schoolId":"school-1","userId":"student-1","role":"student","status":"inactive"}`),
	)
	request.Header.Set("Content-Type", "application/json")
	response := httptest.NewRecorder()

	handler.ServeHTTP(response, request)

	if response.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d body=%s", response.Code, response.Body.String())
	}
	if repo.membershipWrite.Status != orgdomain.MembershipStatusRevoked {
		t.Fatalf("expected revoked canonical status, got %q", repo.membershipWrite.Status)
	}
	if !strings.Contains(response.Body.String(), `"status":"inactive"`) {
		t.Fatalf("legacy response must preserve inactive shape: %s", response.Body.String())
	}
}

func TestLegacyDirectorMapsInactiveToRevoked(t *testing.T) {
	repo := &repoStub{}
	handler := NewLegacy(orgapp.NewService(repo), authStub{auth: adminAuth()})
	request := httptest.NewRequest(
		http.MethodPut,
		"/directors/school-1/director-1",
		strings.NewReader(`{"status":"inactive","permissions":["SCHOOL_OVERVIEW_VIEW"]}`),
	)
	request.Header.Set("Content-Type", "application/json")
	response := httptest.NewRecorder()

	handler.ServeHTTP(response, request)

	if response.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d body=%s", response.Code, response.Body.String())
	}
	if repo.directorWrite.Status != orgdomain.MembershipStatusRevoked {
		t.Fatalf("expected revoked canonical status, got %q", repo.directorWrite.Status)
	}
	if !strings.Contains(response.Body.String(), `"status":"inactive"`) {
		t.Fatalf("legacy response must preserve inactive shape: %s", response.Body.String())
	}
}

func TestLegacyAssignmentMapsInactiveToEnded(t *testing.T) {
	repo := &repoStub{}
	handler := NewLegacy(orgapp.NewService(repo), authStub{auth: adminAuth()})
	request := httptest.NewRequest(
		http.MethodPut,
		"/assignments",
		strings.NewReader(`{"schoolId":"school-1","teacherId":"teacher-1","classId":"class-1","subjectId":"","status":"inactive"}`),
	)
	request.Header.Set("Content-Type", "application/json")
	response := httptest.NewRecorder()

	handler.ServeHTTP(response, request)

	if response.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d body=%s", response.Code, response.Body.String())
	}
	if repo.assignmentWrite.Status != orgdomain.AssignmentStatusEnded {
		t.Fatalf("expected ended canonical status, got %q", repo.assignmentWrite.Status)
	}
	if !strings.Contains(response.Body.String(), `"assignmentId":"assignment-1"`) ||
		!strings.Contains(response.Body.String(), `"status":"inactive"`) {
		t.Fatalf("unexpected legacy assignment response: %s", response.Body.String())
	}
}

func TestLegacyStatusRejectsUnknownValues(t *testing.T) {
	if _, ok := legacyMembershipStatus("paused"); ok {
		t.Fatal("unknown membership status must be rejected")
	}
	if _, ok := legacyAssignmentStatus("paused"); ok {
		t.Fatal("unknown assignment status must be rejected")
	}
}
