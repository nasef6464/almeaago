package domain

import (
	"encoding/json"
	"testing"
)

func TestLearnerPresentationPreservesExplicitFalseAndSafeFields(t *testing.T) {
	value, err := ParseLearnerPresentation(json.RawMessage(`{"private":"not exposed","learnerPresentation":{"questionNumber":"١٢","showQuestionNumber":false,"showOptionText":false,"optionLabelStyle":"latin","optionLabels":["A","B"]}}`))
	if err != nil || value == nil || value.ShowQuestionNumber == nil || *value.ShowQuestionNumber || value.ShowOptionText == nil || *value.ShowOptionText || value.OptionLabels[1] != "B" {
		t.Fatalf("presentation lost: %+v %v", value, err)
	}
	if _, err = ParseLearnerPresentation(json.RawMessage(`{"learnerPresentation":{"optionLabelStyle":"invalid"}}`)); err == nil {
		t.Fatal("expected invalid style")
	}
}
