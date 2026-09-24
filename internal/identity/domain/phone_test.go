package domain

import "testing"

func TestNormalizeSaudiPhone(t *testing.T) {
	tests := []struct {
		input string
		want  string
		ok    bool
	}{
		{"0501234567", "966501234567", true},
		{"501234567", "966501234567", true},
		{"+966 50 123 4567", "966501234567", true},
		{"00966-50-123-4567", "966501234567", true},
		{"1234", "", false},
	}

	for _, test := range tests {
		got, ok := NormalizeSaudiPhone(test.input)
		if ok != test.ok || got != test.want {
			t.Fatalf("NormalizeSaudiPhone(%q) = (%q,%v), want (%q,%v)", test.input, got, ok, test.want, test.ok)
		}
	}
}
