package identityhttp

import "testing"

func TestNormalizeReturnToAllowsInternalPath(t *testing.T) {
	if got := normalizeReturnTo("/dashboard?tab=skills"); got != "/dashboard?tab=skills" {
		t.Fatalf("unexpected normalized path %q", got)
	}
}

func TestNormalizeReturnToRejectsExternalOrMalformedPaths(t *testing.T) {
	cases := []string{
		"https://evil.example",
		"//evil.example/path",
		"/\\evil",
		"/ok\r\nLocation:https://evil.example",
	}

	for _, value := range cases {
		if got := normalizeReturnTo(value); got != "/" {
			t.Fatalf("normalizeReturnTo(%q) = %q, want /", value, got)
		}
	}
}

func TestConstantTimeEqualRequiresExactState(t *testing.T) {
	if !constantTimeEqual("same-state", "same-state") {
		t.Fatal("expected identical OAuth state to match")
	}
	if constantTimeEqual("same-state", "other-state") {
		t.Fatal("different OAuth state must not match")
	}
}
