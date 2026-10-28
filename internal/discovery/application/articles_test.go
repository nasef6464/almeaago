package application

import (
	"context"
	content "github.com/nasef6464/almeaago/internal/content/domain"
	"testing"
	"time"
)

type articlesStub struct{ page, limit int }

func (r *articlesStub) ListPublicArticles(_ context.Context, page, limit int) (content.PublicArticlePage, error) {
	r.page, r.limit = page, limit
	stamp := time.UnixMilli(1760000000123)
	return content.PublicArticlePage{Items: []content.PublicArticle{{ID: "one", Title: "مقال", Description: "مقدمة", PathID: "path", SubjectID: "subject", Type: "text", ApprovedAt: &stamp}, {ID: "two", Type: "video"}}, Page: page, Limit: limit, HasMore: true}, nil
}
func TestPublicArticlesPreservePaginationAndCanonicalDate(t *testing.T) {
	r := &articlesStub{}
	out, err := NewArticleService(r).List(context.Background(), 2, 100)
	if err != nil {
		t.Fatal(err)
	}
	if r.page != 2 || r.limit != 100 || !out.HasMore || out.Items[0].ApprovedAt == nil || *out.Items[0].ApprovedAt != 1760000000123 || out.Items[1].ApprovedAt != nil || out.Items[1].Type != "video" {
		t.Fatalf("%#v", out)
	}
}
func TestPublicArticlesRejectInvalidPagination(t *testing.T) {
	for _, in := range [][2]int{{0, 20}, {1, 0}, {1, 101}, {-1, 20}} {
		if _, err := NewArticleService(&articlesStub{}).List(context.Background(), in[0], in[1]); err != ErrInvalidInput {
			t.Fatal(in, err)
		}
	}
}
