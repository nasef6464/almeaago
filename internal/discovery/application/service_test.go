package application

import (
	"context"
	"errors"
	content "github.com/nasef6464/almeaago/internal/content/domain"
	discovery "github.com/nasef6464/almeaago/internal/discovery/domain"
	question "github.com/nasef6464/almeaago/internal/questionbank/domain"
	"strings"
	"testing"
)

type contentPreviewStub struct {
	courses, lessons int
	query            string
	limit            int
	fail             error
}

func (r *contentPreviewStub) SearchPublicCourses(_ context.Context, q string, limit int) ([]content.PublicSearchPreview, error) {
	r.courses++
	r.query = q
	r.limit = limit
	return []content.PublicSearchPreview{{ID: "course", Title: "دورة", Subtitle: "وصف", PathID: "path", SubjectID: "subject"}}, r.fail
}
func (r *contentPreviewStub) SearchPublicLessons(_ context.Context, q string, limit int) ([]content.PublicSearchPreview, error) {
	r.lessons++
	return []content.PublicSearchPreview{{ID: "lesson", Title: "درس", PathID: "path", SubjectID: "subject with spaces"}}, r.fail
}

type questionPreviewStub struct {
	calls int
	fail  error
}

func (r *questionPreviewStub) SearchPublicQuestions(context.Context, string, int) ([]question.PublicSearchPreview, error) {
	r.calls++
	return []question.PublicSearchPreview{{ID: "question", Title: "سؤال", Subtitle: "hard", PathID: "path", SubjectID: "subject with spaces"}}, r.fail
}
func TestSearchSourceGroupsRoutesAndSelectedPorts(t *testing.T) {
	c, q := &contentPreviewStub{}, &questionPreviewStub{}
	s := NewService(c, q)
	got, err := s.Search(context.Background(), discovery.Query{Q: "  درس%_  ", Type: "all", Limit: 7})
	if err != nil {
		t.Fatal(err)
	}
	if c.query != "درس%_" || c.limit != 7 || c.courses != 1 || c.lessons != 1 || q.calls != 1 {
		t.Fatalf("ports: %#v %#v", c, q)
	}
	if got.Q != "درس%_" || got.Type != "all" || got.Results.Courses[0].Route != "/course/course" || got.Results.Lessons[0].Route != "/category/path?subject=subject%20with%20spaces" || got.Results.Questions[0].Route != "/category/path?subject=subject%20with%20spaces&tab=tests" {
		t.Fatalf("result: %#v", got)
	}
	c.courses, c.lessons, q.calls = 0, 0, 0
	got, err = s.Search(context.Background(), discovery.Query{Q: "x", Type: "course", Limit: 20})
	if err != nil {
		t.Fatal(err)
	}
	if c.courses != 1 || c.lessons != 0 || q.calls != 0 || got.Results.Lessons == nil || got.Results.Questions == nil {
		t.Fatalf("unselected arrays/ports: %#v", got)
	}
}
func TestSearchRejectsInvalidSourceQueryBeforePorts(t *testing.T) {
	c, q := &contentPreviewStub{}, &questionPreviewStub{}
	s := NewService(c, q)
	for _, in := range []discovery.Query{{Q: " ", Type: "all", Limit: 20}, {Q: strings.Repeat("س", 121), Type: "all", Limit: 20}, {Q: strings.Repeat("😀", 61), Type: "all", Limit: 20}, {Q: "x", Type: "users", Limit: 20}, {Q: "x", Type: "all", Limit: 0}, {Q: "x", Type: "all", Limit: 21}} {
		if _, err := s.Search(context.Background(), in); !errors.Is(err, ErrInvalidInput) {
			t.Fatalf("accepted %#v: %v", in, err)
		}
	}
	if c.courses+c.lessons+q.calls != 0 {
		t.Fatal("invalid query reached ports")
	}
}
func TestSearchReaderFailureNeverMasqueradesAsEmptySuccess(t *testing.T) {
	failure := errors.New("database unavailable")
	c, q := &contentPreviewStub{fail: failure}, &questionPreviewStub{}
	if _, err := NewService(c, q).Search(context.Background(), discovery.Query{Q: "x", Type: "all", Limit: 20}); !errors.Is(err, failure) {
		t.Fatal(err)
	}
}
