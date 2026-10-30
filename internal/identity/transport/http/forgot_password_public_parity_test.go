package identityhttp

import (
    "encoding/json"
    "net/http"
    "net/http/httptest"
    "strings"
    "testing"

    "github.com/nasef6464/almeaago/internal/identity/application"
)

const originalForgotPasswordConfirmation = "إذا كان البريد مسجلًا، ستصلك تعليمات الاستعادة. تحقق من البريد الوارد والرسائل غير المرغوب فيها."

// The Legacy visitor page always displays this non-enumerating Arabic confirmation
// after a successful forgot-password request, regardless of the account's existence.
// Invalid/empty addresses exercise the real Go HTTP handler without a database write.
func TestForgotPasswordPublicConfirmationMatchesOriginal(t *testing.T) {
    handler := New(application.NewService(nil), false)
    for _, tc := range []struct {
        name string
        body string
    }{
        {name: "invalid address", body: `{"email":"not-an-email"}`},
        {name: "empty address", body: `{"email":""}`},
    } {
        t.Run(tc.name, func(t *testing.T) {
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
        })
    }
}
