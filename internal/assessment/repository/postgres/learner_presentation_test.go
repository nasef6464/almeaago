package postgres

import (
	"encoding/json"
	"strings"
	"testing"
)

func TestLearnerPresentationProjectionWhitelistsAndPreservesIndices(t *testing.T) {
	got := learnerPresentation([]byte(`{"learnerPresentation":{"showOptionText":false,"optionLabelStyle":"latin","optionLabels":["A","","C","D"],"secret":"not public"},"sourceSecret":"hidden"}`))
	if got == nil || got.ShowOptionText == nil || *got.ShowOptionText || len(got.OptionLabels) != 4 || got.OptionLabels[1] != "" || got.OptionLabels[2] != "C" {
		t.Fatalf("bad projection: %+v", got)
	}
	raw, err := json.Marshal(got)
	if err != nil || strings.Contains(string(raw), "secret") {
		t.Fatalf("private source metadata exposed: %s %v", raw, err)
	}
	if learnerPresentation([]byte(`{"learnerPresentation":{"showOptionText":"yes"}}`)) != nil {
		t.Fatal("invalid legacy presentation must not be projected")
	}
}

func TestLearnerQuestionImageDetection(t *testing.T) {
	for _, tc := range []struct {
		asset, url, text string
		want             bool
	}{
		{asset: "asset-id", text: "نص داخلي", want: true},
		{url: "https://example.invalid/q", want: true},
		{text: "image: https://example.invalid/q", want: true},
		{text: "https://example.invalid/q.png?x=1", want: true},
		{text: `<img src="https://example.invalid/q">`, want: true},
		{text: `![q](https://example.invalid/q)`, want: true},
		{text: "سؤال لفظي نصي", want: false},
		{text: "image: ", want: false},
	} {
		if got := learnerQuestionHasImage(tc.asset, tc.url, tc.text); got != tc.want {
			t.Errorf("image detection for %+v = %v", tc, got)
		}
	}
}
