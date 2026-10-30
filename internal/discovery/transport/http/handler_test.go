package discoveryhttp

import (
	"context"
	"encoding/json"
	"errors"
	discovery "github.com/nasef6464/almeaago/internal/discovery/domain"
	"net/http/httptest"
	"strings"
	"testing"
)

type searchStub struct {
	in    discovery.Query
	calls int
	err   error
}

func (s *searchStub) Search(_ context.Context, in discovery.Query) (discovery.Payload, error) {
	s.calls++
	s.in = in
	return discovery.Payload{Q: in.Q, Type: in.Type, Results: discovery.Results{Courses: []discovery.Result{}, Lessons: []discovery.Result{}, Questions: []discovery.Result{}}}, s.err
}
func TestSearchHTTPPublicDefaultsAndExplicitTypes(t *testing.T) {
	for _, path := range []string{"/?q=x", "/?q=x&type=question&limit=1"} {
		s := &searchStub{}
		w := httptest.NewRecorder()
		New(s).ServeHTTP(w, httptest.NewRequest("GET", path, nil))
		if w.Code != 200 {
			t.Fatalf("%s: %d %s", path, w.Code, w.Body.String())
		}
		var body map[string]any
		if err := json.Unmarshal(w.Body.Bytes(), &body); err != nil {
			t.Fatal(err)
		}
		groups := body["results"].(map[string]any)
		for _, group := range []string{"courses", "lessons", "questions"} {
			if rows, ok := groups[group].([]any); !ok || len(rows) != 0 {
				t.Fatal(body)
			}
		}
		if path == "/?q=x" && (s.in.Limit != 20 || s.in.Type != "all") {
			t.Fatal(s.in)
		}
	}
}
func TestSearchHTTPRejectsMalformedPaginationAndType(t *testing.T) {
	for _, query := range []string{"q=x&limit=0", "q=x&limit=21", "q=x&limit=1.5", "q=x&limit=wat", "q=x&type=users", "q=x&type=", "q=x&limit=", "q=x&q=y", "q=x&limit=1&limit=2"} {
		s := &searchStub{}
		w := httptest.NewRecorder()
		New(s).ServeHTTP(w, httptest.NewRequest("GET", "/?"+query, nil))
		if w.Code != 400 || s.calls != 0 {
			t.Fatalf("%s: %d, calls=%d", query, w.Code, s.calls)
		}
	}
}
func TestSearchHTTPDoesNotExposeStorageError(t *testing.T) {
	s := &searchStub{err: errors.New("private database details")}
	w := httptest.NewRecorder()
	New(s).ServeHTTP(w, httptest.NewRequest("GET", "/?q=x", nil))
	if w.Code != 500 || strings.Contains(w.Body.String(), "private") {
		t.Fatalf("%d %s", w.Code, w.Body.String())
	}
}
