package postgres

import (
	"regexp"
	"strings"

	question "github.com/nasef6464/almeaago/internal/questionbank/domain"
)

var legacyQuestionImage = regexp.MustCompile(`(?i)^https?://.+\.(png|jpg|jpeg|gif|webp|svg)(\?.*)?$|<img\s+[^>]*src=["'][^"']+["']|!\[.*?\]\(https?://[^\s)]+\)`)

// Mirror the learner UI's image detection for imported legacy questions too.
func learnerQuestionHasImage(assetID, imageURL, text string) bool {
	if assetID != "" || imageURL != "" {
		return true
	}
	text = strings.TrimSpace(text)
	if strings.HasPrefix(strings.ToLower(text), "image:") {
		return strings.TrimSpace(text[len("image:"):]) != ""
	}
	return legacyQuestionImage.MatchString(text)
}

// Malformed legacy metadata never exposes arbitrary source fields to learners.
func learnerPresentation(raw []byte) *question.LearnerPresentation {
	value, err := question.ParseLearnerPresentation(raw)
	if err != nil {
		return nil
	}
	return value
}
