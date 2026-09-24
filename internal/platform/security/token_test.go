package security

import "testing"

func TestOpaqueTokenAndDigest(t *testing.T) {
	first, err := NewOpaqueToken(32)
	if err != nil {
		t.Fatal(err)
	}
	second, err := NewOpaqueToken(32)
	if err != nil {
		t.Fatal(err)
	}
	if first == second {
		t.Fatal("tokens must be unique")
	}
	if DigestToken(first) == first {
		t.Fatal("digest must not equal raw token")
	}
}
