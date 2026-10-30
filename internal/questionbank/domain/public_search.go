package domain

// PublicSearchPreview contains only an approved current public question title (max120 UTF16 units).
// It cannot carry options, answers, explanations or historical draft versions.
type PublicSearchPreview struct {
	ID        string
	Title     string
	Subtitle  string
	PathID    string
	SubjectID string
}
