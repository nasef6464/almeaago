package postgres

import question "github.com/nasef6464/almeaago/internal/questionbank/domain"

// Malformed legacy metadata never exposes arbitrary source fields to learners.
func learnerPresentation(raw []byte) *question.LearnerPresentation {
	value, err := question.ParseLearnerPresentation(raw)
	if err != nil {
		return nil
	}
	return value
}
