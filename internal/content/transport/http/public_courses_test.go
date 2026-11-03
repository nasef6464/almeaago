package contenthttp

import (
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"

	contentapp "github.com/nasef6464/almeaago/internal/content/application"
	content "github.com/nasef6464/almeaago/internal/content/domain"
	identityapp "github.com/nasef6464/almeaago/internal/identity/application"
	identity "github.com/nasef6464/almeaago/internal/identity/domain"
)

type publicReaderStub struct{ contentapp.Repository }

func (publicReaderStub) ListPublicCourses(_ context.Context, limit int) ([]content.PublicCourse, error) {
	return []content.PublicCourse{{ID: "published-1", Title: "دورة منشورة", InstructorName: "معلم"}}, nil
}

func (publicReaderStub) EnrollFreeCourse(_ context.Context, userID, courseID string) (content.CourseEnrollmentResponse, error) {
	if courseID == "paid-course-1" {
		return content.CourseEnrollmentResponse{}, contentapp.ErrCoursePurchaseRequired
	}
	return content.CourseEnrollmentResponse{
		Success:         true,
		Enrolled:        true,
		AlreadyEnrolled: false,
		CourseID:        courseID,
		Message:         "Enrolled in course successfully",
	}, nil
}

type staticAuthStub struct {
	user identity.User
}

func (s staticAuthStub) Authenticate(ctx context.Context, rawToken string) (identityapp.Authenticated, error) {
	return identityapp.Authenticated{User: s.user}, nil
}

func (s staticAuthStub) VerifyCSRF(auth identityapp.Authenticated, rawToken string) error {
	return nil
}

func TestAnonymousPublicCoursesRead(t *testing.T) {
	handler := NewCourses(contentapp.NewService(publicReaderStub{}), nil)
	response := httptest.NewRecorder()
	handler.ServeHTTP(response, httptest.NewRequest(http.MethodGet, "/public?limit=3", nil))
	if response.Code != 200 {
		t.Fatalf("guest status=%d body=%s", response.Code, response.Body.String())
	}
	var body struct {
		Items []content.PublicCourse `json:"items"`
	}
	if err := json.Unmarshal(response.Body.Bytes(), &body); err != nil {
		t.Fatal(err)
	}
	if len(body.Items) != 1 || body.Items[0].ID != "published-1" {
		t.Fatalf("unexpected public courses %+v", body.Items)
	}
}

func TestPublicCoursesRejectUnboundedLimit(t *testing.T) {
	handler := NewCourses(contentapp.NewService(publicReaderStub{}), nil)
	for _, url := range []string{"/public?limit=101", "/public?limit=-1", "/public?limit=abc"} {
		response := httptest.NewRecorder()
		handler.ServeHTTP(response, httptest.NewRequest(http.MethodGet, url, nil))
		if response.Code != 400 {
			t.Errorf("%s: expected 400 got %d", url, response.Code)
		}
	}
}

func TestEnrollFreeCourseEndpoint(t *testing.T) {
	student := identity.User{ID: "student-1", Roles: []identity.Role{identity.RoleStudent}}
	auth := staticAuthStub{user: student}
	handler := NewCourses(contentapp.NewService(publicReaderStub{}), auth)

	response := httptest.NewRecorder()
	handler.ServeHTTP(response, httptest.NewRequest(http.MethodPost, "/free-course-123/enroll", nil))

	if response.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d: %s", response.Code, response.Body.String())
	}

	var resp content.CourseEnrollmentResponse
	if err := json.Unmarshal(response.Body.Bytes(), &resp); err != nil {
		t.Fatalf("failed to decode response: %v", err)
	}

	if !resp.Success || !resp.Enrolled || resp.CourseID != "free-course-123" {
		t.Errorf("unexpected enrollment response: %+v", resp)
	}
}

func TestEnrollPaidCourseFails(t *testing.T) {
	student := identity.User{ID: "student-1", Roles: []identity.Role{identity.RoleStudent}}
	auth := staticAuthStub{user: student}
	handler := NewCourses(contentapp.NewService(publicReaderStub{}), auth)

	response := httptest.NewRecorder()
	handler.ServeHTTP(response, httptest.NewRequest(http.MethodPost, "/paid-course-1/enroll", nil))

	if response.Code != http.StatusForbidden {
		t.Fatalf("expected 403 Forbidden, got %d: %s", response.Code, response.Body.String())
	}

	var errBody map[string]any
	if err := json.Unmarshal(response.Body.Bytes(), &errBody); err != nil {
		t.Fatalf("failed to decode response: %v", err)
	}

	if errBody["code"] != "COURSE_PURCHASE_REQUIRED" {
		t.Errorf("expected code='COURSE_PURCHASE_REQUIRED', got %v", errBody["code"])
	}
}
