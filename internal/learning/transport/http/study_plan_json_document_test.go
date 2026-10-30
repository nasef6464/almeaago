package learninghttp

import (
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	learning "github.com/nasef6464/almeaago/internal/learning/domain"
)

// A study-plan write must contain exactly one JSON object. Accepting the first
// of two documents can persist a draft different from what the learner sent.
func TestDecodeStudyPlanRejectsTrailingJSONBeforeWrite(t *testing.T) {
	tests := []struct {
		name     string
		body     string
		accepted bool
	}{
		{name: "single object", body: `{"name":"الخطة"}`, accepted: true},
		{name: "trailing whitespace", body: "{\"name\":\"plan\"}\n \t", accepted: true},
		{name: "second object", body: `{"name":"first"}{"name":"second"}`, accepted: false},
		{name: "trailing null", body: `{"name":"first"}null`, accepted: false},
		{name: "trailing array", body: `{"name":"first"}[]`, accepted: false},
		{name: "trailing garbage", body: `{"name":"first"}oops`, accepted: false},
		{name: "unknown field", body: `{"name":"first","notInContract":1}`, accepted: false},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			req := httptest.NewRequest(http.MethodPost, "/api/v1/study-plans/", strings.NewReader(tt.body))
			rec := httptest.NewRecorder()
			var out learning.StudyPlanWrite
			accepted := decodeStudyPlan(rec, req, &out)
			if accepted != tt.accepted {
				t.Fatalf("decodeStudyPlan accepted=%t, want %t; status=%d", accepted, tt.accepted, rec.Code)
			}
			if !tt.accepted && rec.Code != http.StatusBadRequest {
				t.Fatalf("invalid JSON status=%d, want 400", rec.Code)
			}
		})
	}
}
