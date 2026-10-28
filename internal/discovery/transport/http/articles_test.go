package discoveryhttp

import (
	"context"
	discovery "github.com/nasef6464/almeaago/internal/discovery/domain"
	"net/http/httptest"
	"testing"
)

type articlesHTTPStub struct{ calls, page, limit int }

func (s *articlesHTTPStub) List(_ context.Context, page, limit int) (discovery.ArticlePage, error) {
	s.calls++
	s.page, s.limit = page, limit
	return discovery.ArticlePage{Items: []discovery.Article{}, Page: page, Limit: limit}, nil
}
func TestArticlesHTTPPaginationIsExplicit(t *testing.T) {
	for _, query := range []string{"", "?page=2&limit=100"} {
		s := &articlesHTTPStub{}
		w := httptest.NewRecorder()
		NewArticles(s).ServeHTTP(w, httptest.NewRequest("GET", "/"+query, nil))
		if w.Code != 200 {
			t.Fatal(w.Code, w.Body.String())
		}
		if query == "" && (s.page != 1 || s.limit != 20) {
			t.Fatal(s)
		}
	}
	for _, query := range []string{"?page=0", "?limit=101", "?limit=", "?page=1&page=2"} {
		s := &articlesHTTPStub{}
		w := httptest.NewRecorder()
		NewArticles(s).ServeHTTP(w, httptest.NewRequest("GET", "/"+query, nil))
		if w.Code != 400 || s.calls != 0 {
			t.Fatal(query, w.Code, s)
		}
	}
}
