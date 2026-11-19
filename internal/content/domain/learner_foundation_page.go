package domain

type LearnerFoundationPage struct {
	PathID    string
	SubjectID string
	Items     []LearnerTopicSummary
	Page      int
	HasMore   bool
}
