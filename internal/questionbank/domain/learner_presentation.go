package domain

import (
	"encoding/json"
	"errors"
	"strings"
)

// LearnerPresentation is the explicitly public part of sourceMeta. OptionLabels
// use the persisted option index, never their current shuffled display position.
type LearnerPresentation struct {
	QuestionNumber     string   `json:"questionNumber,omitempty"`
	ShowQuestionNumber *bool    `json:"showQuestionNumber,omitempty"`
	ShowOptionLabels   *bool    `json:"showOptionLabels,omitempty"`
	ShowOptionText     *bool    `json:"showOptionText,omitempty"`
	OptionLabelStyle   string   `json:"optionLabelStyle,omitempty"`
	OptionLabels       []string `json:"optionLabels,omitempty"`
}

var ErrInvalidLearnerPresentation = errors.New("invalid learner presentation")

func ParseLearnerPresentation(source json.RawMessage) (*LearnerPresentation, error) {
	if len(source) == 0 || string(source) == "null" {
		return nil, nil
	}
	var container map[string]json.RawMessage
	if err := json.Unmarshal(source, &container); err != nil {
		if json.Valid(source) {
			return nil, nil
		}
		return nil, err
	}
	raw, ok := container["learnerPresentation"]
	if !ok || string(raw) == "null" {
		return nil, nil
	}
	var p LearnerPresentation
	if err := json.Unmarshal(raw, &p); err != nil {
		return nil, ErrInvalidLearnerPresentation
	}
	p.QuestionNumber = strings.TrimSpace(p.QuestionNumber)
	if len([]rune(p.QuestionNumber)) > 50 || len(p.OptionLabels) > 12 || (p.OptionLabelStyle != "" && p.OptionLabelStyle != "arabic" && p.OptionLabelStyle != "latin") {
		return nil, ErrInvalidLearnerPresentation
	}
	for i, label := range p.OptionLabels {
		p.OptionLabels[i] = strings.TrimSpace(label)
		if len([]rune(p.OptionLabels[i])) > 24 {
			return nil, ErrInvalidLearnerPresentation
		}
	}
	return &p, nil
}
