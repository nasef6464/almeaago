package contenthttp

import (
	"encoding/json"
	content "github.com/nasef6464/almeaago/internal/content/domain"
	"testing"
)

func TestLearnerCourseFileLinksRespectAccess(t *testing.T) {
	raw := json.RawMessage(`{"title":"info","files":[{"title":"free","access":"free_preview","url":"https://example.test/free.pdf"},{"title":"paid","access":"enrolled_paid","url":"https://example.test/paid.pdf"},{"title":"unknown","url":"https://example.test/unknown.pdf"}]}`)
	course := content.LearnerCourseSummary{Presentation: raw}
	for _, tc := range []struct {
		name   string
		result map[string]any
		paid   bool
	}{
		{"public summary", presentLearnerCourseSummary(course), false},
		{"unauthorized detail", presentLearnerCourse(content.LearnerCourse{Course: course}), false},
		{"authorized detail", presentLearnerCourse(content.LearnerCourse{Course: course, AccessAllowed: true}), true},
	} {
		t.Run(tc.name, func(t *testing.T) {
			var data struct {
				Files []struct {
					Title string `json:"title"`
					URL   string `json:"url"`
				} `json:"files"`
			}
			rawResult, ok := tc.result["presentation"].(json.RawMessage)
			if !ok {
				t.Fatal("missing presentation")
			}
			if err := json.Unmarshal(rawResult, &data); err != nil {
				t.Fatal(err)
			}
			if len(data.Files) != 3 || data.Files[0].URL != "https://example.test/free.pdf" {
				t.Fatalf("free file missing: %#v", data.Files)
			}
			if (data.Files[1].URL != "") != tc.paid || (data.Files[2].URL != "") != tc.paid {
				t.Fatalf("non-free link disclosure: %#v", data.Files)
			}
		})
	}
	malformed := learnerCoursePresentation(json.RawMessage(`{"files":"unexpected"}`), false)
	var result map[string]json.RawMessage
	if err := json.Unmarshal(malformed, &result); err != nil || result["files"] != nil {
		t.Fatalf("unexpected malformed output: %s %v", malformed, err)
	}
}
