package domain

import "time"

// PublicSearchPreview is a deliberately bounded catalogue projection, never lesson content.
type PublicSearchPreview struct {
	ID        string
	Title     string
	Subtitle  string
	PathID    string
	SubjectID string
}

type PublicArticle struct {
	ID          string
	Title       string
	Description string
	PathID      string
	SubjectID   string
	Type        string
	ApprovedAt  *time.Time
}
type PublicArticlePage struct {
	Items   []PublicArticle
	Page    int
	Limit   int
	HasMore bool
}
