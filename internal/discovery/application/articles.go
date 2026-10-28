package application

import (
	"context"
	content "github.com/nasef6464/almeaago/internal/content/domain"
	discovery "github.com/nasef6464/almeaago/internal/discovery/domain"
)

type ArticleReader interface {
	ListPublicArticles(context.Context, int, int) (content.PublicArticlePage, error)
}
type ArticleService struct{ reader ArticleReader }

func NewArticleService(reader ArticleReader) *ArticleService { return &ArticleService{reader: reader} }
func (s *ArticleService) List(ctx context.Context, page, limit int) (discovery.ArticlePage, error) {
	if page < 1 || limit < 1 || limit > 100 || page > (int(^uint(0)>>1)/limit) {
		return discovery.ArticlePage{}, ErrInvalidInput
	}
	rows, err := s.reader.ListPublicArticles(ctx, page, limit)
	if err != nil {
		return discovery.ArticlePage{}, err
	}
	out := discovery.ArticlePage{Items: []discovery.Article{}, Page: rows.Page, Limit: rows.Limit, HasMore: rows.HasMore}
	for _, row := range rows.Items {
		var approvedAt *int64
		if row.ApprovedAt != nil {
			stamp := row.ApprovedAt.UnixMilli()
			approvedAt = &stamp
		}
		out.Items = append(out.Items, discovery.Article{ID: row.ID, Title: row.Title, Description: row.Description, PathID: row.PathID, SubjectID: row.SubjectID, Type: row.Type, ApprovedAt: approvedAt})
	}
	return out, nil
}
