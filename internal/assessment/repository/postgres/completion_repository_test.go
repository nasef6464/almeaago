package postgres

import (
	"testing"
)

func TestNormalizeTaxonomyCode(t *testing.T) {
	tests := []struct {
		input            string
		expectedClean    string
		expectedNormCode string
	}{
		{
			input:            "p_qudrat",
			expectedClean:    "p_qudrat",
			expectedNormCode: "qudrat",
		},
		{
			input:            "P_Tahsili",
			expectedClean:    "P_Tahsili",
			expectedNormCode: "tahsili",
		},
		{
			input:            "p-qudrat",
			expectedClean:    "p-qudrat",
			expectedNormCode: "qudrat",
		},
		{
			input:            "s_verbal",
			expectedClean:    "s_verbal",
			expectedNormCode: "verbal",
		},
		{
			input:            "s-math",
			expectedClean:    "s-math",
			expectedNormCode: "math",
		},
		{
			input:            "  p_nafes  ",
			expectedClean:    "p_nafes",
			expectedNormCode: "nafes",
		},
		{
			input:            "qudrat",
			expectedClean:    "qudrat",
			expectedNormCode: "qudrat",
		},
		{
			input:            "",
			expectedClean:    "",
			expectedNormCode: "",
		},
	}

	for _, tt := range tests {
		t.Run(tt.input, func(t *testing.T) {
			clean, norm := normalizeTaxonomyCode(tt.input)
			if clean != tt.expectedClean {
				t.Errorf("clean: expected %q, got %q", tt.expectedClean, clean)
			}
			if norm != tt.expectedNormCode {
				t.Errorf("norm: expected %q, got %q", tt.expectedNormCode, norm)
			}
		})
	}
}
