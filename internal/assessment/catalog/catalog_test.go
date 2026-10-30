package catalog

import (
	"context"
	"encoding/json"
	"fmt"
	"net/http/httptest"
	"strings"
	"testing"
)

type catalogStub struct{}

func (catalogStub) ListPublicMocks(context.Context) ([]MockSummary, error) {
	return []MockSummary{{ID: "published", PathID: "path", Title: "محاكاة", QuestionCount: 120, SectionCount: 4, TimeLimitSeconds: 7200}}, nil
}
func TestPublicMockCatalogReturnsSummaryWithoutAttemptOrQuestionPayload(t *testing.T) {
	h := NewHandler(NewService(catalogStub{}))
	r := httptest.NewRecorder()
	h.ServeHTTP(r, httptest.NewRequest("GET", "/", nil))
	if r.Code != 200 {
		t.Fatalf("%d %s", r.Code, r.Body.String())
	}
	var got struct {
		Mocks []MockSummary `json:"mocks"`
	}
	if err := json.Unmarshal(r.Body.Bytes(), &got); err != nil {
		t.Fatal(err)
	}
	if len(got.Mocks) != 1 || got.Mocks[0].QuestionCount != 120 || got.Mocks[0].TimeLimitSeconds != 7200 {
		t.Fatalf("bad metadata: %s", r.Body.String())
	}
	for _, secret := range []string{"questionIds", "answer", "startToken", "attempt"} {
		if strings.Contains(r.Body.String(), secret) {
			t.Fatalf("unsafe public metadata %s", r.Body.String())
		}
	}
	if r.Header().Get("Cache-Control") == "" {
		t.Fatal("missing public cache policy")
	}
}

type brokenCatalog struct{}

func (brokenCatalog) ListPublicMocks(context.Context) ([]MockSummary, error) {
	return []MockSummary{{ID: "SECRET_PARTIAL"}}, fmt.Errorf("private database detail")
}
func TestPublicMockCatalogFailsClosedOnRepositoryError(t *testing.T) {
	response := httptest.NewRecorder()
	NewHandler(NewService(brokenCatalog{})).ServeHTTP(response, httptest.NewRequest("GET", "/", nil))
	if response.Code != 503 || strings.Contains(response.Body.String(), "SECRET") || strings.Contains(response.Body.String(), "database") {
		t.Fatalf("unsafe error %d %s", response.Code, response.Body.String())
	}
}
