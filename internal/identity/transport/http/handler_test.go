package identityhttp

import (
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"

	"github.com/nasef6464/almeaago/internal/identity/application"
	"github.com/nasef6464/almeaago/internal/identity/domain"
)

type fakeService struct {
	authResult application.AuthResult
	auth       application.Authenticated
	authErr    error
	csrfErr    error
}

func (f *fakeService) Register(
	context.Context,
	string,
	string,
	string,
) (application.AuthResult, error) {
	return f.authResult, f.authErr
}

func (f *fakeService) Login(
	context.Context,
	string,
	string,
) (application.AuthResult, error) {
	return f.authResult, f.authErr
}

func (f *fakeService) LoginNationalID(
	context.Context,
	string,
	string,
) (application.AuthResult, error) {
	return f.authResult, f.authErr
}

func (f *fakeService) LoginPhone(
	context.Context,
	string,
	string,
) (application.AuthResult, error) {
	return f.authResult, f.authErr
}

func (f *fakeService) Authenticate(
	context.Context,
	string,
) (application.Authenticated, error) {
	return f.auth, f.authErr
}

func (f *fakeService) RotateCSRF(
	context.Context,
	application.Authenticated,
) (string, error) {
	return "rotated-csrf", f.authErr
}

func (f *fakeService) VerifyCSRF(application.Authenticated, string) error {
	return f.csrfErr
}

func (f *fakeService) Logout(context.Context, string) error {
	return f.authErr
}

func (f *fakeService) ForgotPassword(context.Context, string) error {
	return f.authErr
}

func (f *fakeService) ResetPassword(
	context.Context,
	string,
	string,
) (domain.User, error) {
	return f.auth.User, f.authErr
}

func (f *fakeService) VerifyEmail(
	context.Context,
	string,
) (domain.User, error) {
	return f.auth.User, f.authErr
}

func (f *fakeService) ResendEmailVerification(
	context.Context,
	domain.User,
) error {
	return f.authErr
}

func TestLoginSetsHttpOnlySessionAndReturnsCSRF(t *testing.T) {
	service := &fakeService{
		authResult: application.AuthResult{
			User: domain.User{
				ID:            "019b0000-0000-7000-8000-000000000001",
				Email:         "student@example.com",
				Name:          "Student",
				Status:        "active",
				EmailVerified: true,
				Roles:         []domain.Role{domain.RoleStudent},
			},
			SessionToken: "raw-session",
			CSRFToken:    "raw-csrf",
			ExpiresAt:    time.Now().Add(time.Hour),
		},
	}

	router := New(service, false)
	req := httptest.NewRequest(
		http.MethodPost,
		"/login",
		strings.NewReader("{\"email\":\"student@example.com\",\"password\":\"Password1\"}"),
	)
	req.Header.Set("Content-Type", "application/json")
	rec := httptest.NewRecorder()
	router.ServeHTTP(rec, req)

	if rec.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d body=%s", rec.Code, rec.Body.String())
	}
	if rec.Header().Get("Cache-Control") != "no-store" {
		t.Fatal("auth responses must not be cached")
	}

	found := false
	for _, cookie := range rec.Result().Cookies() {
		if cookie.Name == sessionCookieName {
			found = true
			if !cookie.HttpOnly || cookie.Value != "raw-session" {
				t.Fatal("invalid session cookie")
			}
		}
	}
	if !found {
		t.Fatal("session cookie missing")
	}

	var body map[string]any
	if err := json.Unmarshal(rec.Body.Bytes(), &body); err != nil {
		t.Fatal(err)
	}
	if body["csrfToken"] != "raw-csrf" {
		t.Fatal("csrf token missing from auth result")
	}
}

func TestMeDoesNotExposeIdentityPII(t *testing.T) {
	service := &fakeService{
		auth: application.Authenticated{
			User: domain.User{
				ID:         "019b0000-0000-7000-8000-000000000001",
				Email:      "student@example.com",
				Name:       "Student",
				Status:     "active",
				NationalID: "1234567890",
				Phone:      "966500000000",
				Roles:      []domain.Role{domain.RoleStudent},
			},
			Session: domain.Session{ExpiresAt: time.Now().Add(time.Hour)},
		},
	}

	router := New(service, false)
	req := httptest.NewRequest(http.MethodGet, "/me", nil)
	req.AddCookie(&http.Cookie{Name: sessionCookieName, Value: "raw-session"})
	rec := httptest.NewRecorder()
	router.ServeHTTP(rec, req)

	if rec.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d", rec.Code)
	}
	body := rec.Body.String()
	if strings.Contains(body, "nationalId") || strings.Contains(body, "phone") {
		t.Fatalf("generic auth response leaked identity PII: %s", body)
	}
}

func TestLogoutRejectsInvalidCSRF(t *testing.T) {
	service := &fakeService{
		auth: application.Authenticated{
			User: domain.User{ID: "user-1", Status: "active"},
			Session: domain.Session{
				ID:        "session-1",
				ExpiresAt: time.Now().Add(time.Hour),
			},
		},
		csrfErr: application.ErrCSRF,
	}

	router := New(service, false)
	req := httptest.NewRequest(http.MethodPost, "/logout", nil)
	req.AddCookie(&http.Cookie{Name: sessionCookieName, Value: "raw-session"})
	req.Header.Set("X-CSRF-Token", "wrong")
	rec := httptest.NewRecorder()
	router.ServeHTTP(rec, req)

	if rec.Code != http.StatusForbidden {
		t.Fatalf("expected 403, got %d body=%s", rec.Code, rec.Body.String())
	}
}

func TestForgotPasswordResponseIsGeneric(t *testing.T) {
	service := &fakeService{authErr: application.ErrInvalidInput}
	router := New(service, false)

	req := httptest.NewRequest(
		http.MethodPost,
		"/forgot-password",
		strings.NewReader("{\"email\":\"missing@example.com\"}"),
	)
	req.Header.Set("Content-Type", "application/json")
	rec := httptest.NewRecorder()
	router.ServeHTTP(rec, req)

	if rec.Code != http.StatusOK {
		t.Fatalf("expected generic 200, got %d", rec.Code)
	}
	if !strings.Contains(rec.Body.String(), "If this email exists") {
		t.Fatal("forgot password response must remain generic")
	}
}
