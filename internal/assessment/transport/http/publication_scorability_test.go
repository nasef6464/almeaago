package assessmenthttp

import (
	"net/http/httptest"
	"strings"
	"testing"

	assessment "github.com/nasef6464/almeaago/internal/assessment/domain"
)

func TestPublicationUnscorableQuestionErrorIsActionable(t *testing.T) {
	w := httptest.NewRecorder()
	writeError(w, assessment.ErrUnscorableQuestion)
	if w.Code != 409 || !strings.Contains(w.Body.String(), "غير قابل للتصحيح") {
		t.Fatalf("expected actionable conflict, got %d %s", w.Code, w.Body.String())
	}
}
