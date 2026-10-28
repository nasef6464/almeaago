package domain

type Article struct {
	ID          string `json:"id"`
	Title       string `json:"title"`
	Description string `json:"description"`
	PathID      string `json:"pathId"`
	SubjectID   string `json:"subjectId"`
	Type        string `json:"type"`
	ApprovedAt  *int64 `json:"approvedAt,omitempty"`
}
type ArticlePage struct {
	Items   []Article `json:"items"`
	Page    int       `json:"page"`
	Limit   int       `json:"limit"`
	HasMore bool      `json:"hasMore"`
}
