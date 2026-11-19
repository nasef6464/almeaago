package contenthttp

import (
	"context"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	app "github.com/nasef6464/almeaago/internal/content/application"
	content "github.com/nasef6464/almeaago/internal/content/domain"
)

type foundationPageHTTPRepo struct{ app.Repository }

func (foundationPageHTTPRepo) ListLearnerFoundationPage(_ context.Context, path, subject string, page, _ int) (content.LearnerFoundationPage, error) {
	return content.LearnerFoundationPage{PathID: path, SubjectID: subject, Page: page, Items: []content.LearnerTopicSummary{{ID: "child", ParentTopicID: "root", IsLocked: false}}, HasMore: false}, nil
}

func TestLearnerFoundationPageHTTPPublicAndNoStore(t *testing.T) {
	handler := NewLearningSpaces(app.NewService(foundationPageHTTPRepo{}), nil)
	w := httptest.NewRecorder()
	handler.ServeHTTP(w, httptest.NewRequest(http.MethodGet, "/p1/subjects/s1/foundation?page=2&limit=50", nil))
	if w.Code != http.StatusOK || w.Header().Get("Cache-Control") != "private, no-store" || !strings.Contains(w.Body.String(), `"parentTopicId":"root"`) || !strings.Contains(w.Body.String(), `"isFree":true`) {
		t.Fatalf("page response: %d %s", w.Code, w.Body.String())
	}
	w = httptest.NewRecorder()
	handler.ServeHTTP(w, httptest.NewRequest(http.MethodGet, "/p1/subjects/s1/foundation?page=0", nil))
	if w.Code != http.StatusBadRequest {
		t.Fatalf("invalid page: %d", w.Code)
	}
}
