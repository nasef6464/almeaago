package contenthttp

import (
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"

	contentapp "github.com/nasef6464/almeaago/internal/content/application"
	content "github.com/nasef6464/almeaago/internal/content/domain"
	postgresrepo "github.com/nasef6464/almeaago/internal/content/repository/postgres"
	identity "github.com/nasef6464/almeaago/internal/identity/domain"
)

type repoReturningPostgresErrorStub struct {
	contentapp.Repository
}

func (repoReturningPostgresErrorStub) EnrollFreeCourse(_ context.Context, userID, courseID string) (content.CourseEnrollmentResponse, error) {
	// Directly return the error defined in internal/content/repository/postgres/enrollment.go
	return content.CourseEnrollmentResponse{}, postgresrepo.ErrCoursePurchaseRequired
}

// TestChallenge_PaidCourseEnrollmentMustReturn403 verifies that when the repository layer
// returns postgres.ErrCoursePurchaseRequired for a paid course, the HTTP handler must
// respond with HTTP 403 and {"code": "COURSE_PURCHASE_REQUIRED"}.
func TestChallenge_PaidCourseEnrollmentMustReturn403(t *testing.T) {
	student := identity.User{ID: "student-1", Roles: []identity.Role{identity.RoleStudent}}
	auth := staticAuthStub{user: student}

	// Wire handler with service backed by repository returning postgresrepo.ErrCoursePurchaseRequired
	handler := NewCourses(contentapp.NewService(repoReturningPostgresErrorStub{}), auth)

	rec := httptest.NewRecorder()
	req := httptest.NewRequest(http.MethodPost, "/paid-course-123/enroll", nil)
	handler.ServeHTTP(rec, req)

	t.Logf("Response Status Code: %d", rec.Code)
	t.Logf("Response Body: %s", rec.Body.String())

	if rec.Code != http.StatusForbidden {
		t.Fatalf("BUG CONFIRMED: Expected HTTP 403 Forbidden on paid course enrollment, got %d. Body: %s", rec.Code, rec.Body.String())
	}

	var body map[string]any
	if err := json.Unmarshal(rec.Body.Bytes(), &body); err != nil {
		t.Fatalf("Failed to decode response JSON: %v", err)
	}

	if body["code"] != "COURSE_PURCHASE_REQUIRED" {
		t.Fatalf("BUG CONFIRMED: Expected code='COURSE_PURCHASE_REQUIRED', got %v", body["code"])
	}
}
