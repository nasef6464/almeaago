package security

import "testing"

func TestPasswordHashRoundTrip(t *testing.T) {
	hash, err := HashPassword("StrongPass123")
	if err != nil {
		t.Fatal(err)
	}
	if !VerifyPassword(hash, "StrongPass123") {
		t.Fatal("expected password to verify")
	}
	if VerifyPassword(hash, "wrong-password") {
		t.Fatal("wrong password must not verify")
	}
}

func TestMalformedPasswordHashFailsClosed(t *testing.T) {
	for _, value := range []string{"", "abc", "pbkdf2-sha256$bad$x$y"} {
		if VerifyPassword(value, "StrongPass123") {
			t.Fatalf("malformed hash %q unexpectedly verified", value)
		}
	}
}
