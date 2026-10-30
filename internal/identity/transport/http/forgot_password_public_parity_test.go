package identityhttp

import (
    "context"
    "encoding/json"
    "errors"
    "net/http"
    "net/http/httptest"
    "strings"
    "testing"
    "time"

    "github.com/nasef6464/almeaago/internal/identity/application"
    "github.com/nasef6464/almeaago/internal/identity/domain"
)

const originalForgotPasswordConfirmation = "إذا كان البريد مسجلًا، ستصلك تعليمات الاستعادة. تحقق من البريد الوارد والرسائل غير المرغوب فيها."

// Embed the repository interface so this focused HTTP test only implements the
// lookup/issuance paths it exercises; it never connects to production or PostgreSQL.
type publicRecoveryRepository struct {
    application.Repository
    user domain.User
    lookupErr error
    issued int
}

func (r *publicRecoveryRepository) UserByEmail(context.Context, string) (domain.User, error) {
    return r.user, r.lookupErr
}

func (r *publicRecoveryRepository) IssueOneTimeToken(context.Context, string, string, string, time.Time) error {
    r.issued++
    return nil
}

// Source pages/ForgotPassword.tsx always renders the same generic Arabic copy
// after a successful HTTP response, whether an account exists or not.
func TestForgotPasswordPublicConfirmationMatchesOriginal(t *testing.T) {
    cases := []struct {
        name string
        body string
        user domain.User
        lookupErr error
        expectedIssuance int
    }{
        {name: "invalid address", body: `{"email":"not-an-email"}`},
        {name: "empty address", body: `{"email":""}`},
        {name: "unknown account", body: `{"email":"unknown@example.com"}`, lookupErr: domain.ErrNotFound},
        {name: "lookup unavailable", body: `{"email":"student@example.com"}`, lookupErr: errors.New("database unavailable")},
        {name: "existing account", body: `{"email":"student@example.com"}`, user: domain.User{ID: "student-1", Email: "student@example.com", Status: "active"}, expectedIssuance: 1},
    }
    for _, tc := range cases {
        t.Run(tc.name, func(t *testing.T) {
            repo := &publicRecoveryRepository{user: tc.user, lookupErr: tc.lookupErr}
            handler := New(application.NewService(repo), false)
            request := httptest.NewRequest(http.MethodPost, "/forgot-password", strings.NewReader(tc.body))
            request.Header.Set("Content-Type", "application/json")
            response := httptest.NewRecorder()
            handler.ServeHTTP(response, request)
            if response.Code != http.StatusOK {
                t.Fatalf("status = %d; want 200; body: %s", response.Code, response.Body.String())
            }
            var payload struct { Message string `json:"message"` }
            if err := json.Unmarshal(response.Body.Bytes(), &payload); err != nil {
                t.Fatalf("decode response: %v", err)
            }
            if payload.Message != originalForgotPasswordConfirmation {
                t.Fatalf("confirmation = %q; want original %q", payload.Message, originalForgotPasswordConfirmation)
            }
            if repo.issued != tc.expectedIssuance {
                t.Fatalf("issued reset tokens = %d; want %d", repo.issued, tc.expectedIssuance)
            }
        })
    }
}
