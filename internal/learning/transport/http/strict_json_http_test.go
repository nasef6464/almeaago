package learninghttp

import (
    "context"
    "net/http"
    "net/http/httptest"
    "strings"
    "testing"

    identityapp "github.com/nasef6464/almeaago/internal/identity/application"
    learningapp "github.com/nasef6464/almeaago/internal/learning/application"
)

type studentJSONDocumentTestAuth struct{}

func (studentJSONDocumentTestAuth) Authenticate(context.Context, string) (identityapp.Authenticated, error) {
    return identityapp.Authenticated{}, nil
}
func (studentJSONDocumentTestAuth) VerifyCSRF(identityapp.Authenticated, string) error {
    return nil
}

// A malformed write must be rejected by the real HTTP route before a service
// (and therefore any PostgreSQL mutation) is reached. Deliberately nil service
// dependencies make an accidental service invocation fail the test.
func TestStudentLearningHTTPRejectsAmbiguousJSONBeforeMutation(t *testing.T) {
    auth := studentJSONDocumentTestAuth{}
    cases := []struct {
        name string
        handler http.Handler
        method string
        path string
        body string
    }{
        {"study plan create", NewStudyPlans(nil, auth), http.MethodPost, "/", `{"name":"first"}{"name":"second"}`},
        {"study plan update", NewStudyPlans(nil, auth), http.MethodPatch, "/plan-1", `{"name":"first"}null`},
        {"review answer", NewReview(nil, auth), http.MethodPost, "/cards/card-1/answer", `{"submissionKey":"first"}{"submissionKey":"second"}`},
        {"goal create", NewMasteryWithGoals(nil, &learningapp.MasteryGoalService{}, auth), http.MethodPost, "/goals", `{"title":"first"}[]`},
        {"goal update", NewMasteryWithGoals(nil, &learningapp.MasteryGoalService{}, auth), http.MethodPatch, "/goals/goal-1", `{"title":"first"}oops`},
    }
    for _, tc := range cases {
        t.Run(tc.name, func(t *testing.T) {
            req := httptest.NewRequest(tc.method, tc.path, strings.NewReader(tc.body))
            req.Header.Set("Content-Type", "application/json")
            req.Header.Set("X-CSRF-Token", "test-token")
            rec := httptest.NewRecorder()
            tc.handler.ServeHTTP(rec, req)
            if rec.Code != http.StatusBadRequest {
                t.Fatalf("status=%d, want 400; body=%s", rec.Code, rec.Body.String())
            }
        })
    }
}

func TestLearningJSONDocumentRejectsNullScalarAndOverLimit(t *testing.T) {
    for _, body := range []string{`null`, `[]`, `"text"`, `0`, `true`, `{"name":"first","unexpected":1}`, `{"name":"first"}{"name":"second"}`, `{"name":"` + strings.Repeat("x", 65<<10) + `"}`} {
        req := httptest.NewRequest(http.MethodPost, "/", strings.NewReader(body))
        rec := httptest.NewRecorder()
        var out struct { Name string `json:"name"` }
        if decodeLearningWriteJSON(rec, req, &out, 64<<10) {
            t.Fatalf("accepted invalid document beginning %.40q", body)
        }
        if rec.Code != http.StatusBadRequest {
            t.Fatalf("status=%d, want 400", rec.Code)
        }
    }
    req := httptest.NewRequest(http.MethodPost, "/", strings.NewReader("{\"name\":\"plan\"}\n\t "))
    rec := httptest.NewRecorder()
    var out struct { Name string `json:"name"` }
    if !decodeLearningWriteJSON(rec, req, &out, 64<<10) || out.Name != "plan" {
        t.Fatalf("valid single JSON object rejected: status=%d", rec.Code)
    }
}
