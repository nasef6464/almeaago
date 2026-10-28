package domain

type Query struct {
	Q     string
	Type  string
	Limit int
}
type Result struct {
	ID        string  `json:"id"`
	Title     string  `json:"title"`
	Subtitle  string  `json:"subtitle"`
	Route     string  `json:"route"`
	PathID    string  `json:"pathId"`
	SubjectID string  `json:"subjectId"`
	SectionID *string `json:"sectionId,omitempty"`
}
type Results struct {
	Courses   []Result `json:"courses"`
	Lessons   []Result `json:"lessons"`
	Questions []Result `json:"questions"`
}
type Payload struct {
	Q       string  `json:"q"`
	Type    string  `json:"type"`
	Results Results `json:"results"`
}
